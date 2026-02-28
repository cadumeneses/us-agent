import os
import json
import argparse
from dotenv import load_dotenv
from agent.orchestrator import decide_under_uncertainty
from agent.human_review import maybe_apply_human_review
from agent.taxonomy import load_taxonomy, taxonomy_to_prompt_text
from agent.providers.openai_provider import OpenAIProvider
from agent.storage import append_jsonl

from agent.providers.http_provider import HttpJSONProvider
from agent.providers.gemini_provider import GeminiProvider


def read_user_stories() -> list[str]:
    """
    Lê US em uma linha separadas por ponto e vírgula (;).
    Evita quebrar quando a própria US contém vírgulas.
    """
    raw = input("Digite as US separadas por ponto e vírgula (;): ").strip()
    if not raw:
        return []
    return [s.strip() for s in raw.split(";") if s.strip()]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="WIS classifier with uncertainty-aware human review.")
    parser.add_argument("--project", default=None, help="Project name.")
    parser.add_argument("--reviewer", default=None, help="Reviewer name.")
    parser.add_argument("--stories", default=None, help="User stories separated by ';'.")
    parser.add_argument("--review-only", action="store_true", help="Open reviewer-only mode for existing results.")
    parser.add_argument("--results-path", default="runs/results.jsonl", help="Path to classification results JSONL.")
    return parser.parse_args()


def load_jsonl(path: str) -> list[dict]:
    if not os.path.exists(path):
        return []
    items: list[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            raw = line.strip()
            if not raw:
                continue
            try:
                items.append(json.loads(raw))
            except json.JSONDecodeError:
                continue
    return items


def is_pending_human_review(item: dict) -> bool:
    human_review = item.get("human_review") or {}
    outcome = human_review.get("outcome")
    if outcome in {"manual_classification_applied", "accepted_automatic_decision"}:
        return False
    if outcome == "kept_for_human_queue":
        return True
    return item.get("final", {}).get("decision") == "needs_human_review"


def append_taxonomy_feedback_if_any(result: dict, project: str):
    human_review = result.get("human_review") or {}
    feedback = human_review.get("taxonomy_feedback")
    if not feedback:
        return

    feedback_record = {
        "project": project,
        "user_story": result.get("user_story"),
        "reviewer": human_review.get("reviewer"),
        "reviewed_at": human_review.get("reviewed_at"),
        "uncertainty": result.get("uncertainty"),
        "final_decision": result.get("final"),
        "taxonomy_feedback": feedback,
    }
    append_jsonl("runs/taxonomy_feedback.jsonl", feedback_record)


def run_reviewer_only_mode(reviewer: str, taxonomy_text: str, results_path: str):
    records = load_jsonl(results_path)
    if not records:
        print(f"Nenhum registro encontrado em {results_path}.")
        return

    pending = [(idx, item) for idx, item in enumerate(records, start=1) if is_pending_human_review(item)]
    if not pending:
        print("Nao ha itens pendentes para revisao humana.")
        return

    print(f"Encontrados {len(pending)} itens pendentes para revisao em {results_path}.")
    for original_index, item in pending:
        reviewed = maybe_apply_human_review(
            result=item,
            taxonomy_text=taxonomy_text,
            enabled=True,
            only_on_escalation=False,
            reviewer=reviewer,
        )
        project = reviewed.get("project", "n/a")
        append_taxonomy_feedback_if_any(reviewed, project=project)
        append_jsonl(
            "runs/review_decisions.jsonl",
            {
                "source_results_path": results_path,
                "source_line": original_index,
                "project": project,
                "user_story": reviewed.get("user_story"),
                "uncertainty": reviewed.get("uncertainty"),
                "final": reviewed.get("final"),
                "human_review": reviewed.get("human_review"),
            },
        )


def main():
    load_dotenv()
    args = parse_args()

    reviewer = args.reviewer or input("Revisor humano (enter para 'human_reviewer'): ").strip() or "human_reviewer"
    taxonomy_path = os.getenv("TAXONOMY_PATH", "config/taxonomy.json")
    try:
        taxonomy = load_taxonomy(taxonomy_path)
    except (FileNotFoundError, ValueError) as e:
        print(f"Erro ao carregar taxonomia: {e}")
        return
    taxonomy_text = taxonomy_to_prompt_text(taxonomy)
    if args.review_only:
        run_reviewer_only_mode(reviewer=reviewer, taxonomy_text=taxonomy_text, results_path=args.results_path)
        return
    project = args.project or input("Nome do projeto (enter para 'n/a'): ").strip() or "n/a"

    if args.stories:
        user_stories = [s.strip() for s in args.stories.split(";") if s.strip()]
    else:
        user_stories = read_user_stories()
    if not user_stories:
        print("Nenhuma US informada. Encerrando.")
        return

    providers: list[tuple[str, object]] = []

    openai = None
    openai_api_key = os.getenv("OPENAI_API_KEY", "")
    if openai_api_key:
        openai = OpenAIProvider(model=os.getenv("OPENAI_MODEL", None))
        providers.append(("openai", openai))
    else:
        print("Aviso: OPENAI_API_KEY não definido; OpenAI será ignorado.")

    # Gemini via SDK google-genai
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    gemini = None
    if gemini_api_key:
        gemini = GeminiProvider(api_key=gemini_api_key, model=gemini_model)
        providers.append(("gemini", gemini))
    else:
        print("Aviso: GEMINI_API_KEY não definido; Gemini será ignorado.")

    # Deepseek via HTTP (formato OpenAI)
    deepseek = HttpJSONProvider(
        base_url=os.getenv("DEEPSEEK_BASE_URL", ""),
        api_key=os.getenv("DEEPSEEK_API_KEY", ""),
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        name="deepseek",
    )
    if deepseek.base_url:
        providers.append(("deepseek", deepseek))
    else:
        print("Aviso: DEEPSEEK_BASE_URL não definido; Deepseek será ignorado.")

    if not providers:
        print("Nenhum provedor configurado. Defina GEMINI_API_KEY ou DEEPSEEK_BASE_URL no .env.")
        return

    arbiter_provider = deepseek if deepseek.base_url else providers[0][1]
    max_reruns = int(os.getenv("UNCERTAINTY_MAX_RERUNS", "1"))
    medium_threshold = float(os.getenv("UNCERTAINTY_MEDIUM_THRESHOLD", "0.33"))
    high_threshold = float(os.getenv("UNCERTAINTY_HIGH_THRESHOLD", "0.66"))
    human_review_enabled = os.getenv("HUMAN_REVIEW_ENABLED", "true").lower() in {"1", "true", "yes", "y", "sim", "s"}
    review_only_on_escalation = os.getenv("HUMAN_REVIEW_ONLY_ON_ESCALATION", "true").lower() in {
        "1",
        "true",
        "yes",
        "y",
        "sim",
        "s",
    }

    for us in user_stories:
        final = decide_under_uncertainty(
            user_story=us,
            taxonomy=taxonomy_text,
            providers=providers,
            arbiter_provider=arbiter_provider,
            max_reruns=max_reruns,
            medium_threshold=medium_threshold,
            high_threshold=high_threshold,
        )
        final = maybe_apply_human_review(
            result=final,
            taxonomy_text=taxonomy_text,
            enabled=human_review_enabled,
            only_on_escalation=review_only_on_escalation,
            reviewer=reviewer,
        )
        final["project"] = project
        final["taxonomy_path"] = taxonomy_path
        append_jsonl("runs/results.jsonl", final)
        append_taxonomy_feedback_if_any(final, project=project)
        band = final["uncertainty"]["band"]
        score = final["uncertainty"]["uncertainty_score"]
        print(f"[{project}] {us} -> {final['final']} | uncertainty={band} ({score})")


if __name__ == "__main__":
    main()

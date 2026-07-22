import os
import uuid
import hashlib
import argparse
from pathlib import Path
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv
from agent.orchestrator import POLICY_VERSION, decide_under_uncertainty
from agent.human_review import maybe_apply_human_review
from agent.prompts import PROMPT_VERSION
from agent.taxonomy import taxonomy_to_prompt_text
from agent.providers.openai_provider import OpenAIProvider
from agent.api_client import AgentApiClient

from agent.providers.http_provider import HttpJSONProvider
from agent.providers.gemini_provider import GeminiProvider

ALLOWED_REVIEW_STATUSES = {
    "pending_review",
    "reviewed",
    "accepted_auto",
    "reclassified",
    "taxonomy_gap",
    "needs_rewrite",
}

NOT_COVERED_ROW = {"module": "n/a", "operation": "n/a"}


def normalize_user_story(user_story: str) -> str:
    return " ".join((user_story or "").split())


def generate_story_id(user_story: str) -> str:
    normalized = normalize_user_story(user_story)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
    return f"us_{digest}"


def derive_review_status(item: dict) -> str:
    explicit_status = item.get("review_status")
    if explicit_status in ALLOWED_REVIEW_STATUSES:
        return explicit_status

    human_review = item.get("human_review") or {}
    outcome = human_review.get("outcome")
    if outcome == "accepted_automatic_decision":
        return "accepted_auto"
    if outcome == "manual_classification_applied":
        return "reclassified"
    if outcome == "kept_for_human_queue":
        queue_status = human_review.get("queue_status")
        if queue_status in {"pending_review", "taxonomy_gap", "needs_rewrite"}:
            return queue_status

    final = item.get("final") or {}
    decision = final.get("decision")
    action = final.get("action")
    disagreement_cause = final.get("disagreement_cause")

    if decision != "needs_human_review":
        return "accepted_auto"
    if action == "extend_taxonomy" or disagreement_cause == "taxonomy_gap":
        return "taxonomy_gap"
    if action == "rewrite_story":
        return "needs_rewrite"
    if outcome:
        return "reviewed"
    return "pending_review"


def stamp_review_status(item: dict) -> dict:
    item["review_status"] = derive_review_status(item)
    return item


def read_user_stories() -> list[str]:
    """
    Lê US em uma linha separadas por ponto e vírgula (;).
    Evita quebrar quando a própria US contém vírgulas.
    """
    raw = input("Digite as US separadas por ponto e vírgula (;): ").strip()
    if not raw:
        return []
    return [s.strip() for s in raw.split(";") if s.strip()]


def parse_user_stories(raw: str) -> list[str]:
    if not raw:
        return []
    normalized = raw.replace("\r\n", "\n")
    if ";" in normalized:
        return [s.strip() for s in normalized.split(";") if s.strip()]
    return [line.strip() for line in normalized.split("\n") if line.strip()]


def load_user_stories_from_file(path: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as f:
        return parse_user_stories(f.read())


def parse_project_ids(raw: str | None) -> list[str]:
    if not raw:
        return []

    normalized = raw.replace(";", ",")
    project_ids: list[str] = []
    seen: set[str] = set()
    for part in normalized.split(","):
        token = part.strip()
        if not token:
            continue
        if "-" in token:
            start, end = [item.strip() for item in token.split("-", 1)]
            prefix_start = "".join(ch for ch in start if ch.isalpha())
            prefix_end = "".join(ch for ch in end if ch.isalpha())
            digits_start = "".join(ch for ch in start if ch.isdigit())
            digits_end = "".join(ch for ch in end if ch.isdigit())
            if prefix_start and prefix_start == prefix_end and digits_start and digits_end:
                start_num = int(digits_start)
                end_num = int(digits_end)
                width = max(len(digits_start), len(digits_end))
                step = 1 if end_num >= start_num else -1
                for number in range(start_num, end_num + step, step):
                    project_id = f"{prefix_start}{number:0{width}d}"
                    if project_id not in seen:
                        seen.add(project_id)
                        project_ids.append(project_id)
                continue
        if token not in seen:
            seen.add(token)
            project_ids.append(token)
    return project_ids


def load_project_batches(project_ids: list[str], projects_dir: str) -> list[tuple[str, list[str]]]:
    batches: list[tuple[str, list[str]]] = []
    for project_id in project_ids:
        story_file = Path(projects_dir) / f"{project_id}.txt"
        if not story_file.exists():
            raise FileNotFoundError(f"Arquivo do projeto nao encontrado: {story_file}")
        stories = load_user_stories_from_file(str(story_file))
        if not stories:
            raise ValueError(f"Nenhuma user story encontrada em {story_file}")
        batches.append((project_id, stories))
    return batches


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="WIS classifier with uncertainty-aware human review.")
    parser.add_argument("--project", default=None, help="Project name.")
    parser.add_argument(
        "--project-ids",
        default=None,
        help="Project IDs for batch execution, separated by ',' or ';'. Supports ranges like P01-P10.",
    )
    parser.add_argument(
        "--projects-dir",
        default="projects",
        help="Directory containing one file per project (<project_id>.txt). Used with --project-ids.",
    )
    parser.add_argument("--reviewer", default=None, help="Reviewer name.")
    parser.add_argument("--stories", default=None, help="User stories separated by ';'.")
    parser.add_argument(
        "--stories-file",
        default=None,
        help="Path to a text file containing user stories separated by ';' or one per line.",
    )
    parser.add_argument(
        "--classify-only",
        action="store_true",
        help="Classify a batch without waiting for human review. Escalated items are finalized as not covered.",
    )
    parser.add_argument("--review-only", action="store_true", help="Deprecated: use the WEB review queue.")
    return parser.parse_args()


def finalize_classification_without_review(result: dict) -> dict:
    final = result.setdefault("final", {})
    if final.get("decision") != "needs_human_review":
        return result

    final["final_rows"] = [dict(NOT_COVERED_ROW)]
    final["decision"] = "accept"
    final["action"] = "none"
    final["why"] = "Auto-finalized in classify-only mode as not covered."
    final["notes_for_human"] = None

    result["classification_mode"] = "classify_only"
    result["auto_resolution"] = {
        "kind": "not_covered",
        "reason": "human_review_skipped",
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }
    result["review_status"] = "accepted_auto"
    return result


def main():
    load_dotenv()
    args = parse_args()
    api_client = AgentApiClient()
    try:
        taxonomy_version, taxonomy = api_client.load_taxonomy()
    except (ValueError, requests.RequestException) as e:
        print(f"Erro ao carregar taxonomia da API: {e}")
        return
    print(f"Taxonomia SQL carregada pela API: version={taxonomy_version}")
    taxonomy_text = taxonomy_to_prompt_text(taxonomy)
    if args.review_only:
        print("O modo --review-only foi transferido para a fila de revisão da aplicação WEB.")
        return

    reviewer = args.reviewer
    if not args.classify_only:
        reviewer = reviewer or input("Revisor humano (enter para 'human_reviewer'): ").strip() or "human_reviewer"

    project_batches: list[tuple[str, list[str]]]
    if args.project_ids:
        try:
            project_batches = load_project_batches(
                project_ids=parse_project_ids(args.project_ids),
                projects_dir=args.projects_dir,
            )
        except (OSError, ValueError) as e:
            print(f"Erro ao carregar lote de projetos: {e}")
            return
    else:
        project = args.project or input("Nome do projeto (enter para 'n/a'): ").strip() or "n/a"

        if args.stories:
            user_stories = parse_user_stories(args.stories)
        elif args.stories_file:
            try:
                user_stories = load_user_stories_from_file(args.stories_file)
            except OSError as e:
                print(f"Erro ao ler arquivo de US ({args.stories_file}): {e}")
                return
        else:
            user_stories = read_user_stories()
        if not user_stories:
            print("Nenhuma US informada. Encerrando.")
            return
        project_batches = [(project, user_stories)]

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

    # Groq via HTTP (formato OpenAI-like)
    groq = HttpJSONProvider(
        base_url=os.getenv("GROQ_BASE_URL", ""),
        api_key=os.getenv("GROQ_API_KEY", ""),
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        name="groq",
    )
    if groq.base_url:
        providers.append(("groq", groq))
    else:
        print("Aviso: GROQ_BASE_URL não definido; Groq será ignorado.")

    if not providers:
        print(
            "Nenhum provedor configurado. Defina OPENAI_API_KEY, GEMINI_API_KEY, "
            "DEEPSEEK_BASE_URL ou GROQ_BASE_URL no .env."
        )
        return

    arbiter_provider = deepseek if deepseek.base_url else providers[0][1]
    max_reruns = int(os.getenv("UNCERTAINTY_MAX_RERUNS", "1"))
    medium_threshold = float(os.getenv("UNCERTAINTY_MEDIUM_THRESHOLD", "0.33"))
    high_threshold = float(os.getenv("UNCERTAINTY_HIGH_THRESHOLD", "0.66"))
    provider_timeout_seconds = float(os.getenv("PROVIDER_TIMEOUT_SECONDS", "60"))
    human_review_enabled = os.getenv("HUMAN_REVIEW_ENABLED", "true").lower() in {"1", "true", "yes", "y", "sim", "s"}
    review_only_on_escalation = os.getenv("HUMAN_REVIEW_ONLY_ON_ESCALATION", "true").lower() in {
        "1",
        "true",
        "yes",
        "y",
        "sim",
        "s",
    }
    run_id = f"run_{uuid.uuid4().hex}"

    for project, user_stories in project_batches:
        for us in user_stories:
            final = decide_under_uncertainty(
                user_story=us,
                taxonomy=taxonomy_text,
                taxonomy_map=taxonomy,
                providers=providers,
                arbiter_provider=arbiter_provider,
                provider_timeout_seconds=provider_timeout_seconds,
                max_reruns=max_reruns,
                medium_threshold=medium_threshold,
                high_threshold=high_threshold,
            )
            if args.classify_only:
                final = finalize_classification_without_review(final)
            else:
                final = maybe_apply_human_review(
                    result=final,
                    taxonomy_text=taxonomy_text,
                    enabled=human_review_enabled,
                    only_on_escalation=review_only_on_escalation,
                    reviewer=reviewer or "human_reviewer",
                )
            final["project"] = project
            final["story_id"] = generate_story_id(us)
            final["run_id"] = run_id
            final["taxonomy_version"] = taxonomy_version
            final["prompt_version"] = PROMPT_VERSION
            final["policy_version"] = final.get("policy", {}).get("policy_version", POLICY_VERSION)
            stamp_review_status(final)
            classification_id = api_client.save_classification(final)
            band = final["uncertainty"]["band"]
            score = final["uncertainty"]["uncertainty_score"]
            print(
                f"[{project}] classification_id={classification_id} story_id={final['story_id']} run_id={run_id} review_status={final['review_status']} "
                f"{us} -> {final['final']} | uncertainty={band} ({score})"
            )


if __name__ == "__main__":
    main()

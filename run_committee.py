import argparse
import os
import uuid

from dotenv import load_dotenv

from agent.human_review import maybe_apply_human_review
from agent.orchestrator import POLICY_VERSION, decide_without_arbiter
from agent.prompts import PROMPT_VERSION
from agent.providers.gemini_provider import GeminiProvider
from agent.providers.http_provider import HttpJSONProvider
from agent.providers.openai_provider import OpenAIProvider
from agent.storage import append_jsonl
from agent.taxonomy import load_taxonomy_with_version, taxonomy_to_prompt_text
from run import (
    append_taxonomy_feedback_if_any,
    finalize_classification_without_review,
    generate_story_id,
    load_project_batches,
    parse_project_ids,
    stamp_review_status,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="WIS committee-only classifier without arbiter.")
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
    parser.add_argument(
        "--results-path",
        default="runs/results.jsonl",
        help="Path to classification results JSONL.",
    )
    return parser.parse_args()


def build_providers() -> list[tuple[str, object]]:
    providers: list[tuple[str, object]] = []

    openai_api_key = os.getenv("OPENAI_API_KEY", "")
    if openai_api_key:
        providers.append(("openai", OpenAIProvider(model=os.getenv("OPENAI_MODEL", None))))
    else:
        print("Aviso: OPENAI_API_KEY não definido; OpenAI será ignorado.")

    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    if gemini_api_key:
        providers.append(("gemini", GeminiProvider(api_key=gemini_api_key, model=gemini_model)))
    else:
        print("Aviso: GEMINI_API_KEY não definido; Gemini será ignorado.")

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

    return providers


def main() -> None:
    load_dotenv()
    args = parse_args()
    taxonomy_path = os.getenv("TAXONOMY_PATH", "config/taxonomy.json")
    try:
        taxonomy_version, taxonomy = load_taxonomy_with_version(taxonomy_path)
    except (FileNotFoundError, ValueError) as exc:
        print(f"Erro ao carregar taxonomia: {exc}")
        return

    print(f"Taxonomia carregada: path={taxonomy_path} version={taxonomy_version}")
    taxonomy_text = taxonomy_to_prompt_text(taxonomy)

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
        except (OSError, ValueError) as exc:
            print(f"Erro ao carregar lote de projetos: {exc}")
            return
    else:
        project = args.project or input("Nome do projeto (enter para 'n/a'): ").strip() or "n/a"

        if args.stories:
            from run import parse_user_stories

            user_stories = parse_user_stories(args.stories)
        elif args.stories_file:
            try:
                from run import load_user_stories_from_file

                user_stories = load_user_stories_from_file(args.stories_file)
            except OSError as exc:
                print(f"Erro ao ler arquivo de US ({args.stories_file}): {exc}")
                return
        else:
            from run import read_user_stories

            user_stories = read_user_stories()

        if not user_stories:
            print("Nenhuma US informada. Encerrando.")
            return
        project_batches = [(project, user_stories)]

    providers = build_providers()
    if not providers:
        print(
            "Nenhum provedor configurado. Defina OPENAI_API_KEY, GEMINI_API_KEY, "
            "DEEPSEEK_BASE_URL ou GROQ_BASE_URL no .env."
        )
        return

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
            final = decide_without_arbiter(
                user_story=us,
                taxonomy=taxonomy_text,
                providers=providers,
                provider_timeout_seconds=provider_timeout_seconds,
                max_reruns=max_reruns,
                medium_threshold=medium_threshold,
                high_threshold=high_threshold,
            )
            final["committee_mode"] = "no_arbiter"
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
            final["taxonomy_path"] = taxonomy_path
            final["story_id"] = generate_story_id(us)
            final["run_id"] = run_id
            final["taxonomy_version"] = taxonomy_version
            final["prompt_version"] = PROMPT_VERSION
            final["policy_version"] = final.get("policy", {}).get("policy_version", f"{POLICY_VERSION}_no_arbiter")
            stamp_review_status(final)
            append_jsonl(args.results_path, final)
            append_taxonomy_feedback_if_any(final, project=project)
            band = final["uncertainty"]["band"]
            score = final["uncertainty"]["uncertainty_score"]
            print(
                f"[{project}] story_id={final['story_id']} run_id={run_id} review_status={final['review_status']} "
                f"{us} -> {final['final']} | uncertainty={band} ({score})"
            )


if __name__ == "__main__":
    main()

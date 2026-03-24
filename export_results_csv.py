import argparse
import csv
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exporta runs/results.jsonl para CSV."
    )
    parser.add_argument(
        "--input",
        default="runs/results.jsonl",
        help="Caminho do arquivo JSONL de entrada.",
    )
    parser.add_argument(
        "--output",
        default="runs/results.csv",
        help="Caminho do CSV de saida.",
    )
    parser.add_argument(
        "--project",
        default=None,
        help="Filtra por nome do projeto.",
    )
    return parser.parse_args()


def load_jsonl(path: Path) -> list[dict]:
    items: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            raw = line.strip()
            if not raw:
                continue
            try:
                items.append(json.loads(raw))
            except json.JSONDecodeError:
                continue
    return items


def canonical_rows(rows: list[dict]) -> str:
    if not rows:
        return ""
    return " | ".join(
        f"{row.get('module', '')}::{row.get('operation', '')}" for row in rows
    )


def provider_vote_map(votes: list[dict]) -> dict[str, dict]:
    vote_map: dict[str, dict] = {}
    for vote in votes:
        provider = vote.get("provider")
        if provider:
            vote_map[provider] = vote
    return vote_map


def export_csv(items: list[dict], output_path: Path) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    row_count = 0

    fieldnames = [
        "project",
        "story_id",
        "run_id",
        "user_story",
        "review_status",
        "classification_mode",
        "final_rows",
        "final_confidence",
        "decision",
        "disagreement_cause",
        "action",
        "why",
        "uncertainty_band",
        "uncertainty_score",
        "consensus_ratio",
        "disagreement_rate",
        "hypothesis_count",
        "label_overlap",
        "normalized_entropy",
        "taxonomy_version",
        "prompt_version",
        "policy_version",
        "openai_rows",
        "openai_confidence",
        "openai_needs_review",
        "gemini_rows",
        "gemini_confidence",
        "gemini_needs_review",
        "deepseek_rows",
        "deepseek_confidence",
        "deepseek_needs_review",
        "groq_rows",
        "groq_confidence",
        "groq_needs_review",
    ]

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()

        for item in items:
            votes = provider_vote_map(item.get("votes", []))
            final = item.get("final", {})
            uncertainty = item.get("uncertainty", {})

            writer.writerow(
                {
                    "project": item.get("project"),
                    "story_id": item.get("story_id"),
                    "run_id": item.get("run_id"),
                    "user_story": item.get("user_story"),
                    "review_status": item.get("review_status"),
                    "classification_mode": item.get("classification_mode"),
                    "final_rows": canonical_rows(final.get("final_rows", [])),
                    "final_confidence": final.get("final_confidence"),
                    "decision": final.get("decision"),
                    "disagreement_cause": final.get("disagreement_cause"),
                    "action": final.get("action"),
                    "why": final.get("why"),
                    "uncertainty_band": uncertainty.get("band"),
                    "uncertainty_score": uncertainty.get("uncertainty_score"),
                    "consensus_ratio": uncertainty.get("consensus_ratio"),
                    "disagreement_rate": uncertainty.get("disagreement_rate"),
                    "hypothesis_count": uncertainty.get("hypothesis_count"),
                    "label_overlap": uncertainty.get("label_overlap"),
                    "normalized_entropy": uncertainty.get("normalized_entropy"),
                    "taxonomy_version": item.get("taxonomy_version"),
                    "prompt_version": item.get("prompt_version"),
                    "policy_version": item.get("policy_version"),
                    "openai_rows": canonical_rows(votes.get("openai", {}).get("rows", [])),
                    "openai_confidence": votes.get("openai", {}).get("confidence"),
                    "openai_needs_review": votes.get("openai", {}).get("needs_review"),
                    "gemini_rows": canonical_rows(votes.get("gemini", {}).get("rows", [])),
                    "gemini_confidence": votes.get("gemini", {}).get("confidence"),
                    "gemini_needs_review": votes.get("gemini", {}).get("needs_review"),
                    "deepseek_rows": canonical_rows(votes.get("deepseek", {}).get("rows", [])),
                    "deepseek_confidence": votes.get("deepseek", {}).get("confidence"),
                    "deepseek_needs_review": votes.get("deepseek", {}).get("needs_review"),
                    "groq_rows": canonical_rows(votes.get("groq", {}).get("rows", [])),
                    "groq_confidence": votes.get("groq", {}).get("confidence"),
                    "groq_needs_review": votes.get("groq", {}).get("needs_review"),
                }
            )
            row_count += 1

    return row_count


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise SystemExit(f"Arquivo de entrada nao encontrado: {input_path}")

    items = load_jsonl(input_path)
    if args.project:
        items = [item for item in items if item.get("project") == args.project]

    row_count = export_csv(items, output_path)
    print(f"CSV gerado em {output_path} com {row_count} linhas.")


if __name__ == "__main__":
    main()

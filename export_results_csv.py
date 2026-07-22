import argparse
import csv
import os
from pathlib import Path

import requests
from dotenv import load_dotenv


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Exporta classificações da API SQL para CSV.")
    parser.add_argument("--output", default="runs/results.csv", help="Caminho do CSV de saída.")
    parser.add_argument("--project", default=None, help="Filtra pelo nome do projeto.")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()
    base_url = os.getenv("US_AGENT_API_URL", "http://localhost:3333/api").rstrip("/")
    response = requests.get(f"{base_url}/stories", params={"limit": 10_000}, timeout=30)
    response.raise_for_status()
    stories = response.json()
    if args.project:
        stories = [story for story in stories if story.get("project") == args.project]

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    fields = ["id", "project", "text", "module", "operation", "confidence", "uncertainty", "consensus", "status"]
    with output.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows({field: story.get(field) for field in fields} for story in stories)
    print(f"Exportadas {len(stories)} classificações SQL para {output}.")


if __name__ == "__main__":
    main()

import json
from pathlib import Path
from typing import Dict, List


TaxonomyMap = Dict[str, List[str]]


def load_taxonomy(path: str) -> TaxonomyMap:
    taxonomy_path = Path(path)
    if not taxonomy_path.exists():
        raise FileNotFoundError(f"Taxonomy file not found: {path}")

    with open(taxonomy_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, dict) or "modules" not in raw:
        raise ValueError("Invalid taxonomy format: expected object with key 'modules'.")

    modules = raw["modules"]
    if not isinstance(modules, dict) or not modules:
        raise ValueError("Invalid taxonomy format: 'modules' must be a non-empty object.")

    normalized: TaxonomyMap = {}
    for module, operations in modules.items():
        if not isinstance(module, str) or not module.strip():
            raise ValueError("Invalid taxonomy format: module name must be a non-empty string.")
        if not isinstance(operations, list) or not operations:
            raise ValueError(f"Invalid taxonomy format: module '{module}' must have a non-empty operations list.")
        clean_ops = []
        for op in operations:
            if not isinstance(op, str) or not op.strip():
                raise ValueError(f"Invalid operation in module '{module}'.")
            clean_ops.append(op.strip())
        normalized[module.strip()] = clean_ops
    return normalized


def taxonomy_to_prompt_text(taxonomy: TaxonomyMap) -> str:
    lines: list[str] = []
    for module, operations in taxonomy.items():
        lines.append(module)
        for op in operations:
            lines.append(f"- {op}")
        lines.append("")
    return "\n".join(lines).strip()

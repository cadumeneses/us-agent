from typing import Dict, List


TaxonomyMap = Dict[str, List[str]]


def taxonomy_to_prompt_text(taxonomy: TaxonomyMap, module_domains: Dict[str, str] | None = None) -> str:
    lines: list[str] = []
    for module, operations in taxonomy.items():
        domain = (module_domains or {}).get(module)
        lines.append(f"{domain} > {module}" if domain else module)
        for op in operations:
            lines.append(f"- {op}")
        lines.append("")
    return "\n".join(lines).strip()


def is_valid_taxonomy_row(module: str, operation: str, taxonomy: TaxonomyMap) -> bool:
    module_norm = module.strip()
    operation_norm = operation.strip()
    if module_norm == "n/a" and operation_norm == "n/a":
        return True
    return operation_norm in taxonomy.get(module_norm, [])

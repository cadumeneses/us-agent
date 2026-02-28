from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _parse_taxonomy(taxonomy: str) -> dict[str, list[str]]:
    parsed: dict[str, list[str]] = {}
    current_module: str | None = None
    for raw_line in taxonomy.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("- "):
            if current_module is None:
                continue
            parsed[current_module].append(line[2:].strip())
        else:
            current_module = line
            parsed[current_module] = []
    return parsed


def _ask_yes_no(prompt: str, default: bool = False) -> bool:
    suffix = " [Y/n]: " if default else " [y/N]: "
    raw = input(prompt + suffix).strip().lower()
    if not raw:
        return default
    return raw in {"y", "yes", "s", "sim"}


def _ask_choice(prompt: str, valid: set[str], default: str | None = None) -> str:
    while True:
        raw = input(prompt).strip().lower()
        if not raw and default is not None:
            return default
        if raw in valid:
            return raw
        print(f"Opcao invalida. Escolha uma de: {', '.join(sorted(valid))}.")


def _collect_manual_rows(taxonomy: dict[str, list[str]]) -> list[dict[str, str]]:
    modules = list(taxonomy.keys())
    selected: list[dict[str, str]] = []

    while True:
        print("\nModulos:")
        for idx, module in enumerate(modules, start=1):
            print(f"  {idx}. {module}")
        print("  0. Finalizar selecao")

        module_raw = input("Escolha o modulo (numero): ").strip()
        if module_raw == "0":
            break
        if not module_raw.isdigit() or not (1 <= int(module_raw) <= len(modules)):
            print("Modulo invalido.")
            continue

        module = modules[int(module_raw) - 1]
        operations = taxonomy[module]
        if not operations:
            print("Modulo sem operacoes configuradas.")
            continue

        print(f"Operacoes de {module}:")
        for idx, op in enumerate(operations, start=1):
            print(f"  {idx}. {op}")

        op_raw = input("Escolha a operacao (numero): ").strip()
        if not op_raw.isdigit() or not (1 <= int(op_raw) <= len(operations)):
            print("Operacao invalida.")
            continue

        operation = operations[int(op_raw) - 1]
        row = {"module": module, "operation": operation}
        if row not in selected:
            selected.append(row)
            print(f"Adicionado: {module} / {operation}")
        else:
            print("Par ja selecionado.")

    return selected


def _collect_taxonomy_feedback() -> dict[str, Any] | None:
    wants_feedback = _ask_yes_no("Deseja registrar proposta de evolucao da taxonomia?", default=False)
    if not wants_feedback:
        return None

    proposal_type = _ask_choice(
        "Tipo da proposta [1=new_operation, 2=new_module, 3=clarify_story]: ",
        {"1", "2", "3"},
    )
    mapped_type = {"1": "new_operation", "2": "new_module", "3": "clarify_story"}[proposal_type]

    target_module = input("Modulo alvo (vazio se nao aplicavel): ").strip() or None
    proposed_operation = input("Operacao proposta (vazio se nao aplicavel): ").strip() or None
    justification = input("Justificativa curta: ").strip()

    return {
        "proposal_type": mapped_type,
        "target_module": target_module,
        "proposed_operation": proposed_operation,
        "justification": justification,
        "status": "pending_taxonomy_board",
    }


def _extract_fallback_signals(result: dict[str, Any]) -> dict[str, list[str]]:
    issues: list[str] = []
    questions: list[str] = []
    for vote in result.get("votes", []):
        for item in vote.get("issues", []):
            if item not in issues:
                issues.append(item)
        for item in vote.get("suggested_questions", []):
            if item not in questions:
                questions.append(item)
    return {"issues": issues, "suggested_questions": questions}


def maybe_apply_human_review(
    result: dict[str, Any],
    taxonomy_text: str,
    enabled: bool,
    only_on_escalation: bool = True,
    reviewer: str = "human_reviewer",
) -> dict[str, Any]:
    if not enabled:
        return result

    escalated = result.get("final", {}).get("decision") == "needs_human_review"
    if only_on_escalation and not escalated:
        return result

    taxonomy = _parse_taxonomy(taxonomy_text)
    uncertainty = result.get("uncertainty", {})
    fallback = _extract_fallback_signals(result)

    print("\n" + "=" * 72)
    print("HUMAN REVIEW")
    print("=" * 72)
    print(f"US: {result.get('user_story', '')}")
    print(
        "Uncertainty: "
        f"{uncertainty.get('band', 'n/a')} "
        f"(score={uncertainty.get('uncertainty_score', 'n/a')}, "
        f"consensus={uncertainty.get('consensus_ratio', 'n/a')})"
    )
    print(f"Decisao atual: {result.get('final', {}).get('decision', 'n/a')}")
    print(f"Final atual: {result.get('final', {}).get('final_rows', [])}")

    if fallback["issues"]:
        print("\nSinais de fallback (issues):")
        for item in fallback["issues"]:
            print(f"- {item}")
    if fallback["suggested_questions"]:
        print("\nPerguntas sugeridas pelos modelos:")
        for item in fallback["suggested_questions"]:
            print(f"- {item}")

    print("\nAcoes:")
    print("  1. Aceitar decisao automatica")
    print("  2. Classificar manualmente agora")
    print("  3. Manter escalado para fila humana")

    action = _ask_choice("Escolha [1/2/3]: ", {"1", "2", "3"})
    notes = input("Notas do revisor (opcional): ").strip() or None
    feedback = _collect_taxonomy_feedback()

    review_record: dict[str, Any] = {
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewer": reviewer,
        "action": action,
        "notes": notes,
        "taxonomy_feedback": feedback,
    }

    if action == "1":
        review_record["outcome"] = "accepted_automatic_decision"
    elif action == "2":
        rows = _collect_manual_rows(taxonomy)
        if not rows:
            rows = [{"module": "n/a", "operation": "n/a"}]
        result["final"]["final_rows"] = rows
        result["final"]["decision"] = "accept"
        result["final"]["action"] = "none"
        result["final"]["why"] = "Decisao final definida por revisao humana interativa."
        result["final"]["disagreement_cause"] = "annotation_error_suspected"
        result["final"]["notes_for_human"] = None
        review_record["outcome"] = "manual_classification_applied"
    else:
        result["final"]["decision"] = "needs_human_review"
        result["final"]["action"] = "ask_human"
        review_record["outcome"] = "kept_for_human_queue"

    result["human_review"] = review_record
    return result

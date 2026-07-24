import json
from typing import Any, Iterable

from agent.prompts import QUALITY_PLAN_PROMPT, QUALITY_PLAN_SYSTEM_PROMPT
from agent.schemas import QualityPlanOutput


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def build_quality_plan_prompts(
    *,
    user_story: str,
    classification_rows: Iterable[dict[str, str]],
    classification_confidence: float,
    uncertainty_score: float,
    uncertainty_band: str,
    review_status: str,
    evidence: Iterable[str] = (),
    known_issues: Iterable[str] = (),
    business_context: str = "",
    output_language: str = "português do Brasil",
) -> tuple[str, str]:
    """Monta os prompts sem interpolar listas como texto ambíguo."""
    system = QUALITY_PLAN_SYSTEM_PROMPT.format(output_language=output_language)
    user = QUALITY_PLAN_PROMPT.format(
        user_story=user_story,
        business_context=business_context or "não informado",
        classification_rows=_json(list(classification_rows)),
        classification_confidence=f"{classification_confidence:.4f}",
        uncertainty_score=f"{uncertainty_score:.4f}",
        uncertainty_band=uncertainty_band,
        review_status=review_status,
        evidence=_json(list(evidence)),
        known_issues=_json(list(known_issues)),
    )
    return system, user


def recommend_quality_plan(provider: Any, **prompt_input: Any) -> QualityPlanOutput:
    """Executa o recomendador usando qualquer provider compatível do projeto."""
    system, user = build_quality_plan_prompts(**prompt_input)
    return provider.recommend_quality(system=system, user=user)

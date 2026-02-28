import json
import math
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from agent.prompts import CLASSIFIER_PROMPT, ARBITER_PROMPT
from agent.schemas import ArbiterOutput, ClassifierOutput, ClassificationRow


@dataclass
class ModelVote:
    provider: str
    output: ClassifierOutput


def _canonical_rows(rows: List[ClassificationRow]) -> Tuple[Tuple[str, str], ...]:
    unique_pairs = {(r.module, r.operation) for r in rows}
    return tuple(sorted(unique_pairs))


def _assess_uncertainty(committee_result: Dict[str, Any], medium_threshold: float, high_threshold: float) -> Dict[str, Any]:
    votes = committee_result["votes"]
    avg_conf = committee_result["aggregate"]["avg_confidence"]
    any_review = committee_result["aggregate"]["any_needs_review"]

    hypotheses: Dict[Tuple[Tuple[str, str], ...], int] = {}
    for v in votes:
        rows = [ClassificationRow(**r) for r in v["rows"]]
        key = _canonical_rows(rows)
        hypotheses[key] = hypotheses.get(key, 0) + 1

    total_votes = max(len(votes), 1)
    majority_votes = max(hypotheses.values()) if hypotheses else 0
    consensus_ratio = majority_votes / total_votes
    disagreement_rate = 1.0 - consensus_ratio

    # Entropia normalizada para indicar dispersão das hipóteses dos modelos.
    if len(hypotheses) <= 1:
        normalized_entropy = 0.0
    else:
        probs = [count / total_votes for count in hypotheses.values()]
        entropy = -sum(p * math.log2(p) for p in probs if p > 0)
        normalized_entropy = entropy / math.log2(len(hypotheses))

    confidence_risk = 1.0 - avg_conf
    review_risk = 1.0 if any_review else 0.0
    uncertainty_score = (0.50 * confidence_risk) + (0.35 * disagreement_rate) + (0.15 * review_risk)

    if uncertainty_score >= high_threshold:
        band = "high"
    elif uncertainty_score >= medium_threshold:
        band = "medium"
    else:
        band = "low"

    return {
        "uncertainty_score": round(uncertainty_score, 4),
        "band": band,
        "consensus_ratio": round(consensus_ratio, 4),
        "disagreement_rate": round(disagreement_rate, 4),
        "hypothesis_count": len(hypotheses),
        "normalized_entropy": round(normalized_entropy, 4),
        "confidence_risk": round(confidence_risk, 4),
        "review_risk": round(review_risk, 4),
    }


def committee_classify(
    user_story: str,
    taxonomy: str,
    providers: List[Tuple[str, Any]],
    system_hint: str | None = None,
) -> Dict[str, Any]:
    system = "Você é um classificador rigoroso. Produza JSON conforme o schema."
    if system_hint:
        system = f"{system} {system_hint}"
    user = CLASSIFIER_PROMPT.format(taxonomy=taxonomy, user_story=user_story)

    votes: List[ModelVote] = []
    for name, p in providers:
        out = p.classify(system=system, user=user)
        votes.append(ModelVote(provider=name, output=out))

    # Agregação simples: união das linhas e média de confiança
    all_rows: List[ClassificationRow] = []
    for v in votes:
        all_rows.extend(v.output.rows)

    avg_conf = sum(v.output.confidence for v in votes) / len(votes)
    any_review = any(v.output.needs_review for v in votes)

    aggregate = {
        "rows": [r.model_dump() for r in all_rows],
        "avg_confidence": avg_conf,
        "any_needs_review": any_review,
    }

    result = {
        "user_story": user_story,
        "votes": [{"provider": v.provider, **v.output.model_dump()} for v in votes],
        "aggregate": aggregate,
    }
    return result


def arbitrate_if_needed(committee_result: Dict[str, Any], taxonomy: str, arbiter_provider: Any) -> Dict[str, Any]:
    # Sempre arbitra (com um provedor só não há consenso a checar)
    system = "Você é um árbitro estrito e conservador. Produza JSON conforme o schema."
    user_story = committee_result["user_story"]
    model_outputs = json.dumps(committee_result["votes"], ensure_ascii=False)

    user = ARBITER_PROMPT.format(user_story=user_story, model_outputs=model_outputs)

    arb: ArbiterOutput = arbiter_provider.arbitrate(system=system, user=user)
    committee_result["final"] = arb.model_dump()
    return committee_result


def decide_under_uncertainty(
    user_story: str,
    taxonomy: str,
    providers: List[Tuple[str, Any]],
    arbiter_provider: Any,
    max_reruns: int = 1,
    medium_threshold: float = 0.33,
    high_threshold: float = 0.66,
) -> Dict[str, Any]:
    attempts: List[Dict[str, Any]] = []
    reruns_used = 0

    committee = committee_classify(user_story=user_story, taxonomy=taxonomy, providers=providers)
    uncertainty = _assess_uncertainty(committee, medium_threshold=medium_threshold, high_threshold=high_threshold)

    attempts.append(
        {
            "attempt": 1,
            "aggregate": committee["aggregate"],
            "uncertainty": uncertainty,
            "reason": "initial",
        }
    )

    while uncertainty["band"] == "medium" and reruns_used < max_reruns:
        reruns_used += 1
        committee_rerun = committee_classify(
            user_story=user_story,
            taxonomy=taxonomy,
            providers=providers,
            system_hint=(
                "Há divergência entre modelos. Seja conservador, não infira além do texto e "
                "marque needs_review=true em qualquer ambiguidade."
            ),
        )
        rerun_uncertainty = _assess_uncertainty(
            committee_rerun, medium_threshold=medium_threshold, high_threshold=high_threshold
        )

        attempts.append(
            {
                "attempt": reruns_used + 1,
                "aggregate": committee_rerun["aggregate"],
                "uncertainty": rerun_uncertainty,
                "reason": "medium_uncertainty_rerun",
            }
        )

        # Mantém o melhor cenário para arbitrar: menor incerteza e maior confiança média.
        current_score = (uncertainty["uncertainty_score"], -committee["aggregate"]["avg_confidence"])
        rerun_score = (rerun_uncertainty["uncertainty_score"], -committee_rerun["aggregate"]["avg_confidence"])
        if rerun_score < current_score:
            committee = committee_rerun
            uncertainty = rerun_uncertainty
        else:
            break

    result = arbitrate_if_needed(committee_result=committee, taxonomy=taxonomy, arbiter_provider=arbiter_provider)
    result["uncertainty"] = uncertainty
    result["attempts"] = attempts
    result["policy"] = {
        "policy_version": "uncertainty_v1",
        "max_reruns": max_reruns,
        "reruns_used": reruns_used,
        "medium_threshold": medium_threshold,
        "high_threshold": high_threshold,
    }

    # Guardrail operacional: risco alto ou divergência persistente -> revisão humana.
    if uncertainty["band"] == "high":
        result["final"]["decision"] = "needs_human_review"
        result["final"]["action"] = "ask_human"
        result["final"]["why"] = (
            f"Risco alto ({uncertainty['uncertainty_score']}) por baixa confiança/divergência de hipóteses."
        )
        result["final"]["disagreement_cause"] = "model_instability"
        result["final"]["notes_for_human"] = (
            "Incerteza alta após política de rerun. Revisão humana obrigatória antes de usar em produção."
        )
    elif uncertainty["band"] == "medium" and uncertainty["consensus_ratio"] < 0.67:
        result["final"]["decision"] = "needs_human_review"
        result["final"]["action"] = "ask_human"
        result["final"]["disagreement_cause"] = "model_instability"
        result["final"]["notes_for_human"] = (
            "Incerteza média com consenso insuficiente entre modelos; decisão mantida para triagem humana."
        )

    return result

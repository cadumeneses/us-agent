import json
import math
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import requests
from pydantic import ValidationError

from agent.prompts import ARBITER_PROMPT, CLASSIFIER_PROMPT
from agent.schemas import ArbiterOutput, ClassificationRow, ClassifierOutput
from agent.taxonomy import TaxonomyMap, is_valid_taxonomy_row

POLICY_VERSION = "uncertainty_v2"


@dataclass
class ModelVote:
    provider: str
    output: ClassifierOutput


def _canonical_rows(rows: List[ClassificationRow]) -> Tuple[Tuple[str, str], ...]:
    unique_pairs = {(r.module, r.operation) for r in rows}
    return tuple(sorted(unique_pairs))


def _avg_pairwise_jaccard(label_sets: List[set[Tuple[str, str]]]) -> float:
    if len(label_sets) <= 1:
        return 1.0

    scores: List[float] = []
    for i in range(len(label_sets)):
        for j in range(i + 1, len(label_sets)):
            left = label_sets[i]
            right = label_sets[j]
            union = left | right
            if not union:
                scores.append(1.0)
            else:
                scores.append(len(left & right) / len(union))
    return sum(scores) / len(scores) if scores else 1.0


def _call_with_timeout(callable_fn: Any, timeout_seconds: float) -> Any:
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(callable_fn)
    try:
        return future.result(timeout=timeout_seconds)
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def _provider_error_status(exc: Exception) -> str:
    if isinstance(exc, FutureTimeoutError):
        return "timeout"
    if isinstance(exc, requests.Timeout):
        return "timeout"
    if isinstance(exc, (ValidationError, json.JSONDecodeError)):
        return "parse_error"
    if isinstance(exc, requests.RequestException):
        return "http_error"

    name = exc.__class__.__name__.lower()
    if "timeout" in name:
        return "timeout"
    if "validation" in name or "json" in name or "parse" in name:
        return "parse_error"
    return "http_error"


def _error_message(exc: Exception) -> str:
    text = str(exc).strip()
    if not text:
        return exc.__class__.__name__
    return f"{exc.__class__.__name__}: {text}"


def _assess_uncertainty(committee_result: Dict[str, Any], medium_threshold: float, high_threshold: float) -> Dict[str, Any]:
    votes = committee_result["votes"]
    avg_conf = committee_result["aggregate"]["avg_confidence"]
    any_review = committee_result["aggregate"]["any_needs_review"]

    hypotheses: Dict[Tuple[Tuple[str, str], ...], int] = {}
    vote_label_sets: List[set[Tuple[str, str]]] = []
    na_vote_count = 0
    taxonomy_gap_signal_count = 0
    for v in votes:
        rows = [ClassificationRow(**r) for r in v["rows"]]
        key = _canonical_rows(rows)
        hypotheses[key] = hypotheses.get(key, 0) + 1
        label_set = set(key)
        vote_label_sets.append(label_set)
        if any(
            row.module.strip().lower() == "n/a" or row.operation.strip().lower() == "n/a"
            for row in rows
        ):
            na_vote_count += 1
        issues = v.get("issues", [])
        if any(
            "taxonomy_gap" in str(issue).lower()
            or "taxonomia" in str(issue).lower()
            or "lacuna" in str(issue).lower()
            for issue in issues
        ):
            taxonomy_gap_signal_count += 1

    total_votes = max(len(votes), 1)
    majority_votes = max(hypotheses.values()) if hypotheses else 0
    consensus_ratio = majority_votes / total_votes
    disagreement_rate = 1.0 - consensus_ratio
    label_overlap = _avg_pairwise_jaccard(vote_label_sets)

    if len(hypotheses) <= 1:
        normalized_entropy = 0.0
    else:
        probs = [count / total_votes for count in hypotheses.values()]
        entropy = -sum(p * math.log2(p) for p in probs if p > 0)
        normalized_entropy = entropy / math.log2(len(hypotheses))

    confidence_risk = 1.0 - avg_conf
    entropy_risk = normalized_entropy
    na_ratio = na_vote_count / total_votes
    taxonomy_gap_ratio = taxonomy_gap_signal_count / total_votes
    na_gap_penalty = min(1.0, (0.70 * na_ratio) + (0.30 * taxonomy_gap_ratio))

    if disagreement_rate == 0:
        disagreement_level = "none"
        disagreement_risk = 0.0
    elif disagreement_rate < 0.34 and label_overlap >= 0.50:
        disagreement_level = "light"
        disagreement_risk = disagreement_rate * 0.55
    else:
        disagreement_level = "strong"
        disagreement_risk = disagreement_rate

    review_risk = 1.0 if any_review else 0.0
    uncertainty_score = (
        (0.25 * confidence_risk)
        + (0.20 * entropy_risk)
        + (0.25 * disagreement_risk)
        + (0.15 * na_gap_penalty)
        + (0.15 * review_risk)
    )

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
        "disagreement_level": disagreement_level,
        "disagreement_risk": round(disagreement_risk, 4),
        "hypothesis_count": len(hypotheses),
        "label_overlap": round(label_overlap, 4),
        "normalized_entropy": round(normalized_entropy, 4),
        "confidence_risk": round(confidence_risk, 4),
        "entropy_risk": round(entropy_risk, 4),
        "na_gap_penalty": round(na_gap_penalty, 4),
        "na_ratio": round(na_ratio, 4),
        "taxonomy_gap_ratio": round(taxonomy_gap_ratio, 4),
        "review_risk": round(review_risk, 4),
    }


def committee_classify(
    user_story: str,
    taxonomy: str,
    providers: List[Tuple[str, Any]],
    timeout_seconds: float,
    system_hint: str | None = None,
) -> Dict[str, Any]:
    system = "Você é um classificador rigoroso. Produza JSON conforme o schema."
    if system_hint:
        system = f"{system} {system_hint}"
    user = CLASSIFIER_PROMPT.format(taxonomy=taxonomy, user_story=user_story)

    votes: List[ModelVote] = []
    provider_statuses: List[Dict[str, Any]] = []
    for name, provider in providers:
        try:
            out: ClassifierOutput = _call_with_timeout(
                lambda p=provider: p.classify(system=system, user=user),
                timeout_seconds=timeout_seconds,
            )
            votes.append(ModelVote(provider=name, output=out))
            provider_statuses.append({"provider": name, "status": "success", "error": None})
        except Exception as exc:
            provider_statuses.append(
                {
                    "provider": name,
                    "status": _provider_error_status(exc),
                    "error": _error_message(exc),
                }
            )

    all_rows: List[ClassificationRow] = []
    for v in votes:
        all_rows.extend(v.output.rows)

    avg_conf = sum(v.output.confidence for v in votes) / len(votes) if votes else 0.0
    any_review = any(v.output.needs_review for v in votes) or not votes
    failed_count = sum(1 for status in provider_statuses if status["status"] != "success")

    aggregate = {
        "rows": [r.model_dump() for r in all_rows],
        "avg_confidence": avg_conf,
        "any_needs_review": any_review,
    }

    return {
        "user_story": user_story,
        "votes": [{"provider": v.provider, **v.output.model_dump()} for v in votes],
        "provider_statuses": provider_statuses,
        "provider_health": {
            "total": len(providers),
            "successful": len(votes),
            "failed": failed_count,
        },
        "aggregate": aggregate,
    }


def _find_invalid_arbiter_rows(rows: List[ClassificationRow], taxonomy_map: TaxonomyMap) -> List[Dict[str, str]]:
    invalid_rows: List[Dict[str, str]] = []
    for row in rows:
        if is_valid_taxonomy_row(row.module, row.operation, taxonomy_map):
            continue
        invalid_rows.append({"module": row.module, "operation": row.operation})
    return invalid_rows


def arbitrate_if_needed(
    committee_result: Dict[str, Any],
    taxonomy: str,
    taxonomy_map: TaxonomyMap,
    arbiter_provider: Any,
    timeout_seconds: float,
) -> Dict[str, Any]:
    system = "Você é um árbitro estrito e conservador. Produza JSON conforme o schema."
    user_story = committee_result["user_story"]
    model_outputs = json.dumps(committee_result["votes"], ensure_ascii=False)
    user = ARBITER_PROMPT.format(taxonomy=taxonomy, user_story=user_story, model_outputs=model_outputs)

    try:
        arb: ArbiterOutput = _call_with_timeout(
            lambda: arbiter_provider.arbitrate(system=system, user=user),
            timeout_seconds=timeout_seconds,
        )
        committee_result["arbiter_status"] = {"status": "success", "error": None}
    except Exception as exc:
        committee_result["arbiter_status"] = {"status": _provider_error_status(exc), "error": _error_message(exc)}
        committee_result["final"] = {
            "final_rows": [{"module": "n/a", "operation": "n/a"}],
            "final_confidence": 0.0,
            "decision": "needs_human_review",
            "disagreement_cause": "model_instability",
            "why": "Arbiter failed; escalated for human review.",
            "action": "ask_human",
            "notes_for_human": committee_result["arbiter_status"]["error"],
        }
        return committee_result

    invalid_rows = _find_invalid_arbiter_rows(arb.final_rows, taxonomy_map)
    if invalid_rows:
        committee_result["arbiter_validation"] = {"valid": False, "invalid_rows": invalid_rows}
        committee_result["final"] = {
            "final_rows": [{"module": "n/a", "operation": "n/a"}],
            "final_confidence": 0.0,
            "decision": "needs_human_review",
            "disagreement_cause": "prompt_misinterpretation",
            "why": "Arbiter output rejected: module/operation outside loaded taxonomy.",
            "action": "ask_human",
            "notes_for_human": f"Invalid arbiter rows: {invalid_rows}",
        }
        return committee_result

    committee_result["arbiter_validation"] = {"valid": True, "invalid_rows": []}
    committee_result["final"] = arb.model_dump()
    return committee_result


def _select_committee_majority(committee_result: Dict[str, Any]) -> Dict[str, Any]:
    votes = committee_result.get("votes", [])
    if not votes:
        return {
            "final_rows": [{"module": "n/a", "operation": "n/a"}],
            "final_confidence": 0.0,
            "decision": "needs_human_review",
            "disagreement_cause": "model_instability",
            "why": "Nenhum provider classificou com sucesso.",
            "action": "ask_human",
            "notes_for_human": "Sem votos validos do comite.",
        }

    grouped: Dict[Tuple[Tuple[str, str], ...], Dict[str, Any]] = {}
    for vote in votes:
        rows = [ClassificationRow(**row) for row in vote.get("rows", [])]
        key = _canonical_rows(rows)
        entry = grouped.setdefault(
            key,
            {
                "count": 0,
                "rows": [row.model_dump() for row in rows],
                "confidences": [],
                "needs_review": [],
                "issues": [],
            },
        )
        entry["count"] += 1
        entry["confidences"].append(vote.get("confidence", 0.0))
        entry["needs_review"].append(vote.get("needs_review", False))
        entry["issues"].extend(vote.get("issues", []))

    best = max(
        grouped.values(),
        key=lambda item: (
            item["count"],
            sum(item["confidences"]) / len(item["confidences"]) if item["confidences"] else 0.0,
        ),
    )
    avg_confidence = sum(best["confidences"]) / len(best["confidences"]) if best["confidences"] else 0.0
    needs_review = any(best["needs_review"])
    has_na = any(
        row["module"].strip().lower() == "n/a" or row["operation"].strip().lower() == "n/a"
        for row in best["rows"]
    )

    disagreement_cause = "model_instability"
    if has_na:
        disagreement_cause = "taxonomy_gap"

    return {
        "final_rows": best["rows"] or [{"module": "n/a", "operation": "n/a"}],
        "final_confidence": round(avg_confidence, 2),
        "decision": "needs_human_review" if needs_review else "accept",
        "disagreement_cause": disagreement_cause,
        "why": "Resultado escolhido por maioria simples do comite, sem arbitro.",
        "action": "ask_human" if needs_review else "none",
        "notes_for_human": None if not best["issues"] else "; ".join(best["issues"][:3]),
    }


def _force_human_review_due_provider_failures(result: Dict[str, Any]) -> None:
    failed = result.get("provider_health", {}).get("failed", 0)
    successful = result.get("provider_health", {}).get("successful", 0)
    if failed < 2 and successful > 0:
        return

    result["final"]["decision"] = "needs_human_review"
    result["final"]["action"] = "ask_human"
    result["final"]["disagreement_cause"] = "model_instability"
    result["final"]["why"] = (
        f"Escalonado por falha de providers (successful={successful}, failed={failed})."
    )
    result["final"]["notes_for_human"] = "Confiabilidade insuficiente de providers para decisão automática."


def decide_under_uncertainty(
    user_story: str,
    taxonomy: str,
    taxonomy_map: TaxonomyMap,
    providers: List[Tuple[str, Any]],
    arbiter_provider: Any,
    provider_timeout_seconds: float,
    max_reruns: int = 1,
    medium_threshold: float = 0.33,
    high_threshold: float = 0.66,
) -> Dict[str, Any]:
    attempts: List[Dict[str, Any]] = []
    reruns_used = 0

    committee = committee_classify(
        user_story=user_story,
        taxonomy=taxonomy,
        providers=providers,
        timeout_seconds=provider_timeout_seconds,
    )
    uncertainty = _assess_uncertainty(committee, medium_threshold=medium_threshold, high_threshold=high_threshold)

    attempts.append(
        {
            "attempt": 1,
            "aggregate": committee["aggregate"],
            "provider_health": committee["provider_health"],
            "provider_statuses": committee["provider_statuses"],
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
            timeout_seconds=provider_timeout_seconds,
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
                "provider_health": committee_rerun["provider_health"],
                "provider_statuses": committee_rerun["provider_statuses"],
                "uncertainty": rerun_uncertainty,
                "reason": "medium_uncertainty_rerun",
            }
        )

        current_score = (uncertainty["uncertainty_score"], -committee["aggregate"]["avg_confidence"])
        rerun_score = (rerun_uncertainty["uncertainty_score"], -committee_rerun["aggregate"]["avg_confidence"])
        if rerun_score < current_score:
            committee = committee_rerun
            uncertainty = rerun_uncertainty
        else:
            break

    result = arbitrate_if_needed(
        committee_result=committee,
        taxonomy=taxonomy,
        taxonomy_map=taxonomy_map,
        arbiter_provider=arbiter_provider,
        timeout_seconds=provider_timeout_seconds,
    )
    result["uncertainty"] = uncertainty
    result["attempts"] = attempts
    result["policy"] = {
        "policy_version": POLICY_VERSION,
        "max_reruns": max_reruns,
        "reruns_used": reruns_used,
        "medium_threshold": medium_threshold,
        "high_threshold": high_threshold,
        "provider_timeout_seconds": provider_timeout_seconds,
    }

    _force_human_review_due_provider_failures(result)

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


def decide_without_arbiter(
    user_story: str,
    taxonomy: str,
    providers: List[Tuple[str, Any]],
    provider_timeout_seconds: float,
    max_reruns: int = 1,
    medium_threshold: float = 0.33,
    high_threshold: float = 0.66,
) -> Dict[str, Any]:
    attempts: List[Dict[str, Any]] = []
    reruns_used = 0

    committee = committee_classify(
        user_story=user_story,
        taxonomy=taxonomy,
        providers=providers,
        timeout_seconds=provider_timeout_seconds,
    )
    uncertainty = _assess_uncertainty(committee, medium_threshold=medium_threshold, high_threshold=high_threshold)

    attempts.append(
        {
            "attempt": 1,
            "aggregate": committee["aggregate"],
            "provider_health": committee["provider_health"],
            "provider_statuses": committee["provider_statuses"],
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
            timeout_seconds=provider_timeout_seconds,
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
                "provider_health": committee_rerun["provider_health"],
                "provider_statuses": committee_rerun["provider_statuses"],
                "uncertainty": rerun_uncertainty,
                "reason": "medium_uncertainty_rerun",
            }
        )

        current_score = (uncertainty["uncertainty_score"], -committee["aggregate"]["avg_confidence"])
        rerun_score = (rerun_uncertainty["uncertainty_score"], -committee_rerun["aggregate"]["avg_confidence"])
        if rerun_score < current_score:
            committee = committee_rerun
            uncertainty = rerun_uncertainty
        else:
            break

    result = committee
    result["arbiter_status"] = {"status": "skipped", "error": None}
    result["arbiter_validation"] = {"valid": True, "invalid_rows": []}
    result["final"] = _select_committee_majority(result)
    result["uncertainty"] = uncertainty
    result["attempts"] = attempts
    result["policy"] = {
        "policy_version": f"{POLICY_VERSION}_no_arbiter",
        "max_reruns": max_reruns,
        "reruns_used": reruns_used,
        "medium_threshold": medium_threshold,
        "high_threshold": high_threshold,
        "provider_timeout_seconds": provider_timeout_seconds,
    }

    _force_human_review_due_provider_failures(result)

    if uncertainty["band"] == "high":
        result["final"]["decision"] = "needs_human_review"
        result["final"]["action"] = "ask_human"
        result["final"]["why"] = (
            f"Risco alto ({uncertainty['uncertainty_score']}) sem arbitragem; revisão humana obrigatória."
        )
        result["final"]["disagreement_cause"] = "model_instability"
        result["final"]["notes_for_human"] = "Comitê sem árbitro e divergência alta entre classificadores."
    elif uncertainty["band"] == "medium" and uncertainty["consensus_ratio"] < 0.67:
        result["final"]["decision"] = "needs_human_review"
        result["final"]["action"] = "ask_human"
        result["final"]["disagreement_cause"] = "model_instability"
        result["final"]["notes_for_human"] = (
            "Comitê sem árbitro e consenso insuficiente entre classificadores."
        )

    return result

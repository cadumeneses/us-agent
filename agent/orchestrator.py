import json
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from agent.prompts import CLASSIFIER_PROMPT, ARBITER_PROMPT
from agent.schemas import ArbiterOutput, ClassifierOutput, ClassificationRow


@dataclass
class ModelVote:
    provider: str
    output: ClassifierOutput


def committee_classify(user_story: str, taxonomy: str, providers: List[Tuple[str, Any]]) -> Dict[str, Any]:
    system = "Você é um classificador rigoroso. Produza JSON conforme o schema."
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

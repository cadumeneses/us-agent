from typing import List, Literal, Optional

from pydantic import BaseModel, Field, confloat


class ClassificationRow(BaseModel):
    module: str
    operation: str


class ClassifierOutput(BaseModel):
    rows: List[ClassificationRow]
    confidence: confloat(ge=0.0, le=1.0)
    rationale: str
    evidence: List[str] = Field(default_factory=list)
    needs_review: bool = False
    issues: List[str] = Field(default_factory=list)
    suggested_questions: List[str] = Field(default_factory=list)


class ArbiterOutput(BaseModel):
    final_rows: List[ClassificationRow]
    final_confidence: confloat(ge=0.0, le=1.0)
    decision: Literal["accept", "needs_human_review"]
    disagreement_cause: Literal[
        "ambiguity_in_story",
        "taxonomy_gap",
        "annotation_error_suspected",
        "model_instability",
        "prompt_misinterpretation",
        "multi_label_story",
    ]
    why: str
    action: Literal["none", "rewrite_story", "extend_taxonomy", "ask_human", "rerun_models"]
    notes_for_human: Optional[str] = None


RecommendationBasis = Literal[
    "explicit_in_story",
    "inferred_from_story",
    "general_quality_practice",
]


class QualityQuestion(BaseModel):
    text: str
    reason: str
    priority: Literal["high", "medium"]


class AcceptanceCriterionSuggestion(BaseModel):
    text: str
    basis: RecommendationBasis
    assumption: bool
    evidence: List[str] = Field(default_factory=list)


class QualityTestCaseSuggestion(BaseModel):
    title: str
    type: Literal["positive", "negative", "boundary", "security"]
    priority: Literal["high", "medium"]
    basis: RecommendationBasis
    assumption: bool
    objective: str
    preconditions: List[str] = Field(default_factory=list)
    steps: List[str] = Field(min_length=1, max_length=8)
    expected_result: str
    related_rows: List[ClassificationRow] = Field(default_factory=list)


class QualityRisk(BaseModel):
    description: str
    impact: Literal["high", "medium", "low"]
    requires_clarification: bool


class QualityPlanOutput(BaseModel):
    readiness: Literal["ready", "needs_clarification", "needs_human_review"]
    summary: str
    questions: List[QualityQuestion] = Field(default_factory=list, max_length=8)
    acceptance_criteria: List[AcceptanceCriterionSuggestion] = Field(default_factory=list, max_length=12)
    test_cases: List[QualityTestCaseSuggestion] = Field(default_factory=list, max_length=20)
    risks: List[QualityRisk] = Field(default_factory=list, max_length=8)
    warnings: List[str] = Field(default_factory=list)

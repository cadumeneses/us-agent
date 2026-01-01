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

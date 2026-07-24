import os
from openai import OpenAI
from agent.schemas import ClassifierOutput, ArbiterOutput, QualityPlanOutput

class OpenAIProvider:
    def __init__(self, model: str | None = None):
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        self.model = model or os.environ.get("OPENAI_MODEL", "gpt-5-pro")

    def classify(self, system: str, user: str) -> ClassifierOutput:
        resp = self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            text_format=ClassifierOutput,
            store=False,          # para não armazenar os dados no OpenAI
        )
        return resp.output_parsed

    def arbitrate(self, system: str, user: str) -> ArbiterOutput:
        resp = self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            text_format=ArbiterOutput,
            store=False,
        )
        return resp.output_parsed

    def recommend_quality(self, system: str, user: str) -> QualityPlanOutput:
        resp = self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            text_format=QualityPlanOutput,
            store=False,
        )
        return resp.output_parsed

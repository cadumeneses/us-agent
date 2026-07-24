from google import genai

from agent.schemas import ArbiterOutput, ClassifierOutput, QualityPlanOutput


class GeminiProvider:
    """
    Usa google-genai para chamadas ao Gemini.
    """

    def __init__(self, api_key: str, model: str):
        self.client = genai.Client(api_key=api_key)
        self.model = model

    def _run(self, system: str, user: str) -> str:
        prompt = f"{system}\n\n{user}"
        resp = self.client.models.generate_content(
            model=self.model,
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"temperature": 0.0},
        )
        if hasattr(resp, "text") and resp.text:
            return resp.text
        return resp.candidates[0].content.parts[0].text

    def _extract_json(self, text: str) -> str:
        """
        Remove cercas de código e retorna somente o bloco JSON.
        Funciona para respostas com ```json ... ``` ou resposta limpa.
        """
        cleaned = text.strip()
        if "```" in cleaned:
            cleaned = cleaned.replace("```json", "").replace("```", "").strip()
        return cleaned

    def classify(self, system: str, user: str) -> ClassifierOutput:
        text = self._run(system, user)
        return ClassifierOutput.model_validate_json(self._extract_json(text))

    def arbitrate(self, system: str, user: str) -> ArbiterOutput:
        text = self._run(system, user)
        return ArbiterOutput.model_validate_json(self._extract_json(text))

    def recommend_quality(self, system: str, user: str) -> QualityPlanOutput:
        text = self._run(system, user)
        return QualityPlanOutput.model_validate_json(self._extract_json(text))

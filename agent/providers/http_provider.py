import json
import requests
from agent.schemas import ClassifierOutput, ArbiterOutput

class HttpJSONProvider:
    """
    Provider genérico: espera que o endpoint retorne um texto que seja JSON do ClassifierOutput.
    Ajuste build_payload() para cada provedor.
    """
    def __init__(self, base_url: str, api_key: str, model: str, name: str):
        self.base_url = base_url
        self.api_key = api_key
        self.model = model
        self.name = name

    def build_headers(self):
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    def build_payload(self, system: str, user: str):
        # padrão OpenAI-like
        return {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.0,
        }

    def parse_text_from_response(self, r_json: dict) -> str:
        return r_json["choices"][0]["message"]["content"]

    def _extract_json(self, text: str) -> str:
        """
        Remove cercas de código (```json ... ```) se presentes e retorna o JSON bruto.
        """
        cleaned = text.strip()
        if "```" in cleaned:
            cleaned = cleaned.replace("```json", "").replace("```", "").strip()
        return cleaned

    def classify(self, system: str, user: str) -> ClassifierOutput:
        payload = self.build_payload(system, user)
        r = requests.post(self.base_url, headers=self.build_headers(), data=json.dumps(payload), timeout=60)
        r.raise_for_status()
        text = self.parse_text_from_response(r.json())
        return ClassifierOutput.model_validate_json(self._extract_json(text))

    def arbitrate(self, system: str, user: str) -> ArbiterOutput:
        payload = self.build_payload(system, user)
        r = requests.post(self.base_url, headers=self.build_headers(), data=json.dumps(payload), timeout=60)
        r.raise_for_status()
        text = self.parse_text_from_response(r.json())
        return ArbiterOutput.model_validate_json(self._extract_json(text))

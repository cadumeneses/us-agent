import os
from typing import Any

import requests


class AgentApiClient:
    """HTTP boundary used by the Python worker to access application data."""

    def __init__(self) -> None:
        self.base_url = os.getenv("US_AGENT_API_URL", "http://localhost:3333/api").rstrip("/")
        self.ingest_api_key = os.getenv("INGEST_API_KEY", "")
        self.timeout_seconds = float(os.getenv("US_AGENT_API_TIMEOUT_SECONDS", "30"))
        self.session = requests.Session()

    def _headers(self) -> dict[str, str]:
        if not self.ingest_api_key:
            return {}
        return {"Authorization": f"Bearer {self.ingest_api_key}"}

    def load_taxonomy(self) -> tuple[str, dict[str, list[str]]]:
        response = self.session.get(
            f"{self.base_url}/taxonomy",
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        version = payload.get("version")
        modules = payload.get("modules")
        if not isinstance(version, str) or not isinstance(modules, dict) or not modules:
            raise ValueError("A API retornou uma taxonomia inválida.")
        normalized: dict[str, list[str]] = {}
        for module, operations in modules.items():
            if not isinstance(module, str) or not isinstance(operations, list):
                raise ValueError("A API retornou uma taxonomia inválida.")
            normalized[module] = [str(operation) for operation in operations]
        return version, normalized

    def save_classification(self, result: dict[str, Any]) -> str:
        response = self.session.post(
            f"{self.base_url}/internal/classifications",
            json=result,
            headers=self._headers(),
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        classification_id = response.json().get("id")
        if classification_id is None:
            raise ValueError("A API não retornou o identificador da classificação.")
        return str(classification_id)

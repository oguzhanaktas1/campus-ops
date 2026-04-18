import json

import httpx

from app.core.config import get_settings
from app.utils.json_extract import extract_json_object


class OllamaClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def generate_json(self, prompt: str) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{self.settings.runtime_base_url}/api/generate",
                json={
                    "model": self.settings.default_model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                },
            )
            response.raise_for_status()
            payload = response.json()

        raw_response = payload.get("response")
        if isinstance(raw_response, dict):
            return raw_response
        if isinstance(raw_response, str):
            try:
                return json.loads(raw_response)
            except json.JSONDecodeError:
                return extract_json_object(raw_response)
        raise ValueError("Unexpected model response format.")

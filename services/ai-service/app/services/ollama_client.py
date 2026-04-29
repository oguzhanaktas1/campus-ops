import json

import httpx

from app.core.config import get_settings
from app.utils.json_extract import extract_json_object


class OllamaClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def generate_json(self, prompt: str) -> dict[str, object]:
        last_error: Exception | None = None
        models = [self.settings.default_model, self.settings.fallback_model]

        for model in models:
            for runtime_base_url in self._runtime_base_urls():
                try:
                    return await self._generate_json_from(runtime_base_url, prompt, model)
                except (httpx.HTTPError, ValueError) as exc:
                    last_error = exc

        if last_error:
            raise last_error
        raise ValueError("No AI runtime URL configured.")

    async def _generate_json_from(self, runtime_base_url: str, prompt: str, model: str | None = None) -> dict[str, object]:
        active_model = model or self.settings.default_model
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{runtime_base_url}/api/generate",
                json={
                    "model": active_model,
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

    def _runtime_base_urls(self) -> list[str]:
        urls = [self.settings.runtime_base_url, *self.settings.runtime_fallback_urls.split(",")]
        cleaned: list[str] = []
        for url in urls:
            normalized = url.strip().rstrip("/")
            if normalized and normalized not in cleaned:
                cleaned.append(normalized)
        return cleaned

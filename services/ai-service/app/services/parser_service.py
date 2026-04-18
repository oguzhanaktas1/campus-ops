import json

import httpx

from app.core.config import get_settings
from app.models.parser import RequestParseRequest, RequestParseResponse
from app.services.ollama_client import OllamaClient
from app.services.prompt_service import PromptService
from app.utils.validation import clamp_confidence


class ParserService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = OllamaClient()

    async def parse_request(self, payload: RequestParseRequest) -> RequestParseResponse:
        fallback = RequestParseResponse(
            requestType="GENERAL_REQUEST",
            title=payload.text[:80],
            summary=payload.text[:240],
            extractedFields={},
            missingFields=[],
            confidence=self.settings.fallback_confidence,
            fallbackUsed=True,
        )
        if not self.settings.ai_enabled:
            return fallback

        prompt = PromptService.render(
            "parser/request.md",
            payload=json.dumps(payload.model_dump(), ensure_ascii=False, indent=2),
        )

        try:
            result = await self.client.generate_json(prompt)
            return RequestParseResponse.model_validate(
                {
                    "requestType": result.get("requestType", "GENERAL_REQUEST"),
                    "title": result.get("title", fallback.title),
                    "summary": result.get("summary", fallback.summary),
                    "extractedFields": result.get("extractedFields", {}),
                    "missingFields": result.get("missingFields", []),
                    "confidence": clamp_confidence(result.get("confidence"), 0.8),
                    "fallbackUsed": False,
                }
            )
        except (httpx.HTTPError, ValueError, KeyError):
            return fallback

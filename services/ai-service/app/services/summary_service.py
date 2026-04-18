import json

import httpx

from app.core.config import get_settings
from app.models.summary import ApprovalSummaryRequest, ApprovalSummaryResponse
from app.services.ollama_client import OllamaClient
from app.services.prompt_service import PromptService
from app.utils.validation import clamp_confidence


class SummaryService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = OllamaClient()

    async def summarize_approval(
        self, payload: ApprovalSummaryRequest
    ) -> ApprovalSummaryResponse:
        fallback = ApprovalSummaryResponse(
            summary=payload.request_title,
            risks=[],
            recommendations=[],
            confidence=self.settings.fallback_confidence,
            fallbackUsed=True,
        )
        if not self.settings.ai_enabled:
            return fallback

        prompt = PromptService.render(
            "summary/approval.md",
            payload=json.dumps(payload.model_dump(), ensure_ascii=False, indent=2),
        )

        try:
            result = await self.client.generate_json(prompt)
            return ApprovalSummaryResponse.model_validate(
                {
                    "summary": result.get("summary", fallback.summary),
                    "risks": result.get("risks", []),
                    "recommendations": result.get("recommendations", []),
                    "confidence": clamp_confidence(result.get("confidence"), 0.82),
                    "fallbackUsed": False,
                }
            )
        except (httpx.HTTPError, ValueError, KeyError):
            return fallback

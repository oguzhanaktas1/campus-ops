import json

import httpx

from app.core.config import get_settings
from app.models.similar import SimilarTicketRequest, SimilarTicketResponse
from app.services.ollama_client import OllamaClient
from app.services.prompt_service import PromptService
from app.utils.validation import clamp_confidence


class SimilarTicketService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = OllamaClient()

    async def find_similar(self, payload: SimilarTicketRequest) -> SimilarTicketResponse:
        fallback = self._build_fallback(payload)
        if not self.settings.ai_enabled or not payload.candidates:
            return fallback

        prompt = PromptService.render(
            "similar/tickets.md",
            payload=json.dumps(payload.model_dump(), ensure_ascii=False, indent=2),
        )

        try:
            result = await self.client.generate_json(prompt)
            return SimilarTicketResponse.model_validate(
                {
                    "summary": result.get("summary", fallback.summary),
                    "similarCount": len(payload.candidates),
                    "highlights": result.get("highlights", fallback.highlights),
                    "confidence": clamp_confidence(result.get("confidence"), 0.75),
                    "fallbackUsed": False,
                }
            )
        except (httpx.HTTPError, ValueError, KeyError):
            return fallback

    def _build_fallback(self, payload: SimilarTicketRequest) -> SimilarTicketResponse:
        count = len(payload.candidates)
        highlights = [c.title[:80] for c in payload.candidates[:3]]
        summary = (
            f"{count} benzer ticket bulundu."
            if count > 0
            else "Benzer ticket bulunamadı."
        )
        return SimilarTicketResponse.model_validate(
            {
                "summary": summary,
                "similarCount": count,
                "highlights": highlights,
                "confidence": self.settings.fallback_confidence,
                "fallbackUsed": True,
            }
        )

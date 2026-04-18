import json

import httpx

from app.core.config import get_settings
from app.models.triage import TicketTriageRequest, TicketTriageResponse
from app.services.ollama_client import OllamaClient
from app.services.prompt_service import PromptService
from app.utils.validation import clamp_confidence


class TriageService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = OllamaClient()

    async def triage_ticket(self, payload: TicketTriageRequest) -> TicketTriageResponse:
        fallback = self._fallback(payload)
        if not self.settings.ai_enabled:
            return fallback

        prompt = PromptService.render(
            "triage/ticket.md",
            payload=json.dumps(payload.model_dump(), ensure_ascii=False, indent=2),
        )

        try:
            result = await self.client.generate_json(prompt)
            return TicketTriageResponse.model_validate(
                {
                    "requestType": result.get("requestType", "IT_TICKET"),
                    "category": result.get("category", fallback.category),
                    "priority": result.get("priority", fallback.priority),
                    "suggestedUnit": result.get("suggestedUnit", fallback.suggested_unit),
                    "summary": result.get("summary", fallback.summary),
                    "missingFields": result.get("missingFields", []),
                    "confidence": clamp_confidence(result.get("confidence"), 0.84),
                    "fallbackUsed": False,
                }
            )
        except (httpx.HTTPError, ValueError, KeyError):
            return fallback

    def _fallback(self, payload: TicketTriageRequest) -> TicketTriageResponse:
        category = "Network" if "network" in payload.description.lower() else "General Support"
        priority = "HIGH" if any(token in payload.description.lower() for token in ["down", "urgent", "critical"]) else "MEDIUM"
        return TicketTriageResponse(
            requestType="IT_TICKET",
            category=category,
            priority=priority,
            suggestedUnit="IT",
            summary=payload.title.strip(),
            missingFields=[],
            confidence=self.settings.fallback_confidence,
            fallbackUsed=True,
        )

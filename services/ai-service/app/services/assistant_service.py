import json

import httpx

from app.core.config import get_settings
from app.models.assistant import AssistantAskRequest, AssistantAskResponse
from app.services.assistant_intent_router import AssistantIntentRouter
from app.services.assistant_tools import AssistantToolLayer
from app.services.ollama_client import OllamaClient
from app.services.prompt_service import PromptService
from app.utils.validation import clamp_confidence


class AssistantService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = OllamaClient()
        self.intent_router = AssistantIntentRouter()
        self.tool_layer = AssistantToolLayer()

    async def answer(self, payload: AssistantAskRequest) -> AssistantAskResponse:
        intent = self.intent_router.route(payload.message)
        tool_result = self.tool_layer.execute(intent.name, payload, intent.entities)
        fallback = self._fallback(payload, intent.name, tool_result)

        if tool_result.handled:
            return AssistantAskResponse(
                answer=tool_result.answer,
                links=tool_result.links,
                cards=tool_result.cards,
                confidence=0.94,
                fallbackUsed=False,
            )

        if not self.settings.ai_enabled:
            return fallback

        prompt = PromptService.render(
            "assistant/portal.md",
            payload=json.dumps(payload.model_dump(), ensure_ascii=False, indent=2),
            intent=intent.name,
            intent_entities=json.dumps(intent.entities, ensure_ascii=False, indent=2),
            tool_context=json.dumps(tool_result.context, ensure_ascii=False, indent=2),
        )

        try:
            result = await self.client.generate_json(prompt)
            links = result.get("links", [])
            safe_links = [
                link
                for link in links
                if isinstance(link, dict)
                and link.get("href") in payload.authorized_routes
            ]
            cards = result.get("cards", [])
            safe_cards = [card for card in cards if isinstance(card, dict)]
            return AssistantAskResponse.model_validate(
                {
                    "answer": result.get("answer", fallback.answer),
                    "links": safe_links,
                    "cards": safe_cards,
                    "confidence": clamp_confidence(result.get("confidence"), 0.85),
                    "fallbackUsed": False,
                }
            )
        except (httpx.HTTPError, ValueError, KeyError):
            return fallback

    def _fallback(
        self,
        payload: AssistantAskRequest,
        intent_name: str,
        tool_result,
    ) -> AssistantAskResponse:
        summary = payload.live_data_context.get("summary", {})
        recent_requests = payload.live_data_context.get("recentRequests", [])
        cards = tool_result.cards if getattr(tool_result, "cards", None) else []

        answer = (
            "Bu soruyu su an netlestiremedim. CampusOps icinde hangi modul, kayit veya islemden soz ettiginizi biraz daha acik yazabilirsiniz."
        )

        metric_intents = {
            "analytics_summary",
            "ticket_queue_summary",
            "my_open_requests_count",
            "my_today_summary",
        }

        if intent_name in metric_intents and isinstance(summary, dict):
            parts: list[str] = []
            for key, label in (
                ("totalUsers", "Toplam kullanici"),
                ("activeUsers", "Aktif kullanici"),
                ("openRequests", "Acik request"),
                ("openTickets", "Acik ticket"),
                ("unreadNotifications", "Okunmamis bildirim"),
            ):
                if key in summary:
                    parts.append(f"{label} {summary[key]}")
            if parts:
                answer = ". ".join(parts) + "."
            elif isinstance(recent_requests, list) and recent_requests:
                first = recent_requests[0]
                if isinstance(first, dict):
                    request_no = first.get("requestNo") or "Kayit"
                    status = first.get("status") or "UNKNOWN"
                    answer = f"En guncel gorunen kayit {request_no}; durumu {status}."
        elif intent_name == "help_navigation":
            answer = (
                "CampusOps icinde ilgili sayfayi bulmaya calistim ama su an net eslestiremedim. Islemi veya modul adini biraz daha spesifik yazabilirsiniz."
            )
        elif intent_name in {"request_summary", "request_status_explanation"}:
            if isinstance(recent_requests, list) and recent_requests:
                first = recent_requests[0]
                if isinstance(first, dict):
                    request_no = first.get("requestNo") or "Kayit"
                    status = first.get("status") or "UNKNOWN"
                    answer = f"Ilgili kaydi dogrudan cozemedim. Gorunen en guncel kayit {request_no}; durumu {status}."

        return AssistantAskResponse(
            answer=answer,
            links=[],
            cards=cards,
            confidence=max(self.settings.fallback_confidence, 0.2),
            fallbackUsed=True,
        )

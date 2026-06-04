import asyncio
import json

import httpx

from app.core.config import get_settings
from app.models.assistant import AssistantAskRequest, AssistantAskResponse
from app.services.assistant_intent_router import AssistantIntentRouter
from app.services.assistant_tools import AssistantToolLayer, detect_language
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

        history_text = self._format_conversation_history(payload)
        detected_lang = detect_language(payload.message, payload.conversation_history)
        lang_directive = (
            "tr — Reply in Turkish (Türkçe yanıt verin)."
            if detected_lang == "tr"
            else "en — Reply in English."
        )
        prompt = PromptService.render(
            "assistant/portal.md",
            payload=json.dumps(payload.model_dump(by_alias=True), ensure_ascii=False, indent=2),
            intent=intent.name,
            intent_entities=json.dumps(intent.entities, ensure_ascii=False, indent=2),
            tool_context=json.dumps(tool_result.context, ensure_ascii=False, indent=2),
            conversation_history=history_text,
            detected_language=lang_directive,
        )

        try:
            result = await asyncio.wait_for(
                self.client.generate_json(prompt),
                timeout=self.settings.assistant_response_timeout_seconds,
            )
            return self._build_response(result, payload, fallback)
        except asyncio.TimeoutError:
            # Default model timed out — retry once with the faster fallback model.
            try:
                result = await asyncio.wait_for(
                    self.client.generate_json_with(prompt, self.settings.fallback_model),
                    timeout=self.settings.assistant_response_timeout_seconds,
                )
                return self._build_response(result, payload, fallback)
            except (asyncio.TimeoutError, httpx.HTTPError, ValueError, KeyError):
                return self._timeout_fallback(payload, fallback)
        except (httpx.HTTPError, ValueError, KeyError):
            return fallback

    def _build_response(
        self,
        result: dict,
        payload: AssistantAskRequest,
        fallback: AssistantAskResponse,
    ) -> AssistantAskResponse:
        links = result.get("links", [])
        safe_links = [
            link
            for link in links
            if isinstance(link, dict) and link.get("href") in payload.authorized_routes
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

    def _timeout_fallback(
        self,
        payload: AssistantAskRequest,
        fallback: AssistantAskResponse,
    ) -> AssistantAskResponse:
        """Return a localized 'I can't answer right now' response when the LLM
        exceeds the assistant response timeout budget."""
        lang = detect_language(payload.message, payload.conversation_history)
        if lang == "tr":
            answer = (
                "Üzgünüm, bu soruya şu anda yanıt veremiyorum. "
                f"Yapay zeka {int(self.settings.assistant_response_timeout_seconds)} saniye içinde "
                "cevap üretemedi — lütfen biraz sonra tekrar deneyin veya sorunuzu kısaltıp tekrar sorun."
            )
        else:
            answer = (
                "Sorry, I can't answer this question right now. "
                f"The AI did not respond within {int(self.settings.assistant_response_timeout_seconds)} seconds — "
                "please try again in a moment or shorten the question and retry."
            )
        return AssistantAskResponse(
            answer=answer,
            links=[],
            cards=fallback.cards,
            confidence=max(self.settings.fallback_confidence, 0.2),
            fallbackUsed=True,
        )

    def _format_conversation_history(self, payload: AssistantAskRequest) -> str:
        history = payload.conversation_history
        if not history:
            return "No conversation history."
        lines: list[str] = []
        for msg in history[-6:]:
            role_label = "User" if msg.role == "user" else "Assistant"
            lines.append(f"{role_label}: {msg.content}")
        return "\n".join(lines)

    def _fallback(
        self,
        payload: AssistantAskRequest,
        intent_name: str,
        tool_result,
    ) -> AssistantAskResponse:
        lang = detect_language(payload.message, payload.conversation_history)
        summary = payload.live_data_context.get("summary", {})
        recent_requests = payload.live_data_context.get("recentRequests", [])
        cards = tool_result.cards if getattr(tool_result, "cards", None) else []

        if lang == "tr":
            answer = "Sorunuzu tam olarak anlayamadım. CampusOps'ta hangi modül, kayıt veya işlemden bahsettiğinizi biraz daha açıklar mısınız?"
        else:
            answer = "I couldn't fully understand your question. Could you be more specific about which module, record, or action you're referring to in CampusOps?"

        metric_intents = {
            "analytics_summary",
            "ticket_queue_summary",
            "my_open_requests_count",
            "my_today_summary",
            "system_overview",
        }

        labels_en = {
            "totalUsers": "Total users",
            "activeUsers": "Active users",
            "openRequests": "Open requests",
            "openTickets": "Open tickets",
            "unreadNotifications": "Unread notifications",
        }
        labels_tr = {
            "totalUsers": "Toplam kullanıcı",
            "activeUsers": "Aktif kullanıcı",
            "openRequests": "Açık talep",
            "openTickets": "Açık ticket",
            "unreadNotifications": "Okunmamış bildirim",
        }
        active_labels = labels_tr if lang == "tr" else labels_en

        if intent_name in metric_intents and isinstance(summary, dict):
            parts: list[str] = []
            for key in active_labels:
                if key in summary:
                    parts.append(f"{active_labels[key]}: {summary[key]}")
            if parts:
                answer = ". ".join(parts) + "."
            elif isinstance(recent_requests, list) and recent_requests:
                first = recent_requests[0]
                if isinstance(first, dict):
                    request_no = first.get("requestNo") or "Record"
                    status = first.get("status") or "UNKNOWN"
                    if lang == "tr":
                        answer = f"Görünür en son kayıt: {request_no}, durum: {status}."
                    else:
                        answer = f"Most recent visible record is {request_no} with status {status}."

        elif intent_name == "help_navigation":
            if lang == "tr":
                answer = "Aradığınızla tam eşleşen bir sayfa bulamadım. Hangi işlemi veya modülü aradığınızı biraz daha açıklayabilir misiniz?"
            else:
                answer = "I couldn't find an exact page match. Could you be more specific about which action or module you're looking for?"

        elif intent_name in {"request_summary", "request_status_explanation"}:
            if isinstance(recent_requests, list) and recent_requests:
                first = recent_requests[0]
                if isinstance(first, dict):
                    request_no = first.get("requestNo") or "Record"
                    status = first.get("status") or "UNKNOWN"
                    if lang == "tr":
                        answer = f"Belirttiğiniz talep bulunamadı. Görünür en son kayıt: {request_no} — durum: {status}."
                    else:
                        answer = f"Couldn't find that specific request. Most recent visible record: {request_no} — status: {status}."

        return AssistantAskResponse(
            answer=answer,
            links=[],
            cards=cards,
            confidence=max(self.settings.fallback_confidence, 0.2),
            fallbackUsed=True,
        )

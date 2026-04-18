import json

import httpx

from app.core.config import get_settings
from app.models.assistant import AssistantAskRequest, AssistantAskResponse
from app.services.ollama_client import OllamaClient
from app.services.prompt_service import PromptService
from app.utils.validation import clamp_confidence


ROUTE_HINTS: dict[str, dict[str, str]] = {
    "student": {
        "internship": "/student/internships/new",
        "reservation": "/student/reservations/new",
        "appointment": "/student/appointments/new",
        "document": "/student/documents/new",
        "access": "/student/access-requests/new",
        "event": "/student/events/new",
    },
    "faculty": {
        "approval": "/faculty/approvals",
        "internship": "/faculty/internships",
        "appointment": "/faculty/appointments",
        "request": "/faculty/requests",
    },
    "staff": {
        "ticket": "/staff/tickets",
        "document": "/staff/documents",
        "reservation": "/staff/reservations",
        "approval": "/staff/approvals",
        "access": "/staff/access-requests",
        "procurement": "/staff/procurement",
    },
    "admin": {
        "user": "/admin/users",
        "users": "/admin/users",
        "analytics": "/admin/analytics",
        "webhook": "/admin/webhook-logs",
        "workflow": "/admin/workflows",
        "request": "/admin/requests",
        "role": "/admin/roles",
        "permission": "/admin/permissions",
        "sla": "/admin/sla",
    },
    "organizer": {
        "event": "/organizer/events",
        "reservation": "/organizer/reservations",
        "equipment": "/organizer/equipment",
        "access": "/organizer/access-requests",
        "procurement": "/organizer/procurement",
    },
}

GENERIC_KEYWORD_MAP: dict[str, list[str]] = {
    "users": ["user", "users", "kullanıcı", "kullanıcılar", "edit user", "manage users"],
    "roles": ["role", "roles", "rol", "roller"],
    "permissions": ["permission", "permissions", "yetki", "izinler"],
    "analytics": ["analytics", "analitik", "istatistik", "report", "reports", "rapor"],
    "workflows": ["workflow", "workflows", "iş akışı", "onay akışı"],
    "requests": ["request", "requests", "talep", "talepler"],
    "documents": ["document", "documents", "belge"],
    "tickets": ["ticket", "tickets", "it", "support"],
    "reservations": ["reservation", "reservations", "rezervasyon"],
    "appointments": ["appointment", "appointments", "randevu", "meeting"],
    "events": ["event", "events", "etkinlik"],
    "access": ["access", "permission request", "erişim", "izin"],
    "procurement": ["procurement", "purchase", "satın alma"],
}

GREETING_KEYWORDS = {
    "merhaba",
    "selam",
    "selamlar",
    "hello",
    "hi",
    "hey",
    "günaydın",
    "iyi akşamlar",
    "iyi günler",
}

CAPABILITY_KEYWORDS = {
    "ne yapabilirsin",
    "yardım",
    "yardımcı ol",
    "neler yapabilirsin",
    "hangi konularda",
    "help",
    "what can you do",
}


class AssistantService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = OllamaClient()

    async def answer(self, payload: AssistantAskRequest) -> AssistantAskResponse:
        fallback = self._fallback(payload)
        if not self.settings.ai_enabled:
            return fallback

        prompt = PromptService.render(
            "assistant/portal.md",
            payload=json.dumps(payload.model_dump(), ensure_ascii=False, indent=2),
        )

        try:
            result = await self.client.generate_json(prompt)
            links = result.get("links", fallback.links)
            safe_links = [
                link
                for link in links
                if isinstance(link, dict)
                and link.get("href") in payload.authorized_routes
            ]
            return AssistantAskResponse.model_validate(
                {
                    "answer": result.get("answer", fallback.answer),
                    "links": safe_links,
                    "confidence": clamp_confidence(result.get("confidence"), 0.85),
                    "fallbackUsed": False,
                }
            )
        except (httpx.HTTPError, ValueError, KeyError):
            return fallback

    def _fallback(self, payload: AssistantAskRequest) -> AssistantAskResponse:
        portal_key = payload.portal.lower()
        message = payload.message.lower()
        if self._is_greeting(message):
            return AssistantAskResponse(
                answer=(
                    f"Merhaba. {payload.portal_context or 'CampusOps içinde'} "
                    "rolünüze uygun sayfalar, işlemler ve iş akışları konusunda yardımcı olabilirim."
                ),
                links=[],
                confidence=self.settings.fallback_confidence,
                fallbackUsed=True,
            )

        if self._is_capability_question(message):
            return AssistantAskResponse(
                answer=(
                    f"{payload.portal_context or 'CampusOps portalınız'} "
                    "kapsamındaki işlemler, uygun sayfalar, onay akışları ve size açık modüller hakkında yardımcı olabilirim."
                ),
                links=[],
                confidence=self.settings.fallback_confidence,
                fallbackUsed=True,
            )

        route_candidates = ROUTE_HINTS.get(portal_key, {})
        matched_route = self._match_route_detail(payload, message)
        matched_href = ""
        matched_label = "Open Page"

        if matched_route:
            matched_href = str(matched_route.get("href", ""))
            matched_label = str(matched_route.get("label", "Open Page"))

        for keyword, href in route_candidates.items():
            if matched_href:
                break
            if keyword in message and href in payload.authorized_routes:
                matched_href = href
                break

        links = []
        answer = (
            "Bu konuda yalnızca CampusOps içindeki, rolünüze açık sayfa ve işlevler hakkında yardımcı olabilirim."
        )
        if matched_href:
            links = [{"label": matched_label, "href": matched_href}]
            answer = f"İlgili işlem için {matched_label} sayfasını açabilirsiniz."

        return AssistantAskResponse(
            answer=answer,
            links=links,
            confidence=self.settings.fallback_confidence,
            fallbackUsed=True,
        )

    def _match_route_detail(
        self, payload: AssistantAskRequest, message: str
    ) -> dict[str, object] | None:
        best_route: dict[str, object] | None = None
        best_score = 0

        for route in payload.authorized_route_details:
            href = route.get("href")
            if not isinstance(href, str) or href not in payload.authorized_routes:
                continue

            score = 0
            label = str(route.get("label", "")).lower()
            description = str(route.get("description", "")).lower()

            for text in (label, description):
                if not text:
                    continue
                if text in message:
                    score += 4
                for token in text.replace("/", " ").replace("-", " ").split():
                    if len(token) > 2 and token in message:
                        score += 2

            keywords = route.get("keywords", [])
            if isinstance(keywords, list):
                for keyword in keywords:
                    if isinstance(keyword, str) and keyword.lower() in message:
                        score += 5

            for keyword_group, aliases in GENERIC_KEYWORD_MAP.items():
                if any(alias in message for alias in aliases):
                    if keyword_group in label or keyword_group in description:
                        score += 4

            if score > best_score:
                best_score = score
                best_route = route

        if best_score <= 0:
            return None

        return best_route

    def _is_greeting(self, message: str) -> bool:
        normalized = message.strip().lower()
        return normalized in GREETING_KEYWORDS or any(
            normalized.startswith(keyword) for keyword in GREETING_KEYWORDS
        )

    def _is_capability_question(self, message: str) -> bool:
        normalized = message.strip().lower()
        return any(keyword in normalized for keyword in CAPABILITY_KEYWORDS)

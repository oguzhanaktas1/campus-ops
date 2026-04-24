from dataclasses import dataclass, field

from app.models.assistant import AssistantAskRequest, AssistantCard, AssistantLink


FINAL_STATUSES = {"COMPLETED", "APPROVED", "REJECTED", "CANCELLED", "CLOSED", "EXPIRED"}


@dataclass
class ToolResult:
    handled: bool = False
    answer: str = ""
    links: list[AssistantLink] = field(default_factory=list)
    cards: list[AssistantCard] = field(default_factory=list)
    context: dict[str, object] = field(default_factory=dict)


class AssistantToolLayer:
    def execute(self, intent: str, payload: AssistantAskRequest, entities: dict[str, str]) -> ToolResult:
        handlers = {
            "greeting": self._greeting,
            "help_navigation": self._help_navigation,
            "my_open_requests_count": self._my_open_requests_count,
            "my_today_appointments": self._my_today_appointments,
            "my_today_events": self._my_today_events,
            "my_today_summary": self._my_today_summary,
            "request_summary": self._request_summary,
            "request_status_explanation": self._request_status_explanation,
            "ticket_queue_summary": self._ticket_queue_summary,
            "analytics_summary": self._analytics_summary,
        }
        handler = handlers.get(intent)
        if not handler:
            return ToolResult(handled=False, context=self._build_general_context(payload))
        return handler(payload, entities)

    def _greeting(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        return ToolResult(
            handled=True,
            answer="Merhaba. CampusOps içinde yardımcı olabilirim.",
        )

    def _help_navigation(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        route = payload.authorized_route_details[0] if payload.authorized_route_details else None
        if route and isinstance(route.get("href"), str):
            label = str(route.get("label", "Open Page"))
            href = str(route["href"])
            return ToolResult(
                handled=True,
                answer=f"Bu işlem için en uygun başlangıç noktası {label} sayfası görünüyor.",
                links=[AssistantLink(label=label, href=href)],
            )
        return ToolResult(handled=False, context=self._build_general_context(payload))

    def _my_open_requests_count(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        open_items = [item for item in payload.open_requests if str(item.get("status", "")).upper() not in FINAL_STATUSES]
        count = len(open_items)
        return ToolResult(
            handled=True,
            answer=f"Açık işlem sayınız {count}.",
            cards=[AssistantCard(type="count", label="Open Requests", value=count)],
            context={"openRequests": open_items[:5]},
        )

    def _my_today_appointments(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        appointments = self._as_list(payload.live_data_context.get("upcomingAppointments"))[:5]
        count = len(appointments)
        if count == 0:
            answer = "Bugün için görünen randevunuz yok."
        else:
            answer = f"Bugün veya yakında görünen {count} randevunuz var."
        return ToolResult(
            handled=True,
            answer=answer,
            cards=[AssistantCard(type="count", label="Appointments", value=count)],
            context={"appointments": appointments},
        )

    def _my_today_events(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        events = self._as_list(payload.live_data_context.get("upcomingEvents"))[:5]
        count = len(events)
        if count == 0:
            answer = "Bugün için görünen etkinliğiniz yok."
        else:
            answer = f"Bugün veya yakında görünen {count} etkinliğiniz var."
        return ToolResult(
            handled=True,
            answer=answer,
            cards=[AssistantCard(type="count", label="Events", value=count)],
            context={"events": events},
        )

    def _my_today_summary(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        if not isinstance(summary, dict):
            summary = {}
        cards: list[AssistantCard] = []
        for label, key in (
            ("Open Requests", "openRequests"),
            ("Unread Notifications", "unreadNotifications"),
            ("Upcoming Events", "upcomingEvents"),
        ):
            if key in summary:
                cards.append(AssistantCard(type="count", label=label, value=self._to_number(summary[key])))
        answer_parts: list[str] = []
        if "openRequests" in summary:
            answer_parts.append(f"Açık işlem sayınız {self._to_number(summary['openRequests'])}.")
        if "unreadNotifications" in summary:
            answer_parts.append(
                f"Okunmamış bildirim sayınız {self._to_number(summary['unreadNotifications'])}."
            )
        if "upcomingEvents" in summary:
            answer_parts.append(f"Yaklaşan etkinlik sayınız {self._to_number(summary['upcomingEvents'])}.")
        return ToolResult(
            handled=bool(answer_parts),
            answer=" ".join(answer_parts) if answer_parts else "",
            cards=cards,
            context={
                "summary": summary,
                "recentRequests": self._as_list(payload.live_data_context.get("recentRequests"))[:5],
                "cards": [card.model_dump() for card in cards],
            },
        )

    def _request_summary(self, payload: AssistantAskRequest, entities: dict[str, str]) -> ToolResult:
        target = entities.get("requestNo")
        recent_requests = self._as_list(payload.live_data_context.get("recentRequests"))
        for item in recent_requests:
            if str(item.get("requestNo", "")).lower() == str(target).lower():
                return ToolResult(
                    handled=True,
                    answer=f"{item.get('requestNo')} numaralı kayıt şu anda {item.get('status')} durumunda.",
                    cards=[
                        AssistantCard(
                            type="status",
                            label=str(item.get("requestNo", "Request")),
                            value=str(item.get("status", "UNKNOWN")),
                            description=str(item.get("title", "")) or None,
                        )
                    ],
                    context={"request": item},
                )
        return ToolResult(handled=False, context={"requestNo": target})

    def _request_status_explanation(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        return ToolResult(
            handled=False,
            context={
                "openRequests": payload.open_requests[:5],
                "recentRequests": self._as_list(payload.live_data_context.get("recentRequests"))[:5],
            },
        )

    def _ticket_queue_summary(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        recent_tickets = self._as_list(payload.live_data_context.get("recentTickets"))[:5]
        if isinstance(summary, dict) and "openTickets" in summary:
            count = self._to_number(summary["openTickets"])
            return ToolResult(
                handled=True,
                answer=f"Görünen açık ticket sayısı {count}.",
                cards=[AssistantCard(type="count", label="Open Tickets", value=count)],
                context={"recentTickets": recent_tickets},
            )
        return ToolResult(handled=False, context={"recentTickets": recent_tickets, "summary": summary})

    def _analytics_summary(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        cards: list[AssistantCard] = []
        if isinstance(summary, dict):
            for key in ("totalUsers", "activeUsers", "totalRequests", "openRequests"):
                if key in summary:
                    cards.append(AssistantCard(type="count", label=key, value=self._to_number(summary[key])))
        answer_parts: list[str] = []
        if isinstance(summary, dict):
            if "totalUsers" in summary:
                answer_parts.append(f"Toplam kullanıcı {self._to_number(summary['totalUsers'])}.")
            if "activeUsers" in summary:
                answer_parts.append(f"Aktif kullanıcı {self._to_number(summary['activeUsers'])}.")
            if "openRequests" in summary:
                answer_parts.append(f"Açık request {self._to_number(summary['openRequests'])}.")
        return ToolResult(
            handled=bool(answer_parts),
            answer=" ".join(answer_parts) if answer_parts else "",
            cards=cards,
            context={"summary": summary, "cards": [card.model_dump() for card in cards]},
        )

    def _build_general_context(self, payload: AssistantAskRequest) -> dict[str, object]:
        return {
            "summary": payload.live_data_context.get("summary", {}),
            "openRequests": payload.open_requests[:5],
            "recentRequests": self._as_list(payload.live_data_context.get("recentRequests"))[:5],
        }

    def _as_list(self, value: object) -> list[dict[str, object]]:
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, dict)]

    def _to_number(self, value: object) -> int | float:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return value
        return 0

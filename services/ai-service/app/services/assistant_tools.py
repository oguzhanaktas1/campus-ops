from collections import Counter
from dataclasses import dataclass, field

from app.models.assistant import AssistantAskRequest, AssistantCard, AssistantLink


# ── Status / type constants ───────────────────────────────────────────────────

FINAL_STATUSES = {"COMPLETED", "APPROVED", "REJECTED", "CANCELLED", "CLOSED", "EXPIRED"}
PENDING_STATUSES = {"SUBMITTED", "IN_REVIEW", "WAITING_APPROVAL", "PENDING_APPROVAL"}
OPEN_TICKET_STATUSES = {"OPEN", "TRIAGED", "IN_PROGRESS", "WAITING_USER", "REOPENED"}
CLOSED_TICKET_STATUSES = {"RESOLVED", "CLOSED"}

REQUEST_TYPE_LABELS: dict[str, str] = {
    "INTERNSHIP": "Internship",
    "DOCUMENT": "Document",
    "RESERVATION": "Reservation",
    "APPOINTMENT": "Appointment",
    "ACCESS_REQUEST": "Access Request",
    "IT_TICKET": "IT Ticket",
    "EVENT": "Event",
    "PROCUREMENT": "Procurement",
    "EQUIPMENT": "Equipment",
}

# ── Role-based intent permission matrix ───────────────────────────────────────
#
# Maps intent name → set of roles allowed to access it.
# Intents NOT listed here are accessible by ALL roles (own data only).
# When a role is denied, the tool returns a clear "not available" message
# instead of exposing cross-role data.

INTENT_ROLE_ALLOW: dict[str, set[str]] = {
    # Admin-only
    "system_overview":          {"ADMIN"},
    "recent_users":             {"ADMIN"},
    "audit_logs":               {"ADMIN"},
    "webhook_status":           {"ADMIN"},
    "workflow_info":            {"ADMIN"},
    "integration_list":         {"ADMIN"},
    "sla_policy_info":          {"ADMIN"},
    "report_list":              {"ADMIN"},
    # Admin + Staff
    "analytics_summary":        {"ADMIN", "STAFF"},
    "ticket_queue_summary":     {"ADMIN", "STAFF"},
    "sla_status":               {"ADMIN", "STAFF"},
    "it_resolution_stats":      {"ADMIN", "STAFF"},
    "bulk_request_summary":     {"ADMIN", "STAFF", "FACULTY"},
    # Admin + Staff + Faculty
    "pending_approvals":        {"ADMIN", "STAFF", "FACULTY"},
    "approval_history":         {"ADMIN", "STAFF", "FACULTY"},
    "overdue_items":            {"ADMIN", "STAFF", "FACULTY"},
    "assignment_queue":         {"ADMIN", "STAFF", "FACULTY"},
    "my_workload":              {"ADMIN", "STAFF", "FACULTY"},
    "faculty_internship_queue": {"ADMIN", "FACULTY"},
    # Admin + Staff + Organizer
    "procurement_status":       {"ADMIN", "STAFF", "ORGANIZER"},
    "equipment_status":         {"ADMIN", "STAFF", "ORGANIZER"},
    # Admin + Organizer
    "event_plan_status":        {"ADMIN", "ORGANIZER"},
    "my_club_info":             {"ADMIN", "ORGANIZER"},
    # Admin + Faculty + Student (own data)
    "internship_status":        {"ADMIN", "FACULTY", "STUDENT"},
}


@dataclass
class ToolResult:
    handled: bool = False
    answer: str = ""
    links: list[AssistantLink] = field(default_factory=list)
    cards: list[AssistantCard] = field(default_factory=list)
    context: dict[str, object] = field(default_factory=dict)


def _denied(intent: str) -> ToolResult:
    return ToolResult(
        handled=True,
        answer=f"This information is not available for your current role. ({intent})",
    )


class AssistantToolLayer:

    def execute(self, intent: str, payload: AssistantAskRequest, entities: dict[str, str]) -> ToolResult:
        role = payload.main_role.upper()

        # Role permission gate — checked before dispatching any handler
        allowed_roles = INTENT_ROLE_ALLOW.get(intent)
        if allowed_roles is not None and role not in allowed_roles:
            return _denied(intent)

        handlers = {
            # ── General / onboarding
            "capabilities":             self._capabilities,
            "greeting":                 self._greeting,
            "portal_guide":             self._portal_guide,
            "new_user_guide":           self._new_user_guide,
            "switch_portal":            self._switch_portal,
            "settings_help":            self._settings_help,
            "request_status_explained": self._request_status_explained,
            "request_type_explained":   self._request_type_explained,
            # ── Navigation
            "help_navigation":          self._help_navigation,
            "create_request_guide":     self._create_request_guide,
            "contact_it":               self._contact_it,
            "allowed_request_types":    self._allowed_request_types,
            # ── Personal identity
            "my_profile":               self._my_profile,
            # ── My requests (personal scope)
            "my_open_requests_count":   self._my_open_requests_count,
            "completed_requests":       self._completed_requests,
            "draft_requests":           self._draft_requests,
            "bulk_request_summary":     self._bulk_request_summary,
            "request_count_by_type":    self._request_count_by_type,
            "upcoming_deadlines":       self._upcoming_deadlines,
            "recent_activity":          self._recent_activity,
            "request_summary":          self._request_summary,
            "request_status_explanation": self._request_status_explanation,
            # ── Request type specific
            "internship_status":        self._internship_status,
            "document_status":          self._document_status,
            "access_request_status":    self._access_request_status,
            "equipment_status":         self._equipment_status,
            # ── Approval / assignment (FACULTY / STAFF / ADMIN)
            "pending_approvals":        self._pending_approvals,
            "approval_history":         self._approval_history,
            "overdue_items":            self._overdue_items,
            "assignment_queue":         self._assignment_queue,
            "my_workload":              self._my_workload,
            "faculty_internship_queue": self._faculty_internship_queue,
            # ── Tickets (STAFF / ADMIN)
            "my_tickets":               self._my_tickets,
            "ticket_queue_summary":     self._ticket_queue_summary,
            "it_resolution_stats":      self._it_resolution_stats,
            "contact_it":               self._contact_it,
            # ── SLA
            "sla_status":               self._sla_status,
            "sla_policy_info":          self._sla_policy_info,
            # ── Reservations / resources
            "my_reservations":          self._my_reservations,
            "resource_info":            self._resource_info,
            # ── Notifications
            "my_notifications":         self._my_notifications,
            # ── Schedule
            "my_today_appointments":    self._my_today_appointments,
            "my_today_events":          self._my_today_events,
            "my_events":                self._my_today_events,
            "my_today_summary":         self._my_today_summary,
            # ── Organizer
            "event_plan_status":        self._event_plan_status,
            "my_club_info":             self._my_club_info,
            "procurement_status":       self._procurement_status,
            # ── Admin: analytics / reports
            "analytics_summary":        self._analytics_summary,
            "recent_users":             self._recent_users,
            "workflow_info":            self._workflow_info,
            "integration_list":         self._integration_list,
            "sla_policy_info":          self._sla_policy_info,
            "report_list":              self._report_list,
            "audit_logs":               self._audit_logs,
            "webhook_status":           self._webhook_status,
            "system_overview":          self._system_overview,
        }

        handler = handlers.get(intent)
        if not handler:
            return ToolResult(handled=False, context=self._build_general_context(payload))
        return handler(payload, entities)

    # ══════════════════════════════════════════════════════════════════════════
    # General / onboarding handlers
    # ══════════════════════════════════════════════════════════════════════════

    def _capabilities(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        role = payload.main_role.upper()
        base = [
            "Check your open requests and their statuses",
            "Look up a specific request by its number (e.g. REQ-001)",
            "Show upcoming appointments, reservations, and events",
            "Navigate you to the right page for any action",
            "Explain what each request status means",
            "Show your unread notification count",
            "Tell you what request types you can create",
        ]
        role_extras: dict[str, list[str]] = {
            "STUDENT": [
                "Track internship, document, and access requests",
                "Show your daily schedule (appointments + events + reservations)",
                "Guide you through creating any new request",
            ],
            "FACULTY": [
                "Show pending approvals waiting for your decision",
                "List requests assigned to you",
                "Show your appointment schedule",
                "Display your student internship review queue",
                "Summarize your workload",
            ],
            "STAFF": [
                "Show your IT ticket queue and resolution stats",
                "Summarize open tickets and procurement items",
                "Show SLA breach status",
                "List overdue requests in your scope",
            ],
            "ADMIN": [
                "Full system overview — users, requests, workflows, resources",
                "Show recent audit logs and webhook delivery status",
                "Summarize analytics and platform KPIs",
                "List integrations and SLA policies",
                "Show workflow definitions",
            ],
            "ORGANIZER": [
                "Show event plans and upcoming published events",
                "Track procurement and equipment requests",
                "Show club info",
            ],
        }
        extras = role_extras.get(role, [])
        bullet = "\n".join(f"- {item}" for item in base + extras)
        return ToolResult(
            handled=True,
            answer=f"Here's what I can help you with as a **{role}**:\n{bullet}\n\nJust ask naturally — I'll figure out what you need.",
        )

    def _greeting(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        role = payload.main_role.upper()
        labels = {"ADMIN": "admin", "STUDENT": "student", "FACULTY": "faculty member", "STAFF": "staff member", "ORGANIZER": "organizer"}
        label = labels.get(role, role.lower())
        return ToolResult(
            handled=True,
            answer=f"Hi! I'm your CampusOps {label} assistant. Ask me about your requests, schedule, approvals, or anything on the platform.",
        )

    def _portal_guide(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        role = payload.main_role.upper()
        guide: dict[str, str] = {
            "STUDENT": "Student portal lets you submit and track internships, document requests, reservations, appointments, access requests, and event registrations.",
            "FACULTY": "Faculty portal gives you approval queues, internship reviews, appointment management, and faculty-visible request tracking.",
            "STAFF": "Staff portal covers IT tickets, approval queues, procurement, document workflows, reservations, and operational reporting.",
            "ADMIN": "Admin portal gives you full platform control — users, roles, workflows, request types, analytics, integrations, audit logs, SLA policies, and monitoring.",
            "ORGANIZER": "Organizer portal covers event plans, published events, reservations, equipment, and procurement for your club or organization.",
        }
        description = guide.get(role, "This portal provides access to CampusOps features for your role.")
        links = [AssistantLink(label=str(r.get("label", "")), href=str(r["href"])) for r in payload.authorized_route_details[:5] if isinstance(r.get("href"), str)]
        return ToolResult(handled=True, answer=description, links=links)

    def _new_user_guide(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        dashboard_routes = [r for r in payload.authorized_route_details if "dashboard" in str(r.get("href", "")).lower()]
        links = [AssistantLink(label=str(r.get("label", "Dashboard")), href=str(r["href"])) for r in dashboard_routes[:1] if isinstance(r.get("href"), str)]
        return ToolResult(
            handled=True,
            answer="Welcome to CampusOps! Start from your dashboard to see an overview of your activity. From there you can submit requests, check statuses, and manage your tasks.",
            links=links,
        )

    def _switch_portal(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        return ToolResult(
            handled=True,
            answer="To switch portals, use the portal selector in the top navigation bar. You can only access portals that match your assigned roles.",
        )

    def _settings_help(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        return ToolResult(
            handled=True,
            answer="Account and notification settings can usually be found in the top-right profile menu or the Settings page of your portal.",
        )

    def _request_status_explained(self, _payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        return ToolResult(
            handled=True,
            answer=(
                "Here's what each request status means:\n"
                "- **DRAFT** — saved but not yet submitted\n"
                "- **SUBMITTED** — sent for review, awaiting assignment\n"
                "- **IN_REVIEW** — being evaluated by a reviewer\n"
                "- **WAITING_APPROVAL** — decision pending from an approver\n"
                "- **APPROVED** — request accepted\n"
                "- **REJECTED** — request denied\n"
                "- **REVISION_REQUESTED** — reviewer asked for changes\n"
                "- **COMPLETED** — fully resolved and closed\n"
                "- **CANCELLED** — withdrawn or cancelled\n"
                "- **CLOSED** — archived and no longer active"
            ),
        )

    def _request_type_explained(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        types = payload.allowed_request_types or list(REQUEST_TYPE_LABELS.keys())
        lines = [f"- **{REQUEST_TYPE_LABELS.get(t, t)}** ({t})" for t in types]
        return ToolResult(
            handled=True,
            answer="Request types available in your portal:\n" + "\n".join(lines),
        )

    # ══════════════════════════════════════════════════════════════════════════
    # Navigation handlers
    # ══════════════════════════════════════════════════════════════════════════

    def _help_navigation(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        message_lower = payload.message.lower()
        scored: list[tuple[int, dict[str, object]]] = []
        for route in payload.authorized_route_details:
            keywords = route.get("keywords", [])
            if isinstance(keywords, list):
                score = sum(1 for kw in keywords if str(kw).lower() in message_lower)
                if score > 0:
                    scored.append((score, route))
        scored.sort(key=lambda x: x[0], reverse=True)
        best = [r for _, r in scored[:3]] or (payload.authorized_route_details[:1] if payload.authorized_route_details else [])
        if best:
            route = best[0]
            label = str(route.get("label", "Page"))
            desc = str(route.get("description", ""))
            links = [AssistantLink(label=str(r.get("label", "")), href=str(r["href"])) for r in best if isinstance(r.get("href"), str)]
            return ToolResult(handled=True, answer=f"You can go to **{label}** for this. {desc}", links=links)
        return ToolResult(handled=False, context=self._build_general_context(payload))

    def _create_request_guide(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        new_routes = [r for r in payload.authorized_route_details if "/new" in str(r.get("href", ""))]
        if not new_routes:
            return ToolResult(handled=True, answer="No request creation pages are available for your current role and portal.")
        links = [AssistantLink(label=str(r.get("label", "")), href=str(r["href"])) for r in new_routes[:5] if isinstance(r.get("href"), str)]
        names = ", ".join(str(r.get("label", "")) for r in new_routes[:5])
        return ToolResult(handled=True, answer=f"You can create: {names}. Click a link below to start.", links=links)

    def _contact_it(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        ticket_routes = [r for r in payload.authorized_route_details if "ticket" in str(r.get("href", "")).lower()]
        links = [AssistantLink(label=str(r.get("label", "")), href=str(r["href"])) for r in ticket_routes[:2] if isinstance(r.get("href"), str)]
        return ToolResult(
            handled=True,
            answer="To open an IT support ticket, navigate to the IT Tickets section and click New Ticket. Describe the issue, affected system, and urgency.",
            links=links,
        )

    def _allowed_request_types(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        types = payload.allowed_request_types
        if not types:
            return ToolResult(handled=True, answer="No request types configured for your portal and role.")
        labels = [REQUEST_TYPE_LABELS.get(t, t) for t in types]
        return ToolResult(
            handled=True,
            answer=f"Request types available to you: **{', '.join(labels)}**.",
            cards=[AssistantCard(type="count", label="Available Types", value=len(types))],
        )

    # ══════════════════════════════════════════════════════════════════════════
    # Personal identity
    # ══════════════════════════════════════════════════════════════════════════

    def _my_profile(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        scope = payload.visibility_scope
        role = payload.main_role.upper()
        sub_roles = payload.sub_roles
        faculty = scope.get("faculty") or {}
        department = scope.get("department") or {}
        unit = scope.get("unit") or {}
        parts = [f"You are logged in as **{role}**"]
        if sub_roles:
            parts.append(f"sub-roles: {', '.join(sub_roles)}")
        if isinstance(faculty, dict) and faculty.get("name"):
            parts.append(f"Faculty: **{faculty['name']}**")
        if isinstance(department, dict) and department.get("name"):
            parts.append(f"Department: **{department['name']}**")
        if isinstance(unit, dict) and unit.get("name"):
            parts.append(f"Unit: **{unit['name']}**")
        return ToolResult(handled=True, answer=". ".join(parts) + ".")

    # ══════════════════════════════════════════════════════════════════════════
    # My requests — personal scope
    # ══════════════════════════════════════════════════════════════════════════

    def _my_open_requests_count(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        open_items = [r for r in payload.open_requests if str(r.get("status", "")).upper() not in FINAL_STATUSES]
        count = len(open_items)
        summary = payload.live_data_context.get("summary", {})
        total = int(self._to_number(summary.get("totalRequests", count))) if isinstance(summary, dict) else count
        cards = [AssistantCard(type="count", label="Open Requests", value=count)]
        if total and total != count:
            cards.append(AssistantCard(type="count", label="Total Requests", value=total))
        return ToolResult(handled=True, answer=f"You have **{count}** open request(s).", cards=cards, context={"openRequests": open_items[:5]})

    def _completed_requests(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests"))
        done = [r for r in recent if str(r.get("status", "")).upper() in {"COMPLETED", "APPROVED", "CLOSED"}]
        if not done:
            return ToolResult(handled=True, answer="No completed or approved requests found in your recent history.")
        return ToolResult(
            handled=True,
            answer=f"**{len(done)}** completed/approved request(s) found in your recent records.",
            cards=[AssistantCard(type="count", label="Completed", value=len(done))],
            context={"completedRequests": done[:5]},
        )

    def _draft_requests(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests"))
        drafts = [r for r in recent if str(r.get("status", "")).upper() == "DRAFT"]
        if not drafts:
            return ToolResult(handled=True, answer="No draft requests found. All your requests have been submitted.")
        return ToolResult(
            handled=True,
            answer=f"You have **{len(drafts)}** draft request(s) not yet submitted.",
            cards=[AssistantCard(type="count", label="Drafts", value=len(drafts))],
            context={"drafts": drafts[:5]},
        )

    def _bulk_request_summary(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests")) + payload.open_requests
        counter: Counter[str] = Counter(str(r.get("status", "UNKNOWN")).upper() for r in recent)
        if not counter:
            return ToolResult(handled=True, answer="No request data available to summarize.")
        cards = [AssistantCard(type="count", label=status, value=count) for status, count in counter.most_common(6)]
        lines = [f"- {status}: **{count}**" for status, count in counter.most_common(6)]
        return ToolResult(
            handled=True,
            answer="Request breakdown by status:\n" + "\n".join(lines),
            cards=cards,
        )

    def _request_count_by_type(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests")) + payload.open_requests
        counter: Counter[str] = Counter(
            REQUEST_TYPE_LABELS.get(str(r.get("requestType", "") or r.get("type", "")).upper(), str(r.get("requestType", "Other")))
            for r in recent
        )
        if not counter:
            return ToolResult(handled=True, answer="No request type data available.")
        cards = [AssistantCard(type="count", label=rtype, value=count) for rtype, count in counter.most_common(6)]
        lines = [f"- {rtype}: **{count}**" for rtype, count in counter.most_common(6)]
        return ToolResult(
            handled=True,
            answer="Request breakdown by type:\n" + "\n".join(lines),
            cards=cards,
        )

    def _upcoming_deadlines(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests")) + payload.open_requests
        with_due = [r for r in recent if r.get("dueAt") and str(r.get("status", "")).upper() not in FINAL_STATUSES]
        if not with_due:
            return ToolResult(handled=True, answer="No upcoming deadlines found in your visible requests.")
        return ToolResult(
            handled=True,
            answer=f"**{len(with_due)}** open request(s) have a due date set.",
            cards=[AssistantCard(type="count", label="With Deadlines", value=len(with_due))],
            context={"itemsWithDeadlines": with_due[:5]},
        )

    def _recent_activity(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests"))
        audit = self._as_list(payload.live_data_context.get("recentAuditLogs"))
        if not recent and not audit:
            return ToolResult(handled=True, answer="No recent activity data available.")
        parts = []
        if recent:
            parts.append(f"{len(recent)} recent request update(s)")
        if audit:
            parts.append(f"{len(audit)} recent audit event(s)")
        return ToolResult(
            handled=True,
            answer="Recent activity: " + ", ".join(parts) + ".",
            context={"recentRequests": recent[:5], "recentAuditLogs": audit[:5]},
        )

    def _request_summary(self, payload: AssistantAskRequest, entities: dict[str, str]) -> ToolResult:
        target = entities.get("requestNo")
        all_requests = self._as_list(payload.live_data_context.get("recentRequests")) + payload.open_requests
        for item in all_requests:
            if str(item.get("requestNo", "")).lower() == str(target).lower():
                status = str(item.get("status", "UNKNOWN"))
                title = str(item.get("title", ""))
                req_type = str(item.get("requestType", "") or item.get("type", ""))
                type_suffix = f" ({REQUEST_TYPE_LABELS.get(req_type.upper(), req_type)})" if req_type else ""
                return ToolResult(
                    handled=True,
                    answer=f"**{item.get('requestNo')}** — '{title}' is currently **{status}**{type_suffix}.",
                    cards=[AssistantCard(type="status", label=str(item.get("requestNo", "")), value=status, description=title or None)],
                    context={"request": item},
                )
        return ToolResult(handled=False, context={"requestNo": target})

    def _request_status_explanation(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests"))[:5]
        open_items = [r for r in payload.open_requests if str(r.get("status", "")).upper() not in FINAL_STATUSES]
        return ToolResult(handled=False, context={"openRequests": open_items[:5], "recentRequests": recent})

    # ══════════════════════════════════════════════════════════════════════════
    # Request type-specific handlers
    # ══════════════════════════════════════════════════════════════════════════

    def _internship_status(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        return self._filter_by_type(payload, "INTERNSHIP", "Internship")

    def _document_status(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        return self._filter_by_type(payload, "DOCUMENT", "Document")

    def _access_request_status(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        return self._filter_by_type(payload, "ACCESS_REQUEST", "Access Request")

    def _equipment_status(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        return self._filter_by_type(payload, "EQUIPMENT", "Equipment")

    def _filter_by_type(self, payload: AssistantAskRequest, type_key: str, label: str) -> ToolResult:
        all_requests = self._as_list(payload.live_data_context.get("recentRequests")) + payload.open_requests
        matches = [
            r for r in all_requests
            if str(r.get("requestType", "") or r.get("type", "")).upper() in {type_key, label.upper().replace(" ", "_")}
        ]
        if not matches:
            return ToolResult(handled=True, answer=f"No {label} requests found in your visible records.")
        open_ones = [r for r in matches if str(r.get("status", "")).upper() not in FINAL_STATUSES]
        latest = matches[0]
        status = str(latest.get("status", "UNKNOWN"))
        return ToolResult(
            handled=True,
            answer=f"**{len(matches)}** {label} request(s) found. Latest: **{latest.get('requestNo', '—')}** is **{status}**. ({len(open_ones)} still open)",
            cards=[
                AssistantCard(type="count", label=f"Total {label}", value=len(matches)),
                AssistantCard(type="count", label="Still Open", value=len(open_ones)),
            ],
            context={"requests": matches[:5]},
        )

    # ══════════════════════════════════════════════════════════════════════════
    # Approval / assignment — FACULTY / STAFF / ADMIN
    # ══════════════════════════════════════════════════════════════════════════

    def _pending_approvals(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        recent = self._as_list(payload.live_data_context.get("recentRequests"))
        pending = [r for r in recent if str(r.get("status", "")).upper() in PENDING_STATUSES]
        count = int(self._to_number(summary.get("pendingApprovals", len(pending)))) if isinstance(summary, dict) else len(pending)
        answer = f"**{count}** request(s) waiting for your approval." if count else "No pending approvals."
        return ToolResult(
            handled=True, answer=answer,
            cards=[AssistantCard(type="count", label="Pending Approvals", value=count)],
            context={"pendingRequests": pending[:5]},
        )

    def _approval_history(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests"))
        decided = [r for r in recent if str(r.get("status", "")).upper() in {"APPROVED", "REJECTED"}]
        if not decided:
            return ToolResult(handled=True, answer="No recently approved or rejected requests in your visible scope.")
        approved = sum(1 for r in decided if str(r.get("status", "")).upper() == "APPROVED")
        rejected = len(decided) - approved
        return ToolResult(
            handled=True,
            answer=f"Recent decisions: **{approved}** approved, **{rejected}** rejected.",
            cards=[AssistantCard(type="count", label="Approved", value=approved), AssistantCard(type="count", label="Rejected", value=rejected)],
            context={"decidedRequests": decided[:5]},
        )

    def _overdue_items(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        count = int(self._to_number(summary.get("overdueRequests", 0))) if isinstance(summary, dict) else 0
        if count == 0:
            return ToolResult(handled=True, answer="No overdue requests in your scope.", cards=[AssistantCard(type="count", label="Overdue", value=0)])
        return ToolResult(
            handled=True,
            answer=f"**{count}** overdue request(s) detected in your scope.",
            cards=[AssistantCard(type="count", label="Overdue Requests", value=count)],
        )

    def _assignment_queue(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests"))
        open_items = [r for r in recent if str(r.get("status", "")).upper() not in FINAL_STATUSES]
        if not open_items:
            return ToolResult(handled=True, answer="Your queue is empty — no active items assigned.")
        return ToolResult(
            handled=True,
            answer=f"**{len(open_items)}** active item(s) in your queue.",
            cards=[AssistantCard(type="count", label="In Queue", value=len(open_items))],
            context={"queue": open_items[:5]},
        )

    def _my_workload(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        recent = self._as_list(payload.live_data_context.get("recentRequests"))
        open_items = [r for r in recent if str(r.get("status", "")).upper() not in FINAL_STATUSES]
        pending = int(self._to_number(summary.get("pendingApprovals", 0))) if isinstance(summary, dict) else 0
        open_tickets = int(self._to_number(summary.get("openTickets", 0))) if isinstance(summary, dict) else 0
        cards = [AssistantCard(type="count", label="Active Items", value=len(open_items))]
        parts = [f"**{len(open_items)}** active requests"]
        if pending:
            parts.append(f"**{pending}** pending approvals")
            cards.append(AssistantCard(type="count", label="Pending Approvals", value=pending))
        if open_tickets:
            parts.append(f"**{open_tickets}** open tickets")
            cards.append(AssistantCard(type="count", label="Open Tickets", value=open_tickets))
        return ToolResult(handled=True, answer="Your workload: " + ", ".join(parts) + ".", cards=cards)

    def _faculty_internship_queue(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent = self._as_list(payload.live_data_context.get("recentRequests"))
        internships = [
            r for r in recent
            if str(r.get("requestType", "") or r.get("type", "")).upper() == "INTERNSHIP"
            and str(r.get("status", "")).upper() in PENDING_STATUSES
        ]
        if not internships:
            return ToolResult(handled=True, answer="No internship requests pending your review.")
        return ToolResult(
            handled=True,
            answer=f"**{len(internships)}** internship request(s) pending your review.",
            cards=[AssistantCard(type="count", label="Internship Reviews", value=len(internships))],
            context={"pendingInternships": internships[:5]},
        )

    # ══════════════════════════════════════════════════════════════════════════
    # Tickets — STAFF / ADMIN
    # ══════════════════════════════════════════════════════════════════════════

    def _my_tickets(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent_tickets = self._as_list(payload.live_data_context.get("recentTickets"))
        summary = payload.live_data_context.get("summary", {})
        count = int(self._to_number(summary.get("openTickets", len([t for t in recent_tickets if str(t.get("ticketStatus", "")).upper() in OPEN_TICKET_STATUSES])))) if isinstance(summary, dict) else 0
        if not recent_tickets:
            return ToolResult(handled=True, answer="No IT tickets found in your scope.")
        return ToolResult(
            handled=True,
            answer=f"**{count}** open IT ticket(s) in your scope.",
            cards=[AssistantCard(type="count", label="Open Tickets", value=count)],
            context={"recentTickets": recent_tickets[:5]},
        )

    def _ticket_queue_summary(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        recent_tickets = self._as_list(payload.live_data_context.get("recentTickets"))[:5]
        if isinstance(summary, dict) and "openTickets" in summary:
            count = int(self._to_number(summary["openTickets"]))
            return ToolResult(
                handled=True,
                answer=f"**{count}** open ticket(s) in the system.",
                cards=[AssistantCard(type="count", label="Open Tickets", value=count)],
                context={"recentTickets": recent_tickets},
            )
        if recent_tickets:
            open_count = sum(1 for t in recent_tickets if str(t.get("ticketStatus", "")).upper() in OPEN_TICKET_STATUSES)
            return ToolResult(handled=True, answer=f"**{open_count}** open among the last {len(recent_tickets)} visible tickets.", cards=[AssistantCard(type="count", label="Open Tickets", value=open_count)])
        return ToolResult(handled=False, context={"summary": summary})

    def _it_resolution_stats(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        recent_tickets = self._as_list(payload.live_data_context.get("recentTickets"))
        if not recent_tickets:
            return ToolResult(handled=True, answer="No ticket data available to compute resolution stats.")
        resolved = [t for t in recent_tickets if str(t.get("ticketStatus", "")).upper() in CLOSED_TICKET_STATUSES]
        open_tickets = [t for t in recent_tickets if str(t.get("ticketStatus", "")).upper() in OPEN_TICKET_STATUSES]
        total = len(recent_tickets)
        res_rate = round((len(resolved) / total) * 100) if total else 0
        return ToolResult(
            handled=True,
            answer=f"Of **{total}** visible tickets: **{len(resolved)}** resolved ({res_rate}%), **{len(open_tickets)}** still open.",
            cards=[
                AssistantCard(type="count", label="Resolved", value=len(resolved)),
                AssistantCard(type="count", label="Open", value=len(open_tickets)),
            ],
        )

    # ══════════════════════════════════════════════════════════════════════════
    # SLA
    # ══════════════════════════════════════════════════════════════════════════

    def _sla_status(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        overdue = int(self._to_number(summary.get("overdueRequests", 0))) if isinstance(summary, dict) else 0
        open_req = int(self._to_number(summary.get("openRequests", 0))) if isinstance(summary, dict) else 0
        if overdue == 0:
            answer = "No SLA breaches detected — all tracked requests are within their deadlines."
        else:
            breach_rate = round((overdue / open_req) * 100, 1) if open_req else 0
            answer = f"**{overdue}** request(s) past their due date (breach rate: ~{breach_rate}%)."
        return ToolResult(handled=True, answer=answer, cards=[AssistantCard(type="count", label="Overdue (SLA)", value=overdue)])

    def _sla_policy_info(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        links = [AssistantLink(label="SLA Policies", href="/admin/sla")] if "/admin/sla" in payload.authorized_routes else []
        return ToolResult(handled=True, answer="SLA policies define resolution deadlines per request type. Manage them from the SLA Policies admin page.", links=links)

    # ══════════════════════════════════════════════════════════════════════════
    # Reservations / resources
    # ══════════════════════════════════════════════════════════════════════════

    def _my_reservations(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        reservations = self._as_list(payload.live_data_context.get("upcomingReservations"))
        count = len(reservations)
        answer = f"**{count}** upcoming reservation(s)." if count else "No upcoming reservations."
        return ToolResult(handled=True, answer=answer, cards=[AssistantCard(type="count", label="Reservations", value=count)], context={"upcomingReservations": reservations[:5]})

    def _resource_info(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        active = int(self._to_number(summary.get("activeResources", 0))) if isinstance(summary, dict) else 0
        answer = f"**{active}** active resource(s) in the system. Use the Reservations page to check availability." if active else "Resource availability data not loaded. Check the Reservations page."
        links = [AssistantLink(label=str(r.get("label", "")), href=str(r["href"])) for r in payload.authorized_route_details if "reservation" in str(r.get("href", "")).lower() and isinstance(r.get("href"), str)][:2]
        return ToolResult(handled=True, answer=answer, links=links, cards=[AssistantCard(type="count", label="Active Resources", value=active)] if active else [])

    # ══════════════════════════════════════════════════════════════════════════
    # Notifications
    # ══════════════════════════════════════════════════════════════════════════

    def _my_notifications(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        count = int(self._to_number(summary.get("unreadNotifications", 0))) if isinstance(summary, dict) else 0
        answer = f"**{count}** unread notification(s)." if count else "No unread notifications."
        return ToolResult(handled=True, answer=answer, cards=[AssistantCard(type="count", label="Unread Notifications", value=count)])

    # ══════════════════════════════════════════════════════════════════════════
    # Schedule
    # ══════════════════════════════════════════════════════════════════════════

    def _my_today_appointments(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        appointments = self._as_list(payload.live_data_context.get("upcomingAppointments"))[:5]
        count = len(appointments)
        answer = f"**{count}** upcoming appointment(s)." if count else "No upcoming appointments."
        return ToolResult(handled=True, answer=answer, cards=[AssistantCard(type="count", label="Appointments", value=count)], context={"appointments": appointments})

    def _my_today_events(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        events = self._as_list(payload.live_data_context.get("upcomingEvents"))[:5]
        if not events:
            event_requests = self._as_list(payload.live_data_context.get("recentEventRequests"))
            events = [e for e in event_requests if str(e.get("requestStatus", "")).upper() == "APPROVED"][:5]
        count = len(events)
        answer = f"**{count}** upcoming event(s)." if count else "No upcoming events."
        return ToolResult(handled=True, answer=answer, cards=[AssistantCard(type="count", label="Events", value=count)], context={"events": events})

    def _my_today_summary(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        if not isinstance(summary, dict):
            summary = {}
        cards: list[AssistantCard] = []
        parts: list[str] = []
        for key, label, phrase in [
            ("openRequests",          "Open Requests",        "open request(s)"),
            ("pendingApprovals",      "Pending Approvals",    "pending approval(s)"),
            ("unreadNotifications",   "Unread Notifications", "unread notification(s)"),
            ("upcomingAppointments",  "Appointments",         "upcoming appointment(s)"),
            ("upcomingEvents",        "Events",               "upcoming event(s)"),
            ("openTickets",           "Open Tickets",         "open ticket(s)"),
        ]:
            if key in summary:
                val = self._to_number(summary[key])
                cards.append(AssistantCard(type="count", label=label, value=val))
                parts.append(f"**{int(val)}** {phrase}")
        answer = "Your summary: " + ", ".join(parts) + "." if parts else "No summary data available."
        return ToolResult(handled=bool(parts), answer=answer, cards=cards, context={"summary": summary, "recentRequests": self._as_list(payload.live_data_context.get("recentRequests"))[:5]})

    # ══════════════════════════════════════════════════════════════════════════
    # Organizer
    # ══════════════════════════════════════════════════════════════════════════

    def _event_plan_status(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        event_requests = self._as_list(payload.live_data_context.get("recentEventRequests"))
        upcoming = self._as_list(payload.live_data_context.get("upcomingEvents"))
        if not event_requests and not upcoming:
            return ToolResult(handled=True, answer="No event plans or upcoming events found.")
        active = [r for r in event_requests if str(r.get("requestStatus", "")).upper() not in FINAL_STATUSES]
        count = int(self._to_number(summary.get("eventRequests", len(event_requests)))) if isinstance(summary, dict) else len(event_requests)
        return ToolResult(
            handled=True,
            answer=f"**{count}** event request(s) total, **{len(active)}** in progress, **{len(upcoming)}** published upcoming event(s).",
            cards=[AssistantCard(type="count", label="Event Requests", value=count), AssistantCard(type="count", label="Upcoming Events", value=len(upcoming))],
            context={"recentEventRequests": event_requests[:5], "upcomingEvents": upcoming[:5]},
        )

    def _my_club_info(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        event_count = int(self._to_number(summary.get("eventRequests", 0))) if isinstance(summary, dict) else 0
        return ToolResult(
            handled=True,
            answer=f"Club event requests visible: **{event_count}**. For detailed club management, check your organizer dashboard.",
            links=[AssistantLink(label="Organizer Dashboard", href="/organizer/dashboard")] if "/organizer/dashboard" in payload.authorized_routes else [],
        )

    def _procurement_status(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        procurement = self._as_list(payload.live_data_context.get("recentProcurement"))
        if not procurement:
            return ToolResult(handled=True, answer="No procurement requests found in your scope.")
        pending = [p for p in procurement if str(p.get("procurementStatus", "")).upper() not in FINAL_STATUSES]
        return ToolResult(
            handled=True,
            answer=f"**{len(procurement)}** procurement request(s), **{len(pending)}** still in progress.",
            cards=[AssistantCard(type="count", label="Procurement", value=len(procurement)), AssistantCard(type="count", label="In Progress", value=len(pending))],
            context={"recentProcurement": procurement[:5]},
        )

    # ══════════════════════════════════════════════════════════════════════════
    # Admin: analytics / reports
    # ══════════════════════════════════════════════════════════════════════════

    def _analytics_summary(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        cards: list[AssistantCard] = []
        parts: list[str] = []
        if isinstance(summary, dict):
            for key, label, phrase in [
                ("totalUsers",     "Total Users",    "total users"),
                ("activeUsers",    "Active Users",   "active users"),
                ("totalRequests",  "Total Requests", "total requests"),
                ("openRequests",   "Open Requests",  "open requests"),
                ("overdueRequests","Overdue",        "overdue"),
                ("openTickets",    "Open Tickets",   "open tickets"),
            ]:
                if key in summary:
                    val = self._to_number(summary[key])
                    cards.append(AssistantCard(type="count", label=label, value=val))
                    parts.append(f"**{int(val)}** {phrase}")
        return ToolResult(handled=bool(parts), answer="Platform stats: " + ", ".join(parts) + "." if parts else "", cards=cards, context={"summary": summary})

    def _recent_users(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        recent_users = self._as_list(payload.live_data_context.get("recentUsers"))
        total = int(self._to_number(summary.get("totalUsers", 0))) if isinstance(summary, dict) else 0
        active = int(self._to_number(summary.get("activeUsers", 0))) if isinstance(summary, dict) else 0
        cards = []
        if total:
            cards.append(AssistantCard(type="count", label="Total Users", value=total))
        if active:
            cards.append(AssistantCard(type="count", label="Active Users", value=active))
        suffix = f" Last {len(recent_users)} registered user(s) listed." if recent_users else ""
        return ToolResult(handled=True, answer=f"**{total}** users on the platform, **{active}** active.{suffix}", cards=cards, context={"recentUsers": recent_users[:5]})

    def _workflow_info(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        count = int(self._to_number(summary.get("activeWorkflows", 0))) if isinstance(summary, dict) else 0
        links = [AssistantLink(label="Manage Workflows", href="/admin/workflows")] if "/admin/workflows" in payload.authorized_routes else []
        return ToolResult(handled=True, answer=f"**{count}** active workflow definition(s) on the platform.", cards=[AssistantCard(type="count", label="Active Workflows", value=count)], links=links)

    def _integration_list(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        count = int(self._to_number(summary.get("totalIntegrations", 0))) if isinstance(summary, dict) else 0
        links = [AssistantLink(label="Integrations", href="/admin/integrations")] if "/admin/integrations" in payload.authorized_routes else []
        return ToolResult(handled=True, answer=f"**{count}** integration(s) configured on the platform.", cards=[AssistantCard(type="count", label="Integrations", value=count)], links=links)

    def _report_list(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        report_routes = [r for r in payload.authorized_route_details if "report" in str(r.get("href", "")).lower()]
        links = [AssistantLink(label=str(r.get("label", "")), href=str(r["href"])) for r in report_routes[:3] if isinstance(r.get("href"), str)]
        return ToolResult(handled=True, answer="Reports are available from the Reports section of your portal.", links=links)

    def _audit_logs(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        logs = self._as_list(payload.live_data_context.get("recentAuditLogs"))
        if not logs:
            return ToolResult(handled=True, answer="No audit log entries available.")
        return ToolResult(handled=True, answer=f"**{len(logs)}** recent audit log entry(ies) available.", context={"recentAuditLogs": logs[:6]})

    def _webhook_status(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        logs = self._as_list(payload.live_data_context.get("recentWebhookLogs"))
        if not logs:
            return ToolResult(handled=True, answer="No webhook log entries found.")
        failed = [w for w in logs if str(w.get("status", "")).upper() in {"FAILED", "ERROR"}]
        suffix = f" **{len(failed)}** failed." if failed else " All deliveries succeeded."
        return ToolResult(handled=True, answer=f"Last **{len(logs)}** webhook event(s).{suffix}", context={"recentWebhookLogs": logs[:6], "failedCount": len(failed)})

    def _system_overview(self, payload: AssistantAskRequest, _: dict[str, str]) -> ToolResult:
        summary = payload.live_data_context.get("summary", {})
        if not isinstance(summary, dict) or not summary:
            return ToolResult(handled=False, context=self._build_general_context(payload))
        cards: list[AssistantCard] = []
        parts: list[str] = []
        for key, label, phrase in [
            ("totalUsers",       "Total Users",       "total users"),
            ("activeUsers",      "Active Users",      "active"),
            ("openRequests",     "Open Requests",     "open requests"),
            ("activeWorkflows",  "Active Workflows",  "active workflows"),
            ("activeResources",  "Active Resources",  "active resources"),
            ("totalIntegrations","Integrations",      "integrations"),
        ]:
            if key in summary:
                val = int(self._to_number(summary[key]))
                cards.append(AssistantCard(type="count", label=label, value=val))
                parts.append(f"**{val}** {phrase}")
        answer = "System overview: " + ", ".join(parts) + "." if parts else "System overview data unavailable."
        return ToolResult(handled=bool(parts), answer=answer, cards=cards, context={"summary": summary})

    # ══════════════════════════════════════════════════════════════════════════
    # Helpers
    # ══════════════════════════════════════════════════════════════════════════

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

"""
RabbitMQ'dan gelen mesajların Pydantic şemaları.
NestJS tarafındaki event-payloads.ts ile birebir eşleşir.
"""
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel


class BasePayload(BaseModel):
    event: str
    occurredAt: str
    correlationId: Optional[str] = None


# ── Request events ────────────────────────────────────────────────────────────

class RequestCreatedPayload(BasePayload):
    event: Literal["request.created"]
    requestId: str
    requestNo: str
    requestType: str
    requesterUserId: str
    priority: str
    workflowInstanceId: Optional[str] = None


class RequestUpdatedPayload(BasePayload):
    event: Literal["request.updated"]
    requestId: str
    requestType: str
    updatedByUserId: str
    changes: list[str] = []


class RequestCancelledPayload(BasePayload):
    event: Literal["request.cancelled"]
    requestId: str
    requestType: str
    cancelledByUserId: str
    reason: Optional[str] = None


# ── Workflow events ───────────────────────────────────────────────────────────

class WorkflowAssignedPayload(BasePayload):
    event: Literal["workflow.assigned"]
    requestId: str
    requestType: str
    workflowInstanceId: Optional[str] = None
    stepCode: Optional[str] = None
    assigneeUserId: str
    assigneeRole: Optional[str] = None
    triggeredByUserId: str


class WorkflowApprovedPayload(BasePayload):
    event: Literal["workflow.approved"]
    requestId: str
    requestType: str
    actorUserId: str
    comment: Optional[str] = None
    newStatus: str


class WorkflowRejectedPayload(BasePayload):
    event: Literal["workflow.rejected"]
    requestId: str
    requestType: str
    actorUserId: str
    comment: Optional[str] = None
    newStatus: str


class WorkflowRevisionRequestedPayload(BasePayload):
    event: Literal["workflow.revision_requested"]
    requestId: str
    requestType: str
    actorUserId: str
    comment: Optional[str] = None
    newStatus: str


# ── Notification / email ──────────────────────────────────────────────────────

class NotificationCreatePayload(BasePayload):
    event: Literal["notification.create"]
    userId: str
    title: str
    message: str
    requestId: Optional[str] = None
    actionUrl: Optional[str] = None


class EmailSendPayload(BasePayload):
    event: Literal["email.send"]
    template: str
    recipientUserId: Optional[str] = None
    toEmail: Optional[str] = None
    requestId: Optional[str] = None
    context: dict[str, Any] = {}


# ── SLA / reminder ────────────────────────────────────────────────────────────

class ReminderSchedulePayload(BasePayload):
    event: Literal["reminder.schedule"]
    requestId: str
    targetUserId: str
    reminderType: str
    scheduledAt: str


class SlaCheckPayload(BasePayload):
    event: Literal["sla.check"]
    requestId: str
    checkType: str


class AuditAppendPayload(BasePayload):
    event: Literal["audit.append"]
    entityType: str
    entityId: str
    actionType: str
    description: str
    actorUserId: Optional[str] = None
    meta: Optional[dict[str, Any]] = None


class AttachmentProcessPayload(BasePayload):
    event: Literal["attachment.process"]
    attachmentId: str
    requestId: Optional[str] = None
    storageKey: Optional[str] = None
    mimeType: Optional[str] = None


class DocumentGeneratePayload(BasePayload):
    event: Literal["document.generate"]
    requestId: str
    requestType: Optional[str] = None
    actorUserId: Optional[str] = None


class ReportGeneratePayload(BasePayload):
    event: Literal["report.generate"]
    reportType: str = "request_summary"
    periodDays: int = 30
    format: str = "pdf"
    requesterUserId: Optional[str] = None


# ── Union ─────────────────────────────────────────────────────────────────────

PAYLOAD_MAP: dict[str, type[BasePayload]] = {
    "audit.append":        AuditAppendPayload,
    "attachment.process":  AttachmentProcessPayload,
    "document.generate":   DocumentGeneratePayload,
    "report.generate":     ReportGeneratePayload,
    "request.created":            RequestCreatedPayload,
    "request.updated":            RequestUpdatedPayload,
    "request.cancelled":          RequestCancelledPayload,
    "workflow.assigned":          WorkflowAssignedPayload,
    "workflow.approved":          WorkflowApprovedPayload,
    "workflow.rejected":          WorkflowRejectedPayload,
    "workflow.revision_requested":WorkflowRevisionRequestedPayload,
    "notification.create":        NotificationCreatePayload,
    "email.send":                 EmailSendPayload,
    "reminder.schedule":          ReminderSchedulePayload,
    "sla.check":                  SlaCheckPayload,
}


def parse_payload(data: dict[str, Any]) -> BasePayload:
    """event alanına göre doğru Pydantic modeline parse eder."""
    event = data.get("event", "")
    model = PAYLOAD_MAP.get(event, BasePayload)
    return model.model_validate(data)

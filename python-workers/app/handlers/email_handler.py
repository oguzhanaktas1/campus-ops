"""
Email handler — template bazlı email gönderir ve EmailLog kaydı oluşturur.

Dinlediği event'ler:
  - email.send (doğrudan)
  - workflow.assigned
  - workflow.approved
  - workflow.rejected
  - workflow.revision_requested
  - reminder.schedule
"""
from __future__ import annotations
import structlog
from app.schemas.payloads import (
    BasePayload,
    EmailSendPayload,
    WorkflowAssignedPayload,
    WorkflowApprovedPayload,
    WorkflowRejectedPayload,
    WorkflowRevisionRequestedPayload,
    ReminderSchedulePayload,
    RequestCreatedPayload,
)
from app.services import db_service, mail_service

logger = structlog.get_logger(__name__)

FRONTEND_URL = "http://localhost:3000"


# ─── Ana dispatch ─────────────────────────────────────────────────────────────

async def handle(payload: BasePayload) -> None:
    match payload.event:
        case "email.send":
            await _handle_direct(payload)  # type: ignore[arg-type]
        case "request.created":
            await _handle_request_created(payload)  # type: ignore[arg-type]
        case "workflow.assigned":
            await _handle_workflow_assigned(payload)  # type: ignore[arg-type]
        case "workflow.approved":
            await _handle_workflow_approved(payload)  # type: ignore[arg-type]
        case "workflow.rejected":
            await _handle_workflow_rejected(payload)  # type: ignore[arg-type]
        case "workflow.revision_requested":
            await _handle_workflow_revision(payload)  # type: ignore[arg-type]
        case "reminder.schedule":
            await _handle_reminder(payload)  # type: ignore[arg-type]
        case _:
            logger.debug("email_handler_skip", event=payload.event)


# ─── Handler'lar ──────────────────────────────────────────────────────────────

async def _handle_direct(p: EmailSendPayload) -> None:
    """email.send — doğrudan template + recipient belirtilmiş."""
    to_email = p.toEmail
    if not to_email and p.recipientUserId:
        user = await db_service.fetch_user_by_id(p.recipientUserId)
        to_email = user["email"] if user else None

    if not to_email:
        logger.warning("email_no_recipient", correlation_id=p.correlationId)
        return

    await _send(
        to_email=to_email,
        template=p.template,
        context=p.context,
        user_id=p.recipientUserId,
        request_id=p.requestId,
    )


async def _handle_request_created(p: RequestCreatedPayload) -> None:
    """Yeni talep — requester'a onay maili."""
    user = await db_service.fetch_user_by_id(p.requesterUserId)
    if not user:
        return
    await _send(
        to_email=user["email"],
        template="request_submitted",
        context={
            "subject":     f"Request {p.requestNo} submitted",
            "name":        user.get("fullName") or user["email"],
            "requestNo":   p.requestNo,
            "requestType": p.requestType,
            "requestUrl":  f"{FRONTEND_URL}/student/requests/{p.requestId}",
        },
        user_id=p.requesterUserId,
        request_id=p.requestId,
        template_key="request_submitted",
    )


async def _handle_workflow_assigned(p: WorkflowAssignedPayload) -> None:
    """Atama yapıldığında assignee'ye mail."""
    user = await db_service.fetch_user_by_id(p.assigneeUserId)
    if not user:
        return
    request = await db_service.fetch_request_by_id(p.requestId)
    req_no = request["requestNo"] if request else p.requestId

    await _send(
        to_email=user["email"],
        template="workflow_assigned",
        context={
            "subject":     f"New request assigned: {req_no}",
            "name":        user.get("fullName") or user["email"],
            "requestNo":   req_no,
            "requestType": p.requestType,
            "stepCode":    p.stepCode or "Review",
            "requestUrl":  f"{FRONTEND_URL}/staff/requests/{p.requestId}",
        },
        user_id=p.assigneeUserId,
        request_id=p.requestId,
        template_key="workflow_assigned",
    )


async def _handle_workflow_approved(p: WorkflowApprovedPayload) -> None:
    """Onay maili — requester'a."""
    request = await db_service.fetch_request_by_id(p.requestId)
    if not request:
        return
    user = await db_service.fetch_user_by_id(request["requesterUserId"])
    if not user:
        return

    await _send(
        to_email=user["email"],
        template="workflow_approved",
        context={
            "subject":    f"Request {request['requestNo']} approved",
            "name":       user.get("fullName") or user["email"],
            "requestNo":  request["requestNo"],
            "comment":    p.comment or "",
            "requestUrl": f"{FRONTEND_URL}/student/requests/{p.requestId}",
        },
        user_id=user["id"],
        request_id=p.requestId,
        template_key="workflow_approved",
    )


async def _handle_workflow_rejected(p: WorkflowRejectedPayload) -> None:
    """Red maili — requester'a."""
    request = await db_service.fetch_request_by_id(p.requestId)
    if not request:
        return
    user = await db_service.fetch_user_by_id(request["requesterUserId"])
    if not user:
        return

    await _send(
        to_email=user["email"],
        template="workflow_rejected",
        context={
            "subject":    f"Request {request['requestNo']} rejected",
            "name":       user.get("fullName") or user["email"],
            "requestNo":  request["requestNo"],
            "reason":     p.comment or "No reason provided.",
            "requestUrl": f"{FRONTEND_URL}/student/requests/{p.requestId}",
        },
        user_id=user["id"],
        request_id=p.requestId,
        template_key="workflow_rejected",
    )


async def _handle_workflow_revision(p: WorkflowRevisionRequestedPayload) -> None:
    """Revizyon maili — requester'a."""
    request = await db_service.fetch_request_by_id(p.requestId)
    if not request:
        return
    user = await db_service.fetch_user_by_id(request["requesterUserId"])
    if not user:
        return

    await _send(
        to_email=user["email"],
        template="workflow_revision",
        context={
            "subject":    f"Revision requested: {request['requestNo']}",
            "name":       user.get("fullName") or user["email"],
            "requestNo":  request["requestNo"],
            "note":       p.comment or "",
            "requestUrl": f"{FRONTEND_URL}/student/requests/{p.requestId}",
        },
        user_id=user["id"],
        request_id=p.requestId,
        template_key="workflow_revision",
    )


async def _handle_reminder(p: ReminderSchedulePayload) -> None:
    """Reminder maili."""
    user = await db_service.fetch_user_by_id(p.targetUserId)
    if not user:
        return
    request = await db_service.fetch_request_by_id(p.requestId)
    req_no = request["requestNo"] if request else p.requestId

    await _send(
        to_email=user["email"],
        template="reminder",
        context={
            "subject":      f"Reminder: Action needed on {req_no}",
            "name":         user.get("fullName") or user["email"],
            "requestNo":    req_no,
            "reminderType": p.reminderType,
            "requestUrl":   f"{FRONTEND_URL}/staff/requests/{p.requestId}",
        },
        user_id=p.targetUserId,
        request_id=p.requestId,
        template_key="reminder",
    )


# ─── Yardımcı ─────────────────────────────────────────────────────────────────

async def _send(
    to_email: str,
    template: str,
    context: dict,
    user_id: str | None = None,
    request_id: str | None = None,
    template_key: str | None = None,
) -> None:
    success = await mail_service.send_email(to_email, template, context)
    status = "SENT" if success else "FAILED"

    await db_service.create_email_log(
        to_email=to_email,
        subject=context.get("subject", template),
        template_key=template_key or template,
        user_id=user_id,
        request_id=request_id,
        status=status,
    )

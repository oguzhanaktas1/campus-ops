"""
Notification handler — in-app bildirim oluşturur ve Redis unread sayacını artırır.

Dinlediği event'ler:
  - request.created
  - workflow.assigned
  - workflow.approved
  - workflow.rejected
  - workflow.revision_requested
  - notification.create (doğrudan)
"""
from __future__ import annotations
import structlog
from app.schemas.payloads import (
    BasePayload,
    RequestCreatedPayload,
    WorkflowAssignedPayload,
    WorkflowApprovedPayload,
    WorkflowRejectedPayload,
    WorkflowRevisionRequestedPayload,
    NotificationCreatePayload,
)
from app.services import db_service, redis_service

logger = structlog.get_logger(__name__)

# ─── Portal URL'leri ──────────────────────────────────────────────────────────
FRONTEND_URL = "http://localhost:3000"


def _request_url(request_id: str, portal: str = "student") -> str:
    return f"{FRONTEND_URL}/{portal}/requests/{request_id}"


# ─── Ana dispatch ─────────────────────────────────────────────────────────────

async def handle(payload: BasePayload) -> None:
    """Event tipine göre doğru handler'a yönlendir."""
    match payload.event:
        case "notification.create":
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
        case _:
            logger.debug("notification_handler_skip", event=payload.event)


# ─── Handler'lar ──────────────────────────────────────────────────────────────

async def _handle_direct(p: NotificationCreatePayload) -> None:
    """notification.create event'i — doğrudan bildirim oluştur."""
    await _create(
        user_id=p.userId,
        title=p.title,
        message=p.message,
        request_id=p.requestId,
        action_url=p.actionUrl,
    )


async def _handle_request_created(p: RequestCreatedPayload) -> None:
    """Yeni talep açıldığında requester'a onay bildirimi."""
    await _create(
        user_id=p.requesterUserId,
        title="Request submitted",
        message=f"Your request {p.requestNo} has been submitted successfully.",
        request_id=p.requestId,
        action_url=_request_url(p.requestId),
    )


async def _handle_workflow_assigned(p: WorkflowAssignedPayload) -> None:
    """Workflow adımı atandığında assignee'ye bildirim."""
    request = await db_service.fetch_request_by_id(p.requestId)
    req_no = request["requestNo"] if request else p.requestId

    await _create(
        user_id=p.assigneeUserId,
        title="New request assigned to you",
        message=f"Request {req_no} ({p.requestType}) has been assigned to you.",
        request_id=p.requestId,
        action_url=_request_url(p.requestId, "staff"),
    )


async def _handle_workflow_approved(p: WorkflowApprovedPayload) -> None:
    """Onaylandığında requester'a bildirim."""
    request = await db_service.fetch_request_by_id(p.requestId)
    if not request:
        return
    await _create(
        user_id=request["requesterUserId"],
        title="Request approved ✓",
        message=f"Your request {request['requestNo']} has been approved.",
        request_id=p.requestId,
        action_url=_request_url(p.requestId),
    )


async def _handle_workflow_rejected(p: WorkflowRejectedPayload) -> None:
    """Reddedildiğinde requester'a bildirim."""
    request = await db_service.fetch_request_by_id(p.requestId)
    if not request:
        return
    msg = f"Your request {request['requestNo']} has been rejected."
    if p.comment:
        msg += f" Reason: {p.comment}"
    await _create(
        user_id=request["requesterUserId"],
        title="Request rejected",
        message=msg,
        request_id=p.requestId,
        action_url=_request_url(p.requestId),
    )


async def _handle_workflow_revision(p: WorkflowRevisionRequestedPayload) -> None:
    """Revizyon istendiğinde requester'a bildirim."""
    request = await db_service.fetch_request_by_id(p.requestId)
    if not request:
        return
    msg = f"Revision requested for {request['requestNo']}."
    if p.comment:
        msg += f" Note: {p.comment}"
    await _create(
        user_id=request["requesterUserId"],
        title="Revision requested",
        message=msg,
        request_id=p.requestId,
        action_url=_request_url(p.requestId),
    )


# ─── Yardımcı ─────────────────────────────────────────────────────────────────

async def _create(
    user_id: str,
    title: str,
    message: str,
    request_id: str | None = None,
    action_url: str | None = None,
) -> None:
    notif_id = await db_service.create_notification(
        user_id=user_id,
        title=title,
        message=message,
        request_id=request_id,
        action_url=action_url,
    )
    if notif_id:
        await redis_service.increment_unread_count(user_id)
        logger.info(
            "notification_created",
            notif_id=notif_id,
            user_id=user_id,
            title=title,
        )

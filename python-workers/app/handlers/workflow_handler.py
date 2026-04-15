"""
Workflow Support Handler — q.workflow queue.

Görevler:
- request.created  → request tipine göre auto-routing kontrolü, reminder planla
- workflow.assigned → 48 saat aksiyon yoksa reminder planla
- workflow.approved → document generation gerekiyorsa tetikle
- sla.check        → SLA ihlali tespiti
"""
from __future__ import annotations
import asyncio
import structlog
from app.schemas.payloads import (
    BasePayload,
    RequestCreatedPayload,
    WorkflowAssignedPayload,
    WorkflowApprovedPayload,
    SlaCheckPayload,
)
from app.services import db_service

logger = structlog.get_logger(__name__)

# Request tipleri — 48 saat içinde aksiyon alınmazsa reminder
REMINDER_ELIGIBLE_TYPES = {
    "internship", "procurement", "room_reservation",
    "equipment", "access", "document",
}

# Bu tipler onaylanınca document generation tetikler
DOCUMENT_GENERATE_ON_APPROVE = {"document", "internship"}


async def handle(payload: BasePayload) -> None:
    match payload.event:
        case "request.created":
            await _handle_request_created(payload)  # type: ignore[arg-type]
        case "workflow.assigned":
            await _handle_workflow_assigned(payload)  # type: ignore[arg-type]
        case "workflow.approved":
            await _handle_workflow_approved(payload)  # type: ignore[arg-type]
        case "sla.check":
            await _handle_sla_check(payload)          # type: ignore[arg-type]
        case _:
            logger.debug("workflow_handler_skip", event=payload.event)


async def _handle_request_created(p: RequestCreatedPayload) -> None:
    """
    Yeni talep — request tipine göre kontroller yap.
    Internship → advisor ataması oldu mu?
    IT ticket → kategori bazlı queue belirlemesi (NestJS zaten yapıyor).
    Reminder planla: 48 saat içinde aksiyon yoksa.
    """
    if p.requestType.lower() in REMINDER_ELIGIBLE_TYPES:
        from datetime import datetime, timedelta, timezone
        scheduled = (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()

        await db_service.create_reminder_record(
            request_id=p.requestId,
            target_user_id=p.requesterUserId,
            reminder_type="no_action_48h",
            scheduled_at=scheduled,
        )
        logger.info(
            "reminder_scheduled",
            request_id=p.requestId,
            type=p.requestType,
            scheduled_at=scheduled,
        )


async def _handle_workflow_assigned(p: WorkflowAssignedPayload) -> None:
    """
    Step atandığında — 48 saat içinde onay/red gelmezse assignee'ye reminder.
    """
    from datetime import datetime, timedelta, timezone
    scheduled = (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()

    await db_service.create_reminder_record(
        request_id=p.requestId,
        target_user_id=p.assigneeUserId,
        reminder_type="pending_action_48h",
        scheduled_at=scheduled,
    )
    logger.info(
        "assignee_reminder_scheduled",
        request_id=p.requestId,
        assignee=p.assigneeUserId,
    )


async def _handle_workflow_approved(p: WorkflowApprovedPayload) -> None:
    """
    Onay sonrası — belge üretimi gerektiren tipler için document.generate yayımla.
    (RabbitmqService olmadığı için şimdilik sadece logluyoruz; Faz 3'te aktifleşir.)
    """
    if p.requestType.lower() in DOCUMENT_GENERATE_ON_APPROVE:
        logger.info(
            "document_generate_needed",
            request_id=p.requestId,
            request_type=p.requestType,
            note="Will be published to q.documents in Phase 3",
        )


async def _handle_sla_check(p: SlaCheckPayload) -> None:
    """
    SLA check event'i — süre dolmuş mu?
    Şimdilik DB'deki SlaEvent'e bakıp log yaz.
    Faz 2: eskalasyon event'i üretmek için genişletilecek.
    """
    request = await db_service.fetch_request_by_id(p.requestId)
    if not request:
        return

    logger.info(
        "sla_check_received",
        request_id=p.requestId,
        check_type=p.checkType,
        current_status=request.get("status"),
    )
    # TODO Faz 3: eğer SLA breached ise → manager'a eskalasyon bildirimi

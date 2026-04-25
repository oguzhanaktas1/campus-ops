"""
Audit Handler — q.audit queue.

Tüm önemli event'lerin zenginleştirilmiş audit trail kaydını yazar.
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
    RequestCancelledPayload,
    AuditAppendPayload,
)
from app.services import db_service

logger = structlog.get_logger(__name__)


async def handle(payload: BasePayload) -> None:
    match payload.event:
        case "audit.append":
            await _handle_direct(payload)             # type: ignore[arg-type]
        case "request.created":
            await _handle_request_created(payload)    # type: ignore[arg-type]
        case "request.cancelled":
            await _handle_request_cancelled(payload)  # type: ignore[arg-type]
        case "workflow.assigned":
            await _handle_workflow_assigned(payload)  # type: ignore[arg-type]
        case "workflow.approved":
            await _handle_workflow_approved(payload)  # type: ignore[arg-type]
        case "workflow.rejected":
            await _handle_workflow_rejected(payload)  # type: ignore[arg-type]
        case "workflow.revision_requested":
            await _handle_workflow_revision(payload)  # type: ignore[arg-type]
        case _:
            logger.debug("audit_handler_skip", event_name=payload.event)


async def _handle_direct(p: AuditAppendPayload) -> None:
    await db_service.create_audit_log(
        entity_type=p.entityType,
        entity_id=p.entityId,
        action_type=p.actionType,
        description=p.description,
        actor_user_id=p.actorUserId,
        meta=p.meta,
    )


async def _handle_request_created(p: RequestCreatedPayload) -> None:
    await db_service.create_audit_log(
        entity_type="Request",
        entity_id=p.requestId,
        action_type="CREATE",
        description=f"Request {p.requestNo} created ({p.requestType})",
        actor_user_id=p.requesterUserId,
        meta={"requestNo": p.requestNo, "requestType": p.requestType, "priority": p.priority},
    )


async def _handle_request_cancelled(p: RequestCancelledPayload) -> None:
    await db_service.create_audit_log(
        entity_type="Request",
        entity_id=p.requestId,
        action_type="DELETE",
        description=f"Request {p.requestId} cancelled. Reason: {p.reason or 'N/A'}",
        actor_user_id=p.cancelledByUserId,
    )


async def _handle_workflow_assigned(p: WorkflowAssignedPayload) -> None:
    await db_service.create_audit_log(
        entity_type="Request",
        entity_id=p.requestId,
        action_type="UPDATE",
        description=f"Request assigned to user {p.assigneeUserId} at step '{p.stepCode}'",
        actor_user_id=p.triggeredByUserId,
        meta={"stepCode": p.stepCode, "assigneeUserId": p.assigneeUserId},
    )


async def _handle_workflow_approved(p: WorkflowApprovedPayload) -> None:
    await db_service.create_audit_log(
        entity_type="Request",
        entity_id=p.requestId,
        action_type="UPDATE",
        description=f"Request approved. New status: {p.newStatus}",
        actor_user_id=p.actorUserId,
        meta={"newStatus": p.newStatus, "comment": p.comment},
    )


async def _handle_workflow_rejected(p: WorkflowRejectedPayload) -> None:
    await db_service.create_audit_log(
        entity_type="Request",
        entity_id=p.requestId,
        action_type="UPDATE",
        description=f"Request rejected. Reason: {p.comment or 'N/A'}",
        actor_user_id=p.actorUserId,
        meta={"newStatus": p.newStatus, "reason": p.comment},
    )


async def _handle_workflow_revision(p: WorkflowRevisionRequestedPayload) -> None:
    await db_service.create_audit_log(
        entity_type="Request",
        entity_id=p.requestId,
        action_type="UPDATE",
        description=f"Revision requested. Note: {p.comment or 'N/A'}",
        actor_user_id=p.actorUserId,
        meta={"newStatus": p.newStatus, "note": p.comment},
    )

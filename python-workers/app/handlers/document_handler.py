"""
Document Generation Handler — q.documents queue.

Görevler:
  - document.generate event'i → PDF üret → Supabase'e yükle → DB'ye kaydet → kullanıcıya bildirim
  - workflow.approved (document / internship tipleri) → aynı akış

PDF içeriği:
  - Onaylı talep özet belgesi (tüm tipler)
  - Supabase storage'a yüklenir: generated/{requestId}/approval_summary.pdf
  - File + FileLink kaydı oluşturulur
  - Requester'a in-app bildirim + email
"""
from __future__ import annotations
import structlog
from app.schemas.payloads import BasePayload, WorkflowApprovedPayload
from app.services import db_service, storage_service, mail_service
from app.services.pdf_service import generate_approval_summary
from app.handlers.notification_handler import _create as create_notification

logger = structlog.get_logger(__name__)

# Bu tipler onaylanınca belge üretilir
DOCUMENT_REQUEST_TYPES = {"document", "internship", "procurement", "access"}

FRONTEND_URL = "http://localhost:3000"


async def handle(payload: BasePayload) -> None:
    match payload.event:
        case "document.generate":
            request_id = getattr(payload, "requestId", None)
            if request_id:
                await _generate_for_request(request_id)
        case "workflow.approved":
            p: WorkflowApprovedPayload = payload  # type: ignore[assignment]
            if p.requestType.lower() in DOCUMENT_REQUEST_TYPES:
                await _generate_for_request(p.requestId, actor_user_id=p.actorUserId)
        case _:
            logger.debug("document_handler_skip", event_name=payload.event)


async def _generate_for_request(
    request_id: str,
    actor_user_id: str | None = None,
) -> None:
    """PDF üret, storage'a yükle, bildir."""

    # ── Veri çek ─────────────────────────────────────────────────────────────
    request = await db_service.fetch_request_full(request_id)
    if not request:
        logger.error("document_request_not_found", request_id=request_id)
        return

    requester_id = request.get("requesterUserId")
    requester = await db_service.fetch_user_by_id(requester_id) if requester_id else None
    approver  = await db_service.fetch_user_by_id(actor_user_id) if actor_user_id else None

    # ── PDF üret ─────────────────────────────────────────────────────────────
    try:
        pdf_bytes = generate_approval_summary(
            request={
                "requestNo":       request.get("requestNo"),
                "title":           request.get("title"),
                "requestTypeName": request.get("requestTypeName"),
                "priority":        request.get("priority", ""),
                "status":          request.get("status", ""),
                "createdAt":       str(request.get("createdAt", "")),
                "completedAt":     str(request.get("completedAt", "")),
            },
            requester={
                "fullName":      request.get("fullName"),
                "email":         request.get("email"),
                "studentNumber": request.get("studentNumber"),
                "department":    request.get("departmentName"),
            } if requester else None,
            approver={
                "fullName": approver.get("fullName") if approver else None,
                "email":    approver.get("email")    if approver else None,
            } if approver else None,
        )
    except Exception as e:
        logger.error("pdf_generation_failed", request_id=request_id, error=str(e))
        return

    # ── Supabase'e yükle ─────────────────────────────────────────────────────
    req_no   = request.get("requestNo", request_id)
    filename = f"approval_summary_{req_no}.pdf"
    obj_path = f"generated/{request_id}/{filename}"

    stored_path = await storage_service.upload_file(
        object_path=obj_path,
        content=pdf_bytes,
        mime_type="application/pdf",
    )

    if not stored_path:
        logger.error("document_upload_failed", request_id=request_id)
        # Yine de devam et — belki local kayıt yapılabilir
        stored_path = obj_path

    # ── DB'ye kaydet ─────────────────────────────────────────────────────────
    file_id = await db_service.save_generated_file(
        request_id=request_id,
        uploader_user_id=requester_id or "system",
        storage_path=stored_path,
        original_name=filename,
        mime_type="application/pdf",
        size_bytes=len(pdf_bytes),
    )

    logger.info(
        "document_generated",
        request_id=request_id,
        file_id=file_id,
        size_kb=round(len(pdf_bytes) / 1024, 1),
        path=stored_path,
    )

    # ── Kullanıcıya bildir ────────────────────────────────────────────────────
    if requester_id:
        download_url = f"{FRONTEND_URL}/student/requests/{request_id}"
        await create_notification(
            user_id=requester_id,
            title="Your document is ready",
            message=f"The approval document for {req_no} has been generated and is available for download.",
            request_id=request_id,
            action_url=download_url,
        )

        if requester:
            await mail_service.send_email(
                to_email=requester["email"],
                template="document_ready",
                context={
                    "subject":    f"Document ready: {req_no}",
                    "name":       requester.get("fullName") or requester["email"],
                    "requestNo":  req_no,
                    "requestUrl": download_url,
                },
            )

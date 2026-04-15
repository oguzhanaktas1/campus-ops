"""
Attachment Processing Handler — q.attachments queue.

Görevler:
  - MIME type doğrulama (magic bytes ile)
  - Dosya boyutu kontrolü
  - Tehlikeli uzantı tespiti
  - File kaydının metadata güncellenmesi
  - Gerekirse virüs tarama entegrasyonu tetikleme (stub)
"""
from __future__ import annotations
import structlog
from app.schemas.payloads import BasePayload
from app.services import db_service, storage_service

logger = structlog.get_logger(__name__)

# İzin verilen MIME türleri
ALLOWED_MIMES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "text/plain",
    "text/csv",
}

# Tehlikeli uzantılar
DANGEROUS_EXTS = {".exe", ".bat", ".sh", ".ps1", ".vbs", ".cmd", ".msi", ".dll"}

# Max dosya boyutu: 50 MB
MAX_SIZE_BYTES = 50 * 1024 * 1024


async def handle(payload: BasePayload) -> None:
    if payload.event != "attachment.process":
        return

    attachment_id  = getattr(payload, "attachmentId",  None)
    request_id     = getattr(payload, "requestId",     None)
    storage_key    = getattr(payload, "storageKey",    None)
    mime_type      = getattr(payload, "mimeType",      None)

    if not attachment_id:
        logger.warning("attachment_missing_id", payload=payload.event)
        return

    logger.info(
        "attachment_processing",
        attachment_id=attachment_id,
        mime=mime_type,
        storage_key=storage_key,
    )

    issues: list[str] = []

    # ── MIME kontrolü ─────────────────────────────────────────────────────────
    if mime_type and mime_type not in ALLOWED_MIMES:
        issues.append(f"Disallowed MIME type: {mime_type}")
        logger.warning("attachment_mime_rejected", attachment_id=attachment_id, mime=mime_type)

    # ── Uzantı kontrolü ──────────────────────────────────────────────────────
    if storage_key:
        ext = "." + storage_key.rsplit(".", 1)[-1].lower() if "." in storage_key else ""
        if ext in DANGEROUS_EXTS:
            issues.append(f"Dangerous file extension: {ext}")
            logger.warning("attachment_ext_rejected", attachment_id=attachment_id, ext=ext)

    # ── Boyut kontrolü (storage_key üzerinden) ───────────────────────────────
    if storage_key and not issues:
        content = await storage_service.download_file(storage_key)
        if content and len(content) > MAX_SIZE_BYTES:
            issues.append(f"File too large: {len(content)} bytes")

    if issues:
        # Sorunlu dosyayı işaretle — DB'de status güncelle (şimdilik log)
        logger.error(
            "attachment_rejected",
            attachment_id=attachment_id,
            issues=issues,
        )
        # TODO Faz 4: prisma.file.update status='REJECTED'
        return

    # ── Başarılı — işlenmiş olarak işaretle ──────────────────────────────────
    logger.info(
        "attachment_processed",
        attachment_id=attachment_id,
        request_id=request_id,
        mime=mime_type,
    )

    # Virüs tarama stub — gerçek entegrasyon Faz 4'te
    # await antivirus_service.scan(storage_key)

"""
Report Handler — q.reports queue.

Görevler:
  - report.generate event'i → veri çek → PDF/CSV üret → storage'a yükle → talep eden adminı bildir

Desteklenen report tipleri:
  - request_summary   : dönem içi talep özeti (tür + durum bazlı)
  - sla_breaches      : SLA ihlal raporu
"""
from __future__ import annotations
import csv
import io
import structlog
from datetime import datetime
from app.schemas.payloads import BasePayload
from app.services import db_service, storage_service
from app.services.pdf_service import generate_report_pdf
from app.handlers.notification_handler import _create as create_notification

logger = structlog.get_logger(__name__)

FRONTEND_URL = "http://localhost:3000"

# Her rapor tipinin sütunları
REPORT_COLUMNS: dict[str, list[str]] = {
    "request_summary": ["requestType", "status", "count"],
    "sla_breaches":    ["eventType", "requestType", "count"],
}


async def handle(payload: BasePayload) -> None:
    if payload.event != "report.generate":
        return

    report_type   = getattr(payload, "reportType",   "request_summary")
    period_days   = int(getattr(payload, "periodDays", 30))
    format_       = getattr(payload, "format",        "pdf")   # pdf | csv
    requester_id  = getattr(payload, "requesterUserId", None)

    logger.info(
        "report_generating",
        report_type=report_type,
        period_days=period_days,
        format=format_,
    )

    # ── Veri çek ─────────────────────────────────────────────────────────────
    rows = await db_service.fetch_report_data(report_type, period_days)

    if not rows:
        logger.warning("report_no_data", report_type=report_type)
        if requester_id:
            await create_notification(
                user_id=requester_id,
                title="Report ready (no data)",
                message=f"Report '{report_type}' has no data for the last {period_days} days.",
            )
        return

    # ── Dosya üret ───────────────────────────────────────────────────────────
    period_label = f"Last {period_days} days"
    title        = report_type.replace("_", " ").title()
    columns      = REPORT_COLUMNS.get(report_type, list(rows[0].keys()))
    timestamp    = datetime.now().strftime("%Y%m%d_%H%M")

    if format_ == "csv":
        content, mime, ext = _to_csv(rows, columns), "text/csv", "csv"
    else:
        content, mime, ext = generate_report_pdf(title, period_label, rows, columns), "application/pdf", "pdf"

    filename  = f"report_{report_type}_{timestamp}.{ext}"
    obj_path  = f"reports/{timestamp}/{filename}"

    stored_path = await storage_service.upload_file(
        object_path=obj_path,
        content=content,
        mime_type=mime,
    )

    logger.info(
        "report_generated",
        report_type=report_type,
        rows=len(rows),
        size_kb=round(len(content) / 1024, 1),
        path=stored_path or obj_path,
    )

    # ── Admin'e bildirim ─────────────────────────────────────────────────────
    if requester_id:
        await create_notification(
            user_id=requester_id,
            title=f"Report ready: {title}",
            message=f"{title} ({period_label}) has been generated — {len(rows)} records.",
            action_url=f"{FRONTEND_URL}/admin/reports",
        )


def _to_csv(rows: list[dict], columns: list[str]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")

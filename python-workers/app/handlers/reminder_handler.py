"""
Reminder / SLA Handler — q.reminders queue + arka plan tarama.

Yaklaşım:
  1. reminder.schedule event'i gelince:
     - Redis Sorted Set'e ekle (score = Unix timestamp)
     - DB'ye reminder kaydı yaz

  2. Arka plan görevi (background_sweep) her 60 saniyede:
     - Sorted Set'ten vadesi gelmiş reminder'ları al
     - Her biri için notification + email tetikle
"""
from __future__ import annotations
import asyncio
import json
import time
import structlog
from app.schemas.payloads import BasePayload, ReminderSchedulePayload, SlaCheckPayload
from app.services import db_service, redis_service
from app.handlers import notification_handler, email_handler
from app.schemas.payloads import NotificationCreatePayload, EmailSendPayload

logger = structlog.get_logger(__name__)

REDIS_REMINDER_ZSET = "mq:reminders:scheduled"


async def handle(payload: BasePayload) -> None:
    match payload.event:
        case "reminder.schedule":
            await _handle_schedule(payload)  # type: ignore[arg-type]
        case "sla.check":
            await _handle_sla(payload)       # type: ignore[arg-type]
        case _:
            logger.debug("reminder_handler_skip", event=payload.event)


async def _handle_schedule(p: ReminderSchedulePayload) -> None:
    """Reminder'ı Redis sorted set'e ekle."""
    from datetime import datetime, timezone
    try:
        scheduled_ts = datetime.fromisoformat(
            p.scheduledAt.replace("Z", "+00:00")
        ).timestamp()
    except ValueError:
        scheduled_ts = time.time() + 3600  # fallback: 1 saat sonra

    client = await redis_service.get_client()
    data = json.dumps({
        "requestId":    p.requestId,
        "targetUserId": p.targetUserId,
        "reminderType": p.reminderType,
        "correlationId": p.correlationId,
    })
    await client.zadd(REDIS_REMINDER_ZSET, {data: scheduled_ts})

    await db_service.create_reminder_record(
        request_id=p.requestId,
        target_user_id=p.targetUserId,
        reminder_type=p.reminderType,
        scheduled_at=p.scheduledAt,
    )
    logger.info(
        "reminder_queued",
        request_id=p.requestId,
        user=p.targetUserId,
        reminder_type=p.reminderType,
        scheduled_at=p.scheduledAt,
    )


async def _handle_sla(p: SlaCheckPayload) -> None:
    """SLA check — şimdilik log; Faz 3'te eskalasyon."""
    logger.info("sla_check_reminder_worker", request_id=p.requestId, check_type=p.checkType)


# ─── Arka plan tarama görevi ──────────────────────────────────────────────────

async def background_sweep(stop_event: asyncio.Event) -> None:
    """
    Her 60 saniyede vadesi gelmiş reminder'ları işle.
    main.py'da asyncio.create_task() ile başlatılır.
    """
    logger.info("reminder_sweep_started")
    while not stop_event.is_set():
        try:
            await _process_due_reminders()
        except Exception as e:
            logger.error("reminder_sweep_error", error=str(e))
        await asyncio.sleep(60)
    logger.info("reminder_sweep_stopped")


async def _process_due_reminders() -> None:
    """Vadesi gelmiş reminder'ları Redis'ten al ve işle."""
    client = await redis_service.get_client()
    now_ts = time.time()

    # Skoru now_ts'e kadar olan tüm entry'leri al
    due_items = await client.zrangebyscore(
        REDIS_REMINDER_ZSET, min="-inf", max=str(now_ts)
    )
    if not due_items:
        return

    logger.info("reminder_sweep_due_count", count=len(due_items))

    for item_str in due_items:
        try:
            item = json.loads(item_str)
            request_id  = item["requestId"]
            user_id     = item["targetUserId"]
            reminder_type = item["reminderType"]

            # Idempotency
            idem_key = f"reminder:fired:{request_id}:{reminder_type}"
            if await redis_service.is_processed(idem_key, ttl_seconds=7 * 24 * 3600):
                await client.zrem(REDIS_REMINDER_ZSET, item_str)
                continue

            # Request hâlâ açık mı?
            request = await db_service.fetch_request_by_id(request_id)
            if request and request["status"] in ("COMPLETED", "CLOSED", "CANCELLED", "REJECTED"):
                await client.zrem(REDIS_REMINDER_ZSET, item_str)
                continue

            req_no = request["requestNo"] if request else request_id

            # In-app bildirim
            await notification_handler._create(
                user_id=user_id,
                title="Reminder: Action required",
                message=f"Request {req_no} is awaiting your action ({reminder_type}).",
                request_id=request_id,
            )

            # Email
            user = await db_service.fetch_user_by_id(user_id)
            if user:
                from app.services import mail_service
                await mail_service.send_email(
                    to_email=user["email"],
                    template="reminder",
                    context={
                        "subject":      f"Reminder: Action needed on {req_no}",
                        "name":         user.get("fullName") or user["email"],
                        "requestNo":    req_no,
                        "reminderType": reminder_type,
                        "requestUrl":   f"http://localhost:3000/staff/requests/{request_id}",
                        "year":         __import__("datetime").datetime.now().year,
                    },
                )

            await client.zrem(REDIS_REMINDER_ZSET, item_str)
            logger.info(
                "reminder_fired",
                request_id=request_id,
                user_id=user_id,
                reminder_type=reminder_type,
            )

        except Exception as e:
            logger.error("reminder_item_error", error=str(e), item=item_str[:100])

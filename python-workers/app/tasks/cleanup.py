"""
Periyodik temizlik görevi — her gece 03:00'te çalışır.

Temizlenenler:
  - ProcessedEvent  → 90 günden eski kayıtlar
  - Redis sorted set q:reminders:scheduled → işlenmiş entry'ler
"""
from __future__ import annotations
import asyncio
import structlog
from datetime import datetime, timezone
from app.services.idempotency_service import purge_old_processed_events
from app.services.redis_service import get_client as get_redis

logger = structlog.get_logger(__name__)

CLEANUP_INTERVAL_HOURS = 24


async def cleanup_loop(stop_event: asyncio.Event) -> None:
    logger.info("cleanup_loop_started", interval_hours=CLEANUP_INTERVAL_HOURS)
    while not stop_event.is_set():
        try:
            await _run_cleanup()
        except Exception as e:
            logger.error("cleanup_loop_error", error=str(e))
        # 24 saat bekle (stop_event ile erken çıkış)
        try:
            await asyncio.wait_for(
                asyncio.shield(stop_event.wait()),
                timeout=CLEANUP_INTERVAL_HOURS * 3600,
            )
        except asyncio.TimeoutError:
            pass  # Normal — 24 saat doldu


async def _run_cleanup() -> None:
    now = datetime.now(timezone.utc).isoformat()
    logger.info("cleanup_run_start", at=now)

    # 1. ProcessedEvent tablosu
    deleted_events = await purge_old_processed_events()

    # 2. Redis ZSET — score'u 30 gün önceden küçük olan entry'leri sil
    import time
    cutoff = time.time() - 30 * 24 * 3600
    try:
        redis = await get_redis()
        removed = await redis.zremrangebyscore("mq:reminders:scheduled", "-inf", str(cutoff))
        logger.info("cleanup_redis_reminders", removed=removed)
    except Exception as e:
        logger.warning("cleanup_redis_failed", error=str(e))
        removed = 0

    logger.info(
        "cleanup_run_done",
        processed_events_deleted=deleted_events,
        redis_reminders_removed=removed,
    )

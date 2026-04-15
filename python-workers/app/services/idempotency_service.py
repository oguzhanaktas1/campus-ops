"""
Advanced Idempotency — iki katmanlı kontrol:
  1. Redis (hızlı, TTL bazlı)
  2. PostgreSQL ProcessedEvent tablosu (kalıcı, restart-safe)

Katmanlar:
  - Redis önce kontrol edilir (< 1ms)
  - Redis miss ise DB kontrol edilir
  - Her iki katmana da yazar (dual-write)

Kullanım:
  guard = IdempotencyGuard(queue_name="q.notifications")
  if await guard.is_processed(correlation_id):
      return  # zaten işlendi
  # ... işi yap ...
  await guard.mark_processed(correlation_id)
"""
from __future__ import annotations
import asyncio
import structlog
from app.services.redis_service import get_client as get_redis
from app.services.db_service import get_pool

logger = structlog.get_logger(__name__)

# Redis TTL: 30 gün
REDIS_TTL = 30 * 24 * 3600
# DB temizlik: 90 günden eski kayıtlar silinir
DB_PURGE_DAYS = 90


class IdempotencyGuard:
    def __init__(self, queue_name: str) -> None:
        self.queue = queue_name

    def _redis_key(self, correlation_id: str) -> str:
        return f"idem:{self.queue}:{correlation_id}"

    async def is_processed(self, correlation_id: str, ttl_seconds: int = REDIS_TTL) -> bool:
        """
        True döndürürse → zaten işlendi, atla.
        False döndürürse → ilk kez, işle.
        """
        if not correlation_id:
            return False

        # ── Katman 1: Redis ────────────────────────────────────────────────
        try:
            redis = await get_redis()
            if await redis.exists(self._redis_key(correlation_id)):
                logger.debug("idempotency_redis_hit", cid=correlation_id, queue=self.queue)
                return True
        except Exception as e:
            logger.warning("idempotency_redis_check_failed", error=str(e))

        # ── Katman 2: PostgreSQL ───────────────────────────────────────────
        try:
            pool = await get_pool()
            row = await pool.fetchrow(
                """
                SELECT id FROM "ProcessedEvent"
                WHERE "correlationId" = $1 AND queue = $2
                """,
                correlation_id, self.queue,
            )
            if row:
                # Redis'e de yaz (cache warming)
                try:
                    redis = await get_redis()
                    await redis.set(
                        self._redis_key(correlation_id), "1", ex=REDIS_TTL
                    )
                except Exception:
                    pass
                logger.debug("idempotency_db_hit", cid=correlation_id, queue=self.queue)
                return True
        except Exception as e:
            # ProcessedEvent tablosu yoksa (henüz migration yapılmadı) geç
            logger.warning("idempotency_db_check_failed", error=str(e))

        return False

    async def mark_processed(self, correlation_id: str) -> None:
        """İşlenmiş olarak her iki katmana da yaz."""
        if not correlation_id:
            return

        # Redis
        try:
            redis = await get_redis()
            await redis.set(self._redis_key(correlation_id), "1", ex=REDIS_TTL)
        except Exception as e:
            logger.warning("idempotency_redis_write_failed", error=str(e))

        # PostgreSQL
        try:
            pool = await get_pool()
            await pool.execute(
                """
                INSERT INTO "ProcessedEvent" ("correlationId", queue, "processedAt")
                VALUES ($1, $2, NOW())
                ON CONFLICT ("correlationId", queue) DO NOTHING
                """,
                correlation_id, self.queue,
            )
        except Exception as e:
            # Tablo yoksa sadece Redis ile devam et
            logger.debug("idempotency_db_write_skipped", error=str(e))


async def purge_old_processed_events() -> int:
    """90 günden eski ProcessedEvent kayıtlarını temizle."""
    try:
        pool = await get_pool()
        result = await pool.execute(
            """
            DELETE FROM "ProcessedEvent"
            WHERE "processedAt" < NOW() - INTERVAL '$1 days'
            """,
            DB_PURGE_DAYS,
        )
        count = int(result.split()[-1]) if result else 0
        logger.info("idempotency_purge_done", deleted=count)
        return count
    except Exception as e:
        logger.warning("idempotency_purge_failed", error=str(e))
        return 0

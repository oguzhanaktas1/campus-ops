"""
Redis — idempotency key yönetimi ve unread count cache.
"""
import redis.asyncio as aioredis
import structlog
from app.config.settings import settings

logger = structlog.get_logger(__name__)

_client: aioredis.Redis | None = None


async def get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
    return _client


async def close_client() -> None:
    global _client
    if _client:
        await _client.aclose()
        _client = None


# ─── Idempotency ──────────────────────────────────────────────────────────────

async def is_processed(idempotency_key: str, ttl_seconds: int = 86400) -> bool:
    """
    Aynı mesajın iki kez işlenmesini engeller.
    Daha önce işlendiyse True, ilk kez işleniyorsa False döner.
    """
    client = await get_client()
    key = f"mq:processed:{idempotency_key}"
    result = await client.set(key, "1", nx=True, ex=ttl_seconds)
    # SET NX: key yoksa set eder ve True döner → ilk kez işleniyor
    return result is None  # None: zaten vardı → tekrar işleme


# ─── Unread notification count ────────────────────────────────────────────────

async def increment_unread_count(user_id: str) -> None:
    """Kullanıcının okunmamış bildirim sayacını artır."""
    client = await get_client()
    key = f"notif:unread:{user_id}"
    try:
        await client.incr(key)
    except Exception as e:
        logger.warning("redis_incr_failed", key=key, error=str(e))

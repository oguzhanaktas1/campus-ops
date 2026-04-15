"""
Campus Ops — Python Worker Service  (Faz 1 + 2 + 3 + 4)

Consumers (8):
  q.notifications  q.emails  q.workflow  q.reminders
  q.audit  q.attachments  q.documents  q.reports

Background tasks:
  reminder_sweep   — her 60s vadesi gelen reminder'ları tetikler
  cleanup_loop     — her 24s ProcessedEvent + Redis ZSET temizler
  metrics_server   — :8000/metrics Prometheus
  health_server    — :8001/health  liveness | /ready  readiness

Başlatmak için:
  python -m app.main
"""
from __future__ import annotations
import asyncio, signal, structlog
from app.config.logging import configure_logging
from app.services.rabbitmq_service import RabbitmqService
from app.services.db_service import close_pool, get_pool
from app.services.redis_service import close_client, get_client as get_redis
from app.consumers import notification_consumer
from app.consumers import email_consumer
from app.consumers import workflow_consumer
from app.consumers import reminder_consumer
from app.consumers import audit_consumer
from app.consumers import attachment_consumer
from app.consumers import document_consumer
from app.consumers import report_consumer
from app.handlers.reminder_handler import background_sweep
from app.tasks.cleanup import cleanup_loop
from app.metrics import start_metrics_server
from app.health import run_in_background as start_health_server, set_state

configure_logging()
logger = structlog.get_logger(__name__)


async def _check_readiness() -> None:
    """Bağlantıları kontrol et ve health state'i güncelle."""
    # DB
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        set_state(db=True)
    except Exception as e:
        logger.warning("db_not_ready", error=str(e))
        set_state(db=False)

    # Redis
    try:
        redis = await get_redis()
        await redis.ping()
        set_state(redis=True)
    except Exception as e:
        logger.warning("redis_not_ready", error=str(e))
        set_state(redis=False)


async def main() -> None:
    stop_event = asyncio.Event()

    # ── Health check server (thread) ─────────────────────────────────────────
    start_health_server(port=8001)

    logger.info("worker_starting", queues=8)

    # ── RabbitMQ bağlan ───────────────────────────────────────────────────────
    mq = RabbitmqService()
    await mq.connect()
    set_state(rabbitmq=True)

    # ── DB + Redis hazır mı kontrol et ───────────────────────────────────────
    await _check_readiness()

    # ── Consumer'ları başlat ──────────────────────────────────────────────────
    await mq.consume(notification_consumer.QUEUE,  notification_consumer.process)
    await mq.consume(email_consumer.QUEUE,         email_consumer.process)
    await mq.consume(workflow_consumer.QUEUE,      workflow_consumer.process)
    await mq.consume(reminder_consumer.QUEUE,      reminder_consumer.process)
    await mq.consume(audit_consumer.QUEUE,         audit_consumer.process)
    await mq.consume(attachment_consumer.QUEUE,    attachment_consumer.process)
    await mq.consume(document_consumer.QUEUE,      document_consumer.process)
    await mq.consume(report_consumer.QUEUE,        report_consumer.process)

    # ── Arka plan görevleri ───────────────────────────────────────────────────
    tasks = [
        asyncio.create_task(background_sweep(stop_event), name="reminder_sweep"),
        asyncio.create_task(cleanup_loop(stop_event),     name="cleanup_loop"),
        asyncio.create_task(start_metrics_server(stop_event), name="metrics_server"),
    ]

    logger.info("workers_ready", queues=8,
                health="http://localhost:8001/health",
                metrics="http://localhost:8000/metrics")

    # ── Graceful shutdown ─────────────────────────────────────────────────────
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            pass  # Windows

    await stop_event.wait()
    logger.info("worker_shutting_down")
    set_state(rabbitmq=False, db=False, redis=False)

    for task in tasks:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    await mq.close()
    await close_pool()
    await close_client()
    logger.info("worker_stopped")


if __name__ == "__main__":
    asyncio.run(main())

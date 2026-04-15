from __future__ import annotations
import json, time
import structlog
from aio_pika.abc import AbstractIncomingMessage
from app.schemas.payloads import parse_payload
from app.handlers import workflow_handler
from app.services.idempotency_service import IdempotencyGuard
from app.metrics import messages_processed, processing_time

logger = structlog.get_logger(__name__)
QUEUE  = "q.workflow"
_guard = IdempotencyGuard(QUEUE)


async def process(message: AbstractIncomingMessage) -> None:
    async with message.process(requeue=False):
        t0 = time.perf_counter()
        try:
            data    = json.loads(message.body.decode())
            payload = parse_payload(data)
            cid     = payload.correlationId or message.message_id or ""

            if cid and await _guard.is_processed(cid):
                messages_processed.labels(queue=QUEUE, status="skipped").inc()
                return

            await workflow_handler.handle(payload)

            if cid:
                await _guard.mark_processed(cid)

            messages_processed.labels(queue=QUEUE, status="success").inc()
        except Exception as exc:
            messages_processed.labels(queue=QUEUE, status="error").inc()
            logger.error("workflow_consumer_error", error=str(exc),
                         body=message.body.decode()[:200])
            raise
        finally:
            processing_time.labels(queue=QUEUE).observe(time.perf_counter() - t0)

"""
RabbitMQ bağlantı ve channel yönetimi.
aio-pika kullanılıyor — async, auto-reconnect destekli.
"""
import asyncio
from typing import Callable, Awaitable
import aio_pika
import structlog
from aio_pika.abc import AbstractIncomingMessage
from app.config.settings import settings

logger = structlog.get_logger(__name__)

# ─── Sabitler ─────────────────────────────────────────────────────────────────
EXCHANGE        = "campusops.events"
DEADLETTER_QUEUE= "q.deadletter"

QUEUE_BINDINGS: dict[str, list[str]] = {
    "q.notifications": ["workflow.*", "notification.create", "request.created"],
    "q.emails":        ["email.send", "workflow.*", "reminder.schedule"],
    "q.workflow":      ["request.created", "workflow.assigned", "workflow.approved",
                        "workflow.revision_requested", "sla.check"],
    "q.reminders":     ["reminder.schedule", "sla.check"],
    "q.attachments":   ["attachment.process"],
    "q.documents":     ["document.generate", "workflow.approved"],
    "q.reports":       ["report.generate"],
    "q.audit":         ["audit.append", "request.*", "workflow.*"],
}

MessageHandler = Callable[[AbstractIncomingMessage], Awaitable[None]]


class RabbitmqService:
    def __init__(self) -> None:
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._exchange: aio_pika.abc.AbstractExchange | None = None

    async def connect(self) -> None:
        """Bağlan, topology'yi kur."""
        self._connection = await aio_pika.connect_robust(
            settings.rabbitmq_url,
            reconnect_interval=10,
        )
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=10)

        # Exchange
        self._exchange = await self._channel.declare_exchange(
            EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True
        )

        # Dead-letter queue
        await self._channel.declare_queue(DEADLETTER_QUEUE, durable=True)

        # Ana queue'lar + binding'ler
        for queue_name, patterns in QUEUE_BINDINGS.items():
            queue = await self._channel.declare_queue(
                queue_name,
                durable=True,
                arguments={
                    "x-dead-letter-exchange": "",
                    "x-dead-letter-routing-key": DEADLETTER_QUEUE,
                    "x-message-ttl": 7 * 24 * 60 * 60 * 1000,  # 7 gün
                },
            )
            for pattern in patterns:
                await queue.bind(self._exchange, routing_key=pattern)

        logger.info("rabbitmq_connected", exchange=EXCHANGE)

    async def consume(self, queue_name: str, handler: MessageHandler) -> None:
        """Belirtilen queue'yu dinle."""
        if not self._channel:
            raise RuntimeError("RabbitMQ not connected")

        queue = await self._channel.get_queue(queue_name)
        await queue.consume(handler)
        logger.info("consumer_started", queue=queue_name)

    async def close(self) -> None:
        if self._connection:
            await self._connection.close()

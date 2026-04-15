"""
Prometheus metrics — :8000/metrics endpoint'i.

Metrikler:
  campusops_messages_processed_total{queue, status}
  campusops_notifications_created_total
  campusops_emails_sent_total{status}
  campusops_documents_generated_total
  campusops_reminders_fired_total
  campusops_message_processing_seconds{queue}
"""
from __future__ import annotations
import asyncio
import structlog
from prometheus_client import (
    Counter, Histogram, start_http_server,
    CONTENT_TYPE_LATEST, generate_latest,
)

logger = structlog.get_logger(__name__)

# ── Metrik tanımlamaları ──────────────────────────────────────────────────────

messages_processed = Counter(
    "campusops_messages_processed_total",
    "Total RabbitMQ messages processed",
    ["queue", "status"],  # status: success | error | skipped
)

notifications_created = Counter(
    "campusops_notifications_created_total",
    "Total in-app notifications created",
)

emails_sent = Counter(
    "campusops_emails_sent_total",
    "Total emails attempted",
    ["status"],  # sent | failed
)

documents_generated = Counter(
    "campusops_documents_generated_total",
    "Total PDFs generated",
)

reminders_fired = Counter(
    "campusops_reminders_fired_total",
    "Total scheduled reminders fired",
)

processing_time = Histogram(
    "campusops_message_processing_seconds",
    "Message processing time in seconds",
    ["queue"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)


# ── Metrics server ────────────────────────────────────────────────────────────

async def start_metrics_server(stop_event: asyncio.Event, port: int = 8000) -> None:
    """
    Prometheus scrape endpoint'ini başlat.
    prometheus_client'ın start_http_server'ı blocking olduğu için
    asyncio.to_thread ile sarılıyor.
    """
    try:
        await asyncio.to_thread(_start_blocking, port)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error("metrics_server_error", error=str(e))


def _start_blocking(port: int) -> None:
    start_http_server(port)
    logger.info("metrics_server_started", port=port, endpoint=f"http://localhost:{port}/metrics")

"""
Health Check HTTP server — port 8001

GET /health  → liveness probe (process çalışıyor mu?)
GET /ready   → readiness probe (RabbitMQ + DB + Redis bağlantısı var mı?)

Docker / Kubernetes:
  livenessProbe:  GET http://workers:8001/health
  readinessProbe: GET http://workers:8001/ready
"""
from __future__ import annotations
import asyncio
import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
import structlog

logger = structlog.get_logger(__name__)

_start_time = time.time()

# Bağlantı durumunu dışarıdan set eder (main.py)
_state = {
    "rabbitmq": False,
    "db":       False,
    "redis":    False,
}


def set_state(**kwargs: bool) -> None:
    _state.update(kwargs)


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):  # suppress default HTTP logs
        pass

    def _json(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {
                "status": "ok",
                "uptime_seconds": round(time.time() - _start_time, 1),
            })
        elif self.path == "/ready":
            all_ready = all(_state.values())
            body = {"status": "ready" if all_ready else "not_ready", "checks": _state}
            self._json(200 if all_ready else 503, body)
        else:
            self._json(404, {"error": "not found"})


def start_health_server(port: int = 8001) -> None:
    """Blocking — Thread içinde çalıştır."""
    server = HTTPServer(("0.0.0.0", port), _Handler)
    logger.info("health_server_started", port=port)
    server.serve_forever()


def run_in_background(port: int = 8001) -> Thread:
    t = Thread(target=start_health_server, args=(port,), daemon=True)
    t.start()
    return t

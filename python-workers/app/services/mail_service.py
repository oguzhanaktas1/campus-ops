"""
Email gönderim servisi — Resend API + Jinja2 şablonları.
"""
from __future__ import annotations
from datetime import datetime
from pathlib import Path

import httpx
import structlog
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config.settings import settings

logger = structlog.get_logger(__name__)

TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "email"
RESEND_URL   = "https://api.resend.com/emails"

_jinja_env: Environment | None = None


def _get_jinja_env() -> Environment:
    global _jinja_env
    if _jinja_env is None:
        _jinja_env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=select_autoescape(["html"]),
        )
    return _jinja_env


def _render(template_name: str, context: dict) -> tuple[str, str]:
    """(subject, html_body) döndürür."""
    env = _get_jinja_env()
    ctx = {"year": datetime.now().year, **context}
    try:
        tmpl  = env.get_template(f"{template_name}.html")
        html  = tmpl.render(**ctx)
        subject = context.get("subject", "CampusFlow Notification")
        return subject, html
    except Exception:
        subject = context.get("subject", "CampusFlow Notification")
        html    = f"<p>{context.get('message', '')}</p>"
        return subject, html


async def send_email(
    to_email: str,
    template: str,
    context: dict,
) -> bool:
    """
    Resend API üzerinden email gönder.
    API key yoksa geliştirme ortamında loglayıp True döner.
    """
    if not settings.resend_api_key:
        logger.warning("resend_not_configured", to=to_email, template=template)
        return True

    subject, html_body = _render(template, context)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                RESEND_URL,
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type":  "application/json",
                },
                json={
                    "from":    settings.resend_from,
                    "to":      [to_email],
                    "subject": subject,
                    "html":    html_body,
                },
            )

        if resp.status_code in (200, 201):
            data = resp.json()
            email_id = data.get("id", "unknown")
            print(f"[RESEND ✓] to={to_email} | template={template} | subject={subject!r} | id={email_id} | status={resp.status_code}")
            logger.info("email_sent", to=to_email, template=template,
                        subject=subject, resend_id=email_id, http_status=resp.status_code)
            return True
        else:
            print(f"[RESEND ✗] to={to_email} | template={template} | status={resp.status_code} | body={resp.text[:300]}")
            logger.error("email_send_failed", to=to_email, template=template,
                         http_status=resp.status_code, body=resp.text[:300])
            return False

    except Exception as e:
        print(f"[RESEND ✗] to={to_email} | template={template} | error={e}")
        logger.error("email_send_failed", to=to_email, template=template, error=str(e))
        return False


async def send_email_bulk(
    recipients: list[dict],  # [{"email": str, "name": str, ...context}]
    template: str,
    base_context: dict,
) -> int:
    """
    Toplu email gönderimi — event.published gibi durumlarda kullanılır.
    Başarılı gönderim sayısını döner.
    """
    sent = 0
    for r in recipients:
        ctx = {**base_context, "name": r.get("name") or r["email"]}
        ok  = await send_email(r["email"], template, ctx)
        if ok:
            sent += 1
    logger.info("bulk_email_done", template=template, total=len(recipients), sent=sent)
    return sent

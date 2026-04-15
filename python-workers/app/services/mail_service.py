"""
Email gönderim servisi — aiosmtplib + Jinja2 şablonları.
"""
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
import aiosmtplib
import structlog
from jinja2 import Environment, FileSystemLoader, select_autoescape
from app.config.settings import settings

logger = structlog.get_logger(__name__)

# Şablon dizini
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "email"

_jinja_env: Environment | None = None


def _get_jinja_env() -> Environment:
    global _jinja_env
    if _jinja_env is None:
        _jinja_env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=select_autoescape(["html"]),
        )
    return _jinja_env


def _render_template(template_name: str, context: dict) -> tuple[str, str]:
    """(subject, html_body) döndürür."""
    from datetime import datetime
    env = _get_jinja_env()
    ctx = {"year": datetime.now().year, **context}
    try:
        tmpl = env.get_template(f"{template_name}.html")
        html = tmpl.render(**ctx)
        # Konu başlığı şablondan veya context'ten alınır
        subject = context.get("subject", "CampusFlow Notification")
        return subject, html
    except Exception:
        # Şablon yoksa basit fallback
        subject = context.get("subject", "CampusFlow Notification")
        html = f"<p>{context.get('message', '')}</p>"
        return subject, html


async def send_email(
    to_email: str,
    template: str,
    context: dict,
) -> bool:
    """
    Email gönder. Başarılıysa True, hata varsa False döner.
    SMTP ayarları eksikse log yazar ve True döner (geliştirme ortamında kayıp verme).
    """
    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("smtp_not_configured", to=to_email, template=template)
        return True  # Geliştirme: loglayıp geç

    subject, html_body = _render_template(template, context)

    msg = MIMEMultipart("alternative")
    msg["From"]    = settings.smtp_from
    msg["To"]      = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=True,
            timeout=15,
        )
        logger.info("email_sent", to=to_email, template=template, subject=subject)
        return True
    except Exception as e:
        logger.error("email_send_failed", to=to_email, template=template, error=str(e))
        return False

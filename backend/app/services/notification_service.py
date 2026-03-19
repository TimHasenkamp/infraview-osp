import logging
import aiosmtplib
from email.message import EmailMessage
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


async def send_email_alert(to: str, message: str, severity: str):
    if not settings.smtp_host:
        logger.warning("SMTP not configured, skipping email alert")
        return

    msg = EmailMessage()
    msg["From"] = settings.alert_from_email
    msg["To"] = to
    msg["Subject"] = f"[InfraView {severity.upper()}] Alert"
    msg.set_content(message)

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_pass or None,
            start_tls=True,
        )
        logger.info(f"Email alert sent to {to}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")


async def send_webhook_alert(url: str, payload: dict):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            logger.info(f"Webhook alert sent to {url}")
    except Exception as e:
        logger.error(f"Failed to send webhook: {e}")

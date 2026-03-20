import asyncio
import logging
import aiosmtplib
from email.message import EmailMessage
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


async def _retry(coro_fn, retries=MAX_RETRIES, backoff_base=2, label="operation"):
    """Retry an async callable with exponential backoff."""
    for attempt in range(1, retries + 1):
        try:
            await coro_fn()
            return True
        except Exception as e:
            if attempt < retries:
                delay = backoff_base ** attempt
                logger.warning(f"{label} failed (attempt {attempt}/{retries}): {e}. Retrying in {delay}s")
                await asyncio.sleep(delay)
            else:
                logger.error(f"{label} failed after {retries} attempts: {e}")
                return False


async def send_email_alert(to: str, message: str, severity: str) -> bool:
    if not settings.smtp_host:
        logger.warning("SMTP not configured, skipping email alert")
        return False

    msg = EmailMessage()
    msg["From"] = settings.alert_from_email
    msg["To"] = to
    msg["Subject"] = f"[InfraView {severity.upper()}] Alert"
    msg.set_content(message)

    async def _send():
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_pass or None,
            start_tls=True,
            timeout=15,
        )
        logger.info(f"Email alert sent to {to}")

    return await _retry(_send, backoff_base=2, label=f"Email to {to}")


async def send_webhook_alert(url: str, payload: dict) -> bool:
    async def _send():
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            logger.info(f"Webhook alert sent to {url}")

    return await _retry(_send, backoff_base=1, label=f"Webhook to {url}")

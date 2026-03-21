import asyncio
import logging
import aiosmtplib
from email.message import EmailMessage
import httpx
from sqlalchemy import select
from app.config import settings
from app.database import async_session
from app.models import AppSettings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


async def _get_smtp_config() -> dict:
    """Load SMTP settings from DB, fall back to ENV."""
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "alert_from_email"]
    db_vals = {}
    try:
        async with async_session() as session:
            rows = await session.execute(
                select(AppSettings).where(AppSettings.key.in_(keys))
            )
            db_vals = {r.key: r.value for r in rows.scalars().all()}
    except Exception:
        pass

    return {
        "host": db_vals.get("smtp_host") or settings.smtp_host,
        "port": int(db_vals.get("smtp_port") or settings.smtp_port),
        "user": db_vals.get("smtp_user") or settings.smtp_user,
        "password": db_vals.get("smtp_pass") or settings.smtp_pass,
        "from_email": db_vals.get("alert_from_email") or settings.alert_from_email,
    }


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
    smtp = await _get_smtp_config()

    if not smtp["host"]:
        logger.warning("SMTP not configured, skipping email alert")
        return False

    msg = EmailMessage()
    msg["From"] = smtp["from_email"]
    msg["To"] = to
    msg["Subject"] = f"[InfraView {severity.upper()}] Alert"
    msg.set_content(message)

    async def _send():
        await aiosmtplib.send(
            msg,
            hostname=smtp["host"],
            port=smtp["port"],
            username=smtp["user"] or None,
            password=smtp["password"] or None,
            start_tls=True,
            timeout=15,
        )
        logger.info(f"Email alert sent to {to}")

    return await _retry(_send, backoff_base=2, label=f"Email to {to}")


async def send_webhook_alert(url: str, payload: dict) -> bool:
    # Auto-detect Slack/Discord and format accordingly
    body = _format_webhook_payload(url, payload)

    async def _send():
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            logger.info(f"Webhook alert sent to {url}")

    return await _retry(_send, backoff_base=1, label=f"Webhook to {url}")


def _format_webhook_payload(url: str, payload: dict) -> dict:
    severity = payload.get("severity", "warning")
    message = payload.get("message", "")
    server_id = payload.get("server_id", "")
    metric = payload.get("metric", "")
    value = payload.get("value", 0)
    threshold = payload.get("threshold", 0)

    color = 0xFF4444 if severity == "critical" else 0xFFAA00

    # Slack webhook
    if "hooks.slack.com" in url:
        emoji = ":rotating_light:" if severity == "critical" else ":warning:"
        return {
            "text": f"{emoji} *InfraView Alert* [{severity.upper()}]",
            "blocks": [
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"{emoji} *{message}*"},
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Server:*\n{server_id}"},
                        {"type": "mrkdwn", "text": f"*Metric:*\n{metric}"},
                        {"type": "mrkdwn", "text": f"*Value:*\n{value:.1f}%"},
                        {"type": "mrkdwn", "text": f"*Threshold:*\n{threshold}%"},
                    ],
                },
            ],
        }

    # Discord webhook
    if "discord.com/api/webhooks" in url:
        return {
            "embeds": [
                {
                    "title": f"InfraView Alert [{severity.upper()}]",
                    "description": message,
                    "color": color,
                    "fields": [
                        {"name": "Server", "value": server_id, "inline": True},
                        {"name": "Metric", "value": metric, "inline": True},
                        {"name": "Value", "value": f"{value:.1f}%", "inline": True},
                        {"name": "Threshold", "value": f"{threshold}%", "inline": True},
                    ],
                }
            ]
        }

    # Generic webhook (unchanged)
    return payload

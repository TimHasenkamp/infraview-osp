import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy import select, and_
from app.database import async_session
from app.models import AlertRule, AlertEvent
from app.schemas.ws_message import SystemSnapshot
from app.ws.client_handler import broadcast_to_dashboards
from app.services.notification_service import send_email_alert, send_webhook_alert

logger = logging.getLogger(__name__)

_last_fired: dict[int, datetime] = {}
_last_fired_lock = asyncio.Lock()

VALID_OPERATORS = {">", "<"}
VALID_METRICS = {"cpu_percent", "memory_percent", "disk_percent"}


def _get_metric_value(snapshot: SystemSnapshot, metric: str) -> float | None:
    mapping = {
        "cpu_percent": snapshot.cpu.usage_percent,
        "memory_percent": snapshot.memory.usage_percent,
        "disk_percent": snapshot.disk.usage_percent,
    }
    return mapping.get(metric)


async def check_alerts(snapshot: SystemSnapshot):
    async with async_session() as session:
        result = await session.execute(
            select(AlertRule).where(
                AlertRule.enabled == True,
                (AlertRule.server_id == snapshot.agent_id) | (AlertRule.server_id == None),
            )
        )
        rules = result.scalars().all()

    now = datetime.utcnow()

    for rule in rules:
        if rule.metric not in VALID_METRICS:
            logger.warning(f"Alert rule {rule.id} has invalid metric: {rule.metric}, skipping")
            continue

        if rule.operator not in VALID_OPERATORS:
            logger.warning(f"Alert rule {rule.id} has invalid operator: {rule.operator}, skipping")
            continue

        value = _get_metric_value(snapshot, rule.metric)
        if value is None:
            continue

        triggered = (rule.operator == ">" and value > rule.threshold) or (
            rule.operator == "<" and value < rule.threshold
        )

        # Auto-resolve: if metric recovered, resolve open events for this rule+server
        if not triggered:
            await _auto_resolve(rule.id, snapshot.agent_id, value)
            continue

        async with _last_fired_lock:
            last = _last_fired.get(rule.id)
            if last and (now - last) < timedelta(seconds=rule.cooldown_seconds):
                continue
            _last_fired[rule.id] = now

        message = f"{rule.metric} is {value:.1f}% (threshold: {rule.threshold}%) on {snapshot.hostname}"

        async with async_session() as session:
            async with session.begin():
                event = AlertEvent(
                    rule_id=rule.id,
                    server_id=snapshot.agent_id,
                    metric=rule.metric,
                    value=value,
                    threshold=rule.threshold,
                    severity=rule.severity,
                    message=message,
                    fired_at=now,
                )
                session.add(event)

        await broadcast_to_dashboards({
            "type": "alert_event",
            "payload": {
                "rule_id": rule.id,
                "server_id": snapshot.agent_id,
                "metric": rule.metric,
                "value": value,
                "threshold": rule.threshold,
                "severity": rule.severity,
                "message": message,
                "timestamp": now.timestamp(),
            },
        })

        # Send notifications, log failures
        if rule.notify_email:
            success = await send_email_alert(rule.notify_email, message, rule.severity)
            if not success:
                logger.error(f"Email notification failed for alert rule {rule.id}")
        if rule.notify_webhook:
            success = await send_webhook_alert(rule.notify_webhook, {
                "server_id": snapshot.agent_id,
                "metric": rule.metric,
                "value": value,
                "threshold": rule.threshold,
                "severity": rule.severity,
                "message": message,
            })
            if not success:
                logger.error(f"Webhook notification failed for alert rule {rule.id}")

        logger.warning(f"Alert fired: {message}")


async def _auto_resolve(rule_id: int, server_id: str, current_value: float):
    """Resolve open (unresolved) alert events when metric recovers."""
    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                select(AlertEvent).where(
                    and_(
                        AlertEvent.rule_id == rule_id,
                        AlertEvent.server_id == server_id,
                        AlertEvent.resolved == False,
                    )
                )
            )
            open_events = result.scalars().all()
            if not open_events:
                return

            now = datetime.utcnow()
            for event in open_events:
                event.resolved = True
                event.resolved_at = now

            logger.info(f"Auto-resolved {len(open_events)} alert(s) for rule {rule_id} on {server_id} (value: {current_value:.1f}%)")

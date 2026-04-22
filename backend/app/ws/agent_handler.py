import asyncio
import json
import logging
import uuid
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select, delete
from app.database import async_session
from app.models import Server, Metric, Container, AlertRule, AlertEvent
from app.schemas.ws_message import SystemSnapshot
from app.auth import verify_agent_key, verify_ws_token
from app.ws.client_handler import broadcast_to_dashboards
from app.metrics import CONNECTED_AGENTS, METRICS_INGESTED
from app.services.settings_service import get_setting
from app.services.notification_service import send_email_alert, send_webhook_alert, send_gotify_alert, send_telegram_alert

logger = logging.getLogger(__name__)

router = APIRouter()

# Track connected agents: agent_id -> WebSocket
connected_agents: dict[str, WebSocket] = {}

# Track last snapshot time per agent
agent_last_seen: dict[str, float] = {}

# Pending log requests: request_id -> asyncio.Future
pending_log_requests: dict[str, asyncio.Future] = {}

# Pending image requests: request_id -> asyncio.Future
pending_image_requests: dict[str, asyncio.Future] = {}

AGENT_TIMEOUT_SECONDS = 60


@router.websocket("/ws/agent")
async def agent_websocket(websocket: WebSocket):
    # Validate agent API key
    key = websocket.query_params.get("key")
    if not verify_agent_key(key):
        await websocket.close(code=4001, reason="Unauthorized")
        logger.warning(f"Agent connection rejected: invalid API key")
        return

    await websocket.accept()
    agent_id = None
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "snapshot":
                snapshot = SystemSnapshot(**data["payload"])
                agent_id = snapshot.agent_id
                connected_agents[agent_id] = websocket
                agent_last_seen[agent_id] = datetime.utcnow().timestamp()
                CONNECTED_AGENTS.set(len(connected_agents))
                METRICS_INGESTED.inc()

                await _process_snapshot(snapshot)

                await broadcast_to_dashboards({
                    "type": "metric_update",
                    "payload": {
                        "server_id": snapshot.agent_id,
                        "timestamp": snapshot.timestamp,
                        "cpu_percent": snapshot.cpu.usage_percent,
                        "memory_percent": snapshot.memory.usage_percent,
                        "disk_percent": snapshot.disk.usage_percent,
                        "net_bytes_sent": snapshot.network.bytes_sent if snapshot.network else 0,
                        "net_bytes_recv": snapshot.network.bytes_recv if snapshot.network else 0,
                        "load1": snapshot.load.load1 if snapshot.load else 0.0,
                        "load5": snapshot.load.load5 if snapshot.load else 0.0,
                        "load15": snapshot.load.load15 if snapshot.load else 0.0,
                        "processes": [p.model_dump() for p in snapshot.processes] if snapshot.processes else [],
                        "updates": snapshot.updates.model_dump() if snapshot.updates else None,
                        "containers": [c.model_dump() for c in snapshot.containers] if snapshot.containers else [],
                    },
                })

            elif msg_type == "container_logs_response":
                payload = data.get("payload", {})
                request_id = payload.get("request_id")
                if request_id and request_id in pending_log_requests:
                    pending_log_requests[request_id].set_result(payload)

            elif msg_type == "compose_preview_response":
                payload = data.get("payload", {})
                request_id = payload.get("request_id")
                if request_id and request_id in pending_log_requests:
                    pending_log_requests[request_id].set_result(payload)

            elif msg_type == "image_list_response":
                payload = data.get("payload", {})
                request_id = payload.get("request_id")
                if request_id and request_id in pending_image_requests:
                    pending_image_requests[request_id].set_result(payload)

            elif msg_type == "image_remove_response":
                payload = data.get("payload", {})
                request_id = payload.get("request_id")
                if request_id and request_id in pending_image_requests:
                    pending_image_requests[request_id].set_result(payload)

            elif msg_type == "self_update_response":
                payload = data.get("payload", {})
                await broadcast_to_dashboards({
                    "type": "agent_update_status",
                    "payload": {
                        "server_id": agent_id,
                        **payload,
                    },
                })

            elif msg_type == "container_crash_event":
                payload = data.get("payload", {})
                await _handle_container_crash(payload)

            elif msg_type == "pong":
                pass

    except WebSocketDisconnect:
        if agent_id:
            connected_agents.pop(agent_id, None)
            agent_last_seen.pop(agent_id, None)
            CONNECTED_AGENTS.set(len(connected_agents))
            await _mark_offline(agent_id)
            await broadcast_to_dashboards({
                "type": "server_status",
                "payload": {
                    "server_id": agent_id,
                    "status": "offline",
                    "last_seen": datetime.utcnow().timestamp(),
                },
            })
    except Exception as e:
        logger.error(f"Agent WS error: {e}")
        if agent_id:
            connected_agents.pop(agent_id, None)


async def request_container_logs(agent_id: str, container_id: str, lines: int = 100) -> dict:
    ws = connected_agents.get(agent_id)
    if not ws:
        return {"logs": "", "error": "Agent not connected"}

    request_id = str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    future = loop.create_future()
    pending_log_requests[request_id] = future

    try:
        await ws.send_json({
            "type": "container_logs_request",
            "payload": {
                "container_id": container_id,
                "request_id": request_id,
                "lines": lines,
            },
        })
        result = await asyncio.wait_for(future, timeout=10.0)
        return result
    except asyncio.TimeoutError:
        return {"logs": "", "error": "Timeout waiting for agent response"}
    finally:
        pending_log_requests.pop(request_id, None)


async def request_compose_preview(agent_id: str, container_id: str, target_image: str) -> dict:
    ws = connected_agents.get(agent_id)
    if not ws:
        return {"error": "Agent not connected"}

    request_id = str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    future = loop.create_future()
    pending_log_requests[request_id] = future

    try:
        await ws.send_json({
            "type": "compose_preview_request",
            "payload": {
                "container_id": container_id,
                "target_image": target_image,
                "request_id": request_id,
            },
        })
        result = await asyncio.wait_for(future, timeout=10.0)
        return result
    except asyncio.TimeoutError:
        return {"error": "Timeout waiting for agent response"}
    finally:
        pending_log_requests.pop(request_id, None)


async def request_image_list(agent_id: str) -> dict:
    ws = connected_agents.get(agent_id)
    if not ws:
        return {"images": [], "error": "Agent not connected"}

    request_id = str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    future = loop.create_future()
    pending_image_requests[request_id] = future

    try:
        await ws.send_json({
            "type": "list_images_request",
            "payload": {"request_id": request_id},
        })
        result = await asyncio.wait_for(future, timeout=30.0)
        return result
    except asyncio.TimeoutError:
        return {"images": [], "error": "Timeout waiting for agent response"}
    finally:
        pending_image_requests.pop(request_id, None)


async def request_image_remove(agent_id: str, image_ids: list[str]) -> dict:
    ws = connected_agents.get(agent_id)
    if not ws:
        return {"results": [], "error": "Agent not connected"}

    request_id = str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    future = loop.create_future()
    pending_image_requests[request_id] = future

    try:
        await ws.send_json({
            "type": "remove_images_request",
            "payload": {"request_id": request_id, "image_ids": image_ids},
        })
        result = await asyncio.wait_for(future, timeout=120.0)
        return result
    except asyncio.TimeoutError:
        return {"results": [], "error": "Timeout waiting for agent response"}
    finally:
        pending_image_requests.pop(request_id, None)


async def send_command_to_agent(agent_id: str, command: dict) -> bool:
    ws = connected_agents.get(agent_id)
    if ws:
        await ws.send_json(command)
        return True
    return False


async def _process_snapshot(snapshot: SystemSnapshot):
    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                select(Server).where(Server.id == snapshot.agent_id)
            )
            server = result.scalar_one_or_none()

            now = datetime.utcnow()
            if server is None:
                server = Server(
                    id=snapshot.agent_id,
                    hostname=snapshot.hostname,
                    status="online",
                    first_seen=now,
                    last_seen=now,
                    cpu_cores=snapshot.cpu.core_count,
                    memory_total_bytes=snapshot.memory.total_bytes,
                    disk_total_bytes=snapshot.disk.total_bytes,
                    public_ip=snapshot.public_ip or None,
                )
                session.add(server)
            else:
                server.status = "online"
                server.last_seen = now
                server.hostname = snapshot.hostname
                server.cpu_cores = snapshot.cpu.core_count
                server.memory_total_bytes = snapshot.memory.total_bytes
                server.disk_total_bytes = snapshot.disk.total_bytes
                if snapshot.public_ip:
                    server.public_ip = snapshot.public_ip

            metric = Metric(
                server_id=snapshot.agent_id,
                timestamp=datetime.utcfromtimestamp(snapshot.timestamp),
                cpu_percent=snapshot.cpu.usage_percent,
                memory_percent=snapshot.memory.usage_percent,
                memory_used_bytes=snapshot.memory.used_bytes,
                disk_percent=snapshot.disk.usage_percent,
                disk_used_bytes=snapshot.disk.used_bytes,
                net_bytes_sent=snapshot.network.bytes_sent if snapshot.network else 0,
                net_bytes_recv=snapshot.network.bytes_recv if snapshot.network else 0,
                load1=snapshot.load.load1 if snapshot.load else 0.0,
                load5=snapshot.load.load5 if snapshot.load else 0.0,
                load15=snapshot.load.load15 if snapshot.load else 0.0,
            )
            session.add(metric)

            # Remove stale containers, then upsert current ones
            await session.execute(
                delete(Container).where(Container.server_id == snapshot.agent_id)
            )

            for c in snapshot.containers:
                session.add(
                    Container(
                        id=c.id,
                        server_id=snapshot.agent_id,
                        name=c.name,
                        image=c.image,
                        state=c.state,
                        status=c.status,
                        created=datetime.utcfromtimestamp(c.created) if c.created else None,
                        updated_at=now,
                        update_available=c.update_available if hasattr(c, 'update_available') else False,
                        latest_version=c.latest_version if hasattr(c, 'latest_version') else None,
                    )
                )


async def check_agent_timeouts():
    """Background task: mark agents as offline if no snapshot received within timeout."""
    while True:
        await asyncio.sleep(30)
        try:
            now = datetime.utcnow().timestamp()
            stale_agents = [
                aid for aid, last in agent_last_seen.items()
                if now - last > AGENT_TIMEOUT_SECONDS
            ]
            for agent_id in stale_agents:
                logger.warning(f"Agent {agent_id} timed out (no snapshot in {AGENT_TIMEOUT_SECONDS}s)")
                ws = connected_agents.pop(agent_id, None)
                agent_last_seen.pop(agent_id, None)
                if ws:
                    try:
                        await ws.close()
                    except Exception:
                        pass
                await _mark_offline(agent_id)
                await broadcast_to_dashboards({
                    "type": "server_status",
                    "payload": {
                        "server_id": agent_id,
                        "status": "offline",
                        "last_seen": now,
                    },
                })

            # Clean stale pending log requests (>15s old)
            stale_requests = [
                rid for rid, fut in pending_log_requests.items()
                if fut.done()
            ]
            for rid in stale_requests:
                pending_log_requests.pop(rid, None)

        except Exception as e:
            logger.error(f"Agent timeout check failed: {e}")


async def _handle_container_crash(payload: dict):
    """Process a container crash or restart-loop event from an agent."""
    async with async_session() as db:
        enabled = await get_setting(db, "container_crash_alerts_enabled")
        if enabled.lower() == "false":
            return

        exit_code: int = payload.get("exit_code", 0)
        event_type: str = payload.get("event_type", "crash")
        agent_id: str = payload.get("agent_id", "unknown")
        container_name: str = payload.get("container_name", "unknown")

        # Filter exit code 0 unless the user explicitly wants all-exit alerts.
        if event_type == "crash" and exit_code == 0:
            on_any = await get_setting(db, "container_crash_alert_on_any_exit")
            if on_any.lower() != "true":
                return

        severity = "critical"
        if event_type == "restart_loop":
            restart_count = payload.get("restart_count", 0)
            message = (
                f"Container '{container_name}' is restart-looping on {agent_id} "
                f"({restart_count} crashes in 5 min)"
            )
        else:
            message = (
                f"Container '{container_name}' stopped on {agent_id} "
                f"(exit code {exit_code})"
            )
            if exit_code == 0:
                severity = "warning"

        now = datetime.utcnow()
        event = AlertEvent(
            rule_id=0,
            server_id=agent_id,
            metric=event_type,
            value=float(exit_code),
            threshold=0.0,
            severity=severity,
            message=message,
            fired_at=now,
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)

    await broadcast_to_dashboards({
        "type": "alert_event",
        "payload": {
            "rule_id": 0,
            "server_id": agent_id,
            "metric": event_type,
            "value": float(exit_code),
            "threshold": 0.0,
            "severity": severity,
            "message": message,
            "timestamp": now.timestamp(),
        },
    })

    # Notify via the first enabled alert rule for this server that has a channel set.
    async with async_session() as db:
        result = await db.execute(
            select(AlertRule).where(
                AlertRule.enabled == True,
                AlertRule.notify_channel != "none",
                AlertRule.notify_channel != None,
                (AlertRule.server_id == agent_id) | (AlertRule.server_id == None),
            )
        )
        rule = result.scalars().first()

    if not rule:
        return

    channel = rule.notify_channel or "none"
    notif_payload = {
        "server_id": agent_id,
        "metric": event_type,
        "value": float(exit_code),
        "threshold": 0.0,
        "severity": severity,
        "message": message,
    }
    if channel == "email" and rule.notify_email:
        await send_email_alert(rule.notify_email, message, severity)
    elif channel == "gotify" and rule.notify_webhook:
        await send_gotify_alert(rule.notify_webhook, rule.gotify_token, message, severity)
    elif channel == "telegram" and rule.gotify_token and rule.telegram_chat_id:
        await send_telegram_alert(rule.gotify_token, rule.telegram_chat_id, message, severity)
    elif channel in ("discord", "slack", "webhook") and rule.notify_webhook:
        await send_webhook_alert(rule.notify_webhook, channel, notif_payload)


async def _mark_offline(agent_id: str):
    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                select(Server).where(Server.id == agent_id)
            )
            server = result.scalar_one_or_none()
            if server:
                server.status = "offline"
                server.last_seen = datetime.utcnow()

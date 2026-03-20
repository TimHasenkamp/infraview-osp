import asyncio
import json
import logging
import uuid
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select, delete
from app.database import async_session
from app.models import Server, Metric, Container
from app.schemas.ws_message import SystemSnapshot
from app.auth import verify_agent_key, verify_ws_token
from app.ws.client_handler import broadcast_to_dashboards

logger = logging.getLogger(__name__)

router = APIRouter()

# Track connected agents: agent_id -> WebSocket
connected_agents: dict[str, WebSocket] = {}

# Track last snapshot time per agent
agent_last_seen: dict[str, float] = {}

# Pending log requests: request_id -> (asyncio.Future, created_at)
pending_log_requests: dict[str, asyncio.Future] = {}

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

            elif msg_type == "pong":
                pass

    except WebSocketDisconnect:
        if agent_id:
            connected_agents.pop(agent_id, None)
            agent_last_seen.pop(agent_id, None)
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
                )
                session.add(server)
            else:
                server.status = "online"
                server.last_seen = now
                server.hostname = snapshot.hostname
                server.cpu_cores = snapshot.cpu.core_count
                server.memory_total_bytes = snapshot.memory.total_bytes
                server.disk_total_bytes = snapshot.disk.total_bytes

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

import json
import logging
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from app.database import async_session
from app.models import Server, Metric, Container
from app.schemas.ws_message import SystemSnapshot
from app.ws.client_handler import broadcast_to_dashboards

logger = logging.getLogger(__name__)

router = APIRouter()

# Track connected agents: agent_id -> WebSocket
connected_agents: dict[str, WebSocket] = {}


@router.websocket("/ws/agent")
async def agent_websocket(websocket: WebSocket):
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

                await _process_snapshot(snapshot)

                await broadcast_to_dashboards({
                    "type": "metric_update",
                    "payload": {
                        "server_id": snapshot.agent_id,
                        "timestamp": snapshot.timestamp,
                        "cpu_percent": snapshot.cpu.usage_percent,
                        "memory_percent": snapshot.memory.usage_percent,
                        "disk_percent": snapshot.disk.usage_percent,
                        "containers": [c.model_dump() for c in snapshot.containers],
                    },
                })

            elif msg_type == "pong":
                pass

    except WebSocketDisconnect:
        if agent_id:
            connected_agents.pop(agent_id, None)
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
            )
            session.add(metric)

            for c in snapshot.containers:
                result = await session.execute(
                    select(Container).where(
                        Container.id == c.id, Container.server_id == snapshot.agent_id
                    )
                )
                existing = result.scalar_one_or_none()
                if existing:
                    existing.name = c.name
                    existing.image = c.image
                    existing.state = c.state
                    existing.status = c.status
                    existing.updated_at = now
                else:
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

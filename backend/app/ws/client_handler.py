import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

router = APIRouter()

dashboard_clients: set[WebSocket] = set()


@router.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    await websocket.accept()
    dashboard_clients.add(websocket)
    logger.info(f"Dashboard client connected. Total: {len(dashboard_clients)}")

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            if data.get("type") == "container_action":
                from app.ws.agent_handler import send_command_to_agent
                await send_command_to_agent(
                    data["server_id"],
                    {
                        "type": "container_command",
                        "payload": {
                            "container_id": data["container_id"],
                            "action": data["action"],
                        },
                    },
                )
    except WebSocketDisconnect:
        dashboard_clients.discard(websocket)
        logger.info(f"Dashboard client disconnected. Total: {len(dashboard_clients)}")
    except Exception as e:
        logger.error(f"Dashboard WS error: {e}")
        dashboard_clients.discard(websocket)


async def broadcast_to_dashboards(message: dict):
    if not dashboard_clients:
        return
    dead = set()
    payload = json.dumps(message)
    for client in list(dashboard_clients):
        try:
            await client.send_text(payload)
        except Exception:
            dead.add(client)
    dashboard_clients.difference_update(dead)


async def ping_dashboard_clients():
    """Background task: send ping to all dashboard clients every 20s."""
    while True:
        await asyncio.sleep(20)
        dead = set()
        for client in list(dashboard_clients):
            try:
                if client.client_state == WebSocketState.CONNECTED:
                    await client.send_json({"type": "ping"})
            except Exception:
                dead.add(client)
        if dead:
            dashboard_clients.difference_update(dead)
            logger.info(f"Removed {len(dead)} dead dashboard client(s). Total: {len(dashboard_clients)}")

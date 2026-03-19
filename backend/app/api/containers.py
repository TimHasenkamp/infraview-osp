from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Container
from app.schemas.server import ContainerSchema
from app.ws.agent_handler import send_command_to_agent

router = APIRouter()


class ContainerAction(BaseModel):
    action: str  # start, stop, restart


@router.get("/servers/{server_id}/containers", response_model=list[ContainerSchema])
async def list_containers(server_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Container).where(Container.server_id == server_id)
    )
    containers = result.scalars().all()
    return [
        ContainerSchema(
            id=c.id,
            name=c.name,
            image=c.image,
            state=c.state,
            status=c.status or "",
            created=int(c.created.timestamp()) if c.created else 0,
        )
        for c in containers
    ]


@router.post("/servers/{server_id}/containers/{container_id}/action")
async def container_action(
    server_id: str, container_id: str, body: ContainerAction
):
    if body.action not in ("start", "stop", "restart"):
        raise HTTPException(status_code=400, detail="Invalid action")

    success = await send_command_to_agent(
        server_id,
        {
            "type": "container_command",
            "payload": {
                "container_id": container_id,
                "action": body.action,
            },
        },
    )
    if not success:
        raise HTTPException(status_code=503, detail="Agent not connected")
    return {"status": "command_sent", "action": body.action}

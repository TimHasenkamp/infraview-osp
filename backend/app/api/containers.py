from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Container
from app.schemas.server import ContainerSchema
from app.ws.agent_handler import send_command_to_agent, request_container_logs, request_compose_preview, request_image_list, request_image_remove

router = APIRouter()


class ContainerActionBody(BaseModel):
    action: Literal["start", "stop", "restart", "update", "update_compose"]
    target_image: str | None = None


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
    server_id: str, container_id: str, body: ContainerActionBody
):

    success = await send_command_to_agent(
        server_id,
        {
            "type": "container_command",
            "payload": {
                "container_id": container_id,
                "action": body.action,
                "target_image": body.target_image or "",
            },
        },
    )
    if not success:
        raise HTTPException(status_code=503, detail="Agent not connected")
    return {"status": "command_sent", "action": body.action}


@router.get("/servers/{server_id}/containers/{container_id}/logs")
async def get_container_logs(
    server_id: str,
    container_id: str,
    lines: int = Query(100, ge=1, le=5000),
):
    result = await request_container_logs(server_id, container_id, lines)
    error = result.get("error", "")
    if error and "not connected" in error.lower():
        raise HTTPException(status_code=503, detail=error)
    return {"logs": result.get("logs", ""), "error": error or None}


@router.get("/servers/{server_id}/containers/{container_id}/compose-preview")
async def compose_preview(
    server_id: str,
    container_id: str,
    target_image: str = Query(...),
):
    result = await request_compose_preview(server_id, container_id, target_image)
    error = result.get("error", "")
    if error and "not connected" in error.lower():
        raise HTTPException(status_code=503, detail=error)
    return result


class RemoveImagesBody(BaseModel):
    image_ids: list[str]


@router.get("/servers/{server_id}/images")
async def list_images(server_id: str):
    result = await request_image_list(server_id)
    error = result.get("error", "")
    if error and "not connected" in error.lower():
        raise HTTPException(status_code=503, detail=error)
    return {"images": result.get("images", []), "error": error or None}


@router.delete("/servers/{server_id}/images")
async def remove_images(server_id: str, body: RemoveImagesBody):
    if not body.image_ids:
        raise HTTPException(status_code=400, detail="No image IDs provided")
    result = await request_image_remove(server_id, body.image_ids)
    error = result.get("error", "")
    if error and "not connected" in error.lower():
        raise HTTPException(status_code=503, detail=error)
    return {"results": result.get("results", []), "error": error or None}

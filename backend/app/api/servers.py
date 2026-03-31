from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Server, Container, Metric
from app.schemas.server import (
    ServerResponse, ContainerSchema,
    CPUMetrics, MemoryMetrics, DiskMetrics, NetworkMetrics, LoadMetrics,
)
from app.ws.agent_handler import send_command_to_agent

router = APIRouter()


def _build_server_response(server, containers, latest_metric=None):
    cpu = None
    memory = None
    disk = None
    network = None
    load = None

    if latest_metric:
        cpu = CPUMetrics(
            usage_percent=latest_metric.cpu_percent,
            core_count=server.cpu_cores or 0,
            per_core=[],
        )
        memory = MemoryMetrics(
            usage_percent=latest_metric.memory_percent,
            total_bytes=server.memory_total_bytes or 0,
            used_bytes=latest_metric.memory_used_bytes or 0,
            avail_bytes=(server.memory_total_bytes or 0) - (latest_metric.memory_used_bytes or 0),
        )
        disk = DiskMetrics(
            usage_percent=latest_metric.disk_percent,
            total_bytes=server.disk_total_bytes or 0,
            used_bytes=latest_metric.disk_used_bytes or 0,
            free_bytes=(server.disk_total_bytes or 0) - (latest_metric.disk_used_bytes or 0),
            path="/",
        )
        network = NetworkMetrics(
            bytes_sent=latest_metric.net_bytes_sent or 0,
            bytes_recv=latest_metric.net_bytes_recv or 0,
            packets_sent=0,
            packets_recv=0,
        )
        load = LoadMetrics(
            load1=latest_metric.load1 or 0.0,
            load5=latest_metric.load5 or 0.0,
            load15=latest_metric.load15 or 0.0,
        )

    return ServerResponse(
        id=server.id,
        hostname=server.hostname,
        status=server.status,
        last_seen=server.last_seen.timestamp(),
        first_seen=server.first_seen.timestamp(),
        cpu=cpu,
        memory=memory,
        disk=disk,
        network=network,
        load=load,
        tags=[t.strip() for t in (server.tags or "").split(",") if t.strip()],
        containers=[
            ContainerSchema(
                id=c.id,
                name=c.name,
                image=c.image,
                state=c.state,
                status=c.status or "",
                created=int(c.created.timestamp()) if c.created else 0,
                update_available=c.update_available or False,
                latest_version=c.latest_version,
            )
            for c in containers
        ],
    )


@router.get("/servers", response_model=list[ServerResponse])
async def list_servers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Server))
    servers = result.scalars().all()

    response = []
    for server in servers:
        containers_result = await db.execute(
            select(Container).where(Container.server_id == server.id)
        )
        containers = containers_result.scalars().all()

        # Get latest metric for this server
        metric_result = await db.execute(
            select(Metric)
            .where(Metric.server_id == server.id)
            .order_by(Metric.timestamp.desc())
            .limit(1)
        )
        latest_metric = metric_result.scalar_one_or_none()

        response.append(_build_server_response(server, containers, latest_metric))
    return response


@router.get("/servers/{server_id}", response_model=ServerResponse)
async def get_server(server_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    containers_result = await db.execute(
        select(Container).where(Container.server_id == server.id)
    )
    containers = containers_result.scalars().all()

    metric_result = await db.execute(
        select(Metric)
        .where(Metric.server_id == server.id)
        .order_by(Metric.timestamp.desc())
        .limit(1)
    )
    latest_metric = metric_result.scalar_one_or_none()

    return _build_server_response(server, containers, latest_metric)


import re

_TAG_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,49}$")


class UpdateTagsRequest(BaseModel):
    tags: list[str] = Field(max_length=20)


@router.put("/servers/{server_id}/tags")
async def update_tags(
    server_id: str, body: UpdateTagsRequest, db: AsyncSession = Depends(get_db)
):
    cleaned = [t.strip() for t in body.tags if t.strip()]
    for tag in cleaned:
        if not _TAG_PATTERN.match(tag):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid tag '{tag}': only alphanumeric, dots, dashes, underscores (max 50 chars)",
            )

    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    server.tags = ",".join(cleaned)
    await db.commit()
    return {"status": "ok", "tags": cleaned}


@router.post("/servers/{server_id}/refresh-updates")
async def refresh_updates(server_id: str):
    sent = await send_command_to_agent(server_id, {"type": "refresh_updates"})
    if not sent:
        raise HTTPException(status_code=503, detail="Agent not connected")
    return {"ok": True}


@router.post("/servers/{server_id}/refresh-images")
async def refresh_images(server_id: str):
    sent = await send_command_to_agent(server_id, {"type": "refresh_images"})
    if not sent:
        raise HTTPException(status_code=503, detail="Agent not connected")
    return {"ok": True}


@router.post("/servers/{server_id}/update-agent")
async def update_agent(server_id: str):
    sent = await send_command_to_agent(server_id, {"type": "self_update"})
    if not sent:
        raise HTTPException(status_code=503, detail="Agent not connected")
    return {"ok": True}

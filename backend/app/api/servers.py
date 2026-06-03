from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Server, Container, Metric, AlertEvent, AlertRule, IgnoredUpdate
from app.schemas.server import (
    ServerResponse, ContainerSchema,
    CPUMetrics, MemoryMetrics, DiskMetrics, NetworkMetrics, LoadMetrics,
)
from app.ws.agent_handler import send_command_to_agent
from app.services.ignored_updates import get_ignored_versions

router = APIRouter()


def _build_server_response(server, containers, latest_metric=None, ignored=None, active_alerts=0):
    ignored = ignored or {}
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
        display_name=server.display_name,
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
                update_available=bool(c.update_available) and ignored.get(c.name) != c.latest_version,
                update_ignored=bool(c.update_available) and ignored.get(c.name) == c.latest_version,
                latest_version=c.latest_version,
            )
            for c in containers
        ],
        updates_available=server.updates_available or 0,
        active_alerts=active_alerts,
        agent_version=server.agent_version,
        agent_update_available=bool(server.agent_update_available),
    )


@router.get("/servers", response_model=list[ServerResponse])
async def list_servers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Server))
    servers = result.scalars().all()

    counts_result = await db.execute(
        select(AlertEvent.server_id, func.count())
        .where(AlertEvent.resolved == False)
        .group_by(AlertEvent.server_id)
    )
    alert_counts = {sid: n for sid, n in counts_result.all()}

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

        ignored = await get_ignored_versions(db, server.id)
        response.append(_build_server_response(
            server, containers, latest_metric, ignored, alert_counts.get(server.id, 0)
        ))
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

    ignored = await get_ignored_versions(db, server.id)
    alerts_result = await db.execute(
        select(func.count())
        .select_from(AlertEvent)
        .where(AlertEvent.server_id == server.id, AlertEvent.resolved == False)
    )
    active_alerts = alerts_result.scalar() or 0
    return _build_server_response(server, containers, latest_metric, ignored, active_alerts)


import re

_TAG_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,49}$")


class UpdateTagsRequest(BaseModel):
    tags: list[str] = Field(max_length=20)


class RenameServerRequest(BaseModel):
    display_name: str = Field(max_length=100)


@router.put("/servers/{server_id}/display-name")
async def rename_server(
    server_id: str, body: RenameServerRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    server.display_name = body.display_name.strip() or None
    await db.commit()
    return {"status": "ok", "display_name": server.display_name}


@router.delete("/servers/{server_id}")
async def delete_server(server_id: str, db: AsyncSession = Depends(get_db)):
    """Remove a server and all its data (metrics, containers, alert events and
    server-specific alert rules). If an agent with this ID is still running, the
    server will reappear on its next snapshot — stop that agent first."""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    await db.execute(delete(Metric).where(Metric.server_id == server_id))
    await db.execute(delete(Container).where(Container.server_id == server_id))
    await db.execute(delete(AlertEvent).where(AlertEvent.server_id == server_id))
    await db.execute(delete(AlertRule).where(AlertRule.server_id == server_id))
    await db.execute(delete(IgnoredUpdate).where(IgnoredUpdate.server_id == server_id))
    await db.execute(delete(Server).where(Server.id == server_id))
    await db.commit()
    return {"status": "ok"}


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

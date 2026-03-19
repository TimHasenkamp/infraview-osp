from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Server, Container
from app.schemas.server import ServerResponse, ContainerSchema

router = APIRouter()


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

        response.append(
            ServerResponse(
                id=server.id,
                hostname=server.hostname,
                status=server.status,
                last_seen=server.last_seen.timestamp(),
                first_seen=server.first_seen.timestamp(),
                containers=[
                    ContainerSchema(
                        id=c.id,
                        name=c.name,
                        image=c.image,
                        state=c.state,
                        status=c.status or "",
                        created=int(c.created.timestamp()) if c.created else 0,
                    )
                    for c in containers
                ],
            )
        )
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

    return ServerResponse(
        id=server.id,
        hostname=server.hostname,
        status=server.status,
        last_seen=server.last_seen.timestamp(),
        first_seen=server.first_seen.timestamp(),
        containers=[
            ContainerSchema(
                id=c.id,
                name=c.name,
                image=c.image,
                state=c.state,
                status=c.status or "",
                created=int(c.created.timestamp()) if c.created else 0,
            )
            for c in containers
        ],
    )

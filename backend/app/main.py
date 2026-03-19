import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete
from app.config import settings
from app.database import init_db, async_session
from app.models import Metric
from app.api import health, servers, metrics, containers, alerts
from app.ws import agent_handler, client_handler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def prune_old_metrics():
    while True:
        await asyncio.sleep(3600)
        try:
            cutoff = datetime.utcnow() - timedelta(days=30)
            async with async_session() as session:
                async with session.begin():
                    await session.execute(
                        delete(Metric).where(Metric.timestamp < cutoff)
                    )
            logger.info("Pruned metrics older than 30 days")
        except Exception as e:
            logger.error(f"Metric pruning failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Database initialized")
    pruning_task = asyncio.create_task(prune_old_metrics())
    yield
    pruning_task.cancel()


app = FastAPI(title="InfraView API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(servers.router, prefix="/api", tags=["servers"])
app.include_router(metrics.router, prefix="/api", tags=["metrics"])
app.include_router(containers.router, prefix="/api", tags=["containers"])
app.include_router(alerts.router, prefix="/api", tags=["alerts"])
app.include_router(agent_handler.router, tags=["websocket"])
app.include_router(client_handler.router, tags=["websocket"])

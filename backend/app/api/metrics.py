from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Metric
from app.schemas.metric import MetricResponse

router = APIRouter()

RANGE_MAP = {
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}


@router.get("/servers/{server_id}/metrics", response_model=list[MetricResponse])
async def get_metrics(
    server_id: str,
    range: str = Query("1h", pattern="^(1h|6h|24h|7d)$"),
    db: AsyncSession = Depends(get_db),
):
    delta = RANGE_MAP.get(range, timedelta(hours=1))
    since = datetime.utcnow() - delta

    result = await db.execute(
        select(Metric)
        .where(Metric.server_id == server_id, Metric.timestamp >= since)
        .order_by(Metric.timestamp.asc())
    )
    metrics = result.scalars().all()

    return [
        MetricResponse(
            timestamp=m.timestamp.timestamp(),
            cpu_percent=m.cpu_percent,
            memory_percent=m.memory_percent,
            disk_percent=m.disk_percent,
            net_bytes_sent=m.net_bytes_sent or 0,
            net_bytes_recv=m.net_bytes_recv or 0,
            load1=m.load1 or 0.0,
            load5=m.load5 or 0.0,
            load15=m.load15 or 0.0,
        )
        for m in metrics
    ]

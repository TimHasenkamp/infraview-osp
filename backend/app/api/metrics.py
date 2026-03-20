import csv
import io
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Metric
from app.schemas.metric import MetricResponse, PaginatedMetricResponse

router = APIRouter()

RANGE_MAP = {
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


@router.get("/servers/{server_id}/metrics", response_model=PaginatedMetricResponse)
async def get_metrics(
    server_id: str,
    range: str = Query("1h", pattern="^(1h|6h|24h|7d|30d)$"),
    limit: int = Query(500, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    delta = RANGE_MAP.get(range, timedelta(hours=1))
    since = datetime.utcnow() - delta

    base_filter = [Metric.server_id == server_id, Metric.timestamp >= since]

    # Total count
    count_result = await db.execute(
        select(func.count()).select_from(Metric).where(*base_filter)
    )
    total = count_result.scalar()

    # Paginated data
    result = await db.execute(
        select(Metric)
        .where(*base_filter)
        .order_by(Metric.timestamp.asc())
        .limit(limit)
        .offset(offset)
    )
    metrics = result.scalars().all()

    return PaginatedMetricResponse(
        items=[
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
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/servers/{server_id}/metrics/export")
async def export_metrics(
    server_id: str,
    range: str = Query("1h", pattern="^(1h|6h|24h|7d|30d)$"),
    format: str = Query("csv", pattern="^(csv|json)$"),
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

    if format == "json":
        data = [
            {
                "timestamp": m.timestamp.isoformat(),
                "cpu_percent": m.cpu_percent,
                "memory_percent": m.memory_percent,
                "disk_percent": m.disk_percent,
                "memory_used_bytes": m.memory_used_bytes,
                "disk_used_bytes": m.disk_used_bytes,
                "net_bytes_sent": m.net_bytes_sent or 0,
                "net_bytes_recv": m.net_bytes_recv or 0,
                "load1": m.load1 or 0.0,
                "load5": m.load5 or 0.0,
                "load15": m.load15 or 0.0,
            }
            for m in metrics
        ]
        import json
        content = json.dumps(data, indent=2)
        return StreamingResponse(
            io.StringIO(content),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="metrics_{server_id}_{range}.json"'
            },
        )

    # CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "timestamp", "cpu_percent", "memory_percent", "disk_percent",
        "memory_used_bytes", "disk_used_bytes",
        "net_bytes_sent", "net_bytes_recv", "load1", "load5", "load15",
    ])
    for m in metrics:
        writer.writerow([
            m.timestamp.isoformat(),
            m.cpu_percent, m.memory_percent, m.disk_percent,
            m.memory_used_bytes, m.disk_used_bytes,
            m.net_bytes_sent or 0, m.net_bytes_recv or 0,
            m.load1 or 0.0, m.load5 or 0.0, m.load15 or 0.0,
        ])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="metrics_{server_id}_{range}.csv"'
        },
    )

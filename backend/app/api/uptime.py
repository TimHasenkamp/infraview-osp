from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Server, Metric

router = APIRouter()


@router.get("/servers/{server_id}/uptime")
async def get_uptime(
    server_id: str,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Calculate uptime percentage based on metric data points."""
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalar_one_or_none()
    if not server:
        return {"error": "Server not found"}

    now = datetime.utcnow()
    since = now - timedelta(days=days)

    # Count total metrics in the period (each = one alive heartbeat)
    count_result = await db.execute(
        select(func.count())
        .select_from(Metric)
        .where(Metric.server_id == server_id, Metric.timestamp >= since)
    )
    total_datapoints = count_result.scalar() or 0

    # Expected datapoints: one per 5 seconds over the period
    total_seconds = days * 86400
    expected_datapoints = total_seconds // 5

    # Uptime percentage
    if expected_datapoints == 0:
        uptime_percent = 0.0
    else:
        uptime_percent = min(100.0, round((total_datapoints / expected_datapoints) * 100, 2))

    # Daily breakdown
    daily = []
    for d in range(days):
        day_start = (now - timedelta(days=days - d)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        day_count_result = await db.execute(
            select(func.count())
            .select_from(Metric)
            .where(
                Metric.server_id == server_id,
                Metric.timestamp >= day_start,
                Metric.timestamp < day_end,
            )
        )
        day_count = day_count_result.scalar() or 0
        expected_day = 86400 // 5
        day_pct = min(100.0, round((day_count / expected_day) * 100, 2)) if expected_day > 0 else 0.0

        daily.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "uptime_percent": day_pct,
            "datapoints": day_count,
        })

    return {
        "server_id": server_id,
        "hostname": server.hostname,
        "period_days": days,
        "uptime_percent": uptime_percent,
        "total_datapoints": total_datapoints,
        "expected_datapoints": expected_datapoints,
        "first_seen": server.first_seen.isoformat(),
        "daily": daily,
    }

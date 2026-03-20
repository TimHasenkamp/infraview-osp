import logging
from datetime import datetime, timedelta
from sqlalchemy import select, delete, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session
from app.models import Metric
from app.config import settings

logger = logging.getLogger(__name__)

METRIC_COLUMNS = [
    "cpu_percent", "memory_percent", "memory_used_bytes",
    "disk_percent", "disk_used_bytes",
    "net_bytes_sent", "net_bytes_recv",
    "load1", "load5", "load15",
]


async def downsample_metrics():
    """Periodically aggregate old fine-grained metrics into coarser buckets.

    Buckets (configurable via ENV):
    - Raw (5s)  → kept for first N hours  (default 6h)
    - 1 min avg → kept from 6h to 48h
    - 5 min avg → kept from 48h to 7d
    - 1 hour avg → kept from 7d to retention limit
    """
    while True:
        await _run_downsampling()
        await __import__("asyncio").sleep(1800)  # run every 30 min


async def _run_downsampling():
    if not settings.downsample_enabled:
        return

    now = datetime.utcnow()
    tiers = [
        # (older_than, bucket_seconds, label)
        (timedelta(hours=settings.downsample_1h_after_hours), 3600, "1h"),
        (timedelta(hours=settings.downsample_5min_after_hours), 300, "5min"),
        (timedelta(hours=settings.downsample_1min_after_hours), 60, "1min"),
    ]

    try:
        async with async_session() as session:
            for age, bucket_secs, label in tiers:
                cutoff = now - age
                await _downsample_tier(session, cutoff, bucket_secs, label)
            await session.commit()
    except Exception as e:
        logger.error(f"Downsampling failed: {e}")


async def _downsample_tier(
    session: AsyncSession, cutoff: datetime, bucket_seconds: int, label: str
):
    """For all metrics older than cutoff, aggregate into bucket_seconds intervals."""
    server_ids_result = await session.execute(
        select(Metric.server_id)
        .where(Metric.timestamp < cutoff)
        .distinct()
    )
    server_ids = [row[0] for row in server_ids_result.all()]

    total_removed = 0
    for server_id in server_ids:
        removed = await _downsample_server(
            session, server_id, cutoff, bucket_seconds
        )
        total_removed += removed

    if total_removed > 0:
        logger.info(
            f"Downsampled {total_removed} metrics into {label} buckets "
            f"(older than {cutoff.isoformat()})"
        )


async def _downsample_server(
    session: AsyncSession,
    server_id: str,
    cutoff: datetime,
    bucket_seconds: int,
) -> int:
    """Aggregate metrics for a single server older than cutoff into buckets."""
    # Fetch all raw metrics older than cutoff for this server
    result = await session.execute(
        select(Metric)
        .where(
            and_(
                Metric.server_id == server_id,
                Metric.timestamp < cutoff,
            )
        )
        .order_by(Metric.timestamp.asc())
    )
    rows = result.scalars().all()
    if len(rows) <= 1:
        return 0

    # Group into buckets
    buckets: dict[int, list] = {}
    for row in rows:
        ts = int(row.timestamp.timestamp())
        bucket_key = (ts // bucket_seconds) * bucket_seconds
        buckets.setdefault(bucket_key, []).append(row)

    removed = 0
    for bucket_key, bucket_rows in buckets.items():
        if len(bucket_rows) <= 1:
            continue

        # Compute averages
        count = len(bucket_rows)
        avg = {}
        for col in METRIC_COLUMNS:
            values = [getattr(r, col) or 0 for r in bucket_rows]
            avg[col] = sum(values) / count

        # Keep the first row as the representative, update with averages
        keep = bucket_rows[0]
        keep.timestamp = datetime.utcfromtimestamp(bucket_key)
        for col in METRIC_COLUMNS:
            if col in ("memory_used_bytes", "disk_used_bytes", "net_bytes_sent", "net_bytes_recv"):
                setattr(keep, col, int(avg[col]))
            else:
                setattr(keep, col, round(avg[col], 2))

        # Delete the rest
        delete_ids = [r.id for r in bucket_rows[1:]]
        if delete_ids:
            await session.execute(
                delete(Metric).where(Metric.id.in_(delete_ids))
            )
            removed += len(delete_ids)

    return removed

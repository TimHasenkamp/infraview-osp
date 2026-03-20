import pytest
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AlertRule, AlertEvent, Metric, Server
from app.services.alert_service import _get_metric_value
from app.services.downsampling import _downsample_server
from app.schemas.server import CPUMetrics, MemoryMetrics, DiskMetrics
from app.schemas.ws_message import SystemSnapshot


def _make_snapshot(
    agent_id="test-server-1",
    hostname="testhost",
    cpu=50.0,
    mem=60.0,
    disk=40.0,
) -> SystemSnapshot:
    return SystemSnapshot(
        timestamp=int(datetime.utcnow().timestamp()),
        hostname=hostname,
        agent_id=agent_id,
        cpu=CPUMetrics(usage_percent=cpu, core_count=4, per_core=[]),
        memory=MemoryMetrics(
            usage_percent=mem, total_bytes=8_000_000_000,
            used_bytes=4_800_000_000, avail_bytes=3_200_000_000,
        ),
        disk=DiskMetrics(
            usage_percent=disk, total_bytes=100_000_000_000,
            used_bytes=40_000_000_000, free_bytes=60_000_000_000, path="/",
        ),
    )


# --- Alert service unit tests ---


def test_get_metric_value():
    snapshot = _make_snapshot(cpu=75.5, mem=60.0, disk=40.0)
    assert _get_metric_value(snapshot, "cpu_percent") == 75.5
    assert _get_metric_value(snapshot, "memory_percent") == 60.0
    assert _get_metric_value(snapshot, "disk_percent") == 40.0
    assert _get_metric_value(snapshot, "nonexistent") is None


def test_get_metric_value_edge_cases():
    snapshot = _make_snapshot(cpu=0.0, mem=100.0, disk=99.9)
    assert _get_metric_value(snapshot, "cpu_percent") == 0.0
    assert _get_metric_value(snapshot, "memory_percent") == 100.0
    assert _get_metric_value(snapshot, "disk_percent") == 99.9


# --- Alert event integration tests via API ---


async def test_alert_event_lifecycle(client, sample_alert_event):
    """Test acknowledge → resolve flow through API."""
    # Acknowledge
    resp = await client.post(f"/api/alerts/events/{sample_alert_event.id}/acknowledge")
    assert resp.status_code == 200

    # Verify acknowledged in listing
    resp = await client.get("/api/alerts/events")
    event = resp.json()["items"][0]
    assert event["acknowledged"] is True
    assert event["acknowledged_at"] is not None

    # Resolve
    resp = await client.post(f"/api/alerts/events/{sample_alert_event.id}/resolve")
    assert resp.status_code == 200

    # Verify resolved
    resp = await client.get("/api/alerts/events")
    event = resp.json()["items"][0]
    assert event["resolved"] is True
    assert event["resolved_at"] is not None


# --- Downsampling tests ---


async def test_downsample_server_aggregates(db_session: AsyncSession, sample_server):
    """Downsampling should aggregate multiple metrics into fewer rows."""
    now = datetime.utcnow()
    # Use a timestamp aligned to a minute boundary to avoid bucket split
    base_time = datetime(2025, 1, 1, 12, 0, 0)

    # Insert 10 metrics within the same 60-second bucket (5s apart, 0-45s)
    for i in range(10):
        m = Metric(
            server_id=sample_server.id,
            timestamp=base_time + timedelta(seconds=i * 5),
            cpu_percent=30.0 + i,
            memory_percent=50.0,
            memory_used_bytes=4_000_000_000,
            disk_percent=60.0,
            disk_used_bytes=60_000_000_000,
            net_bytes_sent=1000,
            net_bytes_recv=2000,
            load1=1.0,
            load5=0.8,
            load15=0.5,
        )
        db_session.add(m)
    await db_session.flush()

    # Downsample into 60-second buckets — cutoff after all metrics
    cutoff = base_time + timedelta(hours=1)
    removed = await _downsample_server(db_session, sample_server.id, cutoff, 60)
    await db_session.flush()

    assert removed == 9  # 10 in one bucket → keep 1, remove 9

    # Verify only 1 remains
    result = await db_session.execute(
        select(Metric).where(Metric.server_id == sample_server.id)
    )
    remaining = result.scalars().all()
    assert len(remaining) == 1

    # The remaining metric should have averaged CPU
    avg_cpu = sum(30.0 + i for i in range(10)) / 10
    assert abs(remaining[0].cpu_percent - avg_cpu) < 0.1


async def test_downsample_preserves_different_buckets(db_session: AsyncSession, sample_server):
    """Metrics in different time buckets should remain separate."""
    # Use aligned timestamp to avoid bucket splits
    base_time = datetime(2025, 1, 1, 12, 0, 0)

    # Insert 2 metrics in bucket A (0-59s) and 2 in bucket B (60-119s)
    for i, offset in enumerate([0, 5, 60, 65]):
        m = Metric(
            server_id=sample_server.id,
            timestamp=base_time + timedelta(seconds=offset),
            cpu_percent=50.0 + i * 10,
            memory_percent=50.0,
            memory_used_bytes=4_000_000_000,
            disk_percent=60.0,
            disk_used_bytes=60_000_000_000,
            net_bytes_sent=1000,
            net_bytes_recv=2000,
            load1=1.0,
            load5=0.8,
            load15=0.5,
        )
        db_session.add(m)
    await db_session.flush()

    cutoff = base_time + timedelta(hours=1)
    removed = await _downsample_server(db_session, sample_server.id, cutoff, 60)
    await db_session.flush()

    assert removed == 2  # 2 removed (one from each bucket)

    result = await db_session.execute(
        select(Metric).where(Metric.server_id == sample_server.id)
    )
    remaining = result.scalars().all()
    assert len(remaining) == 2  # one per bucket


async def test_downsample_single_metric_unchanged(db_session: AsyncSession, sample_server):
    """A single metric should not be modified by downsampling."""
    now = datetime.utcnow()
    m = Metric(
        server_id=sample_server.id,
        timestamp=now - timedelta(hours=12),
        cpu_percent=42.0,
        memory_percent=50.0,
        memory_used_bytes=4_000_000_000,
        disk_percent=60.0,
        disk_used_bytes=60_000_000_000,
    )
    db_session.add(m)
    await db_session.flush()

    removed = await _downsample_server(db_session, sample_server.id, now, 60)
    assert removed == 0

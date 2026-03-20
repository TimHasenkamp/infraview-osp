import pytest
from datetime import datetime
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.database import Base, get_db
from app.main import app
from app.auth import create_access_token, hash_password
from app.models import Server, Metric, AlertRule, AlertEvent, AdminUser


@pytest.fixture()
async def db_session():
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        # Ensure admin user exists for auth tests
        admin = AdminUser(
            username="admin",
            password_hash=hash_password("admin"),
            must_change_password=False,
        )
        session.add(admin)
        await session.commit()
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture()
async def client(db_session: AsyncSession):
    """Authenticated HTTP test client with in-memory DB."""

    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db

    token = create_access_token(subject="admin")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.set("infraview_token", token)
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture()
async def unauthed_client(db_session: AsyncSession):
    """Unauthenticated HTTP test client."""

    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture()
async def sample_server(db_session: AsyncSession) -> Server:
    """Insert a sample server into the test DB."""
    now = datetime.utcnow()
    server = Server(
        id="test-server-1",
        hostname="testhost",
        status="online",
        first_seen=now,
        last_seen=now,
        cpu_cores=4,
        memory_total_bytes=8_000_000_000,
        disk_total_bytes=100_000_000_000,
    )
    db_session.add(server)
    await db_session.commit()
    await db_session.refresh(server)
    return server


@pytest.fixture()
async def sample_metrics(db_session: AsyncSession, sample_server: Server) -> list[Metric]:
    """Insert sample metrics for the test server."""
    now = datetime.utcnow()
    metrics = []
    for i in range(10):
        m = Metric(
            server_id=sample_server.id,
            timestamp=datetime(now.year, now.month, now.day, now.hour, now.minute, i * 5),
            cpu_percent=30.0 + i,
            memory_percent=50.0 + i,
            memory_used_bytes=4_000_000_000 + i * 100_000_000,
            disk_percent=60.0,
            disk_used_bytes=60_000_000_000,
            net_bytes_sent=1000 * i,
            net_bytes_recv=2000 * i,
            load1=1.0,
            load5=0.8,
            load15=0.5,
        )
        db_session.add(m)
        metrics.append(m)
    await db_session.commit()
    return metrics


@pytest.fixture()
async def sample_alert_rule(db_session: AsyncSession, sample_server: Server) -> AlertRule:
    """Insert a sample alert rule."""
    rule = AlertRule(
        server_id=sample_server.id,
        metric="cpu_percent",
        operator=">",
        threshold=80.0,
        severity="warning",
        enabled=True,
        cooldown_seconds=300,
    )
    db_session.add(rule)
    await db_session.commit()
    await db_session.refresh(rule)
    return rule


@pytest.fixture()
async def sample_alert_event(
    db_session: AsyncSession, sample_alert_rule: AlertRule, sample_server: Server
) -> AlertEvent:
    """Insert a sample alert event."""
    event = AlertEvent(
        rule_id=sample_alert_rule.id,
        server_id=sample_server.id,
        metric="cpu_percent",
        value=85.0,
        threshold=80.0,
        severity="warning",
        message="cpu_percent is 85.0% (threshold: 80.0%) on testhost",
        fired_at=datetime.utcnow(),
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    return event

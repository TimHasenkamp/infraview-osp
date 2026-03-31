import asyncio
import logging
import secrets
import string
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import delete, select, text
from app.config import settings
from app.database import init_db, async_session
from app.models import Metric, AdminUser
from app.auth import require_auth, hash_password
from app.api import health, servers, metrics, containers, alerts, settings as settings_routes, backup, uptime
from app.api import auth as auth_routes
from app.ws import agent_handler, client_handler
from app.services.downsampling import downsample_metrics
from app.logging_config import setup_logging, generate_trace_id, trace_id_var
from app.metrics import router as metrics_router, REQUEST_COUNT, REQUEST_DURATION

setup_logging()
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


async def prune_old_metrics():
    while True:
        await asyncio.sleep(3600)
        try:
            cutoff = datetime.utcnow() - timedelta(days=settings.metric_retention_days)
            async with async_session() as session:
                async with session.begin():
                    result = await session.execute(
                        delete(Metric).where(Metric.timestamp < cutoff)
                    )
            logger.info(
                f"Pruned {result.rowcount} metrics older than "
                f"{settings.metric_retention_days} days"
            )
        except Exception as e:
            logger.error(f"Metric pruning failed: {e}")


def _generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def _ensure_admin_user():
    """Create admin user with random password on first startup."""
    async with async_session() as session:
        result = await session.execute(
            select(AdminUser).where(AdminUser.username == settings.admin_user)
        )
        admin = result.scalar_one_or_none()

        if admin is None:
            password = _generate_password()
            admin = AdminUser(
                username=settings.admin_user,
                password_hash=hash_password(password),
                must_change_password=False,
            )
            session.add(admin)
            await session.commit()

            # Write credentials to file and log
            creds_path = "data/initial_credentials.txt"
            with open(creds_path, "w") as f:
                f.write(f"Username: {settings.admin_user}\n")
                f.write(f"Password: {password}\n")

            # Print directly to stderr so it's always visible
            import sys
            print("", file=sys.stderr)
            print("=" * 60, file=sys.stderr)
            print("  INITIAL ADMIN CREDENTIALS", file=sys.stderr)
            print(f"  Username: {settings.admin_user}", file=sys.stderr)
            print(f"  Password: {password}", file=sys.stderr)
            print(f"  Saved to: {creds_path}", file=sys.stderr)
            print("=" * 60, file=sys.stderr)
            print("", file=sys.stderr)
        else:
            logger.info(f"Admin user '{settings.admin_user}' already exists")


_MIGRATIONS = [
    ("containers", "update_available", "BOOLEAN DEFAULT 0"),
    ("containers", "latest_version", "VARCHAR"),
    ("servers", "tags", "VARCHAR DEFAULT ''"),
    ("servers", "display_name", "VARCHAR"),
    ("servers", "public_ip", "VARCHAR"),
    ("alert_rules", "notify_channel", "VARCHAR DEFAULT 'none'"),
    ("alert_rules", "gotify_token", "VARCHAR"),
]


async def _auto_migrate():
    """Add missing columns to existing tables."""
    async with async_session() as session:
        for table, column, col_type in _MIGRATIONS:
            try:
                await session.execute(text(f"SELECT {column} FROM {table} LIMIT 1"))
            except Exception:
                await session.rollback()
                logger.info(f"Adding column {table}.{column}")
                await session.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        logger.info("Database initialized and verified")
    except Exception as e:
        logger.error(f"Database connectivity check failed: {e}")
        raise

    # Auto-migrate: add missing columns
    await _auto_migrate()

    # Ensure admin user exists
    await _ensure_admin_user()

    tasks = [
        asyncio.create_task(prune_old_metrics()),
        asyncio.create_task(downsample_metrics()),
        asyncio.create_task(agent_handler.check_agent_timeouts()),
        asyncio.create_task(client_handler.ping_dashboard_clients()),
    ]

    yield

    for agent_id, ws in list(agent_handler.connected_agents.items()):
        try:
            await ws.close()
            logger.info(f"Closed agent connection: {agent_id}")
        except Exception:
            pass
    agent_handler.connected_agents.clear()
    agent_handler.agent_last_seen.clear()

    for task in tasks:
        task.cancel()


app = FastAPI(title="InfraView API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return Response(
        content='{"detail":"Rate limit exceeded"}',
        status_code=429,
        media_type="application/json",
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Trace-ID"],
)


@app.middleware("http")
async def trace_and_log_middleware(request: Request, call_next):
    """Attach trace ID to every request and log structured request/response info."""
    trace_id = request.headers.get("X-Trace-ID") or generate_trace_id()
    trace_id_var.set(trace_id)

    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000, 1)

    response.headers["X-Trace-ID"] = trace_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Track Prometheus metrics
    path = request.url.path
    if path != "/api/metrics":
        REQUEST_COUNT.labels(
            method=request.method, path=path, status=response.status_code
        ).inc()
        REQUEST_DURATION.labels(
            method=request.method, path=path
        ).observe(duration_ms / 1000)

    # Skip logging for health checks and WebSocket upgrades
    if path != "/api/health" and "websocket" not in str(request.headers.get("upgrade", "")):
        logger.info(
            f"{request.method} {path} {response.status_code} ({duration_ms}ms)",
            extra={
                "method": request.method,
                "path": path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": request.client.host if request.client else "",
            },
        )

    return response


# Public routes (no auth)
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(metrics_router, prefix="/api", tags=["prometheus"])
app.include_router(auth_routes.router, prefix="/api", tags=["auth"])

# Protected routes (require JWT)
app.include_router(servers.router, prefix="/api", tags=["servers"], dependencies=[Depends(require_auth)])
app.include_router(metrics.router, prefix="/api", tags=["metrics"], dependencies=[Depends(require_auth)])
app.include_router(containers.router, prefix="/api", tags=["containers"], dependencies=[Depends(require_auth)])
app.include_router(alerts.router, prefix="/api", tags=["alerts"], dependencies=[Depends(require_auth)])
app.include_router(settings_routes.router, prefix="/api", tags=["settings"], dependencies=[Depends(require_auth)])
app.include_router(backup.router, prefix="/api", tags=["backup"], dependencies=[Depends(require_auth)])
app.include_router(uptime.router, prefix="/api", tags=["uptime"], dependencies=[Depends(require_auth)])

# WebSocket (auth handled inside handlers)
app.include_router(agent_handler.router, tags=["websocket"])
app.include_router(client_handler.router, tags=["websocket"])

from fastapi import APIRouter, Depends
from sqlalchemy import text
from app.auth import require_auth
from app.database import async_session
from app.ws.agent_handler import connected_agents
from app.ws.client_handler import dashboard_clients

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check — no auth required."""
    return {"status": "ok"}


@router.get("/health/detailed")
async def health_detailed(_user: dict = Depends(require_auth)):
    """Detailed health check with dependency status. Requires auth."""
    checks = {}

    # Database
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as e:
        checks["database"] = {"status": "error", "error": str(e)}

    # Connected agents — count only, no IDs
    checks["agents"] = {
        "status": "ok" if connected_agents else "no_agents",
        "connected": len(connected_agents),
    }

    # Dashboard clients
    checks["dashboards"] = {
        "status": "ok",
        "connected": len(dashboard_clients),
    }

    # Overall
    all_ok = all(c.get("status") == "ok" for c in checks.values())

    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
    }

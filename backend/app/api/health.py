from fastapi import APIRouter
from sqlalchemy import text
from app.database import async_session
from app.ws.agent_handler import connected_agents
from app.ws.client_handler import dashboard_clients

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic health check."""
    return {"status": "ok"}


@router.get("/health/detailed")
async def health_detailed():
    """Detailed health check with dependency status."""
    checks = {}

    # Database
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as e:
        checks["database"] = {"status": "error", "error": str(e)}

    # Connected agents
    agent_ids = list(connected_agents.keys())
    checks["agents"] = {
        "status": "ok" if agent_ids else "no_agents",
        "connected": len(agent_ids),
        "ids": agent_ids,
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

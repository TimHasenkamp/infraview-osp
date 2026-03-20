import pytest
from httpx import AsyncClient


async def test_health_check(unauthed_client: AsyncClient):
    resp = await unauthed_client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

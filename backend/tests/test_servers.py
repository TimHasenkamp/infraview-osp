import pytest
from httpx import AsyncClient
from app.models import Server, Metric


async def test_list_servers_empty(client: AsyncClient):
    resp = await client.get("/api/servers")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_servers_with_data(client: AsyncClient, sample_server, sample_metrics):
    resp = await client.get("/api/servers")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == "test-server-1"
    assert data[0]["hostname"] == "testhost"
    assert data[0]["status"] == "online"
    assert data[0]["cpu"] is not None
    assert data[0]["memory"] is not None


async def test_get_server(client: AsyncClient, sample_server, sample_metrics):
    resp = await client.get("/api/servers/test-server-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "test-server-1"
    assert data["cpu"]["core_count"] == 4


async def test_get_server_not_found(client: AsyncClient):
    resp = await client.get("/api/servers/nonexistent")
    assert resp.status_code == 404

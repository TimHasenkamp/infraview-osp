import pytest
from httpx import AsyncClient
from app.models import Server, Metric


async def test_update_tags(client: AsyncClient, sample_server):
    resp = await client.put(
        f"/api/servers/{sample_server.id}/tags",
        json={"tags": ["production", "eu-west"]},
    )
    assert resp.status_code == 200
    assert resp.json()["tags"] == ["production", "eu-west"]


async def test_update_tags_strips_whitespace(client: AsyncClient, sample_server):
    resp = await client.put(
        f"/api/servers/{sample_server.id}/tags",
        json={"tags": [" web ", "", " db"]},
    )
    assert resp.status_code == 200
    assert resp.json()["tags"] == ["web", "db"]


async def test_tags_in_server_response(client: AsyncClient, sample_server):
    # Set tags
    await client.put(
        f"/api/servers/{sample_server.id}/tags",
        json={"tags": ["staging"]},
    )

    # Verify in list
    resp = await client.get("/api/servers")
    data = resp.json()
    assert data[0]["tags"] == ["staging"]

    # Verify in detail
    resp = await client.get(f"/api/servers/{sample_server.id}")
    assert resp.json()["tags"] == ["staging"]


async def test_tags_not_found(client: AsyncClient):
    resp = await client.put(
        "/api/servers/nonexistent/tags",
        json={"tags": ["test"]},
    )
    assert resp.status_code == 404


async def test_uptime(client: AsyncClient, sample_server, sample_metrics):
    resp = await client.get(f"/api/servers/{sample_server.id}/uptime?days=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["server_id"] == sample_server.id
    assert "uptime_percent" in data
    assert "daily" in data
    assert isinstance(data["daily"], list)
    assert data["total_datapoints"] == 10  # from sample_metrics fixture


async def test_uptime_no_data(client: AsyncClient, sample_server):
    resp = await client.get(f"/api/servers/{sample_server.id}/uptime?days=7")
    assert resp.status_code == 200
    data = resp.json()
    assert data["uptime_percent"] == 0.0
    assert data["total_datapoints"] == 0

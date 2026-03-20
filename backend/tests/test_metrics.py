import pytest
from httpx import AsyncClient
from app.models import Server, Metric


async def test_get_metrics_paginated(client: AsyncClient, sample_server, sample_metrics):
    resp = await client.get(f"/api/servers/{sample_server.id}/metrics?range=1h&limit=5&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] == 10
    assert len(data["items"]) == 5
    assert data["limit"] == 5
    assert data["offset"] == 0


async def test_get_metrics_offset(client: AsyncClient, sample_server, sample_metrics):
    resp = await client.get(f"/api/servers/{sample_server.id}/metrics?range=1h&limit=5&offset=5")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 5
    assert data["offset"] == 5


async def test_get_metrics_empty(client: AsyncClient, sample_server):
    resp = await client.get(f"/api/servers/{sample_server.id}/metrics?range=1h")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


async def test_get_metrics_invalid_range(client: AsyncClient, sample_server):
    resp = await client.get(f"/api/servers/{sample_server.id}/metrics?range=99h")
    assert resp.status_code == 422


async def test_export_csv(client: AsyncClient, sample_server, sample_metrics):
    resp = await client.get(f"/api/servers/{sample_server.id}/metrics/export?range=1h&format=csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    lines = resp.text.strip().split("\n")
    assert len(lines) == 11  # header + 10 rows
    assert "timestamp" in lines[0]


async def test_export_json(client: AsyncClient, sample_server, sample_metrics):
    resp = await client.get(f"/api/servers/{sample_server.id}/metrics/export?range=1h&format=json")
    assert resp.status_code == 200
    assert "application/json" in resp.headers["content-type"]
    data = resp.json()
    assert len(data) == 10
    assert "cpu_percent" in data[0]

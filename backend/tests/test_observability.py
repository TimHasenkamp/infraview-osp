import pytest
from httpx import AsyncClient


async def test_health_basic(unauthed_client: AsyncClient):
    resp = await unauthed_client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_health_detailed(unauthed_client: AsyncClient):
    resp = await unauthed_client.get("/api/health/detailed")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "checks" in data
    assert "database" in data["checks"]
    assert "agents" in data["checks"]
    assert "dashboards" in data["checks"]
    # DB should be reachable in test
    assert data["checks"]["database"]["status"] == "ok"
    # No agents connected in test
    assert data["checks"]["agents"]["connected"] == 0


async def test_prometheus_metrics(unauthed_client: AsyncClient):
    # Make a request first to populate counters
    await unauthed_client.get("/api/health")

    resp = await unauthed_client.get("/api/metrics")
    assert resp.status_code == 200
    body = resp.text
    # Should contain Prometheus format metrics
    assert "infraview_http_requests_total" in body
    assert "infraview_http_request_duration_seconds" in body
    assert "infraview_connected_agents" in body
    assert "infraview_connected_dashboards" in body
    assert "infraview_alerts_fired" in body
    assert "infraview_metrics_ingested" in body


async def test_trace_id_in_response(client: AsyncClient):
    resp = await client.get("/api/servers")
    assert "X-Trace-ID" in resp.headers
    assert len(resp.headers["X-Trace-ID"]) == 16


async def test_trace_id_forwarded(client: AsyncClient):
    custom_trace = "abcdef1234567890"
    resp = await client.get(
        "/api/servers",
        headers={"X-Trace-ID": custom_trace},
    )
    assert resp.headers["X-Trace-ID"] == custom_trace

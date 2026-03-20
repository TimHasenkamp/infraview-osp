import pytest
from httpx import AsyncClient
from app.models import AlertRule, AlertEvent


async def test_list_alerts_empty(client: AsyncClient):
    resp = await client.get("/api/alerts")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_alert(client: AsyncClient, sample_server):
    resp = await client.post("/api/alerts", json={
        "server_id": sample_server.id,
        "metric": "cpu_percent",
        "operator": ">",
        "threshold": 90,
        "severity": "critical",
        "cooldown_seconds": 120,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["metric"] == "cpu_percent"
    assert data["threshold"] == 90
    assert data["severity"] == "critical"
    assert "id" in data


async def test_update_alert(client: AsyncClient, sample_alert_rule):
    resp = await client.put(f"/api/alerts/{sample_alert_rule.id}", json={
        "threshold": 95,
        "enabled": False,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["threshold"] == 95
    assert data["enabled"] is False


async def test_update_alert_not_found(client: AsyncClient):
    resp = await client.put("/api/alerts/9999", json={"threshold": 50})
    assert resp.status_code == 404


async def test_delete_alert(client: AsyncClient, sample_alert_rule):
    resp = await client.delete(f"/api/alerts/{sample_alert_rule.id}")
    assert resp.status_code == 200
    # Verify it's gone
    resp2 = await client.get("/api/alerts")
    assert len(resp2.json()) == 0


async def test_delete_alert_not_found(client: AsyncClient):
    resp = await client.delete("/api/alerts/9999")
    assert resp.status_code == 404


async def test_list_alert_events_paginated(client: AsyncClient, sample_alert_event):
    resp = await client.get("/api/alerts/events?limit=10&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["severity"] == "warning"


async def test_list_alert_events_filter_severity(client: AsyncClient, sample_alert_event):
    resp = await client.get("/api/alerts/events?severity=critical")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

    resp2 = await client.get("/api/alerts/events?severity=warning")
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 1


async def test_acknowledge_event(client: AsyncClient, sample_alert_event):
    resp = await client.post(f"/api/alerts/events/{sample_alert_event.id}/acknowledge")
    assert resp.status_code == 200
    assert resp.json()["status"] == "acknowledged"


async def test_resolve_event(client: AsyncClient, sample_alert_event):
    resp = await client.post(f"/api/alerts/events/{sample_alert_event.id}/resolve")
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"


async def test_acknowledge_event_not_found(client: AsyncClient):
    resp = await client.post("/api/alerts/events/9999/acknowledge")
    assert resp.status_code == 404

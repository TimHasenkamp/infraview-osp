import pytest
from httpx import AsyncClient


async def test_get_settings(client: AsyncClient):
    resp = await client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "smtp_host" in data
    assert "smtp_port" in data
    assert "metric_retention_days" in data
    assert "downsample_enabled" in data
    assert "agent_timeout_seconds" in data
    # Check structure
    assert data["smtp_host"]["category"] == "email"
    assert data["metric_retention_days"]["category"] == "data"
    assert data["agent_timeout_seconds"]["category"] == "agent"
    assert "label" in data["smtp_host"]
    assert "type" in data["smtp_host"]


async def test_get_settings_masks_password(client: AsyncClient):
    # First set a password
    await client.put("/api/settings", json={
        "settings": {"smtp_pass": "secret123"}
    })
    resp = await client.get("/api/settings")
    data = resp.json()
    assert data["smtp_pass"]["value"] == "••••••••"


async def test_update_settings(client: AsyncClient):
    resp = await client.put("/api/settings", json={
        "settings": {
            "smtp_host": "mail.example.com",
            "smtp_port": "465",
            "metric_retention_days": "60",
        }
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "smtp_host" in data["updated"]
    assert "smtp_port" in data["updated"]
    assert "metric_retention_days" in data["updated"]

    # Verify values persisted
    resp = await client.get("/api/settings")
    data = resp.json()
    assert data["smtp_host"]["value"] == "mail.example.com"
    assert data["smtp_port"]["value"] == "465"
    assert data["metric_retention_days"]["value"] == "60"


async def test_update_settings_ignores_unknown_keys(client: AsyncClient):
    resp = await client.put("/api/settings", json={
        "settings": {"nonexistent_key": "value"}
    })
    assert resp.status_code == 200
    assert resp.json()["updated"] == []


async def test_update_settings_skips_masked_password(client: AsyncClient):
    # Set initial password
    await client.put("/api/settings", json={
        "settings": {"smtp_pass": "real_secret"}
    })
    # Send masked value back — should not overwrite
    await client.put("/api/settings", json={
        "settings": {"smtp_pass": "••••••••"}
    })
    # Set something else and check password wasn't wiped
    await client.put("/api/settings", json={
        "settings": {"smtp_host": "test.com"}
    })
    resp = await client.get("/api/settings")
    # Password should still be masked (meaning it still has a value)
    assert resp.json()["smtp_pass"]["value"] == "••••••••"


async def test_settings_requires_auth(unauthed_client: AsyncClient):
    resp = await unauthed_client.get("/api/settings")
    assert resp.status_code == 401

    resp = await unauthed_client.put("/api/settings", json={
        "settings": {"smtp_host": "evil.com"}
    })
    assert resp.status_code == 401

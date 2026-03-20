import pytest
from httpx import AsyncClient


async def test_login_success(unauthed_client: AsyncClient):
    resp = await unauthed_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"] == "admin"
    assert "infraview_token" in resp.cookies


async def test_login_wrong_password(unauthed_client: AsyncClient):
    resp = await unauthed_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert resp.status_code == 401


async def test_login_wrong_username(unauthed_client: AsyncClient):
    resp = await unauthed_client.post(
        "/api/auth/login",
        json={"username": "nobody", "password": "admin"},
    )
    assert resp.status_code == 401


async def test_logout(unauthed_client: AsyncClient):
    resp = await unauthed_client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_me_authenticated(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["user"] == "admin"


async def test_me_unauthenticated(unauthed_client: AsyncClient):
    resp = await unauthed_client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_protected_route_requires_auth(unauthed_client: AsyncClient):
    resp = await unauthed_client.get("/api/servers")
    assert resp.status_code == 401

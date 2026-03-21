import os
import pytest
from httpx import AsyncClient


async def test_create_backup(client: AsyncClient, tmp_path, monkeypatch):
    # Point DB_PATH and BACKUP_DIR to temp locations
    db_path = str(tmp_path / "test.db")
    backup_dir = str(tmp_path / "backups")

    # Create a fake DB file
    with open(db_path, "wb") as f:
        f.write(b"SQLite format 3\x00" + b"\x00" * 100)

    monkeypatch.setattr("app.api.backup.DB_PATH", db_path)
    monkeypatch.setattr("app.api.backup.BACKUP_DIR", backup_dir)

    resp = await client.post("/api/backup")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "filename" in data
    assert data["size_bytes"] > 0

    # Verify backup file exists
    assert os.path.exists(os.path.join(backup_dir, data["filename"]))


async def test_list_backups(client: AsyncClient, tmp_path, monkeypatch):
    backup_dir = str(tmp_path / "backups")
    os.makedirs(backup_dir)

    # Create fake backup files
    for name in ["backup_1.db", "backup_2.db"]:
        with open(os.path.join(backup_dir, name), "wb") as f:
            f.write(b"test")

    monkeypatch.setattr("app.api.backup.BACKUP_DIR", backup_dir)

    resp = await client.get("/api/backup/list")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["backups"]) == 2


async def test_list_backups_empty(client: AsyncClient, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.backup.BACKUP_DIR", str(tmp_path / "nonexistent"))

    resp = await client.get("/api/backup/list")
    assert resp.status_code == 200
    assert resp.json()["backups"] == []


async def test_download_backup(client: AsyncClient, tmp_path, monkeypatch):
    db_path = str(tmp_path / "test.db")
    content = b"SQLite format 3\x00" + b"\x00" * 100
    with open(db_path, "wb") as f:
        f.write(content)

    monkeypatch.setattr("app.api.backup.DB_PATH", db_path)

    resp = await client.get("/api/backup/download")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/octet-stream"
    assert len(resp.content) == len(content)


async def test_restore_backup(client: AsyncClient, tmp_path, monkeypatch):
    db_path = str(tmp_path / "test.db")
    backup_dir = str(tmp_path / "backups")

    # Create existing DB
    with open(db_path, "wb") as f:
        f.write(b"old data")

    monkeypatch.setattr("app.api.backup.DB_PATH", db_path)
    monkeypatch.setattr("app.api.backup.BACKUP_DIR", backup_dir)

    new_content = b"SQLite format 3 restored"

    resp = await client.post(
        "/api/backup/restore",
        files={"file": ("restore.db", new_content, "application/octet-stream")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["restored_size_bytes"] == len(new_content)

    # DB should have new content
    with open(db_path, "rb") as f:
        assert f.read() == new_content

    # Safety backup should exist
    assert os.path.exists(data["safety_backup"])


async def test_restore_rejects_non_db_file(client: AsyncClient):
    resp = await client.post(
        "/api/backup/restore",
        files={"file": ("data.txt", b"not a db", "text/plain")},
    )
    assert resp.status_code == 400


async def test_backup_requires_auth(unauthed_client: AsyncClient):
    resp = await unauthed_client.post("/api/backup")
    assert resp.status_code == 401

    resp = await unauthed_client.get("/api/backup/download")
    assert resp.status_code == 401

    resp = await unauthed_client.get("/api/backup/list")
    assert resp.status_code == 401

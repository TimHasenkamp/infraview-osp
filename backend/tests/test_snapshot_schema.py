"""Regression tests for snapshot/schema tolerance.

An agent with no pending package updates marshals its (nil) packages slice to
JSON null. The backend must coerce that to [] rather than rejecting the whole
snapshot, which previously caused a reconnect loop (every ~10s).
"""
from app.schemas.server import UpdatesInfoSchema
from app.schemas.ws_message import SystemSnapshot


def test_updates_packages_null_coerced_to_empty():
    u = UpdatesInfoSchema(packages=None)
    assert u.packages == []


def test_snapshot_accepts_updates_with_null_packages():
    payload = {
        "timestamp": 1,
        "hostname": "host",
        "agent_id": "agent",
        "cpu": {"usage_percent": 1.0, "core_count": 2, "per_core": []},
        "memory": {"usage_percent": 1.0, "total_bytes": 1, "used_bytes": 1, "avail_bytes": 1},
        "disk": {"usage_percent": 1.0, "total_bytes": 1, "used_bytes": 1, "free_bytes": 1, "path": "/"},
        "updates": {
            "available": 0,
            "security": 0,
            "packages": None,
            "apt_available": True,
            "package_manager": "apt",
        },
    }
    snap = SystemSnapshot(**payload)
    assert snap.updates is not None
    assert snap.updates.packages == []

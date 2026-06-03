"""Regression: the server response must include public_ip (it was omitted, so the
dashboard always showed '—' even though the agent reported and stored the IP)."""
from datetime import datetime
from types import SimpleNamespace
from app.api.servers import _build_server_response


def _server(**kw):
    base = dict(
        id="s1", hostname="h1", display_name=None, public_ip="203.0.113.7",
        status="online", last_seen=datetime.utcnow(), first_seen=datetime.utcnow(),
        cpu_cores=2, memory_total_bytes=1024, disk_total_bytes=2048, tags="",
        updates_available=0, agent_version=None, agent_update_available=False,
    )
    base.update(kw)
    return SimpleNamespace(**base)


def test_response_includes_public_ip():
    resp = _build_server_response(_server(), [], None)
    assert resp.public_ip == "203.0.113.7"


def test_response_public_ip_none_ok():
    resp = _build_server_response(_server(public_ip=None), [], None)
    assert resp.public_ip is None

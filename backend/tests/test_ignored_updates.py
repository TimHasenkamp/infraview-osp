"""Tests for the container-update ignore masking."""
from app.services.ignored_updates import mask_ignored


def test_mask_hides_update_when_version_matches():
    c = {"name": "nginx", "update_available": True, "latest_version": "1.27.1"}
    out = mask_ignored(c, {"nginx": "1.27.1"})
    assert out["update_available"] is False
    assert out["update_ignored"] is True


def test_mask_keeps_update_when_newer_version_appears():
    # Ignored 1.27.1 but a newer 1.27.2 is now offered -> still show it.
    c = {"name": "nginx", "update_available": True, "latest_version": "1.27.2"}
    out = mask_ignored(c, {"nginx": "1.27.1"})
    assert out["update_available"] is True
    assert out.get("update_ignored") in (False, None)


def test_mask_no_op_without_ignore_entry():
    c = {"name": "redis", "update_available": True, "latest_version": "8"}
    out = mask_ignored(c, {})
    assert out["update_available"] is True

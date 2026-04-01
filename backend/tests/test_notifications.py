"""
Tests for the notification service.

All external calls (SMTP, HTTP) are mocked — no real credentials needed.
The tests verify:
  - correct payload structure per channel (Discord, Slack, Gotify, generic webhook)
  - email construction
  - retry logic on transient failures
  - the /api/alerts/test-notification endpoint (integration)
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import Response

from app.services.notification_service import (
    _format_webhook_payload,
    send_webhook_alert,
    send_gotify_alert,
    send_email_alert,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_PAYLOAD = {
    "server_id": "my-server",
    "metric": "cpu_percent",
    "value": 92.5,
    "threshold": 80.0,
    "severity": "critical",
    "message": "cpu_percent is 92.5% (threshold: 80.0%) on my-server",
}

SAMPLE_PAYLOAD_WARNING = {**SAMPLE_PAYLOAD, "severity": "warning", "value": 85.0}


# ---------------------------------------------------------------------------
# _format_webhook_payload — unit tests (pure function, no IO)
# ---------------------------------------------------------------------------

class TestFormatDiscord:
    def test_has_embeds(self):
        body = _format_webhook_payload("https://discord.com/api/webhooks/123/abc", "discord", SAMPLE_PAYLOAD)
        assert "embeds" in body
        assert len(body["embeds"]) == 1

    def test_critical_color(self):
        body = _format_webhook_payload("https://discord.com/api/webhooks/123/abc", "discord", SAMPLE_PAYLOAD)
        assert body["embeds"][0]["color"] == 0xFF4444

    def test_warning_color(self):
        body = _format_webhook_payload("https://discord.com/api/webhooks/123/abc", "discord", SAMPLE_PAYLOAD_WARNING)
        assert body["embeds"][0]["color"] == 0xFFAA00

    def test_fields_present(self):
        body = _format_webhook_payload("https://discord.com/api/webhooks/123/abc", "discord", SAMPLE_PAYLOAD)
        field_names = [f["name"] for f in body["embeds"][0]["fields"]]
        assert "Server" in field_names
        assert "Metric" in field_names
        assert "Value" in field_names
        assert "Threshold" in field_names

    def test_server_and_metric_values(self):
        body = _format_webhook_payload("https://discord.com/api/webhooks/123/abc", "discord", SAMPLE_PAYLOAD)
        fields = {f["name"]: f["value"] for f in body["embeds"][0]["fields"]}
        assert fields["Server"] == "my-server"
        assert fields["Metric"] == "cpu_percent"
        assert fields["Value"] == "92.5%"
        assert fields["Threshold"] == "80.0%"

    def test_url_autodetect_when_channel_is_webhook(self):
        """Legacy: channel='webhook' but URL looks like Discord → should format as Discord."""
        body = _format_webhook_payload("https://discord.com/api/webhooks/123/abc", "webhook", SAMPLE_PAYLOAD)
        assert "embeds" in body


class TestFormatSlack:
    def test_has_blocks(self):
        body = _format_webhook_payload("https://hooks.slack.com/services/T/B/xyz", "slack", SAMPLE_PAYLOAD)
        assert "blocks" in body
        assert "text" in body

    def test_critical_emoji(self):
        body = _format_webhook_payload("https://hooks.slack.com/services/T/B/xyz", "slack", SAMPLE_PAYLOAD)
        assert ":rotating_light:" in body["text"]

    def test_warning_emoji(self):
        body = _format_webhook_payload("https://hooks.slack.com/services/T/B/xyz", "slack", SAMPLE_PAYLOAD_WARNING)
        assert ":warning:" in body["text"]

    def test_fields_present(self):
        body = _format_webhook_payload("https://hooks.slack.com/services/T/B/xyz", "slack", SAMPLE_PAYLOAD)
        section_fields = body["blocks"][1]["fields"]
        texts = [f["text"] for f in section_fields]
        assert any("my-server" in t for t in texts)
        assert any("cpu_percent" in t for t in texts)

    def test_url_autodetect_when_channel_is_webhook(self):
        """Legacy: channel='webhook' but URL looks like Slack → should format as Slack."""
        body = _format_webhook_payload("https://hooks.slack.com/services/T/B/xyz", "webhook", SAMPLE_PAYLOAD)
        assert "blocks" in body


class TestFormatGenericWebhook:
    def test_returns_payload_unchanged(self):
        body = _format_webhook_payload("https://my-server.com/hook", "webhook", SAMPLE_PAYLOAD)
        assert body == SAMPLE_PAYLOAD

    def test_none_channel_returns_payload(self):
        body = _format_webhook_payload("https://my-server.com/hook", "none", SAMPLE_PAYLOAD)
        assert body == SAMPLE_PAYLOAD


# ---------------------------------------------------------------------------
# send_webhook_alert — mock HTTP client
# ---------------------------------------------------------------------------

class TestSendWebhookAlert:
    async def test_discord_sends_post(self):
        mock_response = MagicMock(spec=Response)
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.notification_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await send_webhook_alert(
                "https://discord.com/api/webhooks/123/abc", "discord", SAMPLE_PAYLOAD
            )

        assert result is True
        mock_client.post.assert_called_once()
        call_kwargs = mock_client.post.call_args
        body = call_kwargs[1]["json"] if "json" in call_kwargs[1] else call_kwargs[0][1]
        assert "embeds" in body

    async def test_slack_sends_post(self):
        mock_response = MagicMock(spec=Response)
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.notification_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await send_webhook_alert(
                "https://hooks.slack.com/services/T/B/xyz", "slack", SAMPLE_PAYLOAD
            )

        assert result is True
        body = mock_client.post.call_args[1]["json"]
        assert "blocks" in body

    async def test_returns_false_on_http_error(self):
        with patch("app.services.notification_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=Exception("connection refused"))
            mock_client_cls.return_value = mock_client

            result = await send_webhook_alert(
                "https://discord.com/api/webhooks/123/abc", "discord", SAMPLE_PAYLOAD
            )

        assert result is False

    async def test_retries_on_transient_failure(self):
        """Should retry MAX_RETRIES times before giving up."""
        mock_response = MagicMock(spec=Response)
        mock_response.raise_for_status = MagicMock()

        call_count = 0

        async def flaky_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("transient error")
            return mock_response

        with patch("app.services.notification_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = flaky_post
            mock_client_cls.return_value = mock_client

            result = await send_webhook_alert(
                "https://discord.com/api/webhooks/123/abc", "discord", SAMPLE_PAYLOAD
            )

        assert result is True
        assert call_count == 3


# ---------------------------------------------------------------------------
# send_gotify_alert — mock HTTP client
# ---------------------------------------------------------------------------

class TestSendGotifyAlert:
    async def test_sends_to_message_endpoint(self):
        mock_response = MagicMock(spec=Response)
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.notification_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await send_gotify_alert(
                "https://gotify.example.com", "mytoken", "Test message", "critical"
            )

        assert result is True
        url, = mock_client.post.call_args[0]
        assert url.endswith("/message")

    def test_strips_trailing_slash_from_url(self):
        """URL with trailing slash should still produce a valid /message path."""
        # We just test the URL construction logic directly via the service
        # by checking the call — no real HTTP needed
        import asyncio

        mock_response = MagicMock(spec=Response)
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.notification_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            asyncio.get_event_loop().run_until_complete(
                send_gotify_alert("https://gotify.example.com/", "tok", "msg", "warning")
            )

        url = mock_client.post.call_args[0][0]
        assert url == "https://gotify.example.com/message"

    async def test_sets_auth_header(self):
        mock_response = MagicMock(spec=Response)
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.notification_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            await send_gotify_alert("https://gotify.example.com", "secret-token", "msg", "warning")

        headers = mock_client.post.call_args[1]["headers"]
        assert headers.get("X-Gotify-Key") == "secret-token"

    async def test_critical_has_higher_priority(self):
        mock_response = MagicMock(spec=Response)
        mock_response.raise_for_status = MagicMock()

        with patch("app.services.notification_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            await send_gotify_alert("https://gotify.example.com", "tok", "msg", "critical")
            critical_priority = mock_client.post.call_args[1]["json"]["priority"]

            await send_gotify_alert("https://gotify.example.com", "tok", "msg", "warning")
            warning_priority = mock_client.post.call_args[1]["json"]["priority"]

        assert critical_priority > warning_priority

    async def test_returns_false_without_token(self):
        result = await send_gotify_alert("https://gotify.example.com", None, "msg", "warning")
        assert result is False

    async def test_returns_false_on_error(self):
        with patch("app.services.notification_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=Exception("unreachable"))
            mock_client_cls.return_value = mock_client

            result = await send_gotify_alert("https://gotify.example.com", "tok", "msg", "warning")

        assert result is False


# ---------------------------------------------------------------------------
# send_email_alert — mock SMTP
# ---------------------------------------------------------------------------

class TestSendEmailAlert:
    async def test_sends_email(self):
        with patch("app.services.notification_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send, \
             patch("app.services.notification_service._get_smtp_config", new_callable=AsyncMock) as mock_cfg:
            mock_cfg.return_value = {
                "host": "smtp.example.com",
                "port": 587,
                "user": "user",
                "password": "pass",
                "from_email": "alerts@example.com",
            }

            result = await send_email_alert("dest@example.com", "Test alert", "critical")

        assert result is True
        mock_send.assert_called_once()

    async def test_subject_contains_severity(self):
        with patch("app.services.notification_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send, \
             patch("app.services.notification_service._get_smtp_config", new_callable=AsyncMock) as mock_cfg:
            mock_cfg.return_value = {
                "host": "smtp.example.com", "port": 587,
                "user": "u", "password": "p", "from_email": "f@e.com",
            }

            await send_email_alert("dest@example.com", "msg", "critical")

        msg = mock_send.call_args[0][0]
        assert "CRITICAL" in msg["Subject"]

    async def test_skips_when_smtp_not_configured(self):
        with patch("app.services.notification_service._get_smtp_config", new_callable=AsyncMock) as mock_cfg:
            mock_cfg.return_value = {
                "host": "", "port": 587, "user": "", "password": "", "from_email": "",
            }

            result = await send_email_alert("dest@example.com", "msg", "warning")

        assert result is False

    async def test_returns_false_on_smtp_error(self):
        with patch("app.services.notification_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send, \
             patch("app.services.notification_service._get_smtp_config", new_callable=AsyncMock) as mock_cfg:
            mock_cfg.return_value = {
                "host": "smtp.example.com", "port": 587,
                "user": "u", "password": "p", "from_email": "f@e.com",
            }
            mock_send.side_effect = Exception("SMTP connection refused")

            result = await send_email_alert("dest@example.com", "msg", "critical")

        assert result is False


# ---------------------------------------------------------------------------
# /api/alerts/test-notification — integration tests via HTTP client
# ---------------------------------------------------------------------------

class TestTestNotificationEndpoint:
    async def test_discord_returns_200_on_success(self, client):
        with patch("app.api.alerts.send_webhook_alert", new_callable=AsyncMock, return_value=True):
            resp = await client.post("/api/alerts/test-notification", json={
                "channel": "discord",
                "notify_webhook": "https://discord.com/api/webhooks/123/abc",
            })
        assert resp.status_code == 200
        assert resp.json()["status"] == "sent"

    async def test_slack_returns_200_on_success(self, client):
        with patch("app.api.alerts.send_webhook_alert", new_callable=AsyncMock, return_value=True):
            resp = await client.post("/api/alerts/test-notification", json={
                "channel": "slack",
                "notify_webhook": "https://hooks.slack.com/services/T/B/xyz",
            })
        assert resp.status_code == 200

    async def test_gotify_returns_200_on_success(self, client):
        with patch("app.api.alerts.send_gotify_alert", new_callable=AsyncMock, return_value=True):
            resp = await client.post("/api/alerts/test-notification", json={
                "channel": "gotify",
                "notify_webhook": "https://gotify.example.com",
                "gotify_token": "mytoken",
            })
        assert resp.status_code == 200

    async def test_email_returns_200_on_success(self, client):
        with patch("app.api.alerts.send_email_alert", new_callable=AsyncMock, return_value=True):
            resp = await client.post("/api/alerts/test-notification", json={
                "channel": "email",
                "notify_email": "test@example.com",
            })
        assert resp.status_code == 200

    async def test_generic_webhook_returns_200(self, client):
        with patch("app.api.alerts.send_webhook_alert", new_callable=AsyncMock, return_value=True):
            resp = await client.post("/api/alerts/test-notification", json={
                "channel": "webhook",
                "notify_webhook": "https://my-server.com/hook",
            })
        assert resp.status_code == 200

    async def test_returns_502_when_delivery_fails(self, client):
        with patch("app.api.alerts.send_webhook_alert", new_callable=AsyncMock, return_value=False):
            resp = await client.post("/api/alerts/test-notification", json={
                "channel": "discord",
                "notify_webhook": "https://discord.com/api/webhooks/123/abc",
            })
        assert resp.status_code == 502

    async def test_returns_400_for_none_channel(self, client):
        resp = await client.post("/api/alerts/test-notification", json={"channel": "none"})
        assert resp.status_code == 400

    async def test_returns_400_for_email_without_address(self, client):
        resp = await client.post("/api/alerts/test-notification", json={
            "channel": "email",
            "notify_email": None,
        })
        assert resp.status_code == 400

    async def test_requires_auth(self, unauthed_client):
        resp = await unauthed_client.post("/api/alerts/test-notification", json={
            "channel": "discord",
            "notify_webhook": "https://discord.com/api/webhooks/123/abc",
        })
        assert resp.status_code in (401, 403)

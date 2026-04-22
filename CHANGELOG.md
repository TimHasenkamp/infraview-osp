# Changelog

## v0.2.8 (2026-04-22)

### Features

- **Alert Rule bearbeiten** — Bestehende Alert Rules können direkt in der Tabelle über das Stift-Icon bearbeitet werden. Das Formular öffnet sich vorausgefüllt mit den aktuellen Werten.
- **Test-Notification Button** — Im Alert-Formular gibt es einen Test-Button, der eine Probe-Benachrichtigung an den konfigurierten Kanal sendet, ohne eine echte Rule zu speichern.
- **Notification Channels** — Alert Rules unterstützen jetzt Discord, Slack, Gotify, E-Mail und generische Webhooks über ein Dropdown. Kanal-spezifische Felder (Token, URL) erscheinen dynamisch.

### Fixes

- **Dropdown Dark Mode** — Native `<select>`-Elemente im Alert-Formular wurden durch base-ui Select-Komponenten ersetzt, die korrekt im Dark Mode dargestellt werden.

### Style

- **Brand-Farbe** — Primärfarbe auf `#00ce84` (Green) aktualisiert, ersetzt das vorherige Türkis durchgängig in allen UI-Elementen.

### Tests

- **Notification Test Suite** — 36 neue Tests für alle Notification-Kanäle: Payload-Struktur (Discord, Slack, Gotify, Webhook), E-Mail-Aufbau, Retry-Logik und den `/alerts/test-notification` Endpoint. Alle externen Aufrufe sind gemockt.

---

## v0.2.6 (2026-03-31)

### Fixes

- **Refresh-Button System Updates** — Nach Klick auf Refresh im Updates-Panel sendet der Agent sofort einen neuen Snapshot statt bis zum nächsten 5-Sekunden-Tick zu warten. Gleiches gilt für den Image-Refresh bei Containern.

---

## v0.2.5 (2026-03-31)

### Features

- **Agent rename** — Servers können im Dashboard umbenannt werden: auf der Server-Detailseite Hover über den Hostnamen → Stift-Icon → Inline-Edit. Der `display_name` wird überall angezeigt, der echte Hostname bleibt in Klammern sichtbar. Leer lassen setzt den Namen zurück auf den Hostnamen.

### Fixes

- **`INFRAVIEW_AGENT_ID`** — In allen Compose-Templates war `${HOSTNAME:-local}` gesetzt, was in Docker die Container-ID statt dem Servernamen liefert. Variable ist jetzt als Pflichtfeld in `.env` zu setzen; `.env.example` enthält einen entsprechenden Eintrag.

---

## v0.2.3 (2026-03-31)

### Fixes

- **WebSocket URL** — Frontend leitet die WebSocket-URL nun aus `window.location` ab statt aus `NEXT_PUBLIC_WS_URL`. Pre-built Images funktionieren damit auf jeder Domain ohne zusätzliche Konfiguration. `NEXT_PUBLIC_WS_URL` kann weiterhin als Override gesetzt werden, ist aber nicht mehr nötig.

---

## v0.2.2 (2026-03-31)

### Features

- **Agent self-update** — "Update Agent" button on the server detail page sends a WebSocket command to the agent; the agent updates itself and reconnects automatically
  - Docker mode: pulls latest image from GHCR, recreates the container under the original name (preserving Docker Compose labels), stops the old container
  - Native/systemd mode: downloads the new binary for the current architecture, replaces `/usr/local/bin/infraview-agent`, and restarts the service via `systemctl`
  - Status messages (`pulling`, `downloading`, `restarting`, `up_to_date`, `error`) are relayed back to the dashboard as toasts in real time
  - Button is only shown when the agent is online; locally-built (dev) containers are detected and blocked with a clear error

---

## v0.2.1 (2026-03-30)

### Features

- **Agent deploy dialog** — "Add Agent" button on the server overview opens a dialog with three tabs: Bash one-liner, Docker Compose file, and `.env` — all pre-filled with the correct backend URL and API key
- **Agent-only compose setup** — `deploy/compose/agent-only/` with a ready-to-use `docker-compose.yml` and `.env.example` for deploying the agent standalone on remote servers

### Fixes

- Docker image builds now work on `linux/arm64` and `linux/amd64`; `linux/arm/v7` dropped because `lightningcss` (Tailwind CSS 4) and Turbopack have no native binaries for 32-bit ARM
- Backend Docker image uses a multi-stage build to fix C-extension wheel compilation on ARM
- Frontend production builds use `--webpack` flag to avoid Turbopack on platforms without native bindings

---

## v0.2.0 (2026-03-30)

### Features

- **Container update GUI** — one-click image update from the dashboard; choose between "Update Container" (image only) or "Update + Compose" (image + compose file patch)
- **Compose file preview** — diff dialog shows old vs. new image tag with auto-scroll to the changed line before applying the update
- **Per-component refresh buttons** — every card on the server detail page (metrics, uptime, containers, processes, updates) has an individual refresh button for on-demand reload without a full page navigation
- **On-demand APT cache refresh** — agent exposes a WebSocket command to trigger `apt-get update` and return fresh package metadata

### Security

- Hardened auth: timing-safe password comparison, stricter JWT validation
- Input validation and sanitisation on all API endpoints
- CORS policy tightened to explicit allow-list
- Removed sensitive values from API responses and logs
- Updated vulnerable Go dependencies (otel-sdk, Docker SDK)

### Fixes

- Correct image URLs in all Docker Compose templates (dev, production, SSL)

### Documentation

- Overhauled README with architecture diagram, quick-start guide, and contribution section
- Added release guide

---

## v0.1.0 (2026-03-21)

Initial preview release of InfraView — a self-hosted, real-time server monitoring platform.

### Core

- Real-time server monitoring via WebSocket (CPU, memory, disk, network, load averages)
- Go-based monitoring agent with 5-second collection interval
- Python/FastAPI backend with SQLite persistence
- Next.js dashboard with live-updating metrics and charts

### Agent

- System metrics collection (CPU, memory, disk, network, load, processes)
- Docker container monitoring (list, start, stop, restart, logs)
- Docker image update detection via registry API (Docker Hub, GHCR, private registries)
- Health check endpoint (HTTP :8081/health)
- Structured logging with zerolog
- Graceful shutdown handling

### Backend

- RESTful API for servers, metrics, alerts, containers
- WebSocket handlers for agent and dashboard communication
- JWT authentication with secure first-login flow (auto-generated password)
- Alert engine with threshold-based rules and auto-resolve
- Slack/Discord webhook notifications with deduplication and cooldown
- SMTP email alert support (configurable via settings UI)
- Metric downsampling (5s -> 1min -> 5min -> 1h)
- Configurable retention policies
- Paginated API responses with CSV/JSON export
- Prometheus /metrics endpoint
- Request tracing with trace IDs
- Structured JSON logging
- Backup & restore API
- Auto-migration for schema changes

### Frontend

- Server overview dashboard with live metric gauges
- Server detail view with historical charts (Recharts)
- Container management (start/stop/restart, log viewer)
- Docker image update badges with target version
- Alert management (create, edit, acknowledge, resolve)
- Alert events history with filtering and pagination
- Dark/light theme toggle
- Server tagging and tag-based filtering
- Settings page (profile, SMTP, notifications, retention, agent keys)
- Mobile-responsive layout
- Uptime tracking with 30-day bar chart

### DevOps

- GitHub Actions CI pipeline (lint, test, build for all 3 services)
- GitHub Actions release pipeline (tag-triggered, multi-arch Docker builds)
- Docker Compose templates (dev, production with Traefik, custom SSL)
- Kubernetes manifests with Kustomize
- .dockerignore optimization
- Comprehensive test suite (backend: pytest, frontend: Vitest, agent: Go testing)

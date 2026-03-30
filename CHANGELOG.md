# Changelog

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

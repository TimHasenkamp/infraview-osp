# InfraView Roadmap

## Completed — v0.1 through v0.2.7

<details>
<summary>Phase 1–10 (click to expand)</summary>

### Core & Integration
- [x] Real API calls (servers, metrics, containers, alerts)
- [x] Container actions (start/stop/restart/update) full-stack
- [x] Container log viewer
- [x] Alert management with persistence
- [x] Toast notifications for WebSocket events

### Reliability
- [x] WebSocket heartbeat / ping-pong
- [x] Agent timeout detection (offline after missed heartbeat)
- [x] Retry logic with exponential backoff for notifications
- [x] Graceful shutdown across all services
- [x] Input validation on all endpoints

### Agent
- [x] CPU, memory, disk, network, load, process metrics
- [x] Docker container monitoring + image update detection
- [x] Agent self-update (Docker + systemd/native)
- [x] Public IP detection (api.ipify.org, cached on startup)
- [x] Health check endpoint (:8081/health)
- [x] Per-component refresh buttons (immediate snapshot after cache clear)
- [x] Agent rename / display name in dashboard

### Security & Auth
- [x] JWT authentication (httpOnly cookie)
- [x] API key for agents
- [x] CORS restriction, rate limiting
- [x] Timing-safe password comparison, strict JWT validation

### Alerting
- [x] Threshold-based rules (CPU, RAM, Disk)
- [x] Auto-resolve when metrics recover
- [x] Alert events history with ack/resolve workflow
- [x] Email, Slack, Discord, Gotify, generic webhook notifications
- [x] Cooldown / deduplication

### Data & Performance
- [x] Metric downsampling (5s → 1min → 5min → 1h)
- [x] Configurable retention policies
- [x] CSV/JSON data export
- [x] Paginated API responses

### CI/CD & Deployment
- [x] GitHub Actions CI (lint, test, build)
- [x] Tag-triggered release pipeline
- [x] Multi-arch Docker builds — amd64 + arm64 (native runners for frontend, no QEMU)
- [x] Docker Compose templates (dev, Traefik, Nginx SSL, Caddy, agent-only)
- [x] Kubernetes manifests (Kustomize)

### Observability
- [x] Prometheus /metrics endpoint
- [x] Request tracing with trace IDs
- [x] Structured JSON logging
- [x] Backup & restore API

### UX
- [x] Dark/light theme
- [x] Server tagging + tag-based filter
- [x] Uptime history (30-day bar chart)
- [x] Mobile-responsive layout
- [x] Docker image manager (list unused images, single + bulk delete)
- [x] Public IP card with copy button on server detail

</details>

---

## v0.3 — Multi-User, Deeper Monitoring & Production-Grade Quality

The theme for v0.3 is **team readiness** and **depth**. The tool currently works great for a single operator. v0.3 should make it production-ready for small teams and provide richer system insight.

---

### 🔐 Multi-User & Access Control

The biggest missing feature for anyone running InfraView in a team.

- [ ] **User management** — invite users, list/deactivate accounts (admin-only UI)
- [ ] **Role-based access control** — `admin` (full access) vs `viewer` (read-only, no actions)
- [ ] **Per-user API tokens** — for scripting / external integrations
- [ ] **Audit log** — track who triggered container actions, updates, deletes

---

### 📊 Deeper System Metrics

The current agent collects aggregate counters. More granular data would make it genuinely useful for diagnosing problems.

- [ ] **Disk I/O** — read/write bytes per second per disk (gopsutil already supports this)
- [ ] **Network interface breakdown** — per-interface traffic (not just total), with interface names and IP addresses
- [ ] **Container resource stats** — per-container CPU %, memory usage/limit (Docker stats API)
- [ ] **Temperature sensors** — CPU/GPU temp where available (nice-to-have, best-effort)
- [ ] **Chart series for new metrics** — Disk I/O and network rate on the metric chart

---

### 🔔 Smarter Alerting

The alert system is functional but simple. These additions would cover the majority of real-world use cases.

- [ ] **Container-based alerts** — trigger when a container stops, crashes, or restarts repeatedly
- [ ] **Telegram notifications** — very popular in the self-hosted community, straightforward bot API
- [ ] **Maintenance windows** — suppress alerts for a scheduled time range (e.g. during deployments)
- [ ] **Composite rules** — AND/OR conditions (e.g. CPU > 80% AND load > 4.0)
- [ ] **Escalation** — re-notify after N minutes if an alert is not acknowledged
- [ ] **Alert rule templates** — pre-filled sensible defaults (e.g. "Critical CPU", "Disk almost full")

---

### 🗂️ Database & Migrations

The current ad-hoc `ALTER TABLE ADD COLUMN` migrations are fragile and will break on more complex schema changes.

- [ ] **Alembic migrations** — replace the `_MIGRATIONS` list with proper versioned migration scripts
- [ ] **PostgreSQL support** — the backend uses SQLAlchemy + aiosqlite; adding asyncpg would make it viable for larger deployments
- [ ] **Schema versioning** — agent/backend compatibility check on connect (warn if version mismatch)

---

### 🧪 Testing & Quality

Current test coverage is good for a v0.1/v0.2 project but should be expanded before calling it v0.3.

- [ ] **End-to-end tests** (Playwright) — cover login → server detail → container action → alert flow
- [ ] **Integration tests for notifications** — verify Gotify/Discord/Slack payloads against their schemas
- [ ] **Image vulnerability scanning** — Trivy in CI, fail on HIGH/CRITICAL
- [ ] **Agent compatibility test** — run backend with old agent binary, verify graceful degradation

---

### ⚙️ Operations & Deployment

- [ ] **Automatic HTTPS** — built-in ACME/Let's Encrypt option without needing Traefik (similar to Caddy's approach)
- [ ] **One-command install script** — `curl | bash` that detects OS, installs backend+frontend via Docker, generates `.env`
- [ ] **Health dashboard** — admin page showing backend health, DB size, connected agents, notification delivery stats
- [ ] **Log streaming** — tail system journal / arbitrary log files from the dashboard (not just container logs)

---

### 🎨 UX Polish

Small but impactful improvements that come up in real use.

- [ ] **Metric annotations** — mark deployments or incidents on charts (vertical line + label)
- [ ] **Global search** — search across servers, containers, alert rules
- [ ] **Notification preferences per user** — each user chooses their own channel (once multi-user exists)
- [ ] **Server detail tabs** — split the long detail page into Overview / Containers / Logs / Alerts tabs
- [ ] **Keyboard shortcuts** — `R` to refresh, `?` for help overlay
- [ ] **Agent connection latency** — show round-trip time in the server header

---

### Priority order for v0.3

If bandwidth is limited, this is the suggested order:

1. **Alembic migrations** — foundational, unblocks everything else
2. **Multi-user + RBAC** — most requested feature for team setups
3. **Container alerts** — covers a major monitoring gap
4. **Disk I/O + per-container stats** — the most useful metric additions
5. **Telegram notifications** — high community demand, low effort
6. **Maintenance windows** — prevents alert fatigue
7. **E2E tests + Trivy** — quality gate before calling it v0.3
8. **One-command install** — lowers barrier for new users significantly

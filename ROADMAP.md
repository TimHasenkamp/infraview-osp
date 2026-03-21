# InfraView Roadmap

## Phase 1 — Core Integration (Frontend ↔ Backend) ✅

- [x] Replace mock data with real API calls (`getServers()`, `getServer()`, `getMetrics()`)
- [x] Wire up container actions (start/stop/restart) to actual API endpoints
- [x] Connect alert management (create/update/delete) to backend persistence
- [x] Add toast notifications for WebSocket alert events (sonner)
- [x] Handle loading & error states for all API calls
- [x] Container log viewer (full-stack: Agent → Backend → Frontend)

## Phase 2 — Reliability & Stability ✅

- [x] WebSocket heartbeat/ping-pong (agent ↔ backend ↔ dashboard)
- [x] Agent timeout detection — mark servers offline after missed heartbeats
- [x] Retry logic for failed notifications (email/webhook)
- [x] Notification deduplication via cooldown + asyncio.Lock
- [x] Graceful shutdown handling across all services
- [x] Input validation on all backend endpoints
- [x] WS connection status indicator in dashboard header

## Phase 3 — Agent Improvements ✅

- [x] Network metrics (bytes sent/recv, packets sent/recv)
- [x] System load averages (1m, 5m, 15m)
- [x] Health check endpoint on agent (HTTP :8081/health)
- [x] Full-stack integration (Agent → Backend → DB → API → Frontend)
- [x] Process-level monitoring (top 10 by CPU/memory, live via WebSocket)
- [x] Structured logging with zerolog (console writer, caller info, structured fields)
- [ ] Agent self-update mechanism

## Phase 4 — Authentication & Security ✅

- [x] API key authentication for agents (ENV-based, validated on WS connect)
- [x] User authentication for dashboard (JWT in httpOnly cookie + localStorage)
- [x] Login page with username/password
- [x] CORS restriction to known origins (configurable via ENV)
- [x] Rate limiting on API endpoints (100 req/min, 10/min on login)
- [x] WebSocket authentication token validation (agent key + dashboard JWT)
- [x] Logout button in header
- [ ] Role-based access control (admin / viewer)
- [ ] HTTPS/TLS enforcement

## Phase 5 — Alerting & Notifications ✅

- [x] Alert acknowledgement & resolution workflow (Ack/Resolve buttons)
- [x] Auto-resolve alerts when metrics recover
- [x] Alert events history page with status tracking
- [x] Slack / Discord webhook integration (auto-detected, formatted embeds)
- [ ] Composite alert rules (e.g. CPU > 80% AND Memory > 90%)
- [ ] Maintenance windows / alert suppression
- [ ] Escalation policies (notify → escalate after N minutes)
- [ ] Notification templates (customizable message format)

## Phase 6 — Data & Performance ✅

- [x] Metric downsampling (5s → 1min → 5min → 1h for older data)
- [x] Configurable retention policies (ENV-based)
- [x] Pagination on metrics and alert events endpoints
- [x] Data export (CSV/JSON)
- [ ] Database migration to PostgreSQL (optional, for multi-instance)
- [ ] Alembic migrations for schema versioning

## Phase 7 — Testing ✅

- [x] Backend unit tests (pytest) — API routes, auth, services, downsampling (39 tests)
- [x] Frontend component tests (Vitest + Testing Library) (26 tests)
- [x] Agent unit tests (Go testing) — config, health, collectors (14 tests)
- [ ] End-to-end tests (Playwright)

## Phase 8 — CI/CD & Deployment ✅

- [x] GitHub Actions CI pipeline (lint, test, build)
- [x] GitHub Actions release pipeline (tag-triggered)
- [x] Multi-architecture Docker builds (amd64 + arm64)
- [x] Kubernetes manifests (Deployment, Service, Ingress, ConfigMap, DaemonSet)
- [x] Kustomize for deployment
- [x] `.dockerignore` optimization
- [ ] Image vulnerability scanning (Trivy)
- [ ] Helm chart for configurable deployments
- [ ] Automated release versioning (semantic-release)

## Phase 9 — Observability & Operations ✅

- [x] Structured JSON logging (backend)
- [x] Prometheus `/metrics` endpoint on backend
- [x] Request tracing (trace IDs through HTTP middleware)
- [x] Backend health check with dependency status (DB, connected agents)
- [x] Backup & restore API (create, download, list, restore with safety backup)
- [x] Runbook documentation for common incidents

## Phase 10 — UX & Features ✅

- [x] Dark/light theme toggle (next-themes, Sun/Moon toggle in header)
- [x] Server grouping / tagging (comma-separated tags, filter bar on dashboard)
- [x] Mobile-responsive improvements (header, layout, scrollable tables)
- [x] Uptime history / SLA tracking (30-day bar chart, daily breakdown API)
- [ ] Dashboard customization (drag & drop widget layout)
- [ ] Multi-user notification preferences
- [ ] Metric annotations (mark deployments, incidents on charts)

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

## Phase 4 — Authentication & Security

- [ ] API key authentication for agents
- [ ] User authentication for dashboard (JWT or session-based)
- [ ] Role-based access control (admin / viewer)
- [ ] HTTPS/TLS enforcement
- [ ] CORS restriction to known origins
- [ ] Rate limiting on API endpoints
- [ ] WebSocket authentication token validation

## Phase 5 — Alerting & Notifications

- [ ] Composite alert rules (e.g. CPU > 80% AND Memory > 90%)
- [ ] Alert acknowledgement & resolution workflow
- [ ] Auto-resolve alerts when metrics recover
- [ ] Maintenance windows / alert suppression
- [ ] Escalation policies (notify → escalate after N minutes)
- [ ] Slack / Discord / Teams integration (native, not just webhook)
- [ ] Notification templates (customizable message format)

## Phase 6 — Data & Performance

- [ ] Database migration to PostgreSQL (optional, for multi-instance)
- [ ] Alembic migrations for schema versioning
- [ ] Metric downsampling (1min → 5min → 1h for older data)
- [ ] Configurable retention policies
- [ ] Pagination on all list endpoints
- [ ] Database query optimization & indexing for large datasets
- [ ] Data export (CSV/JSON)

## Phase 7 — Testing

- [ ] Backend unit tests (pytest) — API routes, services, models
- [ ] Backend integration tests — WebSocket handlers, alert evaluation
- [ ] Frontend component tests (Vitest + Testing Library)
- [ ] Agent unit tests (Go testing)
- [ ] End-to-end tests (Playwright)

## Phase 8 — CI/CD & Deployment

- [ ] GitHub Actions pipeline (lint, test, build, push images)
- [ ] Multi-architecture Docker builds (amd64 + arm64)
- [ ] Image vulnerability scanning (Trivy)
- [ ] Kubernetes manifests (Deployment, Service, Ingress, ConfigMap)
- [ ] Helm chart for configurable deployments
- [ ] Automated release versioning (semantic-release)
- [ ] `.dockerignore` optimization

## Phase 9 — Observability & Operations

- [ ] Structured JSON logging across all services
- [ ] Prometheus `/metrics` endpoint on backend
- [ ] Request tracing (trace IDs through WebSocket → API → DB)
- [ ] Backend health check with dependency status (DB, connected agents)
- [ ] Backup & restore strategy for SQLite/PostgreSQL
- [ ] Runbook documentation for common incidents

## Phase 10 — UX & Features

- [ ] Dashboard customization (drag & drop widget layout)
- [ ] Dark/light theme toggle
- [ ] Server grouping / tagging
- [ ] Multi-user notification preferences
- [ ] Metric annotations (mark deployments, incidents on charts)
- [ ] Mobile-responsive improvements
- [ ] Uptime history / SLA tracking

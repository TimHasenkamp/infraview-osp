# InfraView Roadmap

> **Scope:** A lightweight, self-hosted server monitoring tool for individuals and small setups.
> Think Uptime Kuma — simple to deploy, zero config overhead, immediately useful.

---

## Completed — v0.1 through v0.2.7

<details>
<summary>click to expand</summary>

- [x] Real-time metrics via WebSocket (CPU, RAM, Disk, Network, Load)
- [x] Go agent with 5-second collection interval, graceful shutdown
- [x] Docker container monitoring (list, start/stop/restart, logs)
- [x] Docker image update detection + one-click container update
- [x] Agent self-update (Docker + systemd)
- [x] Public IP display with copy button
- [x] Docker image manager (list unused images, bulk delete)
- [x] Threshold-based alerts (CPU, RAM, Disk)
- [x] Alert notifications: Email, Slack, Discord, Gotify, generic webhook
- [x] Alert events history with ack/resolve workflow, auto-resolve
- [x] Metric history charts with downsampling (5s → 1min → 5min → 1h)
- [x] Uptime history (30-day bar chart)
- [x] Process monitoring (top 10 by CPU/memory)
- [x] Server tagging + filter
- [x] Agent rename / display name
- [x] JWT authentication, API key for agents
- [x] Backup & restore API
- [x] Multi-arch Docker images (amd64 + arm64)
- [x] Docker Compose templates (Traefik, Nginx SSL, Caddy, agent-only)
- [x] Kubernetes manifests

</details>

---

## v0.3 — Depth & Polish

The goal is to make InfraView more complete as a day-to-day monitoring tool — better metrics, smarter alerts, and a smoother experience. No scope creep, no enterprise features.

---

### 📊 Richer Metrics

The agent currently collects top-level numbers. These additions give real diagnostic value without adding complexity.

- [ ] **Disk I/O** — read/write MB/s per disk, shown in the metric chart
- [ ] **Per-container resource usage** — CPU % and memory per container (Docker stats API)
- [ ] **Network interface breakdown** — per-interface traffic + IP addresses (not just totals)
- [ ] **Top processes refresh** — processes currently only show on initial snapshot; should update live like metrics

---

### 🔔 Smarter Alerting

- [ ] **Container crash alerts** — fire when a container stops unexpectedly or restart-loops
- [ ] **Telegram notifications** — simple bot API, very popular in the self-hosted community
- [ ] **Maintenance windows** — suppress alerts for a time range (e.g. during planned updates)
- [ ] **Re-notify / escalation** — send a follow-up after N minutes if an alert is still open and unacknowledged

---

### 🛠️ Operational Quality

- [ ] **One-command install** — `curl | bash` that detects OS, installs everything via Docker, generates `.env` automatically
- [ ] **Log streaming** — tail system journal or arbitrary log files from the dashboard, not just container logs
- [ ] **Agent version display** — show agent version on the server detail page, highlight when outdated
- [ ] **Image vulnerability scanning in CI** — Trivy on every release build, fail on CRITICAL

---

### 🎨 UX Polish

- [ ] **Server detail tabs** — split the long scroll into Overview / Containers / Logs / Alerts tabs
- [ ] **Metric annotations** — mark a deployment or incident on the chart (vertical line + note)
- [ ] **Global search** — find servers, containers, alert rules quickly from anywhere
- [ ] **Mobile: server detail** — the detail page currently isn't great on small screens

---

### Priority order

1. Container crash alerts — closes the biggest monitoring gap
2. Disk I/O + per-container stats — most useful metric additions for daily use
3. Telegram — low effort, high community demand
4. One-command install — lowers barrier to entry significantly
5. Server detail tabs — the page is getting long
6. Log streaming — replaces the need for SSH for common tasks
7. Maintenance windows — prevents alert fatigue
8. Metric annotations + global search — UX quality of life

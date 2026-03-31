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

### 🎨 UX & Quality of Life

**Navigation & Overview**
- [ ] **Server detail tabs** — split the long scroll into Overview / Containers / Logs / Alerts tabs
- [ ] **Global search** — find servers, containers, alert rules quickly from anywhere
- [ ] **Sort servers** — sort overview by name, CPU, RAM, status, last seen
- [ ] **Offline servers at the bottom** — online servers always first in the grid
- [ ] **Summary bar** — total servers / online / alerts active at a glance on the dashboard
- [ ] **Favorites / pinned servers** — pin important servers to always appear first

**Server Detail**
- [ ] **SSH quick-copy** — one-click copy of `ssh user@<public-ip>` command in the server header
- [ ] **Server notes** — freetext field per server for context (e.g. "production DB, do not restart")
- [ ] **Sticky metric cards** — keep the CPU/RAM/Disk/IP bar visible while scrolling the detail page
- [ ] **Metric annotations** — mark a deployment or incident on the chart (vertical line + label)
- [ ] **Mobile: server detail** — the detail page currently isn't great on small screens

**Alerts & Notifications**
- [ ] **Test notification button** — send a test message to verify a webhook/email is configured correctly, before saving the rule
- [ ] **Browser notifications** — Web Notifications API as an optional channel (no external service needed)
- [ ] **Alert sound** — optional ping when a new critical alert fires

**Containers**
- [ ] **Quick actions from overview** — restart/stop a container directly from the server card tooltip without navigating to the detail page
- [ ] **Container uptime** — show how long a container has been running
- [ ] **Filter containers** — search/filter by name or image on the container list

**Settings & Config**
- [ ] **Alert rule templates** — one-click presets like "High CPU (>85%)", "Disk almost full (>90%)", "RAM critical (>95%)" so users don't start from scratch
- [ ] **Configurable dashboard refresh interval** — let users choose 5s / 10s / 30s / manual
- [ ] **Theme: system default** — follow OS dark/light preference automatically (currently requires manual toggle)

**Developer / Power User**
- [ ] **Keyboard shortcuts** — `R` refresh current page, `G S` go to servers, `?` show shortcut overlay
- [ ] **Webhook payload preview** — show the exact JSON that will be sent when testing an alert notification
- [ ] **Metrics API documentation** — auto-generated OpenAPI docs already exist; link them from the settings page

---

### Priority order

1. Container crash alerts — closes the biggest monitoring gap
2. Disk I/O + per-container stats — most useful metric additions for daily use
3. Telegram — low effort, high community demand
4. Test notification button — saves a lot of frustration when setting up alerts
5. One-command install — lowers the barrier for new users significantly
6. Offline servers at the bottom + sort — obvious QoL for anyone with more than 3 servers
7. Server detail tabs — the page is getting long
8. SSH quick-copy + server notes — small but used constantly
9. Alert rule templates — reduces friction for new alert rules
10. Log streaming — reduces need for SSH for common tasks
11. Maintenance windows — prevents alert fatigue during planned work

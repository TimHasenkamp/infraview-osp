# InfraView

Lightweight, self-hosted server monitoring dashboard. An alternative to Prometheus + Grafana for small deployments (3-5 servers).

A Go agent runs on each server and streams system metrics via WebSocket to a FastAPI backend. The React dashboard shows everything in real-time.

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐     WebSocket      ┌─────────────┐
│   Go Agent  │ ─────────────────► │   FastAPI    │ ─────────────────► │  Next.js    │
│  (~5MB bin) │   metrics stream   │   Backend    │   live broadcast   │  Dashboard  │
└─────────────┘                    └─────────────┘                    └─────────────┘
     collects                        stores in                         renders
  CPU, RAM, Disk                   SQLite + alerts                   charts & cards
  + Docker containers
```

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend  | Python, FastAPI, SQLAlchemy (async), SQLite, WebSockets |
| Agent    | Go, gopsutil, Docker SDK, gorilla/websocket |
| Infra    | Docker, Docker Compose, Kubernetes, GitHub Actions |

## Features

- Real-time CPU, RAM, disk, network, and load monitoring with live charts
- Process monitoring (top 10 by CPU/memory)
- Docker container overview with start/stop/restart and log viewer
- Alert rules with email, Slack, and Discord webhook notifications
- Alert acknowledgement, resolution, and auto-resolve workflow
- Metric history with selectable time ranges (1h / 6h / 24h / 7d / 30d)
- Automatic metric downsampling (5s -> 1min -> 5min -> 1h)
- CSV/JSON data export
- Paginated API with filtering
- JWT authentication with rate limiting and auto-generated initial credentials
- Single Docker Compose deployment
- Kubernetes-ready with DaemonSet agent

## Quick Start (Production)

```bash
# Only JWT_SECRET_KEY and AGENT_API_KEY are required
export JWT_SECRET_KEY=$(openssl rand -hex 32)
export AGENT_API_KEY=$(openssl rand -hex 16)

docker compose up --build
```

On first startup, the backend generates a random admin password, prints it to the logs, and saves it to `data/initial_credentials.txt`:

```
============================================================
  INITIAL ADMIN CREDENTIALS
  Username: admin
  Password: aB3kX9mPq2wZ7nR4
  Saved to: data/initial_credentials.txt
============================================================
```

- Dashboard: http://localhost:3000
- Backend API: http://localhost:8000

You can change the password later via the API (`POST /api/auth/change-password`).

---

## Development Setup

### Prerequisites (all platforms)

- Docker & Docker Compose
- Node.js 20+ with pnpm
- Python 3.12+
- Go 1.25+

---

### macOS

**Install dependencies:**

```bash
# Homebrew
brew install node go python@3.12 docker

# pnpm
corepack enable && corepack prepare pnpm@latest --activate

# Docker Desktop
# Download from https://www.docker.com/products/docker-desktop/
# or: brew install --cask docker
```

**Option A — Docker Compose (recommended):**

```bash
docker compose -f docker-compose.dev.yml up --build
```

Frontend and backend have hot-reload via volume mounts. No rebuild needed for code changes.

**Option B — Native (all services locally):**

```bash
# Terminal 1: Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Agent
cd agent
export INFRAVIEW_BACKEND_URL=ws://localhost:8000/ws/agent
export INFRAVIEW_AGENT_ID=dev-mac
export INFRAVIEW_INTERVAL=5
go run ./cmd/agent/

# Terminal 3: Frontend
pnpm install
pnpm dev
```

**Docker container monitoring (native):**

The agent auto-detects Docker via `/var/run/docker.sock`. If Docker Desktop is running, container monitoring works out of the box. Without Docker, the agent falls back to system metrics only.

---

### Linux (Ubuntu/Debian)

**Install dependencies:**

```bash
# System packages
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3-pip

# Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable && corepack prepare pnpm@latest --activate

# Go
wget https://go.dev/dl/go1.26.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.26.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

**Option A — Docker Compose (recommended):**

```bash
docker compose -f docker-compose.dev.yml up --build
```

**Option B — Native:**

```bash
# Terminal 1: Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Agent
cd agent
export INFRAVIEW_BACKEND_URL=ws://localhost:8000/ws/agent
export INFRAVIEW_AGENT_ID=dev-linux
export INFRAVIEW_INTERVAL=5
go run ./cmd/agent/

# Terminal 3: Frontend
pnpm install
pnpm dev
```

**Docker container monitoring (native):**

Works out of the box on Linux. The agent reads `/var/run/docker.sock` directly. Make sure your user is in the `docker` group.

---

### Windows (WSL2)

**Prerequisites:**

1. Install [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) with Ubuntu:
   ```powershell
   wsl --install -d Ubuntu
   ```

2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and enable WSL2 integration under Settings > Resources > WSL Integration.

**Install dependencies (inside WSL):**

```bash
# System packages
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3-pip

# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable && corepack prepare pnpm@latest --activate

# Go
wget https://go.dev/dl/go1.26.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.26.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
```

**Option A — Docker Compose (recommended):**

```bash
# Run from WSL terminal, NOT from Windows cmd/PowerShell
cd /mnt/c/Users/<YourUser>/Desktop/infraview-osp
docker compose -f docker-compose.dev.yml up --build
```

**Option B — Native (inside WSL):**

```bash
# Clone/copy repo into WSL filesystem for better performance
cp -r /mnt/c/Users/<YourUser>/Desktop/infraview-osp ~/infraview-osp
cd ~/infraview-osp

# Terminal 1: Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Agent
cd agent
export INFRAVIEW_BACKEND_URL=ws://localhost:8000/ws/agent
export INFRAVIEW_AGENT_ID=dev-wsl
export INFRAVIEW_INTERVAL=5
go run ./cmd/agent/

# Terminal 3: Frontend
pnpm install
pnpm dev
```

**Important notes for WSL:**

- For best I/O performance, work from the WSL filesystem (`~/`) instead of the Windows mount (`/mnt/c/`). File watching and hot-reload are significantly faster.
- Docker container monitoring works if Docker Desktop has WSL integration enabled. The Docker socket is available at `/var/run/docker.sock` inside WSL.
- Ports forwarded from WSL (3000, 8000) are accessible from Windows at `localhost`.

---

## Development Workflow

| Command | Description |
|---------|-------------|
| `docker compose -f docker-compose.dev.yml up --build` | Start all services with hot-reload |
| `docker compose -f docker-compose.dev.yml up --build agent` | Rebuild only the agent (after Go changes) |
| `docker compose -f docker-compose.dev.yml down` | Stop all services |
| `pnpm dev` | Frontend only (needs backend running) |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run frontend tests (Vitest) |
| `cd backend && pytest tests/ -v` | Run backend tests (pytest) |
| `cd agent && go test ./... -v` | Run agent tests |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:8000` | Backend URL for frontend proxy |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000/ws/dashboard` | WebSocket URL for live updates |
| `DATABASE_URL` | `sqlite+aiosqlite:///data/infraview.db` | Backend database connection |
| `INFRAVIEW_BACKEND_URL` | `ws://localhost:8000/ws/agent` | Agent WebSocket target |
| `INFRAVIEW_AGENT_ID` | hostname | Unique server identifier |
| `INFRAVIEW_INTERVAL` | `5` | Metric collection interval (seconds) |
| `INFRAVIEW_DISK_PATH` | `/` | Disk mount point to monitor |
| `SMTP_HOST` | — | SMTP server for email alerts |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `ALERT_FROM_EMAIL` | — | Sender address for alert emails |
| `JWT_SECRET_KEY` | `change-me-in-production` | Secret for JWT token signing |
| `ADMIN_USER` | `admin` | Dashboard login username |
| `AGENT_API_KEY` | `change-me-in-production` | API key for agent authentication |
| `METRIC_RETENTION_DAYS` | `30` | Days before metrics are pruned |
| `DOWNSAMPLE_ENABLED` | `true` | Enable automatic metric downsampling |
| `DOWNSAMPLE_1MIN_AFTER_HOURS` | `6` | Aggregate to 1min averages after N hours |
| `DOWNSAMPLE_5MIN_AFTER_HOURS` | `48` | Aggregate to 5min averages after N hours |
| `DOWNSAMPLE_1H_AFTER_HOURS` | `168` | Aggregate to 1h averages after N hours |

## Deployment Templates

Vorgefertigte Docker Compose Konfigurationen unter [`deploy/compose/`](deploy/compose/):

| Template | Datei | Beschreibung |
|----------|-------|-------------|
| **Traefik** | `docker-compose.traefik.yml` | Automatisches Let's Encrypt SSL |
| **Caddy** | `docker-compose.caddy.yml` | Zero-Config HTTPS (einfachste Option) |
| **nginx + eigenes Zertifikat** | `docker-compose.nginx-ssl.yml` | Eigenes SSL-Zertifikat mitbringen |
| **Agent only** | `docker-compose.agent-only.yml` | Nur Agent auf Remote-Servern |

**Beispiel mit Caddy (empfohlen):**

```bash
cd deploy/compose
export DOMAIN=monitor.example.com
export JWT_SECRET_KEY=$(openssl rand -hex 32)
export AGENT_API_KEY=$(openssl rand -hex 16)
docker compose -f docker-compose.caddy.yml up -d
```

**Beispiel mit eigenem Zertifikat:**

```bash
cd deploy/compose
mkdir certs
cp /path/to/fullchain.pem certs/
cp /path/to/privkey.pem certs/
export DOMAIN=monitor.example.com
export JWT_SECRET_KEY=$(openssl rand -hex 32)
export AGENT_API_KEY=$(openssl rand -hex 16)
docker compose -f docker-compose.nginx-ssl.yml up -d
```

**Remote-Server Agent:**

```bash
export BACKEND_HOST=monitor.example.com
export AGENT_API_KEY=your-agent-key
docker compose -f docker-compose.agent-only.yml up -d
```

## CI/CD

Push/PR to `main` triggers the CI pipeline (`.github/workflows/ci.yml`):
1. **Backend Tests** — pytest with coverage
2. **Frontend Lint & Tests** — ESLint + Vitest
3. **Agent Tests** — Go test with coverage
4. **Docker Build** — all 3 images (build-only, no push)

Tagging a release (`git tag v1.0.0 && git push --tags`) triggers the release pipeline (`.github/workflows/release.yml`):
- Multi-arch builds (amd64 + arm64)
- Push to GitHub Container Registry (`ghcr.io`)
- Semantic version tags (`v1.0.0`, `v1.0`, SHA)

## Kubernetes Deployment

```bash
# Edit deploy/k8s/secret.yml with your credentials
# Replace OWNER in image references with your GitHub username

kubectl apply -k deploy/k8s/
```

Components:
- **Backend**: Deployment + Service + PVC (1Gi for SQLite)
- **Frontend**: Deployment + Service
- **Agent**: DaemonSet (runs on every node, hostPID for process monitoring)
- **Ingress**: nginx with WebSocket support

See [deploy/k8s/](deploy/k8s/) for all manifests.

## Deploying the Agent

The agent can be deployed independently on any server you want to monitor.

**As Docker container:**

```bash
docker run -d \
  --pid=host \
  -e INFRAVIEW_BACKEND_URL=ws://your-backend:8000/ws/agent \
  -e INFRAVIEW_AGENT_ID=server-01 \
  -e INFRAVIEW_API_KEY=your-agent-key \
  -e HOST_PROC=/host/proc \
  -v /proc:/host/proc:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  infraview-agent
```

> `--pid=host` and `/proc` mount are required for process monitoring.

**As standalone binary (~5MB):**

```bash
cd agent
CGO_ENABLED=0 go build -ldflags="-s -w" -o infraview-agent ./cmd/agent/
scp infraview-agent user@server:/usr/local/bin/
```

## Project Structure

```
infraview-osp/
├── app/                    # Next.js frontend
│   ├── _components/        # React components
│   ├── _hooks/             # Custom hooks (WebSocket)
│   ├── _lib/               # Types, utils, API client
│   ├── _providers/         # Context providers
│   ├── alerts/             # Alert management page
│   ├── api/proxy/          # API proxy route
│   └── servers/[id]/       # Server detail page
├── backend/                # FastAPI backend
│   └── app/
│       ├── api/            # REST endpoints
│       ├── models/         # SQLAlchemy models
│       ├── schemas/        # Pydantic schemas
│       ├── services/       # Alert & notification logic
│       └── ws/             # WebSocket handlers
├── agent/                  # Go monitoring agent
│   ├── cmd/agent/          # Entry point
│   └── internal/
│       ├── collector/      # System metrics (CPU, RAM, Disk)
│       ├── config/         # Environment config
│       ├── container/      # Docker integration
│       └── transport/      # WebSocket client
├── components/ui/          # shadcn/ui components
├── tests/                  # Frontend tests (Vitest)
├── deploy/k8s/             # Kubernetes manifests
├── deploy/compose/         # Docker Compose templates (Traefik, Caddy, nginx)
├── .github/workflows/      # CI/CD pipelines
├── docker-compose.yml      # Production setup
└── docker-compose.dev.yml  # Development setup (hot-reload)
```

## Testing

See [TESTING.md](TESTING.md) for details on running tests.

| Suite | Framework | Count | Command |
|-------|-----------|-------|---------|
| Backend | pytest | 57 | `cd backend && pytest tests/ -v` |
| Frontend | Vitest | 26 | `pnpm test` |
| Agent | Go test | 14 | `cd agent && go test ./... -v` |

## Observability

**Structured Logging** — Backend logs in JSON format with trace IDs:
```json
{"timestamp":"2026-03-20T20:00:00Z","level":"info","logger":"app.main","message":"GET /api/servers 200 (12.3ms)","trace_id":"a1b2c3d4e5f6g7h8","method":"GET","path":"/api/servers","status_code":200,"duration_ms":12.3}
```

**Prometheus Metrics** — `GET /api/metrics` (no auth required):
- `infraview_http_requests_total` — request count by method/path/status
- `infraview_http_request_duration_seconds` — request latency histogram
- `infraview_connected_agents` — current agent connections
- `infraview_connected_dashboards` — current dashboard connections
- `infraview_alerts_fired_total` — alerts by severity
- `infraview_metrics_ingested_total` — snapshots received from agents

**Health Checks:**
- `GET /api/health` — basic liveness check
- `GET /api/health/detailed` — DB, agents, dashboards status

**Request Tracing** — every response includes `X-Trace-ID`. Pass `X-Trace-ID` header to correlate requests.

**Backup & Restore:**
- `POST /api/backup` — create backup
- `GET /api/backup/download` — download DB file
- `GET /api/backup/list` — list available backups
- `POST /api/backup/restore` — restore from uploaded .db file (auto-creates safety backup)

See [RUNBOOK.md](RUNBOOK.md) for troubleshooting common issues.

## License

MIT

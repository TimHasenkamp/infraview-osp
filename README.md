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
| Infra    | Docker, Docker Compose                  |

## Features

- Real-time CPU, RAM, and disk monitoring with live charts
- Docker container overview with start/stop/restart actions
- Alert rules with email and webhook notifications
- Multi-server dashboard with status indicators
- Metric history with selectable time ranges (1h / 6h / 24h / 7d)
- Single Docker Compose deployment

## Quick Start (Production)

```bash
cp .env.example .env
docker compose up --build
```

- Dashboard: http://localhost:3000
- Backend API: http://localhost:8000
- API Health: http://localhost:8000/api/health

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
cp .env.example .env.local
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
cp .env.example .env.local
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
cp .env.example .env.local
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

## Deploying the Agent

The agent can be deployed independently on any server you want to monitor.

**As Docker container:**

```bash
docker run -d \
  -e INFRAVIEW_BACKEND_URL=ws://your-backend:8000/ws/agent \
  -e INFRAVIEW_AGENT_ID=server-01 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  infraview-agent
```

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
├── docker-compose.yml      # Production setup
└── docker-compose.dev.yml  # Development setup (hot-reload)
```

## License

MIT

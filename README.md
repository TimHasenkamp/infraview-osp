<p align="center">
  <h1 align="center">InfraView</h1>
  <p align="center">
    Lightweight, self-hosted server monitoring for small deployments.
    <br />
    An alternative to Prometheus + Grafana when you just need to watch 3–5 servers.
  </p>
  <p align="center">
    <a href="https://github.com/TimHasenkamp/infraview-osp/actions"><img src="https://github.com/TimHasenkamp/infraview-osp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="https://github.com/TimHasenkamp/infraview-osp/releases"><img src="https://img.shields.io/github/v/release/TimHasenkamp/infraview-osp?include_prereleases" alt="Release"></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/TimHasenkamp/infraview-osp" alt="License"></a>
  </p>
</p>

---

## What is InfraView?

A Go agent runs on each server and streams system metrics via WebSocket to a FastAPI backend. The Next.js dashboard shows everything in real-time — no Prometheus, no Grafana, no YAML config files.

```
┌─────────────┐     WebSocket      ┌─────────────┐     WebSocket      ┌─────────────┐
│   Go Agent  │ ─────────────────► │   FastAPI    │ ─────────────────► │  Next.js    │
│  (~5MB bin) │   metrics stream   │   Backend    │   live broadcast   │  Dashboard  │
└─────────────┘                    └─────────────┘                    └─────────────┘
     collects                        stores in                         renders
  CPU, RAM, Disk                   SQLite + alerts                   charts & cards
  + Docker containers
```

## Features

- **Real-time monitoring** — CPU, memory, disk, network, load averages with 5s resolution
- **Docker management** — container list, start/stop/restart, log viewer, image update detection
- **Alerting** — threshold rules with auto-resolve, email/Slack/Discord notifications
- **Zero-config startup** — auto-generated admin password, no `.env` file needed
- **Dark/light theme** — toggle in header
- **Server tagging** — group and filter servers by custom tags
- **Uptime tracking** — 30-day history with daily breakdown
- **Data management** — metric downsampling, CSV/JSON export, backup & restore
- **Observability** — Prometheus endpoint, structured JSON logging, request tracing

## Quick Start

```bash
docker compose up -d
```

Find your initial admin password in the logs:

```bash
docker compose logs backend | grep "Password"
```

Open http://localhost:3000 and log in.

> For production, set `JWT_SECRET_KEY` and `AGENT_API_KEY`:
> ```bash
> export JWT_SECRET_KEY=$(openssl rand -hex 32)
> export AGENT_API_KEY=$(openssl rand -hex 16)
> docker compose up -d
> ```

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend  | Python, FastAPI, SQLAlchemy (async), SQLite, WebSockets |
| Agent    | Go, gopsutil, Docker SDK, gorilla/websocket |
| Infra    | Docker, Docker Compose, Kubernetes, GitHub Actions |

## Deploying the Agent

The agent runs on every server you want to monitor.

**Docker (recommended):**

```bash
docker run -d \
  --pid=host \
  -e INFRAVIEW_BACKEND_URL=ws://your-backend:8000/ws/agent \
  -e INFRAVIEW_AGENT_ID=server-01 \
  -e INFRAVIEW_API_KEY=your-agent-key \
  -e HOST_PROC=/host/proc \
  -v /proc:/host/proc:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/timhasenkamp/infraview-osp-agent:v0.1.0
```

**Standalone binary (~5MB):**

```bash
cd agent
CGO_ENABLED=0 go build -ldflags="-s -w" -o infraview-agent ./cmd/agent/
scp infraview-agent user@server:/usr/local/bin/
```

## Deployment Options

Pre-built Docker Compose templates in [`deploy/compose/`](deploy/compose/):

| Template | Description |
|----------|-------------|
| `docker-compose.traefik.yml` | Automatic Let's Encrypt SSL |
| `docker-compose.caddy.yml` | Zero-config HTTPS (simplest) |
| `docker-compose.nginx-ssl.yml` | Bring your own SSL certificate |
| `docker-compose.agent-only.yml` | Agent only for remote servers |

**Example with Caddy:**

```bash
cd deploy/compose
export DOMAIN=monitor.example.com
export JWT_SECRET_KEY=$(openssl rand -hex 32)
export AGENT_API_KEY=$(openssl rand -hex 16)
docker compose -f docker-compose.caddy.yml up -d
```

**Kubernetes:**

```bash
kubectl apply -k deploy/k8s/
```

See [deploy/k8s/](deploy/k8s/) for all manifests (Deployment, DaemonSet, Ingress, PVC).

## Development

**Prerequisites:** Docker, Node.js 20+ with pnpm, Python 3.12+, Go 1.25+

```bash
# Docker Compose with hot-reload
docker compose -f docker-compose.dev.yml up --build
```

Or run services individually:

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Agent
cd agent && go run ./cmd/agent/

# Frontend
pnpm install && pnpm dev
```

| Command | Description |
|---------|-------------|
| `pnpm dev` | Frontend dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Frontend tests (Vitest) |
| `cd backend && pytest tests/ -v` | Backend tests (pytest) |
| `cd agent && go test ./... -v` | Agent tests (Go) |

See [TESTING.md](TESTING.md) for full test documentation.

## Configuration

All settings can be managed via the Settings page in the dashboard. Environment variables are only needed for initial setup:

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET_KEY` | `change-me-in-production` | JWT signing secret |
| `AGENT_API_KEY` | `change-me-in-production` | Agent authentication key |
| `DATABASE_URL` | `sqlite+aiosqlite:///data/infraview.db` | Database connection |
| `METRIC_RETENTION_DAYS` | `30` | Days before metrics are pruned |

See the [full environment variable reference](docs/ENVIRONMENT.md) for all options.

## CI/CD

- **Push/PR to `main`** triggers CI: lint, test, build (all 3 services)
- **Git tag `v*`** triggers release: multi-arch Docker builds, push to GHCR

See [docs/RELEASE.md](docs/RELEASE.md) for the release process.

## Project Structure

```
infraview-osp/
├── app/                    # Next.js frontend
│   ├── _components/        # React components
│   ├── _hooks/             # Custom hooks (WebSocket)
│   ├── _lib/               # Types, utils, API client
│   └── _providers/         # Context providers (auth, WS)
├── backend/                # FastAPI backend
│   └── app/
│       ├── api/            # REST endpoints
│       ├── models/         # SQLAlchemy models
│       ├── schemas/        # Pydantic schemas
│       ├── services/       # Alert & notification logic
│       └── ws/             # WebSocket handlers
├── agent/                  # Go monitoring agent
│   ├── cmd/agent/          # Entry point
│   └── internal/           # Collector, config, Docker, transport
├── deploy/                 # Deployment configs
│   ├── compose/            # Docker Compose templates
│   └── k8s/                # Kubernetes manifests
└── .github/workflows/      # CI/CD pipelines
```

## Contributing

Contributions are welcome! This project is in early development (v0.x) — feedback, bug reports, and feature requests are especially helpful.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please use [conventional commits](https://www.conventionalcommits.org/) for commit messages.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and progress.

## License

[MIT](LICENSE)

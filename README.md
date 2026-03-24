# InfraView

> Lightweight, self-hosted server monitoring for small deployments.
> An open-source alternative to Prometheus + Grafana when you just need to watch 3–5 servers.

[![CI](https://github.com/TimHasenkamp/infraview-osp/actions/workflows/ci.yml/badge.svg)](https://github.com/TimHasenkamp/infraview-osp/actions)
[![Release](https://img.shields.io/github/v/release/TimHasenkamp/infraview-osp?include_prereleases)](https://github.com/TimHasenkamp/infraview-osp/releases)
[![License](https://img.shields.io/github/license/TimHasenkamp/infraview-osp)](LICENSE)

---

## How it works

A Go agent runs on each server and streams system metrics via WebSocket to a FastAPI backend.
The Next.js dashboard shows everything in real-time — no Prometheus, no Grafana, no YAML config files.

![Architecture](docs/assets/architecture.svg)

## Features

- **Real-time monitoring** — CPU, memory, disk, network, load averages with 5s resolution
- **Docker management** — container list, start/stop/restart, log viewer, image update detection
- **Alerting** — threshold rules with auto-resolve, email/Slack/Discord notifications
- **Zero-config startup** — auto-generated admin password, no `.env` file needed
- **Dark/light theme** — toggle in header
- **Server tagging** — group and filter servers by custom tags
- **Uptime tracking** — 30-day history with daily breakdown

---

## Quick Start

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and Docker Compose

```bash
# 1. Download the compose file and example config
mkdir infraview && cd infraview
curl -fsSL https://raw.githubusercontent.com/TimHasenkamp/infraview-osp/main/docker-compose.yml -o docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/TimHasenkamp/infraview-osp/main/.env.example -o .env

# 2. Start all services
docker compose up -d
```

Find your auto-generated admin password in the logs:

```bash
docker compose logs backend | grep "Password"
```

Open <http://localhost:3000> and log in.

> **Production deployment** — generate secure secrets before going live:
>
> ```bash
> # Replace the placeholder values in .env
> sed -i "s/change-me-jwt/$(openssl rand -hex 32)/" .env
> sed -i "s/change-me-agent/$(openssl rand -hex 16)/" .env
> docker compose up -d
> ```

Alternatively, clone the full repository if you want to build from source or contribute:

```bash
git clone https://github.com/TimHasenkamp/infraview-osp.git
cd infraview-osp && cp .env.example .env && docker compose up -d
```

---

## Production Deployment with HTTPS

Choose a reverse proxy and download the matching Compose file:

| Proxy   | Best for                                |
| ------- | --------------------------------------- |
| Caddy   | Simplest setup, auto SSL (recommended)  |
| Traefik | Already using Traefik, advanced routing |
| nginx   | Bring-your-own certificate              |

```bash
BASE=https://raw.githubusercontent.com/TimHasenkamp/infraview-osp/main/deploy/compose

# Pick one:
curl -fsSL $BASE/docker-compose.caddy.yml    -o docker-compose.yml   # Caddy (recommended)
curl -fsSL $BASE/docker-compose.traefik.yml  -o docker-compose.yml   # Traefik
curl -fsSL $BASE/docker-compose.nginx-ssl.yml -o docker-compose.yml  # nginx

# Download the env template and fill in your values
curl -fsSL $BASE/.env.example -o .env
# edit .env: set DOMAIN, JWT_SECRET_KEY, AGENT_API_KEY (+ ACME_EMAIL for Traefik)

docker compose up -d
docker compose logs backend | grep "Password"
```

> **nginx only:** place your certificate files before starting:
>
> ```bash
> mkdir certs
> cp /path/to/fullchain.pem certs/
> cp /path/to/privkey.pem   certs/
> ```

---

## Tech Stack

| Layer    | Technology                                                          |
| -------- | ------------------------------------------------------------------- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend  | Python, FastAPI, SQLAlchemy (async), SQLite, WebSockets             |
| Agent    | Go, gopsutil, Docker SDK, gorilla/websocket                         |
| Infra    | Docker, Docker Compose, GitHub Actions                              |

---

## Deploying the Agent

The agent runs on every server you want to monitor.

**Docker (recommended):**

```bash
docker run -d \
  --pid=host \
  --network=host \
  -e INFRAVIEW_BACKEND_URL=ws://your-backend:8000/ws/agent \
  -e INFRAVIEW_AGENT_ID=server-01 \
  -e INFRAVIEW_API_KEY=your-agent-key \
  -e HOST_PROC=/host/proc \
  -v /proc:/host/proc:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  ghcr.io/timhasenkamp/infraview-osp-agent:latest
```

**Standalone binary (~5 MB):**

```bash
cd agent
CGO_ENABLED=0 go build -ldflags="-s -w" -o infraview-agent ./cmd/agent/
scp infraview-agent user@server:/usr/local/bin/
```

---

## Development

**Prerequisites:** Docker, Node.js 20+ with pnpm, Python 3.12+, Go 1.25+

```bash
# Docker Compose with hot-reload (recommended)
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

### Useful commands

| Command                           | Description          |
| --------------------------------- | -------------------- |
| `pnpm dev`                        | Frontend dev server  |
| `pnpm build`                      | Production build     |
| `pnpm lint`                       | ESLint               |
| `cd backend && pytest tests/ -v`  | Backend tests        |
| `cd agent && go test ./... -v`    | Agent tests          |

---

## Configuration

All settings can be managed via the Settings page in the dashboard.
Environment variables are only needed for initial setup:

| Variable                 | Default                                 | Description                    |
| ------------------------ | --------------------------------------- | ------------------------------ |
| `JWT_SECRET_KEY`         | `change-me-in-production`               | JWT signing secret             |
| `AGENT_API_KEY`          | `change-me-in-production`               | Agent authentication key       |
| `DATABASE_URL`           | `sqlite+aiosqlite:///data/infraview.db` | Database connection string     |
| `METRIC_RETENTION_DAYS`  | `30`                                    | Days before metrics are pruned |

See [.env.example](.env.example) for all available options.

---

## Project Structure

```text
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
└── docker-compose.yml      # Production Compose file
```

---

## Contributing

Contributions are welcome! This project is in early development (v0.x) — feedback, bug reports, and
feature requests are especially helpful.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and progress.

## License

[MIT](LICENSE)

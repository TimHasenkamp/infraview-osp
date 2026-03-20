# Testing

## Backend (Python / pytest)

**35 Tests** — API routes, services, downsampling

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Mit Coverage:
```bash
pytest tests/ --cov=app --cov-report=term-missing
```

### Teststruktur

| Datei | Was wird getestet |
|---|---|
| `tests/test_auth.py` | Login, Logout, JWT, geschützte Routen |
| `tests/test_servers.py` | Server list/detail, 404 |
| `tests/test_metrics.py` | Pagination, CSV/JSON Export, Range-Validierung |
| `tests/test_alerts.py` | Alert CRUD, Events Pagination, Acknowledge/Resolve |
| `tests/test_health.py` | Health-Endpoint |
| `tests/test_services.py` | Alert-Evaluation, Downsampling-Aggregation |

Tests nutzen eine In-Memory SQLite DB (`conftest.py`), keine externe Infrastruktur nötig.

---

## Frontend (TypeScript / Vitest)

**26 Tests** — Utilities, API Client, Components

```bash
pnpm test
```

Watch-Mode:
```bash
pnpm test:watch
```

### Teststruktur

| Datei | Was wird getestet |
|---|---|
| `tests/utils.test.ts` | formatBytes, formatPercent, getMetricColor, timeAgo, normalizeServer |
| `tests/api-client.test.ts` | Export-URL Generierung |
| `tests/types.test.ts` | Paginated Response Types, TIME_RANGES |
| `tests/components.test.tsx` | StatusBadge Rendering (online/offline) |

---

## Agent (Go)

**14 Tests** — Config, Health, Collectors

```bash
cd agent
go test ./... -v
```

Mit Coverage:
```bash
go test ./... -cover
```

### Teststruktur

| Datei | Was wird getestet |
|---|---|
| `internal/config/config_test.go` | ENV-Laden, Defaults, Fallbacks |
| `internal/health/health_test.go` | Health-Endpoint connected/degraded |
| `internal/collector/collector_test.go` | CPU, Memory, Disk, Network, Processes, Full Collect |

---

## Alles auf einmal

```bash
# Backend
(cd backend && pytest tests/ -v) && \
# Frontend
pnpm test && \
# Agent
(cd agent && go test ./... -v)
```

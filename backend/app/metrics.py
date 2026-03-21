from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import APIRouter, Response

router = APIRouter()

# Request metrics
REQUEST_COUNT = Counter(
    "infraview_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)
REQUEST_DURATION = Histogram(
    "infraview_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# Business metrics
CONNECTED_AGENTS = Gauge(
    "infraview_connected_agents",
    "Number of currently connected agents",
)
CONNECTED_DASHBOARDS = Gauge(
    "infraview_connected_dashboards",
    "Number of currently connected dashboard clients",
)
ALERTS_FIRED = Counter(
    "infraview_alerts_fired_total",
    "Total alerts fired",
    ["severity"],
)
METRICS_INGESTED = Counter(
    "infraview_metrics_ingested_total",
    "Total metric snapshots ingested from agents",
)


@router.get("/metrics")
async def prometheus_metrics():
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )

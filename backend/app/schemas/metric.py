from pydantic import BaseModel


class MetricResponse(BaseModel):
    timestamp: float
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    net_bytes_sent: int = 0
    net_bytes_recv: int = 0
    load1: float = 0.0
    load5: float = 0.0
    load15: float = 0.0

    model_config = {"from_attributes": True}


class PaginatedMetricResponse(BaseModel):
    items: list[MetricResponse]
    total: int
    limit: int
    offset: int

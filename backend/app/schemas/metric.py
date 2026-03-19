from pydantic import BaseModel


class MetricResponse(BaseModel):
    timestamp: float
    cpu_percent: float
    memory_percent: float
    disk_percent: float

    model_config = {"from_attributes": True}

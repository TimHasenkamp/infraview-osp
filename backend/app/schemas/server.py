from pydantic import BaseModel


class CPUMetrics(BaseModel):
    usage_percent: float
    core_count: int
    per_core: list[float]


class MemoryMetrics(BaseModel):
    usage_percent: float
    total_bytes: int
    used_bytes: int
    avail_bytes: int


class DiskMetrics(BaseModel):
    usage_percent: float
    total_bytes: int
    used_bytes: int
    free_bytes: int
    path: str


class ContainerSchema(BaseModel):
    id: str
    name: str
    image: str
    state: str
    status: str
    created: int


class ServerResponse(BaseModel):
    id: str
    hostname: str
    status: str
    last_seen: float
    first_seen: float
    cpu: CPUMetrics | None = None
    memory: MemoryMetrics | None = None
    disk: DiskMetrics | None = None
    containers: list[ContainerSchema] = []

    model_config = {"from_attributes": True}

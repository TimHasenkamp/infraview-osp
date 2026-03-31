from typing import Literal
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


class NetworkMetrics(BaseModel):
    bytes_sent: int
    bytes_recv: int
    packets_sent: int
    packets_recv: int


class LoadMetrics(BaseModel):
    load1: float
    load5: float
    load15: float


class PackageUpdateSchema(BaseModel):
    name: str
    current_version: str
    new_version: str
    security: bool


class UpdatesInfoSchema(BaseModel):
    available: int = 0
    security: int = 0
    packages: list[PackageUpdateSchema] = []
    last_check: int = 0
    apt_available: bool = False
    package_manager: str = ""
    agent_mode: Literal["container", "native"] = "native"
    os_name: str = ""


class ProcessSchema(BaseModel):
    pid: int
    name: str
    cpu_percent: float
    mem_percent: float
    mem_bytes: int
    user: str


class ContainerSchema(BaseModel):
    id: str
    name: str
    image: str
    state: str
    status: str
    created: int
    update_available: bool = False
    latest_version: str | None = None


class ServerResponse(BaseModel):
    id: str
    hostname: str
    display_name: str | None = None
    status: str
    last_seen: float
    first_seen: float
    cpu: CPUMetrics | None = None
    memory: MemoryMetrics | None = None
    disk: DiskMetrics | None = None
    network: NetworkMetrics | None = None
    load: LoadMetrics | None = None
    tags: list[str] = []
    containers: list[ContainerSchema] = []

    model_config = {"from_attributes": True}

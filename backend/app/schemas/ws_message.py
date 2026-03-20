from pydantic import BaseModel
from app.schemas.server import CPUMetrics, MemoryMetrics, DiskMetrics, NetworkMetrics, LoadMetrics, ProcessSchema, UpdatesInfoSchema, ContainerSchema


class SystemSnapshot(BaseModel):
    timestamp: int
    hostname: str
    agent_id: str
    cpu: CPUMetrics
    memory: MemoryMetrics
    disk: DiskMetrics
    network: NetworkMetrics | None = None
    load: LoadMetrics | None = None
    processes: list[ProcessSchema] | None = []
    updates: UpdatesInfoSchema | None = None
    containers: list[ContainerSchema] | None = []


class AgentMessage(BaseModel):
    type: str
    payload: dict | None = None


class ContainerCommand(BaseModel):
    container_id: str
    action: str
    request_id: str | None = None

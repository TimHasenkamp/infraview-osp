from pydantic import BaseModel
from app.schemas.server import CPUMetrics, MemoryMetrics, DiskMetrics, ContainerSchema


class SystemSnapshot(BaseModel):
    timestamp: int
    hostname: str
    agent_id: str
    cpu: CPUMetrics
    memory: MemoryMetrics
    disk: DiskMetrics
    containers: list[ContainerSchema] = []


class AgentMessage(BaseModel):
    type: str
    payload: dict | None = None


class ContainerCommand(BaseModel):
    container_id: str
    action: str
    request_id: str | None = None

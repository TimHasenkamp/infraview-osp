from pydantic import BaseModel


class AlertRuleCreate(BaseModel):
    server_id: str | None = None
    metric: str
    operator: str = ">"
    threshold: float
    severity: str = "warning"
    notify_email: str | None = None
    notify_webhook: str | None = None
    enabled: bool = True
    cooldown_seconds: int = 300


class AlertRuleUpdate(BaseModel):
    server_id: str | None = None
    metric: str | None = None
    operator: str | None = None
    threshold: float | None = None
    severity: str | None = None
    notify_email: str | None = None
    notify_webhook: str | None = None
    enabled: bool | None = None
    cooldown_seconds: int | None = None


class AlertRuleResponse(BaseModel):
    id: int
    server_id: str | None
    metric: str
    operator: str
    threshold: float
    severity: str
    notify_email: str | None
    notify_webhook: str | None
    enabled: bool
    cooldown_seconds: int

    model_config = {"from_attributes": True}


class AlertEventResponse(BaseModel):
    id: int
    rule_id: int
    server_id: str
    metric: str
    value: float
    threshold: float
    severity: str
    message: str | None
    fired_at: float
    acknowledged: bool

    model_config = {"from_attributes": True}

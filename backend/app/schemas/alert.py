from typing import Literal
from pydantic import BaseModel, Field


class AlertRuleCreate(BaseModel):
    server_id: str | None = None
    metric: Literal["cpu_percent", "memory_percent", "disk_percent"]
    operator: Literal[">", "<"] = ">"
    threshold: float = Field(ge=0, le=100)
    severity: Literal["warning", "critical"] = "warning"
    notify_email: str | None = None
    notify_webhook: str | None = None
    notify_channel: Literal["none", "email", "discord", "slack", "gotify", "webhook", "telegram"] = "none"
    gotify_token: str | None = None
    telegram_chat_id: str | None = None
    enabled: bool = True
    cooldown_seconds: int = Field(default=300, ge=0)


class AlertRuleUpdate(BaseModel):
    server_id: str | None = None
    metric: Literal["cpu_percent", "memory_percent", "disk_percent"] | None = None
    operator: Literal[">", "<"] | None = None
    threshold: float | None = Field(default=None, ge=0, le=100)
    severity: Literal["warning", "critical"] | None = None
    notify_email: str | None = None
    notify_webhook: str | None = None
    notify_channel: Literal["none", "email", "discord", "slack", "gotify", "webhook", "telegram"] | None = None
    gotify_token: str | None = None
    telegram_chat_id: str | None = None
    enabled: bool | None = None
    cooldown_seconds: int | None = Field(default=None, ge=0)


class AlertRuleResponse(BaseModel):
    id: int
    server_id: str | None
    metric: str
    operator: str
    threshold: float
    severity: str
    notify_email: str | None
    notify_webhook: str | None
    notify_channel: str | None = "none"
    gotify_token: str | None = None
    telegram_chat_id: str | None = None
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
    acknowledged_at: float | None = None
    resolved: bool = False
    resolved_at: float | None = None

    model_config = {"from_attributes": True}


class PaginatedAlertEventResponse(BaseModel):
    items: list[AlertEventResponse]
    total: int
    limit: int
    offset: int

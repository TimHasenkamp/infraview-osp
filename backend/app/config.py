import sys

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///data/infraview.db"
    cors_origins: list[str] = ["http://localhost:3000"]
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    alert_from_email: str = ""
    agent_timeout_seconds: int = 30

    # Auth
    jwt_secret_key: str = ""
    jwt_expire_minutes: int = 480
    admin_user: str = "admin"
    agent_api_key: str = ""

    # Data retention
    metric_retention_days: int = 30
    downsample_enabled: bool = True
    downsample_1min_after_hours: int = 6
    downsample_5min_after_hours: int = 48
    downsample_1h_after_hours: int = 168  # 7 days

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()

_INSECURE_DEFAULTS = {"", "change-me-in-production"}
_missing = []
if settings.jwt_secret_key in _INSECURE_DEFAULTS:
    _missing.append("JWT_SECRET_KEY")
if settings.agent_api_key in _INSECURE_DEFAULTS:
    _missing.append("AGENT_API_KEY")
if _missing:
    print(f"\nFATAL: Required secrets not set: {', '.join(_missing)}", file=sys.stderr)
    print("Generate with: openssl rand -hex 32\n", file=sys.stderr)
    sys.exit(1)

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
    jwt_secret_key: str = "change-me-in-production"
    jwt_expire_minutes: int = 480
    admin_user: str = "admin"
    admin_password: str = "admin"
    agent_api_key: str = "change-me-in-production"

    # Data retention
    metric_retention_days: int = 30
    downsample_enabled: bool = True
    downsample_1min_after_hours: int = 6
    downsample_5min_after_hours: int = 48
    downsample_1h_after_hours: int = 168  # 7 days

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()

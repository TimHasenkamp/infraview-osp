from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///data/infraview.db"
    cors_origins: list[str] = ["*"]
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    alert_from_email: str = ""
    agent_timeout_seconds: int = 30

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()

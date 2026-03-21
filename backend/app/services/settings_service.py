import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AppSettings
from app.config import settings as env_settings

logger = logging.getLogger(__name__)

# Settings that can be configured via the UI.
# key -> (default_from_env, type, label, category)
CONFIGURABLE_SETTINGS = {
    # SMTP
    "smtp_host": ("smtp_host", str, "SMTP Host", "email"),
    "smtp_port": ("smtp_port", int, "SMTP Port", "email"),
    "smtp_user": ("smtp_user", str, "SMTP Username", "email"),
    "smtp_pass": ("smtp_pass", str, "SMTP Password", "email"),
    "alert_from_email": ("alert_from_email", str, "Sender Email", "email"),
    # Data
    "metric_retention_days": ("metric_retention_days", int, "Metric Retention (days)", "data"),
    "downsample_enabled": ("downsample_enabled", bool, "Enable Downsampling", "data"),
    "downsample_1min_after_hours": ("downsample_1min_after_hours", int, "Downsample to 1min after (hours)", "data"),
    "downsample_5min_after_hours": ("downsample_5min_after_hours", int, "Downsample to 5min after (hours)", "data"),
    "downsample_1h_after_hours": ("downsample_1h_after_hours", int, "Downsample to 1h after (hours)", "data"),
    # Agent
    "agent_timeout_seconds": ("agent_timeout_seconds", int, "Agent Timeout (seconds)", "agent"),
}

# Sensitive keys whose values are masked in responses
SENSITIVE_KEYS = {"smtp_pass"}


async def get_all_settings(db: AsyncSession) -> dict:
    """Return all configurable settings, DB values override ENV defaults."""
    result = await db.execute(select(AppSettings))
    db_rows = {row.key: row.value for row in result.scalars().all()}

    settings_out = {}
    for key, (env_attr, typ, label, category) in CONFIGURABLE_SETTINGS.items():
        env_default = str(getattr(env_settings, env_attr, ""))
        raw_value = db_rows.get(key, env_default)

        settings_out[key] = {
            "value": "••••••••" if key in SENSITIVE_KEYS and raw_value else raw_value,
            "label": label,
            "category": category,
            "type": typ.__name__,
        }

    return settings_out


async def get_setting(db: AsyncSession, key: str) -> str:
    """Get a single setting value. DB overrides ENV."""
    result = await db.execute(
        select(AppSettings).where(AppSettings.key == key)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        return row.value

    # Fall back to ENV
    cfg = CONFIGURABLE_SETTINGS.get(key)
    if cfg:
        env_attr = cfg[0]
        return str(getattr(env_settings, env_attr, ""))
    return ""


async def update_settings(db: AsyncSession, updates: dict[str, str]) -> dict:
    """Update multiple settings in the DB."""
    changed = {}
    for key, value in updates.items():
        if key not in CONFIGURABLE_SETTINGS:
            continue

        # Skip masked password values (user didn't change it)
        if key in SENSITIVE_KEYS and value == "••••••••":
            continue

        result = await db.execute(
            select(AppSettings).where(AppSettings.key == key)
        )
        row = result.scalar_one_or_none()

        if row is None:
            row = AppSettings(key=key, value=str(value))
            db.add(row)
        else:
            row.value = str(value)

        changed[key] = str(value)

    await db.commit()
    return changed


def get_effective_setting(db_value: str | None, env_attr: str) -> str:
    """Get the effective value: DB if set, otherwise ENV."""
    if db_value is not None and db_value != "":
        return db_value
    return str(getattr(env_settings, env_attr, ""))

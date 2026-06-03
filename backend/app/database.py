import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


class Base(DeclarativeBase):
    pass


os.makedirs("data", exist_ok=True)

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Idempotent column additions for existing SQLite DBs. create_all() only creates
# missing tables, never alters existing ones, and there's no migration tool.
# Each entry: (table, column, "ADD COLUMN" definition).
_COLUMN_MIGRATIONS = [
    ("servers", "updates_available", "updates_available INTEGER NOT NULL DEFAULT 0"),
    ("servers", "agent_version", "agent_version TEXT"),
    ("servers", "agent_update_available", "agent_update_available INTEGER NOT NULL DEFAULT 0"),
]


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for table, column, definition in _COLUMN_MIGRATIONS:
            existing = await conn.execute(text(f"PRAGMA table_info({table})"))
            cols = {row[1] for row in existing.fetchall()}
            if cols and column not in cols:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {definition}"))


async def get_db():
    async with async_session() as session:
        yield session

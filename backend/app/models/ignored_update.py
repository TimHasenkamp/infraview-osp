from datetime import datetime
from sqlalchemy import String, Integer, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class IgnoredUpdate(Base):
    """A container image update the user chose to ignore.

    Keyed by (server_id, container_name) — the container id changes on recreate,
    the name is stable. ignored_version stores the version that was dismissed, so
    a later, newer version surfaces the update again.
    """

    __tablename__ = "ignored_updates"
    __table_args__ = (UniqueConstraint("server_id", "container_name"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(String, nullable=False)
    container_name: Mapped[str] = mapped_column(String, nullable=False)
    ignored_version: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

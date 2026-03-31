from datetime import datetime
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    hostname: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="offline")
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    cpu_cores: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_total_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disk_total_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tags: Mapped[str | None] = mapped_column(String, nullable=True, default="")
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)

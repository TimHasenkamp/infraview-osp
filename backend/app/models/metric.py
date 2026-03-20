from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Metric(Base):
    __tablename__ = "metrics"
    __table_args__ = (
        UniqueConstraint("server_id", "timestamp"),
        Index("idx_metrics_server_time", "server_id", "timestamp"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    server_id: Mapped[str] = mapped_column(String, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    cpu_percent: Mapped[float] = mapped_column(Float, nullable=False)
    memory_percent: Mapped[float] = mapped_column(Float, nullable=False)
    memory_used_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    disk_percent: Mapped[float] = mapped_column(Float, nullable=False)
    disk_used_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    net_bytes_sent: Mapped[int] = mapped_column(Integer, default=0)
    net_bytes_recv: Mapped[int] = mapped_column(Integer, default=0)
    load1: Mapped[float] = mapped_column(Float, default=0.0)
    load5: Mapped[float] = mapped_column(Float, default=0.0)
    load15: Mapped[float] = mapped_column(Float, default=0.0)

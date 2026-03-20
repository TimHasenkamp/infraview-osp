from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)

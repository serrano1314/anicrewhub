from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    profile_public: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)
    share_collection: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)
    share_watch_sites: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)
    terms_accepted_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @property
    def terms_accepted(self) -> bool:
        from app.core.terms import CURRENT_TERMS_VERSION

        return self.terms_accepted_version == CURRENT_TERMS_VERSION

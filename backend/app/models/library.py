from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserAnime(Base):
    __tablename__ = "user_anime"
    __table_args__ = (
        UniqueConstraint("user_id", "anime_id", name="uq_user_anime_user_id_anime_id"),
        CheckConstraint(
            "status IN ('watching', 'completed', 'plan_to_watch', 'on_hold', 'dropped')",
            name="ck_user_anime_status",
        ),
        CheckConstraint(
            "score IS NULL OR (score >= 1 AND score <= 10)",
            name="ck_user_anime_score",
        ),
        CheckConstraint("last_episode_watched >= 0", name="ck_user_anime_last_episode"),
        Index("ix_user_anime_user_id_status", "user_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    anime_id: Mapped[UUID] = mapped_column(ForeignKey("anime.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    is_favorite: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
        server_default="false",
    )
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_episode_watched: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
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


class EpisodeProgress(Base):
    __tablename__ = "episode_progress"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "anime_id",
            "episode_number",
            name="uq_episode_progress_user_anime_episode",
        ),
        CheckConstraint("episode_number >= 1", name="ck_episode_progress_episode_number"),
        Index("ix_episode_progress_user_id_anime_id", "user_id", "anime_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    anime_id: Mapped[UUID] = mapped_column(ForeignKey("anime.id", ondelete="CASCADE"), nullable=False)
    episode_number: Mapped[int] = mapped_column(Integer, nullable=False)
    watched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_site: Mapped[str | None] = mapped_column(Text, nullable=True)
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

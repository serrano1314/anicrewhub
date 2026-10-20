from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base

_text_array = JSON().with_variant(ARRAY(Text()), "postgresql")
_json_object = JSON().with_variant(JSONB(), "postgresql")
_json_data = JSON().with_variant(JSONB(), "postgresql")


class Anime(Base):
    __tablename__ = "anime"
    __table_args__ = (UniqueConstraint("anilist_id", name="uq_anime_anilist_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    anilist_id: Mapped[int] = mapped_column(Integer, nullable=False)
    mal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title_romaji: Mapped[str] = mapped_column(Text, nullable=False)
    title_english: Mapped[str | None] = mapped_column(Text, nullable=True)
    title_synonyms: Mapped[list[str]] = mapped_column(_text_array, nullable=False, default=list)
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    format: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_episodes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    airing_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    season_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    external_links: Mapped[list[dict[str, str]]] = mapped_column(
        _json_object,
        nullable=False,
        default=list,
    )
    details: Mapped[dict[str, object]] = mapped_column(
        _json_data,
        nullable=False,
        default=dict,
    )
    details_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
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

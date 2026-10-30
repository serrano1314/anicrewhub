from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base


class AnimeDiscoverySnapshot(Base):
    __tablename__ = "anime_discovery_snapshots"

    kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    refreshed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

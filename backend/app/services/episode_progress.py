from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models.library import EpisodeProgress

MAX_EPISODE_NUMBER = 5000


def episode_progress_row(
    user_id: UUID,
    anime_id: UUID,
    episode_number: int,
    *,
    source_site: str | None,
) -> dict[str, object]:
    now = datetime.now(timezone.utc)
    return {
        "id": uuid4(),
        "user_id": user_id,
        "anime_id": anime_id,
        "episode_number": episode_number,
        "watched_at": now,
        "source_site": source_site,
        "created_at": now,
        "updated_at": now,
    }


def insert_episode_progress(db: Session, rows: list[dict[str, object]]) -> None:
    if not rows:
        return
    dialect_name = db.get_bind().dialect.name
    if dialect_name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as dialect_insert
    else:
        from sqlalchemy.dialects.sqlite import insert as dialect_insert
    statement = dialect_insert(EpisodeProgress).values(rows)
    statement = statement.on_conflict_do_nothing(
        index_elements=["user_id", "anime_id", "episode_number"]
    )
    db.execute(statement)

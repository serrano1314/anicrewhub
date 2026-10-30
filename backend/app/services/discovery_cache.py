import logging
from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.discovery import AnimeDiscoverySnapshot
from app.schemas.anime import AnimeDiscoveryKind, AnimeSearchResponse

logger = logging.getLogger(__name__)


def get_discovery_snapshot(
    db: Session,
    kind: AnimeDiscoveryKind,
) -> AnimeSearchResponse | None:
    row = db.get(AnimeDiscoverySnapshot, kind.value)
    if row is None:
        return None
    try:
        return AnimeSearchResponse.model_validate(row.payload)
    except ValidationError:
        logger.exception("Invalid stored discovery snapshot kind=%s", kind.value)
        return None


def save_discovery_snapshot(
    db: Session,
    kind: AnimeDiscoveryKind,
    response: AnimeSearchResponse,
) -> None:
    row = db.get(AnimeDiscoverySnapshot, kind.value)
    if row is None:
        row = AnimeDiscoverySnapshot(kind=kind.value, payload={})
        db.add(row)
    row.payload = response.model_dump(mode="json")
    row.refreshed_at = datetime.now(timezone.utc)
    db.commit()


def refresh_discovery_snapshots() -> None:
    from app.db.session import SessionLocal
    from app.services.anilist import AniListError, get_anilist_client

    db = SessionLocal()
    try:
        client = get_anilist_client()
        for kind in AnimeDiscoveryKind:
            try:
                response = client.discover(kind)
            except AniListError:
                logger.exception("Discovery snapshot refresh failed kind=%s", kind.value)
                continue
            save_discovery_snapshot(db, kind, response)
            logger.info("Discovery snapshot refreshed kind=%s", kind.value)
    finally:
        db.close()

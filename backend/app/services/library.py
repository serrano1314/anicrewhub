from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import EpisodeProgress, UserAnime
from app.models.user import User
from app.schemas.library import (
    LibraryEntryResponse,
    LibraryListResponse,
    LibraryStatus,
)
from app.services.anilist import AniListError
from app.services.anime import AnimeSource, get_anime, is_still_airing

LIBRARY_PAGE_SIZE = 24


def list_library(
    db: Session,
    user: User,
    *,
    status_filter: LibraryStatus | None,
    page: int,
    query: str | None = None,
    client: AnimeSource | None = None,
) -> LibraryListResponse:
    watched_counts = (
        select(
            EpisodeProgress.anime_id.label("anime_id"),
            func.count(EpisodeProgress.id).label("watched_count"),
        )
        .where(EpisodeProgress.user_id == user.id)
        .group_by(EpisodeProgress.anime_id)
        .subquery()
    )
    filters = [UserAnime.user_id == user.id]
    if status_filter is not None:
        filters.append(UserAnime.status == status_filter.value)
    if query:
        search_terms = query.lower().split()
        term_filters = []
        for term in search_terms:
            term_filters.append(
                (Anime.title_english.ilike(f"%{term}%")) | (Anime.title_romaji.ilike(f"%{term}%"))
            )
        if term_filters:
            combined = term_filters[0]
            for f in term_filters[1:]:
                combined = combined & f
            filters.append(combined)

    rows = db.execute(
        select(
            UserAnime,
            Anime,
            func.coalesce(watched_counts.c.watched_count, 0),
        )
        .join(Anime, Anime.id == UserAnime.anime_id)
        .outerjoin(watched_counts, watched_counts.c.anime_id == UserAnime.anime_id)
        .where(*filters)
        .order_by(UserAnime.updated_at.desc(), Anime.anilist_id.asc())
        .offset((page - 1) * LIBRARY_PAGE_SIZE)
        .limit(LIBRARY_PAGE_SIZE + 1)
    ).all()
    has_next_page = len(rows) > LIBRARY_PAGE_SIZE
    visible = rows[:LIBRARY_PAGE_SIZE]
    return LibraryListResponse(
        page=page,
        has_next_page=has_next_page,
        results=[
            entry_response(entry, _refresh_if_airing(db, anime, client), int(watched_count))
            for entry, anime, watched_count in visible
        ],
    )


def _refresh_if_airing(db: Session, anime: Anime, client: AnimeSource | None) -> Anime:
    if not is_still_airing(anime.airing_status):
        return anime
    try:
        return get_anime(db, anime.anilist_id, client=client)
    except AniListError:
        return anime


def add_to_library(db: Session, user: User, anilist_id: int, list_status: LibraryStatus) -> LibraryEntryResponse:
    anime = get_anime(db, anilist_id)
    existing = db.scalar(
        select(UserAnime).where(UserAnime.user_id == user.id, UserAnime.anime_id == anime.id)
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Anime is already in your library",
        )

    entry = UserAnime(
        user_id=user.id,
        anime_id=anime.id,
        status=list_status.value,
        last_episode_watched=0,
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Anime is already in your library",
        ) from None
    db.refresh(entry)
    return entry_response(entry, anime, 0)


def update_library(
    db: Session,
    user: User,
    anilist_id: int,
    *,
    list_status: LibraryStatus | None,
    score: int | None,
    update_status: bool,
    update_score: bool,
) -> LibraryEntryResponse:
    if update_status and list_status is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="status cannot be null",
        )
    entry, anime = get_library_entry(db, user.id, anilist_id)
    if update_status and list_status is not None:
        entry.status = list_status.value
    if update_score:
        entry.score = score
    db.commit()
    db.refresh(entry)
    return entry_response(entry, anime, count_watched(db, user.id, anime.id))


def remove_from_library(db: Session, user: User, anilist_id: int) -> None:
    entry, anime = get_library_entry(db, user.id, anilist_id)
    db.execute(
        delete(EpisodeProgress).where(
            EpisodeProgress.user_id == user.id,
            EpisodeProgress.anime_id == anime.id,
        )
    )
    db.delete(entry)
    db.commit()


def get_library_entry(db: Session, user_id: UUID, anilist_id: int) -> tuple[UserAnime, Anime]:
    anime = db.scalar(select(Anime).where(Anime.anilist_id == anilist_id))
    if anime is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Anime is not in your library",
        )
    entry = db.scalar(
        select(UserAnime).where(UserAnime.user_id == user_id, UserAnime.anime_id == anime.id)
    )
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Anime is not in your library",
        )
    return entry, anime


def count_watched(db: Session, user_id: UUID, anime_id: UUID) -> int:
    total = db.scalar(
        select(func.count())
        .select_from(EpisodeProgress)
        .where(EpisodeProgress.user_id == user_id, EpisodeProgress.anime_id == anime_id)
    )
    return int(total or 0)


def entry_response(entry: UserAnime, anime: Anime, watched_count: int) -> LibraryEntryResponse:
    return LibraryEntryResponse(
        anilist_id=anime.anilist_id,
        status=LibraryStatus(entry.status),
        score=entry.score,
        last_episode_watched=entry.last_episode_watched,
        watched_count=watched_count,
        total_episodes=anime.total_episodes,
        title_romaji=anime.title_romaji,
        title_english=anime.title_english,
        cover_url=anime.cover_url,
        format=anime.format,
    )

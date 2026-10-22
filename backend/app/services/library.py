from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import case, delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import EpisodeProgress, UserAnime
from app.models.user import User
from app.schemas.library import (
    LibraryEntryResponse,
    LibraryListResponse,
    LibrarySort,
    LibrarySummaryResponse,
    LibraryStatus,
)
from app.services.anilist import AniListError
from app.services.anime import AnimeSource, get_anime, is_still_airing
from app.services.episode_progress import (
    MAX_EPISODE_NUMBER,
    episode_progress_row,
    insert_episode_progress,
)

LIBRARY_PAGE_SIZE = 24


def list_library(
    db: Session,
    user: User,
    *,
    status_filter: LibraryStatus | None,
    page: int,
    query: str | None = None,
    favorite_only: bool = False,
    sort_by: LibrarySort = LibrarySort.updated,
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
    if favorite_only:
        filters.append(UserAnime.is_favorite.is_(True))
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

    statement = (
        select(
            UserAnime,
            Anime,
            func.coalesce(watched_counts.c.watched_count, 0),
        )
        .join(Anime, Anime.id == UserAnime.anime_id)
        .outerjoin(watched_counts, watched_counts.c.anime_id == UserAnime.anime_id)
        .where(*filters)
    )
    if sort_by == LibrarySort.title:
        sort_order = (
            func.lower(func.coalesce(func.nullif(Anime.title_english, ""), Anime.title_romaji)).asc(),
            Anime.anilist_id.asc(),
        )
    elif sort_by == LibrarySort.rating:
        sort_order = (UserAnime.score.desc().nulls_last(), UserAnime.updated_at.desc(), Anime.anilist_id.asc())
    elif sort_by == LibrarySort.progress:
        sort_order = (
            UserAnime.last_episode_watched.desc(),
            UserAnime.updated_at.desc(),
            Anime.anilist_id.asc(),
        )
    else:
        sort_order = (UserAnime.updated_at.desc(), Anime.anilist_id.asc())
    rows = db.execute(
        statement.order_by(UserAnime.is_favorite.desc(), *sort_order)
        .offset((page - 1) * LIBRARY_PAGE_SIZE)
        .limit(LIBRARY_PAGE_SIZE + 1)
    ).all()
    total_count = db.scalar(
        select(func.count()).select_from(UserAnime).where(UserAnime.user_id == user.id)
    ) or 0
    summary_values = db.execute(
        select(
            func.count(UserAnime.id),
            func.coalesce(func.sum(case((UserAnime.is_favorite.is_(True), 1), else_=0)), 0),
            *[
                func.coalesce(
                    func.sum(case((UserAnime.status == library_status.value, 1), else_=0)),
                    0,
                )
                for library_status in LibraryStatus
            ],
        ).where(UserAnime.user_id == user.id)
    ).one()
    filtered_count = db.scalar(
        select(func.count())
        .select_from(UserAnime)
        .join(Anime, Anime.id == UserAnime.anime_id)
        .where(*filters)
    ) or 0
    has_next_page = len(rows) > LIBRARY_PAGE_SIZE
    visible = rows[:LIBRARY_PAGE_SIZE]
    return LibraryListResponse(
        page=page,
        has_next_page=has_next_page,
        total_count=total_count,
        total_pages=max(1, (filtered_count + LIBRARY_PAGE_SIZE - 1) // LIBRARY_PAGE_SIZE),
        summary=LibrarySummaryResponse(
            total=int(summary_values[0]),
            favorites=int(summary_values[1]),
            watching=int(summary_values[2]),
            completed=int(summary_values[3]),
            plan_to_watch=int(summary_values[4]),
            on_hold=int(summary_values[5]),
            dropped=int(summary_values[6]),
        ),
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
    watched_count = 0
    try:
        if (
            list_status == LibraryStatus.completed
            and anime.total_episodes is not None
            and 1 <= anime.total_episodes <= MAX_EPISODE_NUMBER
        ):
            db.flush()
            insert_episode_progress(
                db,
                [
                    episode_progress_row(user.id, anime.id, episode, source_site=None)
                    for episode in range(1, anime.total_episodes + 1)
                ],
            )
            entry.last_episode_watched = anime.total_episodes
            watched_count = anime.total_episodes
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Anime is already in your library",
        ) from None
    db.refresh(entry)
    return entry_response(entry, anime, watched_count)


def update_library(
    db: Session,
    user: User,
    anilist_id: int,
    *,
    list_status: LibraryStatus | None,
    score: int | None,
    is_favorite: bool | None,
    update_status: bool,
    update_score: bool,
    update_favorite: bool,
) -> LibraryEntryResponse:
    if update_status and list_status is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="status cannot be null",
        )
    if update_favorite and is_favorite is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="is_favorite cannot be null",
        )
    entry, anime = get_library_entry(db, user.id, anilist_id)
    if update_status and list_status is not None:
        entry.status = list_status.value
    if update_score:
        entry.score = score
    if update_favorite and is_favorite is not None:
        entry.is_favorite = is_favorite
    db.commit()
    db.refresh(entry)
    return entry_response(entry, anime, count_watched(db, user.id, anime.id))


def read_library_entry(db: Session, user: User, anilist_id: int) -> LibraryEntryResponse:
    entry, anime = get_library_entry(db, user.id, anilist_id)
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
        is_favorite=entry.is_favorite,
        score=entry.score,
        last_episode_watched=entry.last_episode_watched,
        watched_count=watched_count,
        total_episodes=anime.total_episodes,
        title_romaji=anime.title_romaji,
        title_english=anime.title_english,
        cover_url=anime.cover_url,
        banner_url=anime.details.get("banner_url") if isinstance(anime.details, dict) else None,
        format=anime.format,
    )

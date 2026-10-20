from collections.abc import Callable
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.anime import Anime
from app.models.user import User
from app.schemas.anime import AnimeDiscoveryKind, AnimeResponse, AnimeSearchResponse, RelatedAnime
from app.schemas.watch_links import WatchLink
from app.services.anime import discover_anime, get_anime, search_anime
from app.services.anilist import AniListError, AniListNotFound, AniListRateLimited, get_anilist_client
from app.services.progress import MAX_EPISODE_NUMBER
from app.services.watch_links import list_watch_links

router = APIRouter(prefix="/anime", tags=["anime"])

T = TypeVar("T")


def _translate(exc: AniListError) -> HTTPException:
    if isinstance(exc, AniListNotFound):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anime not found")
    if isinstance(exc, AniListRateLimited):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AniList rate limit reached. Try again shortly.",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="AniList is unavailable",
    )


def _call(action: Callable[[], T]) -> T:
    try:
        return action()
    except AniListError as exc:
        raise _translate(exc) from None


@router.get("/search", response_model=AnimeSearchResponse)
def search(
    q: str = Query(min_length=1),
    page: int = Query(default=1, ge=1),
    _current_user: User = Depends(get_current_user),
) -> AnimeSearchResponse:
    query = " ".join(q.split())
    if not query:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Search query is required",
        )
    return _call(lambda: search_anime(query, page))


@router.get("/discover/{kind}", response_model=AnimeSearchResponse)
def discover(kind: AnimeDiscoveryKind) -> AnimeSearchResponse:
    return _call(lambda: discover_anime(kind))


@router.get(
    "/{anilist_id}/episodes/{episode_number}/watch-links",
    response_model=list[WatchLink],
)
def read_watch_links(
    anilist_id: int = Path(ge=1),
    episode_number: int = Path(ge=1, le=MAX_EPISODE_NUMBER),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WatchLink]:
    return list_watch_links(db, current_user, anilist_id, episode_number)


@router.get("/{anilist_id}", response_model=AnimeResponse)
def read_anime(
    anilist_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Anime:
    return _call(lambda: get_anime(db, anilist_id, require_details=True))


@router.get("/{anilist_id}/related", response_model=list[RelatedAnime])
def read_related_anime(
    anilist_id: int = Path(ge=1),
    _current_user: User = Depends(get_current_user),
) -> list[RelatedAnime]:
    return _call(lambda: get_anilist_client().fetch_related(anilist_id))


@router.post("/from-anilist/{anilist_id}", response_model=AnimeResponse)
def cache_anime(
    anilist_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> Anime:
    return _call(lambda: get_anime(db, anilist_id, force=True))

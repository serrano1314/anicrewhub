from collections.abc import Callable
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.library import (
    EpisodeUpdateRequest,
    LibraryCreateRequest,
    LibraryEntryResponse,
    LibraryListResponse,
    LibraryStatus,
    LibraryUpdateRequest,
    ProgressStateResponse,
    WatchedEpisodesResponse,
)
from app.schemas.library_backup import (
    LibraryExportDocument,
    LibraryImportRequest,
    LibraryImportResponse,
)
from app.services.library_backup import export_user_library, import_user_library
from app.services.anilist import AniListError, AniListNotFound, AniListRateLimited
from app.services.library import add_to_library, list_library, remove_from_library, update_library
from app.services.progress import MAX_EPISODE_NUMBER, list_watched_episodes, mark_up_to, set_episode_watched

router = APIRouter(prefix="/library", tags=["library"])

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


@router.get("", response_model=LibraryListResponse)
def read_library(
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    q: str | None = Query(default=None, alias="q"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryListResponse:
    return list_library(db, current_user, status_filter=status_filter, page=page, query=q)


@router.post("", response_model=LibraryEntryResponse, status_code=status.HTTP_201_CREATED)
def create_library_entry(
    body: LibraryCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryEntryResponse:
    return _call(lambda: add_to_library(db, current_user, body.anilist_id, body.status))


@router.get("/export", response_model=LibraryExportDocument)
def export_library(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryExportDocument:
    return export_user_library(db, current_user)


@router.post("/import", response_model=LibraryImportResponse)
def import_library(
    body: LibraryImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryImportResponse:
    return import_user_library(db, current_user, body.document)


@router.get("/{anilist_id}/episodes", response_model=WatchedEpisodesResponse)
def read_episodes(
    anilist_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WatchedEpisodesResponse:
    return list_watched_episodes(db, current_user, anilist_id)


@router.put("/{anilist_id}/episodes/{episode_number}", response_model=ProgressStateResponse)
def update_episode(
    body: EpisodeUpdateRequest,
    anilist_id: int = Path(ge=1),
    episode_number: int = Path(ge=1, le=MAX_EPISODE_NUMBER),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressStateResponse:
    return set_episode_watched(
        db,
        current_user,
        anilist_id,
        episode_number,
        watched=body.watched,
        source_site=body.source_site,
    )


@router.post(
    "/{anilist_id}/episodes/mark-up-to/{episode_number}",
    response_model=ProgressStateResponse,
)
def mark_episodes_up_to(
    anilist_id: int = Path(ge=1),
    episode_number: int = Path(ge=1, le=MAX_EPISODE_NUMBER),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressStateResponse:
    return mark_up_to(db, current_user, anilist_id, episode_number)


@router.patch("/{anilist_id}", response_model=LibraryEntryResponse)
def patch_library_entry(
    body: LibraryUpdateRequest,
    anilist_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryEntryResponse:
    return update_library(
        db,
        current_user,
        anilist_id,
        list_status=body.status,
        score=body.score,
        update_status="status" in body.model_fields_set,
        update_score="score" in body.model_fields_set,
    )


@router.delete("/{anilist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_library_entry(
    anilist_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    remove_from_library(db, current_user, anilist_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from uuid import UUID

from fastapi import APIRouter, Depends, Path, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_accepted_terms
from app.db.session import get_db
from app.models.user import User
from app.schemas.sites import (
    AnimeSiteCreateRequest,
    AnimeSiteResponse,
    AnimeSiteUpdateRequest,
    SiteCreateRequest,
    SiteResponse,
    SiteUpdateRequest,
)
from app.services.sites import (
    add_anime_site,
    create_site,
    delete_site,
    list_anime_sites,
    list_sites,
    remove_anime_site,
    update_site,
    update_anime_site,
)

router = APIRouter(tags=["sites"], dependencies=[Depends(require_accepted_terms)])


@router.get("/sites", response_model=list[SiteResponse])
def read_sites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SiteResponse]:
    return [SiteResponse.model_validate(site) for site in list_sites(db, current_user)]


@router.post("/sites", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
def post_site(
    body: SiteCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SiteResponse:
    return SiteResponse.model_validate(create_site(db, current_user, body))


@router.patch("/sites/{site_id}", response_model=SiteResponse)
def patch_site(
    body: SiteUpdateRequest,
    site_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SiteResponse:
    return SiteResponse.model_validate(update_site(db, current_user, site_id, body))


@router.delete("/sites/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def destroy_site(
    site_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    delete_site(db, current_user, site_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/library/{anilist_id}/sites", response_model=list[AnimeSiteResponse])
def read_anime_sites(
    anilist_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AnimeSiteResponse]:
    return list_anime_sites(db, current_user, anilist_id)


@router.post(
    "/library/{anilist_id}/sites",
    response_model=AnimeSiteResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_anime_site(
    body: AnimeSiteCreateRequest,
    anilist_id: int = Path(ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnimeSiteResponse:
    return add_anime_site(db, current_user, anilist_id, body)


@router.patch("/library/{anilist_id}/sites/{site_id}", response_model=AnimeSiteResponse)
def patch_anime_site(
    body: AnimeSiteUpdateRequest,
    anilist_id: int = Path(ge=1),
    site_id: UUID = Path(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnimeSiteResponse:
    return update_anime_site(db, current_user, anilist_id, site_id, body)


@router.delete("/library/{anilist_id}/sites/{site_id}", status_code=status.HTTP_204_NO_CONTENT)
def destroy_anime_site(
    anilist_id: int = Path(ge=1),
    site_id: UUID = Path(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    remove_anime_site(db, current_user, anilist_id, site_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

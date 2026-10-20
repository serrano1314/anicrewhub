from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.sites import UserAnimeSite, UserSite
from app.models.user import User
from app.schemas.sites import (
    AnimeSiteCreateRequest,
    AnimeSiteResponse,
    AnimeSiteUpdateRequest,
    SiteCreateRequest,
    SiteUpdateRequest,
)


def list_sites(db: Session, user: User) -> list[UserSite]:
    return list(
        db.scalars(
            select(UserSite)
            .where(UserSite.user_id == user.id)
            .order_by(UserSite.created_at.asc(), UserSite.name.asc())
        ).all()
    )


def create_site(db: Session, user: User, body: SiteCreateRequest) -> UserSite:
    site = UserSite(
        user_id=user.id,
        name=body.name,
        base_url=body.base_url,
        episode_url_template=body.episode_url_template,
        search_url_template=body.search_url_template,
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


def update_site(db: Session, user: User, site_id: UUID, body: SiteUpdateRequest) -> UserSite:
    site = _owned_site(db, user.id, site_id)
    fields = body.model_fields_set
    if "name" in fields:
        if body.name is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="name cannot be null")
        site.name = body.name
    if "base_url" in fields:
        if body.base_url is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="base_url cannot be null",
            )
        site.base_url = body.base_url
    if "episode_url_template" in fields:
        site.episode_url_template = body.episode_url_template
    if "search_url_template" in fields:
        site.search_url_template = body.search_url_template
    db.commit()
    db.refresh(site)
    return site


def delete_site(db: Session, user: User, site_id: UUID) -> None:
    site = _owned_site(db, user.id, site_id)
    db.execute(delete(UserAnimeSite).where(UserAnimeSite.site_id == site.id))
    db.delete(site)
    db.commit()


def list_anime_sites(db: Session, user: User, anilist_id: int) -> list[AnimeSiteResponse]:
    anime = _cached_anime(db, anilist_id)
    rows = db.execute(
        select(UserAnimeSite, UserSite)
        .join(UserSite, UserSite.id == UserAnimeSite.site_id)
        .where(UserAnimeSite.user_id == user.id, UserAnimeSite.anime_id == anime.id)
        .order_by(UserAnimeSite.created_at.asc(), UserSite.name.asc())
    ).all()
    return [_anime_site_response(link, site) for link, site in rows]


def add_anime_site(db: Session, user: User, anilist_id: int, body: AnimeSiteCreateRequest) -> AnimeSiteResponse:
    anime = _cached_anime(db, anilist_id)
    site = _owned_site(db, user.id, body.site_id)
    link = UserAnimeSite(
        user_id=user.id,
        anime_id=anime.id,
        site_id=site.id,
        anime_url=body.anime_url,
    )
    db.add(link)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Site is already saved for this anime",
        ) from None
    db.refresh(link)
    return _anime_site_response(link, site)


def update_anime_site(
    db: Session,
    user: User,
    anilist_id: int,
    site_id: UUID,
    body: AnimeSiteUpdateRequest,
) -> AnimeSiteResponse:
    anime = _cached_anime(db, anilist_id)
    site = _owned_site(db, user.id, site_id)
    link = db.scalar(
        select(UserAnimeSite).where(
            UserAnimeSite.user_id == user.id,
            UserAnimeSite.anime_id == anime.id,
            UserAnimeSite.site_id == site.id,
        )
    )
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site is not saved for this anime")
    link.anime_url = body.anime_url
    db.commit()
    db.refresh(link)
    return _anime_site_response(link, site)


def remove_anime_site(db: Session, user: User, anilist_id: int, site_id: UUID) -> None:
    anime = _cached_anime(db, anilist_id)
    link = db.scalar(
        select(UserAnimeSite).where(
            UserAnimeSite.user_id == user.id,
            UserAnimeSite.anime_id == anime.id,
            UserAnimeSite.site_id == site_id,
        )
    )
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site is not saved for this anime")
    db.delete(link)
    db.commit()


def _owned_site(db: Session, user_id: UUID, site_id: UUID) -> UserSite:
    site = db.scalar(select(UserSite).where(UserSite.id == site_id, UserSite.user_id == user_id))
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    return site


def _cached_anime(db: Session, anilist_id: int) -> Anime:
    anime = db.scalar(select(Anime).where(Anime.anilist_id == anilist_id))
    if anime is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anime not found")
    return anime


def _anime_site_response(link: UserAnimeSite, site: UserSite) -> AnimeSiteResponse:
    return AnimeSiteResponse(
        site_id=site.id,
        name=site.name,
        base_url=site.base_url,
        episode_url_template=site.episode_url_template,
        search_url_template=site.search_url_template,
        anime_url=link.anime_url,
    )

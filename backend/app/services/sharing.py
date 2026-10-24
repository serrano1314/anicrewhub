from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import EpisodeProgress, UserAnime
from app.models.sites import UserSite
from app.models.social import CopiedSite, UserFollow
from app.models.user import User
from app.schemas.library import LibraryStatus
from app.schemas.sharing import (
    CopiedSiteResponse,
    CopySitesResponse,
    FollowConnectionItem,
    FollowRequestItem,
    PrivacyResponse,
    ProfileResponse,
    SharedCollectionItem,
    SharedCollectionResponse,
    SharedSiteResponse,
    UserSearchResponse,
    UserSearchResult,
)
from app.services.notifications import (
    TYPE_FOLLOW,
    TYPE_FOLLOW_REQUEST,
    create_notification,
    delete_actor_notifications,
)
from app.services.watch_links import is_http_url

PAGE_SIZE = 24
COLLECTION_PAGE_SIZE = 10
FOLLOW_ACCEPTED = "accepted"
FOLLOW_PENDING = "pending"


def get_user_by_username(db: Session, username: str) -> User:
    cleaned = username.strip()
    matches = db.scalars(select(User).where(func.lower(User.username) == cleaned.lower())).all()
    if len(matches) != 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return matches[0]


def _follow_between(db: Session, follower_id: UUID, followed_id: UUID) -> UserFollow | None:
    return db.scalar(
        select(UserFollow).where(
            UserFollow.follower_id == follower_id,
            UserFollow.followed_id == followed_id,
        )
    )


def _accepted_follower(db: Session, viewer: User, owner: User) -> bool:
    if viewer.id == owner.id:
        return True
    follow = _follow_between(db, viewer.id, owner.id)
    return follow is not None and follow.status == FOLLOW_ACCEPTED


def can_view_private_details(db: Session, viewer: User, owner: User) -> bool:
    if owner.profile_public:
        return True
    return _accepted_follower(db, viewer, owner)


def can_view_collection(db: Session, viewer: User, owner: User) -> bool:
    if viewer.id == owner.id:
        return True
    return can_view_private_details(db, viewer, owner) and owner.share_collection


def can_view_sites(db: Session, viewer: User, owner: User) -> bool:
    if viewer.id == owner.id:
        return True
    return can_view_private_details(db, viewer, owner) and owner.share_watch_sites


def _can_see_counts(db: Session, viewer: User, owner: User) -> bool:
    if owner.profile_public or viewer.id == owner.id:
        return True
    return _accepted_follower(db, viewer, owner)


def _count_accepted(db: Session, *, follower_id: UUID | None = None, followed_id: UUID | None = None) -> int:
    filters = [UserFollow.status == FOLLOW_ACCEPTED]
    if follower_id is not None:
        filters.append(UserFollow.follower_id == follower_id)
    if followed_id is not None:
        filters.append(UserFollow.followed_id == followed_id)
    total = db.scalar(select(func.count()).select_from(UserFollow).where(*filters))
    return int(total or 0)


def read_privacy(user: User) -> PrivacyResponse:
    return PrivacyResponse(
        profile_public=user.profile_public,
        share_collection=user.share_collection,
        share_favorites_only=user.share_favorites_only,
        share_watch_sites=user.share_watch_sites,
    )


def update_privacy(
    db: Session,
    user: User,
    *,
    profile_public: bool | None,
    share_collection: bool | None,
    share_favorites_only: bool | None,
    share_watch_sites: bool | None,
) -> PrivacyResponse:
    if profile_public is not None:
        user.profile_public = profile_public
    if share_collection is not None:
        user.share_collection = share_collection
    if share_favorites_only is not None:
        user.share_favorites_only = share_favorites_only
    if share_watch_sites is not None:
        user.share_watch_sites = share_watch_sites
    db.commit()
    db.refresh(user)
    return read_privacy(user)


def search_users(db: Session, viewer: User, query: str, page: int) -> UserSearchResponse:
    cleaned = query.strip()
    filters = [User.username.ilike(f"%{cleaned}%")] if cleaned else []
    follower_counts = (
        select(UserFollow.followed_id.label("user_id"), func.count(UserFollow.id).label("followers"))
        .where(UserFollow.status == FOLLOW_ACCEPTED)
        .group_by(UserFollow.followed_id)
        .subquery()
    )
    rows = db.execute(
        select(User, func.coalesce(follower_counts.c.followers, 0))
        .outerjoin(follower_counts, follower_counts.c.user_id == User.id)
        .where(*filters)
        .order_by(func.lower(User.username).asc())
        .offset((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE + 1)
    ).all()
    has_next_page = len(rows) > PAGE_SIZE
    visible = rows[:PAGE_SIZE]
    user_ids = [user.id for user, _count in visible]
    outgoing: dict[UUID, str] = {}
    incoming: dict[UUID, str] = {}
    if user_ids:
        for follow in db.scalars(
            select(UserFollow).where(
                UserFollow.follower_id == viewer.id,
                UserFollow.followed_id.in_(user_ids),
            )
        ):
            outgoing[follow.followed_id] = follow.status
        for follow in db.scalars(
            select(UserFollow).where(
                UserFollow.followed_id == viewer.id,
                UserFollow.follower_id.in_(user_ids),
            )
        ):
            incoming[follow.follower_id] = follow.status
    return UserSearchResponse(
        page=page,
        has_next_page=has_next_page,
        results=[
            UserSearchResult(
                username=user.username,
                avatar_id=user.avatar_id,
                avatar_url=user.avatar_url,
                profile_public=user.profile_public,
                follower_count=int(count) if _can_see_counts(db, viewer, user) else None,
                is_self=user.id == viewer.id,
                follow_state=outgoing.get(user.id),
                follows_you=incoming.get(user.id),
            )
            for user, count in visible
        ],
    )


def read_profile(db: Session, viewer: User, username: str) -> ProfileResponse:
    owner = get_user_by_username(db, username)
    follow = None if viewer.id == owner.id else _follow_between(db, viewer.id, owner.id)
    follows_you = None if viewer.id == owner.id else _follow_between(db, owner.id, viewer.id)
    show_counts = _can_see_counts(db, viewer, owner)
    incoming = None
    if viewer.id == owner.id:
        incoming = int(
            db.scalar(
                select(func.count())
                .select_from(UserFollow)
                .where(UserFollow.followed_id == owner.id, UserFollow.status == FOLLOW_PENDING)
            )
            or 0
        )
    return ProfileResponse(
        username=owner.username,
        avatar_id=owner.avatar_id,
        avatar_url=owner.avatar_url,
        is_self=viewer.id == owner.id,
        profile_public=owner.profile_public,
        follow_state=None if follow is None else follow.status,
        follows_you=None if follows_you is None else follows_you.status,
        follower_count=_count_accepted(db, followed_id=owner.id) if show_counts else None,
        following_count=_count_accepted(db, follower_id=owner.id) if show_counts else None,
        can_view_collection=can_view_collection(db, viewer, owner),
        can_view_sites=can_view_sites(db, viewer, owner),
        incoming_request_count=incoming,
    )


def _accepted_connections(db: Session, *, follower_id: UUID | None = None, followed_id: UUID | None = None) -> list[FollowConnectionItem]:
    filters = [UserFollow.status == FOLLOW_ACCEPTED]
    if follower_id is not None:
        filters.append(UserFollow.follower_id == follower_id)
        join_on = UserFollow.followed_id == User.id
    else:
        filters.append(UserFollow.followed_id == followed_id)
        join_on = UserFollow.follower_id == User.id
    users = db.scalars(
        select(User).join(UserFollow, join_on).where(*filters).order_by(func.lower(User.username).asc())
    ).all()
    return [
        FollowConnectionItem(
            username=user.username,
            avatar_id=user.avatar_id,
            avatar_url=user.avatar_url,
            profile_public=user.profile_public,
        )
        for user in users
    ]


def list_followers(db: Session, owner: User) -> list[FollowConnectionItem]:
    return _accepted_connections(db, followed_id=owner.id)


def list_following(db: Session, owner: User) -> list[FollowConnectionItem]:
    return _accepted_connections(db, follower_id=owner.id)


def list_follow_requests(db: Session, owner: User) -> list[FollowRequestItem]:
    rows = db.execute(
        select(User)
        .join(UserFollow, UserFollow.follower_id == User.id)
        .where(UserFollow.followed_id == owner.id, UserFollow.status == FOLLOW_PENDING)
        .order_by(UserFollow.created_at.asc())
    ).scalars()
    return [
        FollowRequestItem(username=user.username, avatar_id=user.avatar_id, avatar_url=user.avatar_url)
        for user in rows
    ]


def follow_user(db: Session, viewer: User, username: str) -> ProfileResponse:
    owner = get_user_by_username(db, username)
    if owner.id == viewer.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="You cannot follow yourself")
    existing = _follow_between(db, viewer.id, owner.id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Follow request already pending" if existing.status == FOLLOW_PENDING else "Already following",
        )
    pending = not owner.profile_public
    db.add(
        UserFollow(
            follower_id=viewer.id,
            followed_id=owner.id,
            status=FOLLOW_PENDING if pending else FOLLOW_ACCEPTED,
        )
    )
    create_notification(
        db,
        recipient=owner,
        notification_type=TYPE_FOLLOW_REQUEST if pending else TYPE_FOLLOW,
        title=f"{viewer.username} requested to follow you" if pending else f"{viewer.username} followed you",
        actor=viewer,
        href=f"/users/{viewer.username}",
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already following") from None
    return read_profile(db, viewer, owner.username)


def unfollow_user(db: Session, viewer: User, username: str) -> ProfileResponse:
    owner = get_user_by_username(db, username)
    existing = _follow_between(db, viewer.id, owner.id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You are not following this user")
    if existing.status == FOLLOW_PENDING:
        delete_actor_notifications(
            db,
            recipient_id=owner.id,
            actor_id=viewer.id,
            notification_type=TYPE_FOLLOW_REQUEST,
        )
    db.delete(existing)
    db.commit()
    return read_profile(db, viewer, owner.username)


def _pending_request(db: Session, owner: User, follower_username: str) -> UserFollow:
    follower = get_user_by_username(db, follower_username)
    follow = _follow_between(db, follower.id, owner.id)
    if follow is None or follow.status != FOLLOW_PENDING:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow request not found")
    return follow


def approve_follow_request(db: Session, owner: User, follower_username: str) -> None:
    follow = _pending_request(db, owner, follower_username)
    follow.status = FOLLOW_ACCEPTED
    db.commit()


def reject_follow_request(db: Session, owner: User, follower_username: str) -> None:
    follow = _pending_request(db, owner, follower_username)
    delete_actor_notifications(
        db,
        recipient_id=owner.id,
        actor_id=follow.follower_id,
        notification_type=TYPE_FOLLOW_REQUEST,
    )
    db.delete(follow)
    db.commit()


def remove_follower(db: Session, owner: User, follower_username: str) -> None:
    follower = get_user_by_username(db, follower_username)
    follow = _follow_between(db, follower.id, owner.id)
    if follow is None or follow.status != FOLLOW_ACCEPTED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follower not found")
    db.delete(follow)
    db.commit()


def read_shared_collection(
    db: Session,
    viewer: User,
    username: str,
    page: int,
    status_filter: LibraryStatus | None,
) -> SharedCollectionResponse:
    owner = get_user_by_username(db, username)
    if not can_view_collection(db, viewer, owner):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This collection is not shared with you")
    watched_counts = (
        select(
            EpisodeProgress.anime_id.label("anime_id"),
            func.count(EpisodeProgress.id).label("watched_count"),
        )
        .where(EpisodeProgress.user_id == owner.id)
        .group_by(EpisodeProgress.anime_id)
        .subquery()
    )
    filters = [UserAnime.user_id == owner.id]
    if status_filter is not None:
        filters.append(UserAnime.status == status_filter.value)
    if owner.share_favorites_only and viewer.id != owner.id:
        filters.append(UserAnime.is_favorite.is_(True))
    rows = db.execute(
        select(UserAnime, Anime, func.coalesce(watched_counts.c.watched_count, 0))
        .join(Anime, Anime.id == UserAnime.anime_id)
        .outerjoin(watched_counts, watched_counts.c.anime_id == UserAnime.anime_id)
        .where(*filters)
        .order_by(UserAnime.updated_at.desc(), Anime.anilist_id.asc())
        .offset((page - 1) * COLLECTION_PAGE_SIZE)
        .limit(COLLECTION_PAGE_SIZE + 1)
    ).all()
    total_count = int(
        db.scalar(
            select(func.count())
            .select_from(UserAnime)
            .join(Anime, Anime.id == UserAnime.anime_id)
            .where(*filters)
        )
        or 0
    )
    has_next_page = len(rows) > COLLECTION_PAGE_SIZE
    return SharedCollectionResponse(
        page=page,
        has_next_page=has_next_page,
        total_count=total_count,
        results=[
            SharedCollectionItem(
                anilist_id=anime.anilist_id,
                title_romaji=anime.title_romaji,
                title_english=anime.title_english,
                cover_url=anime.cover_url,
                format=anime.format,
                status=LibraryStatus(entry.status),
                watched_count=int(watched_count),
                last_episode_watched=entry.last_episode_watched,
                total_episodes=anime.total_episodes,
            )
            for entry, anime, watched_count in rows[:COLLECTION_PAGE_SIZE]
        ],
    )


def list_shared_sites(db: Session, viewer: User, username: str) -> list[SharedSiteResponse]:
    owner = get_user_by_username(db, username)
    if not can_view_sites(db, viewer, owner):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="These watch sites are not shared with you")
    sites = db.scalars(
        select(UserSite).where(UserSite.user_id == owner.id).order_by(UserSite.name.asc())
    ).all()
    copied_ids = set(
        db.scalars(select(CopiedSite.source_site_id).where(CopiedSite.user_id == viewer.id)).all()
    )
    visible: list[SharedSiteResponse] = []
    for site in sites:
        if not is_http_url(site.base_url):
            continue
        visible.append(
            SharedSiteResponse(
                id=site.id,
                name=site.name,
                base_url=site.base_url,
                episode_url_template=_copyable_template(site.episode_url_template),
                search_url_template=_copyable_template(site.search_url_template),
                already_copied=site.id in copied_ids,
            )
        )
    return visible


def _copyable_template(value: str | None) -> str | None:
    raw = (value or "").strip()
    if not raw or not is_http_url(raw):
        return None
    return raw


def _copied_response(row: CopiedSite) -> CopiedSiteResponse:
    return CopiedSiteResponse(
        id=row.id,
        name=row.name,
        base_url=row.base_url,
        episode_url_template=row.episode_url_template,
        search_url_template=row.search_url_template,
        source_username=row.source_username,
        source_site_id=row.source_site_id,
    )


def copy_shared_sites(db: Session, viewer: User, username: str, site_ids: list[UUID]) -> CopySitesResponse:
    owner = get_user_by_username(db, username)
    if viewer.id == owner.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="You cannot copy your own sites")
    if not can_view_sites(db, viewer, owner):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="These watch sites are not shared with you")
    unique_ids = list(dict.fromkeys(site_ids))
    sites = db.scalars(
        select(UserSite).where(UserSite.user_id == owner.id, UserSite.id.in_(unique_ids))
    ).all()
    if len(sites) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more watch sites were not found")
    existing = set(
        db.scalars(
            select(CopiedSite.source_site_id).where(
                CopiedSite.user_id == viewer.id,
                CopiedSite.source_site_id.in_(unique_ids),
            )
        ).all()
    )
    created: list[CopiedSite] = []
    for site in sites:
        if site.id in existing:
            continue
        if not is_http_url(site.base_url):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Watch site URL is not allowed")
        row = CopiedSite(
            user_id=viewer.id,
            source_user_id=owner.id,
            source_site_id=site.id,
            source_username=owner.username,
            name=site.name,
            base_url=site.base_url.strip(),
            episode_url_template=_copyable_template(site.episode_url_template),
            search_url_template=_copyable_template(site.search_url_template),
        )
        db.add(row)
        created.append(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Watch site was already copied") from None
    for row in created:
        db.refresh(row)
    return CopySitesResponse(
        copied=[_copied_response(row) for row in created],
        already_copied=[site_id for site_id in unique_ids if site_id in existing],
    )


def list_copied_sites(db: Session, user: User) -> list[CopiedSiteResponse]:
    rows = db.scalars(
        select(CopiedSite).where(CopiedSite.user_id == user.id).order_by(CopiedSite.created_at.asc())
    ).all()
    return [_copied_response(row) for row in rows]


def delete_copied_site(db: Session, user: User, copied_site_id: UUID) -> None:
    row = db.scalar(select(CopiedSite).where(CopiedSite.id == copied_site_id, CopiedSite.user_id == user.id))
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Copied watch site not found")
    db.delete(row)
    db.commit()

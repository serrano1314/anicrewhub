from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_accepted_terms
from app.core.terms import (
    CURRENT_TERMS_SECTIONS,
    CURRENT_TERMS_TITLE,
    CURRENT_TERMS_VERSION,
    record_terms_acceptance,
    user_accepted_current_terms,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.library import LibraryStatus
from app.schemas.sharing import (
    CopiedSiteResponse,
    CopySitesRequest,
    CopySitesResponse,
    FollowConnectionItem,
    FollowRequestItem,
    PrivacyResponse,
    PrivacyUpdateRequest,
    ProfileResponse,
    SharedCollectionResponse,
    SharedSiteResponse,
    TermsAcceptRequest,
    TermsDocument,
    TermsSection,
    UserSearchResponse,
)
from app.services.sharing import (
    approve_follow_request,
    copy_shared_sites,
    delete_copied_site,
    follow_user,
    list_copied_sites,
    list_follow_requests,
    list_followers,
    list_following,
    list_shared_sites,
    read_privacy,
    read_profile,
    read_shared_collection,
    reject_follow_request,
    remove_follower,
    search_users,
    unfollow_user,
    update_privacy,
)

router = APIRouter(tags=["sharing"])


@router.get("/terms", response_model=TermsDocument)
def read_terms() -> TermsDocument:
    return TermsDocument(
        version=CURRENT_TERMS_VERSION,
        title=CURRENT_TERMS_TITLE,
        sections=[TermsSection(heading=heading, body=body) for heading, body in CURRENT_TERMS_SECTIONS],
    )


@router.post("/auth/terms/accept", response_model=TermsDocument)
def accept_terms(
    body: TermsAcceptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TermsDocument:
    if body.terms_version != CURRENT_TERMS_VERSION:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Terms version is out of date")
    if not user_accepted_current_terms(current_user):
        record_terms_acceptance(current_user)
        db.commit()
        db.refresh(current_user)
    return read_terms()


@router.get("/me/privacy", response_model=PrivacyResponse)
def get_privacy(current_user: User = Depends(require_accepted_terms)) -> PrivacyResponse:
    return read_privacy(current_user)


@router.patch("/me/privacy", response_model=PrivacyResponse)
def patch_privacy(
    body: PrivacyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> PrivacyResponse:
    return update_privacy(
        db,
        current_user,
        profile_public=body.profile_public,
        share_collection=body.share_collection,
        share_favorites_only=body.share_favorites_only,
        share_watch_sites=body.share_watch_sites,
    )


@router.get("/me/followers", response_model=list[FollowConnectionItem])
def get_followers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> list[FollowConnectionItem]:
    return list_followers(db, current_user)


@router.get("/me/following", response_model=list[FollowConnectionItem])
def get_following(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> list[FollowConnectionItem]:
    return list_following(db, current_user)


@router.get("/me/follow-requests", response_model=list[FollowRequestItem])
def get_follow_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> list[FollowRequestItem]:
    return list_follow_requests(db, current_user)


@router.post("/me/follow-requests/{username}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_request(
    username: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> Response:
    approve_follow_request(db, current_user, username)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/follow-requests/{username}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_request(
    username: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> Response:
    reject_follow_request(db, current_user, username)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me/followers/{username}", status_code=status.HTTP_204_NO_CONTENT)
def delete_follower(
    username: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> Response:
    remove_follower(db, current_user, username)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/copied-sites", response_model=list[CopiedSiteResponse])
def get_copied_sites(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> list[CopiedSiteResponse]:
    return list_copied_sites(db, current_user)


@router.delete("/me/copied-sites/{copied_site_id}", status_code=status.HTTP_204_NO_CONTENT)
def destroy_copied_site(
    copied_site_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> Response:
    delete_copied_site(db, current_user, copied_site_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/users", response_model=UserSearchResponse)
def find_users(
    q: str = Query(default="", max_length=50),
    page: int = Query(default=1, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> UserSearchResponse:
    return search_users(db, current_user, q, page)


@router.get("/users/{username}", response_model=ProfileResponse)
def get_profile(
    username: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> ProfileResponse:
    return read_profile(db, current_user, username)


@router.get("/users/{username}/collection", response_model=SharedCollectionResponse)
def get_collection(
    username: str = Path(min_length=1, max_length=50),
    page: int = Query(default=1, ge=1),
    status_filter: LibraryStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> SharedCollectionResponse:
    return read_shared_collection(db, current_user, username, page, status_filter)


@router.get("/users/{username}/sites", response_model=list[SharedSiteResponse])
def get_sites(
    username: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> list[SharedSiteResponse]:
    return list_shared_sites(db, current_user, username)


@router.post("/users/{username}/sites/copy", response_model=CopySitesResponse)
def copy_sites(
    body: CopySitesRequest,
    username: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> CopySitesResponse:
    return copy_shared_sites(db, current_user, username, body.site_ids)


@router.post("/users/{username}/follow", response_model=ProfileResponse)
def follow(
    username: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> ProfileResponse:
    return follow_user(db, current_user, username)


@router.delete("/users/{username}/follow", response_model=ProfileResponse)
def unfollow(
    username: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> ProfileResponse:
    return unfollow_user(db, current_user, username)

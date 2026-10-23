from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.library import LibraryStatus


class TermsSection(BaseModel):
    heading: str
    body: str


class TermsDocument(BaseModel):
    version: str
    title: str
    sections: list[TermsSection]


class TermsAcceptRequest(BaseModel):
    terms_version: str = Field(min_length=1, max_length=32)


class PrivacyResponse(BaseModel):
    profile_public: bool
    share_collection: bool
    share_favorites_only: bool
    share_watch_sites: bool


class PrivacyUpdateRequest(BaseModel):
    profile_public: bool | None = None
    share_collection: bool | None = None
    share_favorites_only: bool | None = None
    share_watch_sites: bool | None = None


class UserSearchResult(BaseModel):
    username: str
    avatar_id: str | None
    profile_public: bool
    follower_count: int | None
    is_self: bool = False
    follow_state: str | None = None
    follows_you: str | None = None


class UserSearchResponse(BaseModel):
    page: int
    has_next_page: bool
    results: list[UserSearchResult]


class ProfileResponse(BaseModel):
    username: str
    avatar_id: str | None
    is_self: bool
    profile_public: bool
    follow_state: str | None
    follows_you: str | None = None
    follower_count: int | None
    following_count: int | None
    can_view_collection: bool
    can_view_sites: bool
    incoming_request_count: int | None = None


class FollowRequestItem(BaseModel):
    username: str
    avatar_id: str | None


class FollowConnectionItem(BaseModel):
    username: str
    avatar_id: str | None
    profile_public: bool


class SharedCollectionItem(BaseModel):
    anilist_id: int
    title_romaji: str
    title_english: str | None
    cover_url: str | None
    format: str | None
    status: LibraryStatus
    watched_count: int
    last_episode_watched: int
    total_episodes: int | None


class SharedCollectionResponse(BaseModel):
    page: int
    has_next_page: bool
    total_count: int
    results: list[SharedCollectionItem]


class SharedSiteResponse(BaseModel):
    id: UUID
    name: str
    base_url: str
    episode_url_template: str | None
    search_url_template: str | None
    already_copied: bool


class CopySitesRequest(BaseModel):
    site_ids: list[UUID] = Field(min_length=1, max_length=100)


class CopiedSiteResponse(BaseModel):
    id: UUID
    name: str
    base_url: str
    episode_url_template: str | None
    search_url_template: str | None
    source_username: str
    source_site_id: UUID


class CopySitesResponse(BaseModel):
    copied: list[CopiedSiteResponse]
    already_copied: list[UUID]

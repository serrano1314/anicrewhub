from enum import StrEnum

from pydantic import BaseModel, Field


class LibraryStatus(StrEnum):
    watching = "watching"
    completed = "completed"
    plan_to_watch = "plan_to_watch"
    on_hold = "on_hold"
    dropped = "dropped"


class LibrarySort(StrEnum):
    updated = "updated"
    title = "title"
    rating = "rating"
    progress = "progress"


class LibraryCreateRequest(BaseModel):
    anilist_id: int = Field(ge=1)
    status: LibraryStatus


class LibraryUpdateRequest(BaseModel):
    status: LibraryStatus | None = None
    score: int | None = Field(default=None, ge=1, le=10)
    is_favorite: bool | None = None


class LibraryEntryResponse(BaseModel):
    anilist_id: int
    status: LibraryStatus
    is_favorite: bool
    score: int | None
    last_episode_watched: int
    watched_count: int
    total_episodes: int | None
    title_romaji: str
    title_english: str | None
    cover_url: str | None
    format: str | None


class LibrarySummaryResponse(BaseModel):
    total: int
    favorites: int
    watching: int
    completed: int
    plan_to_watch: int
    on_hold: int
    dropped: int


class LibraryListResponse(BaseModel):
    page: int
    has_next_page: bool
    total_count: int
    total_pages: int
    summary: LibrarySummaryResponse
    results: list[LibraryEntryResponse]


class EpisodeUpdateRequest(BaseModel):
    watched: bool
    source_site: str | None = Field(default=None, max_length=200)


class WatchedEpisodesResponse(BaseModel):
    anilist_id: int
    episodes: list[int]


class ProgressStateResponse(BaseModel):
    anilist_id: int
    watched_count: int
    last_episode_watched: int
    status: LibraryStatus
    total_episodes: int | None

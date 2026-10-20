from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class AnimeDiscoveryKind(StrEnum):
    latest = "latest"
    trending = "trending"


class ExternalLink(BaseModel):
    site: str
    url: str


class AnimeTag(BaseModel):
    name: str
    rank: int | None = None
    is_spoiler: bool = False


class RelatedAnime(BaseModel):
    anilist_id: int
    title: str
    relation: str
    format: str | None = None
    cover_url: str | None = None


class AnimeDetails(BaseModel):
    genres: list[str] = Field(default_factory=list)
    studios: list[str] = Field(default_factory=list)
    tags: list[AnimeTag] = Field(default_factory=list)
    related_anime: list[RelatedAnime] = Field(default_factory=list)
    source: str | None = None
    duration_minutes: int | None = None
    country_of_origin: str | None = None
    season: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    popularity: int | None = None
    favorites: int | None = None
    banner_url: str | None = None
    trailer_url: str | None = None
    next_episode: int | None = None
    next_airing_at: int | None = None


class AnimeData(BaseModel):
    anilist_id: int
    mal_id: int | None = None
    title_romaji: str
    title_english: str | None = None
    title_synonyms: list[str] = Field(default_factory=list)
    cover_url: str | None = None
    description: str | None = None
    format: str | None = None
    total_episodes: int | None = None
    average_score: int | None = None
    airing_status: str | None = None
    season_year: int | None = None
    external_links: list[ExternalLink] = Field(default_factory=list)
    details: AnimeDetails = Field(default_factory=AnimeDetails)


class AnimeResponse(AnimeData):
    model_config = ConfigDict(from_attributes=True)

    last_synced_at: datetime


class AnimeSearchResponse(BaseModel):
    page: int
    has_next_page: bool
    results: list[AnimeData]

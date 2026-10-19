from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.anime import AnimeData, ExternalLink
from app.schemas.library import LibraryStatus

LIBRARY_EXPORT_VERSION = 1

"""
Import merge rules (v1):
- Anime cache: upsert each embedded anime snapshot from the file.
- Library: create missing entries; existing entries get status/score/favorite from the file.
- Episodes: union by episode number; if both sides have the same episode, keep the later watched_at.
- Sites: match by site_key (name + base_url); create or update templates from the file.
- Per-anime site links: upsert by (anilist_id, site_key); anime_url from the file wins.
Import never deletes library rows, episodes, sites, or links that are absent from the file.
"""


class ExportEpisode(BaseModel):
    episode_number: int = Field(ge=1)
    watched_at: datetime
    source_site: str | None = None


class ExportLibraryItem(BaseModel):
    anilist_id: int = Field(ge=1)
    status: LibraryStatus
    is_favorite: bool = False
    score: int | None = Field(default=None, ge=1, le=10)
    episodes: list[ExportEpisode] = Field(default_factory=list)
    anime: AnimeData


class ExportSite(BaseModel):
    site_key: str = Field(min_length=1)
    name: str = Field(min_length=1)
    base_url: str = Field(min_length=1)
    episode_url_template: str | None = None
    search_url_template: str | None = None


class ExportAnimeSiteLink(BaseModel):
    anilist_id: int = Field(ge=1)
    site_key: str = Field(min_length=1)
    anime_url: str | None = None


class LibraryExportDocument(BaseModel):
    version: Literal[1] = LIBRARY_EXPORT_VERSION
    exported_at: datetime
    library: list[ExportLibraryItem] = Field(default_factory=list)
    sites: list[ExportSite] = Field(default_factory=list)
    anime_sites: list[ExportAnimeSiteLink] = Field(default_factory=list)


class LibraryImportRequest(BaseModel):
    document: LibraryExportDocument


class LibraryImportResponse(BaseModel):
    library_entries_merged: int
    episodes_added: int
    episodes_updated: int
    sites_merged: int
    anime_site_links_merged: int


def site_export_key(name: str, base_url: str) -> str:
    return f"{name.strip()}\x1f{base_url.strip()}"

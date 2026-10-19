from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import EpisodeProgress, UserAnime
from app.models.sites import UserAnimeSite, UserSite
from app.models.user import User
from app.schemas.anime import AnimeData
from app.schemas.library import LibraryStatus
from app.schemas.library_backup import (
    ExportAnimeSiteLink,
    ExportEpisode,
    ExportLibraryItem,
    ExportSite,
    LibraryExportDocument,
    LibraryImportResponse,
    site_export_key,
)
from app.services.anime import upsert_anime
from app.services.progress import _sync_progress


def export_user_library(db: Session, user: User) -> LibraryExportDocument:
    entries = db.scalars(
        select(UserAnime).where(UserAnime.user_id == user.id).order_by(UserAnime.updated_at.desc())
    ).all()
    anime_ids = {entry.anime_id for entry in entries}
    anime_by_id: dict[UUID, Anime] = {}
    if anime_ids:
        for row in db.scalars(select(Anime).where(Anime.id.in_(anime_ids))).all():
            anime_by_id[row.id] = row

    library_items: list[ExportLibraryItem] = []
    for entry in entries:
        anime = anime_by_id.get(entry.anime_id)
        if anime is None:
            continue
        episodes = db.scalars(
            select(EpisodeProgress)
            .where(
                EpisodeProgress.user_id == user.id,
                EpisodeProgress.anime_id == anime.id,
            )
            .order_by(EpisodeProgress.episode_number.asc())
        ).all()
        library_items.append(
            ExportLibraryItem(
                anilist_id=anime.anilist_id,
                status=LibraryStatus(entry.status),
                is_favorite=entry.is_favorite,
                score=entry.score,
                episodes=[
                    ExportEpisode(
                        episode_number=row.episode_number,
                        watched_at=_as_utc(row.watched_at),
                        source_site=row.source_site,
                    )
                    for row in episodes
                ],
                anime=_anime_data(anime),
            )
        )

    sites = db.scalars(select(UserSite).where(UserSite.user_id == user.id).order_by(UserSite.name.asc())).all()
    export_sites = [
        ExportSite(
            site_key=site_export_key(site.name, site.base_url),
            name=site.name,
            base_url=site.base_url,
            episode_url_template=site.episode_url_template,
            search_url_template=site.search_url_template,
        )
        for site in sites
    ]

    anime_site_rows = db.scalars(
        select(UserAnimeSite).where(UserAnimeSite.user_id == user.id).order_by(UserAnimeSite.created_at.asc())
    ).all()
    anime_sites: list[ExportAnimeSiteLink] = []
    for link in anime_site_rows:
        site = db.get(UserSite, link.site_id)
        anime = db.get(Anime, link.anime_id)
        if site is None or anime is None:
            continue
        anime_sites.append(
            ExportAnimeSiteLink(
                anilist_id=anime.anilist_id,
                site_key=site_export_key(site.name, site.base_url),
                anime_url=link.anime_url,
            )
        )

    return LibraryExportDocument(
        exported_at=datetime.now(timezone.utc),
        library=library_items,
        sites=export_sites,
        anime_sites=anime_sites,
    )


def import_user_library(db: Session, user: User, document: LibraryExportDocument) -> LibraryImportResponse:
    if document.version != 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Unsupported export version",
        )

    episodes_added = 0
    episodes_updated = 0
    library_merged = 0
    sites_merged = 0
    links_merged = 0

    site_key_to_id: dict[str, UUID] = {}
    for site in document.sites:
        site_id = _merge_site(db, user.id, site)
        site_key_to_id[site.site_key] = site_id
        sites_merged += 1

    anilist_to_anime_id: dict[int, UUID] = {}
    for item in document.library:
        anime = upsert_anime(db, item.anime, synced_at=datetime.now(timezone.utc))
        anilist_to_anime_id[item.anilist_id] = anime.id
        entry = _merge_library_entry(db, user.id, anime.id, item)
        library_merged += 1
        added, updated = _merge_episodes(db, user.id, anime.id, item.episodes)
        episodes_added += added
        episodes_updated += updated
        _sync_progress(db, entry, anime)

    for link in document.anime_sites:
        anime_id = anilist_to_anime_id.get(link.anilist_id)
        if anime_id is None:
            anime = db.scalar(select(Anime).where(Anime.anilist_id == link.anilist_id))
            if anime is None:
                continue
            anime_id = anime.id
        site_id = site_key_to_id.get(link.site_key)
        if site_id is None:
            continue
        _merge_anime_site(db, user.id, anime_id, site_id, link)
        links_merged += 1

    db.commit()
    return LibraryImportResponse(
        library_entries_merged=library_merged,
        episodes_added=episodes_added,
        episodes_updated=episodes_updated,
        sites_merged=sites_merged,
        anime_site_links_merged=links_merged,
    )


def _merge_site(db: Session, user_id: UUID, site: ExportSite) -> UUID:
    rows = db.scalars(select(UserSite).where(UserSite.user_id == user_id)).all()
    for row in rows:
        if site_export_key(row.name, row.base_url) == site.site_key:
            row.episode_url_template = site.episode_url_template
            row.search_url_template = site.search_url_template
            db.flush()
            return row.id

    row = UserSite(
        user_id=user_id,
        name=site.name,
        base_url=site.base_url,
        episode_url_template=site.episode_url_template,
        search_url_template=site.search_url_template,
    )
    db.add(row)
    db.flush()
    return row.id


def _merge_library_entry(
    db: Session,
    user_id: UUID,
    anime_id: UUID,
    item: ExportLibraryItem,
) -> UserAnime:
    entry = db.scalar(
        select(UserAnime).where(UserAnime.user_id == user_id, UserAnime.anime_id == anime_id)
    )
    if entry is None:
        entry = UserAnime(
            user_id=user_id,
            anime_id=anime_id,
            status=item.status.value,
            is_favorite=item.is_favorite,
            score=item.score,
            last_episode_watched=0,
        )
        db.add(entry)
    else:
        entry.status = item.status.value
        entry.is_favorite = item.is_favorite
        entry.score = item.score
    db.flush()
    return entry


def _merge_episodes(
    db: Session,
    user_id: UUID,
    anime_id: UUID,
    episodes: list[ExportEpisode],
) -> tuple[int, int]:
    added = 0
    updated = 0
    for episode in episodes:
        existing = db.scalar(
            select(EpisodeProgress).where(
                EpisodeProgress.user_id == user_id,
                EpisodeProgress.anime_id == anime_id,
                EpisodeProgress.episode_number == episode.episode_number,
            )
        )
        watched_at = _as_utc(episode.watched_at)
        if existing is None:
            now = datetime.now(timezone.utc)
            db.add(
                EpisodeProgress(
                    id=uuid4(),
                    user_id=user_id,
                    anime_id=anime_id,
                    episode_number=episode.episode_number,
                    watched_at=watched_at,
                    source_site=episode.source_site,
                    created_at=now,
                    updated_at=now,
                )
            )
            added += 1
            continue
        existing_watched = _as_utc(existing.watched_at)
        if watched_at > existing_watched:
            existing.watched_at = watched_at
            if episode.source_site is not None:
                existing.source_site = episode.source_site
            updated += 1
    db.flush()
    return added, updated


def _merge_anime_site(
    db: Session,
    user_id: UUID,
    anime_id: UUID,
    site_id: UUID,
    link: ExportAnimeSiteLink,
) -> None:
    row = db.scalar(
        select(UserAnimeSite).where(
            UserAnimeSite.user_id == user_id,
            UserAnimeSite.anime_id == anime_id,
            UserAnimeSite.site_id == site_id,
        )
    )
    if row is None:
        db.add(
            UserAnimeSite(
                user_id=user_id,
                anime_id=anime_id,
                site_id=site_id,
                anime_url=link.anime_url,
            )
        )
    else:
        row.anime_url = link.anime_url
    db.flush()


def _anime_data(anime: Anime) -> AnimeData:
    return AnimeData(
        anilist_id=anime.anilist_id,
        mal_id=anime.mal_id,
        title_romaji=anime.title_romaji,
        title_english=anime.title_english,
        title_synonyms=list(anime.title_synonyms or []),
        cover_url=anime.cover_url,
        format=anime.format,
        total_episodes=anime.total_episodes,
        airing_status=anime.airing_status,
        season_year=anime.season_year,
        external_links=anime.external_links or [],
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

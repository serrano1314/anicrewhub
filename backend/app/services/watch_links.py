import re
from urllib.parse import quote, quote_plus, urlsplit

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.sites import UserAnimeSite, UserSite
from app.models.social import CopiedSite
from app.models.user import User
from app.schemas.watch_links import WatchLink, WatchLinkSource

_SLUG_PART = re.compile(r"[a-z0-9]+")


def preferred_title(anime: Anime) -> str:
    english = (anime.title_english or "").strip()
    if english:
        return english
    return (anime.title_romaji or "").strip()


def slugify_title(title: str) -> str:
    return "-".join(_SLUG_PART.findall(title.lower()))


def fill_template(template: str, *, title: str, episode: int) -> str:
    return (
        template.replace("{slug}", slugify_title(title))
        .replace("{title}", quote(title, safe=""))
        .replace("{episode}", str(episode))
    )


def google_search_url(title: str, episode: int) -> str:
    query = quote_plus(f"watch {title} episode {episode}")
    return f"https://www.google.com/search?q={query}"


def is_http_url(value: str) -> bool:
    parts = urlsplit(value.strip())
    return parts.scheme in {"http", "https"} and bool(parts.netloc)


def build_saved_url(
    *,
    title: str,
    episode: int,
    anime_url: str | None,
    episode_url_template: str | None,
    search_url_template: str | None,
) -> str | None:
    direct = (anime_url or "").strip()
    if direct:
        return direct if is_http_url(direct) else None
    for template in (episode_url_template, search_url_template):
        filled = _filled_template(template, title=title, episode=episode)
        if filled is not None:
            return filled
    return None


def list_watch_links(db: Session, user: User, anilist_id: int, episode: int) -> list[WatchLink]:
    anime = db.scalar(select(Anime).where(Anime.anilist_id == anilist_id))
    if anime is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anime not found")

    title = preferred_title(anime)
    saved = db.execute(
        select(UserAnimeSite, UserSite)
        .join(UserSite, UserSite.id == UserAnimeSite.site_id)
        .where(UserAnimeSite.user_id == user.id, UserAnimeSite.anime_id == anime.id)
        .order_by(UserAnimeSite.created_at.asc(), UserAnimeSite.id.asc())
    ).all()

    links: list[WatchLink] = []
    if saved:
        for anime_site, site in saved:
            url = build_saved_url(
                title=title,
                episode=episode,
                anime_url=anime_site.anime_url,
                episode_url_template=site.episode_url_template,
                search_url_template=site.search_url_template,
            )
            if url is None:
                continue
            links.append(WatchLink(label=site.name, url=url, source=WatchLinkSource.saved))
    copied_sites = db.scalars(
        select(CopiedSite).where(CopiedSite.user_id == user.id).order_by(CopiedSite.created_at.asc())
    ).all()
    for copied in copied_sites:
        url = build_saved_url(
            title=title,
            episode=episode,
            anime_url=None,
            episode_url_template=copied.episode_url_template,
            search_url_template=copied.search_url_template,
        )
        if url is None and is_http_url(copied.base_url):
            url = copied.base_url.strip()
        if url is None:
            continue
        links.append(WatchLink(label=copied.name, url=url, source=WatchLinkSource.copied))
    links.extend(_official_links(anime))

    links.append(
        WatchLink(
            label="Google search",
            url=google_search_url(title, episode),
            source=WatchLinkSource.search,
        )
    )
    return links


def _filled_template(template: str | None, *, title: str, episode: int) -> str | None:
    raw = (template or "").strip()
    if not raw:
        return None
    url = fill_template(raw, title=title, episode=episode)
    if not is_http_url(url):
        return None
    return url


def _official_links(anime: Anime) -> list[WatchLink]:
    raw_links = anime.external_links
    if not isinstance(raw_links, list):
        return []
    links: list[WatchLink] = []
    for item in raw_links:
        if not isinstance(item, dict):
            continue
        site = item.get("site")
        url = item.get("url")
        if not isinstance(site, str) or not isinstance(url, str):
            continue
        label = site.strip()
        target = url.strip()
        if not label or not is_http_url(target):
            continue
        links.append(WatchLink(label=label, url=target, source=WatchLinkSource.official))
    return links

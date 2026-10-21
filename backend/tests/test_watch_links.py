from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.sites import UserAnimeSite, UserSite
from app.models.social import CopiedSite
from app.models.user import User
from app.schemas.watch_links import WatchLinkSource
from app.services.watch_links import (
    build_saved_url,
    fill_template,
    google_search_url,
    list_watch_links,
    preferred_title,
    slugify_title,
)


def test_slug_keeps_alnum_runs_and_turns_spaces_into_hyphens() -> None:
    assert slugify_title("Attack on Titan!") == "attack-on-titan"
    assert slugify_title("Re:Zero") == "re-zero"
    assert slugify_title("JoJo's Bizarre Adventure") == "jojo-s-bizarre-adventure"
    assert slugify_title("Steins;Gate 0") == "steins-gate-0"
    assert slugify_title("  Attack   on Titan  ") == "attack-on-titan"


def test_slug_uses_english_title_when_present() -> None:
    anime = _anime(title_romaji="Shingeki no Kyojin", title_english="Attack on Titan")
    assert preferred_title(anime) == "Attack on Titan"
    assert slugify_title(preferred_title(anime)) == "attack-on-titan"


def test_slug_falls_back_to_romaji_when_english_is_missing() -> None:
    anime = _anime(title_romaji="Shingeki no Kyojin", title_english="  ")
    assert preferred_title(anime) == "Shingeki no Kyojin"
    assert slugify_title(preferred_title(anime)) == "shingeki-no-kyojin"


def test_template_fills_episode_title_and_slug() -> None:
    url = fill_template(
        "https://watch.example/{slug}/episode-{episode}?q={title}",
        title="JoJo's Bizarre Adventure",
        episode=12,
    )
    assert url == "https://watch.example/jojo-s-bizarre-adventure/episode-12?q=JoJo%27s%20Bizarre%20Adventure"


def test_saved_url_prefers_anime_page_then_episode_template_then_search() -> None:
    title = "Attack on Titan"
    episode_template = "https://watch.example/{slug}-episode-{episode}"
    search_template = "https://watch.example/search?q={title}"

    assert (
        build_saved_url(
            title=title,
            episode=5,
            anime_url="https://watch.example/aot?ep={episode}",
            episode_url_template=episode_template,
            search_url_template=search_template,
        )
        == "https://watch.example/aot?ep={episode}"
    )
    assert (
        build_saved_url(
            title=title,
            episode=5,
            anime_url="  ",
            episode_url_template=episode_template,
            search_url_template=search_template,
        )
        == "https://watch.example/attack-on-titan-episode-5"
    )
    assert (
        build_saved_url(
            title=title,
            episode=5,
            anime_url=None,
            episode_url_template=None,
            search_url_template=search_template,
        )
        == "https://watch.example/search?q=Attack%20on%20Titan"
    )
    assert (
        build_saved_url(
            title=title,
            episode=5,
            anime_url=None,
            episode_url_template=None,
            search_url_template=None,
        )
        is None
    )


def test_google_search_link_uses_plus_encoded_title() -> None:
    assert google_search_url("One Piece", 812) == (
        "https://www.google.com/search?q=watch+One+Piece+episode+812"
    )
    assert google_search_url("A & B", 2) == "https://www.google.com/search?q=watch+A+%26+B+episode+2"


def test_watch_links_use_saved_sites_before_google_and_skip_official(db: Session) -> None:
    user = _user(db)
    anime = _save_anime(
        db,
        title_english="One Piece",
        title_romaji="One Piece",
        external_links=[
            {"site": "Crunchyroll", "url": "https://www.crunchyroll.com/one-piece"},
            {"site": "Netflix", "url": "https://www.netflix.com/title/one-piece"},
        ],
    )
    earlier = _site(
        db,
        user,
        name="Later alpha",
        episode_url_template="https://later.example/{slug}/{episode}",
        created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )
    first = _site(
        db,
        user,
        name="First site",
        episode_url_template="https://first.example/watch/{slug}-episode-{episode}",
        search_url_template="https://first.example/search?q={title}",
        created_at=datetime(2026, 1, 3, tzinfo=timezone.utc),
    )
    _attach(db, user, anime, first, created_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    _attach(
        db,
        user,
        anime,
        earlier,
        anime_url="https://later.example/one-piece",
        created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
    )

    links = list_watch_links(db, user, anime.anilist_id, 812)

    assert [(link.label, link.url, link.source) for link in links] == [
        (
            "First site",
            "https://first.example/watch/one-piece-episode-812",
            WatchLinkSource.saved,
        ),
        ("Later alpha", "https://later.example/one-piece", WatchLinkSource.saved),
        ("Crunchyroll", "https://www.crunchyroll.com/one-piece", WatchLinkSource.official),
        ("Netflix", "https://www.netflix.com/title/one-piece", WatchLinkSource.official),
        (
            "Google search",
            "https://www.google.com/search?q=watch+One+Piece+episode+812",
            WatchLinkSource.search,
        ),
    ]


def test_watch_links_use_official_streams_when_nothing_is_saved(db: Session) -> None:
    user = _user(db)
    anime = _save_anime(
        db,
        title_english=None,
        title_romaji="Shingeki no Kyojin",
        external_links=[
            {"site": "Crunchyroll", "url": "https://www.crunchyroll.com/aot"},
            {"site": "Notes", "url": "not a url"},
            {"site": "Netflix", "url": "https://www.netflix.com/title/aot"},
        ],
    )

    links = list_watch_links(db, user, anime.anilist_id, 1)

    assert [(link.label, link.url, link.source) for link in links] == [
        ("Crunchyroll", "https://www.crunchyroll.com/aot", WatchLinkSource.official),
        ("Netflix", "https://www.netflix.com/title/aot", WatchLinkSource.official),
        (
            "Google search",
            "https://www.google.com/search?q=watch+Shingeki+no+Kyojin+episode+1",
            WatchLinkSource.search,
        ),
    ]


def test_saved_site_without_a_link_still_returns_official_streams(db: Session) -> None:
    user = _user(db)
    anime = _save_anime(
        db,
        title_english="One Piece",
        title_romaji="One Piece",
        external_links=[{"site": "Crunchyroll", "url": "https://www.crunchyroll.com/one-piece"}],
    )
    site = _site(db, user, name="Home only", episode_url_template=None)
    _attach(db, user, anime, site)

    links = list_watch_links(db, user, anime.anilist_id, 4)

    assert [link.source for link in links] == [WatchLinkSource.official, WatchLinkSource.search]


def test_copied_site_fills_episode_template(db: Session) -> None:
    user = _user(db)
    source = _user(db, "source")
    anime = _save_anime(
        db,
        title_english="One Piece",
        title_romaji="One Piece",
        external_links=[],
    )
    db.add(
        CopiedSite(
            user_id=user.id,
            source_user_id=source.id,
            source_site_id=source.id,
            source_username=source.username,
            name="Example",
            base_url="https://example.com",
            episode_url_template="https://example.com/watch/{slug}/{episode}",
            search_url_template="https://example.com/search?q={title}",
        )
    )
    db.commit()

    links = list_watch_links(db, user, anime.anilist_id, 12)

    copied = next(link for link in links if link.source == WatchLinkSource.copied)
    assert copied.label == "Example"
    assert copied.url == "https://example.com/watch/one-piece/12"


def test_copied_site_without_templates_uses_base_url(db: Session) -> None:
    user = _user(db)
    anime = _save_anime(
        db,
        title_english="One Piece",
        title_romaji="One Piece",
        external_links=[],
    )
    db.add(
        CopiedSite(
            user_id=user.id,
            source_user_id=None,
            source_site_id=user.id,
            source_username="source",
            name="Home",
            base_url="https://example.com/home",
        )
    )
    db.commit()

    links = list_watch_links(db, user, anime.anilist_id, 3)

    copied = next(link for link in links if link.source == WatchLinkSource.copied)
    assert copied.url == "https://example.com/home"


def test_watch_links_ignore_another_users_sites(db: Session) -> None:
    owner = _user(db, "owner")
    other = _user(db, "other")
    anime = _save_anime(
        db,
        title_english="One Piece",
        title_romaji="One Piece",
        external_links=[{"site": "Crunchyroll", "url": "https://www.crunchyroll.com/one-piece"}],
    )
    site = _site(
        db,
        owner,
        name="Mine",
        episode_url_template="https://mine.example/{episode}",
    )
    _attach(db, owner, anime, site)

    links = list_watch_links(db, other, anime.anilist_id, 3)

    assert [link.source for link in links] == [WatchLinkSource.official, WatchLinkSource.search]


def _anime(*, title_romaji: str, title_english: str | None) -> Anime:
    return Anime(
        anilist_id=1,
        title_romaji=title_romaji,
        title_english=title_english,
        title_synonyms=[],
        external_links=[],
        last_synced_at=datetime.now(timezone.utc),
    )


def _user(db: Session, username: str = "steven") -> User:
    user = User(email=f"{username}@example.com", username=username, password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _save_anime(
    db: Session,
    *,
    title_romaji: str,
    title_english: str | None,
    external_links: list[dict[str, str]],
) -> Anime:
    anime = Anime(
        anilist_id=21,
        title_romaji=title_romaji,
        title_english=title_english,
        title_synonyms=[],
        external_links=external_links,
        format="TV",
        total_episodes=1000,
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(anime)
    db.commit()
    db.refresh(anime)
    return anime


def _site(
    db: Session,
    user: User,
    *,
    name: str,
    episode_url_template: str | None,
    search_url_template: str | None = None,
    created_at: datetime | None = None,
) -> UserSite:
    site = UserSite(
        user_id=user.id,
        name=name,
        base_url="https://watch.example",
        episode_url_template=episode_url_template,
        search_url_template=search_url_template,
    )
    if created_at is not None:
        site.created_at = created_at
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


def _attach(
    db: Session,
    user: User,
    anime: Anime,
    site: UserSite,
    *,
    anime_url: str | None = None,
    created_at: datetime | None = None,
) -> None:
    link = UserAnimeSite(
        user_id=user.id,
        anime_id=anime.id,
        site_id=site.id,
        anime_url=anime_url,
    )
    if created_at is not None:
        link.created_at = created_at
    db.add(link)
    db.commit()

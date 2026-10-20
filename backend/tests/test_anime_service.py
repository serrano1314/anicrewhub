from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import UserAnime
from app.models.user import User
from app.schemas.anime import AnimeData, AnimeSearchResponse, ExternalLink
from app.schemas.library import LibraryStatus
from app.services.anime import get_anime, search_anime
from app.services.anilist import AniListError
from app.services.library import list_library


class FakeAniList:
    def __init__(self, data: AnimeData) -> None:
        self.data = data
        self.fetch_calls = 0
        self.search_calls = 0

    def search(self, query: str, page: int) -> AnimeSearchResponse:
        self.search_calls += 1
        return AnimeSearchResponse(page=page, has_next_page=False, results=[self.data])

    def fetch_media(self, anilist_id: int) -> AnimeData:
        self.fetch_calls += 1
        return self.data.model_copy(update={"anilist_id": anilist_id})


def _data(**overrides: object) -> AnimeData:
    base = AnimeData(
        anilist_id=21,
        mal_id=21,
        title_romaji="One Piece",
        title_english="One Piece",
        title_synonyms=["OP"],
        cover_url="https://example.com/one-piece.jpg",
        description="A pirate crew searches for the legendary treasure.",
        format="TV",
        total_episodes=None,
        airing_status="RELEASING",
        season_year=1999,
        external_links=[
            ExternalLink(site="Crunchyroll", url="https://www.crunchyroll.com/one-piece")
        ],
    )
    if not overrides:
        return base
    return base.model_copy(update=overrides)


def test_get_anime_inserts_a_row_when_missing(db: Session) -> None:
    client = FakeAniList(_data())
    saved = get_anime(db, 21, client=client)
    assert saved.anilist_id == 21
    assert saved.title_romaji == "One Piece"
    assert saved.description == "A pirate crew searches for the legendary treasure."
    assert saved.external_links == [
        {"site": "Crunchyroll", "url": "https://www.crunchyroll.com/one-piece"}
    ]
    assert client.fetch_calls == 1
    assert db.scalar(select(func.count()).select_from(Anime)) == 1


def test_get_anime_skips_fetch_when_a_finished_show_is_fresh(db: Session) -> None:
    client = FakeAniList(_data(airing_status="FINISHED", total_episodes=12))
    get_anime(db, 21, client=client)
    again = get_anime(db, 21, client=client)
    assert again.title_romaji == "One Piece"
    assert again.total_episodes == 12
    assert client.fetch_calls == 1


def test_releasing_show_refreshes_even_when_the_cache_is_new(db: Session) -> None:
    client = FakeAniList(_data(total_episodes=1100))
    get_anime(db, 21, client=client)
    client.data = _data(total_episodes=1180)
    refreshed = get_anime(db, 21, client=client)
    assert refreshed.total_episodes == 1180
    assert refreshed.airing_status == "RELEASING"
    assert client.fetch_calls == 2
    assert db.scalar(select(func.count()).select_from(Anime)) == 1


def test_get_anime_resyncs_when_stale(db: Session) -> None:
    stale_at = datetime.now(timezone.utc) - timedelta(hours=48)
    client = FakeAniList(
        _data(title_romaji="One Piece (updated)", total_episodes=1155, airing_status="FINISHED")
    )
    get_anime(db, 21, client=client, now=stale_at)
    refreshed = get_anime(db, 21, client=client)
    assert refreshed.title_romaji == "One Piece (updated)"
    assert refreshed.total_episodes == 1155
    assert client.fetch_calls == 2
    assert db.scalar(select(func.count()).select_from(Anime)) == 1


def test_force_refresh_updates_the_same_row(db: Session) -> None:
    client = FakeAniList(_data())
    get_anime(db, 21, client=client)
    client.data = _data(title_romaji="One Piece Film")
    forced = get_anime(db, 21, force=True, client=client)
    assert forced.title_romaji == "One Piece Film"
    assert client.fetch_calls == 2
    assert db.scalar(select(func.count()).select_from(Anime)) == 1


def test_library_list_updates_an_airing_show(db: Session) -> None:
    client = FakeAniList(_data(total_episodes=1100))
    saved = get_anime(db, 21, client=client)
    user = User(email="steven@example.com", username="steven", password_hash="hash")
    db.add(user)
    db.commit()
    db.add(
        UserAnime(
            user_id=user.id,
            anime_id=saved.id,
            status=LibraryStatus.watching.value,
            last_episode_watched=811,
        )
    )
    db.commit()
    client.data = _data(total_episodes=1180)

    listed = list_library(db, user, status_filter=None, page=1, client=client)

    assert listed.results[0].total_episodes == 1180
    assert client.fetch_calls == 2


def test_library_list_keeps_the_cache_when_anilist_fails(db: Session) -> None:
    class FailingAniList(FakeAniList):
        def fetch_media(self, anilist_id: int) -> AnimeData:
            self.fetch_calls += 1
            raise AniListError("down")

    client = FailingAniList(_data(total_episodes=1100))
    saved = get_anime(db, 21, client=FakeAniList(_data(total_episodes=1100)))
    user = User(email="steven@example.com", username="steven", password_hash="hash")
    db.add(user)
    db.commit()
    db.add(
        UserAnime(
            user_id=user.id,
            anime_id=saved.id,
            status=LibraryStatus.watching.value,
            last_episode_watched=0,
        )
    )
    db.commit()

    listed = list_library(db, user, status_filter=None, page=1, client=client)

    assert listed.results[0].total_episodes == 1100
    assert client.fetch_calls == 1


def test_search_does_not_write_the_cache(db: Session) -> None:
    client = FakeAniList(_data())
    page = search_anime("One Piece", 1, client=client)
    assert page.results[0].anilist_id == 21
    assert client.search_calls == 1
    assert db.scalar(select(func.count()).select_from(Anime)) == 0

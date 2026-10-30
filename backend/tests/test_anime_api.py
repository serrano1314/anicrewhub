from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.discovery import AnimeDiscoverySnapshot
from app.schemas.anime import (
    AnimeData,
    AnimeDetails,
    AnimeDiscoveryKind,
    AnimeSearchResponse,
    ExternalLink,
    RelatedAnime,
)
from app.services.anilist import AniListNotFound, AniListRateLimited, AniListUnavailable

REGISTER_BODY = {
    "email": "steven@example.com",
    "username": "steven",
    "password": "password123",
    "terms_version": "2026-10-21",
}


class FakeAniList:
    def __init__(self) -> None:
        self.fetch_calls = 0
        self.related_calls = 0
        self.data = AnimeData(
            anilist_id=21,
            mal_id=21,
            title_romaji="One Piece",
            title_english="One Piece",
            title_synonyms=["OP"],
            cover_url="https://example.com/one-piece.jpg",
            description="A pirate crew searches for the legendary treasure.",
            format="TV",
            total_episodes=1155,
            airing_status="RELEASING",
            season_year=1999,
            external_links=[
                ExternalLink(site="Crunchyroll", url="https://www.crunchyroll.com/one-piece")
            ],
        )

    def search(self, query: str, page: int) -> AnimeSearchResponse:
        return AnimeSearchResponse(page=page, has_next_page=False, results=[self.data])

    def discover(self, kind: AnimeDiscoveryKind) -> AnimeSearchResponse:
        return AnimeSearchResponse(page=1, has_next_page=False, results=[self.data])

    def fetch_media(self, anilist_id: int) -> AnimeData:
        self.fetch_calls += 1
        if anilist_id == 404:
            raise AniListNotFound("missing")
        if anilist_id == 429:
            raise AniListRateLimited("slow down")
        if anilist_id == 500:
            raise AniListUnavailable("down")
        return self.data.model_copy(update={"anilist_id": anilist_id})

    def fetch_related(self, anilist_id: int) -> list[RelatedAnime]:
        self.related_calls += 1
        return [
            RelatedAnime(
                anilist_id=22,
                title="One Piece: Episode 0",
                relation="PREQUEL",
                format="OVA",
                cover_url="https://example.com/episode-zero.jpg",
            )
        ]


def _auth(client: TestClient) -> dict[str, str]:
    response = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_search_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/anime/search", params={"q": "One Piece"})
    assert response.status_code == 401


def test_discovery_is_public_and_does_not_save_anime(
    client: TestClient,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeAniList()
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: fake)
    response = client.get("/api/v1/anime/discover/trending")
    assert response.status_code == 200
    assert response.json()["results"][0]["anilist_id"] == 21
    assert response.json()["results"][0]["average_score"] is None
    assert db.scalar(select(func.count()).select_from(Anime)) == 0
    snapshot = db.get(AnimeDiscoverySnapshot, "trending")
    assert snapshot is not None
    assert snapshot.payload["results"][0]["anilist_id"] == 21


def test_search_returns_mapped_results_without_saving(
    client: TestClient,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeAniList()
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: fake)
    response = client.get(
        "/api/v1/anime/search",
        params={"q": "One Piece"},
        headers=_auth(client),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["results"][0]["anilist_id"] == 21
    assert body["results"][0]["external_links"] == [
        {"site": "Crunchyroll", "url": "https://www.crunchyroll.com/one-piece"}
    ]
    assert body["results"][0]["description"] == "A pirate crew searches for the legendary treasure."
    assert db.scalar(select(func.count()).select_from(Anime)) == 0


def test_blank_search_is_rejected(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: FakeAniList())
    response = client.get(
        "/api/v1/anime/search",
        params={"q": "   "},
        headers=_auth(client),
    )
    assert response.status_code == 422


def test_opening_anime_saves_it_and_second_open_uses_cache(
    client: TestClient,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeAniList()
    fake.data = fake.data.model_copy(update={"airing_status": "FINISHED"})
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: fake)
    headers = _auth(client)
    first = client.get("/api/v1/anime/21", headers=headers)
    assert first.status_code == 200
    body = first.json()
    assert body["anilist_id"] == 21
    assert body["title_romaji"] == "One Piece"
    assert body["description"] == "A pirate crew searches for the legendary treasure."
    assert body["airing_status"] == "FINISHED"
    assert body["last_synced_at"]
    assert body["details"]["genres"] == []
    assert "id" not in body
    row = db.scalar(select(Anime).where(Anime.anilist_id == 21))
    assert row is not None
    assert row.title_synonyms == ["OP"]

    second = client.get("/api/v1/anime/21", headers=headers)
    assert second.status_code == 200
    assert fake.fetch_calls == 1


def test_related_anime_is_available_from_its_own_endpoint(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = FakeAniList()
    monkeypatch.setattr("app.api.anime.get_anilist_client", lambda: fake)
    headers = _auth(client)

    response = client.get("/api/v1/anime/21/related", headers=headers)

    assert response.status_code == 200
    assert response.json()[0]["title"] == "One Piece: Episode 0"
    assert fake.related_calls == 1
    assert fake.fetch_calls == 0


def test_opening_old_cached_anime_refetches_extended_details(
    client: TestClient,
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cached = Anime(
        anilist_id=21,
        title_romaji="Cached title",
        title_synonyms=[],
        external_links=[],
        details={},
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(cached)
    db.commit()
    fake = FakeAniList()
    fake.data = fake.data.model_copy(
        update={
            "details": AnimeDetails(
                genres=["Adventure"],
                studios=["Toei Animation"],
            )
        }
    )
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: fake)

    response = client.get("/api/v1/anime/21", headers=_auth(client))

    assert response.status_code == 200
    assert response.json()["details"]["genres"] == ["Adventure"]
    assert fake.fetch_calls == 1


def test_force_cache_refetches(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    fake = FakeAniList()
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: fake)
    headers = _auth(client)
    assert client.get("/api/v1/anime/21", headers=headers).status_code == 200
    forced = client.post("/api/v1/anime/from-anilist/21", headers=headers)
    assert forced.status_code == 200
    assert forced.json()["anilist_id"] == 21
    assert fake.fetch_calls == 2


def test_missing_anime_returns_404(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: FakeAniList())
    response = client.get("/api/v1/anime/404", headers=_auth(client))
    assert response.status_code == 404


def test_rate_limit_and_outage_status_codes(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.services.anime.get_anilist_client", lambda: FakeAniList())
    headers = _auth(client)
    assert client.get("/api/v1/anime/429", headers=headers).status_code == 429
    assert client.get("/api/v1/anime/500", headers=headers).status_code == 502

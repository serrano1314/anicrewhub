from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import EpisodeProgress, UserAnime

REGISTER_BODY = {
    "email": "steven@example.com",
    "username": "steven",
    "password": "password123",
}


def _auth(client: TestClient, body: dict[str, str] | None = None) -> dict[str, str]:
    response = client.post("/api/v1/auth/register", json=body or REGISTER_BODY)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _cache(db: Session, anilist_id: int = 21, total: int | None = 24) -> Anime:
    anime = Anime(
        anilist_id=anilist_id,
        title_romaji="One Piece",
        title_english="One Piece",
        title_synonyms=["OP"],
        cover_url="https://example.com/one-piece.jpg",
        format="TV",
        total_episodes=total,
        external_links=[],
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(anime)
    db.commit()
    return anime


def test_library_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/library").status_code == 401
    assert client.post("/api/v1/library", json={"anilist_id": 21, "status": "watching"}).status_code == 401


def test_library_crud_and_progress(client: TestClient, db: Session) -> None:
    _cache(db)
    headers = _auth(client)

    created = client.post(
        "/api/v1/library",
        json={"anilist_id": 21, "status": "watching"},
        headers=headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["anilist_id"] == 21
    assert body["status"] == "watching"
    assert body["is_favorite"] is False
    assert body["watched_count"] == 0
    assert body["last_episode_watched"] == 0
    assert body["total_episodes"] == 24
    assert body["title_romaji"] == "One Piece"
    assert "id" not in body

    duplicate = client.post(
        "/api/v1/library",
        json={"anilist_id": 21, "status": "dropped"},
        headers=headers,
    )
    assert duplicate.status_code == 409

    patched = client.patch(
        "/api/v1/library/21",
        json={"score": 8, "status": "on_hold"},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["score"] == 8
    assert patched.json()["status"] == "on_hold"

    favorited = client.patch("/api/v1/library/21", json={"is_favorite": True}, headers=headers)
    assert favorited.status_code == 200
    assert favorited.json()["is_favorite"] is True
    invalid_favorite = client.patch("/api/v1/library/21", json={"is_favorite": None}, headers=headers)
    assert invalid_favorite.status_code == 422

    cleared = client.patch("/api/v1/library/21", json={"score": None}, headers=headers)
    assert cleared.status_code == 200
    assert cleared.json()["score"] is None
    assert cleared.json()["status"] == "on_hold"

    marked = client.put(
        "/api/v1/library/21/episodes/13",
        json={"watched": True, "source_site": "netflix"},
        headers=headers,
    )
    assert marked.status_code == 200
    assert marked.json()["last_episode_watched"] == 13
    assert marked.json()["watched_count"] == 1
    assert marked.json()["status"] == "on_hold"

    up_to = client.post("/api/v1/library/21/episodes/mark-up-to/10", headers=headers)
    assert up_to.status_code == 200
    assert up_to.json()["watched_count"] == 11
    assert up_to.json()["last_episode_watched"] == 13

    episodes = client.get("/api/v1/library/21/episodes", headers=headers)
    assert episodes.status_code == 200
    assert episodes.json()["episodes"] == list(range(1, 11)) + [13]

    listed = client.get("/api/v1/library", params={"status": "on_hold"}, headers=headers)
    assert listed.status_code == 200
    assert listed.json()["results"][0]["watched_count"] == 11
    assert listed.json()["summary"] == {
        "total": 1,
        "favorites": 1,
        "watching": 0,
        "completed": 0,
        "plan_to_watch": 0,
        "on_hold": 1,
        "dropped": 0,
    }
    empty = client.get("/api/v1/library", params={"status": "dropped"}, headers=headers)
    assert empty.json()["results"] == []

    removed = client.delete("/api/v1/library/21", headers=headers)
    assert removed.status_code == 204
    assert client.get("/api/v1/library/21/episodes", headers=headers).status_code == 404
    assert db.scalar(select(func.count()).select_from(EpisodeProgress)) == 0


def test_adding_as_completed_marks_all_known_episodes_watched(
    client: TestClient,
    db: Session,
) -> None:
    _cache(db, total=3)
    headers = _auth(client)

    response = client.post(
        "/api/v1/library",
        json={"anilist_id": 21, "status": "completed"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["status"] == "completed"
    assert response.json()["watched_count"] == 3
    assert response.json()["last_episode_watched"] == 3
    episodes = client.get("/api/v1/library/21/episodes", headers=headers)
    assert episodes.json()["episodes"] == [1, 2, 3]


def test_adding_unknown_episode_count_as_completed_keeps_progress_empty(
    client: TestClient,
    db: Session,
) -> None:
    _cache(db, total=None)
    headers = _auth(client)

    response = client.post(
        "/api/v1/library",
        json={"anilist_id": 21, "status": "completed"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["status"] == "completed"
    assert response.json()["watched_count"] == 0
    episodes = client.get("/api/v1/library/21/episodes", headers=headers)
    assert episodes.json()["episodes"] == []


def test_reset_episode_progress_clears_watched_episodes_and_last_episode(
    client: TestClient,
    db: Session,
) -> None:
    _cache(db, total=5)
    headers = _auth(client)
    client.post(
        "/api/v1/library",
        json={"anilist_id": 21, "status": "watching"},
        headers=headers,
    )
    client.post("/api/v1/library/21/episodes/mark-up-to/3", headers=headers)

    response = client.delete("/api/v1/library/21/episodes", headers=headers)

    assert response.status_code == 200
    assert response.json()["watched_count"] == 0
    assert response.json()["last_episode_watched"] == 0
    assert response.json()["status"] == "watching"
    assert client.get("/api/v1/library/21/episodes", headers=headers).json()["episodes"] == []
    entry = db.scalar(select(UserAnime))
    assert entry is not None
    assert entry.last_episode_watched == 0


def test_library_is_private_per_user(client: TestClient, db: Session) -> None:
    _cache(db)
    owner = _auth(client)
    client.post("/api/v1/library", json={"anilist_id": 21, "status": "watching"}, headers=owner)
    other = _auth(
        client,
        {"email": "other@example.com", "username": "other", "password": "password123"},
    )
    assert client.get("/api/v1/library", headers=other).json()["results"] == []
    assert client.patch("/api/v1/library/21", json={"score": 5}, headers=other).status_code == 404


def test_invalid_score_is_rejected(client: TestClient, db: Session) -> None:
    _cache(db)
    headers = _auth(client)
    client.post("/api/v1/library", json={"anilist_id": 21, "status": "watching"}, headers=headers)
    response = client.patch("/api/v1/library/21", json={"score": 11}, headers=headers)
    assert response.status_code == 422


def test_library_page_reports_next_page(client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.library.LIBRARY_PAGE_SIZE", 1)
    headers = _auth(client)
    _cache(db, anilist_id=1, total=12)
    _cache(db, anilist_id=2, total=12)
    client.post("/api/v1/library", json={"anilist_id": 1, "status": "watching"}, headers=headers)
    client.post("/api/v1/library", json={"anilist_id": 2, "status": "watching"}, headers=headers)

    first = client.get("/api/v1/library", params={"page": 1}, headers=headers)
    assert first.status_code == 200
    assert first.json()["has_next_page"] is True
    assert first.json()["total_count"] == 2
    assert first.json()["total_pages"] == 2
    assert len(first.json()["results"]) == 1
    second = client.get("/api/v1/library", params={"page": 2}, headers=headers)
    assert second.json()["has_next_page"] is False
    assert second.json()["total_count"] == 2
    assert second.json()["total_pages"] == 2
    assert len(second.json()["results"]) == 1


def test_favorites_are_filtered_and_sorted_before_other_entries(
    client: TestClient,
    db: Session,
) -> None:
    headers = _auth(client)
    for anilist_id in (1, 2, 3):
        _cache(db, anilist_id=anilist_id, total=12)
    client.post("/api/v1/library", json={"anilist_id": 1, "status": "watching"}, headers=headers)
    client.post("/api/v1/library", json={"anilist_id": 2, "status": "completed"}, headers=headers)
    client.post("/api/v1/library", json={"anilist_id": 3, "status": "plan_to_watch"}, headers=headers)

    assert client.patch("/api/v1/library/1", json={"is_favorite": True}, headers=headers).status_code == 200
    assert client.patch("/api/v1/library/2", json={"is_favorite": True}, headers=headers).status_code == 200

    entries = db.scalars(select(UserAnime)).all()
    entries_by_id = {db.get(Anime, entry.anime_id).anilist_id: entry for entry in entries}
    entries_by_id[1].updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    entries_by_id[2].updated_at = datetime(2026, 2, 1, tzinfo=timezone.utc)
    entries_by_id[3].updated_at = datetime(2026, 3, 1, tzinfo=timezone.utc)
    db.commit()

    all_entries = client.get("/api/v1/library", headers=headers).json()["results"]
    assert [entry["anilist_id"] for entry in all_entries] == [2, 1, 3]
    favorites = client.get(
        "/api/v1/library",
        params={"favorites": "true"},
        headers=headers,
    ).json()["results"]
    assert [entry["anilist_id"] for entry in favorites] == [2, 1]


def test_library_supports_title_and_rating_sort(client: TestClient, db: Session) -> None:
    headers = _auth(client)
    zeta = _cache(db, anilist_id=1)
    zeta.title_english = "Zeta"
    zeta.title_romaji = "Zeta"
    alpha = _cache(db, anilist_id=2)
    alpha.title_english = "Alpha"
    alpha.title_romaji = "Alpha"
    db.commit()
    for anilist_id in (1, 2):
        client.post(
            "/api/v1/library",
            json={"anilist_id": anilist_id, "status": "watching"},
            headers=headers,
        )
    client.patch("/api/v1/library/1", json={"score": 8}, headers=headers)
    client.patch("/api/v1/library/2", json={"score": 9}, headers=headers)

    title_order = client.get(
        "/api/v1/library",
        params={"sort": "title"},
        headers=headers,
    ).json()["results"]
    assert [entry["anilist_id"] for entry in title_order] == [2, 1]
    rating_order = client.get(
        "/api/v1/library",
        params={"sort": "rating"},
        headers=headers,
    ).json()["results"]
    assert [entry["anilist_id"] for entry in rating_order] == [2, 1]

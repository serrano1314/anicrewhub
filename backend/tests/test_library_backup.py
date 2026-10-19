from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.anime import Anime

REGISTER_BODY = {
    "email": "backup@example.com",
    "username": "backupuser",
    "password": "password123",
}


def _auth(client: TestClient) -> dict[str, str]:
    client.post("/api/v1/auth/register", json=REGISTER_BODY)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_BODY["email"], "password": REGISTER_BODY["password"]},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _seed_library(client: TestClient, db: Session) -> dict[str, str]:
    anime = Anime(
        anilist_id=21,
        title_romaji="One Piece",
        title_english="One Piece",
        title_synonyms=[],
        cover_url=None,
        format="TV",
        total_episodes=24,
        external_links=[],
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(anime)
    db.commit()

    headers = _auth(client)
    assert (
        client.post("/api/v1/library", json={"anilist_id": 21, "status": "watching"}, headers=headers).status_code
        == 201
    )
    assert client.patch("/api/v1/library/21", json={"is_favorite": True}, headers=headers).status_code == 200
    assert client.put("/api/v1/library/21/episodes/5", json={"watched": True}, headers=headers).status_code == 200
    site = client.post(
        "/api/v1/sites",
        json={
            "name": "Example",
            "base_url": "https://example.com",
            "episode_url_template": "https://example.com/ep/{episode}",
        },
        headers=headers,
    )
    assert site.status_code == 201
    site_id = site.json()["id"]
    link = client.post(
        "/api/v1/library/21/sites",
        json={"site_id": site_id, "anime_url": "https://example.com/one-piece"},
        headers=headers,
    )
    assert link.status_code == 201
    return headers


def test_export_import_round_trip(client: TestClient, db: Session) -> None:
    headers = _seed_library(client, db)

    export_response = client.get("/api/v1/library/export", headers=headers)
    assert export_response.status_code == 200
    payload = export_response.json()
    assert payload["version"] == 1
    assert len(payload["library"]) == 1
    assert payload["library"][0]["anilist_id"] == 21
    assert payload["library"][0]["is_favorite"] is True
    assert len(payload["sites"]) == 1
    assert len(payload["anime_sites"]) == 1

    client.delete("/api/v1/library/21", headers=headers)
    assert client.get("/api/v1/library", headers=headers).json()["results"] == []

    imported = client.post("/api/v1/library/import", json={"document": payload}, headers=headers)
    assert imported.status_code == 200
    assert imported.json()["library_entries_merged"] == 1

    list_after = client.get("/api/v1/library", headers=headers)
    assert list_after.status_code == 200
    assert len(list_after.json()["results"]) == 1
    assert list_after.json()["results"][0]["is_favorite"] is True
    episodes = client.get("/api/v1/library/21/episodes", headers=headers)
    assert 5 in episodes.json()["episodes"]


def test_import_rejects_invalid_payload(client: TestClient) -> None:
    headers = _auth(client)
    response = client.post("/api/v1/library/import", json={"document": {"version": 99}}, headers=headers)
    assert response.status_code == 422

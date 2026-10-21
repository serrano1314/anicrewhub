from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.anime import Anime

REGISTER_BODY = {
    "email": "steven@example.com",
    "username": "steven",
    "password": "password123",
    "terms_version": "2026-10-21",
}


def _auth(client: TestClient, body: dict[str, str] | None = None) -> dict[str, str]:
    response = client.post("/api/v1/auth/register", json=body or REGISTER_BODY)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _cache(db: Session) -> None:
    db.add(
        Anime(
            anilist_id=21,
            title_romaji="One Piece",
            title_english="One Piece",
            title_synonyms=[],
            external_links=[{"site": "Crunchyroll", "url": "https://www.crunchyroll.com/one-piece"}],
            format="TV",
            total_episodes=1000,
            last_synced_at=datetime.now(timezone.utc),
        )
    )
    db.commit()


def test_sites_require_auth(client: TestClient) -> None:
    assert client.get("/api/v1/sites").status_code == 401
    assert client.post("/api/v1/sites", json={"name": "Mine", "base_url": "https://watch.example"}).status_code == 401
    assert client.get("/api/v1/library/21/sites").status_code == 401
    assert client.get("/api/v1/anime/21/episodes/1/watch-links").status_code == 401


def test_site_crud_and_per_anime_links(client: TestClient, db: Session) -> None:
    _cache(db)
    headers = _auth(client)

    created = client.post(
        "/api/v1/sites",
        json={
            "name": "  My Site  ",
            "base_url": "https://watch.example",
            "episode_url_template": "https://watch.example/{slug}-episode-{episode}",
            "search_url_template": "",
        },
        headers=headers,
    )
    assert created.status_code == 201
    site = created.json()
    assert site["name"] == "My Site"
    assert site["base_url"] == "https://watch.example"
    assert site["episode_url_template"] == "https://watch.example/{slug}-episode-{episode}"
    assert site["search_url_template"] is None
    site_id = site["id"]

    listed = client.get("/api/v1/sites", headers=headers)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [site_id]

    patched = client.patch(
        f"/api/v1/sites/{site_id}",
        json={"search_url_template": "https://watch.example/search?q={title}"},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["episode_url_template"] == "https://watch.example/{slug}-episode-{episode}"
    assert patched.json()["search_url_template"] == "https://watch.example/search?q={title}"

    cleared = client.patch(
        f"/api/v1/sites/{site_id}",
        json={"search_url_template": None},
        headers=headers,
    )
    assert cleared.status_code == 200
    assert cleared.json()["search_url_template"] is None

    linked = client.post(
        "/api/v1/library/21/sites",
        json={"site_id": site_id, "anime_url": "https://watch.example/one-piece"},
        headers=headers,
    )
    assert linked.status_code == 201
    assert linked.json()["site_id"] == site_id
    assert linked.json()["anime_url"] == "https://watch.example/one-piece"
    assert linked.json()["name"] == "My Site"

    patched_link = client.patch(
        f"/api/v1/library/21/sites/{site_id}",
        json={"anime_url": "https://watch.example/one-piece-season-2"},
        headers=headers,
    )
    assert patched_link.status_code == 200
    assert patched_link.json()["anime_url"] == "https://watch.example/one-piece-season-2"

    duplicate = client.post(
        "/api/v1/library/21/sites",
        json={"site_id": site_id},
        headers=headers,
    )
    assert duplicate.status_code == 409

    anime_sites = client.get("/api/v1/library/21/sites", headers=headers)
    assert anime_sites.status_code == 200
    assert len(anime_sites.json()) == 1
    assert anime_sites.json()[0]["anime_url"] == "https://watch.example/one-piece-season-2"

    links = client.get("/api/v1/anime/21/episodes/812/watch-links", headers=headers)
    assert links.status_code == 200
    assert links.json() == [
        {
            "label": "My Site",
            "url": "https://watch.example/one-piece-season-2",
            "source": "saved",
        },
        {
            "label": "Crunchyroll",
            "url": "https://www.crunchyroll.com/one-piece",
            "source": "official",
        },
        {
            "label": "Google search",
            "url": "https://www.google.com/search?q=watch+One+Piece+episode+812",
            "source": "search",
        },
    ]

    cleared_link = client.patch(
        f"/api/v1/library/21/sites/{site_id}",
        json={"anime_url": ""},
        headers=headers,
    )
    assert cleared_link.status_code == 200
    assert cleared_link.json()["anime_url"] is None
    templated_links = client.get("/api/v1/anime/21/episodes/812/watch-links", headers=headers)
    assert templated_links.json()[0]["url"] == "https://watch.example/one-piece-episode-812"

    removed_link = client.delete(f"/api/v1/library/21/sites/{site_id}", headers=headers)
    assert removed_link.status_code == 204
    official = client.get("/api/v1/anime/21/episodes/812/watch-links", headers=headers)
    assert [item["source"] for item in official.json()] == ["official", "search"]
    assert official.json()[0]["label"] == "Crunchyroll"

    removed = client.delete(f"/api/v1/sites/{site_id}", headers=headers)
    assert removed.status_code == 204
    assert client.get("/api/v1/sites", headers=headers).json() == []


def test_sites_are_private_per_user(client: TestClient, db: Session) -> None:
    _cache(db)
    owner = _auth(client)
    created = client.post(
        "/api/v1/sites",
        json={"name": "Mine", "base_url": "https://watch.example"},
        headers=owner,
    )
    site_id = created.json()["id"]
    client.post("/api/v1/library/21/sites", json={"site_id": site_id}, headers=owner)

    other = _auth(
        client,
        {"email": "other@example.com", "username": "other", "password": "password123", "terms_version": "2026-10-21"},
    )
    assert client.get("/api/v1/sites", headers=other).json() == []
    assert client.patch(f"/api/v1/sites/{site_id}", json={"name": "Stolen"}, headers=other).status_code == 404
    assert client.delete(f"/api/v1/sites/{site_id}", headers=other).status_code == 404
    assert client.get("/api/v1/library/21/sites", headers=other).json() == []
    assert client.patch(
        f"/api/v1/library/21/sites/{site_id}",
        json={"anime_url": "https://other.example"},
        headers=other,
    ).status_code == 404
    assert client.delete(f"/api/v1/library/21/sites/{site_id}", headers=other).status_code == 404


def test_invalid_site_url_is_rejected(client: TestClient) -> None:
    headers = _auth(client)
    response = client.post(
        "/api/v1/sites",
        json={"name": "Bad", "base_url": "javascript:alert(1)"},
        headers=headers,
    )
    assert response.status_code == 422


def test_invalid_anime_site_url_is_rejected(client: TestClient, db: Session) -> None:
    _cache(db)
    headers = _auth(client)
    site = client.post(
        "/api/v1/sites",
        json={"name": "Mine", "base_url": "https://watch.example"},
        headers=headers,
    ).json()
    client.post("/api/v1/library/21/sites", json={"site_id": site["id"]}, headers=headers)
    response = client.patch(
        f"/api/v1/library/21/sites/{site['id']}",
        json={"anime_url": "javascript:alert(1)"},
        headers=headers,
    )
    assert response.status_code == 422


def test_watch_links_404_when_anime_is_not_cached(client: TestClient) -> None:
    headers = _auth(client)
    response = client.get("/api/v1/anime/999/episodes/1/watch-links", headers=headers)
    assert response.status_code == 404

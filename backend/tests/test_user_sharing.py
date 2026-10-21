from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import UserAnime
from app.models.user import User

TERMS = "2026-10-21"


def _register(client: TestClient, email: str, username: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": username,
            "password": "password123",
            "terms_version": TERMS,
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _cache(db: Session) -> None:
    db.add(
        Anime(
            anilist_id=21,
            title_romaji="One Piece",
            title_english="One Piece",
            title_synonyms=[],
            cover_url="https://example.com/one-piece.jpg",
            format="TV",
            total_episodes=24,
            external_links=[],
            last_synced_at=datetime.now(timezone.utc),
        )
    )
    db.commit()


def test_register_requires_current_terms(client: TestClient) -> None:
    refused = client.post(
        "/api/v1/auth/register",
        json={
            "email": "new@example.com",
            "username": "newuser",
            "password": "password123",
            "terms_version": "1999-01-01",
        },
    )
    assert refused.status_code == 422


def test_existing_user_is_gated_until_terms_are_accepted(client: TestClient, db: Session) -> None:
    headers = _register(client, "steven@example.com", "steven")
    account = db.scalar(select(User).where(User.username == "steven"))
    assert account is not None
    account.terms_accepted_version = None
    account.terms_accepted_at = None
    db.commit()
    assert client.get("/api/v1/library", headers=headers).status_code == 403
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["terms_accepted"] is False
    accepted = client.post("/api/v1/auth/terms/accept", json={"terms_version": TERMS}, headers=headers)
    assert accepted.status_code == 200
    assert client.get("/api/v1/library", headers=headers).status_code == 200


def test_privacy_search_follow_collection_and_site_copy(client: TestClient, db: Session) -> None:
    owner = _register(client, "owner@example.com", "owner")
    viewer = _register(client, "viewer@example.com", "viewer")
    stranger = _register(client, "stranger@example.com", "stranger")
    _cache(db)
    assert client.post("/api/v1/library", json={"anilist_id": 21, "status": "watching"}, headers=owner).status_code == 201
    entry = db.scalar(select(UserAnime))
    assert entry is not None
    entry.score = 9
    entry.is_favorite = True
    db.commit()
    site = client.post(
        "/api/v1/sites",
        json={
            "name": "Example",
            "base_url": "https://example.com/watch",
            "episode_url_template": "https://example.com/watch/{slug}/{episode}",
            "search_url_template": "https://example.com/search?q={title}",
        },
        headers=owner,
    )
    assert site.status_code == 201
    site_id = site.json()["id"]

    found = client.get("/api/v1/users", params={"q": "own"}, headers=viewer)
    assert found.status_code == 200
    assert [row["username"] for row in found.json()["results"]] == ["owner"]
    assert "email" not in found.json()["results"][0]

    profile = client.get("/api/v1/users/owner", headers=viewer)
    assert profile.status_code == 200
    assert profile.json()["can_view_collection"] is True
    assert profile.json()["follower_count"] == 0
    assert "email" not in profile.json()

    collection = client.get("/api/v1/users/owner/collection", headers=viewer)
    assert collection.status_code == 200
    item = collection.json()["results"][0]
    assert item["anilist_id"] == 21
    assert item["status"] == "watching"
    assert "score" not in item
    assert "is_favorite" not in item

    copied = client.post("/api/v1/users/owner/sites/copy", json={"site_ids": [site_id]}, headers=viewer)
    assert copied.status_code == 200
    assert copied.json()["copied"][0]["source_username"] == "owner"
    assert copied.json()["copied"][0]["base_url"] == "https://example.com/watch"
    assert copied.json()["copied"][0]["episode_url_template"] == "https://example.com/watch/{slug}/{episode}"
    assert copied.json()["copied"][0]["search_url_template"] == "https://example.com/search?q={title}"
    again = client.post("/api/v1/users/owner/sites/copy", json={"site_ids": [site_id]}, headers=viewer)
    assert again.status_code == 200
    assert again.json()["copied"] == []
    assert again.json()["already_copied"] == [site_id]
    listed = client.get("/api/v1/users/owner/sites", headers=viewer)
    assert listed.json()[0]["already_copied"] is True

    hidden = client.patch("/api/v1/me/privacy", json={"share_watch_sites": False}, headers=owner)
    assert hidden.status_code == 200
    assert client.get("/api/v1/users/owner/sites", headers=stranger).status_code == 403
    assert client.get("/api/v1/users/owner/collection", headers=stranger).status_code == 200

    private = client.patch("/api/v1/me/privacy", json={"profile_public": False}, headers=owner)
    assert private.status_code == 200
    found_private = client.get("/api/v1/users", params={"q": "owner"}, headers=stranger).json()["results"]
    assert found_private[0]["username"] == "owner"
    assert found_private[0]["profile_public"] is False
    assert found_private[0]["follower_count"] is None
    locked = client.get("/api/v1/users/owner", headers=stranger)
    assert locked.status_code == 200
    assert locked.json()["can_view_collection"] is False
    assert locked.json()["follower_count"] is None
    assert client.get("/api/v1/users/owner/collection", headers=stranger).status_code == 403

    requested = client.post("/api/v1/users/owner/follow", headers=stranger)
    assert requested.status_code == 200
    assert requested.json()["follow_state"] == "pending"
    duplicate = client.post("/api/v1/users/owner/follow", headers=stranger)
    assert duplicate.status_code == 409
    assert client.post("/api/v1/users/stranger/follow", headers=stranger).status_code == 422

    assert client.post("/api/v1/me/follow-requests/stranger/approve", headers=owner).status_code == 204
    approved = client.get("/api/v1/users/owner", headers=stranger)
    assert approved.json()["follow_state"] == "accepted"
    assert approved.json()["can_view_collection"] is True
    assert client.get("/api/v1/users/owner/sites", headers=stranger).status_code == 403

    public_follow = client.post("/api/v1/users/viewer/follow", headers=stranger)
    assert public_follow.status_code == 200
    assert public_follow.json()["follow_state"] == "accepted"
    assert client.delete("/api/v1/users/viewer/follow", headers=stranger).status_code == 200


def test_owner_lists_accepted_followers_and_following(client: TestClient) -> None:
    owner = _register(client, "list-owner@example.com", "listowner")
    follower = _register(client, "list-follower@example.com", "listfollower")
    pending = _register(client, "list-pending@example.com", "listpending")
    client.patch("/api/v1/me/privacy", json={"profile_public": False}, headers=pending)

    assert client.post("/api/v1/users/listowner/follow", headers=follower).status_code == 200
    assert client.post("/api/v1/users/listpending/follow", headers=owner).status_code == 200

    followers = client.get("/api/v1/me/followers", headers=owner)
    following = client.get("/api/v1/me/following", headers=owner)
    assert followers.status_code == 200
    assert following.status_code == 200
    assert [row["username"] for row in followers.json()] == ["listfollower"]
    assert followers.json()[0]["profile_public"] is True
    assert following.json() == []

    assert client.post("/api/v1/me/follow-requests/listowner/approve", headers=pending).status_code == 204
    approved = client.get("/api/v1/me/following", headers=owner)
    assert [row["username"] for row in approved.json()] == ["listpending"]
    assert approved.json()[0]["profile_public"] is False
    assert client.get("/api/v1/me/followers", headers=follower).json() == []
    assert [row["username"] for row in client.get("/api/v1/me/following", headers=follower).json()] == ["listowner"]

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification
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


def test_follow_notifications_and_custom_types(client: TestClient, db: Session) -> None:
    owner = _register(client, "owner@example.com", "owner")
    viewer = _register(client, "viewer@example.com", "viewer")
    stranger = _register(client, "stranger@example.com", "stranger")

    assert client.post("/api/v1/users/owner/follow", headers=viewer).status_code == 200
    public_notes = client.get("/api/v1/me/notifications", headers=owner)
    assert public_notes.status_code == 200
    body = public_notes.json()
    assert body["unread_count"] == 1
    assert body["notifications"][0]["type"] == "follow"
    assert body["notifications"][0]["actor_username"] == "viewer"
    assert body["notifications"][0]["read"] is False
    assert body["notifications"][0]["href"] == "/users/viewer"
    viewer_profile = client.get("/api/v1/users/viewer", headers=owner)
    assert viewer_profile.status_code == 200
    assert viewer_profile.json()["follows_you"] == "accepted"
    found_viewer = client.get("/api/v1/users", params={"q": "viewer"}, headers=owner).json()["results"]
    assert found_viewer[0]["follows_you"] == "accepted"
    assert found_viewer[0]["follow_state"] is None
    assert client.get("/api/v1/me/notifications", headers=viewer).json()["unread_count"] == 0

    assert client.post("/api/v1/me/notifications/read", headers=owner).status_code == 204
    assert client.get("/api/v1/me/notifications", headers=owner).json()["unread_count"] == 0

    assert client.patch("/api/v1/me/privacy", json={"profile_public": False}, headers=owner).status_code == 200
    assert client.post("/api/v1/users/owner/follow", headers=stranger).status_code == 200
    private_notes = client.get("/api/v1/me/notifications", headers=owner).json()
    assert private_notes["unread_count"] == 1
    assert private_notes["notifications"][0]["type"] == "follow_request"
    assert private_notes["notifications"][0]["title"] == "stranger requested to follow you"
    requester = client.get("/api/v1/users/stranger", headers=owner)
    assert requester.status_code == 200
    assert requester.json()["follows_you"] == "pending"

    assert client.delete("/api/v1/users/owner/follow", headers=stranger).status_code == 200
    after_cancel = client.get("/api/v1/me/notifications", headers=owner).json()
    assert after_cancel["unread_count"] == 0
    assert all(item["type"] != "follow_request" for item in after_cancel["notifications"])

    account = db.scalar(select(User).where(User.username == "owner"))
    assert account is not None
    db.add(
        Notification(
            user_id=account.id,
            type="release",
            title="A new kind of notice",
            body="Stored without a special renderer.",
        )
    )
    db.commit()
    custom = client.get("/api/v1/me/notifications", headers=owner).json()
    release = next(item for item in custom["notifications"] if item["type"] == "release")
    assert custom["unread_count"] == 1
    assert release["body"] == "Stored without a special renderer."
    assert release["href"] is None


def test_clear_one_and_all_notifications(client: TestClient) -> None:
    owner = _register(client, "clear-owner@example.com", "clearowner")
    for name in ("clearfan1", "clearfan2"):
        fan = _register(client, f"{name}@example.com", name)
        assert client.post("/api/v1/users/clearowner/follow", headers=fan).status_code == 200
    stranger = _register(client, "clear-stranger@example.com", "clearstranger")

    items = client.get("/api/v1/me/notifications", headers=owner).json()["notifications"]
    assert len(items) == 2

    assert client.delete(f"/api/v1/me/notifications/{items[0]['id']}", headers=owner).status_code == 204
    assert client.delete(f"/api/v1/me/notifications/{items[0]['id']}", headers=owner).status_code == 404
    assert client.delete(f"/api/v1/me/notifications/{items[1]['id']}", headers=stranger).status_code == 404
    assert len(client.get("/api/v1/me/notifications", headers=owner).json()["notifications"]) == 1

    assert client.delete("/api/v1/me/notifications", headers=owner).status_code == 204
    cleared = client.get("/api/v1/me/notifications", headers=owner).json()
    assert cleared["notifications"] == []
    assert cleared["unread_count"] == 0

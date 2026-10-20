from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.release_note import ReleaseNote


def _auth(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "release-notes@example.com",
            "username": "release_notes",
            "password": "password123",
        },
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_release_notes_require_auth(client: TestClient) -> None:
    assert client.get("/api/v1/release-notes/1.2.0").status_code == 401


def test_read_release_notes_for_requested_version(
    client: TestClient,
    db: Session,
) -> None:
    db.add(ReleaseNote(version="1.2.0", content_html="<ul><li>Episode links</li></ul>"))
    db.commit()

    response = client.get(
        "/api/v1/release-notes/1.2.0",
        headers=_auth(client),
    )

    assert response.status_code == 200
    assert response.json()["version"] == "1.2.0"
    assert response.json()["content_html"] == "<ul><li>Episode links</li></ul>"
    assert response.json()["created_at"]


def test_missing_release_notes_return_not_found(client: TestClient) -> None:
    response = client.get(
        "/api/v1/release-notes/9.9.9",
        headers=_auth(client),
    )
    assert response.status_code == 404

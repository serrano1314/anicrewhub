from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services.auth import get_user_by_email
from app.services.password_reset import create_password_reset_token_for_tests

REGISTER_BODY = {
    "email": "steven@example.com",
    "username": "steven",
    "password": "password123",
    "terms_version": "2026-10-21",
}


def test_change_password_success(client: TestClient) -> None:
    client.post("/api/v1/auth/register", json=REGISTER_BODY)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_BODY["email"], "password": REGISTER_BODY["password"]},
    )
    token = login.json()["access_token"]
    response = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "password123", "new_password": "newpassword99"},
    )
    assert response.status_code == 204
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_BODY["email"], "password": "password123"},
    )
    assert bad_login.status_code == 401
    good_login = client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_BODY["email"], "password": "newpassword99"},
    )
    assert good_login.status_code == 200


def test_change_password_wrong_current_returns_400(client: TestClient) -> None:
    register = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    token = register.json()["access_token"]
    response = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "wrong", "new_password": "newpassword99"},
    )
    assert response.status_code == 400


def test_forgot_password_always_204(client: TestClient) -> None:
    client.post("/api/v1/auth/register", json=REGISTER_BODY)
    known = client.post("/api/v1/auth/forgot-password", json={"email": REGISTER_BODY["email"]})
    unknown = client.post("/api/v1/auth/forgot-password", json={"email": "missing@example.com"})
    assert known.status_code == 204
    assert unknown.status_code == 204


def test_reset_password_with_token(client: TestClient, db: Session) -> None:
    client.post("/api/v1/auth/register", json=REGISTER_BODY)
    user = get_user_by_email(db, REGISTER_BODY["email"])
    assert user is not None
    raw = create_password_reset_token_for_tests(db, user.id)
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw, "new_password": "resetpass99"},
    )
    assert response.status_code == 204
    login = client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_BODY["email"], "password": "resetpass99"},
    )
    assert login.status_code == 200


def test_reset_password_invalid_token_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "not-a-valid-token", "new_password": "resetpass99"},
    )
    assert response.status_code == 400

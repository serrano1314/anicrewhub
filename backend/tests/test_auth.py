from fastapi.testclient import TestClient

REGISTER_BODY = {
    "email": "steven@example.com",
    "username": "steven",
    "password": "password123",
}


def test_register_returns_access_token_and_sets_refresh_cookie(client: TestClient) -> None:
    response = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str)
    assert body["access_token"]
    assert "refresh_token" in response.cookies


def test_register_duplicate_email_returns_409(client: TestClient) -> None:
    assert client.post("/api/v1/auth/register", json=REGISTER_BODY).status_code == 201
    response = client.post(
        "/api/v1/auth/register",
        json={**REGISTER_BODY, "username": "other"},
    )
    assert response.status_code == 409


def test_login_and_me(client: TestClient) -> None:
    client.post("/api/v1/auth/register", json=REGISTER_BODY)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_BODY["email"], "password": REGISTER_BODY["password"]},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    data = me.json()
    assert data["email"] == "steven@example.com"
    assert data["username"] == "steven"
    assert "password_hash" not in data


def test_login_wrong_password_returns_401(client: TestClient) -> None:
    client.post("/api/v1/auth/register", json=REGISTER_BODY)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_BODY["email"], "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_me_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_user_can_select_and_clear_preset_avatar(client: TestClient) -> None:
    register = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    token = register.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    selected = client.patch("/api/v1/auth/me/avatar", json={"avatar_id": "1"}, headers=headers)
    assert selected.status_code == 200
    assert selected.json()["avatar_id"] == "1"

    current = client.get("/api/v1/auth/me", headers=headers)
    assert current.json()["avatar_id"] == "1"

    cleared = client.patch("/api/v1/auth/me/avatar", json={"avatar_id": None}, headers=headers)
    assert cleared.status_code == 200
    assert cleared.json()["avatar_id"] is None


def test_user_cannot_select_unknown_avatar(client: TestClient) -> None:
    register = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    token = register.json()["access_token"]
    response = client.patch(
        "/api/v1/auth/me/avatar",
        json={"avatar_id": "0"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_user_can_update_email_and_username(client: TestClient) -> None:
    register = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

    response = client.patch(
        "/api/v1/auth/me/profile",
        json={"email": "new@example.com", "username": "new_name"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["email"] == "new@example.com"
    assert response.json()["username"] == "new_name"
    assert client.get("/api/v1/auth/me", headers=headers).json()["email"] == "new@example.com"


def test_profile_update_rejects_taken_email_or_username(client: TestClient) -> None:
    first = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    client.post(
        "/api/v1/auth/register",
        json={"email": "other@example.com", "username": "other", "password": "password123"},
    )
    headers = {"Authorization": f"Bearer {first.json()['access_token']}"}

    response = client.patch(
        "/api/v1/auth/me/profile",
        json={"email": "other@example.com", "username": "updated"},
        headers=headers,
    )

    assert response.status_code == 409
    current = client.get("/api/v1/auth/me", headers=headers).json()
    assert current["email"] == REGISTER_BODY["email"]
    assert current["username"] == REGISTER_BODY["username"]


def test_profile_update_validates_username_and_email(client: TestClient) -> None:
    register = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    headers = {"Authorization": f"Bearer {register.json()['access_token']}"}
    response = client.patch(
        "/api/v1/auth/me/profile",
        json={"email": "not-an-email", "username": "bad name"},
        headers=headers,
    )
    assert response.status_code == 422


def test_refresh_issues_new_access_token(client: TestClient) -> None:
    client.post("/api/v1/auth/register", json=REGISTER_BODY)
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_refresh_without_cookie_returns_401(client: TestClient) -> None:
    client.cookies.clear()
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 401


def test_logout_clears_refresh_cookie(client: TestClient) -> None:
    register = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    token = register.json()["access_token"]
    logout = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout.status_code == 204
    refresh = client.post("/api/v1/auth/refresh")
    assert refresh.status_code == 401


def test_access_token_cannot_be_used_as_refresh(client: TestClient) -> None:
    register = client.post("/api/v1/auth/register", json=REGISTER_BODY)
    access = register.json()["access_token"]
    client.cookies.clear()
    client.cookies.set("refresh_token", access)
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 401

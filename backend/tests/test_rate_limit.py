import os

import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import reset_rate_limits_for_tests

REGISTER_BODY = {
    "email": "limit@example.com",
    "username": "limituser",
    "password": "password123",
    "terms_version": "2026-10-21",
}


@pytest.fixture(autouse=True)
def _clear_limits() -> None:
    reset_rate_limits_for_tests()
    yield
    reset_rate_limits_for_tests()


@pytest.fixture
def tight_auth_limits(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RATE_LIMIT_AUTH_MAX", "2")
    monkeypatch.setenv("RATE_LIMIT_AUTH_WINDOW_SECONDS", "60")
    from app.core.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_auth_rate_limit_returns_429(tight_auth_limits: None, client: TestClient) -> None:
    for _ in range(2):
        response = client.post("/api/v1/auth/register", json=REGISTER_BODY)
        assert response.status_code in {201, 409}

    blocked = client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_BODY["email"], "password": REGISTER_BODY["password"]},
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "Too many requests. Try again in a minute."


def test_rate_limit_unit(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi import HTTPException, Request

    from app.core import rate_limit as rate_limit_module
    from app.core.config import get_settings

    reset_rate_limits_for_tests()
    monkeypatch.setenv("RATE_LIMIT_AUTH_MAX", "1")
    monkeypatch.setenv("RATE_LIMIT_AUTH_WINDOW_SECONDS", "60")
    get_settings.cache_clear()

    scope = {"type": "http", "method": "POST", "path": "/", "headers": []}
    request = Request(scope)

    rate_limit_module.enforce_rate_limit(request, "auth")
    with pytest.raises(HTTPException) as exc_info:
        rate_limit_module.enforce_rate_limit(request, "auth")
    assert exc_info.value.status_code == 429

    get_settings.cache_clear()
    if "RATE_LIMIT_AUTH_MAX" in os.environ:
        del os.environ["RATE_LIMIT_AUTH_MAX"]

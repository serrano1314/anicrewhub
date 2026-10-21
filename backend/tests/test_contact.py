import time
from unittest.mock import patch

from fastapi.testclient import TestClient

REGISTER_BODY = {
    "email": "steven@example.com",
    "username": "steven",
    "password": "password123",
    "terms_version": "2026-10-21",
}


def _auth_headers(client: TestClient) -> dict[str, str]:
    client.post("/api/v1/auth/register", json=REGISTER_BODY)
    token = client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_BODY["email"], "password": REGISTER_BODY["password"]},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _ticket_body(**overrides: object) -> dict[str, object]:
    body = {
        "subject": "Bug report",
        "message": "The episode grid scrolls oddly when I jump to episode 811.",
        "website": "",
        "started_at_ms": int(time.time() * 1000) - 5000,
    }
    body.update(overrides)
    return body


@patch("app.services.contact.smtp_configured", return_value=True)
@patch("app.services.contact.send_admin_email")
def test_submit_support_ticket(
    send_mock,
    _smtp_mock,
    client: TestClient,
) -> None:
    headers = _auth_headers(client)
    response = client.post("/api/v1/support/tickets", headers=headers, json=_ticket_body())
    assert response.status_code == 204
    send_mock.assert_called_once()
    assert send_mock.call_args.kwargs["reply_to"] == REGISTER_BODY["email"]


@patch("app.services.contact.smtp_configured", return_value=True)
@patch("app.services.contact.send_admin_email")
def test_honeypot_is_silent(send_mock, _smtp_mock, client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/support/tickets",
        headers=headers,
        json=_ticket_body(website="https://spam.example"),
    )
    assert response.status_code == 204
    send_mock.assert_not_called()


def test_support_ticket_requires_auth(client: TestClient) -> None:
    response = client.post("/api/v1/support/tickets", json=_ticket_body())
    assert response.status_code == 401


@patch("app.services.contact.smtp_configured", return_value=True)
@patch("app.services.contact.send_admin_email")
def test_support_ticket_too_fast_rejected(send_mock, _smtp_mock, client: TestClient) -> None:
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/support/tickets",
        headers=headers,
        json=_ticket_body(started_at_ms=int(time.time() * 1000)),
    )
    assert response.status_code == 400
    send_mock.assert_not_called()

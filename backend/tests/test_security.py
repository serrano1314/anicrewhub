from datetime import timedelta
from uuid import uuid4

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_token,
    decode_access_token_identity,
    decode_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password() -> None:
    hashed = hash_password("correct-horse-battery")
    assert hashed != "correct-horse-battery"
    assert verify_password("correct-horse-battery", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_access_token_roundtrip() -> None:
    user_id = uuid4()
    token = create_token(user_id, "access", timedelta(minutes=15))
    assert decode_token(token, "access") == user_id


def test_access_token_identity_includes_username() -> None:
    user_id = uuid4()
    token = create_access_token(user_id, username="steven")
    assert decode_access_token_identity(token) == (user_id, "steven")


def test_refresh_token_rejected_as_access() -> None:
    token = create_token(uuid4(), "refresh", timedelta(days=7))
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(token, "access")


def test_tampered_token_is_rejected() -> None:
    token = create_token(uuid4(), "access", timedelta(minutes=15))
    with pytest.raises(jwt.PyJWTError):
        decode_token(token + "x", "access")


def test_token_signed_with_wrong_secret_is_rejected() -> None:
    user_id = uuid4()
    token = jwt.encode(
        {"sub": str(user_id), "type": "access"},
        "not-the-configured-secret-value!!",
        algorithm="HS256",
    )
    with pytest.raises(jwt.PyJWTError):
        decode_token(token, "access")
    assert get_settings().JWT_SECRET != "not-the-configured-secret-value"

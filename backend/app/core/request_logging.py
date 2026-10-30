"""Bounded, redacted HTTP request and response logging."""

import json
import logging
import threading
from uuid import uuid4
from time import perf_counter

from starlette.datastructures import Headers
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.request_context import request_id_context
from app.core.security import decode_access_token_identity

logger = logging.getLogger(__name__)

LOG_BODY_LIMIT = 2_000
SENSITIVE_FIELDS = {
    "access_token",
    "jwt",
    "password",
    "refresh_token",
    "secret",
    "token",
}


def _user_identity(headers: Headers) -> tuple[str | None, str | None]:
    authorization = headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return None, None
    try:
        user_id, username = decode_access_token_identity(
            authorization.removeprefix("Bearer ")
        )
        return str(user_id), username
    except Exception:  # Logging must never interfere with request handling.
        return None, None


def _redact(value: object) -> object:
    if isinstance(value, dict):
        return {
            key: "***REDACTED***" if key.lower() in SENSITIVE_FIELDS else _redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


def _body_preview(body: bytes, truncated: bool) -> str | None:
    if truncated:
        return f"<body exceeds {LOG_BODY_LIMIT} bytes; omitted>"
    if not body:
        return None
    try:
        preview = json.dumps(_redact(json.loads(body)), ensure_ascii=False, default=str)
    except (json.JSONDecodeError, UnicodeDecodeError):
        preview = body.decode("utf-8", errors="replace")

    if len(preview) > LOG_BODY_LIMIT:
        return f"{preview[:LOG_BODY_LIMIT]}... <truncated>"
    return preview


def _append_limited(buffer: bytearray, chunk: bytes) -> bool:
    """Append a chunk and return whether the complete body exceeds the limit."""
    remaining = LOG_BODY_LIMIT + 1 - len(buffer)
    buffer.extend(chunk[:remaining])
    return len(chunk) > remaining


class RequestResponseLoggingMiddleware:
    """Observe ASGI messages without consuming or modifying application bodies."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started_at = perf_counter()
        request_id = uuid4().hex[:12]
        thread_id = threading.get_ident()
        request_id_token = request_id_context.set(request_id)
        request_body = bytearray()
        response_body = bytearray()
        request_truncated = False
        response_truncated = False
        status_code = 500
        request_logged = False
        user_id, username = _user_identity(Headers(scope=scope))

        def log_request_received() -> None:
            nonlocal request_logged
            if request_logged:
                return
            request_logged = True
            logger.info(
                "request_received request_id=%s thread_id=%s method=%s path=%s query=%s user_id=%s username=%s request=%s",
                request_id,
                thread_id,
                scope["method"],
                scope["path"],
                scope.get("query_string", b"").decode("latin-1"),
                user_id,
                username,
                _body_preview(bytes(request_body), request_truncated),
            )

        async def receive_with_logging() -> Message:
            nonlocal request_truncated
            message = await receive()
            if message["type"] == "http.request":
                request_truncated = _append_limited(
                    request_body, message.get("body", b"")
                ) or request_truncated
                if not message.get("more_body", False):
                    log_request_received()
            return message

        async def send_with_logging(message: Message) -> None:
            nonlocal response_truncated, status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers = list(message.get("headers", []))
                if not any(name.lower() == b"x-request-id" for name, _ in headers):
                    headers.append((b"x-request-id", request_id.encode("ascii")))
                message = {**message, "headers": headers}
            elif message["type"] == "http.response.body":
                response_truncated = _append_limited(
                    response_body, message.get("body", b"")
                ) or response_truncated
            await send(message)

        try:
            await self.app(scope, receive_with_logging, send_with_logging)
        finally:
            log_request_received()
            logger.info(
                "request_completed request_id=%s thread_id=%s method=%s path=%s status=%s duration_seconds=%.3f user_id=%s username=%s request=%s response=%s",
                request_id,
                thread_id,
                scope["method"],
                scope["path"],
                status_code,
                perf_counter() - started_at,
                user_id,
                username,
                _body_preview(bytes(request_body), request_truncated),
                _body_preview(bytes(response_body), response_truncated),
            )
            request_id_context.reset(request_id_token)

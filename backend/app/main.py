import json
import logging
from time import perf_counter

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import Headers
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.anime import router as anime_router
from app.api.auth import router as auth_router
from app.api.contact import router as contact_router
from app.api.extension import router as extension_router
from app.api.library import router as library_router
from app.api.sites import router as sites_router
from app.core.config import get_settings
from app.core.security import decode_token
from app.db.session import engine
from app.schemas.health import HealthResponse

_ = engine

settings = get_settings()
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


def _redact(value: object) -> object:
    if isinstance(value, dict):
        return {
            key: "***REDACTED***" if key.lower() in SENSITIVE_FIELDS else _redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


def _body_preview(body: bytes) -> str | None:
    if not body:
        return None

    try:
        preview = json.dumps(_redact(json.loads(body)), ensure_ascii=False, default=str)
    except (json.JSONDecodeError, UnicodeDecodeError):
        preview = f"<non-JSON body; {len(body)} bytes>"

    if len(preview) > LOG_BODY_LIMIT:
        return f"{preview[:LOG_BODY_LIMIT]}... <truncated; {len(preview)} characters>"
    return preview


def _user_id(headers: Headers) -> str | None:
    authorization = headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return None

    try:
        return str(decode_token(authorization.removeprefix("Bearer "), "access"))
    except Exception:  # Logging must never interfere with request handling.
        return None


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started_at = perf_counter()
        status_code = 500
        response_body = bytearray()
        response_truncated = False

        async def send_with_logging(message: Message) -> None:
            nonlocal status_code, response_truncated
            if message["type"] == "http.response.start":
                status_code = message["status"]
            elif message["type"] == "http.response.body":
                body = message.get("body", b"")
                remaining = LOG_BODY_LIMIT + 1 - len(response_body)
                response_body.extend(body[:remaining])
                response_truncated = response_truncated or len(body) > remaining
            await send(message)

        await self.app(scope, receive, send_with_logging)

        response_preview = (
            f"<response body exceeds {LOG_BODY_LIMIT} bytes>"
            if response_truncated
            else _body_preview(bytes(response_body))
        )
        logger.info(
            "%s %s status=%s duration_ms=%.2f user_id=%s query=%s response=%s",
            scope["method"],
            scope["path"],
            status_code,
            (perf_counter() - started_at) * 1_000,
            _user_id(Headers(scope=scope)),
            scope["query_string"].decode("utf-8", errors="replace"),
            response_preview,
        )


app = FastAPI(title="Anime Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)


app.include_router(auth_router, prefix="/api/v1")
app.include_router(anime_router, prefix="/api/v1")
app.include_router(library_router, prefix="/api/v1")
app.include_router(sites_router, prefix="/api/v1")
app.include_router(extension_router, prefix="/api/v1")
app.include_router(contact_router, prefix="/api/v1")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")

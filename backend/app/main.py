import logging
import time
import json
import jwt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(title="Anime Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    # Get user ID and username from token if available
    user_id = None
    user_username = None
    authorization: str = request.headers.get("Authorization")
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            # Decode payload directly (decode_token only returns UUID sub)
            payload_dict = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
            user_id = payload_dict.get("sub")
            user_username = payload_dict.get("username")
        except Exception:
            pass  # Invalid token, user_id/user_username remain None

    # Log request
    query_params = str(request.query_params)
    # Try to get body
    body = None
    if request.method in ("POST", "PUT", "PATCH"):
        try:
            body = await request.body()
            # Reset body for downstream handlers
            async def receive():
                return {"type": "http.request", "body": body}
            request._receive = receive
        except Exception:
            body = None

    # Sanitize body for logging (redact sensitive fields)
    sanitized_body = None
    if body:
        try:
            data = json.loads(body)
            # Redact sensitive fields
            sensitive_fields = {"password", "token", "refresh_token", "secret", "jwt", "access_token"}
            if isinstance(data, dict):
                sanitized = {k: "***REDACTED***" if k.lower() in sensitive_fields else v for k, v in data.items()}
                sanitized_body = json.dumps(sanitized)
            else:
                sanitized_body = json.dumps(data)  # Not a dict, log as is but could be large
        except Exception:
            # Not JSON, log length or preview
            sanitized_body = f"<non-JSON body, length: {len(body)}>"

    # Prepare request log
    request_log = {
        "username": user_username,
        "user_id": str(user_id) if user_id else None,
        "method": request.method,
        "path": request.url.path,
        "query_params": query_params,
        "body": sanitized_body,
    }

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Get response body (need to collect it)
    response_body = b""
    async for chunk in response.body_iterator:
        response_body += chunk
    # Re-create response with same body
    response = Response(
        content=response_body,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type,
    )

    # Sanitize response body
    sanitized_response_body = None
    if response_body:
        try:
            data = json.loads(response_body)
            # Redact sensitive fields in response too
            sensitive_fields = {"password", "token", "refresh_token", "secret", "jwt", "access_token"}
            if isinstance(data, dict):
                sanitized = {k: "***REDACTED***" if k.lower() in sensitive_fields else v for k, v in data.items()}
                sanitized_response_body = json.dumps(sanitized)
            else:
                sanitized_response_body = json.dumps(data)
        except Exception:
            sanitized_response_body = f"<non-JSON body, length: {len(response_body)}>"

    # Prepare response log
    response_log = {
        "username": user_username,
        "user_id": str(user_id) if user_id else None,
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "duration_ms": round(duration * 1000, 2),
        "response_body": sanitized_response_body,
    }

    # Log both request and response
    logging.info(f"REQUEST: {json.dumps(request_log)}")
    logging.info(f"RESPONSE: {json.dumps(response_log)}")

    return response


app.include_router(auth_router, prefix="/api/v1")
app.include_router(anime_router, prefix="/api/v1")
app.include_router(library_router, prefix="/api/v1")
app.include_router(sites_router, prefix="/api/v1")
app.include_router(extension_router, prefix="/api/v1")
app.include_router(contact_router, prefix="/api/v1")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")

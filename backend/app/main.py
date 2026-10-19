import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.anime import router as anime_router
from app.api.auth import router as auth_router
from app.api.contact import router as contact_router
from app.api.extension import router as extension_router
from app.api.library import router as library_router
from app.api.sites import router as sites_router
from app.core.config import get_settings
from app.core.keep_alive import keep_alive_lifespan
from app.core.request_logging import RequestResponseLoggingMiddleware
from app.db.session import engine
from app.schemas.health import HealthResponse

_ = engine

settings = get_settings()
logger = logging.getLogger(__name__)

# Temporary development aid. Set this to False to remove the background heartbeat.
KEEP_ALIVE_ENABLED = True
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# 1. Define a clean FastAPI-compatible lifespan wrapper
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Delegate implementation cleanly to your original parameterized context manager
    async with keep_alive_lifespan(enabled=KEEP_ALIVE_ENABLED):
        yield


# 2. Pass the signature of the wrapper function directly to FastAPI
app = FastAPI(
    title="Anime Tracker",
    lifespan=lifespan, 
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestResponseLoggingMiddleware)


app.include_router(auth_router, prefix="/api/v1")
app.include_router(anime_router, prefix="/api/v1")
app.include_router(library_router, prefix="/api/v1")
app.include_router(sites_router, prefix="/api/v1")
app.include_router(extension_router, prefix="/api/v1")
app.include_router(contact_router, prefix="/api/v1")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")

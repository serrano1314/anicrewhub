"""Temporary background heartbeat for free-tier hosting during development."""

import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from sqlalchemy import text

from app.db.session import engine

logger = logging.getLogger(__name__)

# Keep this below Render's 15-minute idle limit and Neon's 5-minute autosuspend
# limit. Change these values here if the deployment provider settings change.
KEEP_ALIVE_INTERVAL_SECONDS = 4 * 60
KEEP_ALIVE_URL = "https://anitracker-zvt8.onrender.com/health"


def _check_database() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


async def _run_keep_alive() -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        while True:
            await asyncio.sleep(KEEP_ALIVE_INTERVAL_SECONDS)
            try:
                await asyncio.to_thread(_check_database)
                response = await client.get(KEEP_ALIVE_URL)
                response.raise_for_status()
                logger.info("Keep-alive check completed")
            except (httpx.HTTPError, OSError) as error:
                logger.warning("Keep-alive check failed: %s", error)


@asynccontextmanager
async def keep_alive_lifespan(enabled: bool):
    """Run the temporary keep-alive task only when explicitly enabled."""
    if not enabled:
        yield
        return

    task = asyncio.create_task(_run_keep_alive())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

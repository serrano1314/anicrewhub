"""Hourly background refresh for database-backed discovery snapshots."""

import asyncio
import logging
from contextlib import asynccontextmanager

from app.services.discovery_cache import refresh_discovery_snapshots

logger = logging.getLogger(__name__)

DISCOVERY_REFRESH_INTERVAL_SECONDS = 60 * 60


async def _run_discovery_refresh() -> None:
    while True:
        await asyncio.sleep(DISCOVERY_REFRESH_INTERVAL_SECONDS)
        try:
            await asyncio.to_thread(refresh_discovery_snapshots)
        except Exception:
            logger.exception("Discovery snapshot background refresh failed")


@asynccontextmanager
async def discovery_refresh_lifespan():
    task = asyncio.create_task(_run_discovery_refresh())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

"""
Facade for `backend.routers.slice_d_integrations_and_trends`.
Mounts startup health checks, URL resolvers, YouTube Data API v3, Steam, Trustpilot, and Metacritic routes.
"""

from fastapi import APIRouter

from backend.routers.integrations_and_trends.startup_and_youtube_routes import *  # noqa: F401,F403
from backend.routers.integrations_and_trends.startup_and_youtube_routes import (  # noqa: F401
    _parse_iso_datetime,
    _run_startup_checks_sync,
    router as _startup_and_youtube_router,
)
from backend.routers.integrations_and_trends.social_and_metacritic_routes import *  # noqa: F401,F403
from backend.routers.integrations_and_trends.social_and_metacritic_routes import (  # noqa: F401
    _LAST_METACRITIC_SLUG,
    _METACRITIC_MEMORY_CACHE,
    _build_deep_metacritic_analysis,
    _fetch_metacritic_slug_data,
    _generate_and_persist_metacritic_analysis,
    _parse_metacritic_json_ld,
    _persist_metacritic_analysis,
    _sanitize_mc_id,
    router as _social_and_metacritic_router,
)

router = APIRouter()
router.include_router(_startup_and_youtube_router)
router.include_router(_social_and_metacritic_router)

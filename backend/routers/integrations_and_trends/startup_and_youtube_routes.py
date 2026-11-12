"""
Unified facade for `backend.routers.integrations_and_trends.startup_and_youtube_routes`.
Combines `startup_and_url_resolver_routes` and `youtube_data_api_routes`.
"""

from fastapi import APIRouter

from backend.routers.integrations_and_trends.startup_and_url_resolver_routes import *  # noqa: F401,F403
from backend.routers.integrations_and_trends.startup_and_url_resolver_routes import (  # noqa: F401
    _run_startup_checks_sync,
    resolve_grounding_url,
    resolve_urls_endpoint,
    router as _startup_and_url_resolver_router,
    startup_checks,
)
from backend.routers.integrations_and_trends.youtube_data_api_routes import *  # noqa: F401,F403
from backend.routers.integrations_and_trends.youtube_data_api_routes import (  # noqa: F401
    YOUTUBE_API_BASE,
    YOUTUBE_COMMENT_MAX_PAGES,
    YOUTUBE_COMMENT_PAGE_SIZE,
    YOUTUBE_SHORT_MAX_SECONDS,
    YOUTUBE_UNIT_COST,
    _parse_iso_datetime,
    format_view_count,
    is_valid_youtube_video,
    normalize_youtube_video,
    parse_iso_duration_seconds,
    resolve_youtube_api_key,
    router as _youtube_data_api_router,
    run_youtube_search,
    youtube_api_get,
    youtube_comments,
    youtube_search,
    youtube_video_details,
)

router = APIRouter()
router.include_router(_startup_and_url_resolver_router)
router.include_router(_youtube_data_api_router)

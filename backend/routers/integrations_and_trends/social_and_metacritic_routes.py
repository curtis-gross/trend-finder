"""
Unified facade for `backend.routers.integrations_and_trends.social_and_metacritic_routes`.
Combines Trustpilot, Steam Store API, and Metacritic scraper/analysis/scan modules.
"""

from fastapi import APIRouter

from backend.routers.integrations_and_trends.reddit_and_trustpilot_routes import *  # noqa: F401,F403
from backend.routers.integrations_and_trends.reddit_and_trustpilot_routes import (  # noqa: F401
    get_trustpilot,
    router as _reddit_and_trustpilot_router,
)
from backend.routers.integrations_and_trends.steam_store_api_routes import *  # noqa: F401,F403
from backend.routers.integrations_and_trends.steam_store_api_routes import (  # noqa: F401
    router as _steam_store_router,
    steam_reviews,
    steam_search,
)
from backend.routers.integrations_and_trends.metacritic_scraper_and_jsonld import *  # noqa: F401,F403
from backend.routers.integrations_and_trends.metacritic_scraper_and_jsonld import (  # noqa: F401
    _LAST_METACRITIC_SLUG,
    _METACRITIC_MEMORY_CACHE,
    _fetch_metacritic_slug_data,
    _parse_metacritic_json_ld,
    _sanitize_mc_id,
)
from backend.routers.integrations_and_trends.metacritic_analysis_builder import *  # noqa: F401,F403
from backend.routers.integrations_and_trends.metacritic_analysis_builder import (  # noqa: F401
    _build_deep_metacritic_analysis,
)
from backend.routers.integrations_and_trends.metacritic_scan_routes import *  # noqa: F401,F403
from backend.routers.integrations_and_trends.metacritic_scan_routes import (  # noqa: F401
    _generate_and_persist_metacritic_analysis,
    _persist_metacritic_analysis,
    handle_metacritic_scan,
    router as _metacritic_scan_router,
)

router = APIRouter()
router.include_router(_reddit_and_trustpilot_router)
router.include_router(_steam_store_router)
router.include_router(_metacritic_scan_router)

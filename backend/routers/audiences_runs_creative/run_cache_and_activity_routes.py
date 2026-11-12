"""
Unified facade for `backend.routers.audiences_runs_creative.run_cache_and_activity_routes`.
Combines `run_load_save_routes` and `activity_and_history_routes`.
"""

from fastapi import APIRouter

from backend.routers.audiences_runs_creative.run_load_save_routes import *  # noqa: F401,F403
from backend.routers.audiences_runs_creative.run_load_save_routes import (  # noqa: F401
    _is_meaningful_run_payload,
    get_run_file,
    load_run,
    router as _run_load_save_router,
    save_run,
    save_run_to_gcs,
)
from backend.routers.audiences_runs_creative.activity_and_history_routes import *  # noqa: F401,F403
from backend.routers.audiences_runs_creative.activity_and_history_routes import (  # noqa: F401
    ACTIVITY_FILE,
    _extract_history_list,
    _resolve_feature_run_history,
    get_runs_history,
    post_activity,
    router as _activity_and_history_router,
    save_run_history,
)

router = APIRouter()
router.include_router(_run_load_save_router)
router.include_router(_activity_and_history_router)

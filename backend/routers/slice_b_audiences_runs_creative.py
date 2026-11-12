"""
Facade for `backend.routers.slice_b_audiences_runs_creative`.
Mounts 3-tier run cache load/save, activity ledger, and run history endpoints.
"""

from fastapi import APIRouter

from backend.routers.audiences_runs_creative.run_cache_and_activity_routes import *  # noqa: F401,F403
from backend.routers.audiences_runs_creative.run_cache_and_activity_routes import (  # noqa: F401
    ACTIVITY_FILE,
    _extract_history_list,
    _is_meaningful_run_payload,
    _resolve_feature_run_history,
    get_run_file,
    get_runs_history,
    router as _run_cache_and_activity_router,
    save_run_to_gcs,
)

router = APIRouter()
router.include_router(_run_cache_and_activity_router)

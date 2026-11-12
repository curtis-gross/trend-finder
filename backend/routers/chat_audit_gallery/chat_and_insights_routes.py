"""
Unified facade for `backend.routers.chat_audit_gallery.chat_and_insights_routes`.
Combines `pipeline_wipe_routes` and `insights_table_and_analysis_routes`.
"""

from fastapi import APIRouter

from backend.routers.chat_audit_gallery.pipeline_wipe_routes import *  # noqa: F401,F403
from backend.routers.chat_audit_gallery.pipeline_wipe_routes import (  # noqa: F401
    _parse_json_body,
    api_pipeline_wipe,
    router as _pipeline_wipe_router,
    sanitize_id,
)
from backend.routers.chat_audit_gallery.insights_table_and_analysis_routes import *  # noqa: F401,F403
from backend.routers.chat_audit_gallery.insights_table_and_analysis_routes import (  # noqa: F401
    _unwrap_insights_table_rows,
    api_get_insights_analyses_all,
    api_get_insights_analysis,
    api_get_insights_table,
    api_post_insights_analysis,
    api_post_insights_table,
    router as _insights_table_and_analysis_router,
)

router = APIRouter()
router.include_router(_pipeline_wipe_router)
router.include_router(_insights_table_and_analysis_router)

"""
Facade for `backend.routers.slice_c_chat_audit_gallery`.
Mounts pipeline wipe and deep media insights table/analysis routes.
"""

from fastapi import APIRouter

from backend.routers.chat_audit_gallery.chat_and_insights_routes import *  # noqa: F401,F403
from backend.routers.chat_audit_gallery.chat_and_insights_routes import (  # noqa: F401
    _parse_json_body,
    _unwrap_insights_table_rows,
    api_get_insights_analyses_all,
    api_get_insights_analysis,
    api_get_insights_table,
    api_pipeline_wipe,
    api_post_insights_analysis,
    api_post_insights_table,
    router as _chat_and_insights_router,
    sanitize_id,
)

router = APIRouter()
router.include_router(_chat_and_insights_router)

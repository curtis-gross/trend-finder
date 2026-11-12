"""
Facade for `backend.routers.slice_e_admin_tts_campaign`.
Mounts Admin Configuration, Terminal Log, and Gemini TTS Audio sub-routers.
"""

from fastapi import APIRouter

from backend.routers.admin_tts_agents_mcp.admin_and_media_proxy_routes import *  # noqa: F401,F403
from backend.routers.admin_tts_agents_mcp.admin_and_media_proxy_routes import (
    router as _admin_and_media_proxy_router,
)
from backend.routers.admin_tts_agents_mcp.gemini_tts_audio_routes import *  # noqa: F401,F403
from backend.routers.admin_tts_agents_mcp.gemini_tts_audio_routes import (
    router as _gemini_tts_audio_router,
)

router = APIRouter()
router.include_router(_admin_and_media_proxy_router)
router.include_router(_gemini_tts_audio_router)

import json
from datetime import datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.core import APP_CONFIG_FILE

router = APIRouter()


@router.get("/api/admin/config")
async def get_admin_config():
    if APP_CONFIG_FILE.exists():
        try:
            data = APP_CONFIG_FILE.read_text(encoding="utf-8")
            return JSONResponse(content=json.loads(data))
        except Exception as e:
            print(f"Error reading app config: {e}")
            return JSONResponse(status_code=500, content={"error": "Failed to read app config"})
    else:
        return JSONResponse(status_code=404, content={"error": "App config not found"})


@router.post("/api/terminal-log")
async def terminal_log(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    message = body.get("message", "")
    level = body.get("level", "info")
    timestamp = datetime.now().strftime("%I:%M:%S %p")

    if level == "header":
        print("\n======================================================")
        print(f"🚀 [{timestamp}] {message}")
        print("======================================================")
    elif level == "phase":
        print(f"\n⚡ [{timestamp}] >>> {message}")
    elif level == "worker":
        print(f"  ⚙️ [{timestamp}] {message}")
    elif level == "success":
        print(f"\n✅ [{timestamp}] {message}\n")
    else:
        print(f"[{timestamp}] [Noise Filter] {message}")

    return JSONResponse(content={"success": True})

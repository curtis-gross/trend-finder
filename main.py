import mimetypes
import os
import warnings
from contextlib import asynccontextmanager
from pathlib import Path

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message=".*OpenSSL.*")
warnings.filterwarnings("ignore", message=".*LibreSSL.*")

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")

from dotenv import dotenv_values, load_dotenv

_REPO_ROOT = Path(__file__).resolve().parent
_ENV_FILE = _REPO_ROOT / ".env"
load_dotenv(_ENV_FILE, override=False)
if _ENV_FILE.is_file():
    for _env_k, _env_v in dotenv_values(_ENV_FILE).items():
        if _env_v and not (os.environ.get(_env_k) or "").strip():
            os.environ[_env_k] = _env_v

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.core import ROOT_DIR, get_active_company_name, get_gcp_project, get_gcs_bucket_name
from backend.routers.slice_a_core_genai import router as slice_a_router
from backend.routers.slice_b_audiences_runs_creative import router as slice_b_router
from backend.routers.slice_c_chat_audit_gallery import router as slice_c_router
from backend.routers.slice_d_integrations_and_trends import router as slice_d_router
from backend.routers.slice_e_admin_tts_campaign import router as slice_e_router

NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    project = get_gcp_project()
    company = get_active_company_name()
    bucket = get_gcs_bucket_name()
    port = os.environ.get("PORT", "8080")
    print("\n=======================================================")
    print("🚀 [test-company Trend Intelligence (trend-finder) FastAPI Backend Online]")
    print(f"📌 Active Company Context: {company}")
    print(f"🌍 GCP Project: {project}")
    print(f"🪣 GCS Bucket: {bucket}")
    print(f"🔌 Port: {port}")
    print("=======================================================\n")
    yield


app = FastAPI(
    title="test-company Trend Intelligence (trend-finder)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StaticAssetCacheHeadersMiddleware:
    """
    Pure ASGI middleware setting Cache-Control headers on static asset GET/HEAD responses.
    Avoids Starlette BaseHTTPMiddleware task-group wrapping so browser tab refreshes or
    client disconnects while a POST is in flight never raise RuntimeError('No response returned.').
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("method") not in ("GET", "HEAD"):
            await self.app(scope, receive, send)
            return

        path = scope.get("path") or ""
        cache_val = None
        if path.startswith("/assets/"):
            cache_val = b"public, max-age=31536000, immutable"

        if cache_val is None:
            await self.app(scope, receive, send)
            return

        async def send_with_cache(message):
            if message.get("type") == "http.response.start" and message.get("status") in (200, 206, 304):
                raw_headers = [
                    (k, v)
                    for k, v in (message.get("headers") or [])
                    if k.lower() != b"cache-control"
                ]
                raw_headers.append((b"cache-control", cache_val))
                message = {**message, "headers": raw_headers}
            await send(message)

        await self.app(scope, receive, send_with_cache)


app.add_middleware(StaticAssetCacheHeadersMiddleware)

# Include Active Routers (Slices A-E)
app.include_router(slice_a_router)
app.include_router(slice_b_router)
app.include_router(slice_c_router)
app.include_router(slice_d_router)
app.include_router(slice_e_router)

# Mount Static Data Directory
public_data_dir = ROOT_DIR / "public" / "data"
public_data_dir.mkdir(parents=True, exist_ok=True)
app.mount("/data", StaticFiles(directory=str(public_data_dir)), name="data")

dist_dir = ROOT_DIR / "dist"


@app.get("/{full_path:path}")
async def catch_all(request: Request, full_path: str):
    # Return real HTTP 404 JSON on unmatched /api/* routes (Zero Silent Fallbacks)
    if full_path == "api" or full_path.startswith("api/"):
        return JSONResponse(
            status_code=404,
            content={"error": f"API route not found: /{full_path}", "status": 404},
        )

    # Serve hashed Vite bundle chunks from dist/assets/* or return real JSON 404
    if full_path == "assets" or full_path.startswith("assets/"):
        dist_root = dist_dir.resolve()
        candidate = (dist_dir / full_path).resolve()
        if candidate.is_relative_to(dist_root) and candidate.is_file():
            return FileResponse(candidate)
        return JSONResponse(
            status_code=404,
            content={"error": f"Static asset not found: /{full_path}", "status": 404},
        )

    # Serve real root-level static files from dist/ or public/
    if full_path and full_path.lstrip("/") != "index.html":
        for base in (dist_dir, ROOT_DIR / "public"):
            base_root = base.resolve()
            candidate = (base / full_path).resolve()
            if candidate.is_relative_to(base_root) and candidate.is_file():
                return FileResponse(candidate)

    index_file = dist_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file, headers=NO_CACHE_HEADERS)

    return HTMLResponse(
        """
        <!DOCTYPE html>
        <html>
            <head><title>test-company Trend Intelligence (trend-finder)</title></head>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h2>test-company Trend Intelligence (trend-finder)</h2>
                <p>FastAPI Python backend is operational. Building frontend bundle...</p>
            </body>
        </html>
        """,
        headers=NO_CACHE_HEADERS,
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8080))
    is_reload = (
        os.environ.get("K_SERVICE") is None
        and os.environ.get("UVICORN_RELOAD", "true").lower() != "false"
    )
    reload_kwargs = (
        {
            "reload_dirs": [str(ROOT_DIR / "backend")],
            "reload_includes": ["*.py"],
            "reload_excludes": [
                ".venv/*",
                "node_modules/*",
                "dist/*",
                ".git/*",
                ".run/*",
                ".pytest_cache/*",
                "__pycache__/*",
                "runs/*",
                "public/*",
                "data/*",
            ],
        }
        if is_reload
        else {}
    )
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=is_reload,
        **reload_kwargs,
    )

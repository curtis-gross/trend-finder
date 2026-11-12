import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from backend.core_modules.ssl_and_runtime_patch import get_storage_client

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
APP_CONFIG_FILE = ROOT_DIR / "public" / "data" / "configuration" / "app_config.json"


class YouTubeKeyMissingError(RuntimeError):
    """Raised when no YouTube Data API key is configured. Never fall back to a hardcoded key."""


def get_youtube_api_key() -> str:
    """Return the YouTube Data API v3 key from the environment.

    Resolution order: YOUTUBE_API_KEY, GOOGLE_CLOUD_API_KEY, GEMINI_API_KEY, API_KEY.
    Raises YouTubeKeyMissingError when none is set. Routers convert this to HTTP 500.
    """
    candidate = (
        os.environ.get("YOUTUBE_API_KEY")
        or os.environ.get("GOOGLE_CLOUD_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("API_KEY")
        or ""
    )
    key = candidate.strip().replace('"', "").replace("'", "")
    if not key:
        raise YouTubeKeyMissingError(
            "YOUTUBE_API_KEY not set. Add YOUTUBE_API_KEY=<key> to .env or the server environment."
        )
    return key


def get_app_config() -> Dict[str, Any]:
    if APP_CONFIG_FILE.exists():
        try:
            return json.loads(APP_CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _canonicalize_company_alias(raw: str) -> str:
    trimmed = str(raw or "").strip()
    if not trimmed:
        return "test-company"
    lower = trimmed.lower()
    if lower in ("test-company", "test_company", "test company", "testcompany"):
        return "test-company"
    return trimmed


def get_active_company_name() -> str:
    cfg = get_app_config()
    branding = cfg.get("branding") if isinstance(cfg.get("branding"), dict) else {}
    cfg_name = str(
        branding.get("companyName")
        or cfg.get("companyName")
        or cfg.get("activeCompanyName")
        or cfg.get("brandName")
        or ""
    ).strip()
    env_name = (
        os.environ.get("COMPANY_NAME")
        or os.environ.get("ACTIVE_COMPANY_NAME")
        or ""
    ).strip().replace('"', "").replace("'", "")
    if env_name.lower() in ("", "your-brand-name"):
        env_name = ""

    if cfg_name and _canonicalize_company_alias(cfg_name) != "test-company":
        return _canonicalize_company_alias(cfg_name)
    if env_name:
        return _canonicalize_company_alias(env_name)
    return "test-company"


def normalize_company_name(name: Optional[str] = None) -> str:
    if name is None or not str(name).strip():
        return get_active_company_name()
    return _canonicalize_company_alias(str(name))


_WARNED_MISSING_BUCKET = False


def get_gcs_bucket_name() -> str:
    global _WARNED_MISSING_BUCKET
    env_bucket = os.environ.get("GCS_BUCKET_NAME") or os.environ.get("STORAGE_BUCKET")
    if env_bucket and str(env_bucket).strip():
        return str(env_bucket).strip()
    cfg = get_app_config()
    configured = (
        cfg.get("storageBucket")
        or cfg.get("gcsBucket")
        or cfg.get("gcsBucketName")
        or cfg.get("bucketName")
    )
    if configured and str(configured).strip():
        return str(configured).strip()
    project = (os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT") or "").strip()
    if project:
        return f"{project}-trend-gcs"
    if not _WARNED_MISSING_BUCKET:
        _WARNED_MISSING_BUCKET = True
        print(
            "[Platform Config] GCS_BUCKET_NAME and GCP_PROJECT are not set. "
            "Copy .env.example to .env and configure GCP_PROJECT or GCS_BUCKET_NAME."
        )
    return ""


def get_gcs_bucket(bucket_name: Optional[str] = None) -> Optional[Any]:
    sc = get_storage_client()
    if not sc:
        return None
    resolved = bucket_name or get_gcs_bucket_name()
    if not resolved:
        return None
    return sc.bucket(resolved)

import os
import subprocess
from typing import Any, Optional, Tuple


def _clean_key(raw: Optional[str]) -> str:
    if not raw or not isinstance(raw, str):
        return ""
    return raw.strip().replace('"', "").replace("'", "")


def get_genai_provider() -> str:
    raw = (os.environ.get("GENAI_PROVIDER") or "auto").strip().lower()
    if raw in ("vertex", "vertexai", "vertex_ai"):
        return "vertex"
    if raw in ("aistudio", "ai_studio", "ai-studio"):
        return "aistudio"
    return "auto"


def resolve_genai_key_source(req: Optional[Any] = None) -> Tuple[str, str]:
    if req:
        headers = getattr(req, "headers", {})
        header_key = (
            headers.get("x-goog-api-key")
            or headers.get("x-api-key")
        )
        cleaned_header = _clean_key(header_key)
        if cleaned_header:
            return cleaned_header, "header"

    provider = get_genai_provider()
    if provider == "aistudio":
        env_order = (
            "AI_STUDIO_API_KEY",
            "GEMINI_API_KEY",
            "GOOGLE_API_KEY",
            "API_KEY",
        )
    else:
        env_order = (
            "GOOGLE_CLOUD_API_KEY",
            "GEMINI_API_KEY",
            "AI_STUDIO_API_KEY",
            "VITE_GEMINI_API_KEY",
            "GOOGLE_API_KEY",
            "API_KEY",
        )

    for env_name in env_order:
        val = _clean_key(os.environ.get(env_name))
        if val:
            return val, env_name

    return "", ""


def resolve_genai_api_key(req: Optional[Any] = None) -> str:
    key, _ = resolve_genai_key_source(req)
    return key


def is_ai_studio_api_key(key: Optional[str], source: Optional[str] = None) -> bool:
    cleaned = _clean_key(key)
    if not cleaned:
        return False
    provider = get_genai_provider()
    if provider == "vertex":
        return False
    if provider == "aistudio":
        return True
    if source == "GOOGLE_CLOUD_API_KEY":
        return False
    if source == "AI_STUDIO_API_KEY":
        return True
    gcloud_key = _clean_key(os.environ.get("GOOGLE_CLOUD_API_KEY"))
    if gcloud_key and cleaned == gcloud_key:
        return False
    aistudio_key = _clean_key(os.environ.get("AI_STUDIO_API_KEY"))
    if aistudio_key and cleaned == aistudio_key:
        return True
    if gcloud_key:
        return False
    return cleaned.startswith("AIza")


def resolve_vertex_api_key(req: Optional[Any] = None) -> Optional[str]:
    k, source = resolve_genai_key_source(req)
    if not k or is_ai_studio_api_key(k, source=source):
        return None
    return k


_WARNED_MISSING_PROJECT = False


def get_gcp_project() -> str:
    global _WARNED_MISSING_PROJECT
    p = (os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT") or "").strip()
    if not p:
        try:
            gcloud_proj = subprocess.check_output(
                ["gcloud", "config", "get-value", "project"],
                stderr=subprocess.DEVNULL,
                encoding="utf-8",
            ).strip()
            if gcloud_proj and gcloud_proj != "(unset)":
                p = gcloud_proj
        except Exception:
            p = ""
    if not p and not _WARNED_MISSING_PROJECT:
        _WARNED_MISSING_PROJECT = True
        print(
            "[Platform Config] GCP_PROJECT is not set. "
            "Copy .env.example to .env and set GCP_PROJECT=<your-gcp-project-id>."
        )
    return p


__all__ = [
    "get_gcp_project",
    "get_genai_provider",
    "is_ai_studio_api_key",
    "resolve_genai_api_key",
    "resolve_genai_key_source",
    "resolve_vertex_api_key",
]

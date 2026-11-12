import asyncio
import ipaddress
import json
import os
import socket
import time
import urllib.parse
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Query, Request

from backend.core import (
    ROOT_DIR,
    _GENERIC_JSON_L1_CACHE,
    _L1_LOCK,
    _L1_TTL_SECONDS,
    gcs_download_json_fast,
    get_active_company_name,
    get_gcp_project,
    get_gcs_bucket_name,
    get_storage_client,
    get_youtube_api_key,
    resolve_genai_api_key,
    sanitize_company_name,
)

router = APIRouter()

_ALLOWED_GROUNDING_HOSTS = {
    "vertexaisearch.cloud.google.com",
    "www.google.com",
    "google.com",
}


def _clean_secret(val: Optional[str]) -> str:
    if not val or not isinstance(val, str):
        return ""
    cleaned = val.strip().replace('"', "").replace("'", "")
    if not cleaned or cleaned.lower().startswith("your-"):
        return ""
    return cleaned


def _unwrap_insights_rows(payload: Any) -> List[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("rows", "data", "items", "table"):
            candidate = payload.get(key)
            if isinstance(candidate, list):
                return candidate
    return []


def _probe_gcs_status(comp: str) -> Dict[str, Any]:
    bucket_name = (get_gcs_bucket_name() or "").strip()
    base = {
        "status": "error",
        "connected": False,
        "hasContent": False,
        "bucket": bucket_name,
        "blobCount": 0,
        "hasInsightsTable": False,
        "hasPipelineRuns": False,
        "message": "",
    }
    if not bucket_name:
        base["message"] = (
            "GCS bucket is not configured. Set GCP_PROJECT or GCS_BUCKET_NAME in .env "
            "to enable cloud persistence."
        )
        return base

    try:
        sc = get_storage_client()
    except Exception as exc:
        base["message"] = (
            f"GCS client initialization failed for bucket '{bucket_name}': {exc}. "
            "Verify ADC credentials (gcloud auth application-default login) or GCP_PROJECT."
        )
        return base

    if not sc:
        base["message"] = (
            f"GCS client unavailable for bucket '{bucket_name}'. "
            "Run 'gcloud auth application-default login' or configure GCP_PROJECT in .env."
        )
        return base

    try:
        bucket = sc.bucket(bucket_name)
        if not bucket.exists():
            base["message"] = (
                f"GCS bucket '{bucket_name}' was not found or is unreachable. "
                "Verify GCS_BUCKET_NAME and IAM permissions in .env."
            )
            return base
    except Exception as exc:
        base["message"] = (
            f"Unable to reach GCS bucket '{bucket_name}': {exc}. "
            "Check GCP credentials, network access, and bucket permissions."
        )
        return base

    try:
        raw_blobs = list(sc.list_blobs(bucket_name, prefix=f"{comp}/", max_results=30))
    except Exception as exc:
        base["message"] = (
            f"GCS bucket '{bucket_name}' exists, but listing objects under '{comp}/' failed: {exc}"
        )
        return base

    meaningful_names: List[str] = []
    for blob in raw_blobs:
        name = str(getattr(blob, "name", "") or "")
        if not name or name.endswith("/") or name.endswith(".meta.json"):
            continue
        basename = name.rsplit("/", 1)[-1]
        if basename.startswith("pytest_"):
            continue
        size = getattr(blob, "size", None)
        if (
            (name.endswith("insights_table_run.json") or name.endswith("insights_table.json"))
            and isinstance(size, (int, float))
            and int(size) <= 5
        ):
            continue
        meaningful_names.append(name)

    blob_count = len(meaningful_names)
    has_content = blob_count > 0
    has_insights_table = any(
        n.endswith("insights_table.json") or n.endswith("insights_table_run.json")
        for n in meaningful_names
    )
    has_pipeline_runs = any(
        "/runs/" in n or "/analyses/" in n or n.endswith("_run.json")
        for n in meaningful_names
    )

    if not has_content:
        return {
            "status": "warning",
            "connected": True,
            "hasContent": False,
            "bucket": bucket_name,
            "blobCount": 0,
            "hasInsightsTable": False,
            "hasPipelineRuns": False,
            "message": (
                f"Connected to GCS bucket '{bucket_name}', but no saved runs or content exist "
                f"for '{comp}' yet. Add sources in Filter Pipeline to persist snapshots."
            ),
        }

    return {
        "status": "success",
        "connected": True,
        "hasContent": True,
        "bucket": bucket_name,
        "blobCount": blob_count,
        "hasInsightsTable": has_insights_table,
        "hasPipelineRuns": has_pipeline_runs,
        "message": (
            f"Connected to GCS bucket '{bucket_name}' "
            f"({blob_count} saved artifact{'s' if blob_count != 1 else ''} for '{comp}')."
        ),
        "_rawCount": len(raw_blobs),
        "_sc": sc,
    }


def _probe_youtube_status(request: Optional[Request] = None) -> Dict[str, Any]:
    yt_key = ""
    if request:
        headers = getattr(request, "headers", {}) or {}
        yt_key = _clean_secret(
            headers.get("x-youtube-api-key")
            or headers.get("x-goog-api-key")
            or headers.get("x-api-key")
        )
    if not yt_key:
        yt_key = _clean_secret(
            os.environ.get("YOUTUBE_API_KEY") or os.environ.get("VITE_YOUTUBE_API_KEY")
        )
    if not yt_key:
        try:
            yt_key = _clean_secret(get_youtube_api_key())
        except Exception:
            yt_key = ""

    if yt_key:
        return {
            "status": "success",
            "configured": True,
            "requiresApiKey": True,
            "message": "YouTube Data API v3 key configured.",
        }
    return {
        "status": "warning",
        "configured": False,
        "requiresApiKey": True,
        "message": (
            "YOUTUBE_API_KEY is missing. Add YOUTUBE_API_KEY=<key> to .env "
            "to enable YouTube video search and comment harvesting."
        ),
    }


def _probe_gemini_status(request: Optional[Request] = None) -> Dict[str, Any]:
    api_key = _clean_secret(resolve_genai_api_key(request))
    project = (get_gcp_project() or "").strip()
    if project.lower().startswith("your-"):
        project = ""

    has_api_key = bool(api_key)
    has_project = bool(project)
    configured = has_api_key or has_project

    if has_project and has_api_key:
        msg = f"Vertex AI / Gemini configured (Project: {project}, API key set)."
    elif has_project:
        msg = f"Vertex AI / Gemini configured via ADC (Project: {project})."
    elif has_api_key:
        msg = "Gemini API key configured (no GCP_PROJECT set; using API key auth)."
    else:
        msg = (
            "Gemini / Vertex AI not configured. Set GCP_PROJECT (with ADC) or "
            "GOOGLE_CLOUD_API_KEY / GEMINI_API_KEY in .env."
        )

    return {
        "status": "success" if configured else "warning",
        "configured": configured,
        "project": project,
        "hasApiKey": has_api_key,
        "message": msg,
    }


def _probe_filter_pipeline_status(
    comp: str,
    gcs_connected: bool,
    bucket_name: str,
    sc: Optional[Any],
    may_have_gcs_table: bool,
) -> Dict[str, Any]:
    rows: List[Any] = []
    candidate_blobs = (
        f"{comp}/insights_table.json",
        f"{comp}/runs/insights_table_run.json",
        f"{comp}/insights_table_run.json",
    )
    if gcs_connected and sc and bucket_name:
        if may_have_gcs_table:
            for blob_path in candidate_blobs:
                try:
                    payload = gcs_download_json_fast(
                        blob_path,
                        bucket_name=bucket_name,
                        storage_client=sc,
                        use_l1=True,
                    )
                    unwrapped = _unwrap_insights_rows(payload)
                    if unwrapped:
                        rows = unwrapped
                        break
                except Exception:
                    continue
        else:
            now_ts = time.time()
            with _L1_LOCK:
                for blob_path in candidate_blobs:
                    cached = _GENERIC_JSON_L1_CACHE.get(f"json:{bucket_name}:{blob_path}")
                    if cached and (now_ts - float(cached.get("cachedAt") or 0)) <= _L1_TTL_SECONDS:
                        unwrapped = _unwrap_insights_rows(cached.get("data"))
                        if unwrapped:
                            rows = unwrapped
                            break
    else:
        runs_base = (ROOT_DIR / "public" / "data" / "configuration" / "runs").resolve()
        local_path = (runs_base / comp / "insights_table_run.json").resolve()
        if local_path.is_relative_to(runs_base) and local_path.is_file():
            try:
                parsed = json.loads(local_path.read_text(encoding="utf-8"))
                rows = _unwrap_insights_rows(parsed)
            except Exception:
                rows = []

    item_count = len(rows)
    has_items = item_count > 0
    return {
        "status": "success" if has_items else "warning",
        "itemCount": item_count,
        "hasItems": has_items,
        "message": (
            f"Filter Pipeline has {item_count} source item{'s' if item_count != 1 else ''} ready for '{comp}'."
            if has_items
            else f"Filter Pipeline has 0 source items for '{comp}'. Add sources in Filter Pipeline (1: Listen)."
        ),
    }


def _run_startup_checks_sync(
    request: Optional[Request] = None,
    company_name: Optional[str] = None,
) -> Dict[str, Any]:
    comp = sanitize_company_name(company_name or get_active_company_name())
    gcs_result = _probe_gcs_status(comp)
    sc = gcs_result.pop("_sc", None)
    raw_count = gcs_result.pop("_rawCount", 0)
    may_have_gcs_table = bool(gcs_result.get("hasInsightsTable")) or raw_count >= 30

    return {
        "gcs": gcs_result,
        "youtube": _probe_youtube_status(request),
        "steam": {
            "status": "success",
            "configured": True,
            "requiresApiKey": False,
            "message": "Steam Store & Reviews API ready (free public endpoints, no API key required).",
        },
        "gemini": _probe_gemini_status(request),
        "filterPipeline": _probe_filter_pipeline_status(
            comp=comp,
            gcs_connected=bool(gcs_result.get("connected")),
            bucket_name=str(gcs_result.get("bucket") or ""),
            sc=sc,
            may_have_gcs_table=may_have_gcs_table,
        ),
        "company": {
            "status": "success",
            "name": comp,
            "message": f"Active company: {comp}",
        },
    }


@router.get("/api/startup-checks")
async def startup_checks(
    request: Request,
    companyName: Optional[str] = Query(None),
):
    checks = await asyncio.to_thread(_run_startup_checks_sync, request, companyName)
    return {"success": True, "checks": checks}


def _is_disallowed_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str.split("%")[0])
    except ValueError:
        return True
    return bool(
        ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _is_safe_public_url(target_url: str) -> bool:
    if not target_url or not isinstance(target_url, str):
        return False
    try:
        parsed = urllib.parse.urlparse(target_url.strip())
    except Exception:
        return False

    if parsed.scheme.lower() not in {"http", "https"}:
        return False

    hostname = (parsed.hostname or "").strip().lower().rstrip(".")
    if not hostname:
        return False

    if (
        hostname == "localhost"
        or hostname.endswith(".localhost")
        or hostname.endswith(".local")
        or hostname.endswith(".internal")
        or hostname == "metadata.google.internal"
    ):
        return False

    try:
        ipaddress.ip_address(hostname)
        return not _is_disallowed_ip(hostname)
    except ValueError:
        pass

    try:
        addr_infos = socket.getaddrinfo(hostname, None)
        for info in addr_infos:
            sockaddr = info[4]
            if sockaddr and len(sockaddr) >= 1:
                if _is_disallowed_ip(str(sockaddr[0])):
                    return False
    except Exception:
        pass

    return True


async def resolve_grounding_url(url: str) -> str:
    if not url or not isinstance(url, str):
        return url

    cleaned_url = url.strip()
    try:
        parsed = urllib.parse.urlparse(cleaned_url)
    except Exception:
        return url

    hostname = (parsed.hostname or "").strip().lower()
    is_allowed_redirect = (
        parsed.scheme.lower() == "https"
        and hostname in _ALLOWED_GROUNDING_HOSTS
        and (parsed.path.startswith("/grounding-api-redirect") or parsed.path == "/url")
    )
    if not is_allowed_redirect:
        return url

    if parsed.path == "/url":
        query_params = urllib.parse.parse_qs(parsed.query)
        for param_name in ("q", "url"):
            for candidate_target in query_params.get(param_name, []):
                if candidate_target and not _is_safe_public_url(candidate_target):
                    return url

    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            res = await client.get(cleaned_url)
            for hop in getattr(res, "history", None) or []:
                hop_url = str(getattr(hop, "url", "") or "")
                if hop_url and not _is_safe_public_url(hop_url):
                    return url
            final_url = str(getattr(res, "url", "") or "")
            if (
                final_url
                and "grounding-api-redirect" not in final_url
                and _is_safe_public_url(final_url)
            ):
                return final_url
    except Exception:
        pass
    return url


@router.post("/api/resolve-urls")
async def resolve_urls_endpoint(request: Request):
    body = await request.json()
    urls = body.get("urls", [])
    resolved = {}
    for u in urls:
        if u and isinstance(u, str):
            resolved[u] = await resolve_grounding_url(u)
    return {"resolved": resolved}

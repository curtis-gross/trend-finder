import asyncio
import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.core import (
    ROOT_DIR,
    _FINGERPRINT_INDEX,
    _GENERIC_JSON_L1_CACHE,
    _L1_LOCK,
    _L1_RUN_CACHE,
    _PAST_RUNS_L1_CACHE,
    get_gcp_project,
    get_gcs_bucket,
    normalize_company_name,
)

router = APIRouter()


async def _parse_json_body(request: Request) -> Dict[str, Any]:
    try:
        parsed = await request.json()
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def sanitize_id(val: Optional[str]) -> str:
    if not val:
        return "test-company"
    cleaned = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", str(val).strip())
    return cleaned or "test-company"


@router.post("/api/pipeline/wipe")
async def api_pipeline_wipe(request: Request):
    try:
        body = await _parse_json_body(request)
        company_name = body.get("companyName")
        active_company = sanitize_id(normalize_company_name(company_name))
        sanitized = sanitize_id(active_company)

        company_dir = ROOT_DIR / "public" / "data" / "configuration" / "runs" / sanitized
        dist_company_dir = ROOT_DIR / "dist" / "data" / "configuration" / "runs" / sanitized
        analyses_dir = ROOT_DIR / "public" / "data" / "configuration" / "analyses" / sanitized
        dist_analyses_dir = ROOT_DIR / "dist" / "data" / "configuration" / "analyses" / sanitized
        pipeline_feature_prefixes = [
            "noise_filter",
            "noise_filter_raw_comments",
            "noise_filter_filtered_comments",
            "noise_filter_keywords",
            "noise_filter_trajectory",
            "insights_home",
            "insights_table",
            "insight_audit",
            "ad_opportunities",
            "daily_summary",
            "sentiment_anomaly_alerts",
            "sentiment_",
            "youtube_sentiment_",
            "abcd_",
            "reddit_",
            "steam_",
            "trustpilot_",
            "website_analysis_",
            "google_trends_",
            "listen_",
            "runway_analysis",
        ]

        deleted_count = 0
        for target_dir in (company_dir, dist_company_dir):
            if target_dir.exists():
                for f_path in target_dir.iterdir():
                    if f_path.is_file() and any(f_path.name.startswith(p) for p in pipeline_feature_prefixes):
                        try:
                            f_path.unlink()
                            deleted_count += 1
                        except Exception:
                            pass

        for a_dir in (analyses_dir, dist_analyses_dir):
            if a_dir.exists():
                for f_path in a_dir.iterdir():
                    if f_path.is_file():
                        try:
                            f_path.unlink()
                            deleted_count += 1
                        except Exception:
                            pass

        for flat_dir in (
            ROOT_DIR / "public" / "data" / "configuration",
            ROOT_DIR / "dist" / "data" / "configuration",
        ):
            if flat_dir.exists():
                for f_path in flat_dir.iterdir():
                    if (
                        f_path.is_file()
                        and f_path.name.endswith("_run.json")
                        and any(f_path.name.startswith(p) for p in pipeline_feature_prefixes)
                    ):
                        try:
                            f_path.unlink()
                            deleted_count += 1
                        except Exception:
                            pass

        sanitized_lower = sanitized.lower()
        for k in list(_L1_RUN_CACHE.keys()):
            k_str = str(k)
            if k_str.lower().startswith(f"{sanitized_lower}:") or any(p in k_str for p in pipeline_feature_prefixes):
                _L1_RUN_CACHE.pop(k, None)

        with _L1_LOCK:
            for c_key in list(_FINGERPRINT_INDEX.keys()):
                if isinstance(c_key, tuple) and len(c_key) == 2:
                    comp_k, fid_k = str(c_key[0]), str(c_key[1])
                    if comp_k.lower() == sanitized_lower or any(fid_k.startswith(p) for p in pipeline_feature_prefixes):
                        _FINGERPRINT_INDEX.pop(c_key, None)
            for g_key in list(_GENERIC_JSON_L1_CACHE.keys()):
                g_str = str(g_key)
                if f":{sanitized}/" in g_str or f":{active_company}/" in g_str or any(p in g_str for p in pipeline_feature_prefixes):
                    _GENERIC_JSON_L1_CACHE.pop(g_key, None)
            for p_key in list(_PAST_RUNS_L1_CACHE.keys()):
                if isinstance(p_key, tuple) and len(p_key) >= 1:
                    b_name = str(p_key[0])
                    if b_name.startswith(f"{sanitized}/") or any(p in b_name for p in pipeline_feature_prefixes):
                        _PAST_RUNS_L1_CACHE.pop(p_key, None)

        def _wipe_gcs_blobs() -> int:
            removed_blobs = 0
            primary_bucket = get_gcs_bucket()
            buckets_to_check = []
            if primary_bucket is not None:
                buckets_to_check.append(primary_bucket)
            try:
                proj = get_gcp_project()
                if proj:
                    alt_bucket_name = f"{proj}-trend-gcs"
                    if primary_bucket is None or primary_bucket.name != alt_bucket_name:
                        alt_b = get_gcs_bucket(alt_bucket_name)
                        if alt_b is not None:
                            buckets_to_check.append(alt_b)
            except Exception:
                pass

            for bucket in buckets_to_check:
                try:
                    for blob in bucket.list_blobs(prefix=f"{sanitized}/runs/"):
                        base_name = blob.name.split("/")[-1]
                        if any(base_name.startswith(p) for p in pipeline_feature_prefixes):
                            try:
                                blob.delete()
                                removed_blobs += 1
                            except Exception:
                                pass
                except Exception:
                    pass

                try:
                    for blob in bucket.list_blobs(prefix=f"{sanitized}/", delimiter="/"):
                        base_name = blob.name.split("/")[-1]
                        if base_name == "insights_table.json" or any(base_name.startswith(p) for p in pipeline_feature_prefixes):
                            try:
                                blob.delete()
                                removed_blobs += 1
                            except Exception:
                                pass
                except Exception:
                    pass

                try:
                    table_blob = bucket.blob(f"{sanitized}/insights_table.json")
                    table_blob.delete()
                    removed_blobs += 1
                except Exception:
                    pass

                try:
                    for blob in bucket.list_blobs(prefix=f"{sanitized}/analyses/"):
                        try:
                            blob.delete()
                            removed_blobs += 1
                        except Exception:
                            pass
                except Exception:
                    pass

            return removed_blobs

        deleted_gcs_blobs_count = await asyncio.to_thread(_wipe_gcs_blobs)

        return {
            "success": True,
            "company": active_company,
            "deletedFilesCount": deleted_count,
            "deleted_gcs_blobs_count": deleted_gcs_blobs_count,
            "deletedGcsBlobsCount": deleted_gcs_blobs_count,
            "message": f"Pipeline checkpoints wiped successfully ({deleted_count} files, {deleted_gcs_blobs_count} GCS blobs removed). Ready for fresh ingest.",
        }
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": f"Failed to wipe pipeline: {err}"})

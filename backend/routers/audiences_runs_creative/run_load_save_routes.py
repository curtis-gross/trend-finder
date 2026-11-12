import asyncio
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import JSONResponse

from backend.core import (
    ROOT_DIR,
    _L1_RUN_CACHE,
    _L1_TTL_SECONDS,
    calculate_fingerprint,
    calculate_md5,
    gcs_upload_json_async,
    get_active_company_name,
    get_cache_key,
    get_gcs_bucket_name,
    get_local_mirror_file,
    get_run_fingerprint_metadata,
    get_storage_client,
    load_run_from_fingerprint_cache,
    resolve_run_updated_at,
    sanitize_company_name,
    sanitize_run_id,
    update_local_mirror,
)

router = APIRouter()


def get_run_file(feature_id: str, company_name: Optional[str] = None) -> Path:
    comp = sanitize_company_name(company_name or get_active_company_name())
    clean_id = sanitize_run_id(feature_id)
    return ROOT_DIR / "public" / "data" / "configuration" / "runs" / comp / f"{clean_id}_run.json"


def save_run_to_gcs(
    feature_id: str,
    serialized_json: str,
    company_name: Optional[str] = None,
    sync: bool = False,
    fingerprint: Optional[str] = None,
    updated_at: Optional[str] = None,
) -> bool:
    comp = sanitize_company_name(company_name or get_active_company_name())
    clean_id = sanitize_run_id(feature_id)
    bucket_name = get_gcs_bucket_name()
    if not bucket_name:
        return False
    blob_paths = [f"{comp}/runs/{clean_id}_run.json", f"{comp}/{clean_id}_run.json"]
    return gcs_upload_json_async(
        blob_paths, serialized_json, fingerprint=fingerprint, updated_at=updated_at, bucket_name=bucket_name, sync=sync
    )


def _is_meaningful_run_payload(payload: Any, clean_id: str) -> bool:
    if payload is None:
        return False
    if isinstance(payload, list):
        return len(payload) > 0
    if isinstance(payload, dict):
        if len(payload) == 0:
            return False
        meta_keys = {"fingerprint", "_fingerprint", "md5", "_md5", "updatedAt", "_updatedAt", "savedAt", "status", "data"}
        if not any(k not in meta_keys for k in payload.keys()):
            inner = payload.get("data")
            if not inner or (isinstance(inner, (dict, list)) and len(inner) == 0):
                return False
        if clean_id == "noise_filter_keywords":
            return bool(payload.get("topKeywords") or payload.get("enrichedComments"))
        if clean_id == "noise_filter":
            return bool(payload.get("nodes") or payload.get("comments"))
        return True
    return True


@router.get("/api/load-run/{feature_id}")
async def load_run(
    request: Request,
    feature_id: str,
    featureId: Optional[str] = Query(None),
    companyName: Optional[str] = Query(None),
    clientMd5: Optional[str] = Query(None),
    clientFingerprint: Optional[str] = Query(None),
    knownFingerprint: Optional[str] = Query(None),
    response: Response = None,
):
    no_store = "no-store, no-cache, must-revalidate, max-age=0"
    if response is not None:
        response.headers["Cache-Control"] = no_store

    fid = (feature_id or featureId or "").lstrip("/")
    if not fid:
        return JSONResponse(status_code=400, content={"error": "featureId is required", "status": "error"}, headers={"Cache-Control": no_store})

    comp = sanitize_company_name(companyName or get_active_company_name())
    clean_id = sanitize_run_id(fid)
    bucket_name = get_gcs_bucket_name()

    if clean_id == "company_context":
        desc = "Enterprise trend intelligence and multi-channel media listening workspace."
        local_file = get_local_mirror_file(clean_id, comp, ROOT_DIR)
        if local_file and local_file.exists():
            try:
                raw = json.loads(local_file.read_text(encoding="utf-8"))
                if raw.get("description"):
                    desc = raw["description"]
            except Exception:
                pass
        ctx_payload = {"name": comp, "description": desc}
        updated_at = resolve_run_updated_at(ctx_payload, local_file=local_file)
        fp_val = calculate_fingerprint(ctx_payload, updated_at)
        ctx_payload.update({"updatedAt": updated_at, "fingerprint": fp_val})
        if response is not None:
            response.headers["X-Run-Fingerprint"] = fp_val
            response.headers["X-Run-Updated-At"] = updated_at
            response.headers["ETag"] = f'"{fp_val}"'
        return ctx_payload

    if_none_match = (request.headers.get("if-none-match") or "").strip().strip('"') or None
    req_md5 = (clientMd5 or "").strip().strip('"') or None
    req_fp = (knownFingerprint or clientFingerprint or if_none_match or "").strip().strip('"') or None

    if req_fp or req_md5:
        fast_meta = get_run_fingerprint_metadata(None, bucket_name, comp, clean_id, ROOT_DIR)
        if fast_meta.get("exists") and int(fast_meta.get("sizeBytes") or 0) > 10:
            fp_val = fast_meta.get("fingerprint") or ""
            md5_val = fast_meta.get("md5") or ""
            updated_at = fast_meta.get("updatedAt") or ""
            if (req_fp and req_fp == fp_val) or (req_md5 and req_md5 == md5_val):
                if response is not None:
                    response.headers["X-Cache-Source"] = fast_meta.get("source") or "memory"
                    response.headers["X-Run-Fingerprint"] = fp_val
                    response.headers["X-Run-Updated-At"] = updated_at
                    response.headers["ETag"] = f'"{fp_val}"'
                return {"notModified": True, "unchanged": True, "status": "not_modified", "md5": md5_val, "fingerprint": fp_val, "updatedAt": updated_at}

    is_ad_analysis = clean_id.startswith("ad_analysis_") or "analysis" in clean_id
    key = get_cache_key(comp, clean_id)
    cached_l1 = _L1_RUN_CACHE.get(key)
    if (
        cached_l1
        and _is_meaningful_run_payload(cached_l1.get("data"), clean_id)
        and (time.time() - float(cached_l1.get("cachedAt") or 0)) <= _L1_TTL_SECONDS
    ):
        data, source = cached_l1["data"], "memory"
    else:
        data, source = await asyncio.to_thread(lambda: load_run_from_fingerprint_cache(get_storage_client(), bucket_name, comp, clean_id, ROOT_DIR))

    if not _is_meaningful_run_payload(data, clean_id):
        local_f = get_local_mirror_file(clean_id, comp, ROOT_DIR)
        if local_f and local_f.exists():
            try:
                local_data = await asyncio.to_thread(lambda: json.loads(local_f.read_text(encoding="utf-8")))
                if _is_meaningful_run_payload(local_data, clean_id):
                    data, source = local_data, "disk"
            except Exception as err:
                print(f"[load_run] Local fallback read error for {local_f}: {err}")

    if isinstance(data, dict):
        inner = data.get("data") if isinstance(data.get("data"), dict) else data
        raw_payload_comp = str(inner.get("companyName") or inner.get("company") or data.get("companyName") or data.get("company") or "").strip()
        if raw_payload_comp:
            requested_slug = sanitize_company_name(comp).lower()
            payload_company_slug = sanitize_company_name(raw_payload_comp).lower()
            if requested_slug != payload_company_slug:
                data = None

    if data is not None and (not isinstance(data, dict) or len(data) > 0):
        cached_entry = _L1_RUN_CACHE.get(key) or {}
        local_f = get_local_mirror_file(clean_id, comp, ROOT_DIR)
        updated_at = cached_entry.get("updatedAt") or resolve_run_updated_at(data, local_file=local_f)
        fp_val = cached_entry.get("fingerprint") or calculate_fingerprint(data, updated_at)
        calculated = cached_entry.get("md5") or calculate_md5(data)

        if response is not None:
            response.headers["X-Cache-Source"] = source
            response.headers["X-Run-Fingerprint"] = fp_val
            response.headers["X-Run-Updated-At"] = updated_at
            response.headers["ETag"] = f'"{fp_val}"'

        if _is_meaningful_run_payload(data, clean_id) and ((req_md5 and req_md5 == calculated) or (req_fp and req_fp == fp_val)):
            return {"notModified": True, "unchanged": True, "status": "not_modified", "md5": calculated, "fingerprint": fp_val, "updatedAt": updated_at}

        if isinstance(data, dict):
            out = {**data, "fingerprint": fp_val}
            if not out.get("updatedAt") or str(out.get("updatedAt")).lower() == "just now":
                out["updatedAt"] = updated_at
            if "data" not in out:
                out["data"] = {k: v for k, v in data.items() if k not in ("fingerprint", "_fingerprint", "_md5")}
            return out
        return data

    if is_ad_analysis:
        return JSONResponse(status_code=404, content={"error": f"Ad analysis run '{clean_id}' not found in GCS bucket", "status": "error"}, headers={"Cache-Control": no_store})

    return JSONResponse(status_code=200, content={"status": "empty", "data": None, "fingerprint": None, "updatedAt": None}, headers={"Cache-Control": no_store})


@router.post("/api/save-run")
@router.post("/api/save-run/{feature_id}")
async def save_run(request: Request, feature_id: Optional[str] = None, sync: bool = Query(False)):
    body = await request.json()
    fid = feature_id or (body.get("featureId") if isinstance(body, dict) else None)
    comp = sanitize_company_name((body.get("companyName") if isinstance(body, dict) else None) or get_active_company_name())
    if isinstance(body, dict) and "data" in body:
        data = body.get("data")
    elif isinstance(body, dict):
        data = {k: v for k, v in body.items() if k not in ("featureId",)} if feature_id else body
    else:
        data = body

    if not fid:
        return JSONResponse(status_code=400, content={"error": "featureId is required"})

    clean_id = sanitize_run_id(fid)
    updated_at = datetime.now(timezone.utc).isoformat()
    if isinstance(data, dict):
        data = {**data, "updatedAt": updated_at}
        fp_val = calculate_fingerprint(data, updated_at)
        data["fingerprint"] = fp_val
    else:
        fp_val = calculate_fingerprint(data, updated_at)

    serialized = json.dumps(data, indent=2)
    md5_val = calculate_md5(serialized)
    update_local_mirror(clean_id, comp, serialized, ROOT_DIR, metadata={"fingerprint": fp_val, "updatedAt": updated_at, "md5Hash": md5_val})

    dist_root = ROOT_DIR / "dist"
    if dist_root.exists():
        dist_mirror = dist_root / "data" / "configuration" / "runs" / comp / f"{clean_id}_run.json"
        try:
            dist_mirror.parent.mkdir(parents=True, exist_ok=True)
            dist_mirror.write_text(serialized, encoding="utf-8")
        except Exception:
            pass

    gcs_success = save_run_to_gcs(clean_id, serialized, comp, sync=sync, fingerprint=fp_val, updated_at=updated_at)
    return {
        "status": "success", "success": True, "featureId": clean_id, "companyName": comp,
        "fingerprint": fp_val, "updatedAt": updated_at, "md5": md5_val, "gcsSaved": gcs_success, "gcsAsync": not sync,
    }

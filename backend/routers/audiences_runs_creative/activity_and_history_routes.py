import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, Request

from backend.core import (
    ROOT_DIR,
    gcs_download_blobs_parallel,
    gcs_upload_json_async,
    get_active_company_name,
    get_gcs_bucket_name,
    get_storage_client,
    load_run_from_fingerprint_cache,
    sanitize_company_name,
    sanitize_run_id,
)
from backend.routers.audiences_runs_creative.run_load_save_routes import get_run_file

router = APIRouter()

ACTIVITY_FILE = ROOT_DIR / "data" / "strategy" / "activity_log.json"


@router.post("/api/activity")
async def post_activity(request: Request):
    body = await request.json()
    event = {
        "id": f"act_{int(time.time() * 1000)}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **body,
    }
    ACTIVITY_FILE.parent.mkdir(parents=True, exist_ok=True)
    events = []
    if ACTIVITY_FILE.exists():
        try:
            events = json.loads(ACTIVITY_FILE.read_text(encoding="utf-8"))
        except Exception:
            events = []
    events.insert(0, event)
    events = events[:100]
    ACTIVITY_FILE.write_text(json.dumps(events, indent=2), encoding="utf-8")
    return {"status": "success", "event": event}


def _extract_history_list(raw: Any) -> List[Any]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        if isinstance(raw.get("history"), list):
            return raw["history"]
        if isinstance(raw.get("data"), list):
            return raw["data"]
    return []


async def _resolve_feature_run_history(
    raw_feature_id: Optional[str],
    raw_company_name: Optional[str],
) -> Dict[str, Any]:
    feature_id = (raw_feature_id or "sentiment_anomaly_alerts").lstrip("/")
    company_name = sanitize_company_name(raw_company_name or get_active_company_name())

    clean_fid = sanitize_run_id(feature_id)
    base_fid = clean_fid[:-8] if clean_fid.endswith("_history") else clean_fid
    history_fid = f"{base_fid}_history"

    candidate_files = [
        ROOT_DIR / "data" / "strategy" / "history" / f"{company_name}_{base_fid}_history.json",
        get_run_file(history_fid, company_name),
        ROOT_DIR / "public" / "data" / "configuration" / "runs" / company_name / f"{history_fid}.json",
        ROOT_DIR / "public" / "data" / "configuration" / "runs" / company_name / "history" / f"{history_fid}.json",
    ]

    history_list: List[Any] = []
    for cand_file in candidate_files:
        if cand_file and cand_file.exists():
            try:
                parsed = json.loads(cand_file.read_text(encoding="utf-8"))
                extracted = _extract_history_list(parsed)
                if extracted:
                    history_list = extracted
                    break
            except Exception:
                pass

    if not history_list:
        def _load_gcs_history() -> List[Any]:
            sc = get_storage_client()
            bucket_name = get_gcs_bucket_name()
            if not sc or not bucket_name:
                return []
            try:
                bucket = sc.bucket(bucket_name)
                blob_paths = [
                    f"{company_name}/runs/history/{base_fid}_history.json",
                    f"{company_name}/run_history/{base_fid}.json",
                    f"{company_name}/runs/{history_fid}_run.json",
                ]
                for bp in blob_paths:
                    blob = bucket.blob(bp)
                    if blob.exists():
                        parsed = json.loads(blob.download_as_text(encoding="utf-8"))
                        extracted = _extract_history_list(parsed)
                        if extracted:
                            return extracted
                data, _ = load_run_from_fingerprint_cache(sc, bucket_name, company_name, history_fid, ROOT_DIR)
                extracted = _extract_history_list(data)
                if extracted:
                    return extracted
                prefix = f"{company_name}/runs/history/{base_fid}"
                blobs = [b for b in bucket.list_blobs(prefix=prefix, max_results=30) if b.name.endswith(".json")]
                if blobs:
                    downloaded_map = gcs_download_blobs_parallel(blobs, bucket_name=bucket_name, storage_client=sc, as_json=True)
                    items = [v for v in downloaded_map.values() if v is not None]
                    if items:
                        return items
            except Exception:
                pass
            return []

        history_list = await asyncio.to_thread(_load_gcs_history)

    if not history_list:
        run_file = get_run_file(base_fid, company_name)
        if run_file and run_file.exists():
            try:
                stat = run_file.stat()
                parsed = json.loads(run_file.read_text(encoding="utf-8"))
                inner = (
                    parsed.get("data")
                    if isinstance(parsed, dict) and isinstance(parsed.get("data"), dict)
                    else parsed
                )
                if isinstance(inner, dict) and inner:
                    history_list.append(
                        {
                            "id": inner.get("id") or f"run-{base_fid}-{int(stat.st_mtime * 1000)}",
                            "timestamp": inner.get("timestamp")
                            or (parsed.get("timestamp") if isinstance(parsed, dict) else None)
                            or datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                            "keyword": inner.get("monitoredKeyword") or inner.get("keyword") or company_name,
                            "data": inner,
                        }
                    )
            except Exception:
                pass

    return {
        "featureId": base_fid,
        "companyName": company_name,
        "historyList": history_list,
    }


@router.get("/api/runs-history/{feature_id}")
async def get_runs_history(
    feature_id: str,
    featureId: Optional[str] = Query(None),
    companyName: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
):
    resolved = await _resolve_feature_run_history(
        feature_id or featureId or "sentiment_anomaly_alerts",
        companyName or company,
    )
    return resolved["historyList"]


@router.post("/api/save-run-history/{feature_id}")
async def save_run_history(
    request: Request,
    feature_id: str,
    companyName: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
):
    body = await request.json()
    raw_fid = feature_id or (body.get("featureId") if isinstance(body, dict) else None) or "sentiment_anomaly_alerts"
    clean_fid = sanitize_run_id(raw_fid)
    base_fid = clean_fid[:-8] if clean_fid.endswith("_history") else clean_fid
    raw_comp = (
        companyName
        or company
        or (body.get("companyName") if isinstance(body, dict) else None)
        or (body.get("company") if isinstance(body, dict) else None)
        or get_active_company_name()
    )
    comp = sanitize_company_name(raw_comp)
    p = ROOT_DIR / "data" / "strategy" / "history" / f"{comp}_{base_fid}_history.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    history = []
    if p.exists():
        try:
            history = _extract_history_list(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            history = []
    entry_payload = body.get("data") if isinstance(body, dict) and "data" in body else body
    now_iso = datetime.now(timezone.utc).isoformat()
    history.insert(
        0,
        {
            "id": (body.get("id") if isinstance(body, dict) else None) or f"hist-{base_fid}-{int(time.time() * 1000)}",
            "timestamp": now_iso,
            "data": entry_payload,
        },
    )
    history = history[:30]
    serialized = json.dumps(history, indent=2)
    p.write_text(serialized, encoding="utf-8")

    try:
        mirror_hist = get_run_file(f"{base_fid}_history", comp)
        mirror_hist.parent.mkdir(parents=True, exist_ok=True)
        mirror_hist.write_text(serialized, encoding="utf-8")
    except Exception:
        pass

    bucket_name = get_gcs_bucket_name()
    if bucket_name:
        gcs_upload_json_async(
            [
                f"{comp}/runs/history/{base_fid}_history.json",
                f"{comp}/runs/{base_fid}_history_run.json",
                f"configuration/runs/{comp}/{base_fid}_history.json",
            ],
            history,
            bucket_name=bucket_name,
        )

    return {"success": True, "status": "success", "count": len(history), "historyCount": len(history)}

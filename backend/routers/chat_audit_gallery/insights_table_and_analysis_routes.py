import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from backend.core import (
    ROOT_DIR,
    gcs_download_blobs_parallel,
    gcs_download_json_fast,
    gcs_upload_json_async,
    get_gcs_bucket_name,
    get_local_mirror_file,
    get_storage_client,
    normalize_company_name,
    update_local_mirror,
)
from backend.routers.chat_audit_gallery.pipeline_wipe_routes import (
    _parse_json_body,
    sanitize_id,
)

router = APIRouter()


def _unwrap_insights_table_rows(payload: Any) -> Optional[List[Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for k in ("rows", "data", "items", "table"):
            if isinstance(payload.get(k), list):
                return payload[k]
    return None


@router.get("/api/insights/table")
async def api_get_insights_table(request: Request):
    company_name = request.query_params.get("companyName")
    active_company = sanitize_id(normalize_company_name(company_name))
    raw_company = sanitize_id(company_name) if company_name else active_company

    def _read():
        gcs_error: Optional[Exception] = None
        try:
            client = get_storage_client()
            bucket_name = get_gcs_bucket_name()
            companies = [active_company]
            if raw_company and raw_company != active_company:
                companies.append(raw_company)

            for comp in companies:
                for blob_path in (
                    f"{comp}/insights_table.json",
                    f"{comp}/runs/insights_table_run.json",
                    f"{comp}/insights_table_run.json",
                ):
                    res = gcs_download_json_fast(
                        blob_path,
                        bucket_name=bucket_name,
                        storage_client=client,
                        use_l1=True,
                    )
                    rows = _unwrap_insights_table_rows(res)
                    if rows and isinstance(rows, list) and len(rows) > 0:
                        return rows
        except Exception as err:
            gcs_error = err

        runs_base = (ROOT_DIR / "public" / "data" / "configuration" / "runs").resolve()
        local_path = (runs_base / active_company / "insights_table_run.json").resolve()
        if local_path.is_relative_to(runs_base) and local_path.is_file():
            try:
                parsed_local = json.loads(local_path.read_text(encoding="utf-8"))
                rows = _unwrap_insights_table_rows(parsed_local)
                if rows is not None:
                    return rows
            except Exception as local_err:
                print(f"[api_get_insights_table] Local fallback read error for {local_path}: {local_err}")

        if gcs_error is not None:
            raise gcs_error
        return []

    try:
        data = await asyncio.to_thread(_read)
        return data
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": f"Failed to read from GCS: {err}"})


@router.post("/api/insights/table")
async def api_post_insights_table(request: Request):
    body = await _parse_json_body(request)
    company_name = body.get("companyName")
    data = body.get("data")
    active_company = sanitize_id(normalize_company_name(company_name))
    if data is None:
        return JSONResponse(status_code=400, content={"error": "data is required"})

    try:
        update_local_mirror("insights_table", active_company, data, ROOT_DIR)
    except Exception:
        pass

    try:
        bucket_name = get_gcs_bucket_name()
        blob_paths = [
            f"{active_company}/insights_table.json",
            f"{active_company}/runs/insights_table_run.json",
        ]
        gcs_upload_json_async(blob_paths, data, bucket_name=bucket_name, sync=False)
        return {"success": True}
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": f"Failed to save to GCS: {err}"})


@router.get("/api/insights/analyses-all")
async def api_get_insights_analyses_all(request: Request):
    company_name = request.query_params.get("companyName")
    active_company = sanitize_id(normalize_company_name(company_name))

    def _read_all() -> List[Dict[str, Any]]:
        analyses: List[Dict[str, Any]] = []
        seen_ids = set()

        try:
            client = get_storage_client()
            bucket_name = get_gcs_bucket_name()
            if client and bucket_name:
                prefix = f"{active_company}/analyses/"
                blobs = [
                    b
                    for b in client.bucket(bucket_name).list_blobs(prefix=prefix)
                    if b.name.endswith(".json") and not b.name.endswith(".meta.json")
                ]
                if blobs:
                    downloaded_map = gcs_download_blobs_parallel(
                        blobs,
                        bucket_name=bucket_name,
                        storage_client=client,
                        as_json=True,
                    )
                    for b in blobs:
                        file_data = downloaded_map.get(b.name)
                        if isinstance(file_data, dict):
                            filename = Path(b.name).stem
                            analyses.append({**file_data, "_analysisId": filename})
                            seen_ids.add(filename)
        except Exception as err:
            print(f"[analyses-all] GCS read all failed (checking local storage): {err}")

        try:
            analyses_base = (ROOT_DIR / "public" / "data" / "configuration" / "analyses").resolve()
            local_dir = (analyses_base / active_company).resolve()
            if local_dir.is_relative_to(analyses_base) and local_dir.is_dir():
                for f_path in sorted(local_dir.iterdir()):
                    if f_path.is_file() and f_path.name.endswith(".json") and not f_path.name.endswith(".meta.json"):
                        filename = f_path.stem
                        if filename not in seen_ids:
                            try:
                                parsed = json.loads(f_path.read_text(encoding="utf-8"))
                                if isinstance(parsed, dict):
                                    analyses.append({**parsed, "_analysisId": filename})
                                    seen_ids.add(filename)
                            except Exception:
                                pass
        except Exception as local_err:
            print(f"[analyses-all] Local disk read all failed: {local_err}")

        return analyses

    return await asyncio.to_thread(_read_all)


@router.get("/api/insights/analysis")
async def api_get_insights_analysis(request: Request):
    company_name = request.query_params.get("companyName")
    analysis_id = request.query_params.get("analysisId")
    active_company = sanitize_id(normalize_company_name(company_name))
    if not analysis_id:
        return JSONResponse(status_code=400, content={"error": "analysisId is required"})
    clean_analysis_id = sanitize_id(analysis_id)

    def _read_gcs():
        client = get_storage_client()
        bucket_name = get_gcs_bucket_name()
        file_name = f"{active_company}/analyses/{clean_analysis_id}.json"
        return gcs_download_json_fast(file_name, bucket_name=bucket_name, storage_client=client, use_l1=True)

    try:
        gcs_res = await asyncio.to_thread(_read_gcs)
        if gcs_res is not None:
            return gcs_res
    except Exception:
        pass

    try:
        analyses_base = (ROOT_DIR / "public" / "data" / "configuration" / "analyses").resolve()
        candidate_names = [f"{clean_analysis_id}.json"]
        if clean_analysis_id.startswith("ad_analysis_"):
            suffix = clean_analysis_id[len("ad_analysis_"):]
            candidate_names.append(f"analysis_abcd_{suffix}.json")
        elif clean_analysis_id.startswith("analysis_abcd_"):
            suffix = clean_analysis_id[len("analysis_abcd_"):]
            candidate_names.append(f"ad_analysis_{suffix}.json")

        for cand_name in candidate_names:
            local_path = (analyses_base / active_company / cand_name).resolve()
            if local_path.is_relative_to(analyses_base) and local_path.is_file():
                return json.loads(local_path.read_text(encoding="utf-8"))

        mirror_file = get_local_mirror_file(clean_analysis_id, active_company, ROOT_DIR)
        if mirror_file and mirror_file.is_file():
            return json.loads(mirror_file.read_text(encoding="utf-8"))
    except Exception:
        pass

    return JSONResponse(status_code=404, content={"error": "Analysis not found"})


@router.post("/api/insights/analysis")
async def api_post_insights_analysis(request: Request):
    body = await _parse_json_body(request)
    company_name = body.get("companyName")
    analysis_id = body.get("analysisId")
    result = body.get("result")
    active_company = sanitize_id(normalize_company_name(company_name))
    if not analysis_id or not result:
        return JSONResponse(status_code=400, content={"error": "analysisId and result are required"})

    clean_analysis_id = sanitize_id(analysis_id)
    data_str = json.dumps(result, indent=2)

    try:
        analyses_base = (ROOT_DIR / "public" / "data" / "configuration" / "analyses").resolve()
        local_path = (analyses_base / active_company / f"{clean_analysis_id}.json").resolve()
        if local_path.is_relative_to(analyses_base):
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_text(data_str, encoding="utf-8")
    except Exception:
        pass

    try:
        bucket_name = get_gcs_bucket_name()
        file_name = f"{active_company}/analyses/{clean_analysis_id}.json"
        gcs_upload_json_async(file_name, result, bucket_name=bucket_name, sync=False)
    except Exception:
        pass

    return {"success": True, "message": f"Successfully saved analysis {clean_analysis_id}"}

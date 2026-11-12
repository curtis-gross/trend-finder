import copy
import json
import time
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

from backend.core_modules.l1_lru_cache import (
    _GCS_DOWNLOAD_EXECUTOR,
    _GCS_UPLOAD_EXECUTOR,
    _GENERIC_JSON_L1_CACHE,
    _L1_LOCK,
    _L1_MAX_ENTRIES,
    _L1_TTL_SECONDS,
    _PAST_RUNS_L1_CACHE,
    _get_inflight_lock,
    calculate_fingerprint,
    resolve_run_updated_at,
)
from backend.core_modules.platform_and_tenant_config import get_gcs_bucket_name
from backend.core_modules.ssl_and_runtime_patch import (
    get_storage_client,
    reset_storage_client,
)


def _is_gcs_not_found(exc: Exception) -> bool:
    code = getattr(exc, "code", None)
    if code == 404:
        return True
    cls_name = exc.__class__.__name__
    if cls_name == "NotFound":
        return True
    msg = str(exc)
    return "404" in msg or "Not Found" in msg or "No such object" in msg


def gcs_download_bytes_fast(blob: Any) -> Optional[bytes]:
    if blob is None:
        return None
    try:
        return blob.download_as_bytes()
    except Exception as exc:
        if _is_gcs_not_found(exc):
            return None
        raise


def gcs_download_json_fast(
    blob_or_path: Any,
    bucket_name: Optional[str] = None,
    storage_client: Optional[Any] = None,
    use_l1: bool = False,
    ttl: float = _L1_TTL_SECONDS,
) -> Optional[Any]:
    resolved_bucket_name = bucket_name or get_gcs_bucket_name()
    if isinstance(blob_or_path, str):
        blob_path = blob_or_path
        blob = None
    else:
        blob = blob_or_path
        blob_path = getattr(blob, "name", "") or str(blob_or_path)

    cache_key = f"json:{resolved_bucket_name}:{blob_path}"
    if use_l1:
        with _L1_LOCK:
            cached = _GENERIC_JSON_L1_CACHE.get(cache_key)
            if cached and (time.time() - float(cached.get("cachedAt") or 0)) <= ttl:
                _GENERIC_JSON_L1_CACHE.move_to_end(cache_key)
                return copy.deepcopy(cached["data"])

    inflight_lock = _get_inflight_lock(cache_key)
    was_locked = inflight_lock.locked()
    with inflight_lock:
        if was_locked:
            if use_l1:
                with _L1_LOCK:
                    cached = _GENERIC_JSON_L1_CACHE.get(cache_key)
                    if cached and (time.time() - float(cached.get("cachedAt") or 0)) <= ttl:
                        _GENERIC_JSON_L1_CACHE.move_to_end(cache_key)
                        return copy.deepcopy(cached["data"])

        if blob is None:
            sc = storage_client or get_storage_client()
            if not sc or not resolved_bucket_name:
                return None
            blob = sc.bucket(resolved_bucket_name).blob(blob_path)

        raw_bytes = gcs_download_bytes_fast(blob)
        if raw_bytes is None:
            return None

        parsed = json.loads(raw_bytes.decode("utf-8"))
        if use_l1:
            with _L1_LOCK:
                _GENERIC_JSON_L1_CACHE[cache_key] = {
                    "data": copy.deepcopy(parsed),
                    "cachedAt": time.time(),
                    "sizeBytes": len(raw_bytes),
                }
                _GENERIC_JSON_L1_CACHE.move_to_end(cache_key)
                while len(_GENERIC_JSON_L1_CACHE) > _L1_MAX_ENTRIES:
                    _GENERIC_JSON_L1_CACHE.popitem(last=False)
        return parsed


def gcs_cache_generic_json(blob_path: str, data: Any, bucket_name: Optional[str] = None) -> None:
    resolved_bucket_name = bucket_name or get_gcs_bucket_name()
    cache_key = f"json:{resolved_bucket_name}:{blob_path}"
    with _L1_LOCK:
        _GENERIC_JSON_L1_CACHE[cache_key] = {
            "data": copy.deepcopy(data),
            "cachedAt": time.time(),
            "sizeBytes": 0,
        }
        _GENERIC_JSON_L1_CACHE.move_to_end(cache_key)
        while len(_GENERIC_JSON_L1_CACHE) > _L1_MAX_ENTRIES:
            _GENERIC_JSON_L1_CACHE.popitem(last=False)


def gcs_get_blob_fingerprint_fast(
    blob_path: str,
    bucket_name: Optional[str] = None,
    storage_client: Optional[Any] = None,
) -> Optional[Dict[str, Any]]:
    sc = storage_client or get_storage_client()
    resolved_bucket_name = bucket_name or get_gcs_bucket_name()
    if not sc or not resolved_bucket_name:
        return None
    try:
        bucket = sc.bucket(resolved_bucket_name)
        blob = bucket.get_blob(blob_path)
        if blob is None:
            return None
        meta = getattr(blob, "metadata", None) or {}
        updated_at = meta.get("updatedAt") or resolve_run_updated_at(None, blob=blob)
        fp_val = meta.get("fingerprint") or ""
        return {
            "fingerprint": fp_val,
            "updatedAt": updated_at,
            "md5": blob.md5_hash or "",
            "generation": str(blob.generation or ""),
            "sizeBytes": int(blob.size or 0),
            "blob": blob,
        }
    except Exception:
        return None


def gcs_upload_json_async(
    blob_paths: Union[str, List[str]],
    data: Any,
    fingerprint: Optional[str] = None,
    updated_at: Optional[str] = None,
    bucket_name: Optional[str] = None,
    sync: bool = False,
    cache_control: str = "no-cache",
    on_complete: Optional[Callable[[], None]] = None,
) -> bool:
    paths = [blob_paths] if isinstance(blob_paths, str) else list(blob_paths)
    if not paths:
        return False

    resolved_bucket_name = bucket_name or get_gcs_bucket_name()
    if isinstance(data, (bytes, bytearray)):
        payload_str = bytes(data).decode("utf-8", errors="replace")
        parsed_obj = None
        try:
            parsed_obj = json.loads(payload_str)
        except Exception:
            pass
    elif isinstance(data, str):
        payload_str = data
        parsed_obj = None
        try:
            parsed_obj = json.loads(payload_str)
        except Exception:
            pass
    else:
        payload_str = json.dumps(data, indent=2)
        parsed_obj = data

    ts_val = updated_at or resolve_run_updated_at(parsed_obj)
    fp_val = fingerprint or calculate_fingerprint(parsed_obj if parsed_obj is not None else payload_str, ts_val)

    if parsed_obj is not None:
        for p in paths:
            gcs_cache_generic_json(p, parsed_obj, resolved_bucket_name)

    def _upload_worker() -> bool:
        try:
            sc = get_storage_client()
            if not sc or not resolved_bucket_name:
                return False
            bucket = sc.bucket(resolved_bucket_name)
            for p in paths:
                blob = bucket.blob(p)
                blob.metadata = {"fingerprint": fp_val, "updatedAt": ts_val}
                if cache_control:
                    blob.cache_control = cache_control
                blob.upload_from_string(payload_str, content_type="application/json")
            if callable(on_complete):
                try:
                    on_complete()
                except Exception:
                    pass
            return True
        except Exception as exc:
            reset_storage_client()
            print(f"[GCSCacheEngine Upload Notice] ({paths[0]}): {exc}")
            return False

    if sync:
        return _upload_worker()

    _GCS_UPLOAD_EXECUTOR.submit(_upload_worker)
    return True


def gcs_download_blobs_parallel(
    blobs_or_paths: List[Any],
    bucket_name: Optional[str] = None,
    storage_client: Optional[Any] = None,
    as_json: bool = True,
    max_workers: int = 8,
) -> Dict[str, Any]:
    if not blobs_or_paths:
        return {}

    resolved_bucket_name = bucket_name or get_gcs_bucket_name()
    results: Dict[str, Any] = {}
    to_fetch: List[Tuple[str, Any, Optional[Tuple[str, str]]]] = []

    for item in blobs_or_paths:
        if isinstance(item, str):
            b_name = item
            b_gen = ""
            blob_obj = None
        else:
            b_name = getattr(item, "name", "") or str(item)
            b_gen = str(getattr(item, "generation", "") or "")
            blob_obj = item

        l1_key = (b_name, b_gen) if b_gen else None
        if as_json and l1_key is not None:
            with _L1_LOCK:
                if l1_key in _PAST_RUNS_L1_CACHE:
                    _PAST_RUNS_L1_CACHE.move_to_end(l1_key)
                    results[b_name] = copy.deepcopy(_PAST_RUNS_L1_CACHE[l1_key])
                    continue

        to_fetch.append((b_name, blob_obj, l1_key))

    if not to_fetch:
        return results

    def _fetch_one(entry: Tuple[str, Any, Optional[Tuple[str, str]]]) -> Tuple[str, Any, Optional[Tuple[str, str]]]:
        b_name, blob_obj, l1_key = entry
        try:
            sc = get_storage_client()
            if not sc or not resolved_bucket_name:
                return b_name, None, l1_key
            target_blob = blob_obj if blob_obj is not None else sc.bucket(resolved_bucket_name).blob(b_name)
            raw = gcs_download_bytes_fast(target_blob)
            if raw is None:
                return b_name, None, l1_key
            if as_json:
                parsed = json.loads(raw.decode("utf-8"))
                return b_name, parsed, l1_key
            return b_name, raw, l1_key
        except Exception:
            return b_name, None, l1_key

    futures = [_GCS_DOWNLOAD_EXECUTOR.submit(_fetch_one, item) for item in to_fetch]
    for fut in futures:
        try:
            b_name, val, l1_key = fut.result(timeout=30)
            if val is not None:
                results[b_name] = val
                if as_json and l1_key is not None:
                    with _L1_LOCK:
                        _PAST_RUNS_L1_CACHE[l1_key] = copy.deepcopy(val)
                        _PAST_RUNS_L1_CACHE.move_to_end(l1_key)
                        while len(_PAST_RUNS_L1_CACHE) > _L1_MAX_ENTRIES:
                            _PAST_RUNS_L1_CACHE.popitem(last=False)
        except Exception:
            pass

    return results


def _find_gcs_run_blob(bucket: Any, comp: str, clean_id: str, raise_on_error: bool = False) -> Optional[Any]:
    candidate_paths = [
        f"{comp}/runs/{clean_id}_run.json",
        f"{comp}/{clean_id}_run.json",
        f"{clean_id}_run.json",
    ]
    for path in candidate_paths:
        try:
            blob = bucket.get_blob(path)
            if blob is not None:
                return blob
        except Exception as exc:
            if _is_gcs_not_found(exc):
                continue
            if raise_on_error:
                raise
    return None

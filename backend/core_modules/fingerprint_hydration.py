import json
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from backend.core_modules.gcs_fast_blob_io import (
    _find_gcs_run_blob,
    gcs_download_bytes_fast,
    gcs_get_blob_fingerprint_fast,
)
from backend.core_modules.l1_lru_cache import (
    _FINGERPRINT_INDEX,
    _L1_LOCK,
    _L1_RUN_CACHE,
    _L1_TTL_SECONDS,
    _LOCAL_WRITE_TIMESTAMPS,
    _get_inflight_lock,
    calculate_fingerprint,
    calculate_md5,
    get_cache_key,
    resolve_run_updated_at,
    sanitize_company_name,
    sanitize_run_id,
)
from backend.core_modules.local_mirror_io import (
    _populate_cache_from_disk,
    _read_sidecar_metadata,
    _write_sidecar_metadata,
    get_local_mirror_file,
    update_local_mirror,
)
from backend.core_modules.platform_and_tenant_config import ROOT_DIR
from backend.core_modules.ssl_and_runtime_patch import reset_storage_client


def load_run_from_fingerprint_cache(
    storage_client: Any,
    bucket_name: str,
    company_name: str,
    feature_id: str,
    base_dir: Path = ROOT_DIR,
    force_revalidate: bool = False,
) -> Tuple[Optional[Any], str]:
    comp = sanitize_company_name(company_name)
    clean_id = sanitize_run_id(feature_id)
    key = get_cache_key(comp, clean_id)
    now_ts = time.time()

    cached = _L1_RUN_CACHE.get(key)
    if cached and cached.get("data") is not None and not force_revalidate:
        cached_at = float(cached.get("cachedAt") or cached.get("mtime") or 0)
        if (now_ts - cached_at) <= _L1_TTL_SECONDS:
            return cached.get("data"), "memory"

    inflight_lock = _get_inflight_lock(key)
    was_locked = inflight_lock.locked()
    with inflight_lock:
        if was_locked:
            cached = _L1_RUN_CACHE.get(key)
            if cached and cached.get("data") is not None and not force_revalidate:
                if (time.time() - float(cached.get("cachedAt") or 0)) <= _L1_TTL_SECONDS:
                    return cached.get("data"), "memory"

        local_file = get_local_mirror_file(clean_id, comp, base_dir)
        with _L1_LOCK:
            recent_local_write_ts = _LOCAL_WRITE_TIMESTAMPS.get((comp, clean_id), 0.0)
        has_inflight_local_write = (time.time() - recent_local_write_ts) <= 10.0

        if local_file and local_file.exists() and not force_revalidate and (
            has_inflight_local_write or not storage_client or not bucket_name
        ):
            data = _populate_cache_from_disk(comp, clean_id, key, local_file)
            if data is not None:
                return data, ("disk" if (storage_client and bucket_name) else "disk_offline")

        if not storage_client or not bucket_name:
            if cached and cached.get("data") is not None:
                return cached.get("data"), "memory"
            return None, "missing"

        try:
            bucket = storage_client.bucket(bucket_name)
            if local_file and local_file.exists() and not force_revalidate:
                matched_blob = _find_gcs_run_blob(bucket, comp, clean_id, raise_on_error=True)
                if matched_blob is None:
                    data = _populate_cache_from_disk(comp, clean_id, key, local_file)
                    if data is not None:
                        return data, "disk"
                    return None, "not_found"

                gcs_md5 = getattr(matched_blob, "md5_hash", None) or ""
                gcs_gen = str(getattr(matched_blob, "generation", None) or "")
                blob_meta = getattr(matched_blob, "metadata", None) or {}
                try:
                    local_bytes = local_file.read_bytes()
                    if gcs_md5 and calculate_md5(local_bytes) == gcs_md5:
                        data = json.loads(local_bytes.decode("utf-8"))
                        updated_at = blob_meta.get("updatedAt") or resolve_run_updated_at(data, local_file=local_file, blob=matched_blob)
                        fp_val = blob_meta.get("fingerprint") or calculate_fingerprint(data, updated_at)
                        _write_sidecar_metadata(comp, clean_id, local_file, fp_val, updated_at, gcs_md5, gcs_gen, len(local_bytes))
                        hit_ts = time.time()
                        _L1_RUN_CACHE[key] = {
                            "md5": gcs_md5, "fingerprint": fp_val, "updatedAt": updated_at, "generation": gcs_gen,
                            "mtime": int(local_file.stat().st_mtime), "cachedAt": hit_ts, "sizeBytes": len(local_bytes), "data": data,
                        }
                        return data, "disk"
                except Exception:
                    pass
                downloaded = gcs_download_bytes_fast(matched_blob)
            else:
                downloaded, matched_blob = None, None
                for path in (f"{comp}/runs/{clean_id}_run.json", f"{comp}/{clean_id}_run.json", f"{clean_id}_run.json"):
                    blob_candidate = bucket.blob(path)
                    raw = gcs_download_bytes_fast(blob_candidate)
                    if raw is not None:
                        downloaded, matched_blob = raw, blob_candidate
                        break

            if downloaded is None:
                if cached and cached.get("data") is not None:
                    return cached.get("data"), "memory"
                if local_file and local_file.exists():
                    data = _populate_cache_from_disk(comp, clean_id, key, local_file)
                    if data is not None:
                        return data, "disk"
                return None, "not_found"

            data = json.loads(downloaded.decode("utf-8"))
            blob_meta = getattr(matched_blob, "metadata", None) or {}
            updated_at = blob_meta.get("updatedAt") or resolve_run_updated_at(data, blob=matched_blob)
            fp_val = blob_meta.get("fingerprint") or calculate_fingerprint(data, updated_at)
            md5_val = getattr(matched_blob, "md5_hash", None) or calculate_md5(downloaded)
            gcs_gen = str(getattr(matched_blob, "generation", None) or "")
            update_local_mirror(
                clean_id, comp, downloaded, base_dir,
                metadata={"md5Hash": md5_val, "fingerprint": fp_val, "updatedAt": updated_at, "generation": gcs_gen, "fromGcs": True},
            )
            return data, "gcs"

        except Exception as e:
            reset_storage_client()
            if cached and cached.get("data") is not None:
                return cached.get("data"), "memory_fallback"
            if local_file and local_file.exists():
                data = _populate_cache_from_disk(comp, clean_id, key, local_file)
                if data is not None:
                    return data, "disk_fallback"
            return None, f"error: {str(e)}"


def get_run_fingerprint_metadata(
    storage_client: Any,
    bucket_name: str,
    company_name: str,
    feature_id: str,
    base_dir: Path = ROOT_DIR,
) -> Dict[str, Any]:
    comp = sanitize_company_name(company_name)
    clean_id = sanitize_run_id(feature_id)
    key = get_cache_key(comp, clean_id)
    local_f = get_local_mirror_file(clean_id, comp, base_dir)

    with _L1_LOCK:
        idx_entry = _FINGERPRINT_INDEX.get((comp, clean_id))
        cached_l1 = _L1_RUN_CACHE.get(key)

    def _hit(entry: Dict[str, Any], src: str) -> Dict[str, Any]:
        return {
            "status": "success", "exists": True, "featureId": clean_id, "companyName": comp,
            "fingerprint": entry.get("fingerprint"), "updatedAt": entry.get("updatedAt"),
            "md5": entry.get("md5"), "sizeBytes": entry.get("sizeBytes", 0), "source": src,
        }

    if idx_entry and idx_entry.get("fingerprint") and (cached_l1 is not None or (local_f and local_f.exists())):
        return _hit(idx_entry, "memory")
    if cached_l1 and cached_l1.get("fingerprint"):
        return _hit(cached_l1, "memory")

    if local_f and local_f.exists():
        sidecar = _read_sidecar_metadata(comp, clean_id, local_f)
        if sidecar and sidecar.get("fingerprint"):
            return _hit(sidecar, "disk_sidecar")
        data = _populate_cache_from_disk(comp, clean_id, key, local_f)
        if data is not None:
            return _hit(_L1_RUN_CACHE.get(key) or {}, "disk")

    if storage_client and bucket_name:
        for candidate in (f"{comp}/{clean_id}_run.json", f"{comp}/runs/{clean_id}_run.json"):
            fast_meta = gcs_get_blob_fingerprint_fast(candidate, bucket_name=bucket_name, storage_client=storage_client)
            if fast_meta and fast_meta.get("fingerprint"):
                with _L1_LOCK:
                    _FINGERPRINT_INDEX[(comp, clean_id)] = {
                        "fingerprint": fast_meta["fingerprint"], "updatedAt": fast_meta["updatedAt"],
                        "md5": fast_meta["md5"], "generation": fast_meta["generation"],
                        "cachedAt": time.time(), "sizeBytes": fast_meta["sizeBytes"],
                    }
                return _hit(fast_meta, "gcs_metadata")

    data, source = load_run_from_fingerprint_cache(storage_client, bucket_name, comp, clean_id, base_dir)
    if data is None:
        return {"status": "empty", "exists": False, "featureId": clean_id, "companyName": comp, "fingerprint": None, "updatedAt": None, "md5": None, "source": source}

    cached = _L1_RUN_CACHE.get(key) or {}
    updated_at = cached.get("updatedAt") or resolve_run_updated_at(data, local_file=local_f)
    fp_val = cached.get("fingerprint") or calculate_fingerprint(data, updated_at)
    md5_val = cached.get("md5") or calculate_md5(data)
    return _hit({"fingerprint": fp_val, "updatedAt": updated_at, "md5": md5_val, "sizeBytes": cached.get("sizeBytes", 0)}, source)

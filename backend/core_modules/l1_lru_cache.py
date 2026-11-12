import base64
import hashlib
import json
import os
import re
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from backend.core_modules.platform_and_tenant_config import normalize_company_name

_L1_MAX_ENTRIES = int(os.environ.get("GCS_L1_MAX_ENTRIES", "128"))
_L1_TTL_SECONDS = float(os.environ.get("GCS_L1_TTL_SECONDS", "45.0"))
_L1_LOCK = threading.RLock()
_INFLIGHT_META_LOCK = threading.Lock()
_INFLIGHT_LOCKS: Dict[str, threading.Lock] = {}
_FINGERPRINT_INDEX: Dict[Tuple[str, str], Dict[str, Any]] = {}
_LOCAL_WRITE_TIMESTAMPS: Dict[Tuple[str, str], float] = {}
_PAST_RUNS_L1_CACHE: "OrderedDict[Tuple[str, str], Any]" = OrderedDict()
_GENERIC_JSON_L1_CACHE: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()

_GCS_UPLOAD_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="gcs-upload")
_GCS_DOWNLOAD_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="gcs-download")


def sanitize_run_id(feature_id: str) -> str:
    if not feature_id:
        return ""
    clean = str(feature_id).lstrip("/")
    if clean.endswith("_run.json"):
        clean = clean[:-9]
    return re.sub(r"[^a-zA-Z0-9_\-\.]", "_", clean)


def sanitize_company_name(company_name: Optional[str]) -> str:
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", normalize_company_name(company_name))


def get_cache_key(company_name: str, feature_id: str) -> str:
    return f"{sanitize_company_name(company_name)}:{sanitize_run_id(feature_id)}"


def _get_inflight_lock(key: str) -> threading.Lock:
    with _INFLIGHT_META_LOCK:
        lock = _INFLIGHT_LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            _INFLIGHT_LOCKS[key] = lock
            if len(_INFLIGHT_LOCKS) > 512:
                for k in list(_INFLIGHT_LOCKS.keys())[:128]:
                    if k != key and not _INFLIGHT_LOCKS[k].locked():
                        _INFLIGHT_LOCKS.pop(k, None)
        return lock


class _LRURunCache(OrderedDict):
    """Thread-safe LRU cache with max 128 entries and automatic _FINGERPRINT_INDEX synchronization."""

    def __init__(self, max_entries: int = _L1_MAX_ENTRIES) -> None:
        super().__init__()
        self.max_entries = max_entries

    def __setitem__(self, key: str, value: Dict[str, Any]) -> None:
        with _L1_LOCK:
            if isinstance(value, dict):
                now_ts = time.time()
                value.setdefault("cachedAt", now_ts)
                value.setdefault("mtime", int(now_ts))
                if "sizeBytes" not in value:
                    try:
                        value["sizeBytes"] = len(json.dumps(value.get("data"), separators=(",", ":")))
                    except Exception:
                        value["sizeBytes"] = 0
                if ":" in str(key) and value.get("fingerprint"):
                    comp, clean_id = str(key).split(":", 1)
                    _FINGERPRINT_INDEX[(comp, clean_id)] = {
                        "fingerprint": value["fingerprint"],
                        "updatedAt": value.get("updatedAt") or datetime.now(timezone.utc).isoformat(),
                        "md5": value.get("md5") or "",
                        "generation": value.get("generation") or "",
                        "cachedAt": value["cachedAt"],
                        "sizeBytes": value.get("sizeBytes", 0),
                    }
            if key in self:
                super().move_to_end(key)
            super().__setitem__(key, value)
            while len(self) > self.max_entries:
                super().popitem(last=False)

    def get(self, key: str, default: Any = None) -> Any:
        with _L1_LOCK:
            if key in self:
                super().move_to_end(key)
                return super().__getitem__(key)
            return default

    def pop(self, key: str, *args: Any) -> Any:
        with _L1_LOCK:
            if ":" in str(key):
                comp, clean_id = str(key).split(":", 1)
                _FINGERPRINT_INDEX.pop((comp, clean_id), None)
            return super().pop(key, *args)

    def clear(self) -> None:
        with _L1_LOCK:
            super().clear()
            _FINGERPRINT_INDEX.clear()
            _PAST_RUNS_L1_CACHE.clear()
            _GENERIC_JSON_L1_CACHE.clear()


_L1_RUN_CACHE = _LRURunCache(max_entries=_L1_MAX_ENTRIES)
server_run_cache = _L1_RUN_CACHE


_TRANSIENT_META_KEYS = {
    "fingerprint",
    "_fingerprint",
    "updatedAt",
    "_updatedAt",
    "md5",
    "_md5",
    "_gcsOfflineFallback",
    "_gcsError",
}


def calculate_md5(content: Union[str, bytes, Dict, List]) -> str:
    if content is None:
        return ""
    if isinstance(content, bytes):
        raw = content
    elif isinstance(content, str):
        raw = content.encode("utf-8")
    else:
        raw = json.dumps(content, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return base64.b64encode(hashlib.md5(raw).digest()).decode("utf-8")


def _strip_transient_keys(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            k: _strip_transient_keys(v)
            for k, v in value.items()
            if k not in _TRANSIENT_META_KEYS
        }
    if isinstance(value, list):
        return [_strip_transient_keys(item) for item in value]
    return value


def resolve_run_updated_at(
    data: Any = None,
    local_file: Optional[Path] = None,
    blob: Optional[Any] = None,
    fallback_iso: Optional[str] = None,
) -> str:
    if isinstance(data, dict):
        for field in ("updatedAt", "savedAt", "timestamp", "lastUpdated", "generatedAt"):
            val = data.get(field)
            if isinstance(val, str) and val.strip() and val.strip().lower() != "just now":
                return val.strip()
            if isinstance(val, (int, float)) and val > 0:
                ts = val / 1000.0 if val > 1e11 else float(val)
                return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    if blob is not None:
        blob_meta = getattr(blob, "metadata", None)
        if isinstance(blob_meta, dict) and blob_meta.get("updatedAt"):
            return str(blob_meta["updatedAt"])
        blob_updated = getattr(blob, "updated", None) or getattr(blob, "time_created", None)
        if blob_updated is not None:
            if hasattr(blob_updated, "isoformat"):
                return blob_updated.isoformat()
            return str(blob_updated)
    if local_file is not None and local_file.exists():
        try:
            return datetime.fromtimestamp(local_file.stat().st_mtime, tz=timezone.utc).isoformat()
        except Exception:
            pass
    return fallback_iso or datetime.now(timezone.utc).isoformat()


def calculate_fingerprint(
    content: Union[str, bytes, Dict, List, None],
    updated_at: Optional[str] = None,
) -> str:
    if content is None:
        return ""
    parsed: Any = content
    if isinstance(content, bytes):
        try:
            parsed = json.loads(content.decode("utf-8"))
        except Exception:
            return hashlib.sha256(content).hexdigest()
    elif isinstance(content, str):
        try:
            parsed = json.loads(content)
        except Exception:
            return hashlib.sha256(content.encode("utf-8")).hexdigest()

    clean_payload = _strip_transient_keys(parsed)
    if isinstance(clean_payload, dict) and "data" in clean_payload and isinstance(clean_payload["data"], (dict, list)):
        other_keys = set(clean_payload.keys()) - {"data", "featureId", "companyName", "company", "status", "success"}
        if not other_keys or (isinstance(clean_payload["data"], dict) and other_keys.issubset(set(clean_payload["data"].keys()))):
            clean_payload = _strip_transient_keys(clean_payload["data"])

    try:
        canonical_json = json.dumps(clean_payload, separators=(",", ":"), sort_keys=True, ensure_ascii=False)
    except Exception:
        canonical_json = str(clean_payload)

    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

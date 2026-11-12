"""
Unified 3-tier GCS fingerprint cache facade (`backend.core_modules.gcs_three_tier_cache`).
Re-exports all primitives from:
- `l1_lru_cache`: L1 in-memory LRU cache, singleflight locks, MD5 & SHA-256 fingerprint hashing
- `local_mirror_io`: L2 local disk mirror and `.meta.json` sidecar metadata index
- `gcs_fast_blob_io`: L3 single-roundtrip GCS blob reads and async write-behind pool
- `fingerprint_hydration`: 3-tier cache hydration and O(1) fingerprint lookup
"""

from backend.core_modules.l1_lru_cache import *  # noqa: F401,F403
from backend.core_modules.l1_lru_cache import (  # noqa: F401
    _FINGERPRINT_INDEX,
    _GCS_DOWNLOAD_EXECUTOR,
    _GCS_UPLOAD_EXECUTOR,
    _GENERIC_JSON_L1_CACHE,
    _INFLIGHT_LOCKS,
    _INFLIGHT_META_LOCK,
    _L1_LOCK,
    _L1_MAX_ENTRIES,
    _L1_RUN_CACHE,
    _L1_TTL_SECONDS,
    _LOCAL_WRITE_TIMESTAMPS,
    _LRURunCache,
    _PAST_RUNS_L1_CACHE,
    _TRANSIENT_META_KEYS,
    _get_inflight_lock,
    _strip_transient_keys,
    calculate_fingerprint,
    calculate_md5,
    get_cache_key,
    resolve_run_updated_at,
    sanitize_company_name,
    sanitize_run_id,
    server_run_cache,
)
from backend.core_modules.local_mirror_io import *  # noqa: F401,F403
from backend.core_modules.local_mirror_io import (  # noqa: F401
    _populate_cache_from_disk,
    _read_sidecar_metadata,
    _write_sidecar_metadata,
    get_local_mirror_file,
    get_sidecar_meta_path,
    get_target_mirror_path,
    update_local_mirror,
)
from backend.core_modules.gcs_fast_blob_io import *  # noqa: F401,F403
from backend.core_modules.gcs_fast_blob_io import (  # noqa: F401
    _find_gcs_run_blob,
    _is_gcs_not_found,
    gcs_cache_generic_json,
    gcs_download_blobs_parallel,
    gcs_download_bytes_fast,
    gcs_download_json_fast,
    gcs_get_blob_fingerprint_fast,
    gcs_upload_json_async,
)
from backend.core_modules.fingerprint_hydration import *  # noqa: F401,F403
from backend.core_modules.fingerprint_hydration import (  # noqa: F401
    get_run_fingerprint_metadata,
    load_run_from_fingerprint_cache,
)

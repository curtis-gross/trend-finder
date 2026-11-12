"""
Unified facade for `backend.core`.
Re-exports runtime patches, tenant/platform configuration, 3-tier GCS fingerprint cache primitives,
and GenAI API key/project helpers from `backend.core_modules`.
"""

from backend.core_modules.ssl_and_runtime_patch import *  # noqa: F401,F403
from backend.core_modules.ssl_and_runtime_patch import (  # noqa: F401
    _gcs_init_lock,
    _gcs_tls,
    _pyopenssl_lock,
    _pyopenssl_patched,
    ensure_pyopenssl_thread_safe,
    get_storage_client,
    reset_storage_client,
)
from backend.core_modules.platform_and_tenant_config import *  # noqa: F401,F403
from backend.core_modules.platform_and_tenant_config import (  # noqa: F401
    APP_CONFIG_FILE,
    ROOT_DIR,
    YouTubeKeyMissingError,
    _canonicalize_company_alias,
    get_active_company_name,
    get_app_config,
    get_gcs_bucket,
    get_gcs_bucket_name,
    get_youtube_api_key,
    normalize_company_name,
)
from backend.core_modules.gcs_three_tier_cache import *  # noqa: F401,F403
from backend.core_modules.gcs_three_tier_cache import (  # noqa: F401
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
    _find_gcs_run_blob,
    _get_inflight_lock,
    _is_gcs_not_found,
    _populate_cache_from_disk,
    _read_sidecar_metadata,
    _strip_transient_keys,
    _write_sidecar_metadata,
    calculate_fingerprint,
    calculate_md5,
    gcs_cache_generic_json,
    gcs_download_blobs_parallel,
    gcs_download_bytes_fast,
    gcs_download_json_fast,
    gcs_get_blob_fingerprint_fast,
    gcs_upload_json_async,
    get_cache_key,
    get_local_mirror_file,
    get_run_fingerprint_metadata,
    get_sidecar_meta_path,
    get_target_mirror_path,
    load_run_from_fingerprint_cache,
    resolve_run_updated_at,
    sanitize_company_name,
    sanitize_run_id,
    server_run_cache,
    update_local_mirror,
)
from backend.core_modules.genai_image_and_creative_index import *  # noqa: F401,F403
from backend.core_modules.genai_image_and_creative_index import (  # noqa: F401
    get_gcp_project,
    is_ai_studio_api_key,
    resolve_genai_api_key,
)

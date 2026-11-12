import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from backend.core_modules.l1_lru_cache import (
    _FINGERPRINT_INDEX,
    _L1_LOCK,
    _L1_RUN_CACHE,
    _LOCAL_WRITE_TIMESTAMPS,
    calculate_fingerprint,
    calculate_md5,
    get_cache_key,
    resolve_run_updated_at,
    sanitize_company_name,
    sanitize_run_id,
)
from backend.core_modules.platform_and_tenant_config import (
    ROOT_DIR,
    normalize_company_name,
)


def get_target_mirror_path(feature_id: str, company_name: str, base_dir: Path = ROOT_DIR) -> Path:
    comp = sanitize_company_name(company_name)
    clean_id = sanitize_run_id(feature_id)
    return base_dir / "public" / "data" / "configuration" / "runs" / comp / f"{clean_id}_run.json"


def get_sidecar_meta_path(mirror_path: Path) -> Path:
    return mirror_path.with_name(f"{mirror_path.stem}.meta.json")


def _write_sidecar_metadata(
    comp: str,
    clean_id: str,
    target_path: Path,
    fp_val: str,
    updated_at: str,
    md5_val: str,
    generation: str = "",
    size_bytes: int = 0,
) -> None:
    now_ts = time.time()
    entry = {
        "fingerprint": fp_val,
        "updatedAt": updated_at,
        "md5": md5_val,
        "generation": generation,
        "cachedAt": now_ts,
        "sizeBytes": size_bytes,
    }
    with _L1_LOCK:
        _FINGERPRINT_INDEX[(comp, clean_id)] = entry
    try:
        meta_path = get_sidecar_meta_path(target_path)
        meta_path.write_text(json.dumps(entry, separators=(",", ":")), encoding="utf-8")
    except Exception:
        pass


def _read_sidecar_metadata(comp: str, clean_id: str, local_file: Path) -> Optional[Dict[str, Any]]:
    try:
        if not local_file.exists():
            return None
        meta_path = get_sidecar_meta_path(local_file)
        if not meta_path.exists():
            return None
        file_stat = local_file.stat()
        meta_stat = meta_path.stat()
        if meta_stat.st_mtime + 1.0 < file_stat.st_mtime:
            return None
        parsed = json.loads(meta_path.read_text(encoding="utf-8"))
        if isinstance(parsed, dict) and parsed.get("fingerprint"):
            parsed["cachedAt"] = time.time()
            parsed["sizeBytes"] = parsed.get("sizeBytes") or file_stat.st_size
            with _L1_LOCK:
                _FINGERPRINT_INDEX[(comp, clean_id)] = parsed
            return parsed
    except Exception:
        pass
    return None


def get_local_mirror_file(feature_id: str, company_name: str, base_dir: Path = ROOT_DIR) -> Optional[Path]:
    comp = sanitize_company_name(company_name)
    norm_comp = normalize_company_name(company_name)
    raw_comp = str(company_name or "").strip()
    clean_id = sanitize_run_id(feature_id)

    folder_candidates: List[str] = []
    for cand in (comp, norm_comp, raw_comp):
        if cand and "/" not in cand and "\\" not in cand and ".." not in cand and cand not in folder_candidates:
            folder_candidates.append(cand)

    for folder_cand in folder_candidates:
        p1 = base_dir / "public" / "data" / "configuration" / "runs" / folder_cand / f"{clean_id}_run.json"
        if p1.exists():
            return p1

        analyses_dir = base_dir / "public" / "data" / "configuration" / "analyses" / folder_cand
        p_an = analyses_dir / f"{clean_id}.json"
        if p_an.exists():
            return p_an

        if clean_id.startswith("ad_analysis_"):
            suffix = clean_id[len("ad_analysis_"):]
            p_abcd = analyses_dir / f"analysis_abcd_{suffix}.json"
            if p_abcd.exists():
                return p_abcd
        elif clean_id.startswith("analysis_abcd_"):
            suffix = clean_id[len("analysis_abcd_"):]
            p_ad = analyses_dir / f"ad_analysis_{suffix}.json"
            if p_ad.exists():
                return p_ad
        elif clean_id == "bulk_analysis":
            p_bulk_ins = base_dir / "public" / "data" / "configuration" / "runs" / folder_cand / "bulk_insights_run.json"
            if p_bulk_ins.exists():
                return p_bulk_ins

    p2 = base_dir / "public" / "data" / "configuration" / "runs" / f"{clean_id}_run.json"
    if p2.exists():
        return p2

    p3 = base_dir / "public" / "data" / "configuration" / f"{clean_id}_run.json"
    if p3.exists():
        return p3

    p4 = base_dir / f"{clean_id}_run.json"
    if p4.exists():
        return p4

    return None


def update_local_mirror(
    feature_id: str,
    company_name: str,
    content: Union[str, bytes, Dict, List],
    base_dir: Path = ROOT_DIR,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[Path]:
    comp = sanitize_company_name(company_name)
    clean_id = sanitize_run_id(feature_id)
    target = get_target_mirror_path(clean_id, comp, base_dir)
    target.parent.mkdir(parents=True, exist_ok=True)

    parsed_data: Any = content
    if isinstance(content, bytes):
        raw_bytes = content
        target.write_bytes(raw_bytes)
        try:
            parsed_data = json.loads(raw_bytes.decode("utf-8"))
        except Exception:
            parsed_data = None
    elif isinstance(content, str):
        raw_bytes = content.encode("utf-8")
        target.write_text(content, encoding="utf-8")
        try:
            parsed_data = json.loads(content)
        except Exception:
            parsed_data = None
    else:
        serialized = json.dumps(content, indent=2)
        raw_bytes = serialized.encode("utf-8")
        target.write_text(serialized, encoding="utf-8")

    meta = metadata or {}
    updated_at = meta.get("updatedAt") or resolve_run_updated_at(parsed_data, local_file=target)
    md5_val = meta.get("md5Hash") or meta.get("md5") or calculate_md5(raw_bytes)
    fp_val = meta.get("fingerprint") or calculate_fingerprint(
        parsed_data if parsed_data is not None else raw_bytes,
        updated_at,
    )
    gen_val = str(meta.get("generation") or "")
    size_bytes = len(raw_bytes)

    _write_sidecar_metadata(
        comp=comp,
        clean_id=clean_id,
        target_path=target,
        fp_val=fp_val,
        updated_at=updated_at,
        md5_val=md5_val,
        generation=gen_val,
        size_bytes=size_bytes,
    )

    key = get_cache_key(comp, clean_id)
    now_ts = time.time()
    with _L1_LOCK:
        if meta.get("fromGcs") or gen_val:
            _LOCAL_WRITE_TIMESTAMPS.pop((comp, clean_id), None)
        else:
            _LOCAL_WRITE_TIMESTAMPS[(comp, clean_id)] = now_ts
    if parsed_data is not None:
        _L1_RUN_CACHE[key] = {
            "md5": md5_val,
            "fingerprint": fp_val,
            "updatedAt": updated_at,
            "generation": gen_val,
            "mtime": int(now_ts),
            "cachedAt": now_ts,
            "sizeBytes": size_bytes,
            "data": parsed_data,
        }

    return target


def _populate_cache_from_disk(
    comp: str,
    clean_id: str,
    key: str,
    local_file: Path,
) -> Optional[Any]:
    try:
        raw_bytes = local_file.read_bytes()
        data = json.loads(raw_bytes.decode("utf-8"))
        sidecar = _read_sidecar_metadata(comp, clean_id, local_file)
        if sidecar and sidecar.get("fingerprint"):
            fp_val = sidecar["fingerprint"]
            updated_at = sidecar.get("updatedAt") or resolve_run_updated_at(data, local_file=local_file)
            md5_val = sidecar.get("md5") or calculate_md5(raw_bytes)
            gen_val = sidecar.get("generation") or ""
        else:
            updated_at = resolve_run_updated_at(data, local_file=local_file)
            fp_val = calculate_fingerprint(data, updated_at)
            md5_val = calculate_md5(raw_bytes)
            gen_val = ""
            _write_sidecar_metadata(
                comp=comp,
                clean_id=clean_id,
                target_path=local_file,
                fp_val=fp_val,
                updated_at=updated_at,
                md5_val=md5_val,
                generation=gen_val,
                size_bytes=len(raw_bytes),
            )

        now_ts = time.time()
        _L1_RUN_CACHE[key] = {
            "md5": md5_val,
            "fingerprint": fp_val,
            "updatedAt": updated_at,
            "generation": gen_val,
            "mtime": int(local_file.stat().st_mtime),
            "cachedAt": now_ts,
            "sizeBytes": len(raw_bytes),
            "data": data,
        }
        return data
    except Exception:
        return None

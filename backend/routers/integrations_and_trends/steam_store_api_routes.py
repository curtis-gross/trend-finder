import asyncio
import json
import re
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

STEAM_STORE_SEARCH_URL = "https://store.steampowered.com/api/storesearch/"
STEAM_APP_REVIEWS_URL = "https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/"
_STEAM_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "TrendFinder/1.0",
}
_FILTER_ENUM_MAP = {
    "all": 0,
    "helpful": 0,
    "recent": 1,
    "updated": 2,
}
_MAX_SEARCH_ENRICH = 8
_MAX_REVIEWS_CAP = 300
_STEAM_PAGE_SIZE = 100
_MAX_REVIEW_PAGES = 10


def _extract_steam_app_id(raw: Optional[str]) -> Optional[str]:
    if not raw or not isinstance(raw, str):
        return None
    candidate = raw.strip()
    if not candidate:
        return None
    if re.fullmatch(r"\d+", candidate):
        return candidate if int(candidate) > 0 else None
    match = re.search(r"store\.steampowered\.com/app/(\d+)", candidate, flags=re.IGNORECASE)
    if match and match.group(1) and int(match.group(1)) > 0:
        return match.group(1)
    return None


def _map_review_filter(raw_filter: str) -> int:
    cleaned = (raw_filter or "recent").strip().lower()
    if cleaned in _FILTER_ENUM_MAP:
        return _FILTER_ENUM_MAP[cleaned]
    if cleaned.isdigit():
        return int(cleaned)
    return 1


def _unwrap_reviews_response(payload: Any, clean_app_id: str) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=502,
            detail={"error": f"Steam reviews upstream returned invalid payload type for app {clean_app_id}."},
        )
    if "response" in payload:
        inner = payload.get("response")
        if not isinstance(inner, dict) or not inner:
            raise HTTPException(
                status_code=502,
                detail={"error": f"Steam reviews upstream returned empty response for app {clean_app_id}."},
            )
        return inner
    if "success" in payload:
        if payload.get("success") != 1:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": f"Steam reviews upstream returned success={payload.get('success')} for app {clean_app_id}."
                },
            )
        return payload
    raise HTTPException(
        status_code=502,
        detail={"error": f"Steam reviews upstream returned unexpected payload shape for app {clean_app_id}."},
    )


async def _empty_summary() -> Dict[str, Any]:
    return {}


async def _fetch_query_summary(client: httpx.AsyncClient, app_id: Any) -> Dict[str, Any]:
    try:
        app_id_int = int(app_id)
    except (TypeError, ValueError):
        return {}
    if app_id_int <= 0:
        return {}

    input_payload = {
        "appid": app_id_int,
        "languages": ["all"],
        "purchase_type": 0,
        "num_per_page": 1,
    }
    try:
        resp = await client.get(
            STEAM_APP_REVIEWS_URL,
            params={"input_json": json.dumps(input_payload, separators=(",", ":"))},
        )
        if not resp.is_success:
            return {}
        payload = resp.json()
    except Exception:
        return {}

    if not isinstance(payload, dict):
        return {}
    if isinstance(payload.get("response"), dict):
        inner = payload["response"]
    elif payload.get("success") == 1:
        inner = payload
    else:
        return {}

    qs = inner.get("query_summary")
    if not isinstance(qs, dict):
        return {}

    enriched: Dict[str, Any] = {}
    for key in ("review_score_desc", "total_reviews", "total_positive", "total_negative"):
        if key in qs and qs[key] is not None:
            enriched[key] = qs[key]
    return enriched


@router.get("/api/steam/search")
async def steam_search(
    term: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    cc: str = Query("US"),
    l: str = Query("english"),
) -> List[Dict[str, Any]]:
    search_term = (term or q or query or "").strip()
    if not search_term:
        raise HTTPException(
            status_code=400,
            detail={"error": "Query parameter 'term' (or 'q'/'query') is required."},
        )

    try:
        async with httpx.AsyncClient(
            timeout=12.0,
            follow_redirects=True,
            headers=_STEAM_HEADERS,
        ) as client:
            try:
                resp = await client.get(
                    STEAM_STORE_SEARCH_URL,
                    params={"term": search_term, "l": l, "cc": cc},
                )
            except httpx.HTTPError as exc:
                raise HTTPException(
                    status_code=502,
                    detail={"error": f"Steam store search request failed: {type(exc).__name__}: {exc}"},
                )

            if not resp.is_success:
                raise HTTPException(
                    status_code=502,
                    detail={"error": f"Steam store search upstream returned HTTP {resp.status_code}."},
                )

            try:
                payload = resp.json()
            except ValueError as exc:
                raise HTTPException(
                    status_code=502,
                    detail={"error": f"Steam store search returned invalid JSON: {exc}"},
                )

            raw_items = payload.get("items") if isinstance(payload, dict) else None
            top_items = [it for it in (raw_items or []) if isinstance(it, dict)][:_MAX_SEARCH_ENRICH]
            if not top_items:
                return []

            summaries = await asyncio.gather(
                *[
                    _fetch_query_summary(client, item.get("id"))
                    if item.get("id") is not None
                    else _empty_summary()
                    for item in top_items
                ]
            )
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": f"Steam store search failed: {type(exc).__name__}: {exc}"},
        )

    results: List[Dict[str, Any]] = []
    for item, summary in zip(top_items, summaries):
        entry: Dict[str, Any] = {
            "id": item.get("id"),
            "name": item.get("name") or "",
            "tiny_image": item.get("tiny_image") or "",
            "price": item.get("price"),
            "metascore": item.get("metascore"),
        }
        if summary:
            entry.update(summary)
        results.append(entry)
    return results


def _normalize_steam_review(raw: Dict[str, Any], clean_app_id: str, fallback_idx: int) -> Dict[str, Any]:
    rec_id = str(raw.get("recommendationid") or raw.get("id") or f"{clean_app_id}-{fallback_idx}")
    review_text = str(raw.get("review") or raw.get("content") or "")
    author_obj = raw.get("author") if isinstance(raw.get("author"), dict) else {}
    return {
        "id": rec_id,
        "recommendationid": rec_id,
        "review": review_text,
        "content": review_text,
        "voted_up": bool(raw.get("voted_up")),
        "votes_up": int(raw.get("votes_up") or 0),
        "votes_funny": int(raw.get("votes_funny") or 0),
        "timestamp_created": raw.get("timestamp_created"),
        "weighted_vote_score": raw.get("weighted_vote_score"),
        "language": raw.get("language") or "",
        "author": author_obj,
    }


@router.get("/api/steam/reviews")
async def steam_reviews(
    appId: Optional[str] = Query(None),
    app_id: Optional[str] = Query(None),
    maxReviews: int = Query(100, ge=1),
    day_range: Optional[int] = Query(None),
    filter_mode: str = Query("recent", alias="filter"),
    language: str = Query("all"),
) -> List[Dict[str, Any]]:
    clean_app_id = _extract_steam_app_id(appId or app_id)
    if not clean_app_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "A valid numeric 'appId' (or store.steampowered.com/app/<id> URL) is required."},
        )

    app_id_int = int(clean_app_id)
    target_max = max(1, min(int(maxReviews), _MAX_REVIEWS_CAP))
    filter_enum = _map_review_filter(filter_mode)
    clean_language = (language or "all").strip() or "all"

    reviews: List[Dict[str, Any]] = []
    seen_review_ids = set()
    seen_cursors = set()
    cursor = "*"

    async with httpx.AsyncClient(
        timeout=12.0,
        follow_redirects=True,
        headers=_STEAM_HEADERS,
    ) as client:
        for _ in range(_MAX_REVIEW_PAGES):
            if len(reviews) >= target_max:
                break

            input_payload: Dict[str, Any] = {
                "appid": app_id_int,
                "filter": filter_enum,
                "languages": [clean_language],
                "review_type": 0,
                "purchase_type": 0,
                "num_per_page": _STEAM_PAGE_SIZE,
                "cursor": cursor,
            }
            if day_range is not None and day_range > 0:
                input_payload["day_range"] = int(day_range)

            try:
                resp = await client.get(
                    STEAM_APP_REVIEWS_URL,
                    params={"input_json": json.dumps(input_payload, separators=(",", ":"))},
                )
            except httpx.HTTPError as exc:
                raise HTTPException(
                    status_code=502,
                    detail={"error": f"Steam reviews request failed for app {clean_app_id}: {type(exc).__name__}: {exc}"},
                )

            if not resp.is_success:
                raise HTTPException(
                    status_code=502,
                    detail={"error": f"Steam reviews upstream returned HTTP {resp.status_code} for app {clean_app_id}."},
                )

            try:
                payload = resp.json()
            except ValueError as exc:
                raise HTTPException(
                    status_code=502,
                    detail={"error": f"Steam reviews returned invalid JSON for app {clean_app_id}: {exc}"},
                )

            inner = _unwrap_reviews_response(payload, clean_app_id)
            batch = inner.get("reviews")
            if not isinstance(batch, list) or not batch:
                break

            for raw_item in batch:
                if not isinstance(raw_item, dict):
                    continue
                normalized = _normalize_steam_review(raw_item, clean_app_id, len(reviews))
                rec_id = normalized["recommendationid"]
                if rec_id in seen_review_ids:
                    continue
                seen_review_ids.add(rec_id)
                reviews.append(normalized)
                if len(reviews) >= target_max:
                    break

            seen_cursors.add(cursor)
            next_cursor = inner.get("cursor")
            if not next_cursor or not isinstance(next_cursor, str) or next_cursor in seen_cursors:
                break
            cursor = next_cursor

    return reviews[:target_max]

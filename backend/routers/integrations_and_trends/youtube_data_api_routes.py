import json
import os
import re
import time
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response

from backend.core import YouTubeKeyMissingError

router = APIRouter()

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
YOUTUBE_UNIT_COST = {"search": 100, "videos": 1, "commentThreads": 1}
YOUTUBE_SHORT_MAX_SECONDS = 60
YOUTUBE_COMMENT_PAGE_SIZE = 100
YOUTUBE_COMMENT_MAX_PAGES = 10


def resolve_youtube_api_key(request: Optional[Request] = None) -> str:
    if request:
        headers = getattr(request, "headers", {})
        header_key = (
            headers.get("x-youtube-api-key")
            or headers.get("x-goog-api-key")
            or headers.get("x-api-key")
        )
        if header_key and isinstance(header_key, str) and header_key.strip():
            k = header_key.strip().replace('"', "").replace("'", "")
            if k:
                return k

    env_candidate = (
        os.environ.get("YOUTUBE_API_KEY")
        or os.environ.get("VITE_YOUTUBE_API_KEY")
        or os.environ.get("GOOGLE_CLOUD_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("API_KEY")
        or ""
    )
    key = env_candidate.strip().replace('"', "").replace("'", "")
    if key:
        return key

    try:
        from backend.core import get_youtube_api_key as core_get_key
        return core_get_key()
    except YouTubeKeyMissingError as exc:
        raise HTTPException(status_code=500, detail={"error": str(exc)})


async def youtube_api_get(
    client: httpx.AsyncClient,
    resource: str,
    params: Dict[str, Any],
    units: List[int],
) -> Dict[str, Any]:
    params = {k: v for k, v in params.items() if v is not None and v != ""}
    params["key"] = resolve_youtube_api_key()
    units.append(YOUTUBE_UNIT_COST.get(resource, 1))
    try:
        resp = await client.get(f"{YOUTUBE_API_BASE}/{resource}", params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": f"YouTube {resource} network failure: {type(exc).__name__}: {exc}"},
        )
    if not resp.is_success:
        try:
            body: Any = resp.json()
        except Exception:
            body = {"error": resp.text}
        print(f"[youtube] {resource} HTTP {resp.status_code}: {json.dumps(body)[:400]}")
        raise HTTPException(status_code=resp.status_code, detail=body)
    return resp.json()


def parse_iso_duration_seconds(duration: Optional[str]) -> int:
    if not duration:
        return 0
    m = re.match(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration)
    if not m:
        return 0
    days, hours, minutes, seconds = (int(x or 0) for x in m.groups())
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def format_view_count(views: Any) -> str:
    if views is None:
        return "0"
    try:
        n = int(views)
        if n >= 1_000_000:
            return f"{n / 1_000_000:.1f}M"
        if n >= 1_000:
            return f"{n / 1_000:.1f}K"
        return str(n)
    except Exception:
        return str(views)


def normalize_youtube_video(item: Dict[str, Any]) -> Dict[str, Any]:
    v_id = item.get("id") if isinstance(item.get("id"), str) else (item.get("id") or {}).get("videoId")
    snippet = item.get("snippet", {}) or {}
    stats = item.get("statistics", {}) or {}
    details = item.get("contentDetails", {}) or {}
    status = item.get("status", {}) or {}
    duration_iso = details.get("duration") or ""
    duration_seconds = parse_iso_duration_seconds(duration_iso)
    title = snippet.get("title") or ""
    is_short = bool(duration_seconds and duration_seconds <= YOUTUBE_SHORT_MAX_SECONDS) or "#shorts" in title.lower()
    thumbs = snippet.get("thumbnails", {}) or {}
    thumbnail = (
        (thumbs.get("high") or {}).get("url")
        or (thumbs.get("medium") or {}).get("url")
        or (thumbs.get("default") or {}).get("url")
        or ""
    )
    url = f"https://www.youtube.com/shorts/{v_id}" if is_short else f"https://www.youtube.com/watch?v={v_id}"
    view_count = str(stats.get("viewCount", "0"))
    return {
        "videoId": v_id, "title": title, "description": snippet.get("description") or "",
        "channelTitle": snippet.get("channelTitle") or "", "publishedAt": snippet.get("publishedAt") or "",
        "thumbnail": thumbnail, "viewCount": view_count, "views": format_view_count(view_count),
        "likeCount": str(stats.get("likeCount", "0")), "commentCount": str(stats.get("commentCount", "0")),
        "duration": duration_iso, "durationSeconds": duration_seconds, "isShort": is_short,
        "url": url, "videoUrl": url, "embeddable": bool(status.get("embeddable", True)),
        "commentsEnabled": "commentCount" in stats,
    }


def is_valid_youtube_video(item: Dict[str, Any]) -> bool:
    status = item.get("status", {}) or {}
    stats = item.get("statistics", {}) or {}
    if status.get("privacyStatus") != "public" or status.get("embeddable", True) is not True or "commentCount" not in stats:
        return False
    try:
        return int(stats.get("commentCount", 0)) > 0
    except (ValueError, TypeError):
        return False


async def run_youtube_search(
    search_query: str,
    max_results: int,
    order: str,
    published_after: Optional[str],
    region_code: Optional[str],
) -> Dict[str, Any]:
    max_results = max(1, min(int(max_results or 20), 25))
    if order not in ("relevance", "viewCount", "date", "rating", "title"):
        order = "relevance"
    units: List[int] = []
    t0 = time.perf_counter()

    async with httpx.AsyncClient(timeout=15.0) as client:
        base_params = {
            "part": "snippet", "type": "video", "videoEmbeddable": "true",
            "q": search_query, "order": order, "maxResults": max_results,
            "publishedAfter": published_after, "regionCode": region_code,
        }
        search_data = await youtube_api_get(client, "search", base_params, units)
        ids = [(it.get("id") or {}).get("videoId") for it in search_data.get("items", []) if (it.get("id") or {}).get("videoId")]
        videos: List[Dict[str, Any]] = []
        if ids:
            details = await youtube_api_get(
                client, "videos",
                {"part": "snippet,statistics,contentDetails,status", "id": ",".join(ids[:50]), "maxResults": 50},
                units,
            )
            by_id = {it.get("id"): it for it in details.get("items", [])}
            videos = [normalize_youtube_video(by_id[i]) for i in ids if i in by_id and is_valid_youtube_video(by_id[i])]

    total_units = sum(units)
    print(f"[youtube] search q={search_query!r} order={order} results={len(videos)} units={total_units} ({len(units)} calls) {int((time.perf_counter() - t0) * 1000)}ms")
    return {
        "query": search_query,
        "trending": [v for v in videos if not v["isShort"]],
        "topYear": [],
        "shorts": [v for v in videos if v["isShort"]],
        "videos": videos,
        "totalResults": len(videos),
        "quotaUnits": total_units,
        "apiCalls": len(units),
    }


@router.get("/api/youtube/search")
async def youtube_search(
    q: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    term: Optional[str] = Query(None),
    maxResults: int = Query(20, ge=1, le=25),
    order: str = Query("relevance"),
    publishedAfter: Optional[str] = Query(None),
    regionCode: Optional[str] = Query(None),
):
    search_query = (q or query or term or "").strip()
    if not search_query:
        raise HTTPException(status_code=400, detail={"error": "Query parameter 'q' is required"})
    return await run_youtube_search(search_query, maxResults, order, publishedAfter, regionCode)


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail={"error": f"publishedAfter must be ISO 8601 (e.g. 2026-09-17T00:00:00Z), got {value!r}"})


@router.get("/api/youtube/comments")
async def youtube_comments(
    response: Response,
    videoId: str = Query(..., min_length=11, max_length=11),
    maxResults: int = Query(100, ge=1, le=1000),
    order: str = Query("time"),
    publishedAfter: Optional[str] = Query(None),
    allowBackfill: bool = Query(False),
):
    if order not in ("time", "relevance"):
        order = "time"
    cutoff = _parse_iso_datetime(publishedAfter)
    units: List[int] = []
    t0 = time.perf_counter()
    comments: List[Dict[str, Any]] = []
    recent_count, backfill_count, pages = 0, 0, 0

    async with httpx.AsyncClient(timeout=15.0) as client:
        meta = await youtube_api_get(client, "videos", {"part": "snippet,statistics", "id": videoId}, units)
        meta_items = meta.get("items", [])
        if not meta_items:
            raise HTTPException(status_code=404, detail={"error": f"Video {videoId} not found (private, deleted, or invalid id)."})
        video_title = (meta_items[0].get("snippet") or {}).get("title") or ""
        total_video_comments = str((meta_items[0].get("statistics") or {}).get("commentCount", "0"))

        page_token: Optional[str] = None
        while len(comments) < maxResults and pages < YOUTUBE_COMMENT_MAX_PAGES:
            page_size = min(YOUTUBE_COMMENT_PAGE_SIZE, maxResults - len(comments))
            data = await youtube_api_get(
                client, "commentThreads",
                {"part": "snippet", "videoId": videoId, "maxResults": page_size, "order": order, "textFormat": "plainText", "pageToken": page_token},
                units,
            )
            pages += 1
            items = data.get("items", [])
            page_all_old = bool(items)
            for item in items:
                top = ((item.get("snippet") or {}).get("topLevelComment") or {}).get("snippet") or {}
                published = top.get("publishedAt")
                is_old = False
                if cutoff:
                    published_dt = _parse_iso_datetime(published) if published else None
                    is_old = bool(published_dt and published_dt < cutoff)
                if not is_old:
                    page_all_old = False
                if is_old and not allowBackfill:
                    continue
                if is_old:
                    backfill_count += 1
                else:
                    recent_count += 1
                comments.append({
                    "id": item.get("id"), "author": top.get("authorDisplayName"),
                    "text": top.get("textDisplay") or top.get("textOriginal") or "",
                    "likeCount": top.get("likeCount", 0), "publishedAt": published,
                    "replyCount": (item.get("snippet") or {}).get("totalReplyCount", 0),
                    "isHistoricalBackfill": is_old,
                })
                if len(comments) >= maxResults:
                    break
            page_token = data.get("nextPageToken")
            if not page_token or (cutoff and order == "time" and page_all_old and not allowBackfill):
                break

    total_units = sum(units)
    print(f"[youtube] comments videoId={videoId} harvested={len(comments)} recent={recent_count} backfill={backfill_count} pages={pages} units={total_units} {int((time.perf_counter() - t0) * 1000)}ms")
    response.headers["x-total-video-comments"] = total_video_comments
    response.headers["x-video-title"] = urllib.parse.quote(video_title)
    response.headers["x-recent-count"] = str(recent_count)
    response.headers["x-backfill-count"] = str(backfill_count)
    response.headers["x-quota-units"] = str(total_units)
    response.headers["Access-Control-Expose-Headers"] = "x-total-video-comments, x-video-title, x-recent-count, x-backfill-count, x-quota-units"
    return {
        "videoId": videoId, "videoTitle": video_title, "totalVideoComments": total_video_comments,
        "comments": comments, "recentCount": recent_count, "backfillCount": backfill_count, "quotaUnits": total_units,
    }


@router.get("/api/youtube/video-details")
async def youtube_video_details(videoId: str = Query(..., min_length=11, max_length=11)):
    units: List[int] = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        data = await youtube_api_get(client, "videos", {"part": "snippet,statistics,contentDetails,status", "id": videoId}, units)
    items = data.get("items", [])
    if not items:
        raise HTTPException(status_code=404, detail={"error": f"Video {videoId} not found."})
    return {"video": items[0], "normalized": normalize_youtube_video(items[0]), "quotaUnits": sum(units)}

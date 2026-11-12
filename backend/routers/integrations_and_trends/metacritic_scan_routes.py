import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from backend.core import (
    ROOT_DIR,
    gcs_upload_json_async,
    get_active_company_name,
    get_gcs_bucket_name,
    get_storage_client,
    sanitize_company_name,
)
from backend.routers.integrations_and_trends import metacritic_scraper_and_jsonld as _mc_scraper
from backend.routers.integrations_and_trends.metacritic_analysis_builder import (
    _build_deep_metacritic_analysis,
)
from backend.routers.integrations_and_trends.metacritic_scraper_and_jsonld import (
    _METACRITIC_MEMORY_CACHE,
    _extract_metacritic_target,
    _fetch_metacritic_slug_data,
    _sanitize_mc_id,
)

router = APIRouter()


async def _persist_metacritic_analysis(
    company_name: str,
    slug: str,
    raw_url: str,
    canonical_url: str,
    requested_analysis_id: Optional[str],
    payload: Dict[str, Any],
) -> None:
    active_company = sanitize_company_name(company_name or get_active_company_name())
    clean_no_slash = canonical_url.rstrip("/")
    raw_ids = [
        _sanitize_mc_id(requested_analysis_id) if requested_analysis_id else None,
        f"metacritic_{_sanitize_mc_id(slug)}",
        f"metacritic_reviews_{_sanitize_mc_id(slug)}",
        _sanitize_mc_id(canonical_url),
        _sanitize_mc_id(clean_no_slash),
        _sanitize_mc_id(f"{clean_no_slash}/critic-reviews/"),
        _sanitize_mc_id(f"{clean_no_slash}/user-reviews/"),
        _sanitize_mc_id(raw_url) if raw_url else None,
        f"ad_analysis_{_sanitize_mc_id(canonical_url)}",
    ]
    candidate_ids = list(dict.fromkeys([cid for cid in raw_ids if cid]))
    data_str = json.dumps(payload, indent=2)

    try:
        local_dir = ROOT_DIR / "public" / "data" / "configuration" / "analyses" / active_company
        local_dir.mkdir(parents=True, exist_ok=True)
        for cid in candidate_ids:
            (local_dir / f"{cid}.json").write_text(data_str, encoding="utf-8")

        runs_dir = ROOT_DIR / "public" / "data" / "configuration" / "runs" / active_company
        runs_dir.mkdir(parents=True, exist_ok=True)
        (runs_dir / f"metacritic_{_sanitize_mc_id(slug)}.json").write_text(data_str, encoding="utf-8")
        (runs_dir / f"metacritic_{_sanitize_mc_id(slug)}_run.json").write_text(data_str, encoding="utf-8")
        (runs_dir / "metacritic_scan_run.json").write_text(data_str, encoding="utf-8")
    except Exception as local_err:
        print(f"[Metacritic Local Save Warning]: {local_err}")

    sc = get_storage_client()
    bucket_name = get_gcs_bucket_name()
    if sc and bucket_name:
        blob_paths = [f"{active_company}/analyses/{cid}.json" for cid in candidate_ids] + [
            f"{active_company}/runs/metacritic_{_sanitize_mc_id(slug)}_run.json",
            f"{active_company}/runs/metacritic_scan_run.json",
        ]
        gcs_upload_json_async(blob_paths, payload, bucket_name=bucket_name)


def _derive_sentiment_label(score_100: Optional[float]) -> Optional[str]:
    if score_100 is None:
        return None
    if score_100 >= 75:
        return "Generally favorable"
    if score_100 >= 50:
        return "Mixed or average"
    return "Generally unfavorable"


async def _generate_and_persist_metacritic_analysis(
    raw_url_or_id: str,
    company_name: str = "test-company",
    requested_analysis_id: Optional[str] = None,
) -> Dict[str, Any]:
    target = _extract_metacritic_target(raw_url_or_id)
    slug = target["slug"]
    category = target["category"]
    direct_url = target["directUrl"]
    if not slug:
        raise HTTPException(
            status_code=400,
            detail="Explicit review URL or product slug is required (e.g. https://www.metacritic.com/movie/<slug>/ or product review URL).",
        )
    _mc_scraper._LAST_METACRITIC_SLUG = slug
    cache_key = direct_url or f"{category}:{slug}"

    cached = _METACRITIC_MEMORY_CACHE.get(cache_key)
    if cached and (time.time() - float(cached.get("ts") or 0)) < 300.0:
        enriched = {**cached["payload"], "analysisId": requested_analysis_id or cached["payload"].get("analysisId")}
        await _persist_metacritic_analysis(
            company_name, slug, raw_url_or_id,
            str(enriched.get("url") or direct_url or f"https://www.metacritic.com/{category}/{slug}/"),
            requested_analysis_id, enriched,
        )
        return enriched

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    primary_data = await _fetch_metacritic_slug_data(slug, headers, category=category, direct_url=direct_url or None)
    if not primary_data["pageOk"] and not primary_data["userItems"] and not primary_data["criticItems"]:
        raise HTTPException(
            status_code=int(primary_data.get("pageStatus") or 502),
            detail=f"Review page fetch failed for '{slug}' (HTTP {primary_data.get('pageStatus') or 502}).",
        )

    ld = primary_data["parsedLd"] or {
        "scriptsCount": 0, "rawJsonLd": {}, "schemaType": "Product",
        "name": slug.replace("-", " ").title(), "description": "", "releaseDate": "", "contentRating": "",
        "publisher": company_name or "test-company", "genres": [], "platforms": ["Web"],
        "image": "", "metascore": None, "metascoreCount": 0, "embeddedReviews": [],
    }

    user_stats = primary_data["userStats"]
    critic_stats = primary_data["criticStats"]
    primary_title_label = ld.get("name") or slug.replace("-", " ").title()
    normalized_reviews: List[Dict[str, Any]] = []
    seen_quotes = set()

    def _push_dedup(rev_obj: Dict[str, Any]) -> None:
        key = f"{rev_obj.get('reviewType')}_{str(rev_obj.get('text') or '')[:120].lower()}"
        if key not in seen_quotes:
            seen_quotes.add(key)
            normalized_reviews.append(rev_obj)

    for emb in ld.get("embeddedReviews") or []:
        _push_dedup({
            **emb, "type": emb.get("reviewType") or "json-ld",
            "subpageUrl": emb.get("subpageUrl") or primary_data["mainPageUrl"],
            "sourceUrl": emb.get("subpageUrl") or primary_data["canonicalUrl"],
            "subjectTitle": primary_title_label, "productTitle": primary_title_label,
        })

    for i, item in enumerate(primary_data["criticItems"]):
        quote_txt = str(item.get("quote") or "").strip()
        if not quote_txt:
            continue
        score = float(item["score"]) if item.get("score") is not None else None
        pub_name = item.get("publicationName") or item.get("author") or "Metacritic Critic"
        author_label = f"{item['publicationName']} ({item['author']})" if item.get("author") and item.get("publicationName") else pub_name
        _push_dedup({
            "id": f"mc_critic_{slug}_{i}_{item.get('date') or 'na'}",
            "author": author_label, "text": quote_txt, "quote": quote_txt,
            "score": score, "maxScore": 100, "reviewType": "critic", "type": "critic",
            "date": item.get("date"), "platform": item.get("platform") or (ld.get("platforms") or ["Web"])[0],
            "publicationName": pub_name, "subpageUrl": primary_data["criticReviewsUrl"],
            "source": "Metacritic", "sourceUrl": item.get("url") or primary_data["criticReviewsUrl"],
            "subjectTitle": primary_title_label, "productTitle": primary_title_label,
            "sentiment": ("positive" if score >= 75 else ("neutral" if score >= 50 else "negative")) if score is not None else "neutral",
        })

    for i, item in enumerate(primary_data["userItems"]):
        quote_txt = str(item.get("quote") or "").strip()
        if not quote_txt:
            continue
        score = float(item["score"]) if item.get("score") is not None else None
        _push_dedup({
            "id": f"mc_user_{item['id']}" if item.get("id") else f"mc_user_{slug}_{i}",
            "author": item.get("author") or "Metacritic User", "text": quote_txt, "quote": quote_txt,
            "score": score, "maxScore": 10, "reviewType": "user", "type": "user",
            "date": item.get("date"), "platform": item.get("platform") or (ld.get("platforms") or ["Web"])[0],
            "publicationName": None, "thumbsUp": item.get("thumbsUp") or 0, "thumbsDown": item.get("thumbsDown") or 0,
            "subpageUrl": primary_data["userReviewsUrl"], "source": "Metacritic", "sourceUrl": primary_data["userReviewsUrl"],
            "subjectTitle": primary_title_label, "productTitle": primary_title_label,
            "sentiment": ("positive" if score >= 7 else ("neutral" if score >= 4 else "negative")) if score is not None else "neutral",
        })

    critic_final_count = sum(1 for r in normalized_reviews if r.get("reviewType") == "critic")
    user_final_count = sum(1 for r in normalized_reviews if r.get("reviewType") == "user")
    jsonld_final_count = sum(1 for r in normalized_reviews if r.get("reviewType") == "json-ld")

    critic_scores = [float(r["score"]) for r in normalized_reviews if r.get("reviewType") == "critic" and isinstance(r.get("score"), (int, float))]
    user_scores = [float(r["score"]) for r in normalized_reviews if r.get("reviewType") == "user" and isinstance(r.get("score"), (int, float))]

    resolved_metascore: Optional[float] = (
        ld["metascore"] if ld.get("metascore") is not None
        else (
            float(critic_stats["score"]) if isinstance(critic_stats, dict) and critic_stats.get("score") is not None
            else (round(sum(critic_scores) / len(critic_scores), 1) if critic_scores else None)
        )
    )
    resolved_metascore_count = max(int(ld.get("metascoreCount") or 0), int((critic_stats or {}).get("reviewCount") or 0), critic_final_count)
    resolved_user_score: Optional[float] = (
        float(user_stats["score"]) if isinstance(user_stats, dict) and user_stats.get("score") is not None
        else (round(sum(user_scores) / len(user_scores), 1) if user_scores else None)
    )
    resolved_user_score_count = max(int((user_stats or {}).get("reviewCount") or 0), user_final_count)

    if not normalized_reviews and resolved_metascore is None and resolved_user_score is None and not ld.get("description"):
        raise HTTPException(
            status_code=404,
            detail=f"No structured Schema.org JSON-LD review metadata or reviews found for '{slug}'.",
        )

    crawled_pages = {
        "mainUrl": primary_data["mainPageUrl"], "criticReviewsUrl": primary_data["criticReviewsUrl"],
        "userReviewsUrl": primary_data["userReviewsUrl"], "criticReviewsTotal": critic_final_count,
        "userReviewsTotal": user_final_count, "jsonLdReviewsTotal": jsonld_final_count, "totalReviews": len(normalized_reviews),
    }

    schema_type = ld.get("schemaType") or "Product"
    json_ld_metadata = {
        "@context": "https://schema.org", "@type": schema_type,
        "schemaType": schema_type, "name": primary_title_label,
        "description": ld.get("description") or "", "releaseDate": ld.get("releaseDate") or "",
        "datePublished": ld.get("releaseDate") or "", "contentRating": ld.get("contentRating") or "",
        "publisher": ld.get("publisher") or "", "genres": ld.get("genres") or [],
        "platforms": ld.get("platforms") or [],
        "image": ld.get("image") or "", "metascore": resolved_metascore, "metascoreCount": resolved_metascore_count,
        "criticSentiment": (critic_stats or {}).get("sentiment") or _derive_sentiment_label(resolved_metascore),
        "userScore": resolved_user_score, "userScoreCount": resolved_user_score_count,
        "userSentiment": (user_stats or {}).get("sentiment") or _derive_sentiment_label(resolved_user_score * 10.0 if resolved_user_score is not None else None),
        "aggregateRating": {
            "@type": "AggregateRating", "ratingValue": resolved_metascore, "bestRating": 100, "worstRating": 0,
            "reviewCount": resolved_metascore_count, "ratingCount": resolved_user_score_count,
        },
        "jsonLdScriptsCount": ld.get("scriptsCount") or 0, "fallbackBaselineUsed": None,
        "crawledPages": crawled_pages, "rawJsonLd": ld.get("rawJsonLd") or {},
    }

    deep_analysis = _build_deep_metacritic_analysis(
        slug=slug, canonical_url=primary_data["canonicalUrl"], json_ld_metadata=json_ld_metadata,
        normalized_reviews=normalized_reviews, critic_stats=critic_stats, user_stats=user_stats,
    )

    scanned_at = datetime.now(timezone.utc).isoformat()
    resolved_analysis_id = requested_analysis_id or f"metacritic_{_sanitize_mc_id(slug)}"
    full_payload = {
        "status": "success", "analysisId": resolved_analysis_id, "id": resolved_analysis_id,
        "type": "metacritic_reviews", "source": "Metacritic" if "metacritic" in primary_data["canonicalUrl"].lower() else "Web Reviews",
        "title": f"{json_ld_metadata['name']} — Structured JSON-LD & Review Intelligence ({len(normalized_reviews)} Reviews)",
        "url": primary_data["canonicalUrl"], "slug": slug, "scannedAt": scanned_at, "timestamp": scanned_at,
        "crawledPages": crawled_pages, "jsonLdMetadata": json_ld_metadata, "reviews": normalized_reviews,
        **deep_analysis,
    }

    _METACRITIC_MEMORY_CACHE[cache_key] = {"ts": time.time(), "payload": full_payload}
    await _persist_metacritic_analysis(company_name, slug, raw_url_or_id, primary_data["canonicalUrl"], resolved_analysis_id, full_payload)
    return full_payload


@router.post("/api/metacritic/scan")
@router.get("/api/metacritic/scan")
async def handle_metacritic_scan(
    request: Request,
    url: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    companyName: Optional[str] = Query(None),
    analysisId: Optional[str] = Query(None),
):
    body: Dict[str, Any] = {}
    if request.method == "POST":
        try:
            parsed_body = await request.json()
            if isinstance(parsed_body, dict):
                body = parsed_body
        except Exception:
            body = {}

    raw_url = str(body.get("url") or body.get("query") or url or query or "").strip()
    resolved_company = str(body.get("companyName") or companyName or get_active_company_name() or "test-company").strip()
    requested_analysis_id = body.get("analysisId") or analysisId

    if not _extract_metacritic_target(raw_url)["slug"]:
        return JSONResponse(
            status_code=400,
            content={"error": "Explicit review URL or product slug is required (e.g. https://www.metacritic.com/movie/<slug>/ or product review URL).", "status": "error"},
        )

    try:
        return await _generate_and_persist_metacritic_analysis(
            raw_url_or_id=raw_url, company_name=resolved_company, requested_analysis_id=requested_analysis_id
        )
    except HTTPException as http_exc:
        return JSONResponse(status_code=http_exc.status_code, content={"error": f"Structured review scan failed: {http_exc.detail}", "status": "error"})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": f"Structured review scan failed: {str(exc)}", "status": "error"})

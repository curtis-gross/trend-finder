import json
import re
import urllib.parse
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

_TRUSTPILOT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _extract_trustpilot_domain(domain: Optional[str], url: Optional[str]) -> str:
    raw = (domain or "").strip()
    if not raw and url:
        candidate = url.strip()
        m = re.search(r"trustpilot\.com/review/([^/?#]+)", candidate, flags=re.IGNORECASE)
        if m and m.group(1):
            raw = m.group(1)
        else:
            parsed = urllib.parse.urlparse(candidate if "://" in candidate else f"https://{candidate}")
            raw = parsed.netloc or parsed.path.split("/")[0]
    raw = re.sub(r"^https?://", "", raw, flags=re.IGNORECASE)
    raw = raw.split("/")[0].split("?")[0].split("#")[0].split(":")[0].strip().lower()
    if raw.startswith("www."):
        raw = raw[4:]
    if not raw or not re.match(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+$", raw):
        raise HTTPException(
            status_code=400,
            detail={"error": "A valid 'domain' (or Trustpilot 'url') query parameter is required."},
        )
    return raw


def _parse_json_ld_nodes(html: str) -> List[Dict[str, Any]]:
    nodes: List[Dict[str, Any]] = []
    for match in re.finditer(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
        html,
        flags=re.IGNORECASE,
    ):
        raw_json = (match.group(1) or "").strip()
        if not raw_json:
            continue
        try:
            parsed = json.loads(raw_json)
        except Exception:
            continue
        items = parsed if isinstance(parsed, list) else [parsed]
        for item in items:
            if not isinstance(item, dict):
                continue
            graph = item.get("@graph")
            if isinstance(graph, list):
                nodes.extend([g for g in graph if isinstance(g, dict)])
            else:
                nodes.append(item)
    return nodes


def _parse_trustpilot_html(html: str, clean_domain: str, limit: int = 50) -> Optional[Dict[str, Any]]:
    next_data: Dict[str, Any] = {}
    nd_match = re.search(
        r'<script[^>]*id=["\']__NEXT_DATA__["\'][^>]*>([\s\S]*?)</script>',
        html,
        flags=re.IGNORECASE,
    )
    if nd_match and nd_match.group(1):
        try:
            parsed_nd = json.loads(nd_match.group(1).strip())
            if isinstance(parsed_nd, dict):
                next_data = parsed_nd
        except Exception:
            next_data = {}

    page_props = ((next_data.get("props") or {}).get("pageProps") or {}) if isinstance(next_data, dict) else {}
    biz_unit = page_props.get("businessUnit") if isinstance(page_props.get("businessUnit"), dict) else {}
    nd_reviews = page_props.get("reviews") if isinstance(page_props.get("reviews"), list) else []

    ld_nodes = _parse_json_ld_nodes(html)
    ld_org = next(
        (
            n
            for n in ld_nodes
            if n.get("@type") in ("LocalBusiness", "Organization", "Product")
            or isinstance(n.get("aggregateRating"), dict)
        ),
        {},
    )
    ld_agg = ld_org.get("aggregateRating") if isinstance(ld_org.get("aggregateRating"), dict) else {}

    has_structured = bool(biz_unit or nd_reviews or ld_agg or any(n.get("@type") == "Review" for n in ld_nodes))
    if not has_structured:
        return None

    display_name = str(biz_unit.get("displayName") or ld_org.get("name") or clean_domain).strip()
    trust_score_raw = biz_unit.get("trustScore") if biz_unit.get("trustScore") is not None else ld_agg.get("ratingValue")
    try:
        trust_score = float(trust_score_raw) if trust_score_raw is not None else None
    except (TypeError, ValueError):
        trust_score = None

    total_reviews_raw = (
        biz_unit.get("numberOfReviews")
        if biz_unit.get("numberOfReviews") is not None
        else (ld_agg.get("reviewCount") or ld_agg.get("ratingCount"))
    )
    try:
        total_reviews = int(total_reviews_raw) if total_reviews_raw is not None else len(nd_reviews)
    except (TypeError, ValueError):
        total_reviews = len(nd_reviews)

    ratings_stats = ((page_props.get("filters") or {}).get("reviewStatistics") or {}).get("ratings") or {}
    rating_distribution: Dict[str, int] = {}
    if isinstance(ratings_stats, dict) and ratings_stats:
        for key, label in (("five", "5star"), ("four", "4star"), ("three", "3star"), ("two", "2star"), ("one", "1star")):
            if key in ratings_stats:
                try:
                    rating_distribution[label] = int(ratings_stats[key])
                except (TypeError, ValueError):
                    pass

    reviews: List[Dict[str, Any]] = []
    for idx, rev in enumerate(nd_reviews[:limit]):
        if not isinstance(rev, dict):
            continue
        consumer = rev.get("consumer") if isinstance(rev.get("consumer"), dict) else {}
        dates = rev.get("dates") if isinstance(rev.get("dates"), dict) else {}
        reply = rev.get("reply") if isinstance(rev.get("reply"), dict) else {}
        body_text = str(rev.get("text") or "").strip()
        reviews.append(
            {
                "id": rev.get("id") or f"tp-{idx + 1}",
                "author": consumer.get("displayName") or "Verified Reviewer",
                "rating": rev.get("rating"),
                "title": str(rev.get("title") or "").strip(),
                "text": body_text,
                "review": body_text,
                "date": dates.get("publishedDate") or dates.get("experiencedDate") or "",
                "reply": reply.get("message") or "",
            }
        )

    if not reviews:
        ld_reviews: List[Dict[str, Any]] = []
        raw_ld_revs = ld_org.get("review")
        if isinstance(raw_ld_revs, list):
            ld_reviews.extend([r for r in raw_ld_revs if isinstance(r, dict)])
        ld_reviews.extend([n for n in ld_nodes if n.get("@type") == "Review"])
        for idx, rev in enumerate(ld_reviews[:limit]):
            author_obj = rev.get("author")
            author_name = (
                author_obj.get("name")
                if isinstance(author_obj, dict)
                else (str(author_obj) if isinstance(author_obj, str) else None)
            ) or "Verified Reviewer"
            rating_obj = rev.get("reviewRating") if isinstance(rev.get("reviewRating"), dict) else {}
            try:
                rating_val: Optional[float] = float(rating_obj["ratingValue"]) if rating_obj.get("ratingValue") is not None else None
            except (TypeError, ValueError):
                rating_val = None
            body_text = str(rev.get("reviewBody") or "").strip()
            reviews.append(
                {
                    "id": f"tp-ld-{idx + 1}",
                    "author": author_name,
                    "rating": rating_val,
                    "title": str(rev.get("headline") or "").strip(),
                    "text": body_text,
                    "review": body_text,
                    "date": str(rev.get("datePublished") or ""),
                    "reply": "",
                }
            )

    profile_url = f"https://www.trustpilot.com/review/{clean_domain}"
    stars_val = biz_unit.get("stars")
    return {
        "domain": clean_domain,
        "company": display_name,
        "url": profile_url,
        "trustScore": trust_score,
        "totalReviews": total_reviews,
        "ratingDistribution": rating_distribution,
        "business": {
            "domain": clean_domain,
            "name": display_name,
            "trustScore": trust_score,
            "rating": stars_val,
            "reviewCount": total_reviews,
            "logo": biz_unit.get("profileImageUrl") or ld_org.get("image") or "",
        },
        "reviews": reviews,
    }


@router.get("/api/trustpilot/reviews")
async def get_trustpilot(
    domain: Optional[str] = Query(None),
    url: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    clean_domain = _extract_trustpilot_domain(domain, url)
    target_url = f"https://www.trustpilot.com/review/{clean_domain}"

    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=_TRUSTPILOT_HEADERS) as client:
            resp = await client.get(target_url)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": f"Trustpilot upstream request failed for '{clean_domain}': {type(exc).__name__}: {exc}"},
        )

    if resp.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail={"error": f"Trustpilot profile not found for domain '{clean_domain}' (HTTP 404)."},
        )
    if not resp.is_success:
        raise HTTPException(
            status_code=502,
            detail={"error": f"Trustpilot upstream returned HTTP {resp.status_code} for '{clean_domain}'."},
        )

    parsed = _parse_trustpilot_html(resp.text, clean_domain, limit=limit)
    if not parsed:
        raise HTTPException(
            status_code=502,
            detail={"error": f"Trustpilot HTML did not contain parseable __NEXT_DATA__ or JSON-LD for '{clean_domain}'."},
        )
    return parsed

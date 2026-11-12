import asyncio
import json
import re
import urllib.parse
from typing import Any, Dict, List, Optional

import httpx

_LAST_METACRITIC_SLUG: Optional[str] = None
_METACRITIC_MEMORY_CACHE: Dict[str, Dict[str, Any]] = {}

_METACRITIC_API_CATEGORIES = {
    "game": "games", "games": "games",
    "movie": "movies", "movies": "movies",
    "tv": "shows", "show": "shows", "shows": "shows",
    "music": "albums", "album": "albums", "albums": "albums",
}


def _sanitize_mc_id(val: Optional[str]) -> str:
    if not val:
        return "default"
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", str(val).strip())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or "default"


def _extract_metacritic_target(input_url_or_id: Optional[str]) -> Dict[str, str]:
    if not input_url_or_id or not isinstance(input_url_or_id, str):
        return {"slug": "", "category": "product", "directUrl": ""}
    trimmed = input_url_or_id.strip()
    if not trimmed:
        return {"slug": "", "category": "product", "directUrl": ""}

    if re.match(r"^https?://", trimmed, flags=re.IGNORECASE):
        parsed = urllib.parse.urlparse(trimmed)
        host = (parsed.netloc or "").lower()
        if "metacritic." not in host:
            slug_raw = f"{host}{parsed.path}".strip("/")
            slug = re.sub(r"[^a-z0-9-]+", "-", slug_raw.lower()).strip("-") or "review-target"
            return {"slug": slug[:80], "category": "product", "directUrl": trimmed}

    cleaned_path = re.sub(r"/?(?:critic-reviews|user-reviews)/?(\?.*)?$", "", trimmed, flags=re.IGNORECASE)
    cleaned_path = re.sub(r"[-_](?:critic[-_]reviews|user[-_]reviews)[-_]*$", "", cleaned_path, flags=re.IGNORECASE)

    m = re.search(
        r"metacritic(?:\.com|_com)[/_](game|movie|tv|music|product|person|company)[/_]([^/?#_]+)",
        cleaned_path,
        flags=re.IGNORECASE,
    ) or re.match(
        r"^/?(game|movie|tv|music|product)/([^/?#]+)",
        cleaned_path,
        flags=re.IGNORECASE,
    )
    if m and m.group(2):
        cat = m.group(1).lower()
        slug = re.sub(r"[-_](?:critic[-_]reviews|user[-_]reviews)$", "", m.group(2).lower(), flags=re.IGNORECASE)
        return {"slug": slug.rstrip("_").strip(), "category": cat, "directUrl": ""}

    if re.match(r"^metacritic_reviews[-_]\d", cleaned_path, flags=re.IGNORECASE):
        return {"slug": _LAST_METACRITIC_SLUG or "", "category": "product", "directUrl": ""}

    m_san = re.search(r"metacritic_(?:reviews[-_])?([a-z0-9]+-[a-z0-9-]+)", cleaned_path, flags=re.IGNORECASE)
    if (
        m_san
        and m_san.group(1)
        and not re.match(r"^\d", m_san.group(1))
        and not re.match(r"^reviews[-_]", m_san.group(1), flags=re.IGNORECASE)
    ):
        slug = re.sub(r"[-_](?:critic[-_]reviews|user[-_]reviews)$", "", m_san.group(1).lower(), flags=re.IGNORECASE)
        return {"slug": slug.rstrip("_").strip(), "category": "product", "directUrl": ""}

    if re.match(r"^metacritic_reviews[-_]", cleaned_path, flags=re.IGNORECASE):
        return {"slug": _LAST_METACRITIC_SLUG or "", "category": "product", "directUrl": ""}

    if re.match(r"^[a-z0-9-]+$", cleaned_path, flags=re.IGNORECASE):
        return {"slug": cleaned_path.lower(), "category": "product", "directUrl": ""}

    return {"slug": "", "category": "product", "directUrl": ""}


def _parse_metacritic_json_ld(html: str, subpage_url: str = "") -> Dict[str, Any]:
    scripts: List[Dict[str, Any]] = []
    for m in re.finditer(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>', html, flags=re.IGNORECASE):
        raw_block = (m.group(1) or "").strip()
        if not raw_block:
            continue
        try:
            parsed = json.loads(raw_block)
        except Exception:
            continue
        items = parsed if isinstance(parsed, list) else [parsed]
        for item in items:
            if not isinstance(item, dict):
                continue
            graph = item.get("@graph")
            if isinstance(graph, list):
                scripts.extend([x for x in graph if isinstance(x, dict)])
            else:
                scripts.append(item)

    def _extract_meta(prop: str) -> str:
        m1 = re.search(
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']+)["\']',
            html,
            flags=re.IGNORECASE,
        ) or re.search(
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(prop)}["\']',
            html,
            flags=re.IGNORECASE,
        )
        return m1.group(1).strip() if m1 else ""

    preferred_types = (
        "Product", "SoftwareApplication", "Brand", "Organization",
        "CreativeWork", "Movie", "TVSeries", "MusicAlbum",
    )
    primary = next(
        (s for s in scripts if s.get("@type") in preferred_types or s.get("aggregateRating") or s.get("name")),
        scripts[0] if scripts else {},
    )
    agg = primary.get("aggregateRating") if isinstance(primary.get("aggregateRating"), dict) else {}

    pub_raw = primary.get("publisher") or primary.get("brand") or primary.get("creator")
    if isinstance(pub_raw, list):
        publishers = [p if isinstance(p, str) else (p.get("name") if isinstance(p, dict) else None) for p in pub_raw]
        publishers = [str(p) for p in publishers if p]
    elif isinstance(pub_raw, dict) and pub_raw.get("name"):
        publishers = [str(pub_raw["name"])]
    elif isinstance(pub_raw, str) and pub_raw:
        publishers = [pub_raw]
    else:
        publishers = []

    genre_raw = primary.get("genre") or primary.get("category")
    genres = [str(g) for g in genre_raw if g] if isinstance(genre_raw, list) else ([genre_raw] if isinstance(genre_raw, str) and genre_raw else [])

    plat_raw = primary.get("operatingSystem") or primary.get("gamePlatform")
    if isinstance(plat_raw, list):
        platforms = [p if isinstance(p, str) else (p.get("name") if isinstance(p, dict) else None) for p in plat_raw]
        platforms = [str(p) for p in platforms if p]
    elif isinstance(plat_raw, str) and plat_raw:
        platforms = [plat_raw]
    else:
        platforms = []

    embedded_reviews: List[Dict[str, Any]] = []
    for node in scripts:
        rev_raw = node.get("review")
        rev_list = rev_raw if isinstance(rev_raw, list) else ([rev_raw] if isinstance(rev_raw, dict) else [])
        if node.get("@type") == "Review" and not rev_list:
            rev_list = [node]
        for rev in rev_list:
            if not isinstance(rev, dict):
                continue
            body_txt = str(rev.get("reviewBody") or rev.get("description") or "").strip()
            if not body_txt:
                continue
            rating_obj = rev.get("reviewRating") if isinstance(rev.get("reviewRating"), dict) else {}
            try:
                rating_val: Optional[float] = float(rating_obj.get("ratingValue"))
            except Exception:
                rating_val = None
            try:
                best_val = float(rating_obj.get("bestRating") or 100)
            except Exception:
                best_val = 100.0
            author_raw = rev.get("author")
            author_name = (
                author_raw
                if isinstance(author_raw, str)
                else (author_raw.get("name") if isinstance(author_raw, dict) else None)
            ) or "Featured Reviewer"
            pub_obj = rev.get("publisher") if isinstance(rev.get("publisher"), dict) else {}
            sentiment = "neutral"
            if rating_val is not None and best_val > 0:
                ratio = rating_val / best_val
                sentiment = "positive" if ratio >= 0.7 else ("neutral" if ratio >= 0.4 else "negative")
            embedded_reviews.append(
                {
                    "id": f"mc_jsonld_{len(embedded_reviews) + 1}",
                    "author": author_name,
                    "text": body_txt,
                    "score": rating_val,
                    "maxScore": best_val,
                    "reviewType": "json-ld",
                    "type": "json-ld",
                    "date": rev.get("datePublished"),
                    "platform": platforms[0] if platforms else "Web",
                    "publicationName": pub_obj.get("name") or "JSON-LD Schema",
                    "source": "Metacritic" if "metacritic" in (subpage_url or "").lower() else "Web Reviews",
                    "subpageUrl": subpage_url or None,
                    "sentiment": sentiment,
                }
            )

    raw_img = primary.get("image")
    img_url = raw_img if isinstance(raw_img, str) else (raw_img.get("url") if isinstance(raw_img, dict) else "")
    metascore: Optional[float] = None
    if agg.get("ratingValue") is not None:
        try:
            raw_val = float(agg["ratingValue"])
            best_agg = float(agg.get("bestRating") or 100)
            metascore = round((raw_val / best_agg) * 100.0, 1) if best_agg > 0 and best_agg != 100 else raw_val
        except Exception:
            metascore = None
    try:
        metascore_count = int(agg.get("reviewCount") if agg.get("reviewCount") is not None else (agg.get("ratingCount") or 0))
    except Exception:
        metascore_count = 0

    og_title_clean = re.sub(r"\s*-\s*Metacritic.*$", "", _extract_meta("og:title"), flags=re.IGNORECASE)
    return {
        "scriptsCount": len(scripts),
        "rawJsonLd": primary,
        "schemaType": primary.get("@type") or "Product",
        "name": primary.get("name") or og_title_clean or "",
        "description": primary.get("description") or _extract_meta("og:description") or _extract_meta("description") or "",
        "releaseDate": primary.get("datePublished") or primary.get("releaseDate") or primary.get("dateCreated") or "",
        "contentRating": primary.get("contentRating") or "",
        "publisher": ", ".join(publishers),
        "genres": genres,
        "platforms": platforms,
        "image": img_url or _extract_meta("og:image") or "",
        "metascore": metascore,
        "metascoreCount": metascore_count,
        "embeddedReviews": embedded_reviews,
    }


async def _fetch_metacritic_slug_data(
    slug: str,
    headers: Dict[str, str],
    category: str = "product",
    direct_url: Optional[str] = None,
) -> Dict[str, Any]:
    async def _safe_get(client: httpx.AsyncClient, url: str, hdrs: Dict[str, str]):
        try:
            return await client.get(url, headers=hdrs, follow_redirects=True)
        except Exception:
            return None

    if direct_url:
        async with httpx.AsyncClient(timeout=15.0) as client:
            main_res = await _safe_get(client, direct_url, headers)
        main_html = main_res.text if (main_res and main_res.is_success) else ""
        parsed_ld = _parse_metacritic_json_ld(main_html, direct_url) if main_html else None
        return {
            "pageOk": bool(main_res and main_res.is_success),
            "pageStatus": (main_res.status_code if main_res else 502),
            "canonicalUrl": direct_url,
            "mainPageUrl": direct_url,
            "criticReviewsUrl": "",
            "userReviewsUrl": "",
            "parsedLd": parsed_ld,
            "userItems": [],
            "criticItems": [],
            "userStats": None,
            "criticStats": None,
        }

    mc_cat = (category or "product").strip("/").lower()
    main_page_url = f"https://www.metacritic.com/{mc_cat}/{slug}/"
    critic_reviews_url = f"https://www.metacritic.com/{mc_cat}/{slug}/critic-reviews/"
    user_reviews_url = f"https://www.metacritic.com/{mc_cat}/{slug}/user-reviews/"

    api_cat = _METACRITIC_API_CATEGORIES.get(mc_cat)
    critic_offsets = [0, 10, 20, 30, 40, 50] if api_cat else []
    user_offsets = [0, 50] if api_cat else []
    json_headers = {**headers, "Accept": "application/json"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        tasks = [
            _safe_get(client, main_page_url, headers),
            _safe_get(client, critic_reviews_url, headers),
            _safe_get(client, user_reviews_url, headers),
        ]
        if api_cat:
            user_stats_api = f"https://backend.metacritic.com/reviews/metacritic/user/{api_cat}/{slug}/stats/web"
            critic_stats_api = f"https://backend.metacritic.com/reviews/metacritic/critic/{api_cat}/{slug}/stats/web"
            tasks.extend(
                [
                    _safe_get(client, user_stats_api, json_headers),
                    _safe_get(client, critic_stats_api, json_headers),
                    *[
                        _safe_get(
                            client,
                            f"https://backend.metacritic.com/reviews/metacritic/critic/{api_cat}/{slug}/web?offset={off}&limit=10",
                            json_headers,
                        )
                        for off in critic_offsets
                    ],
                    *[
                        _safe_get(
                            client,
                            f"https://backend.metacritic.com/reviews/metacritic/user/{api_cat}/{slug}/web?offset={off}&limit=50&filterBySentiment=all&sort=date",
                            json_headers,
                        )
                        for off in user_offsets
                    ],
                ]
            )
        results = await asyncio.gather(*tasks)

    main_res, critic_res, user_res = results[:3]
    user_stats_res = results[3] if api_cat else None
    critic_stats_res = results[4] if api_cat else None
    critic_page_res_list = results[5 : 5 + len(critic_offsets)] if api_cat else []
    user_page_res_list = results[5 + len(critic_offsets) :] if api_cat else []

    main_html = main_res.text if (main_res and main_res.is_success) else ""
    critic_html = critic_res.text if (critic_res and critic_res.is_success) else ""
    user_html = user_res.text if (user_res and user_res.is_success) else ""

    main_ld = _parse_metacritic_json_ld(main_html, main_page_url) if main_html else None
    critic_ld = _parse_metacritic_json_ld(critic_html, critic_reviews_url) if critic_html else None
    user_ld = _parse_metacritic_json_ld(user_html, user_reviews_url) if user_html else None

    base_ld = main_ld or critic_ld or user_ld
    parsed_ld = (
        {
            **base_ld,
            "scriptsCount": (main_ld["scriptsCount"] if main_ld else 0)
            + (critic_ld["scriptsCount"] if critic_ld else 0)
            + (user_ld["scriptsCount"] if user_ld else 0),
            "embeddedReviews": [
                *(main_ld["embeddedReviews"] if main_ld else []),
                *(critic_ld["embeddedReviews"] if critic_ld else []),
                *(user_ld["embeddedReviews"] if user_ld else []),
            ],
        }
        if base_ld
        else None
    )

    def _safe_json(resp: Any) -> Optional[Dict[str, Any]]:
        if resp and resp.is_success:
            try:
                data = resp.json()
                return data if isinstance(data, dict) else None
            except Exception:
                return None
        return None

    def _collect_items(resp_list: List[Any], key_fn) -> List[Dict[str, Any]]:
        collected: List[Dict[str, Any]] = []
        seen = set()
        for resp in resp_list:
            payload = _safe_json(resp)
            for item in ((payload or {}).get("data") or {}).get("items") or []:
                if not isinstance(item, dict):
                    continue
                key = key_fn(item)
                if key in seen:
                    continue
                seen.add(key)
                collected.append(item)
        return collected

    critic_items = _collect_items(
        critic_page_res_list,
        lambda it: f"{it.get('publicationName') or ''}_{it.get('author') or ''}_{str(it.get('quote') or '')[:80]}",
    )
    user_items = _collect_items(
        user_page_res_list,
        lambda it: str(it.get("id") or f"{it.get('author') or ''}_{it.get('date') or ''}_{str(it.get('quote') or '')[:80]}"),
    )

    u_stats_json = _safe_json(user_stats_res)
    c_stats_json = _safe_json(critic_stats_res)
    page_ok = bool(
        (main_res and main_res.is_success)
        or (critic_res and critic_res.is_success)
        or (user_res and user_res.is_success)
    )
    page_status = (
        (main_res.status_code if main_res else None)
        or (critic_res.status_code if critic_res else None)
        or (user_res.status_code if user_res else None)
        or 502
    )
    return {
        "pageOk": page_ok,
        "pageStatus": page_status,
        "canonicalUrl": main_page_url,
        "mainPageUrl": main_page_url,
        "criticReviewsUrl": critic_reviews_url,
        "userReviewsUrl": user_reviews_url,
        "parsedLd": parsed_ld,
        "userItems": user_items,
        "criticItems": critic_items,
        "userStats": ((u_stats_json or {}).get("data") or {}).get("item"),
        "criticStats": ((c_stats_json or {}).get("data") or {}).get("item"),
    }

import pytest
from fastapi.testclient import TestClient
import main


@pytest.fixture
def client():
    return TestClient(main.app)


def test_health_endpoints(client):
    r1 = client.get("/health")
    assert r1.status_code == 200
    assert r1.text == "OK"

    r2 = client.get("/healthz")
    assert r2.status_code == 200
    assert r2.text == "OK"


def test_unmatched_and_removed_routes_return_404(client):
    for dead_path in (
        "/api/key",
        "/api/run-fingerprint/test",
        "/api/runs/fingerprints",
        "/api/gcs/cache-stats",
        "/api/cache-manifest",
        "/api/activity",
        "/api/runs",
        "/api/resolve-url",
        "/api/trustpilot/details",
        "/api/youtube/trends",
    ):
        res = client.get(dead_path)
        assert res.status_code == 404, f"Expected 404 for removed route {dead_path}, got {res.status_code}"

    for dead_post in ("/api/admin/config", "/api/tts"):
        res = client.post(dead_post, json={})
        assert res.status_code in (404, 405), f"Expected 404/405 for removed route {dead_post}, got {res.status_code}"


def test_run_history_save_and_load(client, monkeypatch, tmp_path):
    monkeypatch.setattr(
        "backend.routers.audiences_runs_creative.activity_and_history_routes.ROOT_DIR",
        tmp_path,
    )
    monkeypatch.setattr(
        "backend.routers.audiences_runs_creative.run_load_save_routes.ROOT_DIR",
        tmp_path,
    )
    monkeypatch.setattr(
        "backend.routers.audiences_runs_creative.activity_and_history_routes.get_gcs_bucket_name",
        lambda: "",
    )
    monkeypatch.setattr(
        "backend.routers.audiences_runs_creative.activity_and_history_routes.get_storage_client",
        lambda: None,
    )
    save_res = client.post(
        "/api/save-run-history/sentiment_anomaly_alerts",
        json={"companyName": "test-company", "data": {"alerts": [{"id": "a1"}]}},
    )
    assert save_res.status_code == 200
    assert save_res.json().get("success") is True

    hist_res = client.get("/api/runs-history/sentiment_anomaly_alerts?companyName=test-company")
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert isinstance(history, list)
    assert len(history) == 1
    assert history[0]["data"]["alerts"][0]["id"] == "a1"


def test_startup_checks(client):
    res = client.get("/api/startup-checks")
    assert res.status_code == 200
    data = res.json()
    assert "success" in data
    assert "checks" in data
    assert "gcs" in data["checks"]
    assert "gemini" in data["checks"]


def test_post_activity_log(client, monkeypatch, tmp_path):
    act_file = tmp_path / "activity_log.json"
    monkeypatch.setattr(
        "backend.routers.audiences_runs_creative.activity_and_history_routes.ACTIVITY_FILE",
        act_file,
    )
    res = client.post(
        "/api/activity",
        json={"companyName": "test-company", "event": {"mode": "FILTER_PIPELINE", "action": "RUN"}},
    )
    assert res.status_code == 200
    body = res.json()
    assert body.get("status") == "success"
    assert body.get("event", {}).get("companyName") == "test-company"
    assert act_file.exists()


def test_terminal_log(client):
    res = client.post("/api/terminal-log", json={"message": "pytest smoke check", "level": "info"})
    assert res.status_code == 200
    assert res.json().get("success") is True


def test_resolve_urls(client):
    res = client.post("/api/resolve-urls", json={"urls": ["https://www.google.com"]})
    assert res.status_code == 200
    assert res.json().get("resolved", {}).get("https://www.google.com") == "https://www.google.com"


def test_trustpilot_reviews(client, monkeypatch):
    import json
    import httpx

    # Missing domain/url must fail explicitly with 400 (Zero Silent Fallbacks)
    missing_res = client.get("/api/trustpilot/reviews")
    assert missing_res.status_code == 400

    next_data = {
        "props": {
            "pageProps": {
                "businessUnit": {
                    "displayName": "Example Corp",
                    "trustScore": 4.6,
                    "numberOfReviews": 312,
                    "stars": 4.5,
                    "profileImageUrl": "https://example.com/logo.png",
                },
                "filters": {
                    "reviewStatistics": {
                        "ratings": {"five": 250, "four": 40, "three": 12, "two": 5, "one": 5}
                    }
                },
                "reviews": [
                    {
                        "id": "rev-1",
                        "consumer": {"displayName": "Alex P."},
                        "rating": 5,
                        "title": "Reliable onboarding",
                        "text": "Smooth setup and responsive team.",
                        "dates": {"publishedDate": "2026-10-12T10:00:00Z"},
                    }
                ],
            }
        }
    }
    html = f'<html><head><script id="__NEXT_DATA__" type="application/json">{json.dumps(next_data)}</script></head><body></body></html>'

    class _MockResponse:
        status_code = 200
        is_success = True
        text = html

    class _MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, **kwargs):
            assert url == "https://www.trustpilot.com/review/example.com"
            return _MockResponse()

    monkeypatch.setattr(
        "backend.routers.integrations_and_trends.reddit_and_trustpilot_routes.httpx.AsyncClient",
        _MockAsyncClient,
    )

    res = client.get("/api/trustpilot/reviews?domain=example.com")
    assert res.status_code == 200
    body = res.json()
    assert body["domain"] == "example.com"
    assert body["company"] == "Example Corp"
    assert body["trustScore"] == 4.6
    assert body["totalReviews"] == 312
    assert len(body["reviews"]) == 1
    assert body["reviews"][0]["author"] == "Alex P."

    class _FailAsyncClient(_MockAsyncClient):
        async def get(self, url, **kwargs):
            raise httpx.ConnectError("upstream unreachable")

    monkeypatch.setattr(
        "backend.routers.integrations_and_trends.reddit_and_trustpilot_routes.httpx.AsyncClient",
        _FailAsyncClient,
    )
    err_res = client.get("/api/trustpilot/reviews?domain=example.com")
    assert err_res.status_code == 502


def test_admin_config(client):
    res = client.get("/api/admin/config")
    assert res.status_code == 200
    data = res.json()
    assert data.get("branding", {}).get("companyName") == "test-company"
    nav = data.get("navigation", [])
    assert isinstance(nav, list)
    assert len(nav) == 2
    assert nav[0].get("id") == "INSIGHTS"
    assert nav[1].get("id") == "FILTER_PIPELINE"


def test_insights_table(client):
    res = client.get("/api/insights/table?companyName=test-company")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_sanitize_generate_content_config():
    from backend.routers.slice_a_core_genai import sanitize_generate_content_config
    from google.genai import types

    cfg = {
        "thinkingConfig": {"thinkingLevel": "LOW"},
        "imageConfig": {"aspectRatio": "16:9", "imageSize": "1024x1024", "image_size": "1K"},
    }
    sanitized = sanitize_generate_content_config(cfg)
    assert sanitized["thinking_config"].get("thinking_level") == "LOW"
    assert "thinking_budget" not in sanitized.get("thinking_config", {})
    assert "imageSize" not in sanitized.get("imageConfig", {})
    assert "image_size" not in sanitized.get("imageConfig", {})

    pydantic_config = types.GenerateContentConfig(**sanitized)
    assert pydantic_config.thinking_config.thinking_level == "LOW"

    cfg_snake = {"image_config": {"aspect_ratio": "16:9", "image_size": "1K", "imageSize": "1K"}}
    sanitized_snake = sanitize_generate_content_config(cfg_snake)
    assert "image_size" not in sanitized_snake.get("image_config", {})
    assert "imageSize" not in sanitized_snake.get("image_config", {})
    pydantic_snake = types.GenerateContentConfig(**sanitized_snake)
    assert pydantic_snake.image_config.aspect_ratio == "16:9"


def _cleanup_pytest_run_artifacts(feature_id: str, company: str, pending_futures=None):
    from pathlib import Path
    from backend.core import (
        ROOT_DIR,
        get_cache_key,
        get_gcs_bucket_name,
        get_sidecar_meta_path,
        get_storage_client,
        get_target_mirror_path,
        sanitize_company_name,
        sanitize_run_id,
        server_run_cache,
    )

    for fut in pending_futures or []:
        try:
            fut.result(timeout=10)
        except Exception:
            pass

    mirror_file = get_target_mirror_path(feature_id, company, ROOT_DIR)
    if mirror_file.exists():
        mirror_file.unlink()
    meta_file = get_sidecar_meta_path(mirror_file)
    if meta_file.exists():
        meta_file.unlink()

    comp = sanitize_company_name(company)
    clean_id = sanitize_run_id(feature_id)
    dist_mirror = ROOT_DIR / "dist" / "data" / "configuration" / "runs" / comp / f"{clean_id}_run.json"
    if dist_mirror.exists():
        dist_mirror.unlink()

    server_run_cache.pop(get_cache_key(company, feature_id), None)

    try:
        sc = get_storage_client()
        bucket_name = get_gcs_bucket_name()
        if sc and bucket_name:
            for blob in list(sc.list_blobs(bucket_name, prefix=f"{comp}/")):
                b_name = str(getattr(blob, "name", "") or "")
                if Path(b_name).name.startswith("pytest_"):
                    try:
                        blob.delete()
                    except Exception:
                        pass
    except Exception:
        pass


def test_save_load_and_fingerprint_pipeline(client):
    from backend.core import _GCS_UPLOAD_EXECUTOR, calculate_fingerprint

    feature_id = "pytest_fingerprint_verification"
    company = "test-company"
    pending_futures = []
    orig_submit = _GCS_UPLOAD_EXECUTOR.submit

    def _track_submit(*args, **kwargs):
        fut = orig_submit(*args, **kwargs)
        pending_futures.append(fut)
        return fut

    _GCS_UPLOAD_EXECUTOR.submit = _track_submit
    try:
        payload_v1 = {
            "metrics": {"ctr": 3.45, "conversions": 128},
            "segments": ["Enterprise Cloud", "Platform Core"],
        }

        # 1. Verify deterministic SHA-256 fingerprint calculation
        fp_direct_1 = calculate_fingerprint(payload_v1)
        fp_direct_2 = calculate_fingerprint({
            "segments": ["Enterprise Cloud", "Platform Core"],
            "metrics": {"conversions": 128, "ctr": 3.45},
            "updatedAt": "2026-09-28T00:00:00Z",
            "_fingerprint": "ignored",
        })
        assert len(fp_direct_1) == 64
        assert fp_direct_1 == fp_direct_2

        # 2. Save run v1 via POST /api/save-run/{feature_id}
        save_res = client.post(
            f"/api/save-run/{feature_id}",
            json={"companyName": company, "data": payload_v1},
        )
        assert save_res.status_code == 200
        save_json = save_res.json()
        assert save_json.get("success") is True
        assert save_json.get("fingerprint") == fp_direct_1
        assert "updatedAt" in save_json

        # 3. Load full run via GET /api/load-run/{feature_id}
        load_res = client.get(f"/api/load-run/{feature_id}?companyName={company}")
        assert load_res.status_code == 200
        assert load_res.headers.get("X-Run-Fingerprint") == fp_direct_1
        load_json = load_res.json()
        assert load_json.get("fingerprint") == fp_direct_1
        assert "updatedAt" in load_json
        assert load_json.get("metrics") == payload_v1["metrics"]
        assert load_json.get("data", {}).get("metrics") == payload_v1["metrics"]

        # 4. Save modified payload v2 and verify fingerprint updates
        payload_v2 = {
            "metrics": {"ctr": 4.10, "conversions": 256},
            "segments": ["Enterprise Cloud", "Platform Core", "Developer Tools"],
        }
        fp_v2 = calculate_fingerprint(payload_v2)
        assert fp_v2 != fp_direct_1

        save_res_2 = client.post(
            f"/api/save-run/{feature_id}",
            json={"companyName": company, "data": payload_v2},
        )
        assert save_res_2.status_code == 200
        assert save_res_2.json().get("fingerprint") == fp_v2

        load_res_2 = client.get(f"/api/load-run/{feature_id}?companyName={company}")
        assert load_res_2.status_code == 200
        assert load_res_2.headers.get("X-Run-Fingerprint") == fp_v2
        assert load_res_2.json().get("fingerprint") == fp_v2
    finally:
        _GCS_UPLOAD_EXECUTOR.submit = orig_submit
        _cleanup_pytest_run_artifacts(feature_id, company, pending_futures)


def test_unified_3tier_gcs_cache_engine(client):
    import time
    from backend.core import (
        ROOT_DIR,
        _GCS_UPLOAD_EXECUTOR,
        calculate_fingerprint,
        get_cache_key,
        get_sidecar_meta_path,
        get_target_mirror_path,
        server_run_cache,
    )

    feature_id = "pytest_3tier_cache_engine"
    company = "test-company"
    pending_futures = []
    orig_submit = _GCS_UPLOAD_EXECUTOR.submit

    def _track_submit(*args, **kwargs):
        fut = orig_submit(*args, **kwargs)
        pending_futures.append(fut)
        return fut

    _GCS_UPLOAD_EXECUTOR.submit = _track_submit
    try:
        payload = {
            "campaign": "test-company Q4 Launch",
            "metrics": {"roas": 4.8, "cpa": 18.5},
            "channels": ["Search", "Social", "Programmatic"],
        }
        expected_fp = calculate_fingerprint(payload)

        # 1. Save run via POST /api/save-run/{feature_id} (L1/L2 synchronous, L3 write-behind)
        t0 = time.perf_counter()
        save_res = client.post(
            f"/api/save-run/{feature_id}",
            json={"companyName": company, "data": payload},
        )
        save_ms = (time.perf_counter() - t0) * 1000.0
        assert save_res.status_code == 200
        save_data = save_res.json()
        assert save_data.get("fingerprint") == expected_fp
        assert save_ms < 250.0  # Non-blocking L1/L2 write-through

        # Verify sidecar .meta.json was written on disk
        mirror_file = get_target_mirror_path(feature_id, company, ROOT_DIR)
        sidecar_file = get_sidecar_meta_path(mirror_file)
        assert mirror_file.exists()
        assert sidecar_file.exists()

        # 2. Verify L1 memory cache hit on GET /api/load-run/{feature_id}
        t1 = time.perf_counter()
        load_res = client.get(f"/api/load-run/{feature_id}?companyName={company}")
        load_l1_ms = (time.perf_counter() - t1) * 1000.0
        assert load_res.status_code == 200
        assert load_res.headers.get("X-Cache-Source") == "memory"
        assert load_res.headers.get("X-Run-Fingerprint") == expected_fp
        assert load_res.headers.get("ETag") is not None
        assert load_l1_ms < 50.0

        # 3. Verify conditional short-circuit via ?knownFingerprint=
        cond_q_res = client.get(
            f"/api/load-run/{feature_id}?companyName={company}&knownFingerprint={expected_fp}"
        )
        assert cond_q_res.status_code == 200
        cond_q_json = cond_q_res.json()
        assert cond_q_json.get("status") == "not_modified"
        assert cond_q_json.get("unchanged") is True
        assert cond_q_json.get("fingerprint") == expected_fp

        # 4. Verify conditional short-circuit via If-None-Match header
        cond_h_res = client.get(
            f"/api/load-run/{feature_id}?companyName={company}",
            headers={"If-None-Match": f'"{expected_fp}"'},
        )
        assert cond_h_res.status_code == 200
        cond_h_json = cond_h_res.json()
        assert cond_h_json.get("status") == "not_modified"
        assert cond_h_json.get("unchanged") is True
        assert cond_h_json.get("fingerprint") == expected_fp

        # 5. Evict L1 entry and verify L2 local disk + sidecar promotion back to L1
        server_run_cache.pop(get_cache_key(company, feature_id), None)

        load_l2_res = client.get(f"/api/load-run/{feature_id}?companyName={company}")
        assert load_l2_res.status_code == 200
        assert load_l2_res.headers.get("X-Cache-Source") in ("disk", "disk_offline", "local")
        assert load_l2_res.json().get("fingerprint") == expected_fp

        # Subsequent call should hit L1 memory again
        load_l1_again = client.get(f"/api/load-run/{feature_id}?companyName={company}")
        assert load_l1_again.status_code == 200
        assert load_l1_again.headers.get("X-Cache-Source") == "memory"
    finally:
        _GCS_UPLOAD_EXECUTOR.submit = orig_submit
        _cleanup_pytest_run_artifacts(feature_id, company, pending_futures)


def test_steam_search_endpoint(client, monkeypatch):
    import json
    import httpx

    # Empty search term must fail explicitly with 400
    assert client.get("/api/steam/search").status_code == 400
    assert client.get("/api/steam/search?term=%20%20").status_code == 400

    store_items = [
        {
            "id": 620 + idx,
            "name": f"Test Title {idx}",
            "tiny_image": f"https://cdn.example.invalid/steam/{620 + idx}.jpg",
            "price": {"currency": "USD", "initial": 1999, "final": 1999},
            "metascore": "90" if idx == 0 else "",
        }
        for idx in range(10)
    ]

    class _MockResp:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self.is_success = 200 <= status_code < 300
            self._payload = payload
            self.text = ""

        def json(self):
            return self._payload

    requested_summary_ids = []

    class _MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, params=None, **kwargs):
            if "storesearch" in url:
                assert params["term"] == "portal"
                assert params["cc"] == "US"
                assert params["l"] == "english"
                return _MockResp(200, {"total": 10, "items": store_items})
            if "IUserReviewsService/GetAppReviews" in url:
                input_obj = json.loads((params or {}).get("input_json", "{}"))
                app_id = str(input_obj.get("appid"))
                requested_summary_ids.append(app_id)
                if app_id == "621":
                    return _MockResp(500, {"error": "summary unavailable"})
                return _MockResp(
                    200,
                    {
                        "response": {
                            "query_summary": {
                                "review_score_desc": "Overwhelmingly Positive",
                                "total_reviews": 12000,
                                "total_positive": 11500,
                                "total_negative": 500,
                            },
                            "reviews": [],
                        }
                    },
                )
            raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(
        "backend.routers.integrations_and_trends.steam_store_api_routes.httpx.AsyncClient",
        _MockAsyncClient,
    )

    res = client.get("/api/steam/search?q=portal")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 8  # Top 8 results only
    assert len(requested_summary_ids) == 8

    # Enriched item preserves query_summary fields
    assert data[0]["id"] == 620
    assert data[0]["review_score_desc"] == "Overwhelmingly Positive"
    assert data[0]["total_reviews"] == 12000
    assert data[0]["total_positive"] == 11500
    assert data[0]["total_negative"] == 500

    # Failed summary skips enrichment fields without inventing numbers
    assert data[1]["id"] == 621
    assert "review_score_desc" not in data[1]
    assert "total_reviews" not in data[1]

    # Upstream HTTP error / network failure raises 502
    class _FailStatusClient(_MockAsyncClient):
        async def get(self, url, params=None, **kwargs):
            return _MockResp(503, {"error": "unavailable"})

    monkeypatch.setattr(
        "backend.routers.integrations_and_trends.steam_store_api_routes.httpx.AsyncClient",
        _FailStatusClient,
    )
    assert client.get("/api/steam/search?term=portal").status_code == 502

    class _FailNetClient(_MockAsyncClient):
        async def get(self, url, params=None, **kwargs):
            raise httpx.ConnectError("upstream down")

    monkeypatch.setattr(
        "backend.routers.integrations_and_trends.steam_store_api_routes.httpx.AsyncClient",
        _FailNetClient,
    )
    assert client.get("/api/steam/search?term=portal").status_code == 502


def test_steam_reviews_endpoint(client, monkeypatch):
    import json
    import httpx

    assert client.get("/api/steam/reviews").status_code == 400
    assert client.get("/api/steam/reviews?appId=not-an-id").status_code == 400
    assert client.get("/api/steam/reviews?appId=0").status_code == 400

    class _MockResp:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self.is_success = 200 <= status_code < 300
            self._payload = payload

        def json(self):
            return self._payload

    seen_calls = []

    class _MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, params=None, **kwargs):
            assert url == "https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/"
            input_obj = json.loads((params or {}).get("input_json", "{}"))
            assert input_obj.get("appid") == 620
            seen_calls.append(input_obj)
            cur = input_obj.get("cursor")
            if cur == "*":
                return _MockResp(
                    200,
                    {
                        "response": {
                            "cursor": "cur-page-2",
                            "reviews": [
                                {
                                    "recommendationid": "101",
                                    "review": "Clever puzzle design.",
                                    "voted_up": True,
                                    "votes_up": 42,
                                    "votes_funny": 3,
                                    "timestamp_created": 1700000100,
                                    "weighted_vote_score": "0.85",
                                    "language": "english",
                                    "author": {"steamid": "76561198000000001", "playtime_forever": 640},
                                },
                                {
                                    "recommendationid": "102",
                                    "review": "Co-op mode holds up well.",
                                    "voted_up": True,
                                    "votes_up": 15,
                                    "votes_funny": 0,
                                    "timestamp_created": 1700000200,
                                    "weighted_vote_score": "0.72",
                                    "language": "english",
                                    "author": {"steamid": "76561198000000002", "playtime_forever": 310},
                                },
                            ],
                        }
                    },
                )
            return _MockResp(
                200,
                {
                    "response": {
                        "cursor": "cur-page-2",
                        "reviews": [
                            {
                                "recommendationid": "102",
                                "review": "Co-op mode holds up well.",
                                "voted_up": True,
                                "votes_up": 15,
                                "votes_funny": 0,
                                "timestamp_created": 1700000200,
                                "weighted_vote_score": "0.72",
                                "language": "english",
                                "author": {"steamid": "76561198000000002"},
                            },
                            {
                                "recommendationid": "103",
                                "review": "Minor frame drop on older hardware.",
                                "voted_up": False,
                                "votes_up": 4,
                                "votes_funny": 1,
                                "timestamp_created": 1700000300,
                                "weighted_vote_score": "0.60",
                                "language": "english",
                                "author": {"steamid": "76561198000000003"},
                            },
                        ],
                    }
                },
            )

    monkeypatch.setattr(
        "backend.routers.integrations_and_trends.steam_store_api_routes.httpx.AsyncClient",
        _MockAsyncClient,
    )

    res = client.get(
        "/api/steam/reviews?appId=https://store.steampowered.com/app/620/Test_Game/&maxReviews=750&day_range=14"
    )
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert len(body) == 3  # Deduplicated across 2 pages
    assert body[0]["id"] == "101"
    assert body[0]["recommendationid"] == "101"
    assert body[0]["review"] == "Clever puzzle design."
    assert body[0]["content"] == "Clever puzzle design."
    assert body[0]["voted_up"] is True
    assert body[0]["votes_up"] == 42
    assert body[2]["voted_up"] is False
    assert seen_calls[0]["day_range"] == 14
    assert seen_calls[0]["filter"] == 1
    assert seen_calls[0]["languages"] == ["all"]
    assert seen_calls[1]["cursor"] == "cur-page-2"

    # Respects maxReviews cap
    seen_calls.clear()
    capped = client.get("/api/steam/reviews?app_id=620&maxReviews=2")
    assert capped.status_code == 200
    assert len(capped.json()) == 2
    assert len(seen_calls) == 1

    # Empty response dict from Steam raises 502
    class _EmptyRespClient(_MockAsyncClient):
        async def get(self, url, params=None, **kwargs):
            return _MockResp(200, {"response": {}})

    monkeypatch.setattr(
        "backend.routers.integrations_and_trends.steam_store_api_routes.httpx.AsyncClient",
        _EmptyRespClient,
    )
    assert client.get("/api/steam/reviews?appId=620").status_code == 502

    # Upstream network failure raises 502
    class _FailNetClient(_MockAsyncClient):
        async def get(self, url, params=None, **kwargs):
            raise httpx.ReadTimeout("timed out")

    monkeypatch.setattr(
        "backend.routers.integrations_and_trends.steam_store_api_routes.httpx.AsyncClient",
        _FailNetClient,
    )
    assert client.get("/api/steam/reviews?appId=620").status_code == 502


def test_startup_checks_enriched(client, monkeypatch, tmp_path):
    import json
    from types import SimpleNamespace
    from backend.core import YouTubeKeyMissingError

    mod_path = "backend.routers.integrations_and_trends.startup_and_url_resolver_routes"

    class _FakeBucket:
        def __init__(self, does_exist=True):
            self._does_exist = does_exist

        def exists(self):
            return self._does_exist

    class _FakeStorageClient:
        def __init__(self, blobs, exists=True):
            self._blobs = blobs
            self._exists = exists

        def bucket(self, name):
            return _FakeBucket(self._exists)

        def list_blobs(self, bucket_name, prefix="", max_results=30):
            return self._blobs

    # 1. Connected GCS with real content + YouTube + Gemini + GCS filterPipeline items
    blobs_with_content = [
        SimpleNamespace(name="test-company/insights_table.json", size=140),
        SimpleNamespace(name="test-company/insights_table_run.json.meta.json", size=95),
        SimpleNamespace(name="test-company/runs/bulk_run.json", size=300),
    ]
    monkeypatch.setattr(f"{mod_path}.get_gcs_bucket_name", lambda: "demo-trend-gcs")
    monkeypatch.setattr(f"{mod_path}.get_storage_client", lambda: _FakeStorageClient(blobs_with_content, True))
    monkeypatch.setattr(f"{mod_path}.gcs_download_json_fast", lambda *a, **kw: [{"id": "yt-1"}, {"id": "steam-2"}])
    monkeypatch.setattr(f"{mod_path}.resolve_genai_api_key", lambda req=None: "test-genai-key")
    monkeypatch.setattr(f"{mod_path}.get_gcp_project", lambda: "demo-gcp-project")
    monkeypatch.setenv("YOUTUBE_API_KEY", "AIzaTestKey123")

    res_ok = client.get("/api/startup-checks?companyName=test-company")
    assert res_ok.status_code == 200
    checks_ok = res_ok.json()["checks"]
    assert checks_ok["gcs"]["status"] == "success"
    assert checks_ok["gcs"]["connected"] is True
    assert checks_ok["gcs"]["hasContent"] is True
    assert checks_ok["gcs"]["blobCount"] == 2
    assert checks_ok["gcs"]["hasInsightsTable"] is True
    assert checks_ok["gcs"]["hasPipelineRuns"] is True
    assert checks_ok["youtube"]["status"] == "success"
    assert checks_ok["youtube"]["configured"] is True
    assert checks_ok["steam"]["status"] == "success"
    assert checks_ok["steam"]["configured"] is True
    assert checks_ok["steam"]["requiresApiKey"] is False
    assert checks_ok["gemini"]["status"] == "success"
    assert checks_ok["gemini"]["configured"] is True
    assert checks_ok["gemini"]["project"] == "demo-gcp-project"
    assert checks_ok["gemini"]["hasApiKey"] is True
    assert checks_ok["filterPipeline"]["status"] == "success"
    assert checks_ok["filterPipeline"]["itemCount"] == 2
    assert checks_ok["filterPipeline"]["hasItems"] is True

    # 2. Connected GCS with only sidecars, pytest_* artifacts & empty insights_table_run.json + missing YouTube/Gemini keys
    empty_blobs = [
        SimpleNamespace(name="test-company/insights_table_run.json", size=2),
        SimpleNamespace(name="test-company/insights_table_run.json.meta.json", size=88),
        SimpleNamespace(name="test-company/pytest_3tier_cache_engine_run.json", size=299),
        SimpleNamespace(name="test-company/runs/pytest_fingerprint_verification_run.json", size=285),
    ]
    for env_k in ("YOUTUBE_API_KEY", "VITE_YOUTUBE_API_KEY", "GOOGLE_CLOUD_API_KEY", "GEMINI_API_KEY", "API_KEY"):
        monkeypatch.delenv(env_k, raising=False)
    monkeypatch.setattr(f"{mod_path}.get_storage_client", lambda: _FakeStorageClient(empty_blobs, True))
    monkeypatch.setattr(f"{mod_path}.gcs_download_json_fast", lambda *a, **kw: None)
    monkeypatch.setattr(f"{mod_path}.resolve_genai_api_key", lambda req=None: "")
    monkeypatch.setattr(f"{mod_path}.get_gcp_project", lambda: "")

    def _raise_yt_missing():
        raise YouTubeKeyMissingError("missing")

    monkeypatch.setattr(f"{mod_path}.get_youtube_api_key", _raise_yt_missing)

    res_warn = client.get("/api/startup-checks?companyName=test-company")
    assert res_warn.status_code == 200
    checks_warn = res_warn.json()["checks"]
    assert checks_warn["gcs"]["status"] == "warning"
    assert checks_warn["gcs"]["connected"] is True
    assert checks_warn["gcs"]["hasContent"] is False
    assert checks_warn["gcs"]["blobCount"] == 0
    assert checks_warn["gcs"]["hasPipelineRuns"] is False
    assert checks_warn["youtube"]["status"] == "warning"
    assert checks_warn["youtube"]["configured"] is False
    assert checks_warn["gemini"]["status"] == "warning"
    assert checks_warn["gemini"]["configured"] is False
    assert checks_warn["filterPipeline"]["status"] == "warning"
    assert checks_warn["filterPipeline"]["itemCount"] == 0
    assert checks_warn["filterPipeline"]["hasItems"] is False

    # 3. Disconnected GCS falls back to local insights_table_run.json count
    local_run = tmp_path / "public" / "data" / "configuration" / "runs" / "test-company" / "insights_table_run.json"
    local_run.parent.mkdir(parents=True, exist_ok=True)
    local_run.write_text(json.dumps([{"id": "1"}, {"id": "2"}, {"id": "3"}]), encoding="utf-8")
    monkeypatch.setattr(f"{mod_path}.ROOT_DIR", tmp_path)
    monkeypatch.setattr(f"{mod_path}.get_storage_client", lambda: None)

    res_disc = client.get("/api/startup-checks?companyName=test-company")
    assert res_disc.status_code == 200
    checks_disc = res_disc.json()["checks"]
    assert checks_disc["gcs"]["status"] == "error"
    assert checks_disc["gcs"]["connected"] is False
    assert checks_disc["gcs"]["hasContent"] is False
    assert checks_disc["filterPipeline"]["status"] == "success"
    assert checks_disc["filterPipeline"]["itemCount"] == 3
    assert checks_disc["filterPipeline"]["hasItems"] is True

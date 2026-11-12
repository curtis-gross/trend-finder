"""
Startup Health Checks, URL Resolvers, YouTube Data API v3, Steam Store API, and Trustpilot/Metacritic Scraper routes:
- `startup_and_url_resolver_routes`: `/api/startup-checks`, `/api/resolve-urls`
- `youtube_data_api_routes`: YouTube Data API v3 search, comments, video-details
- `reddit_and_trustpilot_routes`: `/api/trustpilot/reviews`
- `steam_store_api_routes`: `/api/steam/search`, `/api/steam/reviews` (free public Steam Store API)
- `metacritic_scraper_and_jsonld`: Metacritic JSON-LD parser and page/API fetcher
- `metacritic_analysis_builder`: Structured review divergence and theme synthesizer
- `metacritic_scan_routes`: `/api/metacritic/scan` and GCS/local persistence
"""

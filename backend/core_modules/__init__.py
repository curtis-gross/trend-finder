"""
Core runtime modules for the test-company Trend Intelligence (trend-finder) backend:
- `ssl_and_runtime_patch`: PyOpenSSL thread-safety monkey-patching, env loading, shared GCS client
- `platform_and_tenant_config`: Tenant/company normalization, app config, and GCS bucket resolution
- `gcs_three_tier_cache`: 3-tier L1 Memory / L2 Disk / L3 GCS fingerprint cache engine
- `genai_image_and_creative_index`: GenAI and Vertex AI API key & project resolution
"""

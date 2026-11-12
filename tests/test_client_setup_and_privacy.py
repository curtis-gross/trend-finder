import asyncio
import importlib.util
from pathlib import Path
import re
import subprocess
import sys

from fastapi.testclient import TestClient
import main

ROOT_DIR = Path(__file__).resolve().parent.parent


def _load_setup_assistant_module():
    script_path = ROOT_DIR / "scripts" / "setup_assistant.py"
    spec = importlib.util.spec_from_file_location("setup_assistant", script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_api_key_endpoint_returns_404_when_gemini_api_key_set(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "AIzaTestSecret123")
    client = TestClient(main.app)
    res = client.get("/api/key")
    assert res.status_code == 404
    assert "AIzaTestSecret123" not in res.text


def test_resolve_grounding_url_ssrf_hardening(monkeypatch):
    from backend.routers.integrations_and_trends import startup_and_url_resolver_routes as resolver_mod

    outbound_requests = []

    class _GuardAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def get(self, url, **kwargs):
            outbound_requests.append(url)
            raise AssertionError(f"Unexpected outbound HTTP request to {url}")

    monkeypatch.setattr(resolver_mod.httpx, "AsyncClient", _GuardAsyncClient)

    blocked_urls = [
        "http://127.0.0.1:8080/api/startup-checks?q=google.com/url?",
        "https://evil.com/vertexaisearch.cloud.google.com/grounding-api-redirect",
        "file:///etc/passwd?google.com/url?",
    ]
    for blocked in blocked_urls:
        resolved = asyncio.run(resolver_mod.resolve_grounding_url(blocked))
        assert resolved == blocked
    assert outbound_requests == []

    allowed = "https://www.google.com"
    assert asyncio.run(resolver_mod.resolve_grounding_url(allowed)) == allowed
    assert outbound_requests == []


def test_genai_client_factory_provider_modes_and_clean_headers(monkeypatch):
    from backend.routers import genai_client_factory

    class _RecordedClient:
        def __init__(self, **kwargs):
            self.init_kwargs = kwargs

    monkeypatch.setattr(genai_client_factory.genai, "Client", _RecordedClient)
    monkeypatch.setattr(genai_client_factory, "get_gcp_project", lambda: "")

    for env_key in (
        "GENAI_PROVIDER",
        "GOOGLE_CLOUD_API_KEY",
        "AI_STUDIO_API_KEY",
        "GEMINI_API_KEY",
        "VITE_GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "API_KEY",
    ):
        monkeypatch.delenv(env_key, raising=False)

    # 1. GENAI_PROVIDER=vertex with GOOGLE_CLOUD_API_KEY=AIzaVertexKey123
    monkeypatch.setenv("GENAI_PROVIDER", "vertex")
    monkeypatch.setenv("GOOGLE_CLOUD_API_KEY", "AIzaVertexKey123")
    _, _, vertex_api_client = genai_client_factory.get_genai_clients()
    assert vertex_api_client is not None
    assert vertex_api_client.init_kwargs.get("vertexai") is True
    assert vertex_api_client.init_kwargs.get("api_key") == "AIzaVertexKey123"
    assert "project" not in vertex_api_client.init_kwargs
    assert "location" not in vertex_api_client.init_kwargs

    forbidden_header = "vertex-agent-studio-" + "getcode"
    http_opts = vertex_api_client.init_kwargs.get("http_options")
    headers = getattr(http_opts, "headers", None) or {}
    assert forbidden_header not in str(headers)

    # 2. GENAI_PROVIDER=aistudio with AI_STUDIO_API_KEY=AIzaStudioKey123
    monkeypatch.delenv("GOOGLE_CLOUD_API_KEY", raising=False)
    monkeypatch.setenv("GENAI_PROVIDER", "aistudio")
    monkeypatch.setenv("AI_STUDIO_API_KEY", "AIzaStudioKey123")
    _, _, studio_api_client = genai_client_factory.get_genai_clients()
    assert studio_api_client is not None
    assert studio_api_client.init_kwargs.get("vertexai") is False
    assert studio_api_client.init_kwargs.get("api_key") == "AIzaStudioKey123"
    assert "project" not in studio_api_client.init_kwargs
    assert "location" not in studio_api_client.init_kwargs

    studio_http_opts = studio_api_client.init_kwargs.get("http_options")
    studio_headers = getattr(studio_http_opts, "headers", None) or {}
    assert forbidden_header not in str(studio_headers)


def test_get_active_company_name_env_override_and_fallback(monkeypatch):
    from backend.core_modules import platform_and_tenant_config as tenant_cfg

    monkeypatch.setattr(
        tenant_cfg,
        "get_app_config",
        lambda: {"branding": {"companyName": "test-company"}},
    )
    monkeypatch.delenv("COMPANY_NAME", raising=False)
    monkeypatch.delenv("ACTIVE_COMPANY_NAME", raising=False)

    assert tenant_cfg.get_active_company_name() == "test-company"

    monkeypatch.setenv("COMPANY_NAME", "Acme Corp")
    assert tenant_cfg.get_active_company_name() == "Acme Corp"


def test_setup_assistant_redaction_and_cli_check():
    setup_assistant = _load_setup_assistant_module()
    redact_sensitive_text = setup_assistant.redact_sensitive_text

    sample_key = "AIza" + "SySampleSecretKeyForRedactionTest123"
    sample_email = "user@" + "google.com"
    sample_path = "/" + "Users/someuser/repo"
    raw_text = f"key={sample_key} contact={sample_email} dir={sample_path}"

    redacted = redact_sensitive_text(raw_text)
    assert sample_key not in redacted
    assert "AIza" not in redacted
    assert sample_email not in redacted
    assert sample_path not in redacted
    assert "someuser" not in redacted

    proc = subprocess.run(
        [sys.executable, str(ROOT_DIR / "scripts" / "setup_assistant.py"), "--check"],
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0
    leaked_key_re = re.compile("AIza" + r"[0-9A-Za-z_-]{5,}")
    assert leaked_key_re.search(proc.stdout) is None

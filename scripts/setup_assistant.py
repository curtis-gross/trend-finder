#!/usr/bin/env python3
"""Interactive Client Setup & Configuration Assistant for trend-finder."""

from __future__ import annotations

import argparse, json, os, re, shutil, subprocess, sys, urllib.error, urllib.request
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
PREFLIGHT_SCRIPT = ROOT_DIR / "scripts" / "gcp_preflight.sh"
DEFAULT_MODEL = os.environ.get("SETUP_ASSISTANT_MODEL", "gemini-3.5-flash-lite")
FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite"]

AI_STUDIO_PRIVACY_NOTICE = (
    "Using Google AI Studio Free Endpoint (gemini-3.5-flash-lite) for redacted "
    "setup guidance only. Secret values and customer data are never sent. "
    "Keep production trend-finder runtime on Vertex AI."
)

# Strict allowlist of commands offered after [y/N] (excludes cloud_run.sh).
ALLOWED_COMMANDS: dict[str, list[str]] = {
    "1": ["./scripts/gcp_setup.sh"], "gcp_setup": ["./scripts/gcp_setup.sh"],
    "2": ["./scripts/configure_client.sh"], "configure_client": ["./scripts/configure_client.sh"],
    "3": ["./scripts/server_control.sh", "start", "--daemon"], "start_server": ["./scripts/server_control.sh", "start", "--daemon"],
    "4": ["./scripts/audit_privacy.sh"], "audit_privacy": ["./scripts/audit_privacy.sh"],
}

_API_KEY_RE = re.compile(r"AIza" + r"[0-9A-Za-z_-]+")
_OAUTH_RE = re.compile(r"ya29\." + r"[0-9A-Za-z_-]+")
_CLIENT_SECRET_RE = re.compile(r"GOCSPX-" + r"[0-9A-Za-z_-]+")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_HOME_PATH_RE = re.compile(r"/(?:Users|home)/[A-Za-z0-9._-]+")
_ENV_SECRET_RE = re.compile(r"((?:API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*)([^\s\"'#]+)", re.I)


def redact_sensitive_text(text: str) -> str:
    """Strip API keys, OAuth tokens, client secrets, emails, and workstation paths."""
    if not text:
        return ""
    out = _API_KEY_RE.sub("[REDACTED_API_KEY]", str(text))
    out = _OAUTH_RE.sub("[REDACTED_OAUTH_TOKEN]", out)
    out = _CLIENT_SECRET_RE.sub("[REDACTED_CLIENT_SECRET]", out)
    out = _EMAIL_RE.sub("[REDACTED_EMAIL]", out)
    out = _HOME_PATH_RE.sub("[REDACTED_HOME]", out)
    return _ENV_SECRET_RE.sub(r"\1[REDACTED_SECRET]", out)


def _load_env_map() -> dict[str, str]:
    """Read key-value pairs from .env without exposing secret values to stdout."""
    env_map: dict[str, str] = {}
    env_path = ROOT_DIR / ".env"
    if env_path.is_file():
        for raw in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[len("export ") :].strip()
            k, v = line.split("=", 1)
            env_map[k.strip()] = v.strip().strip("'").strip('"')
    for k, v in os.environ.items():
        if v:
            env_map[k] = v
    return env_map


def _is_set(val: str | None) -> bool:
    cleaned = (val or "").strip()
    return bool(cleaned) and not cleaned.lower().startswith("your-")


def _fallback_preflight(env_map: dict[str, str]) -> dict[str, Any]:
    """Safe local fallback readiness check if gcp_preflight.sh is unavailable."""
    return {
        "node_installed": bool(shutil.which("node")), "npm_installed": bool(shutil.which("npm")),
        "python3_installed": bool(shutil.which("python3")), "gcloud_installed": bool(shutil.which("gcloud")),
        "venv_ready": (ROOT_DIR / ".venv" / "bin" / "python").is_file(),
        "node_modules_ready": (ROOT_DIR / "node_modules").is_dir(),
        "env_file_exists": (ROOT_DIR / ".env").is_file(),
        "has_gcp_project": _is_set(env_map.get("GCP_PROJECT")),
        "has_gcs_bucket": _is_set(env_map.get("GCS_BUCKET_NAME")),
        "has_company_name": _is_set(env_map.get("COMPANY_NAME")),
        "has_google_cloud_api_key": _is_set(env_map.get("GOOGLE_CLOUD_API_KEY")),
        "has_ai_studio_api_key": _is_set(env_map.get("AI_STUDIO_API_KEY")),
        "has_gemini_api_key": _is_set(env_map.get("GEMINI_API_KEY")),
        "has_youtube_api_key": _is_set(env_map.get("YOUTUBE_API_KEY")),
        "genai_provider": env_map.get("GENAI_PROVIDER", "vertex"),
    }


def run_preflight_checks() -> dict[str, Any]:
    """Invoke ./scripts/gcp_preflight.sh --json --redacted and return redacted dict."""
    base = _fallback_preflight(_load_env_map())
    if PREFLIGHT_SCRIPT.is_file():
        try:
            proc = subprocess.run(
                ["bash", str(PREFLIGHT_SCRIPT), "--json", "--redacted"],
                cwd=str(ROOT_DIR), capture_output=True, text=True, timeout=30, check=False,
            )
            clean_stdout = redact_sensitive_text(proc.stdout.strip())
            if clean_stdout:
                parsed = json.loads(clean_stdout)
                if isinstance(parsed, dict):
                    base.update(parsed)
        except Exception:
            pass
    return json.loads(redact_sensitive_text(json.dumps(base)))


def format_readiness_checklist(state: dict[str, Any]) -> str:
    """Render a concise, human-readable readiness checklist and next steps."""
    b = lambda ok: "[PASS]" if ok else "[TODO]"
    lines = [
        "=== trend-finder Client Setup & Readiness Checklist ===",
        f"  {b(state.get('node_installed') and state.get('npm_installed'))} Node.js & npm installed",
        f"  {b(state.get('python3_installed'))} Python 3 installed",
        f"  {b(state.get('venv_ready'))} Python .venv ready (FastAPI & google-genai)",
        f"  {b(state.get('node_modules_ready'))} Frontend node_modules installed",
        f"  {b(state.get('gcloud_installed'))} Google Cloud SDK (gcloud) installed",
        f"  {b(state.get('env_file_exists'))} Local .env configuration file present",
        f"  {b(state.get('has_gcp_project'))} GCP_PROJECT configured ({'set' if state.get('has_gcp_project') else 'unset'})",
        f"  {b(state.get('has_company_name'))} COMPANY_NAME configured",
        f"  {b(state.get('has_google_cloud_api_key') or state.get('adc_configured'))} Vertex AI auth ready (GOOGLE_CLOUD_API_KEY or ADC)",
        f"  {b(state.get('has_ai_studio_api_key'))} Optional AI_STUDIO_API_KEY for free setup assistant",
        f"  {b(state.get('has_youtube_api_key'))} Optional YOUTUBE_API_KEY configured",
        "",
        "Recommended Next Steps:",
    ]
    if not state.get("has_gcp_project"):
        lines.append("  1. Provision GCP Project, APIs & GCS bucket: ./scripts/gcp_setup.sh")
    if not state.get("env_file_exists") or not state.get("venv_ready"):
        lines.append("  2. Configure .env, brand & install dependencies: ./scripts/configure_client.sh")
    lines.append("  3. Start and verify local server: ./scripts/server_control.sh start --daemon")
    lines.append("  4. Run privacy & secret audit before sharing: ./scripts/audit_privacy.sh")
    return redact_sensitive_text("\n".join(lines))


def _build_system_prompt(state: dict[str, Any]) -> str:
    return (
        "You are the trend-finder Client Setup & Configuration Assistant.\n"
        "Give concise, step-by-step technical guidance based on the redacted preflight JSON.\n"
        "Never ask the user to paste secret API keys into chat. Recommend one of these "
        "allowlisted scripts when relevant:\n"
        "- ./scripts/gcp_setup.sh (provision GCP project, Vertex AI, GCS bucket)\n"
        "- ./scripts/configure_client.sh (create .env, set COMPANY_NAME, build .venv & node_modules)\n"
        "- ./scripts/server_control.sh start --daemon (start & verify local app)\n"
        "- ./scripts/audit_privacy.sh (scan repo for secrets or PII)\n"
        "Explain that AI Studio Free Tier is only for redacted CLI onboarding, while "
        "production trend-finder runs belong on Vertex AI (data governance, 4-worker concurrency, GCS).\n\n"
        f"Redacted Preflight State:\n{json.dumps(state, indent=2)}"
    )


def _is_not_found_error(err: Exception) -> bool:
    msg = str(err).lower()
    return "404" in msg or "not_found" in msg or "not found" in msg


def _call_aistudio_urllib(api_key: str, model: str, system_prompt: str, question: str) -> str:
    """Zero-install stdlib urllib client for Google AI Studio generateContent."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    gen_cfg: dict[str, Any] = {"temperature": 0.2, "maxOutputTokens": 1024}
    if "gemini-3" in model:
        gen_cfg["thinkingConfig"] = {"thinkingLevel": "MINIMAL"}
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": question}]}],
        "generationConfig": gen_cfg,
    }
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"AI Studio HTTP {exc.code} ({model}): {redact_sensitive_text(err_body)}") from exc
    cands = body.get("candidates") or []
    if not cands:
        raise RuntimeError(f"AI Studio returned no candidates for model {model}.")
    parts = (cands[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts if "text" in p).strip()


def _call_aistudio(api_key: str, model: str, system_prompt: str, question: str) -> str:
    """Call Google AI Studio Free Tier via google.genai SDK or stdlib urllib fallback."""
    print(f"ℹ️  {AI_STUDIO_PRIVACY_NOTICE}")
    models_to_try = [model] + [m for m in FALLBACK_MODELS if m != model]
    last_err: Exception | None = None
    for candidate_model in models_to_try:
        try:
            try:
                from google import genai  # type: ignore

                client = genai.Client(vertexai=False, api_key=api_key)
                cfg: dict[str, Any] = {"system_instruction": system_prompt, "temperature": 0.2, "max_output_tokens": 1024}
                if "gemini-3" in candidate_model:
                    cfg["thinking_config"] = {"thinking_level": "MINIMAL"}
                resp = client.models.generate_content(model=candidate_model, contents=question, config=cfg)
                return redact_sensitive_text(resp.text or "")
            except ImportError:
                return redact_sensitive_text(_call_aistudio_urllib(api_key, candidate_model, system_prompt, question))
        except Exception as exc:
            last_err = exc
            if _is_not_found_error(exc) and candidate_model != models_to_try[-1]:
                nxt = models_to_try[models_to_try.index(candidate_model) + 1]
                print(f"⚠️  Model '{candidate_model}' returned 404; trying fallback '{nxt}'...", file=sys.stderr)
                continue
            raise RuntimeError(redact_sensitive_text(str(exc))) from exc
    raise RuntimeError(redact_sensitive_text(str(last_err or "AI Studio request failed.")))


def _call_vertex(env_map: dict[str, str], model: str, system_prompt: str, question: str) -> str:
    """Call Vertex AI using google.genai SDK with API key or Project/ADC."""
    try:
        from google import genai  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "google-genai SDK is not installed yet. Run './scripts/configure_client.sh' "
            "or set AI_STUDIO_API_KEY to use zero-install stdlib mode."
        ) from exc
    gcloud_key = env_map.get("GOOGLE_CLOUD_API_KEY", "")
    project = env_map.get("GCP_PROJECT", "")
    if _is_set(gcloud_key):
        client = genai.Client(vertexai=True, api_key=gcloud_key)
    elif _is_set(project):
        client = genai.Client(vertexai=True, project=project, location="global")
    else:
        raise RuntimeError("Vertex AI requires GOOGLE_CLOUD_API_KEY or GCP_PROJECT in .env / environment.")
    cfg: dict[str, Any] = {"system_instruction": system_prompt, "temperature": 0.2, "max_output_tokens": 1024}
    if "gemini-3" in model:
        cfg["thinking_config"] = {"thinking_level": "MINIMAL"}
    resp = client.models.generate_content(model=model, contents=question, config=cfg)
    return redact_sensitive_text(resp.text or "")


def ask_assistant(question: str, state: dict[str, Any], provider: str = "auto", model: str = DEFAULT_MODEL) -> str:
    """Route a redacted setup question to AI Studio, Vertex AI, or raise explicit error."""
    env_map = _load_env_map()
    clean_question = redact_sensitive_text(question)
    system_prompt = _build_system_prompt(state)
    ai_studio_key = env_map.get("AI_STUDIO_API_KEY") or (
        env_map.get("GEMINI_API_KEY") if env_map.get("GENAI_PROVIDER", "").lower() == "aistudio" else ""
    )
    chosen = provider.lower()
    if chosen == "auto":
        if _is_set(ai_studio_key):
            chosen = "aistudio"
        elif _is_set(env_map.get("GOOGLE_CLOUD_API_KEY")) or _is_set(env_map.get("GCP_PROJECT")):
            chosen = "vertex"
        else:
            chosen = "offline"
    if chosen == "aistudio":
        if not _is_set(ai_studio_key):
            raise RuntimeError("AI_STUDIO_API_KEY is not set. Create a free key at https://aistudio.google.com/apikey")
        return _call_aistudio(ai_studio_key, model, system_prompt, clean_question)
    if chosen == "vertex":
        return _call_vertex(env_map, model, system_prompt, clean_question)
    raise RuntimeError("No AI provider configured. Set AI_STUDIO_API_KEY or configure Vertex AI in .env.")


def suggest_command_key(question: str, state: dict[str, Any]) -> str:
    """Pick the most relevant allowlisted command key for a setup question."""
    q = question.lower()
    if any(w in q for w in ("privacy", "audit", "secret", "export")):
        return "audit_privacy"
    if any(w in q for w in ("start", "server", "run", "port")):
        return "start_server"
    if any(w in q for w in ("gcp", "bucket", "billing")) or not state.get("has_gcp_project"):
        return "gcp_setup"
    return "configure_client"


def confirm_and_run_command(cmd_key: str) -> int:
    """Print exact allowlisted command and require explicit 'y' before running."""
    if cmd_key not in ALLOWED_COMMANDS:
        raise ValueError(f"Command '{cmd_key}' is not in ALLOWED_COMMANDS.")
    cmd = ALLOWED_COMMANDS[cmd_key]
    print(f"\nExact command to run: {' '.join(cmd)}")
    if input("Execute this command now? [y/N]: ").strip().lower() not in ("y", "yes"):
        print("Skipped execution.")
        return 0
    return subprocess.run(cmd, cwd=str(ROOT_DIR), check=False).returncode


def interactive_loop(provider: str, model: str) -> int:
    """Interactive menu walking through preflight, setup scripts, and AI Q&A."""
    state = run_preflight_checks()
    print(format_readiness_checklist(state))
    while True:
        print("\nSelect an action:\n  1. Provision GCP Project/APIs/GCS (./scripts/gcp_setup.sh)\n"
              "  2. Configure Brand & .env (./scripts/configure_client.sh)\n"
              "  3. Start & Verify Local App (./scripts/server_control.sh start --daemon)\n"
              "  4. Run Privacy Audit (./scripts/audit_privacy.sh)\n"
              "  5. Ask Gemini 3.5 Flash-Lite Assistant\n  q. Quit")
        choice = input("\nChoice [1-5/q]: ").strip()
        if not choice or choice.lower() in ("q", "quit", "exit"):
            return 0
        if choice in ("1", "2", "3", "4"):
            confirm_and_run_command(choice)
            state = run_preflight_checks()
        elif choice == "5" or len(choice) > 2:
            question = choice if len(choice) > 2 else input("Ask a setup question: ").strip()
            if not question:
                continue
            try:
                answer = ask_assistant(question, state, provider=provider, model=model)
                cmd_key = suggest_command_key(question, state)
                print(f"\n--- Setup Assistant ({model}) ---\n{answer}\n")
                print(f"Suggested command: {' '.join(ALLOWED_COMMANDS[cmd_key])}")
            except Exception as exc:
                print(f"\n❌ Assistant error: {redact_sensitive_text(str(exc))}", file=sys.stderr)
        else:
            print("Unrecognized selection.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="trend-finder Client Setup Assistant")
    parser.add_argument("--check", action="store_true", help="Run redacted preflight checklist and exit")
    parser.add_argument("--ask", type=str, help="Ask Gemini a setup question using redacted preflight state")
    parser.add_argument("--provider", choices=["auto", "aistudio", "vertex", "offline"], default="auto")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL, help="Gemini model name")
    parser.add_argument("--execute", action="store_true", help="Offer [y/N] to run suggested command")
    args = parser.parse_args(argv)

    state = run_preflight_checks()
    if args.check or (args.provider == "offline" and not args.ask):
        print(format_readiness_checklist(state))
        return 0
    if args.ask:
        try:
            print(ask_assistant(args.ask, state, provider=args.provider, model=args.model))
            cmd_key = suggest_command_key(args.ask, state)
            print(f"\nSuggested allowlisted command: {' '.join(ALLOWED_COMMANDS[cmd_key])}")
            return confirm_and_run_command(cmd_key) if (args.execute and sys.stdin.isatty()) else 0
        except Exception as exc:
            print(f"❌ Setup Assistant Error: {redact_sensitive_text(str(exc))}", file=sys.stderr)
            return 1
    if not sys.stdin.isatty():
        print(format_readiness_checklist(state))
        return 0
    return interactive_loop(provider=args.provider, model=args.model)


if __name__ == "__main__":
    sys.exit(main())

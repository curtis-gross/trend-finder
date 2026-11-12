#!/bin/bash
# ==============================================================================
# scripts/audit_privacy.sh - Privacy, Secret, PII & Clean-Release Audit Scanner
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

TRACKED_ONLY=false
STRICT_GIT_HISTORY=false
ALLOW_CUSTOM_BRAND=false
JSON_MODE=false

usage() {
  cat <<'EOF'
Usage: ./scripts/audit_privacy.sh [options]

Options:
  --tracked-only        Scan only git-tracked files (skip local workspace & git log checks)
  --strict-git-history  Fail (exit 1) on any workspace, worktree, or git history advisory finding
  --allow-custom-brand  Allow non-placeholder companyName in config.ts / app_config.json
  --json                Emit machine-readable JSON report
  --help, -h            Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tracked-only) TRACKED_ONLY=true; shift ;;
    --strict-git-history) STRICT_GIT_HISTORY=true; shift ;;
    --allow-custom-brand) ALLOW_CUSTOM_BRAND=true; shift ;;
    --json) JSON_MODE=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

python3 - "$ROOT_DIR" "$TRACKED_ONLY" "$STRICT_GIT_HISTORY" "$ALLOW_CUSTOM_BRAND" "$JSON_MODE" <<'PY'
import json
import pathlib
import re
import subprocess
import sys

root = pathlib.Path(sys.argv[1])
tracked_only = sys.argv[2].lower() == "true"
strict_history = sys.argv[3].lower() == "true"
allow_custom_brand = sys.argv[4].lower() == "true"
json_mode = sys.argv[5].lower() == "true"

# Construct sensitive patterns via concatenation so this file never self-matches
PATTERNS = [
    ("google_api_key", re.compile("AIza" + r"[0-9A-Za-z_-]{35}")),
    ("oauth_token", re.compile("ya29" + r"\.[0-9A-Za-z_-]{20,}")),
    ("client_secret", re.compile("GOCSPX-" + r"[0-9A-Za-z_-]{10,}")),
    ("private_key", re.compile("-----BEGIN " + r"(?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("workstation_mac_path", re.compile("/" + r"Users/[A-Za-z0-9._-]+")),
    ("workstation_linux_path", re.compile("/" + r"home/[A-Za-z0-9._-]+")),
    ("internal_git_path", re.compile("/usr/local/git/" + "current")),
    ("corp_email", re.compile(r"[A-Za-z0-9._%+-]+@google" + r"\.com\b", re.IGNORECASE)),
    ("internal_term_arg", re.compile(r"\b[Aa]rgo" + r"lis\b")),
    ("internal_sdk_header", re.compile("vertex-agent-studio-" + "getcode", re.IGNORECASE)),
    ("dummy_fallback_secret", re.compile("VERTEX_AI_" + "FALLBACK")),
]

SELF_SKIP_FILES = {
    "scripts/audit_privacy.sh",
    "tests/trend_finder_sanitization_and_contracts.test.ts",
    "tests/test_client_setup_and_privacy.py",
    "scripts/setup_assistant.py",
}

def mask_match(category: str, val: str) -> str:
    if category in {"google_api_key", "oauth_token", "client_secret"} and len(val) > 8:
        return val[:4] + "****" + val[-2:]
    return val

tracked_violations = []
advisories = []

res = subprocess.run(["git", "ls-files"], cwd=root, capture_output=True, text=True, check=False)
tracked_files = [line.strip() for line in res.stdout.splitlines() if line.strip()]

for rel_path in tracked_files:
    fpath = root / rel_path
    if not fpath.is_file():
        continue
    try:
        raw = fpath.read_bytes()
    except OSError:
        continue
    if b"\x00" in raw:
        continue
    text = raw.decode("utf-8", errors="ignore")
    for lineno, line in enumerate(text.splitlines(), start=1):
        if rel_path in SELF_SKIP_FILES and any(
            tok in line for tok in ("re.compile", "new RegExp", "PATTERNS", "redact_sensitive_text", "monkeypatch", "assert ")
        ):
            continue
        for cat, pat in PATTERNS:
            m = pat.search(line)
            if m:
                if cat in {"workstation_mac_path", "workstation_linux_path"} and any(
                    ph in m.group(0) for ph in ("/" + "Users/<", "/" + "home/<", "/" + "Users/your", "/" + "home/your")
                ):
                    continue
                tracked_violations.append({
                    "file": rel_path,
                    "line": lineno,
                    "category": cat,
                    "match": mask_match(cat, m.group(0)),
                })

if not allow_custom_brand:
    app_cfg = root / "public" / "data" / "configuration" / "app_config.json"
    if app_cfg.is_file():
        try:
            cfg_data = json.loads(app_cfg.read_text(encoding="utf-8"))
            b = cfg_data.get("branding", {})
            for key in ("companyName", "workspaceName"):
                val = b.get(key, "")
                if val and val != "test-company":
                    tracked_violations.append({
                        "file": "public/data/configuration/app_config.json",
                        "line": 1,
                        "category": "non_placeholder_brand",
                        "match": f"{key}={val}",
                    })
        except Exception:
            pass

    cfg_ts = root / "config.ts"
    if cfg_ts.is_file():
        ts_text = cfg_ts.read_text(encoding="utf-8", errors="ignore")
        for key in ("companyName", "workspaceName"):
            m = re.search(rf'{key}:\s*"([^"]+)"', ts_text)
            if m and m.group(1) != "test-company":
                tracked_violations.append({
                    "file": "config.ts",
                    "line": 1,
                    "category": "non_placeholder_brand",
                    "match": f"{key}={m.group(1)}",
                })

if not tracked_only:
    if (root / ".env").exists():
        advisories.append("Local .env file exists in workspace (untracked; excluded from git archive)")
    if (root / ".run").exists():
        advisories.append("Runtime .run/ directory exists in workspace (untracked)")
    if (root / ".venv").is_symlink():
        advisories.append("Python .venv is a symbolic link to an external environment")
    if (root / ".git").is_file():
        advisories.append("Repository uses a linked .git worktree file ([ -f .git ])")

    corp_domain = "@google" + ".com"
    log_authors = subprocess.run(
        ["git", "log", "--all", "--format=%ae %ce"],
        cwd=root, capture_output=True, text=True, check=False
    )
    if corp_domain in log_authors.stdout.lower():
        advisories.append(f"Git commit history contains {corp_domain} author/committer emails")

    key_regex = "AIza" + "[0-9A-Za-z_-]{35}"
    log_keys = subprocess.run(
        ["git", "log", f"-G{key_regex}", "--oneline", "-n", "1"],
        cwd=root, capture_output=True, text=True, check=False
    )
    if log_keys.stdout.strip():
        advisories.append("Git commit history contains historical API key patterns")

tracked_clean = len(tracked_violations) == 0
passed = tracked_clean and (not strict_history or len(advisories) == 0)

if json_mode:
    print(json.dumps({
        "passed": passed,
        "tracked_clean": tracked_clean,
        "tracked_only": tracked_only,
        "strict_git_history": strict_history,
        "tracked_violations": tracked_violations,
        "advisories": advisories,
    }, indent=2))
else:
    print("======================================================================")
    print("🔒 Trend Finder Privacy, Secret & Sanitization Audit")
    print("======================================================================")
    if tracked_clean:
        print(f"✅ Tracked Files Gate: PASS ({len(tracked_files)} tracked files scanned, 0 violations)")
    else:
        print(f"❌ Tracked Files Gate: FAIL ({len(tracked_violations)} violation(s) found)")
        for v in tracked_violations:
            print(f"   • [VIOLATION] {v['file']}:{v['line']} ({v['category']}): {v['match']}")

    if not tracked_only:
        for adv in advisories:
            prefix = "❌ [STRICT-FAIL]" if strict_history else "⚠️  [ADVISORY]"
            print(f"   {prefix} {adv}")
        if advisories and not strict_history:
            print("   💡 Tip: Run './scripts/export_clean_release.sh --output ../trend-finder-clean --init-git'")
            print("           to package a standalone copy with zero git history or workspace artifacts.")
    print("======================================================================")

sys.exit(0 if passed else 1)
PY

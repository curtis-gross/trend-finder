#!/bin/bash
# ==============================================================================
# scripts/configure_client.sh - Client Local Environment & .env Configurator
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

COMPANY="" PROJECT="" REGION="" BUCKET="" PROVIDER=""
YOUTUBE_KEY="" CLOUD_API_KEY="" AI_STUDIO_KEY=""
APPLY_BRANDING=false RESET_BRANDING=false CHECK_ONLY=false AUTO_YES=false

usage() {
  cat <<'EOF'
Usage: ./scripts/configure_client.sh [options]

Options:
  --company <name>              Active brand / company name (writes COMPANY_NAME in .env)
  --project <id>                Google Cloud Project ID (GCP_PROJECT)
  --region <region>             Google Cloud region (default: us-central1)
  --bucket <name>               Google Cloud Storage bucket name (GCS_BUCKET_NAME)
  --provider <vertex|aistudio>  GenAI provider mode (default: vertex)
  --youtube-key <key>           YouTube Data API v3 key (YOUTUBE_API_KEY)
  --cloud-api-key <key>         Google Cloud / Vertex AI API key (GOOGLE_CLOUD_API_KEY)
  --ai-studio-key <key>         Google AI Studio API key (AI_STUDIO_API_KEY)
  --apply-branding              Also write company name into config.ts & app_config.json
  --reset-branding              Restore "test-company" placeholder in config.ts & app_config.json
  --check-only                  Run preflight diagnostic check and exit
  --yes, -y                     Non-interactive mode (accept defaults and skip prompts)
  --help, -h                    Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --company) COMPANY="${2:-}"; shift 2 ;;
    --project) PROJECT="${2:-}"; shift 2 ;;
    --region) REGION="${2:-}"; shift 2 ;;
    --bucket) BUCKET="${2:-}"; shift 2 ;;
    --provider) PROVIDER="${2:-}"; shift 2 ;;
    --youtube-key) YOUTUBE_KEY="${2:-}"; shift 2 ;;
    --cloud-api-key) CLOUD_API_KEY="${2:-}"; shift 2 ;;
    --ai-studio-key) AI_STUDIO_KEY="${2:-}"; shift 2 ;;
    --apply-branding) APPLY_BRANDING=true; shift ;;
    --reset-branding) RESET_BRANDING=true; shift ;;
    --check-only) CHECK_ONLY=true; shift ;;
    --yes|-y) AUTO_YES=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

update_branding_files() {
  local TARGET_BRAND="$1"
  python3 - "$ROOT_DIR" "$TARGET_BRAND" <<'PY'
import json, pathlib, re, sys

root = pathlib.Path(sys.argv[1])
brand = sys.argv[2]

app_cfg_path = root / "public" / "data" / "configuration" / "app_config.json"
if app_cfg_path.exists():
    data = json.loads(app_cfg_path.read_text(encoding="utf-8"))
    b = data.setdefault("branding", {})
    b["companyName"] = brand
    b["workspaceName"] = brand
    b["metaTitle"] = f"{brand} | Trend Intelligence"
    b["metaDescription"] = f"Trend Intelligence and Deep Media Listening platform for {brand}"
    app_cfg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

cfg_ts_path = root / "config.ts"
if cfg_ts_path.exists():
    text = cfg_ts_path.read_text(encoding="utf-8")
    text = re.sub(r'(companyName:\s*)"[^"]*"', lambda m: f'{m.group(1)}"{brand}"', text)
    text = re.sub(r'(workspaceName:\s*)"[^"]*"', lambda m: f'{m.group(1)}"{brand}"', text)
    text = re.sub(r'(title:\s*)"[^"]* \| Trend Intelligence"', lambda m: f'{m.group(1)}"{brand} | Trend Intelligence"', text)
    text = re.sub(r'(welcomeTitle:\s*)"[^"]* \| Trend Intelligence"', lambda m: f'{m.group(1)}"{brand} | Trend Intelligence"', text)
    text = re.sub(r'(Trend Intelligence and Deep Media Listening platform for )[^—"]+( —)', lambda m: f'{m.group(1)}{brand}{m.group(2)}', text)
    text = re.sub(r'(privateBrands:\s*\[)"[^"]*"(\])', lambda m: f'{m.group(1)}"{brand}"{m.group(2)}', text)
    text = re.sub(r'(tags:\s*\[\s*)"[^"]*"', lambda m: f'{m.group(1)}"{brand}"', text)
    cfg_ts_path.write_text(text, encoding="utf-8")
PY
}

if [ "$RESET_BRANDING" = true ]; then
  update_branding_files "test-company"
  echo "✅ Restored 'test-company' branding in config.ts and public/data/configuration/app_config.json."
  exit 0
fi

if [ -f "$ROOT_DIR/scripts/gcp_preflight.sh" ]; then
  bash "$ROOT_DIR/scripts/gcp_preflight.sh" || true
fi

if [ "$CHECK_ONLY" = true ]; then
  exit 0
fi

if [ ! -x "$ROOT_DIR/.venv/bin/python" ] || ! "$ROOT_DIR/.venv/bin/python" -c "import fastapi, uvicorn" >/dev/null 2>&1; then
  echo "⚠️  Python .venv is missing or incomplete."
  DO_VENV=false
  if [ "$AUTO_YES" = true ]; then
    DO_VENV=true
  elif [ -t 0 ]; then
    read -r -p "Create/repair .venv and install requirements.txt now? [y/N]: " ans
    [[ "${ans:-N}" =~ ^[Yy]$ ]] && DO_VENV=true
  fi
  if [ "$DO_VENV" = true ]; then
    [ -L "$ROOT_DIR/.venv" ] && [ ! -e "$ROOT_DIR/.venv" ] && rm -f "$ROOT_DIR/.venv"
    python3 -m venv "$ROOT_DIR/.venv" && "$ROOT_DIR/.venv/bin/pip" install --upgrade pip -r "$ROOT_DIR/requirements.txt"
  fi
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "⚠️  node_modules is missing."
  DO_NPM=false
  if [ "$AUTO_YES" = true ]; then
    DO_NPM=true
  elif [ -t 0 ]; then
    read -r -p "Run 'npm install' now? [y/N]: " ans
    [[ "${ans:-N}" =~ ^[Yy]$ ]] && DO_NPM=true
  fi
  [ "$DO_NPM" = true ] && npm install
fi

clean_val() {
  local v="${1:-}"
  if [[ "$v" == your-* ]] || [ "$v" = "(unset)" ]; then
    echo ""
  else
    echo "$v"
  fi
}

mask_secret() {
  local s="${1:-}"
  if [ -z "$s" ]; then
    echo "(not set)"
  elif [ "${#s}" -le 6 ]; then
    echo "****"
  else
    echo "${s:0:4}****${s: -2}"
  fi
}

EXISTING_COMPANY=""
EXISTING_PROJECT=""
EXISTING_REGION="us-central1"
EXISTING_BUCKET=""
EXISTING_PROVIDER="vertex"
EXISTING_YOUTUBE_KEY=""
EXISTING_CLOUD_KEY=""
EXISTING_STUDIO_KEY=""
EXISTING_PORT="8080"
EXISTING_VITE_PORT="3000"
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env" 2>/dev/null || true
  set +a
  EXISTING_COMPANY="$(clean_val "${COMPANY_NAME:-}")"
  EXISTING_PROJECT="$(clean_val "${GCP_PROJECT:-}")"
  EXISTING_REGION="$(clean_val "${GCP_REGION:-us-central1}")"
  EXISTING_BUCKET="$(clean_val "${GCS_BUCKET_NAME:-}")"
  EXISTING_PROVIDER="$(clean_val "${GENAI_PROVIDER:-vertex}")"
  EXISTING_YOUTUBE_KEY="$(clean_val "${YOUTUBE_API_KEY:-}")"
  EXISTING_CLOUD_KEY="$(clean_val "${GOOGLE_CLOUD_API_KEY:-}")"
  EXISTING_STUDIO_KEY="$(clean_val "${AI_STUDIO_API_KEY:-}")"
  EXISTING_PORT="${PORT:-8080}"
  EXISTING_VITE_PORT="${VITE_PORT:-3000}"
fi
if [ -z "$EXISTING_PROJECT" ] && command -v gcloud >/dev/null 2>&1; then
  EXISTING_PROJECT="$(clean_val "$(gcloud config get-value project 2>/dev/null || true)")"
fi
COMPANY="${COMPANY:-${EXISTING_COMPANY:-test-company}}"
PROVIDER="${PROVIDER:-${EXISTING_PROVIDER:-vertex}}"
PROJECT="${PROJECT:-$EXISTING_PROJECT}"
REGION="${REGION:-${EXISTING_REGION:-us-central1}}"
YOUTUBE_KEY="${YOUTUBE_KEY:-$EXISTING_YOUTUBE_KEY}"
CLOUD_API_KEY="${CLOUD_API_KEY:-$EXISTING_CLOUD_KEY}"
AI_STUDIO_KEY="${AI_STUDIO_KEY:-$EXISTING_STUDIO_KEY}"

if [ -t 0 ] && [ "$AUTO_YES" = false ]; then
  read -r -p "Company / Brand Name [$COMPANY]: " in_co
  COMPANY="${in_co:-$COMPANY}"
  read -r -p "GenAI Provider (vertex|aistudio) [$PROVIDER]: " in_pr
  PROVIDER="${in_pr:-$PROVIDER}"
  read -r -p "Google Cloud Project ID [${PROJECT:-none}]: " in_pj
  PROJECT="${in_pj:-$PROJECT}"
  read -r -p "Google Cloud Region [$REGION]: " in_rg
  REGION="${in_rg:-$REGION}"
  DEFAULT_BKT="${BUCKET:-${EXISTING_BUCKET:-${PROJECT:+${PROJECT}-trend-gcs}}}"
  read -r -p "GCS Bucket Name [${DEFAULT_BKT:-none}]: " in_bk
  BUCKET="${in_bk:-$DEFAULT_BKT}"
  read -r -p "Google Cloud / Vertex API Key [$(mask_secret "$CLOUD_API_KEY")]: " in_ck
  CLOUD_API_KEY="${in_ck:-$CLOUD_API_KEY}"
  read -r -p "YouTube Data API v3 Key [$(mask_secret "$YOUTUBE_KEY")]: " in_yk
  YOUTUBE_KEY="${in_yk:-$YOUTUBE_KEY}"
  read -r -p "Google AI Studio Key (optional) [$(mask_secret "$AI_STUDIO_KEY")]: " in_ak
  AI_STUDIO_KEY="${in_ak:-$AI_STUDIO_KEY}"
else
  BUCKET="${BUCKET:-${EXISTING_BUCKET:-${PROJECT:+${PROJECT}-trend-gcs}}}"
fi

PROVIDER="$(echo "$PROVIDER" | tr '[:upper:]' '[:lower:]')"
[ "$PROVIDER" != "aistudio" ] && [ "$PROVIDER" != "auto" ] && PROVIDER="vertex"

echo ""
echo "======================================================================"
echo "📋 Planned .env Configuration Summary (Secrets Redacted)"
echo "======================================================================"
echo "  COMPANY_NAME         = $COMPANY"
echo "  GENAI_PROVIDER       = $PROVIDER"
echo "  GCP_PROJECT          = ${PROJECT:-(not set)}"
echo "  GCP_REGION           = $REGION"
echo "  GCS_BUCKET_NAME      = ${BUCKET:-(not set)}"
echo "  GOOGLE_CLOUD_API_KEY = $(mask_secret "$CLOUD_API_KEY")"
echo "  YOUTUBE_API_KEY      = $(mask_secret "$YOUTUBE_KEY")"
echo "  AI_STUDIO_API_KEY    = $(mask_secret "$AI_STUDIO_KEY")"
echo "  PORT / VITE_PORT     = $EXISTING_PORT / $EXISTING_VITE_PORT"
echo "======================================================================"

if [ -t 0 ] && [ "$AUTO_YES" = false ]; then
  read -r -p "Write this configuration to .env? [y/N]: " confirm_write
  if [[ ! "${confirm_write:-N}" =~ ^[Yy]$ ]]; then
    echo "Aborted without modifying .env."
    exit 0
  fi
fi

if [ -f "$ROOT_DIR/.env" ]; then
  BACKUP_PATH="$ROOT_DIR/.env.bak.$(date +%Y%m%d_%H%M%S)"
  cp "$ROOT_DIR/.env" "$BACKUP_PATH"
  echo "📦 Backed up existing .env to $(basename "$BACKUP_PATH")"
fi

cat > "$ROOT_DIR/.env" <<EOF
# ==============================================================================
# Trend Finder - Local Client Environment Configuration
# Generated by ./scripts/configure_client.sh (Never commit .env to git)
# ==============================================================================
GCP_PROJECT=${PROJECT}
GCP_REGION=${REGION}
GCS_BUCKET_NAME=${BUCKET}
COMPANY_NAME="${COMPANY}"
GENAI_PROVIDER=${PROVIDER}
GOOGLE_CLOUD_API_KEY=${CLOUD_API_KEY}
YOUTUBE_API_KEY=${YOUTUBE_KEY}
AI_STUDIO_API_KEY=${AI_STUDIO_KEY}
PORT=${EXISTING_PORT}
VITE_PORT=${EXISTING_VITE_PORT}
EOF

echo "✅ Wrote .env configuration."

if [ "$APPLY_BRANDING" = true ]; then
  update_branding_files "$COMPANY"
  echo "🎨 Updated config.ts and public/data/configuration/app_config.json with brand '$COMPANY'."
  echo "⚠️  Reminder: Run './scripts/configure_client.sh --reset-branding' before committing to git."
fi

if [ -t 0 ] && [ "$AUTO_YES" = false ] && [ -x "$ROOT_DIR/scripts/server_control.sh" ]; then
  read -r -p "Would you like to start and verify the local server now? [y/N]: " start_ans
  if [[ "${start_ans:-N}" =~ ^[Yy]$ ]]; then
    "$ROOT_DIR/scripts/server_control.sh" start --daemon
  fi
fi

#!/bin/bash
# ==============================================================================
# scripts/gcp_preflight.sh - Read-Only Local & GCP Readiness Diagnostic Tool
# Supports: --json, --redacted, --help. Always exits 0; never prints secrets.
# ==============================================================================

set -u

JSON_MODE=0
REDACTED_MODE=0

for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=1 ;;
    --redacted) REDACTED_MODE=1 ;;
    -h|--help)
      echo "Usage: ./scripts/gcp_preflight.sh [--json] [--redacted]"
      exit 0
      ;;
  esac
done

if [ -z "${CLOUDSDK_PYTHON:-}" ]; then
  for py_bin in "/opt/homebrew/bin/python3.13" "/opt/homebrew/bin/python3.12" "/opt/homebrew/bin/python3.11" "/usr/local/bin/python3" "/usr/bin/python3" "python3"; do
    if command -v "$py_bin" >/dev/null 2>&1; then
      export CLOUDSDK_PYTHON
      CLOUDSDK_PYTHON="$(command -v "$py_bin")"
      break
    fi
  done
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

is_real_value() {
  local val="${1:-}"
  val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [ -z "$val" ] || [ "$val" = "(unset)" ] || [ "$val" = "null" ] || [ "$val" = "none" ]; then
    return 1
  fi
  case "$val" in
    your-*|YOUR-*|\<*\>|placeholder*) return 1 ;;
  esac
  return 0
}

read_env_var() {
  local key="$1" val=""
  if [ -f "$ENV_FILE" ]; then
    local line
    line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$ENV_FILE" 2>/dev/null | tail -n 1 || true)"
    if [ -n "$line" ]; then
      val="${line#*=}"
      val="$(printf '%s' "$val" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      val="${val#\"}"; val="${val%\"}"; val="${val#\'}"; val="${val%\'}"
    fi
  fi
  [ -z "$val" ] && [ -n "${!key:-}" ] && val="${!key}"
  printf '%s' "$val"
}

redact_stream() {
  if [ "$REDACTED_MODE" -eq 1 ]; then
    sed -E \
      -e 's|/[U]sers/[A-Za-z0-9._-]+|/REDACTED_HOME|g' \
      -e 's|/[h]ome/[A-Za-z0-9._-]+|/REDACTED_HOME|g' \
      -e 's|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[REDACTED_EMAIL]|g' \
      -e 's|[A]Iza[0-9A-Za-z_-]{10,}|[REDACTED_KEY]|g' \
      -e 's|ya29\.[0-9A-Za-z_-]{10,}|[REDACTED_TOKEN]|g' \
      -e 's|GOCSPX-[0-9A-Za-z_-]{10,}|[REDACTED_SECRET]|g'
  else
    cat
  fi
}

NODE_INSTALLED=false; command -v node >/dev/null 2>&1 && NODE_INSTALLED=true
NPM_INSTALLED=false; command -v npm >/dev/null 2>&1 && NPM_INSTALLED=true
PYTHON3_INSTALLED=false; PYTHON3_VERSION=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON3_INSTALLED=true
  PYTHON3_VERSION="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")' 2>/dev/null || true)"
fi

VENV_READY=false
if [ -x "$REPO_ROOT/.venv/bin/python" ] && "$REPO_ROOT/.venv/bin/python" -c "import fastapi; from google import genai" >/dev/null 2>&1; then
  VENV_READY=true
fi

NODE_MODULES_READY=false
[ -d "$REPO_ROOT/node_modules" ] && [ -x "$REPO_ROOT/node_modules/.bin/vite" ] && NODE_MODULES_READY=true

ENV_FILE_EXISTS=false; [ -f "$ENV_FILE" ] && ENV_FILE_EXISTS=true
RAW_GCP_PROJECT="$(read_env_var GCP_PROJECT)"
[ -z "$RAW_GCP_PROJECT" ] && RAW_GCP_PROJECT="$(read_env_var GOOGLE_CLOUD_PROJECT)"
RAW_GCS_BUCKET="$(read_env_var GCS_BUCKET_NAME)"
RAW_COMPANY_NAME="$(read_env_var COMPANY_NAME)"
[ -z "$RAW_COMPANY_NAME" ] && RAW_COMPANY_NAME="$(read_env_var ACTIVE_COMPANY_NAME)"
RAW_GCLOUD_KEY="$(read_env_var GOOGLE_CLOUD_API_KEY)"
RAW_AISTUDIO_KEY="$(read_env_var AI_STUDIO_API_KEY)"
RAW_GEMINI_KEY="$(read_env_var GEMINI_API_KEY)"
RAW_YOUTUBE_KEY="$(read_env_var YOUTUBE_API_KEY)"
RAW_GENAI_PROVIDER="$(read_env_var GENAI_PROVIDER)"

HAS_GCP_PROJECT=false; is_real_value "$RAW_GCP_PROJECT" && HAS_GCP_PROJECT=true
HAS_GCS_BUCKET=false; is_real_value "$RAW_GCS_BUCKET" && HAS_GCS_BUCKET=true
HAS_COMPANY_NAME=false; is_real_value "$RAW_COMPANY_NAME" && HAS_COMPANY_NAME=true
HAS_GOOGLE_CLOUD_API_KEY=false; is_real_value "$RAW_GCLOUD_KEY" && HAS_GOOGLE_CLOUD_API_KEY=true
HAS_AI_STUDIO_API_KEY=false; is_real_value "$RAW_AISTUDIO_KEY" && HAS_AI_STUDIO_API_KEY=true
HAS_GEMINI_API_KEY=false; is_real_value "$RAW_GEMINI_KEY" && HAS_GEMINI_API_KEY=true
HAS_YOUTUBE_API_KEY=false; is_real_value "$RAW_YOUTUBE_KEY" && HAS_YOUTUBE_API_KEY=true

GENAI_PROVIDER="auto"
if is_real_value "$RAW_GENAI_PROVIDER"; then
  LOWER_PROV="$(printf '%s' "$RAW_GENAI_PROVIDER" | tr '[:upper:]' '[:lower:]')"
  case "$LOWER_PROV" in
    vertex|aistudio|auto) GENAI_PROVIDER="$LOWER_PROV" ;;
  esac
fi

GCLOUD_INSTALLED=false; GCLOUD_AUTHENTICATED=false; ADC_CONFIGURED=false
GCP_PROJECT=""; BILLING_ENABLED=false; GCS_BUCKET=""; GCS_BUCKET_EXISTS=false; ENABLED_APIS_STR=""

if command -v gcloud >/dev/null 2>&1; then
  GCLOUD_INSTALLED=true
  ACTIVE_ACCT="$(gcloud auth list --filter=status:ACTIVE --format="value(account)" --quiet 2>/dev/null | head -n 1 || true)"
  [ -n "$ACTIVE_ACCT" ] && GCLOUD_AUTHENTICATED=true
  gcloud auth application-default print-access-token --quiet >/dev/null 2>&1 && ADC_CONFIGURED=true
fi

if [ "$HAS_GCP_PROJECT" = true ]; then
  GCP_PROJECT="$RAW_GCP_PROJECT"
elif [ "$GCLOUD_INSTALLED" = true ]; then
  CFG_PROJ="$(gcloud config get-value project --quiet 2>/dev/null | tr -d '\r\n' || true)"
  is_real_value "$CFG_PROJ" && GCP_PROJECT="$CFG_PROJ"
fi

if [ "$HAS_GCS_BUCKET" = true ]; then
  GCS_BUCKET="$RAW_GCS_BUCKET"
elif [ -n "$GCP_PROJECT" ]; then
  GCS_BUCKET="${GCP_PROJECT}-trend-gcs"
fi

if [ "$GCLOUD_INSTALLED" = true ] && [ "$GCLOUD_AUTHENTICATED" = true ] && [ -n "$GCP_PROJECT" ]; then
  BILL_VAL="$(gcloud billing projects describe "$GCP_PROJECT" --format="value(billingEnabled)" --quiet 2>/dev/null | tr -d '\r\n' || true)"
  [ "$(printf '%s' "$BILL_VAL" | tr '[:upper:]' '[:lower:]')" = "true" ] && BILLING_ENABLED=true
  ENABLED_APIS_STR="$(gcloud services list --enabled --project="$GCP_PROJECT" --format="value(config.name)" --quiet 2>/dev/null || true)"
  if [ -n "$GCS_BUCKET" ] && gcloud storage buckets describe "gs://${GCS_BUCKET}" --project="$GCP_PROJECT" --quiet >/dev/null 2>&1; then
    GCS_BUCKET_EXISTS=true
  fi
fi

CORE_APIS=("aiplatform.googleapis.com" "storage.googleapis.com")
CLOUD_RUN_APIS=("run.googleapis.com" "cloudbuild.googleapis.com" "artifactregistry.googleapis.com" "secretmanager.googleapis.com")
MISSING_CORE=(); MISSING_RUN=()
for api in "${CORE_APIS[@]}"; do
  printf '%s\n' "$ENABLED_APIS_STR" | grep -Fxq "$api" || MISSING_CORE+=("$api")
done
for api in "${CLOUD_RUN_APIS[@]}"; do
  printf '%s\n' "$ENABLED_APIS_STR" | grep -Fxq "$api" || MISSING_RUN+=("$api")
done

YOUTUBE_API_ENABLED=false
printf '%s\n' "$ENABLED_APIS_STR" | grep -Fxq "youtube.googleapis.com" && YOUTUBE_API_ENABLED=true

to_json_array() {
  local out="[" sep="" item
  for item in "$@"; do
    [ -z "$item" ] && continue
    out="${out}${sep}\"${item}\""; sep=", "
  done
  printf '%s]' "$out"
}

ENABLED_APIS_ARR=()
while IFS= read -r line; do
  [ -n "$line" ] && ENABLED_APIS_ARR+=("$line")
done <<< "$ENABLED_APIS_STR"

if [ "$JSON_MODE" -eq 1 ]; then
  cat <<EOF | redact_stream
{
  "node_installed": ${NODE_INSTALLED},
  "npm_installed": ${NPM_INSTALLED},
  "python3_installed": ${PYTHON3_INSTALLED},
  "python3_version": "${PYTHON3_VERSION}",
  "venv_ready": ${VENV_READY},
  "node_modules_ready": ${NODE_MODULES_READY},
  "gcloud_installed": ${GCLOUD_INSTALLED},
  "gcloud_authenticated": ${GCLOUD_AUTHENTICATED},
  "adc_configured": ${ADC_CONFIGURED},
  "gcp_project": "${GCP_PROJECT}",
  "billing_enabled": ${BILLING_ENABLED},
  "enabled_apis": $(to_json_array "${ENABLED_APIS_ARR[@]+"${ENABLED_APIS_ARR[@]}"}"),
  "missing_core_apis": $(to_json_array "${MISSING_CORE[@]+"${MISSING_CORE[@]}"}"),
  "missing_cloud_run_apis": $(to_json_array "${MISSING_RUN[@]+"${MISSING_RUN[@]}"}"),
  "youtube_api_enabled": ${YOUTUBE_API_ENABLED},
  "gcs_bucket": "${GCS_BUCKET}",
  "gcs_bucket_exists": ${GCS_BUCKET_EXISTS},
  "env_file_exists": ${ENV_FILE_EXISTS},
  "has_gcp_project": ${HAS_GCP_PROJECT},
  "has_gcs_bucket": ${HAS_GCS_BUCKET},
  "has_company_name": ${HAS_COMPANY_NAME},
  "has_google_cloud_api_key": ${HAS_GOOGLE_CLOUD_API_KEY},
  "has_ai_studio_api_key": ${HAS_AI_STUDIO_API_KEY},
  "has_gemini_api_key": ${HAS_GEMINI_API_KEY},
  "has_youtube_api_key": ${HAS_YOUTUBE_API_KEY},
  "genai_provider": "${GENAI_PROVIDER}"
}
EOF
  exit 0
fi

{
  echo "===================================================================="
  echo "  Trend Finder - Environment & GCP Preflight Diagnostics"
  echo "===================================================================="
  echo "Local Toolchain:"
  echo "  node_installed:            ${NODE_INSTALLED}"
  echo "  npm_installed:             ${NPM_INSTALLED}"
  echo "  python3_installed:         ${PYTHON3_INSTALLED} (${PYTHON3_VERSION:-none})"
  echo "  venv_ready:                ${VENV_READY}"
  echo "  node_modules_ready:        ${NODE_MODULES_READY}"
  echo "Configuration (.env presence flags only):"
  echo "  env_file_exists:           ${ENV_FILE_EXISTS}"
  echo "  has_gcp_project:           ${HAS_GCP_PROJECT}"
  echo "  has_gcs_bucket:            ${HAS_GCS_BUCKET}"
  echo "  has_company_name:          ${HAS_COMPANY_NAME}"
  echo "  genai_provider:            ${GENAI_PROVIDER}"
  echo "  has_google_cloud_api_key:  ${HAS_GOOGLE_CLOUD_API_KEY}"
  echo "  has_ai_studio_api_key:     ${HAS_AI_STUDIO_API_KEY}"
  echo "  has_gemini_api_key:        ${HAS_GEMINI_API_KEY}"
  echo "  has_youtube_api_key:       ${HAS_YOUTUBE_API_KEY}"
  echo "Google Cloud & Vertex AI:"
  echo "  gcloud_installed:          ${GCLOUD_INSTALLED}"
  echo "  gcloud_authenticated:      ${GCLOUD_AUTHENTICATED}"
  echo "  adc_configured:            ${ADC_CONFIGURED}"
  echo "  gcp_project:               ${GCP_PROJECT:-(unset)}"
  echo "  billing_enabled:           ${BILLING_ENABLED}"
  echo "  missing_core_apis:         ${MISSING_CORE[*]:-none}"
  echo "  missing_cloud_run_apis:    ${MISSING_RUN[*]:-none}"
  echo "  youtube_api_enabled:       ${YOUTUBE_API_ENABLED}"
  echo "  gcs_bucket:                ${GCS_BUCKET:-(unset)}"
  echo "  gcs_bucket_exists:         ${GCS_BUCKET_EXISTS}"
  echo "===================================================================="
} | redact_stream

exit 0

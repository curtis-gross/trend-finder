#!/bin/bash
# ==============================================================================
# start_local.sh - test-company Trend Intelligence (trend-finder) Local Startup
# Starts full auto-reload stack:
#   1) FastAPI + Uvicorn (--reload on backend/** + main.py/.env* supervisor) on :8080
#   2) Incremental Vite bundle watcher (vite build --watch) syncing dist/ in ~1s
#   3) Live Vite HMR dev server (vite) on :3000 proxying /api -> :8080
# ==============================================================================

if [ -z "$CLOUDSDK_PYTHON" ]; then
    for py_bin in "/opt/homebrew/bin/python3.15" "/opt/homebrew/bin/python3.11" "/usr/local/bin/python3" "/usr/bin/python3" "python3" "python"; do
        if command -v "$py_bin" &> /dev/null; then
            PY_VER=$("$py_bin" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)
            if [[ "$PY_VER" =~ ^3\.(15|11|12|13|10)$ ]]; then
                export CLOUDSDK_PYTHON=$(command -v "$py_bin")
                break
            fi
        fi
    done
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

DAEMON_MODE=false
AUTO_YES=false
for arg in "$@"; do
  case "$arg" in
    --daemon|-d)
      DAEMON_MODE=true
      ;;
    --yes|-y|--non-interactive)
      AUTO_YES=true
      ;;
  esac
done

if [ -f "$SCRIPT_DIR/.env" ]; then
  echo "Loading environment variables from .env..."
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

is_real_val() {
  local v="${1:-}"
  [ -n "$v" ] && [[ "$v" != your-* ]] && [ "$v" != "(unset)" ]
}

HAS_GEMINI_KEY=false
if is_real_val "${GEMINI_API_KEY:-}" || is_real_val "${AI_STUDIO_API_KEY:-}" || is_real_val "${GOOGLE_CLOUD_API_KEY:-}"; then
  HAS_GEMINI_KEY=true
fi

DETECTED_PROJECT="${GCP_PROJECT:-}"
if ! is_real_val "$DETECTED_PROJECT"; then
  DETECTED_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
fi
if ! is_real_val "$DETECTED_PROJECT"; then
  DETECTED_PROJECT=""
fi

if [ -t 0 ] && [ "$AUTO_YES" = false ] && [ "$DAEMON_MODE" = false ]; then
  if [ -n "$DETECTED_PROJECT" ]; then
    echo "Detected active Google Cloud Project: $DETECTED_PROJECT"
    read -r -p "Is this correct? (y/n) [y]: " CONFIRM_PROJECT
    CONFIRM_PROJECT=${CONFIRM_PROJECT:-y}
    if [[ "$CONFIRM_PROJECT" =~ ^[Yy]$ ]]; then
      GCP_PROJECT="$DETECTED_PROJECT"
    else
      read -r -p "Enter Google Cloud Project ID (or press Enter for API-key local mode): " GCP_PROJECT
    fi
  elif [ "$HAS_GEMINI_KEY" = false ]; then
    read -r -p "Enter Google Cloud Project ID: " GCP_PROJECT
  else
    GCP_PROJECT=""
  fi

  while [ -z "$GCP_PROJECT" ] && [ "$HAS_GEMINI_KEY" = false ]; do
    echo "Error: Project ID cannot be empty when no Gemini API key is configured."
    read -r -p "Enter Google Cloud Project ID: " GCP_PROJECT
  done
else
  GCP_PROJECT="$DETECTED_PROJECT"
  if [ -z "$GCP_PROJECT" ] && [ "$HAS_GEMINI_KEY" = false ]; then
    echo "Error: GCP_PROJECT is not set and no active gcloud project or Gemini API key was found." >&2
    echo "Run 'npm run setup:assist' or './scripts/configure_client.sh', or copy .env.example to .env and set GCP_PROJECT or AI_STUDIO_API_KEY / GOOGLE_CLOUD_API_KEY." >&2
    exit 1
  fi
fi

if [ -n "$GCP_PROJECT" ]; then
  export GCP_PROJECT="$GCP_PROJECT"
  export GOOGLE_CLOUD_PROJECT="$GCP_PROJECT"
  export START_LOCAL_GCP_PROJECT="$GCP_PROJECT"
  echo "Using GCP Project: $GCP_PROJECT"

  if is_real_val "${GCS_BUCKET_NAME:-}"; then
    export GCS_BUCKET_NAME="$GCS_BUCKET_NAME"
  else
    export GCS_BUCKET_NAME="${GCP_PROJECT}-trend-gcs"
  fi
else
  echo "ℹ️ Running in API-key local mode without GCP_PROJECT; L2 local disk cache active, GCS disabled"
  export GCP_PROJECT=""
  export GOOGLE_CLOUD_PROJECT=""
  export START_LOCAL_GCP_PROJECT=""
  if is_real_val "${GCS_BUCKET_NAME:-}"; then
    export GCS_BUCKET_NAME="$GCS_BUCKET_NAME"
  else
    export GCS_BUCKET_NAME=""
  fi
fi
export PYTHONWARNINGS="ignore::FutureWarning,ignore::UserWarning"

if [ ! -x "$SCRIPT_DIR/.venv/bin/uvicorn" ] && ! command -v uvicorn >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/requirements.txt" ]; then
  echo "⚠️  WARNING: Python uvicorn not found in .venv or PATH."
  if [ -t 0 ] && [ "$AUTO_YES" = false ] && [ "$DAEMON_MODE" = false ]; then
    read -r -p "Would you like to create .venv and install requirements.txt now? [y/N]: " run_venv
    if [[ "${run_venv:-N}" =~ ^[Yy]$ ]]; then
      [ -L "$SCRIPT_DIR/.venv" ] && [ ! -e "$SCRIPT_DIR/.venv" ] && rm -f "$SCRIPT_DIR/.venv"
      python3 -m venv "$SCRIPT_DIR/.venv" && "$SCRIPT_DIR/.venv/bin/pip" install --upgrade pip -r "$SCRIPT_DIR/requirements.txt"
    fi
  elif [ "$AUTO_YES" = true ]; then
    echo "Bootstrapping Python .venv and installing requirements.txt..."
    [ -L "$SCRIPT_DIR/.venv" ] && [ ! -e "$SCRIPT_DIR/.venv" ] && rm -f "$SCRIPT_DIR/.venv"
    python3 -m venv "$SCRIPT_DIR/.venv" && "$SCRIPT_DIR/.venv/bin/pip" install --upgrade pip -r "$SCRIPT_DIR/requirements.txt"
  fi
fi

if [ ! -d "node_modules" ]; then
  echo "⚠️  WARNING: node_modules directory not found."
  if [ -t 0 ] && [ "$AUTO_YES" = false ]; then
    read -r -p "Would you like to run npm install now? (y/n) [y]: " run_install
    run_install=${run_install:-y}
    if [[ $run_install =~ ^[Yy]$ ]]; then
      npm install
    fi
  else
    echo "Non-interactive environment detected. Installing packages..."
    npm install
  fi
fi

if ! is_real_val "${GOOGLE_CLOUD_API_KEY:-}" && ! is_real_val "${GEMINI_API_KEY:-}" && ! is_real_val "${AI_STUDIO_API_KEY:-}"; then
  echo "⚠️  WARNING: Neither GOOGLE_CLOUD_API_KEY, GEMINI_API_KEY, nor AI_STUDIO_API_KEY is set in your environment or .env file."
  echo "⚠️  Proceeding without an explicit API key. The server will fall back to Google Cloud Application Default Credentials."
fi

if [ -x "./scripts/server_control.sh" ]; then
  if [ "$DAEMON_MODE" = true ]; then
    exec ./scripts/server_control.sh start --daemon
  else
    exec ./scripts/server_control.sh start --foreground
  fi
fi

echo "[start_local] ERROR: ./scripts/server_control.sh is missing or not executable." >&2
exit 1

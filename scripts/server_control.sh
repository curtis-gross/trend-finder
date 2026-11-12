#!/bin/bash
# ==============================================================================
# scripts/server_control.sh - test-company Trend Intelligence (trend-finder) Server Lifecycle Controller
# Controls starting, stopping, restarting, status checking, port resolution,
# live Vite HMR + incremental dist/ watch builds, and backend/.env auto-reload.
# ==============================================================================

set -e

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
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/server.pid"
VITE_WATCH_PID_FILE="$RUN_DIR/vite_watch.pid"
VITE_DEV_PID_FILE="$RUN_DIR/vite_dev.pid"
SUPERVISOR_PID_FILE="$RUN_DIR/supervisor.pid"
LOG_FILE="$RUN_DIR/server.log"
PORT_FILE="$RUN_DIR/server.port"
VITE_PORT_FILE="$RUN_DIR/vite.port"

DEFAULT_PORT=8080
DEFAULT_VITE_PORT=3000
PORT_SCAN_RANGE=20
PORT_EXPLICIT=false
VITE_PORT_EXPLICIT=false
CALLER_GCP_PROJECT="${START_LOCAL_GCP_PROJECT:-}"

[ -n "${PORT:-}" ] && PORT_EXPLICIT=true
[ -n "${VITE_PORT:-}" ] && VITE_PORT_EXPLICIT=true
PORT="${PORT:-$DEFAULT_PORT}"
VITE_PORT="${VITE_PORT:-$DEFAULT_VITE_PORT}"

mkdir -p "$RUN_DIR"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
  grep -qE '^PORT=' "$ROOT_DIR/.env" 2>/dev/null && PORT_EXPLICIT=true
  grep -qE '^VITE_PORT=' "$ROOT_DIR/.env" 2>/dev/null && VITE_PORT_EXPLICIT=true
  PORT="${PORT:-$DEFAULT_PORT}"
  VITE_PORT="${VITE_PORT:-$DEFAULT_VITE_PORT}"
fi

if [ -n "$CALLER_GCP_PROJECT" ]; then
  export GCP_PROJECT="$CALLER_GCP_PROJECT"
  export GOOGLE_CLOUD_PROJECT="$CALLER_GCP_PROJECT"
fi

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/port_and_process.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/supervisor_and_health.sh"

RUNTIME_PORT="$(get_recorded_port || echo "$PORT")"
RUNTIME_VITE_PORT="$(get_recorded_vite_port || echo "$VITE_PORT")"

cmd_start() {
  local DAEMON=false
  local EXPLICIT_FG=false
  [ ! -t 0 ] && DAEMON=true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --daemon|-d) DAEMON=true; shift ;;
      --foreground|-f) DAEMON=false; EXPLICIT_FG=true; shift ;;
      *) shift ;;
    esac
  done

  touch "$LOG_FILE"

  if ACTIVE_PID="$(get_active_pid)"; then
    if [ "$EXPLICIT_FG" = true ]; then
      echo "[server_control] Stopping previous managed background instance (PID $ACTIVE_PID) before starting foreground session..."
      cmd_stop
    else
      PORT="$RUNTIME_PORT"
      VITE_PORT="$RUNTIME_VITE_PORT"
      if ! get_alive_pid_from_file "$VITE_WATCH_PID_FILE" >/dev/null 2>&1; then
        start_vite_watch_worker
      else
        VITE_WATCH_PID="$(get_alive_pid_from_file "$VITE_WATCH_PID_FILE")"
      fi
      if ! get_alive_pid_from_file "$VITE_DEV_PID_FILE" >/dev/null 2>&1; then
        resolve_vite_port
        echo "$VITE_PORT" > "$VITE_PORT_FILE"
        start_vite_dev_worker
      else
        VITE_DEV_PID="$(get_alive_pid_from_file "$VITE_DEV_PID_FILE")"
      fi
      echo "⚠️  Server is already running with PID $ACTIVE_PID on port $PORT."
      print_banner "$ACTIVE_PID"
      return 0
    fi
  fi

  rm -f "$PORT_FILE" "$VITE_PORT_FILE"
  resolve_port
  echo "$PORT" > "$PORT_FILE"
  RUNTIME_PORT="$PORT"

  resolve_vite_port
  echo "$VITE_PORT" > "$VITE_PORT_FILE"
  RUNTIME_VITE_PORT="$VITE_PORT"

  cd "$ROOT_DIR"
  export PORT="$PORT" VITE_PORT="$VITE_PORT" BACKEND_PORT="$PORT"
  local RESOLVED_PROJECT="${GCP_PROJECT:-${GOOGLE_CLOUD_PROJECT:-}}"
  [[ "$RESOLVED_PROJECT" == your-* ]] && RESOLVED_PROJECT=""
  [ "$RESOLVED_PROJECT" = "(unset)" ] && RESOLVED_PROJECT=""
  if [ -z "$RESOLVED_PROJECT" ] && command -v gcloud >/dev/null 2>&1; then
    RESOLVED_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
    [ "$RESOLVED_PROJECT" = "(unset)" ] && RESOLVED_PROJECT=""
  fi
  local HAS_GEMINI_KEY=false
  for k in "${GEMINI_API_KEY:-}" "${AI_STUDIO_API_KEY:-}" "${GOOGLE_CLOUD_API_KEY:-}"; do
    if [ -n "$k" ] && [[ "$k" != your-* ]]; then
      HAS_GEMINI_KEY=true
      break
    fi
  done
  if [ -z "$RESOLVED_PROJECT" ]; then
    if [ "$HAS_GEMINI_KEY" = true ]; then
      echo "ℹ️ Running in API-key local mode without GCP_PROJECT; L2 local disk cache active, GCS disabled"
      export GCP_PROJECT=""
      export GOOGLE_CLOUD_PROJECT=""
      export GCS_BUCKET_NAME="${GCS_BUCKET_NAME:-${STORAGE_BUCKET:-}}"
      [[ "${GCS_BUCKET_NAME:-}" == your-* ]] && export GCS_BUCKET_NAME=""
    else
      echo "❌ Error: GCP_PROJECT is not set and no active gcloud project or Gemini API key was found." >&2
      echo "   Run 'npm run setup:assist' or './scripts/configure_client.sh', or copy .env.example to .env and set GCP_PROJECT or AI_STUDIO_API_KEY / GOOGLE_CLOUD_API_KEY." >&2
      rm -f "$PORT_FILE" "$VITE_PORT_FILE"
      exit 1
    fi
  else
    export GCP_PROJECT="$RESOLVED_PROJECT"
    export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-$GCP_PROJECT}"
    export GCS_BUCKET_NAME="${GCS_BUCKET_NAME:-${STORAGE_BUCKET:-${GCP_PROJECT}-trend-gcs}}"
    [[ "${GCS_BUCKET_NAME:-}" == your-* ]] && export GCS_BUCKET_NAME="${GCP_PROJECT}-trend-gcs"
  fi
  export PYTHONWARNINGS="ignore::FutureWarning,ignore::UserWarning"

  if [ "${SKIP_INITIAL_BUILD:-0}" != "1" ]; then
    echo "Building initial frontend bundle (syncing dist/)..."
    if [ "$DAEMON" = true ]; then
      if ! npm run build >> "$LOG_FILE" 2>&1; then
        echo "❌ Frontend build failed — aborting startup (Zero Silent Fallbacks). Recent log entries:" >&2
        tail -n 30 "$LOG_FILE" >&2
        rm -f "$PORT_FILE" "$VITE_PORT_FILE"
        exit 1
      fi
    else
      set +e
      npm run build 2>&1 | tee -a "$LOG_FILE"
      local BUILD_RC="${PIPESTATUS[0]}"
      set -e
      if [ "$BUILD_RC" -ne 0 ]; then
        echo "❌ [ERROR] Frontend build failed — aborting server startup (Zero Silent Fallbacks)" | tee -a "$LOG_FILE"
        rm -f "$PORT_FILE" "$VITE_PORT_FILE"
        exit "$BUILD_RC"
      fi
    fi
  fi

  start_uvicorn_worker
  start_vite_watch_worker
  start_vite_dev_worker

  local COUNT=0 BOUND=false
  while [ $COUNT -lt 60 ]; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "❌ Server process terminated unexpectedly during startup. Recent log entries:"
      tail -n 25 "$LOG_FILE"
      stop_pid_gracefully "${VITE_WATCH_PID:-}"
      stop_pid_gracefully "${VITE_DEV_PID:-}"
      rm -f "$PID_FILE" "$VITE_WATCH_PID_FILE" "$VITE_DEV_PID_FILE" "$PORT_FILE" "$VITE_PORT_FILE" "$RUN_DIR/server.json"
      exit 1
    fi
    if port_in_use "$PORT"; then
      BOUND=true
      break
    fi
    sleep 0.5
    COUNT=$((COUNT + 1))
  done

  if [ "$BOUND" != true ]; then
    echo "❌ Server PID $SERVER_PID is alive but never bound port $PORT within 30s. Recent log entries:"
    tail -n 25 "$LOG_FILE"
    stop_pid_gracefully "$SERVER_PID"
    stop_pid_gracefully "${VITE_WATCH_PID:-}"
    stop_pid_gracefully "${VITE_DEV_PID:-}"
    rm -f "$PID_FILE" "$VITE_WATCH_PID_FILE" "$VITE_DEV_PID_FILE" "$PORT_FILE" "$VITE_PORT_FILE" "$RUN_DIR/server.json"
    exit 1
  fi

  if [ "$DAEMON" = true ]; then
    echo "Starting test-company Trend Intelligence (trend-finder) in daemon mode (frontend + backend auto-reload active)..."
    write_runtime_metadata "daemon"

    ( run_supervisor_loop "daemon" ) < /dev/null >> "$LOG_FILE" 2>&1 &
    local SUP_PID=$!
    disown "$SUP_PID" 2>/dev/null || true
    echo "$SUP_PID" > "$SUPERVISOR_PID_FILE"

    local HEALTH_CODE
    HEALTH_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/health" 2>/dev/null || echo "000")"
    if [ "$HEALTH_CODE" = "200" ]; then
      echo "[server_control] Health check: GET http://localhost:$PORT/health -> 200 OK"
    else
      echo "❌ Health check: GET http://localhost:$PORT/health -> HTTP $HEALTH_CODE (expected 200). Recent log entries:"
      tail -n 20 "$LOG_FILE"
      exit 1
    fi

    print_banner "$SERVER_PID"
  else
    write_runtime_metadata "foreground"
    CLEANED_UP_FG=false
    TAIL_PID=""
    SUPERVISOR_SLEEP_PID=""

    cleanup_fg() {
      [ "$CLEANED_UP_FG" = true ] && return 0
      CLEANED_UP_FG=true
      echo ""
      echo "Shutting down test-company Trend Intelligence (backend + Vite watchers)..."
      local CUR_SRV CUR_WATCH CUR_DEV
      CUR_SRV="$(read_numeric_file "$PID_FILE" || echo "${SERVER_PID:-}")"
      CUR_WATCH="$(read_numeric_file "$VITE_WATCH_PID_FILE" || echo "${VITE_WATCH_PID:-}")"
      CUR_DEV="$(read_numeric_file "$VITE_DEV_PID_FILE" || echo "${VITE_DEV_PID:-}")"
      rm -f "$PID_FILE"

      [ -n "$SUPERVISOR_SLEEP_PID" ] && kill "$SUPERVISOR_SLEEP_PID" 2>/dev/null || true
      [ -n "$TAIL_PID" ] && kill "$TAIL_PID" 2>/dev/null || true

      stop_pid_gracefully "$CUR_WATCH"
      stop_pid_gracefully "$CUR_DEV"
      stop_pid_gracefully "$CUR_SRV"
      free_recorded_port "$PORT"
      free_recorded_port "$VITE_PORT"

      rm -f "$PID_FILE" "$VITE_WATCH_PID_FILE" "$VITE_DEV_PID_FILE" "$SUPERVISOR_PID_FILE" "$PORT_FILE" "$VITE_PORT_FILE" "$RUN_DIR/server.json"
      echo "✅ All server and watcher processes stopped cleanly."
    }
    trap 'cleanup_fg; exit 0' INT TERM HUP
    trap 'cleanup_fg' EXIT

    print_banner "$SERVER_PID"
    tail -n 0 -f "$LOG_FILE" &
    TAIL_PID=$!

    run_supervisor_loop "foreground"
    local SUP_RC=$?
    cleanup_fg
    exit "$SUP_RC"
  fi
}

cmd_stop() {
  local TARGET_PID="" PID_FROM_FILE="" REC_PORT="" REC_VITE_PORT=""
  REC_PORT="$(get_recorded_port || true)"
  REC_VITE_PORT="$(get_recorded_vite_port || true)"

  local SUP_PID WATCH_PID DEV_PID
  SUP_PID="$(read_numeric_file "$SUPERVISOR_PID_FILE" || true)"
  [ -n "$SUP_PID" ] && stop_pid_gracefully "$SUP_PID"
  rm -f "$SUPERVISOR_PID_FILE"

  WATCH_PID="$(read_numeric_file "$VITE_WATCH_PID_FILE" || true)"
  DEV_PID="$(read_numeric_file "$VITE_DEV_PID_FILE" || true)"

  if PID_FROM_FILE="$(get_alive_pid_from_file "$PID_FILE")"; then
    TARGET_PID="$PID_FROM_FILE"
  elif [ -n "$REC_PORT" ]; then
    TARGET_PID="$(port_pids "$REC_PORT" | head -n 1)"
  fi

  if [ -z "$TARGET_PID" ] && [ -z "$WATCH_PID" ] && [ -z "$DEV_PID" ]; then
    echo "ℹ️  test-company Trend Intelligence (trend-finder) server is not running."
    if [ -z "$REC_PORT" ] && port_in_use "$DEFAULT_PORT"; then
      echo "   Note: port $DEFAULT_PORT is held by $(port_owner "$DEFAULT_PORT"), which this script did not start. Left untouched."
    fi
    rm -f "$PID_FILE" "$VITE_WATCH_PID_FILE" "$VITE_DEV_PID_FILE" "$PORT_FILE" "$VITE_PORT_FILE" "$RUN_DIR/server.json"
    return 0
  fi

  rm -f "$PID_FILE"
  echo "Stopping server process (PID ${TARGET_PID:-none}) and Vite watchers on ports ${REC_PORT:-unknown}/${REC_VITE_PORT:-unknown}..."

  [ -n "$WATCH_PID" ] && stop_pid_gracefully "$WATCH_PID"
  [ -n "$DEV_PID" ] && stop_pid_gracefully "$DEV_PID"
  [ -n "$TARGET_PID" ] && stop_pid_gracefully "$TARGET_PID"

  [ -n "$REC_PORT" ] && free_recorded_port "$REC_PORT"
  [ -n "$REC_VITE_PORT" ] && free_recorded_port "$REC_VITE_PORT"

  rm -f "$PID_FILE" "$VITE_WATCH_PID_FILE" "$VITE_DEV_PID_FILE" "$SUPERVISOR_PID_FILE" "$PORT_FILE" "$VITE_PORT_FILE" "$RUN_DIR/server.json"
  echo "✅ Server (PID ${TARGET_PID:-watchers}) stopped successfully."
}

cmd_restart() {
  echo "Restarting test-company Trend Intelligence (trend-finder) Server..."
  cmd_stop
  sleep 0.5
  cmd_start "$@"
}

cmd_resolve_port() {
  resolve_port 1>&2
  echo "$PORT" > "$PORT_FILE"
  echo "$PORT"
}

cmd_resolve_vite_port() {
  resolve_vite_port 1>&2
  echo "$VITE_PORT" > "$VITE_PORT_FILE"
  echo "$VITE_PORT"
}

ACTION="${1:-}"
shift || true

case "$ACTION" in
  start) cmd_start "$@" ;;
  stop) cmd_stop ;;
  restart) cmd_restart "$@" ;;
  status) cmd_status ;;
  logs) cmd_logs ;;
  resolve-port) cmd_resolve_port ;;
  resolve-vite-port) cmd_resolve_vite_port ;;
  *)
    echo "Usage: $0 {start [--daemon|-d|--foreground|-f]|stop|restart [--daemon|-d]|status|logs|resolve-port|resolve-vite-port}"
    exit 1
    ;;
esac

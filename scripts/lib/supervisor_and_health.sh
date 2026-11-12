#!/bin/bash
# ==============================================================================
# scripts/lib/supervisor_and_health.sh - Worker spawners, runtime metadata,
# banner printer, status/logs helpers, and auto-reload supervisor for trend-finder.
# ==============================================================================

compute_env_hash() {
  local FILES=()
  [ -f "$ROOT_DIR/.env" ] && FILES+=("$ROOT_DIR/.env")
  [ -f "$ROOT_DIR/.env.local" ] && FILES+=("$ROOT_DIR/.env.local")
  if [ "${#FILES[@]}" -eq 0 ]; then
    echo "no-env"
  else
    cksum "${FILES[@]}" 2>/dev/null | tr '\n' '|'
  fi
}

compute_root_server_hash() {
  if [ -f "$ROOT_DIR/main.py" ]; then
    cksum "$ROOT_DIR/main.py" 2>/dev/null | tr '\n' '|'
  else
    echo "no-root-server"
  fi
}

reload_env_preserving_ports() {
  local KEEP_PORT="$PORT"
  local KEEP_VITE_PORT="$VITE_PORT"
  local KEEP_PROJECT="$GCP_PROJECT"
  if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env"
    set +a
  fi
  if [ -f "$ROOT_DIR/.env.local" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env.local"
    set +a
  fi
  export PORT="$KEEP_PORT"
  export VITE_PORT="$KEEP_VITE_PORT"
  export BACKEND_PORT="$KEEP_PORT"
  export GCP_PROJECT="${GCP_PROJECT:-$KEEP_PROJECT}"
  export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-$GCP_PROJECT}"
  if [ -n "${GCS_BUCKET_NAME:-}" ]; then
    export GCS_BUCKET_NAME="$GCS_BUCKET_NAME"
  elif [ -n "${STORAGE_BUCKET:-}" ]; then
    export GCS_BUCKET_NAME="$STORAGE_BUCKET"
  elif [ -n "$GCP_PROJECT" ]; then
    export GCS_BUCKET_NAME="${GCP_PROJECT}-trend-gcs"
  else
    export GCS_BUCKET_NAME=""
  fi
}

detect_uvicorn_bin() {
  if [ -x "$ROOT_DIR/.venv/bin/uvicorn" ]; then
    echo "$ROOT_DIR/.venv/bin/uvicorn"
  else
    echo "uvicorn"
  fi
}

start_uvicorn_worker() {
  local UVICORN_BIN
  UVICORN_BIN="$(detect_uvicorn_bin)"

  local RELOAD_ARGS=(
    --reload
    --reload-dir "$ROOT_DIR/backend"
    --reload-include "*.py"
  )

  (
    cd "$ROOT_DIR"
    nohup "$UVICORN_BIN" main:app --host 0.0.0.0 --port "$PORT" "${RELOAD_ARGS[@]}" < /dev/null >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )
  SERVER_PID="$(cat "$PID_FILE")"
}

start_vite_watch_worker() {
  (
    cd "$ROOT_DIR"
    if [ -f "$ROOT_DIR/node_modules/vite/bin/vite.js" ]; then
      nohup env CI=true node "$ROOT_DIR/node_modules/vite/bin/vite.js" build --watch --emptyOutDir false < /dev/null >> "$LOG_FILE" 2>&1 &
    else
      nohup env CI=true npx vite build --watch --emptyOutDir false < /dev/null >> "$LOG_FILE" 2>&1 &
    fi
    echo $! > "$VITE_WATCH_PID_FILE"
  )
  VITE_WATCH_PID="$(cat "$VITE_WATCH_PID_FILE")"
}

start_vite_dev_worker() {
  (
    cd "$ROOT_DIR"
    if [ -f "$ROOT_DIR/node_modules/vite/bin/vite.js" ]; then
      nohup env CI=true NODE_ENV=development BACKEND_PORT="$PORT" VITE_PORT="$VITE_PORT" \
        node "$ROOT_DIR/node_modules/vite/bin/vite.js" --port "$VITE_PORT" --host 0.0.0.0 < /dev/null >> "$LOG_FILE" 2>&1 &
    else
      nohup env CI=true NODE_ENV=development BACKEND_PORT="$PORT" VITE_PORT="$VITE_PORT" \
        npx vite --port "$VITE_PORT" --host 0.0.0.0 < /dev/null >> "$LOG_FILE" 2>&1 &
    fi
    echo $! > "$VITE_DEV_PID_FILE"
  )
  VITE_DEV_PID="$(cat "$VITE_DEV_PID_FILE")"
}

write_runtime_metadata() {
  local MODE="$1"
  cat <<EOF > "$RUN_DIR/server.json"
{
  "pid": ${SERVER_PID:-0},
  "viteWatchPid": ${VITE_WATCH_PID:-0},
  "viteDevPid": ${VITE_DEV_PID:-0},
  "port": $PORT,
  "vitePort": $VITE_PORT,
  "engine": "fastapi+vite-watch+vite-hmr",
  "startTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "mode": "$MODE"
}
EOF
}

print_banner() {
  local DISPLAY_PID="${1:-[PID]}"
  echo "======================================================================"
  echo "🚀 test-company Trend Intelligence (trend-finder) — AUTO-RELOAD ACTIVE"
  echo "   • Unified App & API:  http://localhost:$PORT  (auto-rebuilds dist/ in ~1s)"
  echo "   • Vite HMR Dev URL:   http://localhost:$VITE_PORT  (instant WebSocket HMR)"
  echo "   • Backend PID:        $DISPLAY_PID (FastAPI + Uvicorn --reload)"
  echo "   • Frontend Watchers:  vite build --watch (PID ${VITE_WATCH_PID:-active}) + vite HMR (PID ${VITE_DEV_PID:-active})"
  echo "   • Watched Paths:      *.tsx, *.ts, *.css, index.html, backend/**, main.py, .env*"
  echo "   • Active Log:         .run/server.log"
  echo "======================================================================"
  echo "📋 NEXT STEPS & SERVER COMMANDS:"
  echo "   ▶ Stream Active Logs:  ./view_logs.sh"
  echo "   ▶ Stop the Server:     ./stop_server.sh"
  echo "======================================================================"
}

run_supervisor_loop() {
  local MODE="$1"
  set +e
  trap '' HUP
  local LAST_ENV_HASH LAST_ROOT_HASH
  LAST_ENV_HASH="$(compute_env_hash)"
  LAST_ROOT_HASH="$(compute_root_server_hash)"

  while true; do
    sleep 1 &
    SUPERVISOR_SLEEP_PID=$!
    wait "$SUPERVISOR_SLEEP_PID" 2>/dev/null || true

    if [ ! -f "$PID_FILE" ]; then
      break
    fi

    local CUR_ENV_HASH CUR_ROOT_HASH
    CUR_ENV_HASH="$(compute_env_hash)"
    CUR_ROOT_HASH="$(compute_root_server_hash)"

    if [ "$CUR_ENV_HASH" != "$LAST_ENV_HASH" ]; then
      LAST_ENV_HASH="$CUR_ENV_HASH"
      LAST_ROOT_HASH="$CUR_ROOT_HASH"
      echo "[auto-reload] Detected change in .env — reloading environment and restarting Uvicorn + Vite watchers..." >> "$LOG_FILE"
      reload_env_preserving_ports

      stop_pid_gracefully "$(read_numeric_file "$PID_FILE" || true)"
      stop_pid_gracefully "$(read_numeric_file "$VITE_WATCH_PID_FILE" || true)"
      stop_pid_gracefully "$(read_numeric_file "$VITE_DEV_PID_FILE" || true)"
      free_recorded_port "$PORT"
      free_recorded_port "$VITE_PORT"

      start_uvicorn_worker
      start_vite_watch_worker
      start_vite_dev_worker
      write_runtime_metadata "$MODE"
      continue
    fi

    if [ "$CUR_ROOT_HASH" != "$LAST_ROOT_HASH" ]; then
      LAST_ROOT_HASH="$CUR_ROOT_HASH"
      echo "[auto-reload] Detected change in main.py — restarting FastAPI Uvicorn on port $PORT..." >> "$LOG_FILE"
      stop_pid_gracefully "$(read_numeric_file "$PID_FILE" || true)"
      free_recorded_port "$PORT"
      start_uvicorn_worker
      write_runtime_metadata "$MODE"
      continue
    fi

    local LIVE_SERVER_PID
    LIVE_SERVER_PID="$(read_numeric_file "$PID_FILE" || true)"
    if [ -n "$LIVE_SERVER_PID" ] && ! kill -0 "$LIVE_SERVER_PID" 2>/dev/null; then
      echo "[ERROR] Uvicorn server process (PID $LIVE_SERVER_PID) exited unexpectedly." >> "$LOG_FILE"
      return 1
    fi

    local LIVE_WATCH_PID
    LIVE_WATCH_PID="$(read_numeric_file "$VITE_WATCH_PID_FILE" || true)"
    if [ -z "$LIVE_WATCH_PID" ] || ! kill -0 "$LIVE_WATCH_PID" 2>/dev/null; then
      echo "[auto-reload] Restarting Vite bundle watcher (dist/ sync)..." >> "$LOG_FILE"
      start_vite_watch_worker
      write_runtime_metadata "$MODE"
    fi

    local LIVE_DEV_PID
    LIVE_DEV_PID="$(read_numeric_file "$VITE_DEV_PID_FILE" || true)"
    if [ -z "$LIVE_DEV_PID" ] || ! kill -0 "$LIVE_DEV_PID" 2>/dev/null; then
      if ! port_in_use "$VITE_PORT"; then
        echo "[auto-reload] Restarting Vite HMR dev server on port $VITE_PORT..." >> "$LOG_FILE"
        start_vite_dev_worker
        write_runtime_metadata "$MODE"
      fi
    fi
  done
  return 0
}

cmd_status() {
  echo "======================================================================"
  echo "📊 test-company Trend Intelligence (trend-finder) Server Status"
  echo "======================================================================"

  local ACTIVE_PID
  if ACTIVE_PID="$(get_active_pid)"; then
    local WATCH_STATE="STOPPED"
    local DEV_STATE="STOPPED"
    local WPID DPID
    if WPID="$(get_alive_pid_from_file "$VITE_WATCH_PID_FILE")"; then
      WATCH_STATE="RUNNING (PID $WPID)"
    fi
    if DPID="$(get_alive_pid_from_file "$VITE_DEV_PID_FILE")"; then
      DEV_STATE="RUNNING (PID $DPID, http://localhost:$RUNTIME_VITE_PORT)"
    fi
    echo "• State:        RUNNING"
    echo "• Process ID:   $ACTIVE_PID"
    echo "• Port:         $RUNTIME_PORT (Listening, from .run/server.port)"
    echo "• URL:          http://localhost:$RUNTIME_PORT"
    echo "• Vite HMR:     $DEV_STATE"
    echo "• Dist Watch:   $WATCH_STATE"
    echo "• Log File:     .run/server.log"
    echo "======================================================================"
    if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
      echo "Recent Logs (Last 10 lines):"
      echo "----------------------------------------------------------------------"
      tail -n 10 "$LOG_FILE"
    fi
    return 0
  else
    echo "• State:        STOPPED"
    echo "• Process ID:   None"
    if port_in_use "$PORT"; then
      echo "• Port:         $PORT (In use by $(port_owner "$PORT") - not started by this script)"
    else
      echo "• Port:         $PORT (Available)"
    fi
    echo "• Log File:     .run/server.log"
    echo "======================================================================"
    return 0
  fi
}

cmd_logs() {
  touch "$LOG_FILE"
  if [ ! -s "$LOG_FILE" ]; then
    if ! get_active_pid >/dev/null 2>&1; then
      echo "⚠️  No active server logs found."
      echo "Start the server first with: ./start_local.sh or ./scripts/server_control.sh start"
      return 0
    fi
  fi

  echo "Streaming active server logs from $LOG_FILE (Press Ctrl+C to exit):"
  echo "----------------------------------------------------------------------"
  exec tail -n 50 -f "$LOG_FILE"
}

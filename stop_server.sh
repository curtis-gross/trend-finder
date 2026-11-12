#!/bin/bash
# ==============================================================================
# stop_server.sh - Single-command shutdown for test-company Trend Intelligence (trend-finder)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -x "$SCRIPT_DIR/scripts/server_control.sh" ]; then
  exec "$SCRIPT_DIR/scripts/server_control.sh" stop
fi

RUN_DIR="$SCRIPT_DIR/.run"
PID_FILE="$RUN_DIR/server.pid"
VITE_WATCH_PID_FILE="$RUN_DIR/vite_watch.pid"
VITE_DEV_PID_FILE="$RUN_DIR/vite_dev.pid"
SUPERVISOR_PID_FILE="$RUN_DIR/supervisor.pid"
PORT_FILE="$RUN_DIR/server.port"
VITE_PORT_FILE="$RUN_DIR/vite.port"

PORT="$( [ -f "$PORT_FILE" ] && tr -d '[:space:]' < "$PORT_FILE" || true )"
PORT="${PORT:-8080}"
TARGET_PID=""

if [ -f "$PID_FILE" ]; then
  TARGET_PID="$(tr -d '[:space:]' < "$PID_FILE" 2>/dev/null || true)"
fi

if [ -z "$TARGET_PID" ] || ! kill -0 "$TARGET_PID" 2>/dev/null; then
  TARGET_PID="$(lsof -ti :"$PORT" 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$TARGET_PID" ] && [ ! -f "$VITE_WATCH_PID_FILE" ] && [ ! -f "$VITE_DEV_PID_FILE" ]; then
  echo "ℹ️  test-company Trend Intelligence (trend-finder) server is not running."
  rm -f "$PID_FILE" "$VITE_WATCH_PID_FILE" "$VITE_DEV_PID_FILE" "$SUPERVISOR_PID_FILE" "$PORT_FILE" "$VITE_PORT_FILE"
  exit 0
fi

echo "Stopping server process (PID ${TARGET_PID:-watchers})..."
for PF in "$SUPERVISOR_PID_FILE" "$VITE_WATCH_PID_FILE" "$VITE_DEV_PID_FILE" "$PID_FILE"; do
  if [ -f "$PF" ]; then
    P="$(tr -d '[:space:]' < "$PF" 2>/dev/null || true)"
    [ -n "$P" ] && kill -TERM "$P" 2>/dev/null || true
  fi
done
[ -n "$TARGET_PID" ] && kill -TERM "$TARGET_PID" 2>/dev/null || true

WAIT_COUNT=0
while [ -n "$TARGET_PID" ] && kill -0 "$TARGET_PID" 2>/dev/null && [ $WAIT_COUNT -lt 5 ]; do
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
done

if [ -n "$TARGET_PID" ] && kill -0 "$TARGET_PID" 2>/dev/null; then
  echo "Server did not shut down gracefully within 5s; sending SIGKILL..."
  kill -9 "$TARGET_PID" 2>/dev/null || true
fi

rm -f "$PID_FILE" "$VITE_WATCH_PID_FILE" "$VITE_DEV_PID_FILE" "$SUPERVISOR_PID_FILE" "$PORT_FILE" "$VITE_PORT_FILE" "$RUN_DIR/server.json"
echo "✅ Server (PID ${TARGET_PID:-watchers}) stopped successfully."

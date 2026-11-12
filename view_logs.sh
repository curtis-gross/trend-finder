#!/bin/bash
# ==============================================================================
# view_logs.sh - Stream live logs for test-company Trend Intelligence (trend-finder)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$SCRIPT_DIR/.run"
LOG_FILE="$RUN_DIR/server.log"
PORT_FILE="$RUN_DIR/server.port"
PORT="$( [ -f "$PORT_FILE" ] && tr -d '[:space:]' < "$PORT_FILE" || true )"
PORT="${PORT:-8080}"

mkdir -p "$RUN_DIR"

if [ ! -f "$LOG_FILE" ] || [ ! -s "$LOG_FILE" ]; then
  touch "$LOG_FILE"
  if ! lsof -ti :"$PORT" >/dev/null 2>&1; then
    echo "⚠️  No active server logs found."
    echo "Start the server first with: ./start_local.sh or ./scripts/server_control.sh start"
    exit 0
  fi
fi

echo "Streaming active server logs for test-company Trend Intelligence (trend-finder) from .run/server.log (Ctrl+C to exit):"
echo "======================================================================"
exec tail -n 50 -f "$LOG_FILE"

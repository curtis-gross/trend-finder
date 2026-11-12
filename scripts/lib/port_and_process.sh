#!/bin/bash
# ==============================================================================
# scripts/lib/port_and_process.sh - Port scanning, PID inspection, and process
# termination helpers for test-company Trend Intelligence (trend-finder).
# ==============================================================================

port_in_use() {
  local P="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$P" -sTCP:LISTEN -t >/dev/null 2>&1
  elif command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$P" >/dev/null 2>&1
  else
    echo "[server_control] ERROR: neither 'lsof' nor 'nc' is installed; cannot check port $P." >&2
    exit 1
  fi
}

port_owner() {
  local P="$1"
  local OWNER=""
  if command -v lsof >/dev/null 2>&1; then
    OWNER="$(lsof -nP -iTCP:"$P" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2"/"$1}' | sort -u | paste -sd, - || true)"
  fi
  echo "${OWNER:-unknown (nc probe only)}"
}

port_pids() {
  local P="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$P" -sTCP:LISTEN -t 2>/dev/null || true
  fi
}

read_numeric_file() {
  local F="$1"
  if [ -f "$F" ]; then
    local VAL
    VAL="$(tr -d '[:space:]' < "$F" 2>/dev/null || true)"
    if [[ "$VAL" =~ ^[0-9]+$ ]]; then
      echo "$VAL"
      return 0
    fi
  fi
  return 1
}

get_recorded_port() {
  read_numeric_file "$PORT_FILE"
}

get_recorded_vite_port() {
  read_numeric_file "$VITE_PORT_FILE"
}

get_alive_pid_from_file() {
  local F="$1"
  local P
  if P="$(read_numeric_file "$F")"; then
    if kill -0 "$P" 2>/dev/null; then
      echo "$P"
      return 0
    fi
  fi
  return 1
}

resolve_port() {
  local BASE="$PORT"
  if ! port_in_use "$BASE"; then
    return 0
  fi

  local OWNER
  OWNER="$(port_owner "$BASE")"

  if [ "$PORT_EXPLICIT" = true ]; then
    echo "[server_control] ERROR: PORT=$BASE was set explicitly but is already in use by $OWNER." >&2
    echo "[server_control]        Free the port or set a different PORT. Not moving automatically." >&2
    exit 1
  fi

  local CANDIDATE=$((BASE + 1))
  local LIMIT=$((BASE + PORT_SCAN_RANGE))
  while [ "$CANDIDATE" -le "$LIMIT" ]; do
    if ! port_in_use "$CANDIDATE"; then
      echo "[server_control] Port $BASE in use by $OWNER; starting backend on $CANDIDATE"
      PORT="$CANDIDATE"
      return 0
    fi
    CANDIDATE=$((CANDIDATE + 1))
  done

  echo "[server_control] ERROR: Port $BASE in use by $OWNER and no free port found in $((BASE + 1))-$LIMIT." >&2
  exit 1
}

resolve_vite_port() {
  local BASE="$VITE_PORT"
  if [ "$BASE" != "$PORT" ] && ! port_in_use "$BASE"; then
    return 0
  fi

  if [ "$VITE_PORT_EXPLICIT" = true ]; then
    local OWNER
    OWNER="$(port_owner "$BASE")"
    echo "[server_control] ERROR: VITE_PORT=$BASE was set explicitly but is already in use by $OWNER." >&2
    exit 1
  fi

  local CANDIDATE=$((BASE + 1))
  local LIMIT=$((BASE + PORT_SCAN_RANGE))
  while [ "$CANDIDATE" -le "$LIMIT" ]; do
    if [ "$CANDIDATE" != "$PORT" ] && ! port_in_use "$CANDIDATE"; then
      echo "[server_control] Vite port $BASE busy; starting Vite HMR dev server on $CANDIDATE"
      VITE_PORT="$CANDIDATE"
      return 0
    fi
    CANDIDATE=$((CANDIDATE + 1))
  done

  echo "[server_control] ERROR: Could not find a free Vite HMR port in $BASE-$LIMIT." >&2
  exit 1
}

stop_pid_gracefully() {
  local TARGET="$1"
  if [ -z "$TARGET" ] || ! kill -0 "$TARGET" 2>/dev/null; then
    return 0
  fi
  local CHILDREN=""
  if command -v pgrep >/dev/null 2>&1; then
    CHILDREN="$(pgrep -P "$TARGET" 2>/dev/null || true)"
  fi
  kill -TERM "$TARGET" 2>/dev/null || true
  for C in $CHILDREN; do
    kill -TERM "$C" 2>/dev/null || true
  done

  local W=0
  while kill -0 "$TARGET" 2>/dev/null && [ $W -lt 25 ]; do
    sleep 0.2
    W=$((W + 1))
  done

  if kill -0 "$TARGET" 2>/dev/null; then
    kill -9 "$TARGET" 2>/dev/null || true
  fi
  for C in $CHILDREN; do
    if kill -0 "$C" 2>/dev/null; then
      kill -9 "$C" 2>/dev/null || true
    fi
  done
}

free_recorded_port() {
  local P="$1"
  if [ -z "$P" ]; then
    return 0
  fi
  local W=0
  while port_in_use "$P" && [ $W -lt 15 ]; do
    local REMAINING
    REMAINING="$(port_pids "$P" | tr '\n' ' ')"
    for RP in $REMAINING; do
      kill -TERM "$RP" 2>/dev/null || true
    done
    sleep 0.2
    W=$((W + 1))
  done
  if port_in_use "$P"; then
    local STUBBORN
    STUBBORN="$(port_pids "$P" | tr '\n' ' ')"
    for RP in $STUBBORN; do
      kill -9 "$RP" 2>/dev/null || true
    done
    sleep 0.2
  fi
}

get_active_pid() {
  local SAVED_PID
  if SAVED_PID="$(get_alive_pid_from_file "$PID_FILE")"; then
    echo "$SAVED_PID"
    return 0
  fi

  local REC_PORT
  if REC_PORT="$(get_recorded_port)"; then
    local PORT_PID
    PORT_PID="$(port_pids "$REC_PORT" | head -n 1)"
    if [ -n "$PORT_PID" ]; then
      echo "$PORT_PID"
      return 0
    fi
  fi

  return 1
}

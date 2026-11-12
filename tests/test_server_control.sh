#!/bin/bash
# ==============================================================================
# tests/test_server_control.sh - Automated tests for server lifecycle scripts
# ==============================================================================

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Running Server Control Scripts Test Suite ==="

# Test 1: Verify file existence and executable permissions
echo "[Test 1] Verifying scripts exist and are executable..."
test -x "scripts/server_control.sh" || { echo "FAIL: scripts/server_control.sh not executable"; exit 1; }
test -x "view_logs.sh" || { echo "FAIL: view_logs.sh not executable"; exit 1; }
test -x "stop_server.sh" || { echo "FAIL: stop_server.sh not executable"; exit 1; }
echo "PASS: All scripts exist and have execute permissions."

# Test 2: Verify syntax
echo "[Test 2] Verifying bash syntax..."
bash -n "scripts/server_control.sh" || { echo "FAIL: scripts/server_control.sh syntax error"; exit 1; }
bash -n "view_logs.sh" || { echo "FAIL: view_logs.sh syntax error"; exit 1; }
bash -n "stop_server.sh" || { echo "FAIL: stop_server.sh syntax error"; exit 1; }
echo "PASS: Bash syntax validated for all scripts."

# Test 3: Status command when stopped
echo "[Test 3] Verifying status command reports STOPPED when idle..."
STATUS_OUT=$(./scripts/server_control.sh status)
echo "$STATUS_OUT" | grep -q "State:        STOPPED" || { echo "FAIL: Expected STOPPED state"; exit 1; }
echo "PASS: Status command correctly reports STOPPED."

# Test 4: Stop command when no server is running
echo "[Test 4] Verifying stop_server.sh exits cleanly when server is idle..."
STOP_OUT=$(./stop_server.sh)
echo "$STOP_OUT" | grep -q "server is not running" || { echo "FAIL: Expected 'not running' message"; exit 1; }
echo "PASS: stop_server.sh handled idle state correctly."

# Test 5: Verify view_logs.sh executes without error
echo "[Test 5] Verifying view_logs.sh starts log streaming cleanly..."
./view_logs.sh > /tmp/view_logs_test.out 2>&1 &
LOGS_PID=$!
sleep 1
kill -TERM "$LOGS_PID" 2>/dev/null || true
wait "$LOGS_PID" 2>/dev/null || true
cat /tmp/view_logs_test.out | grep -E "Streaming active server logs|No active server logs found" || {
  echo "FAIL: Unexpected view_logs output:"
  cat /tmp/view_logs_test.out
  exit 1
}
rm -f /tmp/view_logs_test.out
echo "PASS: view_logs.sh handled log streaming and clean signal exit correctly."

echo "=== All Server Control Script Tests PASSED ==="
exit 0

#!/bin/bash
# ==============================================================================
# tests/test_start_local.sh - Unit tests for start_local.sh ADC-fallback & CLI
# Runs completely isolated in a temporary workspace with a mocked
# scripts/server_control.sh so no real servers or .run/ files are touched.
# ==============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/scripts" "$TMP_DIR/node_modules" "$TMP_DIR/bin"
cp "$REPO_ROOT/start_local.sh" "$TMP_DIR/start_local.sh"
chmod +x "$TMP_DIR/start_local.sh"

# Mock gcloud so host gcloud config never leaks into tests
cat > "$TMP_DIR/bin/gcloud" <<'EOF'
#!/bin/bash
if [ "${1:-}" = "config" ] && [ "${2:-}" = "get-value" ] && [ "${3:-}" = "project" ]; then
  echo "${MOCK_GCLOUD_PROJECT:-(unset)}"
  exit 0
fi
exit 0
EOF
chmod +x "$TMP_DIR/bin/gcloud"

# Mock scripts/server_control.sh to capture args and exported env vars
cat > "$TMP_DIR/scripts/server_control.sh" <<'EOF'
#!/bin/bash
{
  echo "ARGS=$*"
  echo "GCP_PROJECT=${GCP_PROJECT:-}"
  echo "GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT:-}"
  echo "START_LOCAL_GCP_PROJECT=${START_LOCAL_GCP_PROJECT:-}"
  echo "GCS_BUCKET_NAME=${GCS_BUCKET_NAME:-}"
} > "$TMP_CAPTURE_FILE"
exit 0
EOF
chmod +x "$TMP_DIR/scripts/server_control.sh"

echo "=== Running start_local.sh Test Suite ==="

# Test 1: ADC fallback when both GOOGLE_CLOUD_API_KEY and GEMINI_API_KEY are unset
echo "[Test 1] Verifying ADC fallback succeeds without API keys..."
CAPTURE_1="$TMP_DIR/capture1.env"
OUT_1="$TMP_DIR/out1.log"
set +e
env -i PATH="$TMP_DIR/bin:/usr/bin:/bin:/usr/local/bin" \
  HOME="$HOME" \
  GCP_PROJECT="adc-test-project" \
  TMP_CAPTURE_FILE="$CAPTURE_1" \
  "$TMP_DIR/start_local.sh" --yes > "$OUT_1" 2>&1
RC_1=$?
set -e

if [ "$RC_1" -ne 0 ]; then
  echo "FAIL [Test 1]: Expected exit code 0, got $RC_1"
  cat "$OUT_1"
  exit 1
fi
grep -q "Application Default Credentials" "$OUT_1" || {
  echo "FAIL [Test 1]: Expected ADC fallback warning"
  cat "$OUT_1"
  exit 1
}
grep -q "ARGS=start --foreground" "$CAPTURE_1" || {
  echo "FAIL [Test 1]: Expected 'start --foreground' invocation"
  cat "$CAPTURE_1"
  exit 1
}
grep -q "GCS_BUCKET_NAME=adc-test-project-trend-gcs" "$CAPTURE_1" || {
  echo "FAIL [Test 1]: Expected default GCS_BUCKET_NAME derivation"
  cat "$CAPTURE_1"
  exit 1
}
echo "PASS [Test 1]: ADC fallback and foreground delegation verified."

# Test 2: Daemon mode with explicit GOOGLE_CLOUD_API_KEY and GCS_BUCKET_NAME
echo "[Test 2] Verifying --daemon mode with explicit GOOGLE_CLOUD_API_KEY..."
CAPTURE_2="$TMP_DIR/capture2.env"
OUT_2="$TMP_DIR/out2.log"
set +e
env -i PATH="$TMP_DIR/bin:/usr/bin:/bin:/usr/local/bin" \
  HOME="$HOME" \
  GCP_PROJECT="explicit-project" \
  GCS_BUCKET_NAME="custom-trend-bucket" \
  GOOGLE_CLOUD_API_KEY="test-key-value" \
  TMP_CAPTURE_FILE="$CAPTURE_2" \
  "$TMP_DIR/start_local.sh" --daemon > "$OUT_2" 2>&1
RC_2=$?
set -e

if [ "$RC_2" -ne 0 ]; then
  echo "FAIL [Test 2]: Expected exit code 0, got $RC_2"
  cat "$OUT_2"
  exit 1
fi
if grep -q "Application Default Credentials" "$OUT_2"; then
  echo "FAIL [Test 2]: Unexpected ADC warning when GOOGLE_CLOUD_API_KEY is set"
  cat "$OUT_2"
  exit 1
fi
grep -q "ARGS=start --daemon" "$CAPTURE_2" || {
  echo "FAIL [Test 2]: Expected 'start --daemon' invocation"
  cat "$CAPTURE_2"
  exit 1
}
grep -q "GCS_BUCKET_NAME=custom-trend-bucket" "$CAPTURE_2" || {
  echo "FAIL [Test 2]: Expected custom GCS_BUCKET_NAME to be preserved"
  cat "$CAPTURE_2"
  exit 1
}
echo "PASS [Test 2]: Daemon mode and explicit key handling verified."

# Test 3: Missing GCP_PROJECT fails cleanly in non-interactive mode
echo "[Test 3] Verifying missing GCP_PROJECT fails cleanly in --yes mode..."
OUT_3="$TMP_DIR/out3.log"
set +e
env -i PATH="$TMP_DIR/bin:/usr/bin:/bin:/usr/local/bin" \
  HOME="$HOME" \
  MOCK_GCLOUD_PROJECT="(unset)" \
  "$TMP_DIR/start_local.sh" --yes > "$OUT_3" 2>&1
RC_3=$?
set -e

if [ "$RC_3" -eq 0 ]; then
  echo "FAIL [Test 3]: Expected non-zero exit when GCP_PROJECT is missing"
  cat "$OUT_3"
  exit 1
fi
grep -q "GCP_PROJECT is not set" "$OUT_3" || {
  echo "FAIL [Test 3]: Expected GCP_PROJECT error message"
  cat "$OUT_3"
  exit 1
}
echo "PASS [Test 3]: Missing GCP_PROJECT error handling verified."

echo "=== All start_local.sh Tests PASSED ==="
exit 0

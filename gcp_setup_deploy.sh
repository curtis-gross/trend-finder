#!/bin/bash
# ==============================================================================
# gcp_setup_deploy.sh - End-to-End Client GCP Provisioning & Cloud Run Orchestrator
# Orchestrates preflight checks, GCP resource provisioning, local client config,
# and optional interactive Cloud Run deployment.
# ==============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

DRY_RUN=0
SHOW_HELP=0
CONFIG_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) SHOW_HELP=1 ;;
    -y|--yes) CONFIG_ARGS+=("--yes") ;;
  esac
done

if [ "$SHOW_HELP" -eq 1 ]; then
  cat <<'EOF'
Usage: ./gcp_setup_deploy.sh [gcp_setup.sh options]

Orchestrates:
  1. ./scripts/gcp_preflight.sh
  2. ./scripts/gcp_setup.sh --with-cloud-run "$@"
  3. ./scripts/configure_client.sh (when available)
  4. Explicit [y/N] confirmation before invoking ./cloud_run.sh
EOF
  if [ -x "$REPO_ROOT/scripts/gcp_setup.sh" ]; then
    echo ""
    "$REPO_ROOT/scripts/gcp_setup.sh" --help
  fi
  exit 0
fi

echo "===================================================================="
echo "  Trend Intelligence - Client GCP Setup & Cloud Run Orchestrator"
echo "===================================================================="
echo ""

# 1. Run preflight diagnostics
if [ -x "$REPO_ROOT/scripts/gcp_preflight.sh" ]; then
  echo "[Phase 1/4] Running environment & GCP preflight diagnostics..."
  "$REPO_ROOT/scripts/gcp_preflight.sh"
  echo ""
fi

# 2. Provision GCP project, APIs, GCS bucket, and least-privilege IAM
echo "[Phase 2/4] Running GCP setup wizard (--with-cloud-run)..."
"$REPO_ROOT/scripts/gcp_setup.sh" --with-cloud-run "$@"
echo ""

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry-run complete. Skipping client .env configuration and Cloud Run deployment."
  exit 0
fi

# 3. Configure local client environment (.env) if configure_client.sh is executable
if [ -x "$REPO_ROOT/scripts/configure_client.sh" ]; then
  echo "[Phase 3/4] Running client environment configuration..."
  "$REPO_ROOT/scripts/configure_client.sh" "${CONFIG_ARGS[@]+"${CONFIG_ARGS[@]}"}"
  echo ""
else
  echo "[Phase 3/4] Skipping configure_client.sh (not found or not executable)."
  echo ""
fi

# 4. Ask explicit [y/N] confirmation (default N) before running ./cloud_run.sh
echo "[Phase 4/4] Optional Cloud Run Deployment"
if [ -t 0 ]; then
  read -r -p "Would you like to deploy to Google Cloud Run now via ./cloud_run.sh? [y/N]: " DEPLOY_CONFIRM
  if [[ "${DEPLOY_CONFIRM:-N}" =~ ^[Yy]$ ]]; then
    ./cloud_run.sh
  else
    echo "Skipping Cloud Run deployment. You can deploy later by running ./cloud_run.sh."
  fi
else
  echo "Non-interactive session: skipping automatic Cloud Run deployment. Run ./cloud_run.sh manually when ready."
fi

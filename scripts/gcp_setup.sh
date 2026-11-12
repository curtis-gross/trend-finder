#!/bin/bash
# ==============================================================================
# scripts/gcp_setup.sh - Client Google Cloud Project & Vertex AI Setup Wizard
# Supports: --project <id>, --region <region>, --bucket <name>,
#           --with-cloud-run, --with-youtube, --dry-run, --yes, --help
# ==============================================================================

set -euo pipefail

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

PROJECT_ID=""
REGION=""
BUCKET=""
WITH_CLOUD_RUN=0
WITH_YOUTUBE=0
DRY_RUN=0
ASSUME_YES=0

usage() {
  cat <<'EOF'
Usage: ./scripts/gcp_setup.sh [options]

Options:
  --project <id>      Target Google Cloud Project ID
  --region <region>   Target GCP region (default: us-central1)
  --bucket <name>     Target GCS bucket name (default: <project>-trend-gcs)
  --with-cloud-run    Enable Cloud Run / Cloud Build / Secret Manager APIs and least-privilege IAM
  --with-youtube      Enable YouTube Data API v3 (youtube.googleapis.com)
  --dry-run           Print planned gcloud commands and exit 0 without mutating state
  -y, --yes           Skip interactive [y/N] confirmation prompts
  -h, --help          Show this help message
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT_ID="${2:-}"; shift 2 ;;
    --project=*) PROJECT_ID="${1#*=}"; shift ;;
    --region) REGION="${2:-}"; shift 2 ;;
    --region=*) REGION="${1#*=}"; shift ;;
    --bucket) BUCKET="${2:-}"; shift 2 ;;
    --bucket=*) BUCKET="${1#*=}"; shift ;;
    --with-cloud-run) WITH_CLOUD_RUN=1; shift ;;
    --with-youtube) WITH_YOUTUBE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

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
  printf '%s' "$val"
}

is_real_value() {
  local val="${1:-}"
  [ -z "$val" ] || [ "$val" = "(unset)" ] && return 1
  case "$val" in
    your-*|YOUR-*|\<*\>|placeholder*) return 1 ;;
  esac
  return 0
}

# Step 1: Run preflight diagnostics to inspect current state
if [ -x "$REPO_ROOT/scripts/gcp_preflight.sh" ]; then
  echo "[Step 1/3] Running preflight readiness check..."
  "$REPO_ROOT/scripts/gcp_preflight.sh"
  echo ""
fi

# Step 2: Resolve PROJECT_ID, REGION, and GCS_BUCKET_NAME
if ! is_real_value "$PROJECT_ID"; then
  ENV_PROJ="$(read_env_var GCP_PROJECT)"
  if is_real_value "$ENV_PROJ"; then
    PROJECT_ID="$ENV_PROJ"
  elif command -v gcloud >/dev/null 2>&1; then
    GCLOUD_PROJ="$(gcloud config get-value project --quiet 2>/dev/null | tr -d '\r\n' || true)"
    is_real_value "$GCLOUD_PROJ" && PROJECT_ID="$GCLOUD_PROJ"
  fi
fi

if ! is_real_value "$PROJECT_ID"; then
  if [ "$DRY_RUN" -eq 1 ]; then
    PROJECT_ID="your-gcp-project-id"
  elif [ -t 0 ] && [ "$ASSUME_YES" -eq 0 ]; then
    read -r -p "Enter Google Cloud Project ID: " PROJECT_ID
    while ! is_real_value "$PROJECT_ID"; do
      echo "Error: A valid Google Cloud Project ID is required."
      read -r -p "Enter Google Cloud Project ID: " PROJECT_ID
    done
  else
    echo "Error: Target GCP Project ID could not be resolved. Pass --project <id> or set GCP_PROJECT in .env." >&2
    exit 1
  fi
fi

if ! is_real_value "$REGION"; then
  ENV_REGION="$(read_env_var GCP_REGION)"
  [ -z "$ENV_REGION" ] && ENV_REGION="$(read_env_var REGION)"
  if is_real_value "$ENV_REGION"; then REGION="$ENV_REGION"; else REGION="us-central1"; fi
fi

if ! is_real_value "$BUCKET"; then
  ENV_BUCKET="$(read_env_var GCS_BUCKET_NAME)"
  is_real_value "$ENV_BUCKET" && BUCKET="$ENV_BUCKET"
fi
GCS_BUCKET_NAME="${BUCKET:-${PROJECT_ID}-trend-gcs}"

APIS_TO_ENABLE=("aiplatform.googleapis.com" "storage.googleapis.com")
[ "$WITH_YOUTUBE" -eq 1 ] && APIS_TO_ENABLE+=("youtube.googleapis.com")
[ "$WITH_CLOUD_RUN" -eq 1 ] && APIS_TO_ENABLE+=("run.googleapis.com" "artifactregistry.googleapis.com" "cloudbuild.googleapis.com" "secretmanager.googleapis.com")

echo "[Step 2/3] Planned Google Cloud Configuration Summary"
echo "  Target Project ID:  ${PROJECT_ID}"
echo "  Target Region:      ${REGION}"
echo "  Target GCS Bucket:  gs://${GCS_BUCKET_NAME}"
echo "  APIs to Enable:     ${APIS_TO_ENABLE[*]}"
echo ""
echo "Planned gcloud commands:"
echo "  1. gcloud auth login && gcloud auth application-default login (if unauthenticated)"
echo "  2. gcloud projects describe \"${PROJECT_ID}\" || gcloud projects create \"${PROJECT_ID}\""
echo "  3. gcloud config set project \"${PROJECT_ID}\""
echo "  4. gcloud billing projects describe \"${PROJECT_ID}\" --format=\"value(billingEnabled)\""
echo "  5. gcloud services enable ${APIS_TO_ENABLE[*]} --project=\"${PROJECT_ID}\""
echo "  6. gcloud auth application-default set-quota-project \"${PROJECT_ID}\""
echo "  7. gcloud storage buckets create \"gs://${GCS_BUCKET_NAME}\" --project=\"${PROJECT_ID}\" --location=\"${REGION}\" --uniform-bucket-level-access"
if [ "$WITH_CLOUD_RUN" -eq 1 ]; then
  echo "  8. gcloud projects add-iam-policy-binding \"${PROJECT_ID}\" --member=\"serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com\" --role=\"roles/aiplatform.user\""
  echo "  9. gcloud projects add-iam-policy-binding \"${PROJECT_ID}\" --member=\"serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com\" --role=\"roles/logging.logWriter\""
  echo " 10. gcloud storage buckets add-iam-policy-binding \"gs://${GCS_BUCKET_NAME}\" --member=\"serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com\" --role=\"roles/storage.objectAdmin\""
  echo " 11. gcloud projects add-iam-policy-binding \"${PROJECT_ID}\" --member=\"serviceAccount:<PROJECT_NUMBER>@cloudbuild.gserviceaccount.com\" --role=\"roles/artifactregistry.writer\""
fi
echo ""

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry-run complete. Zero changes were made."
  exit 0
fi

# Step 3: Confirm and execute mutating gcloud commands
if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: Google Cloud SDK (gcloud) is not installed." >&2
  exit 1
fi

if [ "$ASSUME_YES" -eq 0 ]; then
  if [ -t 0 ]; then
    read -r -p "Proceed with running these Google Cloud setup commands? [y/N]: " CONFIRM
    if [[ ! "${CONFIRM:-N}" =~ ^[Yy]$ ]]; then
      echo "Aborted by user."
      exit 0
    fi
  else
    echo "Error: Non-interactive shell detected. Pass --yes to confirm execution or --dry-run to preview." >&2
    exit 1
  fi
fi

echo "[Step 3/3] Provisioning Google Cloud resources..."

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format="value(account)" --quiet 2>/dev/null | head -n 1 || true)"
[ -z "$ACTIVE_ACCOUNT" ] && gcloud auth login
gcloud auth application-default print-access-token --quiet >/dev/null 2>&1 || gcloud auth application-default login

if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating Google Cloud project '${PROJECT_ID}'..."
  gcloud projects create "$PROJECT_ID"
else
  echo "Using existing Google Cloud project '${PROJECT_ID}'."
fi
gcloud config set project "$PROJECT_ID"

BILLING_ENABLED="$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null | tr -d '\r\n' || true)"
if [ "$(printf '%s' "$BILLING_ENABLED" | tr '[:upper:]' '[:lower:]')" != "true" ]; then
  echo "Warning: Billing is not enabled on project '${PROJECT_ID}'."
  echo "Link a billing account at: https://console.cloud.google.com/billing/linkedaccount?project=${PROJECT_ID}"
  if [ -t 0 ] && [ "$ASSUME_YES" -eq 0 ]; then
    read -r -p "Press Enter after linking billing to continue (or Ctrl+C to abort)..."
  else
    echo "Error: Billing must be enabled before enabling Vertex AI and Cloud Storage APIs." >&2
    exit 1
  fi
fi

echo "Enabling APIs: ${APIS_TO_ENABLE[*]}..."
gcloud services enable "${APIS_TO_ENABLE[@]}" --project="$PROJECT_ID"
gcloud auth application-default set-quota-project "$PROJECT_ID" || true

if ! gcloud storage buckets describe "gs://${GCS_BUCKET_NAME}" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating GCS bucket gs://${GCS_BUCKET_NAME} in ${REGION}..."
  gcloud storage buckets create "gs://${GCS_BUCKET_NAME}" --project="$PROJECT_ID" --location="$REGION" --uniform-bucket-level-access
else
  echo "GCS bucket gs://${GCS_BUCKET_NAME} already exists."
fi

if [ "$WITH_CLOUD_RUN" -eq 1 ]; then
  echo "Configuring least-privilege IAM bindings for Cloud Run & Cloud Build..."
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")"
  COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

  for role in "roles/aiplatform.user" "roles/logging.logWriter"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${COMPUTE_SA}" --role="$role" --quiet >/dev/null
  done
  gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET_NAME}" --member="serviceAccount:${COMPUTE_SA}" --role="roles/storage.objectAdmin" --project="$PROJECT_ID" --quiet >/dev/null
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${CLOUDBUILD_SA}" --role="roles/artifactregistry.writer" --quiet >/dev/null
fi

echo "GCP setup complete for project '${PROJECT_ID}' (bucket: gs://${GCS_BUCKET_NAME})."

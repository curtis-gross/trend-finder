#!/bin/bash

if [ -z "${CLOUDSDK_PYTHON:-}" ]; then
  for py_bin in "/opt/homebrew/bin/python3.15" "/opt/homebrew/bin/python3.13" "/opt/homebrew/bin/python3.12" "/opt/homebrew/bin/python3.11" "/usr/local/bin/python3" "/usr/bin/python3" "python3" "python"; do
    if command -v "$py_bin" &> /dev/null; then
      PY_VER=$("$py_bin" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)
      if [[ "$PY_VER" =~ ^3\.(15|14|13|12|11|10)$ ]]; then
        export CLOUDSDK_PYTHON
        CLOUDSDK_PYTHON=$(command -v "$py_bin")
        break
      fi
    fi
  done
fi

set -e

echo "Checking gcloud authentication..."
if ! gcloud auth print-access-token --quiet &> /dev/null; then
  echo "Error: You are not authenticated with gcloud."
  echo "Please run 'gcloud auth login' and 'gcloud auth application-default login' to authenticate."
  exit 1
fi
echo "gcloud authentication verified."

if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^[[:space:]]*#' .env | grep -v '^[[:space:]]*$' | tr -d '\r')
  set +a
fi

SERVICE_NAME="${SERVICE_NAME:-trend-finder}"
REGION="${REGION:-${GCP_REGION:-us-central1}}"
COMPANY_NAME="${COMPANY_NAME:-${ACTIVE_COMPANY_NAME:-test-company}}"
[[ "$COMPANY_NAME" =~ ^your- || -z "$COMPANY_NAME" ]] && COMPANY_NAME="test-company"

DETECTED_PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
[[ "$DETECTED_PROJECT" = "(unset)" || "$DETECTED_PROJECT" =~ ^your- ]] && DETECTED_PROJECT=""

if [ -t 0 ] && { [ -z "${GCP_PROJECT:-}" ] || [[ "${GCP_PROJECT:-}" =~ ^your- ]]; }; then
  if [ -n "$DETECTED_PROJECT" ]; then
    echo "Detected active Google Cloud Project: $DETECTED_PROJECT"
    read -t 5 -r -p "Is this correct? (y/n) [y]: " CONFIRM_PROJECT || CONFIRM_PROJECT=y
    if [[ "${CONFIRM_PROJECT:-y}" =~ ^[Yy]$ ]]; then
      GCP_PROJECT="$DETECTED_PROJECT"
    else
      read -r -p "Enter Google Cloud Project ID: " GCP_PROJECT
    fi
  else
    read -r -p "Enter Google Cloud Project ID: " GCP_PROJECT
  fi
  while [ -z "$GCP_PROJECT" ] || [[ "$GCP_PROJECT" =~ ^your- ]]; do
    echo "Error: Project ID cannot be empty."
    read -r -p "Enter Google Cloud Project ID: " GCP_PROJECT
  done
else
  [[ "${GCP_PROJECT:-}" =~ ^your- ]] && GCP_PROJECT=""
  GCP_PROJECT="${GCP_PROJECT:-$DETECTED_PROJECT}"
  if [ -z "$GCP_PROJECT" ]; then
    echo "Error: GCP_PROJECT is not set and no active gcloud project was found." >&2
    echo "Copy .env.example to .env and set GCP_PROJECT=<your-gcp-project-id>, or run 'gcloud config set project <your-gcp-project-id>'." >&2
    exit 1
  fi
fi
export GCP_PROJECT="$GCP_PROJECT"

echo "Using GCP Project: $GCP_PROJECT"
echo "Deploying ${COMPANY_NAME} Trend Intelligence ($SERVICE_NAME) to Cloud Run..."

if [ -z "${GCS_BUCKET_NAME:-}" ] || [[ "${GCS_BUCKET_NAME:-}" =~ ^your- ]]; then
  GCS_BUCKET_NAME="${GCP_PROJECT}-trend-gcs"
fi

echo "Checking GCS bucket: gs://$GCS_BUCKET_NAME in project $GCP_PROJECT..."
if ! gcloud storage buckets describe "gs://${GCS_BUCKET_NAME}" --project "$GCP_PROJECT" &> /dev/null; then
  echo "GCS Bucket gs://${GCS_BUCKET_NAME} does not exist. Creating bucket in project $GCP_PROJECT..."
  gcloud storage buckets create "gs://${GCS_BUCKET_NAME}" --project "$GCP_PROJECT" --location="$REGION" --uniform-bucket-level-access
  echo "GCS Bucket gs://${GCS_BUCKET_NAME} successfully created."
else
  echo "GCS Bucket gs://${GCS_BUCKET_NAME} verified."
fi

PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT" --format="value(projectNumber)" 2>/dev/null || true)"
COMPUTE_SA="${PROJECT_NUMBER:+$PROJECT_NUMBER-compute@developer.gserviceaccount.com}"

SECRET_BINDINGS=""
HAS_YOUTUBE_SECRET=0

for SECRET_NAME in "YOUTUBE_API_KEY" "GOOGLE_CLOUD_API_KEY" "GEMINI_API_KEY"; do
  SECRET_EXISTS=0
  if gcloud secrets versions access latest --secret="$SECRET_NAME" --project="$GCP_PROJECT" >/dev/null 2>&1; then
    SECRET_EXISTS=1
  else
    ENV_VAL="${!SECRET_NAME:-}"
    if [ -t 0 ] && [ -n "$ENV_VAL" ] && [[ ! "$ENV_VAL" =~ ^your- ]]; then
      read -r -p "Secret '$SECRET_NAME' is set in .env but missing in Secret Manager. Store it in Secret Manager now? [y/N]: " STORE_SEC
      if [[ "${STORE_SEC:-N}" =~ ^[Yy]$ ]]; then
        gcloud secrets describe "$SECRET_NAME" --project="$GCP_PROJECT" >/dev/null 2>&1 || \
          gcloud secrets create "$SECRET_NAME" --replication-policy="automatic" --project="$GCP_PROJECT"
        printf '%s' "$ENV_VAL" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project="$GCP_PROJECT"
        if [ -n "$COMPUTE_SA" ]; then
          gcloud secrets add-iam-policy-binding "$SECRET_NAME" --project="$GCP_PROJECT" \
            --member="serviceAccount:${COMPUTE_SA}" --role="roles/secretmanager.secretAccessor" --quiet >/dev/null 2>&1 || true
        fi
        SECRET_EXISTS=1
      fi
    fi
  fi

  if [ "$SECRET_EXISTS" -eq 1 ]; then
    [ "$SECRET_NAME" = "YOUTUBE_API_KEY" ] && HAS_YOUTUBE_SECRET=1
    SECRET_BINDINGS="${SECRET_BINDINGS:+$SECRET_BINDINGS,}${SECRET_NAME}=${SECRET_NAME}:latest"
  fi
done

if [ "$HAS_YOUTUBE_SECRET" -eq 0 ]; then
  echo "Warning: YOUTUBE_API_KEY was not found in Secret Manager. Proceeding without YouTube API key binding."
fi

CLOUD_RUN_AUTH_MODE="${CLOUD_RUN_AUTH_MODE:-public}"
case "$CLOUD_RUN_AUTH_MODE" in
  iam) AUTH_FLAGS=("--no-allow-unauthenticated") ;;
  no-invoker-check) AUTH_FLAGS=("--no-invoker-iam-check" "--ingress=all") ;;
  public|*) AUTH_FLAGS=("--allow-unauthenticated") ;;
esac

DEPLOY_ENV_VARS="GCS_BUCKET_NAME=${GCS_BUCKET_NAME},GCP_PROJECT=${GCP_PROJECT},GOOGLE_CLOUD_PROJECT=${GCP_PROJECT},TENANT_NAME=${TENANT_NAME:-},COMPANY_NAME=${COMPANY_NAME},ACTIVE_COMPANY_NAME=${ACTIVE_COMPANY_NAME:-${COMPANY_NAME}},DEFAULT_COMPANY_NAME=${DEFAULT_COMPANY_NAME:-${COMPANY_NAME}},VITE_CUSTOMER_NAME=${VITE_CUSTOMER_NAME:-${COMPANY_NAME}},GENAI_PROVIDER=${GENAI_PROVIDER:-vertex}"

DEPLOY_CMD=(
  gcloud run deploy "$SERVICE_NAME"
  --project "$GCP_PROJECT"
  --source .
  --platform managed
  --region "$REGION"
  "${AUTH_FLAGS[@]}"
  --memory 2Gi
  --timeout 300
  --quiet
  --set-env-vars="${DEPLOY_ENV_VARS}"
)
[ -n "$SECRET_BINDINGS" ] && DEPLOY_CMD+=(--set-secrets="${SECRET_BINDINGS}")

"${DEPLOY_CMD[@]}"
echo "Deployment complete."

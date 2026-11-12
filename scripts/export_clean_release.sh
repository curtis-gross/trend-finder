#!/bin/bash
# ==============================================================================
# scripts/export_clean_release.sh - Clean Client Release Exporter
# Packages a standalone copy of trend-finder with zero git history, zero shared
# worktree metadata, and zero local .env / .run / .venv artifacts.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_DIR=""
ARCHIVE_PATH=""
INIT_GIT=false
AUTHOR_NAME="Trend Finder Maintainer"
AUTHOR_EMAIL="noreply@example.com"
DRY_RUN=false
AUTO_YES=false

usage() {
  cat <<'EOF'
Usage: ./scripts/export_clean_release.sh [options] [<output-dir>]

Options:
  --output <dir>          Destination directory for clean release export
  --archive <file.tar.gz> Optional .tar.gz archive path to create
  --init-git              Initialize a fresh single-commit git repository on 'main'
  --author-name <name>    Git commit author name (default: "Trend Finder Maintainer")
  --author-email <email>  Git commit author email (default: "noreply@example.com")
  --dry-run               Verify privacy audit and preview export without writing files
  --yes, -y               Skip confirmation prompt
  --help, -h              Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT_DIR="${2:-}"; shift 2 ;;
    --archive) ARCHIVE_PATH="${2:-}"; shift 2 ;;
    --init-git) INIT_GIT=true; shift ;;
    --author-name) AUTHOR_NAME="${2:-}"; shift 2 ;;
    --author-email) AUTHOR_EMAIL="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --yes|-y) AUTO_YES=true; shift ;;
    --help|-h) usage; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    *)
      if [ -z "$OUTPUT_DIR" ]; then
        OUTPUT_DIR="$1"
        shift
      else
        echo "Unexpected positional argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [ -z "$OUTPUT_DIR" ]; then
  OUTPUT_DIR="$(cd "$ROOT_DIR/.." && pwd)/trend-finder-clean-release"
fi

echo "🔍 Step 1: Running tracked-file privacy audit..."
"$ROOT_DIR/scripts/audit_privacy.sh" --tracked-only

FILE_COUNT="$(git ls-files | wc -l | tr -d '[:space:]')"
echo "📦 Step 2: Ready to export $FILE_COUNT tracked files to: $OUTPUT_DIR"
[ -n "$ARCHIVE_PATH" ] && echo "   Archive target: $ARCHIVE_PATH"
[ "$INIT_GIT" = true ] && echo "   Git init:       fresh 'main' branch ($AUTHOR_NAME <$AUTHOR_EMAIL>)"

if [ "$DRY_RUN" = true ]; then
  echo "✅ [DRY-RUN] Privacy gate passed ($FILE_COUNT tracked files ready). No files written."
  exit 0
fi

if [ -t 0 ] && [ "$AUTO_YES" = false ]; then
  read -r -p "Proceed with clean release export to '$OUTPUT_DIR'? [y/N]: " ans
  if [[ ! "${ans:-N}" =~ ^[Yy]$ ]]; then
    echo "Export cancelled."
    exit 0
  fi
fi

echo "🚀 Step 3: Exporting clean tracked files..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

git archive --format=tar HEAD | tar -x -C "$OUTPUT_DIR"

# Sync working-tree updates to tracked files and new onboarding scripts
while IFS= read -r rel_file; do
  [ -z "$rel_file" ] && continue
  if [ -f "$ROOT_DIR/$rel_file" ]; then
    mkdir -p "$OUTPUT_DIR/$(dirname "$rel_file")"
    cp -p "$ROOT_DIR/$rel_file" "$OUTPUT_DIR/$rel_file"
  elif [ -e "$OUTPUT_DIR/$rel_file" ]; then
    rm -f "$OUTPUT_DIR/$rel_file"
  fi
done < <(git ls-files)

for extra_file in scripts/gcp_preflight.sh scripts/gcp_setup.sh scripts/configure_client.sh scripts/audit_privacy.sh scripts/export_clean_release.sh scripts/setup_assistant.py tests/test_client_setup_and_privacy.py; do
  if [ -f "$ROOT_DIR/$extra_file" ]; then
    mkdir -p "$OUTPUT_DIR/$(dirname "$extra_file")"
    cp -p "$ROOT_DIR/$extra_file" "$OUTPUT_DIR/$extra_file"
  fi
done

rm -rf "$OUTPUT_DIR/.git" "$OUTPUT_DIR/.env" "$OUTPUT_DIR/.env.local" "$OUTPUT_DIR/.run" "$OUTPUT_DIR/.venv" "$OUTPUT_DIR/node_modules" "$OUTPUT_DIR/dist"

if [ -n "$ARCHIVE_PATH" ]; then
  mkdir -p "$(dirname "$ARCHIVE_PATH")"
  tar -czf "$ARCHIVE_PATH" -C "$OUTPUT_DIR" .
  echo "🗜️  Created clean release archive: $ARCHIVE_PATH"
fi

if [ "$INIT_GIT" = true ]; then
  echo "🌱 Step 4: Initializing fresh git repository and verifying strict git history..."
  (
    cd "$OUTPUT_DIR"
    git init -b main >/dev/null
    git config user.name "$AUTHOR_NAME"
    git config user.email "$AUTHOR_EMAIL"
    git add -A
    git commit -m "Initial clean release of trend-finder" >/dev/null
    ./scripts/audit_privacy.sh --strict-git-history
  )
fi

echo "✅ Clean release exported to: $OUTPUT_DIR"

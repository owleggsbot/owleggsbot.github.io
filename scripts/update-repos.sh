#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

OWNER="owleggsbot"

# Pull latest public repos (authenticated via GH_TOKEN if available) to avoid rate limits.
# Exclude forks in the site already, but we keep raw list and let the client filter too.

gh api "users/${OWNER}/repos?per_page=100&sort=pushed" > repos.json

# Bump asset version to force cache refresh when repo list changes.
STAMP="$(date -u +%Y%m%d%H%M%S)"
perl -0777 -i -pe "s/(styles\.css\?v=)\d+/$1${STAMP}/g; s/(site\.js\?v=)\d+/$1${STAMP}/g" index.html

if git diff --quiet; then
  echo "No changes."
  exit 0
fi

git add repos.json index.html

git commit -m "Update cached repos.json (${STAMP})" || true

git push

#!/usr/bin/env bash
# Safe convenience wrapper: publish the current branch to the already-configured origin.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "This directory is not a Git repository."
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "No origin remote is configured. Configure the authorised repository first."
  exit 1
fi

echo "Publishing to the existing origin: $(git remote get-url origin)"
echo "This script never changes remotes and never force-pushes."
git push origin HEAD:main

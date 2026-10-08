#!/usr/bin/env bash
# One-step GitHub Pages Deploy Script for KMU Faculty Appraisal Portal
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  Deploying KMU Appraisal Portal to GitHub Pages"
echo "=========================================================="

REPO_ARG="$1"

if [ -z "$REPO_ARG" ]; then
    echo "Usage: ./deploy_github.sh <github_username_or_full_repo_url>"
    echo "Examples:"
    echo "  ./deploy_github.sh yasar-yousafzai"
    echo "  ./deploy_github.sh https://github.com/my-org/kmu-appraisal-portal.git"
    exit 1
fi

if [[ "$REPO_ARG" =~ ^https?:// ]] || [[ "$REPO_ARG" =~ ^git@ ]]; then
    REMOTE_URL="$REPO_ARG"
else
    REMOTE_URL="https://github.com/${REPO_ARG}/kmu-faculty-appraisal-portal.git"
fi

echo "[+] Setting remote origin to: $REMOTE_URL"
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE_URL"

echo "[+] Pushing to main branch..."
git push -u origin main

echo ""
echo "=========================================================="
echo "  SUCCESS! Code pushed to GitHub."
echo "  GitHub Actions will automatically build & deploy to:"
echo "  https://<username>.github.io/<repo-name>/"
echo "=========================================================="

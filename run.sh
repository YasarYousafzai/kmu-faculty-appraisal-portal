#!/usr/bin/env bash
# Quick local runner for KMU Faculty Annual Performance Appraisal Portal
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  Khyber Medical University (KMU) Peshawar"
echo "  Faculty Annual Performance Appraisal Portal (v3.0)"
echo "=========================================================="

# Try Python 3 server first, or open index.html directly
if command -v python3 &>/dev/null; then
    python3 server.py
else
    echo "Python 3 not found; opening index.html directly in default browser..."
    open index.html
fi

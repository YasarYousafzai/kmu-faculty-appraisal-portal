#!/usr/bin/env bash
# Push and overwrite the initial GitHub README with the complete portal
cd "/Users/yasaryousafzai/Gemini access/kmu_appraisal_portal"
echo "[+] Force-pushing complete portal to GitHub..."
git push -u origin main --force
echo "[+] Done! Check https://github.com/YasarYousafzai/kmu-faculty-appraisal-portal"

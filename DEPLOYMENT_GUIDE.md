# KMU Faculty Annual Performance Appraisal Web Portal (v3.0)
## Free Cloud Deployment & Hosting Guide
**Khyber Medical University (KMU), Peshawar**  
**Document Reference:** `KMU/REG/POL/2026/01-REV`  
**Application Scope:** Universal statutory appraisal calculator for KMU faculty cadres across all constituent institutes and regional campuses.

---

## Overview

The **KMU Faculty Annual Performance Appraisal Portal** is built as an ultra-responsive, zero-dependency, professional web application with official KMU branding. It faithfully replicates the mathematical formulas, category caps, workload unit (WU) rules, and due-process safeguards codified in **Section 9 of the KMU Unified Statutory Policy (KMU/REG/POL/2026/01-REV v3.0)** and the companion official Excel calculator.

The portal can be deployed on **any 100% freely available cloud hosting resource** without ongoing costs, server administration, or credit cards.

---

## Free Hosting Options

### Option 1: GitHub Pages (Recommended — 100% Free Forever)
GitHub Pages provides free hosting with automatic SSL (HTTPS), custom domain support (e.g. `appraisal.kmu.edu.pk`), and 99.99% uptime.

1. **Create a GitHub Repository:**
   - Log into [GitHub](https://github.com) and click **New Repository**.
   - Name it: `kmu-faculty-appraisal-portal`.
   - Set visibility to **Public** (or Private if using GitHub Enterprise).
2. **Push the Portal Files:**
   Open Terminal in this directory:
   ```bash
   cd "/Users/yasaryousafzai/Gemini access/kmu_appraisal_portal"
   git init
   git add .
   git commit -m "Initial release of KMU Faculty Annual Appraisal Web Portal v3.0"
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/kmu-faculty-appraisal-portal.git
   git push -u origin main
   ```
3. **Enable GitHub Pages:**
   - Go to your repository **Settings** → **Pages** (under Code and automation).
   - Under **Build and deployment**:
     - **Source:** Deploy from a branch.
     - **Branch:** `main`, folder: `/(root)`.
   - Click **Save**.
4. **Live URL:**
   - Within 60 seconds, your portal is live at:  
     👉 **`https://<YOUR_GITHUB_USERNAME>.github.io/kmu-faculty-appraisal-portal/`**

---

### Option 2: Netlify Drop (Instant 10-Second Drag-and-Drop — 100% Free)
Netlify requires zero command line or git setup.

1. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)**.
2. Drag and drop the whole **`kmu_appraisal_portal`** folder directly into your browser window.
3. Netlify will immediately publish your website and assign a live HTTPS URL (e.g., `https://kmu-faculty-appraisal.netlify.app`).
4. You can customize the subdomain or attach a university domain for free under **Site settings** → **Domain management**.

---

### Option 3: Vercel (100% Free Forever)
1. Go to **[vercel.com](https://vercel.com)** and log in with GitHub.
2. Click **Add New Project** → Import `kmu-faculty-appraisal-portal`.
3. Keep default settings (Static site, Root Directory `./`) and click **Deploy**.
4. Vercel provides instant global CDN deployment at `https://kmu-faculty-appraisal.vercel.app`.

---

### Option 4: PythonAnywhere (100% Free Python Cloud Hosting)
Since you already have a PythonAnywhere account (e.g., `IPDMClassHub`):

1. Zip the folder:
   ```bash
   cd "/Users/yasaryousafzai/Gemini access"
   zip -r kmu_appraisal_portal.zip kmu_appraisal_portal/
   ```
2. In PythonAnywhere, upload `kmu_appraisal_portal.zip` via the **Files** tab.
3. In a Bash Console:
   ```bash
   unzip kmu_appraisal_portal.zip -d appraisal_app
   ```
4. On the **Web** tab:
   - Create a new web app using **Manual Configuration (Python 3.10)**.
   - Set **Source Code** and **Working Directory** to: `/home/<username>/appraisal_app/kmu_appraisal_portal`
   - Edit the **WSGI configuration file** and set:
     ```python
     import sys
     import os
     project_home = '/home/<username>/appraisal_app/kmu_appraisal_portal'
     if project_home not in sys.path:
         sys.path.insert(0, project_home)
     from wsgi import application
     ```
   - Click **Reload**.

---

### Option 5: Local Desktop & Departmental LAN (Zero Cloud Needed)
If you want to run the portal strictly within KMU premises or on your laptop without any internet:

1. **Instant Run:**
   - Double-click `index.html` to open directly in Google Chrome, Safari, or Microsoft Edge.
2. **Local Departmental Server:**
   - Run in Terminal:
     ```bash
     cd "/Users/yasaryousafzai/Gemini access/kmu_appraisal_portal"
     ./run.sh
     ```
   - Opens automatically at `http://localhost:8088`. Colleagues connected to your departmental Wi-Fi or LAN can access it via `http://<YOUR_IP_ADDRESS>:8088`.

---

## Key Features & Policy Compliance

| Feature | Statutory Rule in Portal | Policy Reference |
| :--- | :--- | :--- |
| **5 Weighting Profiles** | Balanced, Research, Teaching-Focused (IHS), Clinical, Postdocs | Section 9.1 |
| **Workload Delivery Proration** | Prorates QEC score if actual teaching WU < required WU | Section 9.2 Formula 1 |
| **Enforced Sub-Capping** | Publications (50), Books (20), Grants (50), Supervision (40), Patents (40) | Section 9.2 Formula 2 |
| **Corrected Peer Denominator** | 13 Core items (max 78) + 5 CPD items (max 10) = 88 base pts | Section 9.2 Formula 4 |
| **Clinical Service Domain** | Admin (25), Patient Volume (35), On-Call (20), Bedside Teaching (20) | Section 9.2 Formula 5 |
| **Red Flag Safeguard** | Deductions (-25 or -50) blocked unless valid notified inquiry ref is logged | Section 9.4 |
| **PIP Procedure Trigger** | Automatic detection of mandatory (Unsatisfactory) vs discretionary (Average) PIP | Section 9.5 |
| **Appellate Rights Window** | Notifies 7-calendar-day window for lodging formal appeal to Appellate Committee | Section 9.6 |
| **Printable Official Dossier** | A4 printable PER Form A with institutional seal, metadata table, and signatures | Section 10 |
| **Data Portability** | One-click JSON import/export, CSV spreadsheet download, LocalStorage auto-save | Operational |

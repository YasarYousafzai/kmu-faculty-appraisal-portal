# KMU Faculty Appraisal Portal — Controlled Pilot

Policy reference: `KMU/REG/POL/2026/01-REV`.

## Status and permitted use

This repository is a controlled prototype. The underlying policy is pending re-vetting and re-submission to the Syndicate and has no operative force until formally approved and notified.

The current site is static. It has no KMU authentication, server-side personnel record, access control, audit log, approval workflow, or encrypted database. Do not use a public deployment to collect genuine personnel, appraisal, medical, disciplinary, or other confidential data.

Before institutional use, KMU should complete legal and policy approval, validate all open scoring items, appoint a configuration owner, complete privacy and security reviews, and deploy an authenticated server-backed system with role-based access and audit trails.

## Local review

For a private preview on the same computer:

```bash
python3 server.py
```

The server listens on `127.0.0.1:8088` by default, serves only the portal assets and downloadable draft-policy document, and adds restrictive browser-security headers.

To choose another local port:

```bash
python3 server.py --port 8090
```

Binding to a LAN address is deliberately not the default because this prototype has no authentication. If a formally approved review requires network access, use a protected institutional environment and obtain the relevant IT/security approval first.

## Static preview hosting

GitHub Pages or another static host may be used for demonstration only, provided the draft and privacy warnings remain prominent and no live personnel data is entered.

The included `deploy_github.sh` pushes the current commit to the repository's already-configured `origin`. It does not change remotes and does not force-push.

## Verification before publishing

Install the browser-test dependency once, then run:

```bash
npm install
npx playwright install chromium
npm test
```

The model test checks all five profile totals, course-review averages, paper impact-factor bands, best-three caps, book and grant limits, and synthetic discrimination. The browser suite checks reporting-line defaults, course forms, reviewer-stage invalidation, clinical navigation, printable dossier scales, saved drafts and mobile layout. By default Playwright uses its bundled Chromium. Set `KMU_CHROME_PATH` only when an institutionally managed Chrome/Chromium executable is required. If a managed environment cannot launch a browser, `npm run test:model` still checks the arithmetic; the browser suite must then run in a suitable environment before formal pilot use.

## Current configuration summary

| Item | Draft implementation |
| --- | --- |
| Portal appraisal cycle | 1 January–31 December (calendar year); align in the final approved policy/notification |
| Profiles | Balanced; Research-focused; Regional IHS teaching-focused; Clinical; Research cadre/postdoc |
| Rank adjustments | None |
| Teaching entry | Up to ten course entries: title, code, semester/term, level, discipline, theory/practical credits and certified student review. The simple mean of course reviews is the proposed teaching score. A 1+1 course = 16+32 contact hours. Credits do not prorate the score. |
| Research scoring | Proposed 0–100 B1–B5 rubric: best three eligible individual papers (50), books/chapters (5), documented execution including optional grant bonus inside its cap (25), supervision (10), innovation (10). The paper IF bands are not HEC categories and require evidence verification. The grant ledger's historical funding-band marks are reference only. |
| Submission/review sequence | Faculty completes objective evidence before the reviewer screen opens. Any later faculty evidence change closes that screen and clears prior reviewer scores. This is a same-browser demonstration gate, not authentication. |
| Service / peer / clinical rubrics | Marked as proposed/open pending ratification; clinical entries require aggregate unit evidence and exclude patient identifiers |
| Dimension benchmark display | Two stacked 0–100 scales appear once in the final work-done report's sign-off section, on the last print/PDF page. No score/rating strip repeats above the questionnaire pages. Green means ≥80% of each dimension's own ceiling and red means below 80%; this is a visual aid, not a KMU percentile or statutory rating. |
| Reporting-line defaults | Proposed immediate supervisor as Appraising Officer, Additional Director HR as reviewer/countersigner, Vice Chancellor as final authority; actual KMU arrangements and delegations prevail. The appointment/reporting reference-number field is removed. |
| Cohort-relative categories | Well-below/below/average/above/well-above labels deferred pending comparable KMU cohort data and approved thresholds; the draft's fixed absolute rating bands remain separate |
| Rating bands | Outstanding ≥85; Very Good ≥75; Good ≥60; Average 50–59.9; Unsatisfactory <50 |
| PIP | Mandatory below 50; discretionary at 50–59.9 |
| Red-flag deduction | −25 or −50 only after all recorded due-process controls pass |
| Storage | Local browser storage only after explicit “Save & Return Later” action |
| Terminology baseline | KMU directory, HR/scrutiny and admissions nomenclature reviewed 10 October 2026; appointment/posting notification prevails where official sources differ |

Current law, statutes, valid notifications, appointment orders, and approved assignments always take precedence over this prototype.

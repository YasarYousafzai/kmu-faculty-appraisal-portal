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

The check starts and stops its own loopback-only preview server. It covers the five profiles, designation/institute mapping, pilot research normalization, clinical/patient-care evidence controls, principal formulas and caps, 80% dimension benchmarks, incomplete-record safeguards, red-flag controls, explicit-only browser storage, injection handling, printable dossier values, and desktop/mobile rendering. By default it uses the Chromium installed by Playwright. Set `KMU_CHROME_PATH` only when an institutionally managed Chrome/Chromium executable is required.

## Current configuration summary

| Item | Draft implementation |
| --- | --- |
| Portal appraisal cycle | 1 January–31 December (calendar year); align in the final approved policy/notification |
| Profiles | Balanced; Research-focused; Regional IHS teaching-focused; Clinical; Research cadre/postdoc |
| Rank adjustments | None |
| Research normalization | Draft raw points retain a theoretical 200 cap; proposed annual full-credit benchmarks are 15 Regional IHS, 20 Clinical, 30 Balanced, 45 Research-focused, and 60 Research Cadre/Postdoc. These require validation and approval. |
| Service / peer / clinical rubrics | Marked as proposed/open pending ratification; clinical entries require aggregate unit evidence and exclude patient identifiers |
| Dimension benchmark display | Green at ≥80% of that dimension's ceiling; red below 80%; visual aid only, not a statutory rating |
| Rating bands | Outstanding ≥85; Very Good ≥75; Good ≥60; Average 50–59.9; Unsatisfactory <50 |
| PIP | Mandatory below 50; discretionary at 50–59.9 |
| Red-flag deduction | −25 or −50 only after all recorded due-process controls pass |
| Storage | Local browser storage only after explicit “Save & Return Later” action |
| Terminology baseline | KMU directory, HR/scrutiny and admissions nomenclature reviewed 10 October 2026; appointment/posting notification prevails where official sources differ |

Current law, statutes, valid notifications, appointment orders, and approved assignments always take precedence over this prototype.

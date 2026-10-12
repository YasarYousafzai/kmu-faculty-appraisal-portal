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

The model test checks all five profile totals, credit-hour-weighted course reviews, the provisional designation-based teaching-load factor, the original B1–B5 score caps, and synthetic discrimination. The browser suite checks reporting-line defaults, course forms, reviewer-stage invalidation, clinical navigation, itemised printable activity counts, both dossier score dimensions, saved drafts and mobile layout. By default Playwright uses its bundled Chromium. Set `KMU_CHROME_PATH` only when an institutionally managed Chrome/Chromium executable is required. If a managed environment cannot launch a browser, `npm run test:model` still checks the arithmetic; the browser suite must then run in a suitable environment before formal pilot use.

## Current configuration summary

| Item | Draft implementation |
| --- | --- |
| Portal appraisal cycle | 1 January–31 December (calendar year); align in the final approved policy/notification |
| Profiles | Balanced; Research-focused; Regional IHS teaching-focused; Clinical; Research cadre/postdoc |
| Rank adjustments | Provisional teaching-load targets of 3/6/9/12 credits per semester for Professor/Associate Professor/Assistant Professor/Lecturer, doubled for the calendar year; these are pilot assumptions, not an adopted KMU-wide workload schedule. |
| Teaching entry | Up to ten course entries: title, code, semester/term, level, discipline, theory/practical credits and student review. The course-review mean is weighted by contact hours, then multiplied by the capped ratio of taught credits to the pilot annual rank target where assigned. A 1+1 course = 16+32 contact hours. |
| Research scoring | Restored original draft B1–B5 rubric: publications (50), books/chapters (20), grants/proposals (50), supervision (40), and innovation (40), divided by 200 for the research percentage. Publication counts use six impact-factor-band/authorship rows; distinct papers count until the B1 cap. The formula is a pilot proposal, not an approved KMU research standard. |
| Submission/review sequence | Faculty completes objective evidence, reviews Section E's provisional teaching/research/service (and applicable patient-care) points, and may save the draft in that browser before opening committee assessment. Any later faculty evidence change closes the reviewer screen and clears prior reviewer scores. This is a same-browser demonstration gate, not authentication. |
| Service / peer / clinical rubrics | Marked as proposed/open pending ratification; clinical entries require aggregate unit evidence and exclude patient identifiers |
| Final work-done report | Prints every course, the publication-band and grant counts, B2–B5 activity counts, aggregate patient-care measures where applicable, institutional-service counts, and the objective and Appraising Officer scores. The B1 publication reference appears where provided; B2–B5 no longer ask for separate evidence-reference fields. The document remains a controlled draft, not an official PER. |
| Dimension benchmark display | Two stacked 0–100 scales appear once in the final work-done report's sign-off section, on the last print/PDF page. No score/rating strip repeats above the questionnaire pages. Green means ≥80% of each dimension's own ceiling and red means below 80%; this is a visual aid, not a KMU percentile or statutory rating. |
| Reporting-line defaults | Proposed immediate supervisor as Appraising Officer, Additional Director HR as reviewer/countersigner, Vice Chancellor as final authority; actual KMU arrangements and delegations prevail. The appointment/reporting reference-number field is removed. |
| Cohort-relative categories | Well-below/below/average/above/well-above labels deferred pending comparable KMU cohort data and approved thresholds; the draft's fixed absolute rating bands remain separate |
| Rating bands | Outstanding ≥85; Very Good ≥75; Good ≥60; Average 50–59.9; Unsatisfactory <50 |
| PIP | Mandatory below 50; discretionary at 50–59.9 |
| Red-flag deduction | −25 or −50 only after all recorded due-process controls pass |
| Storage | Local browser storage only after explicit “Save & Return Later” action |
| Accounts and assignments | Not implemented on GitHub Pages. Real assessee/assessor sign-in, private assessor queues and administrator access require an approved authentication/database backend with server-enforced permissions; never embed passwords or an admin grant in static files. |
| Terminology baseline | KMU directory, HR/scrutiny and admissions nomenclature reviewed 10 October 2026; appointment/posting notification prevails where official sources differ |

Current law, statutes, valid notifications, appointment orders, and approved assignments always take precedence over this prototype.

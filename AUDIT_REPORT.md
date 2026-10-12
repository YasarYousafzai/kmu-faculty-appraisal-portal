# KMU Faculty Appraisal Portal — Pilot Audit

Updated 12 October 2026 · Controlled software pilot, not an approved KMU policy or official PER.

## Authority and validity limits

The downloadable draft policy is not notified. Its July–June cycle conflicts with the January–December cycle requested for this portal. The proposed teaching average, paper impact-factor bands, category caps, reporting-line defaults, reviewer role, and section arrangement must be approved or corrected by the competent KMU authorities before personnel use. Current law, statutes, valid notifications, appointments and approved assignments prevail. This static site has no authenticated roles, secure personnel database or tamper-proof approval workflow; synthetic records only should be used here.

## Calculations implemented

| Domain | Pilot calculation | Evidence/control |
| --- | --- | --- |
| Teaching | Simple mean of the certified 0–100 student-review scores for complete courses. Credits do not multiply or prorate the mean. | Each course records title, code, term, level, discipline, theory and practical credits, and review score. Up to 10. One theory credit = 16 contact hours; one practical credit = 32. A 1+1 course = 48 contact hours. |
| B1 papers | Best three eligible individual papers, at most 50 points. Proposed IF bands: ≥5 gives 20 lead/10 co; 1–<5 gives 15 lead/8 co; <1 gives 8 lead/4 co. First and corresponding authors use one lead rate, never both. | Title, DOI/stable ID, publication-year IF, role, and indexing/recognition declaration; duplicate IDs block completion. Reviewer must check year, integrity and evidence. Additional papers may be listed but do not increase B1. |
| B2 books/chapters | Proposed differentiated pilot points: international book 5, national book 4, international chapter 3, national chapter 2; category cap **5**. | Positive counts require an evidence reference. Zero is permissible; annual book publication is not expected of everyone. |
| B3 execution/grants | Research milestone self-rating 0–25. A documented award adds 5 or, if no award, a competitive application adds 2, **inside** the 25-point cap. | Milestone evidence reference for a positive rating. The grant ledger's funding-band marks are displayed as historical reference, not added to the pilot total. No grant is required for full execution credit. |
| B4 supervision | Historical draft activity points, capped at 10. | Positive counts require an evidence reference. |
| B5 innovation | Historical draft activity points, capped at 10. | Positive counts require an evidence reference. |

Research = B1+B2+B3+B4+B5 (maximum 100). The profile weight then determines its contribution to the final 100-point appraisal. Both objective and Appraising Officer subjective results appear **once, in the sign-off section of the final work-done report and on its last print/PDF page**, each as attainment of its own weighted ceiling on a common 0–100 scale. The repeated score/rating strip has been removed from the questionnaire pages. Green at ≥80% and red below 80% are visual references, not KMU percentiles or statutory ratings. Relative cohort labels remain deferred.

The proposed IF rates are deliberately simple in response to user feedback, but impact factor and author order alone cannot establish an article's quality or research integrity. The best-three cap limits quantity inflation; it does not solve journal gaming, unequal disciplinary opportunity or rater bias. Those are approval and pilot-study issues, not validated by this software audit.

## Synthetic stress cases

These are arithmetic examples, not KMU employee observations or cohort norms. The browser-free test file checks the examples and boundary conditions.

| Research pattern | B1 | B2 | B3 | B4 | B5 | Research /100 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| No evidenced research | 0 | 0 | 0 | 0 | 0 | 0 |
| Two strong papers (20+8), partial milestones | 28 | 0 | 20 | 0 | 0 | 48 |
| Three eligible papers (20+8+20), milestones, one MPhil/MS completion | 48 | 0 | 20 | 4 | 0 | 72 |
| Same record plus a book and grant award | 48 | 5 | 25 | 4 | 0 | 82 |
| Three top-band lead papers, complete execution/supervision/innovation, no book/grant | 50 | 0 | 25 | 10 | 10 | 95 |
| Ten low-band lead papers alone | 24 | 0 | 0 | 0 | 0 | 24 |

For the Balanced profile (30% research), moving research attainment from 48 to 82 changes the overall appraisal by 10.2 points with other domains held fixed. This is material but not a claim that 82 is “above average” among KMU researchers.

## Verification and remaining work

- `npm run test:model` passed for profile totals, course averages, paper bands and best-three caps, book/grant ceilings and synthetic profile discrimination.
- In the local in-app browser, professor reporting defaults displayed Head of Department/Director → Additional Director HR → Vice Chancellor; two course reviews of 80 and 90 averaged to 85, with 64 contact hours for a 1+1 plus 1+0 record. Three papers (20+8+20) plus 20 execution points yielded 68; a fourth lower-band paper did not increase it. A clinical designation advanced directly from Research to Patient Care. The final dossier showed both scales and course evidence; at a 442-pixel viewport it had no document-level horizontal overflow.
- The full scripted Playwright suite is maintained in `tests/portal-qa.js` but could not launch the locally installed Chrome in this managed environment. It must be run in a suitable browser-test environment before a formal pilot release. This is a test limitation, not a pass.
- For the final-report placement change, the local browser confirmed there is no questionnaire-wide score strip, exactly one comparison scale exists inside the report's final sign-off block, and that block follows the work-done and forward-target sections. The print stylesheet starts the sign-off block on a new last page. This is a structure and styling check; a full rendered-PDF inspection remains pending because the scripted browser cannot launch here.
- The expanded draft work-done report now reproduces itemised course and paper entries, B2–B5 counts and references, grant title/agency/status/amount, institutional-service counts, and conditional aggregate clinical measures with a unit evidence reference. It retains both objective and Appraising Officer scores. In the local browser, four papers showed credited marks of 20, 8, 20 and 0; an awarded PKR 5 million grant appeared in the ledger and contributed a 5-point bonus within B3's 25-point cap. A clinical synthetic profile displayed all four entered measures and its source reference, with no patient-level data. Service entries are labelled reported, not independently verified. This is a screen/DOM check; rendered-PDF pagination remains unverified.
- Before adoption, KMU should reconcile the calendar-year policy text, ratify reporting lines and scoring, pilot anonymized cross-disciplinary dossiers with independent reviewers, measure inter-rater agreement and score distribution, audit journal eligibility/retractions and duplicate work, and deploy an authenticated server-backed workflow for real records.

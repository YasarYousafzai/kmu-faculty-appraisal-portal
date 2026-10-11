# KMU Faculty Appraisal Portal — Calibration and Stress-Test Report

Date: 11 October 2026
Status: Controlled software pilot. Not a KMU-approved policy, official PER, or validated personnel-decision instrument.

## Scope and source-of-authority limits

This audit checks arithmetic, form completion, stage handoff, and plausible separation of **synthetic** performance patterns. It is not a psychometric validation or a measurement of actual KMU faculty. The attached downloadable policy is a draft. The portal's requested **January–December** cycle conflicts with draft Section 10's **July–June** cycle and requires formal reconciliation before approval. The teaching proration, research quality rubric, and clinical and service operational details remain proposals until KMU's competent forums approve and notify them. Current law, statutes, appointment and workload orders, and valid notifications prevail.

The site is public and static: no authenticated faculty/reviewer accounts, secure record transfer, server-side audit trail, or tamper-proof approvals. The staged reviewer screen is a same-browser usability gate only. Do not enter genuine confidential personnel or patient data.

## Teaching conversion checked

The faculty enters annual delivered *theory* and *practical* credit-hour components separately. For the pilot, 1 theory credit equals 16 contact hours and 3 draft teaching workload units (WU); 1 practical credit equals 32 contact hours and 2 WU. Thus a 1+1 course gives **48 contact hours** and **5 WU**. The contact hours are not themselves WU. Both credit entries must be explicit, including zero. The effective teaching percentage updates as `QEC × min(1, delivered WU ÷ applicable draft target WU)`, except for a referenced approved shortfall exemption. A Dean/Director's alternative draft target requires an appointment/reporting reference; a different individual target requires its approved order reference. The annual thresholds and proration require policy approval and workload calibration.

## Quality-first research pilot

The earlier portal normalized draft raw publication/book/grant/supervision/innovation points against profile-specific 15/20/30/45/60-point benchmarks. That could give excessive credit for quantity or imply several major grants in one year. These benchmarks have been **removed from the weighted calculation**. The policy-draft B1–B5 raw schedule remains in a collapsed audit trace only and cannot raise the research score.

The proposed 0–100 Section B score is:

| Element | Ceiling | Pilot rule |
| --- | ---: | --- |
| Up to three distinct selected outputs | 60 | Each output is rated 0–20 for rigor/ethics (8), significance (6), documented personal contribution (4), and relevance/dissemination (2). A DOI or unique institutional record ID is required. Duplicate IDs block completion. |
| Annual research execution | 25 | Progress against a documented plan/ethics/method/data milestone. An optional competitive proposal or award may add 0–5 **inside** the 25-point ceiling, not above it. No annual grant win is required. |
| Mentorship or translation | 15 | Documented trainee, method/data-product, or practice/policy progress, avoiding teaching and clinical double counting. |

A fourth or fifteenth paper adds no further weighted points. A 100-point research score is possible without a grant, book, patent or completed PhD, but requires independently judged high-quality outputs and documented execution/translation. Two excellent outputs can earn up to 40 output points and, with full execution and translation, up to **80 overall research points**; three distinct high-quality outputs can reach 100. This two-output ceiling should be tested with KMU faculty before ratification, because some disciplines may produce fewer but more substantial outputs. The faculty enters provisional quality ratings; the reviewer must examine the actual outputs and cited evidence, not merely check a box. A static web form cannot verify originality, retraction status, journal legitimacy, ethics, contribution, or reviewer identity.

This quality-over-quantity direction is consistent with [DORA's research-assessment declaration](https://sfdora.org/read/) and the [CoARA commitments](https://www.coara.org/agreement/the-commitments/). HEC's [journal-recognition system](https://www.hec.gov.pk/english/services/RnD/Pages/HEC-Recognized-Journals.aspx) should not be treated as a fixed impact-factor conversion; the historical draft table is labelled accordingly. These sources inform the design but do not authorize a KMU scoring rule.

## Synthetic discrimination checks

The examples below are arithmetic stress cases, **not** observed KMU distributions, not grade norms, and not proposed percentiles. Domain inputs are hypothetical 0–100 attainments. `node tests/model-qa.js` checks ordering and the 100-point cap.

| Synthetic pattern | Mix | Teaching | Research | Service | Officer | Clinical | Consolidated pilot points |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Limited performance across domains | Balanced | 45 | 10 | 20 | 40 | — | 28.5 |
| Strong teaching, weak elsewhere | Balanced | 95 | 18 | 10 | 45 | — | 44.9 |
| Mixed documented performance | Balanced | 70 | 45 | 50 | 65 | — | 57.5 |
| Strong performance across domains | Balanced | 90 | 85 | 80 | 85 | — | 85.5 |
| Strong regional teaching assignment | Teaching-focused IHS | 92 | 60 | 75 | 85 | — | 82.8 |
| Strong verified patient-care assignment | Clinical | 80 | 60 | 70 | 85 | 90 | 80.0 |
| Strong dedicated researcher | Research cadre | 75 | 90 | 65 | 85 | — | 85.3 |

Holding the other Balanced domains at teaching 80, service 65 and officer 75, changing research from **25 to 85** changes the consolidated score from **59.5 to 77.5**—an 18-point difference. This confirms that research can materially affect the overall score without a publication-count multiplier. It does **not** prove that the pilot rubric will reliably distinguish real good from average researchers: raters could disagree about rigor or significance, output opportunity differs by discipline, and self-ratings may be inflated. A blinded multi-rater pilot is essential.

## Functional and safety checks

Execution on this machine: the browser-free model suite passed. The local in-app browser was used to verify a 1+1 credit conversion, a 63-point two-output/no-grant case, a 100-point three-output/no-grant case, a zero-research low-scoring case, reviewer-stage unlocking, both 0–100 comparison scales, explicit save/resume, and clearing prior reviewer scores after a faculty edit. The 390 px mobile layout was visually checked and had no document-level horizontal overflow after a tooltip fix. The full Playwright browser suite is written but could not launch here because its Chromium binary is not installed in this sandbox; it must be run in CI or an authorized environment before formal pilot release.

- Designation plus KMU unit determines a default appraisal mix; BPS/TTS/Fixed Pay and the person's name do not. Special assignments need a documented reference. Ambiguous unit names are not automatically assigned to a regional IHS mix.
- Unfinished QEC or one missing credit component leaves teaching pending. A 1+1 example displays 48 contact hours, 5 WU, and the visible QEC/proration calculation.
- A research section needs all selected-output ratings, unique identifiers, scored-element evidence references, deliberate zero entries where applicable, and a completion declaration. Old quantity counts do not alter Section B's weighted score.
- Reviewer tabs stay locked until complete faculty evidence is handed off. A subsequent change to faculty evidence relocks them, removes research confirmation and review reference, and clears all 13 peer and five CPD scores.
- Objective and Appraising Officer percentages appear on stacked, equal 0–100 scales. Green is at/above 80% of that dimension's own ceiling and red is below 80%. This visual reference is **not a cohort percentile or statutory rating**.
- Relative well-below/below/average/above/well-above-average labels are deferred until KMU defines comparable cohorts and validates distributions. Existing draft fixed absolute rating bands are explicitly labelled as such.
- A nonzero disciplinary deduction requires the formal reference, in-period date, concluded inquiry and appeal controls. Completion and printing are blocked when required fields or scores are invalid.
- Browser storage occurs only on explicit Save. Grant text is rendered as text to prevent HTML/script insertion. The site requests no patient identifiers.

## Remaining validity and governance work

1. Obtain approval of the appraisal cycle, profile weights, role-specific teaching targets/proration, research rubric, evidence standards, fixed rating bands, and implementation date. Reconcile the portal and attached policy before institution-wide use.
2. Run anonymized/blinded, cross-disciplinary pilot dossiers scored independently by more than one reviewer. Measure inter-rater agreement, score distribution, ceiling/floor effects, and sensitivity to two versus three high-quality outputs.
3. Calibrate discipline, rank, institute, employment basis, appointment fraction, approved leave, and clinical case-mix effects. Do not equate raw patient volume or paper counts across incomparable settings.
4. Establish a documented process for verifying outputs, ethics/retractions, contribution, grant/proposal evidence, duplicates, and double counting. Keep research and service audit trails without sensitive data on public static hosting.
5. Build a KMU-controlled, authenticated server-backed workflow with role-based access, immutable submission/review timestamps, privacy protections, and an appeal/correction path before handling real records.
6. Define comparable cohorts and prospectively test percentile thresholds; do not retroactively label any individual well-above or below average from synthetic examples.

Terminology note: the institute selector was checked against the [KMU constituent directory](https://kmu.edu.pk/institutes/constituent) and [KMU 2026 admissions list](https://bsadmissions.kmu.edu.pk/constituentlist.php). Their Lakki Marwat labels differ; the current posting/appointment notification must resolve that case. The [KMU affiliated-institute directory](https://kmu.edu.pk/institutes/affiliated) is kept separate from constituent units.

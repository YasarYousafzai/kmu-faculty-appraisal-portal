# KMU Faculty Appraisal Portal — Pilot Calibration and Stress-Test Report

Date: 10 October 2026

Status: Controlled pilot; not an official PER or approved personnel-decision instrument.

## Scope

This audit tests whether the portal can distinguish materially different annual performance patterns without requiring every faculty member to publish many papers, win multiple grants, complete several postgraduate scholars, write books and produce patents in the same calendar year.

The test data are imagined and contain no real employee or patient information. They are software/calibration scenarios, not evidence that the scoring model is valid for KMU's workforce.

## Research normalization tested

The draft publication, book, grant, supervision and innovation point values and category caps remain traceable to a theoretical raw cap of 200 points. For the controlled pilot, annual research attainment is normalized against a proposed profile-specific **full-credit benchmark**:

| Appraisal mix | Proposed full-credit benchmark |
| --- | ---: |
| Regional IHS / Teaching-focused | 15 raw points |
| Clinical / Patient Care | 20 raw points |
| Balanced | 30 raw points |
| Research-focused | 45 raw points |
| Research Cadre / Postdoctoral | 60 raw points |

`Research attainment = min(100, raw research points ÷ profile benchmark × 100)`

These benchmarks are calibration proposals only. They require validation against anonymized KMU distributions and approval by the competent academic/statutory forums before personnel use.

## Imagined faculty scenarios

| Scenario | Assigned mix | Research attainment | Final score | Pilot rating |
| --- | --- | ---: | ---: | --- |
| Strong all-round academic | Balanced | 100.0% | 90.0 | Outstanding |
| Strong teaching at a regional IHS, modest research | Teaching-focused | 93.3% | 87.8 | Outstanding |
| Strong clinician with patient-care attainment of 90% | Clinical / Patient Care | 85.0% | 85.0 | Outstanding |
| Strong research-focused Associate Professor | Research-focused | 97.8% | 87.1 | Outstanding |
| Strong research scientist without relying on supervision points | Research Cadre | 90.8% | 85.8 | Outstanding |
| Typical mixed performance | Balanced | 60.0% | 62.0 | Good |
| Excellent teaching but weak research, service and officer assessment | Balanced | 6.7% | 41.5 | Unsatisfactory |
| Weak performance across domains | Balanced | 10.0% | 28.5 | Unsatisfactory |

The ordering demonstrates that a single strong domain cannot by itself conceal broad underperformance, while strong performance in the main duty of each approved assignment can be recognized without requiring saturation of inapplicable research categories.

## Automated safeguards and stress checks

- A blank or incomplete dossier remains **Not assessed** and cannot be printed as a completed dossier.
- Pay scale/service cadre is limited to BPS, TTS or Fixed Pay and does not alter the appraisal mix.
- Designation and KMU institute/unit drive only the documented default mix; a special assignment requires a reference.
- Research attainment caps at 100% even under extreme input counts.
- Negative, out-of-range and fractional activity counts are rejected or ignored safely and block completion.
- Clinical / Patient Care scoring requires all four aggregate attainment percentages, a service mode and an approved unit-norm/evidence reference.
- No patient identifiers are requested.
- A nonzero disciplinary deduction is ignored and blocks completion unless all due-process controls pass.
- Objective and Appraising Officer attainment compare against the same visual 80% benchmark using their own percentage ceilings, not their raw weighted points.
- The 80% boundary is tested at 79.9% (below) and 80.0% (at/above).
- Names and pay systems are not inputs to the scoring arithmetic, supporting identity invariance at the software level.
- Script injection strings are rendered as text rather than executable content.
- Desktop and mobile layouts are included in automated browser QA.

## Remaining validity risks before a real pilot

1. The profile benchmarks have not been calibrated against historical KMU data.
2. Aggregate research counts still need evidence ledgers, duplicate-output controls and explicit treatment of multi-year awards.
3. Grant geography/amount bands and undefined small-grant Co-PI treatment require ORIC/Research Committee decision.
4. Blank optional research/service counts can mean either zero activity or unfinished entry; a future authenticated system should add a section-complete/no-activity declaration.
5. Clinical attainment percentages depend on specialty-specific approved norms, case-mix adjustment and independent verification. Cross-specialty raw-volume comparison would be invalid.
6. The same activity must not be credited in both Teaching and Clinical, or both Institutional Service and Clinical.
7. Distributional and disparate-impact review is still required across institute, discipline, rank, employment basis and approved leave/FTE status.

## Terminology cross-check

The institute selector follows the [KMU constituent directory](https://kmu.edu.pk/institutes/constituent) for KIMS, KIDS and the Lakki Marwat listing. KMU's [2026 admissions list](https://bsadmissions.kmu.edu.pk/constituentlist.php) uses a different Lakki Marwat IHS label, so the portal asks users to verify the current posting order and does not automatically assign the regional IHS mix from that ambiguous unit. An unsupported Karak constituent entry was removed; KMU's [affiliated-institute list](https://kmu.edu.pk/institutes/affiliated) identifies Karak institutes as affiliated rather than constituent. Clinical and research appointments likewise require verification against the employee's actual order, not an inferred title.

## Recommended controlled pilot

Run the portal on anonymized or synthetic dossiers representing at least poor, typical, strong and exceptional performance in every appraisal mix. Compare portal results with blinded expert-panel judgments, review score distributions and edge cases, then change benchmarks prospectively. No benchmark should be lowered retrospectively after an individual's outputs are known.

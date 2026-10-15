/**
 * KMU Faculty Appraisal Calculator — controlled draft pilot.
 * Configuration source: KMU/REG/POL/2026/01-REV controlled pilot.
 * Not an official PER, personnel database, or substitute for applicable law,
 * statutes, appointment orders, approved assignments, or notifications.
 */
'use strict';

const CONFIG_VERSION = 'KMU-CONTROLLED-PILOT-2026-10-12-SECTION-E-OBJECTIVE';
const STORAGE_KEY = 'KMU_APPRAISAL_DRAFT_v5';
const LEGACY_STORAGE_KEYS = Object.freeze(['KMU_APPRAISAL_DRAFT_v4', 'KMU_APPRAISAL_DRAFT_v3_3', 'KMU_APPRAISAL_DRAFT_v3_2', 'KMU_APPRAISAL_DRAFT_v3_1', 'KMU_APPRAISAL_DRAFT_v3']);
const SCHEMA_VERSION = 5;
const MAX_COURSES = 10;
const PILOT_TEACHING_CREDITS_PER_SEMESTER = Object.freeze({
  'Meritorious Professor': 3, Professor: 3,
  'Associate Professor': 6, 'Assistant Professor': 9, Lecturer: 12
});
const PUBLICATION_ROWS = Object.freeze([
  { id: 'input_pub_high_lead', label: 'IF 5 or above — first / corresponding author', points: 10 },
  { id: 'input_pub_high_co', label: 'IF 5 or above — co-author', points: 5 },
  { id: 'input_pub_mod_lead', label: 'IF 1 to below 5 — first / corresponding author', points: 6 },
  { id: 'input_pub_mod_co', label: 'IF 1 to below 5 — co-author', points: 3 },
  { id: 'input_pub_low_lead', label: 'IF below 1 — first / corresponding author', points: 4 },
  { id: 'input_pub_low_co', label: 'IF below 1 — co-author', points: 2 }
]);
const GRANT_ROWS = Object.freeze([
  { id: 'input_grant_int_pi', label: 'International grant > PKR 10 million — PI', points: 15 },
  { id: 'input_grant_int_copi', label: 'International grant > PKR 10 million — Co-PI', points: 4.5 },
  { id: 'input_grant_nat_pi', label: 'National grant PKR 1–10 million — PI', points: 8 },
  { id: 'input_grant_nat_copi', label: 'National grant PKR 1–10 million — Co-PI', points: 4 },
  { id: 'input_grant_small_pi', label: 'Small competitive grant < PKR 1 million — PI', points: 4 },
  { id: 'input_grant_applied', label: 'Competitive applications submitted', points: 2 }
]);

const PROFILES = Object.freeze({
  'Balanced Profile': Object.freeze({
    name: 'Balanced Profile', teachingWeight: 30, researchWeight: 30,
    serviceWeight: 20, peerWeight: 20, clinicalWeight: 0,
    description: 'Standard academic assignment combining teaching, research and institutional service.'
  }),
  'Research-Focused Profile': Object.freeze({
    name: 'Research-Focused Profile', teachingWeight: 20, researchWeight: 50,
    serviceWeight: 15, peerWeight: 15, clinicalWeight: 0,
    description: 'Documented research-intensive annual assignment; it is not inferred from TTS status alone.'
  }),
  'Teaching-Focused Profile (Regional IHS)': Object.freeze({
    name: 'Teaching-Focused Profile (Regional IHS)', teachingWeight: 50, researchWeight: 15,
    serviceWeight: 20, peerWeight: 15, clinicalWeight: 0,
    description: 'Regional Institute of Health Sciences assignment with a high teaching-load expectation.'
  }),
  'Clinical-Focused Profile (Hospital Faculty)': Object.freeze({
    name: 'Clinical-Focused Profile (Hospital Faculty)', teachingWeight: 15, researchWeight: 20,
    serviceWeight: 10, peerWeight: 10, clinicalWeight: 45,
    description: 'Documented hospital or clinical academic assignment including clinical service.'
  }),
  'Research Cadres / Postdocs': Object.freeze({
    name: 'Research Cadres / Postdocs', teachingWeight: 10, researchWeight: 65,
    serviceWeight: 10, peerWeight: 15, clinicalWeight: 0,
    description: 'Dedicated research scientist, research associate or postdoctoral appointment.'
  })
});

const REGIONAL_IHS_UNITS = new Set([
  'KMU Institute of Health Sciences, Swat', 'KMU Institute of Health Sciences, Swabi',
  'KMU Institute of Health Sciences, Hazara', 'KMU Institute of Health Sciences, Bannu',
  'KMU Institute of Health Sciences, D.I. Khan', 'KMU Institute of Health Sciences, Kohat',
  'KMU Institute of Health Sciences, Mardan',
  'KMU Institute of Health Sciences, Thana', 'KMU Institute of Health Sciences, Parachinar, Kurram',
  'KMU Institute of Health Sciences, Dir Upper', 'KMU Institute of Health Sciences, Lower Dir',
  'KMU Institute of Health Sciences, Buner', 'KMU Institute of Health Sciences, Islamabad'
]);
const RESEARCH_DESIGNATIONS = new Set(['Research Scientist', 'Research Associate', 'Postdoctoral Fellow']);
const CLINICAL_DESIGNATIONS = new Set(['Senior Registrar', 'Medical Officer', 'Consultant']);
const CLINICAL_UNITS = new Set(['KMU Hospital & Research Centre (KMU-H&RC), Peshawar']);

const PEER_PARAMETERS = [
  ['peer_1', '1. Punctuality & Attendance', 'Punctuality at lectures, duties and institutional meetings.'],
  ['peer_2', '2. Collegiality & Teamwork', 'Constructive contribution to faculty and departmental work.'],
  ['peer_3', '3. Communication Skills', 'Clear and respectful interaction with colleagues, students and patients.'],
  ['peer_4', '4. Ethical Conduct & Integrity', 'Research integrity, exam confidentiality, fairness and professional ethics.'],
  ['peer_5', '5. Responsiveness to Students/Patients', 'Accessibility and timely handling of learner or patient concerns.'],
  ['peer_6', '6. Mentorship of Junior Colleagues', 'Documented guidance and support for junior colleagues and scholars.'],
  ['peer_7', '7. Compliance with Policies & SOPs', 'Compliance with applicable statutes, policies, safety rules and SOPs.'],
  ['peer_8', '8. Initiative & Proactivity', 'Evidence-based efforts to improve programmes, services or laboratories.'],
  ['peer_9', '9. Conflict Resolution & Composure', 'Professional handling of disagreements and difficult situations.'],
  ['peer_10', '10. Adaptability to Change', 'Constructive response to curriculum, technology and organisational change.'],
  ['peer_11', '11. Professional Decorum', 'Conduct consistent with the responsibilities of the substantive post.'],
  ['peer_12', '12. Institutional Citizenship', 'Contribution to KMU academic, service and public-interest objectives.'],
  ['peer_13', '13. Quality & Timeliness of Records', 'Accuracy and timeliness of required academic and administrative records.']
].map(([id, label, desc]) => ({ id, label, desc }));

const CPD_TARGETS = [
  ['cpd_1', 'CME/CPD Credit Hours vs Annual Target', 'Verified development credits against the approved target.'],
  ['cpd_2', 'Workshop / Training / Short Course', 'Documented participation in an approved capacity-building activity.'],
  ['cpd_3', 'Professional Certification', 'Relevant credential obtained or renewed during the reporting period.'],
  ['cpd_4', 'Cross-Training / New Technical Skill', 'Documented acquisition of a relevant new skill.'],
  ['cpd_5', 'Presenter / Facilitator at a CPD Event', 'Documented contribution as a presenter, facilitator or resource person.']
].map(([id, label, desc]) => ({ id, label, desc }));

const RESEARCH_RUBRIC_TEXT_IDS = Object.freeze([
  'input_publications_ref', 'input_research_review_ref'
]);

const NUMERIC_INPUT_IDS = [
  'input_actual_wu', // Legacy draft value only: never used for a new teaching score.
  ...PUBLICATION_ROWS.map(row => row.id), ...GRANT_ROWS.map(row => row.id),
  'input_book_int', 'input_book_nat', 'input_chapter_int', 'input_chapter_nat',
  'input_sup_phd', 'input_sup_mphil', 'input_sup_clin_sr', 'input_sup_clin_jr',
  'input_innov_patent_int', 'input_innov_patent_nat', 'input_innov_project',
  'input_innov_overhead', 'input_comm_member', 'input_comm_chair', 'input_policy_doc',
  'input_facility_charge', 'input_clin_admin', 'input_clin_volume', 'input_clin_oncall',
  'input_clin_teaching'
];

const COUNT_INPUT_IDS = Object.freeze([
  ...PUBLICATION_ROWS.map(row => row.id), ...GRANT_ROWS.map(row => row.id),
  'input_book_int', 'input_book_nat',
  'input_chapter_int', 'input_chapter_nat', 'input_sup_phd', 'input_sup_mphil',
  'input_sup_clin_sr', 'input_sup_clin_jr', 'input_innov_patent_int',
  'input_innov_patent_nat', 'input_innov_project', 'input_innov_overhead',
  'input_comm_member', 'input_comm_chair', 'input_policy_doc', 'input_facility_charge'
]);

const NUMERIC_MAXIMA = Object.freeze({
  input_actual_wu: 150,
  input_clin_admin: 100,
  input_clin_volume: 100,
  input_clin_oncall: 100,
  input_clin_teaching: 100
});

const TARGET_IDS = [
  'input_target_teaching', 'input_target_pubs', 'input_target_grants',
  'input_target_sup', 'input_target_service', 'input_target_skills'
];

const FIELD_HELP = Object.freeze({
  input_emp_name: 'Enter the name exactly as it appears in the employee record; do not add a pay scale here.',
  input_emp_desig: 'Select only the substantive post in the appointment order. Pay scale and service cadre are recorded separately.',
  input_leadership_role: 'Select an additional notified leadership appointment, if any. It changes the reporting line, not the substantive profile.',
  input_emp_dept: 'Select the KMU institute or formally notified unit stated in the current posting or appointment order.',
  input_emp_cadre: 'Select only the appointment basis: BPS, TTS, or Fixed Pay. The substantive designation is recorded separately.',
  input_emp_cycle: 'Select the calendar year being appraised: 1 January through 31 December.',
  input_work_assignment: 'Use automatic mapping unless an approved annual workload, JD, contract, or assignment gives a different profile.',
  input_emp_appraiser: 'Proposed immediate supervisory level. The current KMU reporting arrangement and competent authority prevail.',
  input_emp_reviewer: 'Proposed pilot countersigning role: Additional Director HR. Confirm against current KMU instructions before formal use.',
  input_emp_final: 'Proposed pilot final authority: Vice Chancellor, subject to applicable statutes and delegation.',
  input_comm_member_1: 'Optional: enter the member’s name, official designation, and KMU unit exactly as notified.',
  input_comm_member_2: 'Optional: enter the member’s name, official designation, and KMU unit exactly as notified.',
  input_comm_member_3: 'Optional: enter the member’s name, official designation, and KMU unit exactly as notified.',
  input_profile_assignment_ref: 'Required for a manual profile assignment. Cite the approved workload, JD, contract, or assignment reference.',
  input_service_complete: 'Confirm this section is complete, including when every verified institutional-service activity is zero.',
  input_research_complete: 'Confirm this faculty research self-assessment is complete, including a deliberate zero where there was no activity.',
  input_reviewer_role: 'Choose the capacity specified by the current reporting or committee notification; this static pilot cannot authenticate that capacity.',
  input_reviewer_name: 'Enter the designated officer name or exact committee identifier from the current notification.',
  input_research_review_confirm: 'The reviewer confirms that the self-reported publication counts, publication-year impact-factor bands, authorship, grants and supporting evidence were checked.',
  input_publications_ref: 'For positive paper counts, provide a Google Scholar link or short publication-list reference. Enter each distinct paper once.',
  input_additional_appoint: 'Select Yes only for a formally notified additional Dean, Director, or Head of Department appointment.',
  input_red_flag: 'Select a deduction only where every due-process control below is supported by the formal record.',
  input_red_flag_ref: 'Enter the formal inquiry or penalty notification reference issued by the competent authority.',
  input_red_flag_date: 'Enter the notification date. It must fall between 1 January and 31 December of the selected year.',
  input_red_flag_inquiry: 'Confirm Yes only after the applicable formal inquiry has concluded.',
  input_red_flag_appeal: 'Confirm Yes only after the available appeal has been exhausted or decided.',
  input_clin_service_mode: 'Select the type of clinical, dental, diagnostic, rehabilitation or allied-health service stated in the annual assignment.',
  input_clin_evidence_ref: 'Cite the approved unit norm, target, roster, audit or verification reference used for the four aggregate attainment percentages.',
  input_clin_admin: 'Enter the verified 0–100 attainment percentage for clinical governance, patient safety and quality improvement; it contributes 25% of the clinical score.',
  input_clin_volume: 'Enter the verified 0–100 attainment percentage for patient treatment or diagnostic delivery against the approved specialty/unit norm; it contributes 35%.',
  input_clin_oncall: 'Enter the verified 0–100 roster or continuity-duty compliance percentage; it contributes 20% of the clinical score.',
  input_clin_teaching: 'Enter the verified 0–100 clinical teaching/supervision attainment percentage; it contributes 20% and must not duplicate Section A credit.'
});

const CONTEXT_HELP = Object.freeze({
  metaSectionTitle: 'Use the substantive appointment and current posting order. Acting or additional leadership roles are recorded separately.',
  profileAssignmentTitle: 'The default mix comes from designation and institute/unit. It changes only for a clinical, regional IHS, dedicated research, or documented special assignment.',
  teachingSectionTitle: 'Enter each course, taught theory and practical credits, and its student-review score. The faculty-entered course entries immediately count in the proposed contact-hour-weighted teaching score; no KMU approval step is required for this pilot calculation.',
  teachingScoreTitle: 'This is the 0–100 teaching attainment before the profile weight is applied.',
  teachingContributionTitle: 'Teaching attainment multiplied by the teaching weight contributes this many points to the 100-point total.',
  researchSectionTitle: 'Use the original count tables for publications, books, grants, supervision and innovation. The original raw total is out of 200; the research percentage is raw points divided by 200.',
  researchScoreTitle: 'The restored original research formula caps papers at 50, books at 20, grants at 50, supervision at 40 and innovation at 40, then divides the sum by 200.',
  researchContributionTitle: 'Research attainment multiplied by the assigned research weight contributes this many points to the 100-point total.',
  serviceSectionTitle: 'Section D institutional service includes verified committee, policy, leadership and facility responsibilities. Section C patient care is scored separately where applicable.',
  serviceScoreTitle: 'This is the 0–100 institutional-service attainment before the profile weight is applied.',
  serviceContributionTitle: 'Institutional-service attainment multiplied by the service weight contributes this many points to the 100-point total.',
  provisionalSectionTitle: 'Section E summarizes faculty-entered teaching, research, service and any applicable patient-care scores. It appears before the separate committee assessment.',
  provisionalObjectiveTitle: 'Add the weighted objective domain points. Divide by the objective ceiling to see objective attainment; this is not yet the final score out of 100.',
  officerSectionTitle: 'The designated Appraisal Committee or Appraising Officer records all 13 professional criteria and five CPD results. This is the subjective component and remains reviewable.',
  officerScoreTitle: 'This percentage is the attained share of the Appraisal Committee assessment ceiling; the profile weight determines its contribution to the final score.',
  officerContributionTitle: 'Committee assessment attainment multiplied by its profile weight contributes this many points to the 100-point total.',
  clinicalSectionTitle: 'For clinical assignments, verified patient treatment, safety, continuity, on-call service and bedside teaching form a separate objective patient-care measure.',
  clinicalScoreTitle: 'This is the 0–100 clinical and patient-care attainment from four verified measures, using the proposed 25/35/20/20 contribution split.',
  clinicalContributionTitle: 'Clinical and patient-care attainment multiplied by the assigned clinical weight contributes this many points to the 100-point total.',
  targetsSectionTitle: 'These forward-looking targets are agreed for the next calendar year and do not add retrospective points to the current score.',
  dueProcessSectionTitle: 'A deduction is ignored unless the formal reference, in-period date, concluded inquiry and appeal status all pass the portal checks.',
  summarySectionTitle: 'The dossier separates objective evidence from the Appraising Officer assessment and shows attainment against each component ceiling.',
  objectiveScoreTitle: 'Objective attainment is the earned objective score divided by the objective ceiling for the assigned mix. Green means 80% or above; red means below 80%. This is a visual benchmark, not a separate statutory rating.',
  subjectiveScoreTitle: 'Subjective attainment is the Appraising Officer score divided by its profile ceiling. Green means 80% or above; red means below 80%. This is a visual benchmark, not a separate statutory rating.',
  finalScoreTitle: 'The 100-point consolidated score is objective weighted points plus Appraising Officer weighted points, less a valid due-process deduction.',
  ratingScoreTitle: 'The unapproved draft absolute score band is assigned from the consolidated score after all required fields are complete. It is not a KMU cohort-relative category.',
  pipScoreTitle: 'The draft PIP status follows the consolidated rating band, subject to the final approved KMU procedure.',
  penaltyScoreTitle: 'A disciplinary deduction appears only when the formal reference, in-period notification date, concluded inquiry and appeal controls are all satisfied.'
});

function blankScores(items) {
  return Object.fromEntries(items.map(item => [item.id, null]));
}

function createBlankState() {
  return {
    selectedProfile: 'Balanced Profile', activeWeights: null,
    manualProfileOverride: false, profilePending: true, grantsList: [], legacyTeachingWU: null,
    objectiveSubmitted: false, objectiveSnapshot: '', objectiveSubmittedAt: '',
    sectionD: { peerScores: blankScores(PEER_PARAMETERS), cpdScores: blankScores(CPD_TARGETS) }
  };
}

const appraisalState = window.appraisalState = createBlankState();
function el(id) { return document.getElementById(id); }
function updateElementText(id, value) { const node = el(id); if (node) node.textContent = String(value); }
function updateDossierTableRows(bodyId, rows, emptyText, columnCount) {
  const body = el(bodyId); if (!body) return;
  body.replaceChildren();
  const entries = rows.length ? rows : [[emptyText]];
  entries.forEach(values => {
    const row = document.createElement('tr');
    values.forEach(value => {
      const cell = document.createElement('td');
      if (values.length === 1) cell.colSpan = columnCount;
      cell.textContent = String(value);
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}
function getTextValue(id) { return el(id)?.value?.trim() || ''; }
function getInputValue(id) { return Math.max(0, Number.parseFloat(el(id)?.value) || 0); }
function getActivityCount(id) {
  const numeric = Number(getTextValue(id));
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function renderDossierEvidence(researchRubric, service, clinical, profile) {
  const number = value => Number(value || 0).toFixed(1);
  const reference = id => getTextValue(id) || 'Not entered';
  const count = id => getActivityCount(id);
  updateDossierTableRows('dossierResearchPaperRows', PUBLICATION_ROWS.map(row => [
    row.label, String(count(row.id)), String(row.points), `${number(researchRubric.publicationRowScores[row.id])} raw pts`
  ]), 'No publication counts entered; zero publications are permitted.', 4);

  const bookCounts = `International books ${count('input_book_int')}; national books ${count('input_book_nat')}; international chapters ${count('input_chapter_int')}; national chapters ${count('input_chapter_nat')}`;
  const supervisionCounts = `PhD completed ${count('input_sup_phd')}; MPhil/MS completed ${count('input_sup_mphil')}; senior clinical trainees ${count('input_sup_clin_sr')}; junior clinical trainees ${count('input_sup_clin_jr')}`;
  const innovationCounts = `International patents ${count('input_innov_patent_int')}; national patents ${count('input_innov_patent_nat')}; commercial projects/products ${count('input_innov_project')}; overhead-generating engagements ${count('input_innov_overhead')}`;
  updateDossierTableRows('dossierResearchSummaryRows', [
    ['B1 Papers', `${researchRubric.publicationCount} distinct papers declared; all eligible counts contribute until the 50-point cap. Faculty citation/reference: ${reference('input_publications_ref')}.`, `${number(researchRubric.outputQuality)} / 50`],
    ['B2 Books / chapters', bookCounts, `${number(researchRubric.books)} / 20`],
    ['B3 Competitive grants', `${researchRubric.grantCount} grant/proposal activities declared; applications capped at 20 raw points.`, `${number(researchRubric.grants)} / 50`],
    ['B4 Supervision', supervisionCounts, `${number(researchRubric.supervision)} / 40`],
    ['B5 Innovation', innovationCounts, `${number(researchRubric.innovation)} / 40`]
  ], 'Research activity summary pending.', 3);
  updateDossierTableRows('dossierGrantRows', GRANT_ROWS.map(row => [
    row.label, String(count(row.id)), String(row.points),
    `${number(row.id === 'input_grant_applied' ? researchRubric.grantApplicationsRaw : count(row.id) * row.points)} raw pts`
  ]), 'No grant or proposal entered.', 4);

  const clinicalSection = el('dossierClinicalEvidence');
  if (clinicalSection) clinicalSection.hidden = profile.clinical <= 0;
  if (profile.clinical > 0) {
    updateElementText('dossierClinicalMode', getTextValue('input_clin_service_mode') || 'Not entered');
    updateElementText('dossierClinicalReference', reference('input_clin_evidence_ref'));
    updateDossierTableRows('dossierClinicalRows', [
      ['Clinical governance, patient safety and quality improvement', '25%', 'input_clin_admin', clinical.admin, 0.25],
      ['Patient treatment / diagnostic service delivery', '35%', 'input_clin_volume', clinical.volume, 0.35],
      ['On-call, emergency and continuity duty compliance', '20%', 'input_clin_oncall', clinical.onCall, 0.20],
      ['Clinical teaching and supervision delivery', '20%', 'input_clin_teaching', clinical.teaching, 0.20]
    ].map(([label, share, inputId, attainment, fraction]) => [
      label, share,
      getTextValue(inputId) === '' ? 'Not entered' : `${number(attainment)}%`,
      getTextValue(inputId) === '' ? '—' : `${(attainment * fraction).toFixed(2)} / 100`
    ]), 'Clinical evidence pending.', 4);
  }

  updateDossierTableRows('dossierServiceRows', [
    ['Statutory / institutional committee membership', String(count('input_comm_member')), 'Official committee notification', `${number(service.member)} / 25`],
    ['Committee chairmanship / convenorship', String(count('input_comm_chair')), 'Chair / convener appointment order', `${number(service.chair)} / 20`],
    ['Curriculum or institutional policy document authored', String(count('input_policy_doc')), 'Approved curriculum / policy record', `${number(service.policy)} / 30`],
    ['Laboratory, clinical unit or facility management charge', String(count('input_facility_charge')), 'Notified in-charge / section-head record', `${number(service.facility)} / 30`],
    ['Additional Dean / Director / HoD appointment', service.additional ? 'Yes' : 'No', 'Formal additional-appointment notification', `${number(service.additional)} / 15`]
  ], 'Institutional service entries pending.', 4);
}
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Number(value) || 0)); }
function courseContactHours(record) {
  return Math.max(0, Number(record.theory) || 0) * 16 + Math.max(0, Number(record.practical) || 0) * 32;
}
function weightedStudentReviews(records) {
  const contactHours = records.reduce((sum, record) => sum + courseContactHours(record), 0);
  if (!contactHours) return 0;
  return records.reduce((sum, record) => sum + courseContactHours(record) * (Number(record.review) || 0), 0) / contactHours;
}
function paperPilotPoints(impactFactor, role, indexed) {
  const factor = Number(impactFactor);
  if (indexed !== 'Y' || !Number.isFinite(factor) || factor < 0 || factor > 100
    || !['first', 'corresponding', 'co'].includes(role)) return 0;
  const lead = role === 'first' || role === 'corresponding';
  return factor >= 5 ? (lead ? 10 : 5) : factor >= 1 ? (lead ? 6 : 3) : (lead ? 4 : 2);
}
function scoreResearchOriginal({ publicationsRaw = 0, booksRaw = 0, grantsRaw = 0,
  supervisionRaw = 0, innovationRaw = 0 }) {
  const publications = Math.min(50, Math.max(0, publicationsRaw));
  const books = Math.min(20, Math.max(0, booksRaw));
  const grants = Math.min(50, Math.max(0, grantsRaw));
  const supervision = Math.min(40, Math.max(0, supervisionRaw));
  const innovation = Math.min(40, Math.max(0, innovationRaw));
  const raw = Math.min(200, publications + books + grants + supervision + innovation);
  return { publications, books, grants, supervision, innovation, raw, score: raw / 200 * 100 };
}
function calculateTeachingAttainment(reviewAverage, creditsTaught, designation, exempted = false) {
  const perSemesterTarget = PILOT_TEACHING_CREDITS_PER_SEMESTER[designation] ?? null;
  const annualTarget = perSemesterTarget === null ? null : perSemesterTarget * 2;
  const loadFactor = annualTarget === null || exempted
    ? 1 : Math.min(1, Math.max(0, Number(creditsTaught) || 0) / annualTarget);
  return { perSemesterTarget, annualTarget, loadFactor,
    score: clamp(reviewAverage, 0, 100) * loadFactor };
}
function isEnteredTeachingCourse(record) {
  return Object.entries(record).some(([key, value]) => {
    const input = String(value ?? '').trim();
    if (!input) return false;
    // A new course has both credit fields prefilled with zero. That alone is not an entry.
    return key === 'theory' || key === 'practical' ? Number(input) !== 0 : true;
  });
}
function getTeachingLoad() {
  const records = Array.from(document.querySelectorAll('.teaching-course-card')).map(card =>
    Object.fromEntries(Array.from(card.querySelectorAll('[data-course-field]'))
      .map(node => [node.dataset.courseField, node.value.trim()])));
  const enteredWithIndex = records.flatMap((record, index) =>
    isEnteredTeachingCourse(record) ? [{ record, index }] : []);
  const entered = enteredWithIndex.map(({ record }) => record);
  const issues = [];
  enteredWithIndex.forEach(({ record, index }) => {
    const theory = Number(record.theory);
    const practical = Number(record.practical);
    const review = Number(record.review);
    if (!record.title || !record.code || !record.term || !record.level || !record.specialty
      || record.theory === '' || record.practical === '' || record.review === ''
      || !Number.isFinite(theory) || theory < 0 || theory > 100
      || !Number.isFinite(practical) || practical < 0 || practical > 100
      || theory + practical <= 0 || !Number.isFinite(review) || review < 0 || review > 100) {
      issues.push(`complete course ${index + 1} (including both credit components and a 0–100 student review)`);
    }
  });
  const valid = issues.length === 0;
  const complete = valid ? entered : [];
  const theoryCredits = complete.reduce((sum, record) => sum + Number(record.theory), 0);
  const practicalCredits = complete.reduce((sum, record) => sum + Number(record.practical), 0);
  const reviewAverage = weightedStudentReviews(complete);
  return {
    records, entered, issues, hasEntry: complete.length > 0, valid, reviewAverage,
    courseCount: complete.length, theoryCredits, practicalCredits,
    creditsTaught: theoryCredits + practicalCredits,
    theoryHours: theoryCredits * 16, practicalHours: practicalCredits * 32,
    contactHours: theoryCredits * 16 + practicalCredits * 32
  };
}
function renderTeachingCourses(records = [{}, {}, {}]) {
  const container = el('teachingCourses'); if (!container) return;
  container.replaceChildren();
  records.slice(0, MAX_COURSES).forEach((record, index) => {
    const card = document.createElement('div'); card.className = 'teaching-course-card';
    const fields = [
      ['title', 'Course heading / title', 'text', 'e.g., Human Anatomy'],
      ['code', 'Course code', 'text', 'e.g., ANAT-301'],
      ['specialty', 'Discipline / specialty', 'text', 'e.g., Anatomy'],
      ['theory', 'Theory credit hours taught', 'number', 'e.g., 1'],
      ['practical', 'Practical / lab credit hours taught', 'number', 'e.g., 1'],
      ['review', 'Student review score (0–100)', 'number', 'e.g., 85']
    ];
    const heading = document.createElement('div'); heading.className = 'teaching-course-heading';
    const title = document.createElement('strong'); title.textContent = `Course ${index + 1}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-secondary no-print';
    remove.textContent = 'Remove'; remove.disabled = records.length === 1;
    remove.addEventListener('click', () => {
      const current = getTeachingLoad().records; current.splice(index, 1);
      renderTeachingCourses(current.length ? current : [{}]); calculateAll();
    });
    heading.append(title, remove); card.appendChild(heading);
    const grid = document.createElement('div'); grid.className = 'course-fields';
    fields.forEach(([key, labelText, type, placeholder]) => {
      const field = document.createElement('div'); field.className = 'form-group';
      const label = document.createElement('label'); label.textContent = labelText;
      const input = document.createElement('input'); input.type = type; input.className = 'form-control';
      input.id = `course-${index + 1}-${key}`; label.htmlFor = input.id;
      input.dataset.courseField = key;
      const initialValue = (key === 'theory' || key === 'practical') && (record[key] === undefined || record[key] === '')
        ? '0' : record[key] ?? '';
      input.value = safeString(initialValue, 240);
      input.placeholder = placeholder; if (type === 'text') input.maxLength = 240;
      if (type === 'number') { input.min = '0'; input.max = '100'; input.step = 'any'; }
      input.addEventListener('input', calculateAll);
      const hint = document.createElement('span'); hint.className = 'field-hint';
      hint.textContent = key === 'theory' ? 'One theory credit = 16 contact hours; enter 0 if none.'
        : key === 'practical' ? 'One practical credit = 32 contact hours; enter 0 if none.'
          : key === 'review' ? 'Enter the course-level student feedback percentage. The faculty-entered score is used immediately, weighted by the course contact hours.' : '';
      const tip = document.createElement('button'); tip.type = 'button'; tip.className = 'help-tip';
      tip.textContent = '?'; tip.title = hint.textContent || `Enter the ${labelText.toLowerCase()} exactly as shown in the course record.`;
      tip.setAttribute('aria-label', `Help: ${tip.title}`); tip.addEventListener('click', () => showToast(tip.title));
      label.appendChild(tip); field.append(label, input, hint); grid.appendChild(field);
    });
    const addSelect = (key, labelText, options) => {
      const field = document.createElement('div'); field.className = 'form-group';
      const label = document.createElement('label'); label.textContent = labelText;
      const select = document.createElement('select'); select.className = 'form-control'; select.dataset.courseField = key;
      select.id = `course-${index + 1}-${key}`; label.htmlFor = select.id;
      [['', `Select ${labelText.toLowerCase()}`], ...options.map(option => [option, option])].forEach(([value, caption]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = caption; select.appendChild(option);
      });
      select.value = safeString(record[key] ?? '', 80); select.addEventListener('change', calculateAll);
      field.append(label, select); grid.appendChild(field);
    };
    addSelect('term', 'Term / semester', ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8', 'Winter Semester', 'Summer Semester', 'Annual Course']);
    addSelect('level', 'Level of teaching', ['Undergraduate', 'Postgraduate', 'MPhil / MS', 'PhD', 'Clinical Residency / Fellowship']);
    card.appendChild(grid); container.appendChild(card);
  });
  if (el('addTeachingCourseButton')) el('addTeachingCourseButton').disabled = records.length >= MAX_COURSES;
}
window.addTeachingCourse = function () {
  const records = getTeachingLoad().records;
  if (records.length >= MAX_COURSES) return;
  renderTeachingCourses([...records, {}]); calculateAll();
};
function formatTeachingNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function safeString(value, maxLength = 500) { return typeof value === 'string' ? value.slice(0, maxLength) : ''; }
function slug(value) { return (value || 'Faculty').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Faculty'; }

function scorePublicationCounts(counts) {
  const rowScores = Object.fromEntries(PUBLICATION_ROWS.map(row =>
    [row.id, Math.floor(Math.max(0, Number(counts[row.id]) || 0)) * row.points]));
  const raw = Object.values(rowScores).reduce((sum, value) => sum + value, 0);
  return { raw, total: Math.min(50, raw), rowScores };
}

function scoreGrantCounts(counts) {
  const applicationsRaw = Math.min(20, Math.floor(Math.max(0, Number(counts.input_grant_applied) || 0)) * 2);
  const awardsRaw = GRANT_ROWS.filter(row => row.id !== 'input_grant_applied')
    .reduce((sum, row) => sum + Math.floor(Math.max(0, Number(counts[row.id]) || 0)) * row.points, 0);
  const raw = awardsRaw + applicationsRaw;
  return { awardsRaw, applicationsRaw, raw, total: Math.min(50, raw) };
}

function getResearchRubric({ requireReview = false } = {}) {
  const issues = [];
  const publicationCounts = Object.fromEntries(PUBLICATION_ROWS.map(row => [row.id, getActivityCount(row.id)]));
  const publication = scorePublicationCounts(publicationCounts);
  const publicationCount = Object.values(publicationCounts).reduce((sum, count) => sum + count, 0);
  if (publicationCount > 0 && !getTextValue('input_publications_ref')) issues.push('cite the publication list or evidence folder');
  const booksRaw = getActivityCount('input_book_int') * 8 + getActivityCount('input_book_nat') * 5
    + getActivityCount('input_chapter_int') * 4 + getActivityCount('input_chapter_nat') * 2;
  const supervisionRaw = getActivityCount('input_sup_phd') * 8 + getActivityCount('input_sup_mphil') * 4
    + getActivityCount('input_sup_clin_sr') * 8 + getActivityCount('input_sup_clin_jr') * 4;
  const innovationRaw = getActivityCount('input_innov_patent_int') * 10 + getActivityCount('input_innov_patent_nat') * 6
    + getActivityCount('input_innov_project') * 8 + getActivityCount('input_innov_overhead') * 10;
  const grantCounts = Object.fromEntries(GRANT_ROWS.map(row => [row.id, getActivityCount(row.id)]));
  const grantCount = Object.values(grantCounts).reduce((sum, count) => sum + count, 0);
  const grantScore = scoreGrantCounts(grantCounts);
  const { applicationsRaw: grantApplicationsRaw, awardsRaw: grantAwardsRaw, raw: grantsRaw } = grantScore;
  const original = scoreResearchOriginal({ publicationsRaw: publication.raw, booksRaw,
    grantsRaw, supervisionRaw, innovationRaw });
  const { publications: outputQuality, books, grants, supervision, innovation } = original;
  if (!el('input_research_complete')?.checked) issues.push('confirm Section B is complete, including zero activity');
  if (requireReview) {
    if (!el('input_research_review_confirm')?.checked) issues.push('Appraising Officer research-evidence confirmation');
    if (!getTextValue('input_research_review_ref')) issues.push('Appraising Officer research-review reference');
  }
  return {
    publicationCounts, publicationCount, publicationRowScores: publication.rowScores,
    publicationRaw: publication.raw, outputQuality, booksRaw, books, grantCounts, grantCount,
    grantAwardsRaw, grantApplicationsRaw, grantsRaw, grants, supervisionRaw, supervision,
    innovationRaw, innovation, raw: original.raw, score: original.score,
    issues
  };
}

function setVal(id, value) {
  const node = el(id);
  if (!node || value === undefined || value === null) return;
  const safeValue = String(value);
  if (node.tagName === 'SELECT') {
    if (Array.from(node.options).some(option => option.value === safeValue)) node.value = safeValue;
  } else node.value = safeValue;
}

function setCountValidity(node) {
  if (!node || !COUNT_INPUT_IDS.includes(node.id)) return;
  const raw = node.value.trim();
  const numeric = Number(raw);
  const valid = raw === '' || (Number.isInteger(numeric) && numeric >= 0);
  node.setCustomValidity(valid ? '' : 'Enter a non-negative whole-number activity count.');
}

function assertValidProfile(profileKey) {
  const profile = PROFILES[profileKey];
  if (!profile) throw new Error(`Unknown appraisal profile: ${profileKey}`);
  const total = profile.teachingWeight + profile.researchWeight + profile.serviceWeight + profile.peerWeight + profile.clinicalWeight;
  if (total !== 100) throw new Error(`Invalid weight total for ${profileKey}: ${total}`);
  return profile;
}

function applyProfile(profileKey, basis, { pending = false } = {}) {
  const profile = assertValidProfile(profileKey);
  appraisalState.selectedProfile = profileKey;
  appraisalState.profilePending = pending;
  appraisalState.activeWeights = {
    teaching: profile.teachingWeight, research: profile.researchWeight,
    service: profile.serviceWeight, peer: profile.peerWeight,
    clinical: profile.clinicalWeight,
    name: profile.name, basis
  };
  updateElementText('disp_auto_profile_name', pending ? 'Complete designation and institute' : profile.name);
  updateElementText('disp_auto_profile_basis', basis);
  updateElementText('disp_auto_profile_desc', pending
    ? 'The portal waits for both substantive designation and KMU institute/unit before showing an appraisal mix. Pay scale and service cadre never select the mix.'
    : profile.description);
  updateElementText('disp_auto_weight_teaching', pending ? '—' : `${profile.teachingWeight}%`);
  updateElementText('disp_auto_weight_research', pending ? '—' : `${profile.researchWeight}%`);
  updateElementText('disp_auto_weight_service', pending ? '—' : `${profile.serviceWeight}%`);
  updateElementText('disp_auto_weight_peer', pending ? '—' : `${profile.peerWeight}%`);
  updateElementText('disp_auto_weight_clinical', pending ? '—' : `${profile.clinicalWeight}%`);
  setVal('profileDropdownSelect', profileKey);
  setVal('overrideProfileSelect', profileKey);
  const clinicalChip = el('disp_auto_chip_clinical');
  if (clinicalChip) clinicalChip.style.display = profile.clinicalWeight > 0 ? 'flex' : 'none';
  initProfileCards(); toggleClinicalSection();
}

function determineBaseProfile(department, designation, workAssignment, assignmentReference = '') {
  if (workAssignment && workAssignment !== 'AUTO' && PROFILES[workAssignment]) {
    if (!assignmentReference) {
      return { profileKey: 'Balanced Profile', basis: 'Special assignment selected but not applied until a supporting reference is entered' };
    }
    return { profileKey: workAssignment, basis: 'Documented annual work assignment selected by the user' };
  }
  if (RESEARCH_DESIGNATIONS.has(designation)) {
    return { profileKey: 'Research Cadres / Postdocs', basis: 'Dedicated research cadre or postdoctoral substantive appointment' };
  }
  if (CLINICAL_DESIGNATIONS.has(designation) || CLINICAL_UNITS.has(department)) {
    return { profileKey: 'Clinical-Focused Profile (Hospital Faculty)', basis: 'Clinical substantive post or hospital teaching-unit assignment' };
  }
  if (REGIONAL_IHS_UNITS.has(department)) {
    return { profileKey: 'Teaching-Focused Profile (Regional IHS)', basis: 'Regional Institute of Health Sciences appointment' };
  }
  return { profileKey: 'Balanced Profile', basis: 'Default profile pending a documented special annual work assignment' };
}

function autoSelectProfileAndWeights() {
  if (appraisalState.manualProfileOverride) return;
  const department = getTextValue('input_emp_dept');
  const designation = getTextValue('input_emp_desig');
  if (!department || !designation) {
    applyProfile('Balanced Profile', 'Awaiting substantive designation and KMU institute/unit', { pending: true });
    return;
  }
  const result = determineBaseProfile(
    department, designation,
    getTextValue('input_work_assignment'), getTextValue('input_profile_assignment_ref')
  );
  applyProfile(result.profileKey, result.basis);
}

window.toggleManualProfileOverride = function () {
  const panel = el('manualProfileOverridePanel'); if (!panel) return;
  const opening = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = opening ? 'block' : 'none';
  if (!opening) {
    appraisalState.manualProfileOverride = false; setVal('input_profile_assignment_ref', '');
    autoSelectProfileAndWeights(); calculateAll(); showToast('Returned to the draft automatic mapping.');
  } else showToast('Enter a supporting reference before assigning another profile.');
};

window.applyManualProfileOverride = function (profileKey) {
  const reference = getTextValue('input_profile_assignment_ref');
  if (!reference) {
    appraisalState.manualProfileOverride = false; autoSelectProfileAndWeights();
    alert('Enter the approved workload, JD, contract or assignment reference before recording a different profile.'); return;
  }
  if (!PROFILES[profileKey]) return;
  appraisalState.manualProfileOverride = true;
  applyProfile(profileKey, `Documented assignment reference: ${reference}`);
  calculateAll(); showToast('Documented profile assignment recorded.');
};

window.selectProfile = function (profileKey) { window.applyManualProfileOverride(profileKey); };

function updateReportingLine() {
  const leadership = getTextValue('input_leadership_role');
  const designation = getTextValue('input_emp_desig');
  let appraiser = 'Immediate supervisory officer (verify current reporting line)';
  const reviewer = 'Additional Director HR';
  const finalAuthority = 'Vice Chancellor';
  if (leadership === 'Dean of Faculty') {
    appraiser = 'Vice Chancellor';
  } else if (leadership === 'Director / Principal / Head of Institute') {
    appraiser = 'Dean of the applicable current faculty';
  } else if (leadership === 'Chairperson / Head of Department') {
    appraiser = 'Director / Principal';
  } else if (designation === 'Meritorious Professor' || designation === 'Professor' || designation === 'Associate Professor') {
    appraiser = 'Head of Department / Director';
  } else if (designation === 'Assistant Professor' || designation === 'Lecturer') {
    appraiser = 'Head of Department';
  } else if (designation === 'Demonstrator' || CLINICAL_DESIGNATIONS.has(designation)) {
    appraiser = 'Section In-Charge / Head of Department';
  } else if (RESEARCH_DESIGNATIONS.has(designation)) {
    appraiser = 'Principal Investigator / Laboratory Head';
  }
  setVal('input_emp_appraiser', appraiser); setVal('input_emp_reviewer', reviewer); setVal('input_emp_final', finalAuthority);
  syncMetaToDossier();
}

function initProfileCards() {
  const container = el('profileCardsContainer'); if (!container) return;
  container.replaceChildren();
  Object.values(PROFILES).forEach(profile => {
    const card = document.createElement('div');
    card.className = `profile-card ${profile.name === appraisalState.selectedProfile ? 'selected' : ''}`;
    const title = document.createElement('div'); title.className = 'profile-title'; title.textContent = profile.name;
    const desc = document.createElement('p'); desc.style.cssText = 'font-size:0.75rem;color:#64748b;margin-bottom:0.5rem;'; desc.textContent = profile.description;
    const list = document.createElement('ul'); list.className = 'profile-breakdown';
    const values = [
      ['Teaching', `${profile.teachingWeight}%`],
      ['Research & Innovation', `${profile.researchWeight}%`], ['Institutional Service', `${profile.serviceWeight}%`],
      ['Officer Assessment & CPD', `${profile.peerWeight}%`]
    ];
    if (profile.clinicalWeight) values.push(['Clinical Service', `${profile.clinicalWeight}%`]);
    values.forEach(([label, value]) => {
      const item = document.createElement('li'); const left = document.createElement('span'); const right = document.createElement('strong');
      left.textContent = `${label}:`; right.textContent = value; item.append(left, right); list.appendChild(item);
    });
    card.append(title, desc, list); container.appendChild(card);
  });
}

function toggleClinicalSection() {
  const nav = el('navItemClinical'); if (nav) nav.style.display = (appraisalState.activeWeights?.clinical || 0) > 0 ? 'flex' : 'none';
  const wizard = el('wizardStepClinical'); if (wizard) wizard.style.display = (appraisalState.activeWeights?.clinical || 0) > 0 ? '' : 'none';
  const arrow = el('wizardArrowAfterClinical'); if (arrow) arrow.style.display = (appraisalState.activeWeights?.clinical || 0) > 0 ? '' : 'none';
}

function buildScoreControl(item, scale, stateKey, setter) {
  const row = document.createElement('div'); row.className = 'peer-item-card';
  const info = document.createElement('div'); info.className = 'peer-item-info';
  const title = document.createElement('div'); title.className = 'peer-item-title'; title.textContent = item.label;
  const desc = document.createElement('div'); desc.style.cssText = 'font-size:0.75rem;color:#64748b;'; desc.textContent = item.desc;
  info.append(title, desc);
  const controls = document.createElement('div'); controls.className = 'peer-item-scale'; controls.id = `chips_${item.id}`;
  const storedScore = appraisalState.sectionD[stateKey][item.id];
  const hasSelection = storedScore !== null && storedScore !== undefined && storedScore !== '';
  const current = hasSelection ? Number(storedScore) : Number.NaN;
  scale.forEach(score => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `score-chip-btn ${hasSelection && current === score ? 'selected' : ''}`;
    button.textContent = String(score);
    button.setAttribute('aria-label', `${item.label}: score ${score}`);
    button.setAttribute('aria-pressed', String(hasSelection && current === score));
    button.disabled = !canEditReviewerScores();
    button.addEventListener('click', () => setter(item.id, score)); controls.appendChild(button);
  });
  row.append(info, controls); return row;
}

function initPeerControls() {
  const peerList = el('peerParametersList');
  if (peerList) {
    peerList.replaceChildren();
    PEER_PARAMETERS.forEach(item => peerList.appendChild(buildScoreControl(item, [1, 2, 3, 4, 5, 6], 'peerScores', window.setPeerScore)));
  }
  const cpdList = el('cpdTargetsList');
  if (cpdList) {
    cpdList.replaceChildren();
    CPD_TARGETS.forEach(item => cpdList.appendChild(buildScoreControl(item, [0, 1, 2], 'cpdScores', window.setCpdScore)));
  }
}

function canEditReviewerScores() {
  if (!appraisalState.objectiveSubmitted) return false;
  const account = window.KMUAccount;
  if (!account || account.mode === 'demo') return true;
  return account.mode === 'assessor' && account.assessor === true
    && Boolean(account.selectedCaseId) && account.selectedCaseStatus === 'submitted';
}

window.setPeerScore = function (id, score) {
  if (!canEditReviewerScores()) return;
  appraisalState.sectionD.peerScores[id] = clamp(score, 1, 6); initPeerControls(); calculateAll();
};
window.setCpdScore = function (id, score) {
  if (!canEditReviewerScores()) return;
  appraisalState.sectionD.cpdScores[id] = clamp(score, 0, 2); initPeerControls(); calculateAll();
};

function grantBandMatchesAmount(amount, band) {
  const numericAmount = Number(amount) || 0;
  return (band === 'International >10M' && numericAmount > 10000000)
    || (band === 'National 1–10M' && numericAmount >= 1000000 && numericAmount <= 10000000)
    || (band === 'Small <1M' && numericAmount > 0 && numericAmount < 1000000);
}

function computeGrantPoints(amount, role, status, band) {
  if (!grantBandMatchesAmount(amount, band)) return 0;
  if (status === 'Applied') return 2;
  if (status !== 'Won') return 0;
  if (band === 'International >10M') return role === 'PI' ? 15 : role === 'Co-PI' ? 4.5 : 0;
  if (band === 'National 1–10M') return role === 'PI' ? 8 : role === 'Co-PI' ? 4 : 0;
  if (band === 'Small <1M') return role === 'PI' ? 4 : 0;
  return 0;
}

function cycleDateRange(cycle) {
  const ranges = {
    'Calendar Year 2025 (01 January – 31 December 2025)': ['2025-01-01', '2025-12-31'],
    'Calendar Year 2026 (01 January – 31 December 2026)': ['2026-01-01', '2026-12-31'],
    'Calendar Year 2027 (01 January – 31 December 2027)': ['2027-01-01', '2027-12-31']
  };
  return ranges[cycle] || null;
}

function evaluatePenalty() {
  const penalty = Number.parseInt(el('input_red_flag')?.value, 10) || 0;
  const reference = getTextValue('input_red_flag_ref');
  const notificationDate = getTextValue('input_red_flag_date');
  const inquiry = el('input_red_flag_inquiry')?.value === 'Y';
  const appeal = el('input_red_flag_appeal')?.value === 'Y';
  const warning = el('redFlagStatutoryWarning');
  if (penalty === 0) {
    if (warning) { warning.style.display = 'none'; warning.textContent = ''; }
    return { value: 0, reference: '', message: '' };
  }
  const range = cycleDateRange(getTextValue('input_emp_cycle'));
  const inPeriod = Boolean(range && notificationDate && notificationDate >= range[0] && notificationDate <= range[1]);
  const reasons = [];
  if (![25, 50].includes(penalty)) reasons.push('the selected deduction is not permitted');
  if (!reference) reasons.push('notification reference is missing');
  if (!notificationDate) reasons.push('notification date is missing');
  if (!inquiry) reasons.push('concluded inquiry is not confirmed');
  if (!appeal) reasons.push('appeal exhaustion or decision is not confirmed');
  if (!range) reasons.push('the reporting period cannot be machine-validated');
  else if (notificationDate && !inPeriod) reasons.push('notification date is outside the reporting period');
  const valid = reasons.length === 0;
  if (warning) {
    warning.style.display = 'block';
    warning.textContent = valid
      ? `Draft control passed: a ${penalty}-point deduction is included. The underlying record still requires authorised human verification.`
      : `Deduction ignored: ${reasons.join('; ')}.`;
  }
  return { value: valid ? penalty : 0, reference, message: reasons.join('; ') };
}

const REVIEW_STAGE_TABS = new Set(['tab-peer', 'tab-targets', 'tab-redflag', 'tab-summary']);

function getObjectiveFingerprint() {
  const selector = ['tab-meta', 'tab-teaching', 'tab-research', 'tab-service', 'tab-clinical']
    .map(id => `#${id} input, #${id} select, #${id} textarea`).join(', ');
  const controls = Array.from(document.querySelectorAll(selector)).map(node => [
    node.id || node.name, node.type === 'checkbox' ? node.checked : node.value
  ]);
  const grants = appraisalState.grantsList.map(({ title, agency, amount, band, role, status }) =>
    [title, agency, amount, band, role, status]);
  return JSON.stringify([controls, appraisalState.selectedProfile, grants]);
}

function updateReviewStageDisplay() {
  const account = window.KMUAccount;
  const open = appraisalState.objectiveSubmitted && (!account || account.mode === 'demo' || account.mode === 'assessor');
  updateElementText('stageBannerTitle', account?.mode === 'assessor'
    ? 'Assigned assessor — committee assessment' : account?.mode === 'assessee'
      ? 'Faculty account — objective evidence' : open ? 'Stage 2 — local demo reviewer assessment' : 'Stage 1 — faculty evidence');
  updateElementText('stageBannerText', account?.mode === 'assessee'
    ? 'Complete Section E, save the cloud draft, then submit the objective case for an assigned assessor. Submission does not grant you reviewer access.'
    : account?.mode === 'assessor'
      ? 'Only a case actively assigned to this designated assessor can be reviewed. The pilot uses one assessor per case, not multi-assessor averaging. Scores remain provisional pending KMU approval.'
      : open ? 'Local demo page sequence only: committee assessment here is not authenticated access.'
        : 'Complete the profile, teaching, research, patient care where applicable, and service. Review Section E provisional objective scores before committee assessment.');
  updateElementText('reviewHandoffStatus', account?.mode === 'assessor'
    ? `Assigned faculty case opened for review. Objective entries are read-only; complete the separate assessment.`
    : open ? `Faculty sections completed at ${appraisalState.objectiveSubmittedAt || 'the current session'}. Review the declared research evidence before entering Appraisal Committee scores.`
      : 'Review Section E provisional objective scores before continuing to committee assessment.');
  document.querySelectorAll('[data-tab], [data-wizard]').forEach(node => {
    const tab = node.dataset.tab || node.dataset.wizard;
    if (!REVIEW_STAGE_TABS.has(tab)) return;
    node.classList.toggle('stage-locked', !open);
    node.setAttribute('aria-disabled', String(!open));
  });
}

function invalidateHandoffIfObjectiveChanged() {
  if (!appraisalState.objectiveSubmitted || appraisalState.objectiveSnapshot === getObjectiveFingerprint()) return;
  appraisalState.objectiveSubmitted = false;
  appraisalState.objectiveSnapshot = '';
  appraisalState.objectiveSubmittedAt = '';
  if (el('input_research_review_confirm')) el('input_research_review_confirm').checked = false;
  setVal('input_research_review_ref', '');
  PEER_PARAMETERS.forEach(item => { appraisalState.sectionD.peerScores[item.id] = null; });
  CPD_TARGETS.forEach(item => { appraisalState.sectionD.cpdScores[item.id] = null; });
  initPeerControls();
  updateReviewStageDisplay();
  const activeTab = document.querySelector('.tab-content.active')?.id;
  if (REVIEW_STAGE_TABS.has(activeTab)) window.switchTab('tab-provisional');
  showToast('Faculty evidence changed. Review Section E again before committee assessment.');
}

function getObjectiveReadiness() {
  const missing = [];
  const required = [
    ['input_emp_name', 'faculty member name'],
    ['input_emp_desig', 'substantive designation'],
    ['input_emp_dept', 'KMU institute or unit'],
    ['input_emp_cadre', 'pay scale and service cadre (BPS, TTS, or Fixed Pay)'],
    ['input_emp_cycle', 'calendar-year appraisal cycle']
  ];
  required.forEach(([id, label]) => { if (!getTextValue(id)) missing.push(label); });
  const teaching = getTeachingLoad();
  if (!teaching.hasEntry) missing.push('at least one complete course and student-review score');
  missing.push(...teaching.issues);
  missing.push(...getResearchRubric().issues);
  if (!el('input_service_complete')?.checked) missing.push('institutional-service completion declaration');
  const profile = appraisalState.activeWeights;
  if (profile?.clinical > 0) {
    const clinicalIds = ['input_clin_admin', 'input_clin_volume', 'input_clin_oncall', 'input_clin_teaching'];
    if (clinicalIds.some(id => getTextValue(id) === '')) missing.push('all four clinical service scores');
    if (!getTextValue('input_clin_service_mode')) missing.push('clinical or diagnostic service mode');
    if (!getTextValue('input_clin_evidence_ref')) missing.push('approved clinical unit norm or evidence reference');
  }
  const invalidNumericControls = Array.from(document.querySelectorAll('input[type="number"]:invalid'))
    .filter(input => NUMERIC_INPUT_IDS.includes(input.id));
  if (invalidNumericControls.length) missing.push('valid scoring values within the permitted ranges');
  return { ready: missing.length === 0, missing };
}

function getAssessmentReadiness(penaltyEvaluation = null) {
  const missing = [...getObjectiveReadiness().missing];
  if (!appraisalState.objectiveSubmitted || appraisalState.objectiveSnapshot !== getObjectiveFingerprint()) {
    missing.push('completed faculty evidence stage');
  }
  if (!getTextValue('input_reviewer_role')) missing.push('notified reviewer capacity');
  if (!getTextValue('input_reviewer_name')) missing.push('reviewer or committee identifier');
  missing.push(...getResearchRubric({ requireReview: true }).issues);
  if (PEER_PARAMETERS.some(item => {
    const score = appraisalState.sectionD.peerScores[item.id];
    return !Number.isInteger(score) || score < 1 || score > 6;
  })) missing.push('all 13 Appraising Officer scores');
  if (CPD_TARGETS.some(item => {
    const score = appraisalState.sectionD.cpdScores[item.id];
    return !Number.isInteger(score) || score < 0 || score > 2;
  })) missing.push('all five CPD target scores');
  const selectedPenalty = Number.parseInt(el('input_red_flag')?.value, 10) || 0;
  if (selectedPenalty > 0) {
    const evaluatedPenalty = penaltyEvaluation || evaluatePenalty();
    if (evaluatedPenalty.value !== selectedPenalty) missing.push('complete and valid disciplinary due-process controls');
  }
  const uniqueMissing = [...new Set(missing)];
  return { ready: uniqueMissing.length === 0, missing: uniqueMissing };
}

function classifyScore(rawScore) {
  const score = Number(Math.max(0, Number(rawScore) || 0).toFixed(1));
  if (score >= 85) return {
    score, rating: 'Outstanding', ratingClass: 'rating-outstanding', pipStatus: 'PIP not required',
    pipDescription: 'Draft rating band: Outstanding (85 or above).'
  };
  if (score >= 75) return {
    score, rating: 'Very Good', ratingClass: 'rating-very-good', pipStatus: 'PIP not required',
    pipDescription: 'Draft rating band: Very Good (75–84.9).'
  };
  if (score >= 60) return {
    score, rating: 'Good', ratingClass: 'rating-good', pipStatus: 'PIP not required',
    pipDescription: 'Draft rating band: Good (60–74.9).'
  };
  if (score >= 50) return {
    score, rating: 'Average', ratingClass: 'rating-average', pipStatus: 'PIP at Reviewing Officer discretion',
    pipDescription: 'Draft rating band: Average (50–59.9); a PIP is discretionary.'
  };
  return {
    score, rating: 'Unsatisfactory', ratingClass: 'rating-unsatisfactory',
    pipStatus: 'Mandatory PIP under draft Section 9.5',
    pipDescription: 'Displayed score below 50: the draft requires a Performance Improvement Plan.'
  };
}

function benchmarkState(percent, ready) {
  return !ready ? 'pending' : percent >= 80 ? 'high' : 'low';
}

function calculatePilotScenario(profileKey, domains = {}) {
  const profile = assertValidProfile(profileKey);
  const teaching = clamp(domains.teaching, 0, 100);
  const research = clamp(domains.research, 0, 100);
  const service = clamp(domains.service, 0, 100);
  const officer = clamp(domains.officer, 0, 100);
  const clinical = profile.clinicalWeight > 0 ? clamp(domains.clinical, 0, 100) : 0;
  const penalty = [0, 25, 50].includes(Number(domains.penalty)) ? Number(domains.penalty) : 0;
  const score = Math.max(0,
    teaching * profile.teachingWeight / 100
    + research * profile.researchWeight / 100
    + service * profile.serviceWeight / 100
    + officer * profile.peerWeight / 100
    + clinical * profile.clinicalWeight / 100
    - penalty);
  const classification = classifyScore(score);
  return { score: classification.score, rating: classification.rating, researchAttainment: research };
}

function updateBenchmarkDisplay(cardId, statusId, inlineId, percent, ready, points, ceiling) {
  const card = el(cardId);
  const status = el(statusId);
  const inline = el(inlineId);
  const state = benchmarkState(percent, ready);
  const stateText = state === 'pending'
    ? 'Awaiting complete appraisal'
    : state === 'high' ? 'At or above 80% benchmark' : 'Below 80% benchmark';
  if (card) {
    card.classList.remove('benchmark-pending', 'benchmark-high', 'benchmark-low');
    card.classList.add(`benchmark-${state}`);
  }
  if (status) status.textContent = stateText;
  if (inline) {
    inline.className = `benchmark-text-${state}`;
    inline.textContent = ready
      ? `${points.toFixed(2)} of ${ceiling} points (${percent.toFixed(1)}% — ${stateText.toLowerCase()})`
      : 'Not assessed';
  }
}

function updateComparisonScale(fillId, valueId, percent, ready, pendingText) {
  const fill = el(fillId);
  const state = benchmarkState(percent, ready);
  if (fill) {
    fill.style.width = ready ? `${clamp(percent, 0, 100)}%` : '0%';
    fill.classList.remove('benchmark-high', 'benchmark-low', 'benchmark-pending');
    fill.classList.add(`benchmark-${state}`);
  }
  updateElementText(valueId, ready
    ? `${percent.toFixed(1)}% of ceiling (${state === 'high' ? '≥80%' : '<80%'} reference)`
    : pendingText);
}

function calculateAll() {
  if (!appraisalState.activeWeights) autoSelectProfileAndWeights();
  invalidateHandoffIfObjectiveChanged();
  const profile = appraisalState.activeWeights; if (!profile) return;

  const visibleWeight = value => appraisalState.profilePending ? '—' : `${value}%`;
  updateElementText('navPillTeaching', visibleWeight(profile.teaching));
  updateElementText('navPillResearch', visibleWeight(profile.research));
  updateElementText('navPillService', visibleWeight(profile.service));
  updateElementText('navPillPeer', visibleWeight(profile.peer));
  updateElementText('navPillClinical', visibleWeight(profile.clinical));
  const teachingLoad = getTeachingLoad();
  const legacyTeachingNote = el('legacyTeachingNote');
  if (legacyTeachingNote) {
    const hasLegacy = appraisalState.legacyTeachingWU !== null;
    legacyTeachingNote.hidden = !hasLegacy;
    if (hasLegacy) legacyTeachingNote.textContent = `This older draft recorded ${formatTeachingNumber(appraisalState.legacyTeachingWU)} teaching WU. It cannot be converted into course-level student reviews. Re-enter each course and its student-review score; the old WU has not been scored.`;
  }
  const teachingReady = !appraisalState.profilePending && teachingLoad.hasEntry && teachingLoad.valid;
  const teachingExempted = getTextValue('input_wu_exempted') === 'Y';
  const teachingTarget = calculateTeachingAttainment(teachingLoad.reviewAverage,
    teachingLoad.creditsTaught, getTextValue('input_emp_desig'), teachingExempted);
  const attainmentA = teachingReady ? teachingTarget.score : 0;
  const weightedA = attainmentA * profile.teaching / 100;
  updateElementText('disp_course_count', teachingLoad.courseCount);
  updateElementText('disp_teaching_hours', teachingLoad.hasEntry && teachingLoad.valid
    ? `${formatTeachingNumber(teachingLoad.contactHours)} contact hours` : '—');
  updateElementText('disp_teaching_hours_detail', teachingLoad.hasEntry && teachingLoad.valid
    ? `${formatTeachingNumber(teachingLoad.theoryHours)} theory + ${formatTeachingNumber(teachingLoad.practicalHours)} practical`
    : 'Theory + practical hours');
  updateElementText('disp_teaching_credits', teachingReady ? formatTeachingNumber(teachingLoad.creditsTaught) : '—');
  updateElementText('disp_rank_target', appraisalState.profilePending ? '—'
    : teachingTarget.annualTarget === null ? 'Not assigned'
      : `${teachingTarget.perSemesterTarget} / semester; ${teachingTarget.annualTarget} / year`);
  updateElementText('disp_teaching_load_factor', teachingReady
    ? teachingTarget.annualTarget === null ? 'No rank proration'
      : teachingExempted ? 'Approved exemption declared — 100%'
        : `${(teachingTarget.loadFactor * 100).toFixed(1)}% of pilot target`
    : 'Awaiting course entries');
  let teachingExplanation = 'Enter at least one complete course with its student-review score.';
  if (appraisalState.profilePending) teachingExplanation = 'Choose the substantive designation and KMU institute on Step 1 first.';
  else if (!teachingLoad.valid) teachingExplanation = teachingLoad.issues.join('; ');
  else if (teachingReady) {
    const reviewFormula = `(${teachingLoad.entered.map(record => `${formatTeachingNumber(courseContactHours(record))} h × ${Number(record.review).toFixed(1)}%`).join(' + ')}) ÷ ${formatTeachingNumber(teachingLoad.contactHours)} h = ${teachingLoad.reviewAverage.toFixed(1)}% student-review mean`;
    const loadFormula = teachingTarget.annualTarget === null
      ? `No 3/6/9/12 pilot target applies to ${getTextValue('input_emp_desig')}; the review mean is used directly.`
      : teachingExempted
        ? `An approved teaching-load exemption is declared; no pilot rank-target proration is applied (subject to Appraising Officer review).`
        : `${formatTeachingNumber(teachingLoad.creditsTaught)} credits taught ÷ ${teachingTarget.annualTarget} annual pilot target = ${(teachingTarget.loadFactor * 100).toFixed(1)}% workload factor (capped at 100%).`;
    teachingExplanation = `Faculty-entered course score: ${reviewFormula}. ${loadFormula} Effective teaching score: ${attainmentA.toFixed(1)}%.`;
  }
  updateElementText('disp_teaching_formula', teachingExplanation);
  updateElementText('disp_effective_teaching', teachingReady ? `${attainmentA.toFixed(1)}%` : '—');
  updateElementText('disp_weight_a', appraisalState.profilePending ? '—' : `${profile.teaching}%`);
  updateElementText('disp_weighted_a', teachingReady ? `${weightedA.toFixed(2)} pts` : '—');

  const researchRubric = getResearchRubric();
  const attainmentB = researchRubric.score;
  const weightedB = attainmentB * profile.research / 100;
  [['disp_sub_b2_raw', researchRubric.booksRaw], ['disp_sub_b2', researchRubric.books],
    ['disp_sub_b3_raw', researchRubric.grantsRaw], ['disp_sub_b3', researchRubric.grants],
    ['disp_sub_b4_raw', researchRubric.supervisionRaw], ['disp_sub_b4', researchRubric.supervision],
    ['disp_sub_b5_raw', researchRubric.innovationRaw], ['disp_sub_b5', researchRubric.innovation]]
    .forEach(([id, value]) => updateElementText(id, Number(value).toFixed(1)));
  PUBLICATION_ROWS.forEach(row => updateElementText(`disp_${row.id}`, researchRubric.publicationRowScores[row.id]));
  GRANT_ROWS.forEach(row => updateElementText(`disp_${row.id}`,
    row.id === 'input_grant_applied' ? researchRubric.grantApplicationsRaw : getActivityCount(row.id) * row.points));
  updateElementText('disp_sub_b1_raw', researchRubric.publicationRaw.toFixed(1));
  updateElementText('disp_sub_b1', researchRubric.outputQuality.toFixed(1));
  updateElementText('disp_raw_b', `${researchRubric.raw.toFixed(1)} / 200 = ${attainmentB.toFixed(1)}%`);
  updateElementText('disp_research_quality_summary', `${researchRubric.outputQuality.toFixed(1)} / 50 papers`);
  updateElementText('disp_research_books_summary', `${researchRubric.books.toFixed(1)} / 20 books`);
  updateElementText('disp_research_grants_summary', `${researchRubric.grants.toFixed(1)} / 50 grants`);
  updateElementText('disp_research_supervision_summary', `${researchRubric.supervision.toFixed(1)} / 40 supervision`);
  updateElementText('disp_research_innovation_summary', `${researchRubric.innovation.toFixed(1)} / 40 innovation`);
  updateElementText('disp_research_verification_state', researchRubric.issues.length
    ? `Provisional; resolve: ${researchRubric.issues.join(', ')}.`
    : el('input_research_review_confirm')?.checked && getTextValue('input_research_review_ref')
      ? 'Appraising Officer review recorded; the count declarations remain subject to normal record review.'
      : 'Faculty self-assessment complete; awaiting Appraising Officer evidence review.');
  updateElementText('disp_weight_b', `${profile.research}%`);
  updateElementText('disp_weighted_b', `${weightedB.toFixed(2)} pts`);

  const serviceMember = Math.min(25, getActivityCount('input_comm_member') * 5);
  const serviceChair = Math.min(20, getActivityCount('input_comm_chair') * 10);
  const servicePolicy = Math.min(30, getActivityCount('input_policy_doc') * 10);
  const serviceFacility = Math.min(30, getActivityCount('input_facility_charge') * 15);
  const serviceAdditional = el('input_additional_appoint')?.value === 'Y' ? 15 : 0;
  const rawC = Math.min(100, serviceMember + serviceChair + servicePolicy + serviceFacility + serviceAdditional);
  const attainmentC = rawC;
  const weightedC = attainmentC * profile.service / 100;
  [['disp_comm_member', serviceMember], ['disp_comm_chair', serviceChair], ['disp_policy_doc', servicePolicy],
    ['disp_facility_charge', serviceFacility], ['disp_add_appoint', serviceAdditional]]
    .forEach(([id, value]) => updateElementText(id, value));
  updateElementText('disp_raw_c', attainmentC.toFixed(1));
  updateElementText('disp_raw_c_card', `${attainmentC.toFixed(1)}%`);
  updateElementText('disp_weight_c', `${profile.service}%`);
  updateElementText('disp_weighted_c', `${weightedC.toFixed(2)} pts`);

  const peerRaw = PEER_PARAMETERS.reduce((sum, item) => sum + clamp(appraisalState.sectionD.peerScores[item.id], 0, 6), 0);
  const cpdRaw = CPD_TARGETS.reduce((sum, item) => sum + clamp(appraisalState.sectionD.cpdScores[item.id], 0, 2), 0);
  const rawD = Math.min(88, peerRaw + cpdRaw);
  const attainmentD = rawD / 88 * 100;
  const weightedD = attainmentD * profile.peer / 100;
  updateElementText('disp_peer_core_sum', peerRaw); updateElementText('disp_cpd_sum', cpdRaw);
  updateElementText('disp_raw_d', `${attainmentD.toFixed(1)}%`);
  updateElementText('disp_weight_d', `${profile.peer}%`);
  updateElementText('disp_weighted_d', `${weightedD.toFixed(2)} pts`);

  const clinicalAdmin = clamp(getInputValue('input_clin_admin'), 0, 100);
  const clinicalVolume = clamp(getInputValue('input_clin_volume'), 0, 100);
  const clinicalOnCall = clamp(getInputValue('input_clin_oncall'), 0, 100);
  const clinicalTeaching = clamp(getInputValue('input_clin_teaching'), 0, 100);
  const rawE = profile.clinical > 0
    ? Math.min(100, clinicalAdmin * 0.25 + clinicalVolume * 0.35 + clinicalOnCall * 0.20 + clinicalTeaching * 0.20)
    : 0;
  const attainmentE = rawE;
  const weightedE = attainmentE * profile.clinical / 100;
  updateElementText('disp_raw_e', rawE.toFixed(1)); updateElementText('disp_raw_e_card', `${rawE.toFixed(1)}%`);
  updateElementText('disp_weight_e', `${profile.clinical}%`);
  updateElementText('disp_weighted_e', `${weightedE.toFixed(2)} pts`);

  const penalty = evaluatePenalty();
  updateElementText('disp_red_flag_penalty', penalty.value ? `-${penalty.value} pts` : '0 pts');
  const objectiveScore = weightedA + weightedB + weightedC + weightedE;
  const objectiveMaximum = profile.teaching + profile.research + profile.service + profile.clinical;
  const objectivePercent = objectiveMaximum ? objectiveScore / objectiveMaximum * 100 : 0;
  const subjectiveScore = weightedD; const subjectiveMaximum = profile.peer;
  const subjectivePercent = subjectiveMaximum ? subjectiveScore / subjectiveMaximum * 100 : 0;
  const provisionalScore = Math.max(0, objectiveScore + subjectiveScore - penalty.value);
  const classification = classifyScore(provisionalScore);
  const displayedScore = classification.score;
  const readiness = getAssessmentReadiness(penalty);
  const objectiveReadiness = getObjectiveReadiness();
  const objectiveReady = objectiveReadiness.ready;
  const provisionalDomain = (key, attainment, weight, weighted, ready) => {
    updateElementText(`provisional_${key}_attainment`, ready ? `${attainment.toFixed(1)}%` : 'Pending');
    updateElementText(`provisional_${key}_weight`, appraisalState.profilePending ? '—' : `${weight} points`);
    updateElementText(`provisional_${key}_points`, ready ? `${weighted.toFixed(2)} / ${weight}` : 'Pending');
  };
  const profileReady = !appraisalState.profilePending;
  provisionalDomain('teaching', attainmentA, profile.teaching, weightedA, teachingReady);
  provisionalDomain('research', attainmentB, profile.research, weightedB,
    profileReady && researchRubric.issues.length === 0);
  provisionalDomain('service', attainmentC, profile.service, weightedC,
    profileReady && Boolean(el('input_service_complete')?.checked));
  const clinicalProvisionalRow = el('provisional_clinical_row');
  if (clinicalProvisionalRow) clinicalProvisionalRow.hidden = profile.clinical <= 0;
  if (profile.clinical > 0) provisionalDomain('clinical', attainmentE, profile.clinical, weightedE,
    profileReady && ['input_clin_admin', 'input_clin_volume', 'input_clin_oncall', 'input_clin_teaching']
      .every(id => getTextValue(id) !== '')
      && Boolean(getTextValue('input_clin_service_mode')) && Boolean(getTextValue('input_clin_evidence_ref')));
  updateElementText('provisional_objective_total', profileReady
    ? objectiveReady ? `${objectiveScore.toFixed(2)} / ${objectiveMaximum} points`
      : 'Pending complete faculty evidence'
    : 'Choose designation and institute');
  updateElementText('provisional_objective_percent', objectiveReady
    ? `${objectivePercent.toFixed(1)}% of the objective ceiling. The committee portion is not included.`
    : 'The objective total will appear after all required faculty entries are complete.');
  updateElementText('provisional_readiness', objectiveReady
    ? 'Faculty objective entries are complete for this pilot. Save this browser draft before continuing to committee assessment.'
    : `Still needed: ${objectiveReadiness.missing.join('; ')}.`);
  const subjectiveReady = appraisalState.objectiveSubmitted
    && Boolean(getTextValue('input_reviewer_role')) && Boolean(getTextValue('input_reviewer_name'))
    && getResearchRubric({ requireReview: true }).issues.length === 0
    && PEER_PARAMETERS.every(item => Number.isInteger(appraisalState.sectionD.peerScores[item.id]))
    && CPD_TARGETS.every(item => Number.isInteger(appraisalState.sectionD.cpdScores[item.id]));
  let rating = 'Incomplete draft';
  let pipStatus = 'Not assessed';
  let pipDescription = `Complete the required fields before a rating or PIP status is calculated: ${readiness.missing.join(', ')}.`;
  if (readiness.ready) {
    ({ rating, pipStatus, pipDescription } = classification);
  }

  updateElementText('top_pip_status', pipStatus); updateElementText('kpi_final_score', readiness.ready ? `${displayedScore.toFixed(1)}%` : 'Not assessed');
  updateElementText('kpi_rating_band', rating); updateElementText('kpi_pip_status', pipStatus);
  updateElementText('kpi_pip_desc', pipDescription); updateElementText('kpi_penalty_applied', penalty.value ? `-${penalty.value} pts` : 'None');
  updateElementText('disp_objective_score', objectiveReady ? `${objectiveScore.toFixed(2)} of ${objectiveMaximum} points` : 'Not assessed');
  updateElementText('disp_objective_pct', objectiveReady ? `${objectivePercent.toFixed(1)}% provisional attainment` : 'Complete faculty evidence');
  updateElementText('disp_subjective_score', subjectiveReady ? `${subjectiveScore.toFixed(2)} of ${subjectiveMaximum} points` : 'Not assessed');
  updateElementText('disp_subjective_pct', subjectiveReady ? `${subjectivePercent.toFixed(1)}% attainment` : 'Complete designated reviewer assessment');
  updateBenchmarkDisplay('objectiveSplitCard', 'objectiveBenchmarkState', 'top_objective_score', objectivePercent,
    objectiveReady, objectiveScore, objectiveMaximum);
  updateBenchmarkDisplay('subjectiveSplitCard', 'subjectiveBenchmarkState', 'top_subjective_score', subjectivePercent,
    subjectiveReady, subjectiveScore, subjectiveMaximum);
  updateComparisonScale('objectiveScaleFill', 'objectiveScaleValue', objectivePercent, objectiveReady,
    'Awaiting faculty completion');
  updateComparisonScale('subjectiveScaleFill', 'subjectiveScaleValue', subjectivePercent, subjectiveReady,
    'Awaiting reviewer assessment');

  updateElementText('dossier_prof_name', appraisalState.profilePending ? 'Pending profile details' : profile.name);
  [['a', profile.teaching], ['b', profile.research], ['c', profile.service], ['d', profile.peer], ['e', profile.clinical]]
    .forEach(([key, value]) => updateElementText(`dossier_weight_${key}`, `${value}%`));
  updateElementText('dossier_raw_a', teachingReady ? `${attainmentA.toFixed(1)} / 100` : 'Pending');
  const dossierCourseRows = el('dossierCourseRows');
  if (dossierCourseRows) {
    dossierCourseRows.replaceChildren();
    if (!teachingLoad.hasEntry || !teachingLoad.valid) {
      const row = document.createElement('tr'); const cell = document.createElement('td');
      cell.colSpan = 6; cell.textContent = 'Complete course entries before the dossier is available'; row.appendChild(cell); dossierCourseRows.appendChild(row);
    } else teachingLoad.entered.forEach(course => {
      const row = document.createElement('tr');
      [`${course.title} (${course.code})`, course.term, course.level, course.specialty,
        `${course.theory}+${course.practical}`, `${Number(course.review).toFixed(1)}%`].forEach(value => {
        const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
      });
      dossierCourseRows.appendChild(row);
    });
  }
  updateElementText('dossier_teaching_detail', teachingLoad.hasEntry && teachingLoad.valid
    ? `${teachingLoad.courseCount} faculty-entered courses; ${formatTeachingNumber(teachingLoad.theoryCredits)} theory + ${formatTeachingNumber(teachingLoad.practicalCredits)} practical = ${formatTeachingNumber(teachingLoad.creditsTaught)} credits and ${formatTeachingNumber(teachingLoad.contactHours)} contact hours. Contact-hour-weighted student review ${teachingLoad.reviewAverage.toFixed(1)}%; ${teachingTarget.annualTarget === null ? 'no pilot rank target' : teachingExempted ? 'approved exemption declared (review required)' : `${formatTeachingNumber(teachingLoad.creditsTaught)} / ${teachingTarget.annualTarget} annual pilot credits = ${(teachingTarget.loadFactor * 100).toFixed(1)}% workload factor`}; effective teaching ${attainmentA.toFixed(1)}%.`
    : 'Complete course-level credit hours and student reviews pending.');
  renderDossierEvidence(researchRubric,
    { member: serviceMember, chair: serviceChair, policy: servicePolicy,
      facility: serviceFacility, additional: serviceAdditional },
    { admin: clinicalAdmin, volume: clinicalVolume, onCall: clinicalOnCall, teaching: clinicalTeaching },
    profile);
  updateElementText('dossier_raw_b', `${researchRubric.raw.toFixed(1)} / 200 = ${attainmentB.toFixed(1)}% (papers ${researchRubric.outputQuality.toFixed(1)}, books ${researchRubric.books.toFixed(1)}, grants ${researchRubric.grants.toFixed(1)}, supervision ${researchRubric.supervision.toFixed(1)}, innovation ${researchRubric.innovation.toFixed(1)})`);
  updateElementText('dossier_raw_c', `${rawC.toFixed(1)} / 100`);
  updateElementText('dossier_raw_d', `${rawD.toFixed(1)} / 88`);
  updateElementText('dossier_raw_e', `${rawE.toFixed(1)} / 100`);
  [['a', weightedA], ['b', weightedB], ['c', weightedC], ['d', weightedD], ['e', weightedE]]
    .forEach(([key, value]) => updateElementText(`dossier_weighted_${key}`, value.toFixed(2)));
  const clinicalRow = el('dossier_row_clinical'); if (clinicalRow) clinicalRow.style.display = profile.clinical > 0 ? 'table-row' : 'none';
  updateElementText('dossier_objective_total', `${objectiveScore.toFixed(2)} of ${objectiveMaximum} points (${objectivePercent.toFixed(1)}% attainment)`);
  updateElementText('dossier_subjective_total', `${subjectiveScore.toFixed(2)} of ${subjectiveMaximum} points (${subjectivePercent.toFixed(1)}% attainment)`);
  updateElementText('dossier_penalty', penalty.value ? `-${penalty.value} pts (${penalty.reference})` : '0 pts');
  updateElementText('dossier_final_score', readiness.ready ? `${displayedScore.toFixed(1)} / 100` : 'Not assessed');
  updateElementText('dossier_final_rating', rating); updateElementText('dossier_pip_note', pipStatus);
  syncMetaToDossier(); syncTargetsToDossier(); updateDossierCompleteness(readiness);
  renderScoreBars({ teaching: attainmentA, research: attainmentB, service: attainmentC, peer: attainmentD, clinical: attainmentE });
  window.KMUCalculator.lastResult = {
    profile: profile.name, teachingReady, teachingLoad, teachingTarget, teachingExempted,
    attainmentA, researchRubric, attainmentB, rawC, rawD, rawE, weightedA, weightedB,
    weightedC, weightedD, weightedE, penalty: penalty.value,
    objectivePercent, subjectivePercent, objectiveReady, subjectiveReady,
    finalScore: readiness.ready ? displayedScore : null,
    provisionalScore: displayedScore, ready: readiness.ready,
    missing: [...readiness.missing], rating
  };
}

function syncMetaToDossier() {
  const mapping = {
    dossier_emp_name: getTextValue('input_emp_name') || '—',
    dossier_emp_desig: getTextValue('input_emp_desig') || '—',
    dossier_emp_dept: getTextValue('input_emp_dept') || '—',
    dossier_emp_cadre: getTextValue('input_emp_cadre') || '—',
    dossier_emp_cycle: getTextValue('input_emp_cycle') || '—',
    dossier_emp_appraiser: getTextValue('input_emp_appraiser') || '—',
    dossier_emp_reviewer: getTextValue('input_emp_reviewer') || '—',
    dossier_reviewer_identity: [getTextValue('input_reviewer_role'), getTextValue('input_reviewer_name')].filter(Boolean).join(' — ') || '—',
    dossier_research_review_ref: getTextValue('input_research_review_ref') || '—',
    dossier_emp_final: getTextValue('input_emp_final') || '—',
    dossier_work_assignment: getTextValue('input_work_assignment') === 'AUTO'
      ? 'Automatic mapping from designation and institute' : getTextValue('input_work_assignment') || '—'
  };
  Object.entries(mapping).forEach(([id, value]) => updateElementText(id, value));
  [1, 2, 3].forEach(index => {
    const value = getTextValue(`input_comm_member_${index}`) || '—';
    updateElementText(`dossier_comm_member_${index}`, value); updateElementText(`sig_comm_${index}_name`, value);
  });
  const appraiser = getTextValue('input_emp_appraiser'); const finalAuthority = getTextValue('input_emp_final');
  updateElementText('sig_appraiser', appraiser ? `${appraiser} (Appraising Officer)` : 'Appraising Officer');
  updateElementText('sig_final', finalAuthority ? `${finalAuthority} (Final Authority)` : 'Final Authority');
}

function syncTargetsToDossier() {
  const pairs = [
    ['input_target_teaching', 'dossier_target_teaching'], ['input_target_pubs', 'dossier_target_pubs'],
    ['input_target_grants', 'dossier_target_grants'], ['input_target_sup', 'dossier_target_sup'],
    ['input_target_service', 'dossier_target_service'], ['input_target_skills', 'dossier_target_skills']
  ];
  pairs.forEach(([inputId, outputId]) => updateElementText(outputId, getTextValue(inputId) || '—'));
}

function canPrintDossierForAccount() {
  const account = window.KMUAccount;
  if (!account || account.mode === 'demo') return true;
  return ['assessee', 'assessor', 'administrator'].includes(account.mode)
    && Boolean(account.selectedCaseId) && account.selectedCaseStatus === 'reviewed'
    && account.reviewLoaded === true;
}

function updateDossierCompleteness(readiness = getAssessmentReadiness()) {
  const missing = readiness.missing;
  const node = el('dossier_completeness'); if (!node) return;
  const accountPrintReady = canPrintDossierForAccount();
  document.body?.classList.toggle('dossier-print-ready', missing.length === 0 && accountPrintReady);
  if (missing.length) {
    node.textContent = `Incomplete draft — missing ${missing.join(', ')}`;
    node.className = 'dossier-completeness dossier-incomplete';
  } else if (!accountPrintReady) {
    node.textContent = 'Assessment is not yet submitted and available as a reviewed cloud report. PDF printing is locked.';
    node.className = 'dossier-completeness dossier-incomplete';
  } else {
    node.textContent = 'Draft fields complete — faculty-entered teaching has been counted; research and service records remain reviewable';
    node.className = 'dossier-completeness dossier-complete';
  }
}

function renderScoreBars(attainment) {
  const container = el('domainProgressContainer'); if (!container) return;
  container.replaceChildren();
  const rows = [
    ['Teaching & Curriculum', attainment.teaching, '#7a1c1c'],
    ['Research, Grants & Innovation', attainment.research, '#c59b27']
  ];
  if ((appraisalState.activeWeights?.clinical || 0) > 0) rows.push(['Clinical / Patient Care Service', attainment.clinical, '#dc2626']);
  rows.push(['Institutional Service', attainment.service, '#2563eb']);
  rows.push(['Appraisal Committee Assessment & CPD', attainment.peer, '#059669']);
  rows.forEach(([label, value, colour]) => {
    const wrapper = document.createElement('div'); wrapper.style.marginBottom = '0.75rem';
    const heading = document.createElement('div'); heading.style.cssText = 'display:flex;justify-content:space-between;font-size:0.8rem;font-weight:600;margin-bottom:4px;';
    const name = document.createElement('span'); name.textContent = label;
    const score = document.createElement('span'); score.textContent = `${clamp(value, 0, 100).toFixed(1)}%`;
    heading.append(name, score);
    const track = document.createElement('div'); track.style.cssText = 'background:#e2e8f0;border-radius:9999px;height:8px;overflow:hidden;';
    const bar = document.createElement('div'); bar.style.cssText = `background:${colour};width:${clamp(value, 0, 100)}%;height:100%;`;
    track.appendChild(bar); wrapper.append(heading, track); container.appendChild(wrapper);
  });
}

function collectDraft(activeTabId) {
  return {
    schemaVersion: SCHEMA_VERSION, configVersion: CONFIG_VERSION,
    policyStatus: 'DRAFT — pending approval and notification',
    lastActiveTab: activeTabId || document.querySelector('.tab-content.active')?.id || 'tab-meta',
    savedAt: new Date().toISOString(),
    savedTimeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    profile: appraisalState.selectedProfile,
    manualProfileOverride: appraisalState.manualProfileOverride,
    meta: {
      name: getTextValue('input_emp_name'), desig: getTextValue('input_emp_desig'),
      leadershipRole: getTextValue('input_leadership_role'), dept: getTextValue('input_emp_dept'),
      cadre: getTextValue('input_emp_cadre'), cycle: getTextValue('input_emp_cycle'),
      workAssignment: getTextValue('input_work_assignment'),
      appraiser: getTextValue('input_emp_appraiser'), reviewer: getTextValue('input_emp_reviewer'),
      finalAuthority: getTextValue('input_emp_final'),
      profileAssignmentRef: getTextValue('input_profile_assignment_ref'),
      clinicalServiceMode: getTextValue('input_clin_service_mode'),
      clinicalEvidenceRef: getTextValue('input_clin_evidence_ref'),
      committeeMember1: getTextValue('input_comm_member_1'),
      committeeMember2: getTextValue('input_comm_member_2'),
      committeeMember3: getTextValue('input_comm_member_3')
    },
    values: Object.fromEntries(NUMERIC_INPUT_IDS.map(id => [id, el(id)?.value ?? ''])),
    teachingCourses: getTeachingLoad().records,
    research: {
      text: Object.fromEntries(RESEARCH_RUBRIC_TEXT_IDS.map(id => [id, getTextValue(id)])),
      complete: Boolean(el('input_research_complete')?.checked),
      reviewConfirmed: Boolean(el('input_research_review_confirm')?.checked)
    },
    reviewStage: {
      objectiveSubmitted: appraisalState.objectiveSubmitted,
      objectiveSnapshot: appraisalState.objectiveSnapshot,
      objectiveSubmittedAt: appraisalState.objectiveSubmittedAt,
      reviewerRole: getTextValue('input_reviewer_role'),
      reviewerName: getTextValue('input_reviewer_name')
    },
    legacyTeachingWU: appraisalState.legacyTeachingWU,
    wuExempted: el('input_wu_exempted')?.value || 'N',
    serviceComplete: Boolean(el('input_service_complete')?.checked),
    grantsList: appraisalState.grantsList.map(grant => ({ ...grant })),
    serviceAdditionalAppointment: el('input_additional_appoint')?.value || 'N',
    sectionD: {
      peerScores: { ...appraisalState.sectionD.peerScores },
      cpdScores: { ...appraisalState.sectionD.cpdScores }
    },
    targets: Object.fromEntries(TARGET_IDS.map(id => [id, getTextValue(id)])),
    redFlag: {
      penalty: el('input_red_flag')?.value || '0', reference: getTextValue('input_red_flag_ref'),
      date: getTextValue('input_red_flag_date'), inquiryConcluded: el('input_red_flag_inquiry')?.value || 'N',
      appealResolved: el('input_red_flag_appeal')?.value || 'N'
    }
  };
}

function saveAllData(activeTabId, persist = false) {
  const draft = collectDraft(activeTabId);
  if (persist) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    updateElementText('lastSavedIndicator', `Stored locally: ${draft.savedTimeFormatted}`);
  }
  return draft;
}

window.saveAndContinue = function (nextTabId, sectionLabel) {
  calculateAll();
  if (window.switchTab(nextTabId)) showToast(`Updated. Continuing to ${sectionLabel}.`);
};

window.continueFromResearch = function () {
  if ((appraisalState.activeWeights?.clinical || 0) > 0) {
    window.switchTab('tab-clinical');
    return;
  }
  window.switchTab('tab-service');
};

window.continueToPeerReview = function () {
  if (window.KMUAccount?.mode === 'assessee') return window.KMUAccount.submitObjective();
  if (window.KMUAccount?.mode === 'assessor') {
    showToast('Open an assigned case from your assessor queue.'); return false;
  }
  const readiness = getObjectiveReadiness();
  if (!readiness.ready) {
    alert(`Complete the faculty sections before committee assessment: ${readiness.missing.join(', ')}.`);
    return false;
  }
  appraisalState.objectiveSnapshot = getObjectiveFingerprint();
  appraisalState.objectiveSubmitted = true;
  appraisalState.objectiveSubmittedAt = new Date().toLocaleString('en-PK');
  updateReviewStageDisplay(); initPeerControls();
  calculateAll();
  window.switchTab('tab-peer');
  showToast('Faculty objective sections complete. Committee assessment is now open.');
  return true;
};
window.submitObjectiveForReview = window.continueToPeerReview; // Earlier pilot drafts may still call this.

window.saveAndReturnLater = function () {
  if (window.KMUAccount?.mode && window.KMUAccount.mode !== 'demo') return window.KMUAccount.saveAndReturn();
  try {
    const currentTab = document.querySelector('.tab-content.active')?.id || 'tab-meta';
    const draft = saveAllData(currentTab, true);
    updateElementText('saveModalTime', draft.savedTimeFormatted);
    updateElementText('saveModalSummary', draft.meta.name || 'Faculty Member');
    updateElementText('saveModalStep', document.querySelector(`[data-wizard="${currentTab}"] span:last-child`)?.textContent || 'Current Section');
    window.openModal('saveReturnModal'); showToast('Draft stored in this browser.');
  } catch (error) {
    console.error(error); alert('This browser could not store the draft. Download a JSON backup instead.');
  }
};

window.returnAfterLocalSave = function () {
  window.closeModal('saveReturnModal');
  window.switchTab('tab-meta');
  document.getElementById('accountTitle')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  showToast('Local draft stored. Use “Resume Where I Left Off” when you return.');
};

function validateImportedDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error('The file does not contain a valid draft object.');
  if (![3, 4, SCHEMA_VERSION].includes(draft.schemaVersion)) throw new Error('This backup uses an unsupported schema version.');
  if (!draft.meta || typeof draft.meta !== 'object') throw new Error('The backup is missing profile metadata.');
  if (!Array.isArray(draft.grantsList) || draft.grantsList.length > 200) throw new Error('The grant ledger is invalid or too large.');
  if (draft.schemaVersion >= 4) {
    const arrays = [['teaching courses', draft.teachingCourses, MAX_COURSES]];
    if (draft.schemaVersion === 4) arrays.push(['research papers', draft.researchPapers, 10]);
    for (const [name, records, maximum] of arrays) {
      if (!Array.isArray(records) || records.length > maximum || records.some(record => !record || typeof record !== 'object' || Array.isArray(record)
        || Object.values(record).some(value => typeof value !== 'string' || value.length > 240))) {
        throw new Error(`The ${name} list is invalid or too large.`);
      }
    }
  }
  if (draft.research && (typeof draft.research !== 'object' || Array.isArray(draft.research))) {
    throw new Error('The research evidence record is invalid.');
  }
  if (draft.reviewStage && (typeof draft.reviewStage !== 'object' || Array.isArray(draft.reviewStage)
    || typeof draft.reviewStage.objectiveSnapshot !== 'string' || draft.reviewStage.objectiveSnapshot.length > 100000)) {
    throw new Error('The reviewer-stage record is invalid.');
  }
  RESEARCH_RUBRIC_TEXT_IDS.forEach(id => {
    const value = draft.research?.text?.[id];
    if (value !== undefined && (typeof value !== 'string' || value.length > 240)) {
      throw new Error(`The research evidence field ${id} is invalid.`);
    }
  });
  Object.entries(draft.values || {}).forEach(([id, rawValue]) => {
    if (!NUMERIC_INPUT_IDS.includes(id) || rawValue === '') return;
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error(`Invalid non-negative number for ${id}.`);
    if (COUNT_INPUT_IDS.includes(id) && !Number.isInteger(numeric)) {
      throw new Error(`Activity counts must be whole numbers (${id}).`);
    }
    const maximum = NUMERIC_MAXIMA[id] ?? 10000;
    if (numeric > maximum) throw new Error(`Value exceeds the permitted range for ${id}.`);
  });
  if (draft.legacyTeachingWU !== null && draft.legacyTeachingWU !== undefined && draft.legacyTeachingWU !== '') {
    const legacyWU = Number(draft.legacyTeachingWU);
    if (!Number.isFinite(legacyWU) || legacyWU < 0 || legacyWU > NUMERIC_MAXIMA.input_actual_wu) {
      throw new Error('The saved legacy teaching WU is invalid.');
    }
  }
  PEER_PARAMETERS.forEach(item => {
    const rawValue = draft.sectionD?.peerScores?.[item.id];
    if (rawValue === null || rawValue === undefined || rawValue === '') return;
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error(`Invalid officer score for ${item.id}.`);
  });
  CPD_TARGETS.forEach(item => {
    const rawValue = draft.sectionD?.cpdScores?.[item.id];
    if (rawValue === null || rawValue === undefined || rawValue === '') return;
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0 || value > 2) throw new Error(`Invalid CPD score for ${item.id}.`);
  });
  draft.grantsList.forEach(grant => {
    const amount = Number(grant?.amount);
    if (!grant || typeof grant !== 'object' || !Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Each grant must contain a positive whole-PKR amount.');
    }
    if (!['International >10M', 'National 1–10M', 'Small <1M'].includes(grant.band)
      || !['PI', 'Co-PI'].includes(grant.role) || !['Won', 'Applied'].includes(grant.status)
      || !grantBandMatchesAmount(amount, grant.band)) {
      throw new Error('A grant record contains an invalid band, role, status, or amount combination.');
    }
  });
  return draft;
}

function restoreDraftObject(rawDraft) {
  const draft = validateImportedDraft(rawDraft); const meta = draft.meta;
  const metaMapping = {
    input_emp_name: safeString(meta.name, 160), input_emp_desig: safeString(meta.desig, 100),
    input_leadership_role: safeString(meta.leadershipRole, 100), input_emp_dept: safeString(meta.dept, 200),
    input_emp_cadre: safeString(meta.cadre, 100), input_emp_cycle: safeString(meta.cycle, 120),
    input_work_assignment: safeString(meta.workAssignment, 120),
    input_profile_assignment_ref: safeString(meta.profileAssignmentRef, 200),
    input_clin_service_mode: safeString(meta.clinicalServiceMode, 120),
    input_clin_evidence_ref: safeString(meta.clinicalEvidenceRef, 240),
    input_comm_member_1: safeString(meta.committeeMember1, 160),
    input_comm_member_2: safeString(meta.committeeMember2, 160),
    input_comm_member_3: safeString(meta.committeeMember3, 160)
  };
  Object.entries(metaMapping).forEach(([id, value]) => setVal(id, value));
  renderTeachingCourses(draft.schemaVersion >= 4 ? draft.teachingCourses : [{}, {}, {}]);
  RESEARCH_RUBRIC_TEXT_IDS.forEach(id => setVal(id, safeString(draft.research?.text?.[id], 240)));
  setVal('input_reviewer_role', safeString(draft.reviewStage?.reviewerRole, 80));
  setVal('input_reviewer_name', safeString(draft.reviewStage?.reviewerName, 160));
  if (el('input_research_complete')) el('input_research_complete').checked = draft.research?.complete === true;
  if (el('input_research_review_confirm')) el('input_research_review_confirm').checked = draft.research?.reviewConfirmed === true;
  const oldTeachingWU = draft.schemaVersion === 3
    ? (draft.legacyTeachingWU ?? draft.values?.input_actual_wu ?? '')
    : draft.legacyTeachingWU;
  appraisalState.legacyTeachingWU = oldTeachingWU === null || oldTeachingWU === undefined || oldTeachingWU === ''
    ? null : Number(oldTeachingWU);
  Object.entries(draft.values || {}).forEach(([id, value]) => {
    if (!NUMERIC_INPUT_IDS.includes(id)) return;
    if (value === '') setVal(id, '');
    else setVal(id, clamp(value, 0, NUMERIC_MAXIMA[id] ?? 10000));
  });
  if (draft.schemaVersion === 4) {
    const converted = Object.fromEntries(PUBLICATION_ROWS.map(row => [row.id, 0]));
    const references = [];
    draft.researchPapers.forEach(paper => {
      const factor = Number(paper.impactFactor);
      if (paper.indexed !== 'Y' || paper.impactFactor === '' || !Number.isFinite(factor)
        || factor < 0 || factor > 100 || !['first', 'corresponding', 'co'].includes(paper.role)) return;
      const band = factor >= 5 ? 'high' : factor >= 1 ? 'mod' : 'low';
      const role = paper.role === 'co' ? 'co' : 'lead';
      converted[`input_pub_${band}_${role}`] += 1;
      if (paper.id) references.push(paper.id);
    });
    Object.entries(converted).forEach(([id, value]) => setVal(id, value));
    if (references.length) setVal('input_publications_ref', safeString(references.join('; '), 240));
    const convertedGrants = Object.fromEntries(GRANT_ROWS.map(row => [row.id, 0]));
    draft.grantsList.forEach(grant => {
      if (grant.status === 'Applied') { convertedGrants.input_grant_applied += 1; return; }
      const id = grant.band === 'International >10M'
        ? (grant.role === 'PI' ? 'input_grant_int_pi' : 'input_grant_int_copi')
        : grant.band === 'National 1–10M'
          ? (grant.role === 'PI' ? 'input_grant_nat_pi' : 'input_grant_nat_copi')
          : grant.role === 'PI' ? 'input_grant_small_pi' : null;
      if (id) convertedGrants[id] += 1;
    });
    Object.entries(convertedGrants).forEach(([id, value]) => setVal(id, value));
  }
  setVal('input_wu_exempted', draft.wuExempted === 'Y' ? 'Y' : 'N');
  if (el('input_service_complete')) el('input_service_complete').checked = draft.serviceComplete === true;
  setVal('input_additional_appoint', draft.serviceAdditionalAppointment === 'Y' ? 'Y' : 'N');
  TARGET_IDS.forEach(id => setVal(id, safeString(draft.targets?.[id], 2000)));
  appraisalState.grantsList = [];
  PEER_PARAMETERS.forEach(item => {
    const value = draft.sectionD?.peerScores?.[item.id];
    appraisalState.sectionD.peerScores[item.id] = Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 6
      ? Number(value) : null;
  });
  CPD_TARGETS.forEach(item => {
    const value = draft.sectionD?.cpdScores?.[item.id];
    appraisalState.sectionD.cpdScores[item.id] = value !== null && value !== undefined && value !== ''
      && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2 ? Number(value) : null;
  });
  setVal('input_red_flag', ['0', '25', '50'].includes(String(draft.redFlag?.penalty)) ? String(draft.redFlag.penalty) : '0');
  setVal('input_red_flag_ref', safeString(draft.redFlag?.reference, 200));
  setVal('input_red_flag_date', safeString(draft.redFlag?.date, 10));
  setVal('input_red_flag_inquiry', draft.redFlag?.inquiryConcluded === 'Y' ? 'Y' : 'N');
  setVal('input_red_flag_appeal', draft.redFlag?.appealResolved === 'Y' ? 'Y' : 'N');
  updateReportingLine();
  // Preserve the faculty-declared pilot reporting labels shown in the saved
  // dossier. They are display evidence, not authenticated role assignments.
  [['input_emp_appraiser', meta.appraiser], ['input_emp_reviewer', meta.reviewer],
    ['input_emp_final', meta.finalAuthority]].forEach(([id, value]) => {
    if (typeof value === 'string' && value.trim()) setVal(id, safeString(value, 160));
  });
  appraisalState.manualProfileOverride = Boolean(draft.manualProfileOverride && PROFILES[draft.profile] && getTextValue('input_profile_assignment_ref'));
  if (appraisalState.manualProfileOverride) applyProfile(draft.profile, `Documented assignment reference: ${getTextValue('input_profile_assignment_ref')}`);
  else autoSelectProfileAndWeights();
  appraisalState.objectiveSnapshot = safeString(draft.reviewStage?.objectiveSnapshot, 100000);
  appraisalState.objectiveSubmitted = draft.reviewStage?.objectiveSubmitted === true
    && appraisalState.objectiveSnapshot === getObjectiveFingerprint();
  appraisalState.objectiveSubmittedAt = appraisalState.objectiveSubmitted
    ? safeString(draft.reviewStage?.objectiveSubmittedAt, 80) : '';
  if (!appraisalState.objectiveSubmitted) {
    if (el('input_research_review_confirm')) el('input_research_review_confirm').checked = false;
    setVal('input_research_review_ref', '');
    PEER_PARAMETERS.forEach(item => { appraisalState.sectionD.peerScores[item.id] = null; });
    CPD_TARGETS.forEach(item => { appraisalState.sectionD.cpdScores[item.id] = null; });
  }
  updateReviewStageDisplay();
  initPeerControls(); calculateAll();
  window.switchTab(el(draft.lastActiveTab) ? draft.lastActiveTab : 'tab-meta');
  const banner = el('draftRecoveryBanner'); if (banner) banner.style.display = 'none';
}

window.restoreDraft = function () {
  if (window.KMUAccount?.mode && window.KMUAccount.mode !== 'demo') {
    alert('Local browser drafts cannot replace a signed-in case. Open a cloud case from your Employee Portal instead.');
    return false;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('KMU_APPRAISAL_DRAFT_v4') || localStorage.getItem('KMU_APPRAISAL_DRAFT_v3_3'); if (!raw) return false;
    const older = !localStorage.getItem(STORAGE_KEY);
    restoreDraftObject(JSON.parse(raw));
    showToast(older ? 'Older draft restored. Review converted publication and grant counts before continuing.' : 'Locally stored draft restored.');
    return true;
  } catch (error) {
    console.error(error); alert(`The locally stored draft could not be restored: ${error.message}`); return false;
  }
};

window.importDraftBackup = async function (event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  if (window.KMUAccount?.mode && window.KMUAccount.mode !== 'demo') {
    alert('Local backup import is available only in demo mode; it cannot replace a signed-in case.');
    return;
  }
  if (file.size > 1024 * 1024) { alert('The backup exceeds the 1 MB import limit.'); return; }
  try {
    restoreDraftObject(JSON.parse(await file.text())); showToast('Backup imported. Review all fields before use.');
  } catch (error) {
    console.error(error); alert(`The backup could not be imported: ${error.message}`);
  }
};

function checkExistingDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const legacyKeysFound = LEGACY_STORAGE_KEYS.filter(key => localStorage.getItem(key) !== null);
    const info = el('draftBannerInfo'); const resumeButton = el('draftResumeButton');
    const freshButton = el('draftStartFreshButton'); const banner = el('draftRecoveryBanner');
    if (raw) {
      const draft = validateImportedDraft(JSON.parse(raw));
      if (info) info.textContent = `In-progress local draft detected for ${draft.meta.name || 'Faculty Member'}, stored at ${draft.savedTimeFormatted || 'an earlier time'}.`;
      if (resumeButton) resumeButton.style.display = '';
      if (freshButton) freshButton.textContent = legacyKeysFound.length ? 'Delete All Browser Drafts & Start Fresh' : 'Start Fresh';
      if (banner) banner.style.display = 'flex';
    } else if (legacyKeysFound.includes('KMU_APPRAISAL_DRAFT_v4') || legacyKeysFound.includes('KMU_APPRAISAL_DRAFT_v3_3')) {
      if (info) info.textContent = legacyKeysFound.includes('KMU_APPRAISAL_DRAFT_v4')
        ? 'An earlier pilot draft is available. Its paper and grant records will be converted to the simpler count table; please check the counts before continuing.'
        : 'An earlier pilot draft is available. Enter course reviews and publication counts after restoring; old WU values are not scored.';
      if (resumeButton) resumeButton.style.display = '';
      if (freshButton) freshButton.textContent = 'Delete All Browser Drafts & Start Fresh';
      if (banner) banner.style.display = 'flex';
    } else if (legacyKeysFound.length) {
      if (info) info.textContent = 'An older unsupported pilot draft remains in this browser. Download a backup before deleting browser data.';
      if (resumeButton) resumeButton.style.display = 'none';
      if (freshButton) freshButton.textContent = 'Delete Old Browser Data & Start Blank';
      if (banner) banner.style.display = 'flex';
    }
  } catch (error) { console.warn('Stored draft ignored:', error); }
}

window.clearDraftAndStartFresh = function () {
  if (!confirm('Start a blank appraisal and remove all current and older KMU appraisal drafts from this browser?')) return;
  [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].forEach(key => localStorage.removeItem(key)); loadBlankData();
  const banner = el('draftRecoveryBanner'); if (banner) banner.style.display = 'none';
  updateElementText('lastSavedIndicator', 'Not stored on this browser');
  window.switchTab('tab-meta'); showToast('Blank appraisal started.');
};

function downloadJSON(draft, prefix) {
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `${prefix}_${slug(draft.meta?.name)}_${slug(draft.meta?.cycle)}.json`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

window.downloadDraftBackup = function () {
  downloadJSON(saveAllData(undefined, false), 'KMU_Appraisal_Draft'); showToast('Current draft backup downloaded.');
};
window.exportJSON = function () {
  downloadJSON(saveAllData(undefined, false), 'KMU_Appraisal_Draft'); showToast('Current draft exported as JSON.');
};

function csvCell(value) {
  let safe = String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  if (/^[\s\u00A0]*[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replace(/"/g, '""')}"`;
}

window.exportCSV = function () {
  calculateAll(); const result = window.KMUCalculator.lastResult;
  const rows = [
    ['KMU Faculty Appraisal Calculator — CONTROLLED PILOT, NOT AN OFFICIAL PER'],
    ['Configuration', CONFIG_VERSION], ['Policy reference', 'KMU/REG/POL/2026/01-REV (draft pending approval/notification)'],
    ['Employee name', getTextValue('input_emp_name')], ['Designation', getTextValue('input_emp_desig')],
    ['Institute / department', getTextValue('input_emp_dept')], ['Reporting period', getTextValue('input_emp_cycle')],
    ['Assigned profile', result.profile], ['Appraising officer', getTextValue('input_emp_appraiser')],
    ['Reviewing officer', getTextValue('input_emp_reviewer')], ['Final authority', getTextValue('input_emp_final')],
    ['Pilot reviewer capacity', getTextValue('input_reviewer_role')],
    ['Pilot reviewer identifier', getTextValue('input_reviewer_name')],
    [], ['Course', 'Code', 'Term', 'Level', 'Discipline', 'Theory credits', 'Practical credits', 'Student review'],
    ...result.teachingLoad.entered.map(course => [course.title, course.code, course.term, course.level, course.specialty, course.theory, course.practical, course.review]),
    ['Converted contact hours', result.teachingReady ? formatTeachingNumber(result.teachingLoad.contactHours) : 'Pending'],
    ['Credits taught', result.teachingReady ? formatTeachingNumber(result.teachingLoad.creditsTaught) : 'Pending'],
    ['Contact-hour-weighted student-review mean', result.teachingReady ? `${result.teachingLoad.reviewAverage.toFixed(1)}%` : 'Pending'],
    ['Pilot rank target, credits per semester', result.teachingTarget.perSemesterTarget ?? 'Not assigned'],
    ['Pilot annual target, credits', result.teachingTarget.annualTarget ?? 'Not assigned'],
    ['Approved teaching-load exemption declared', result.teachingExempted ? 'Yes — reviewer check needed' : 'No'],
    ['Teaching workload factor', result.teachingReady ? `${(result.teachingTarget.loadFactor * 100).toFixed(1)}%` : 'Pending'],
    ['Effective teaching attainment', result.teachingReady ? `${result.attainmentA.toFixed(1)}%` : 'Pending'],
    [], ['Publication band and author role', 'Declared count', 'Pilot points each', 'Credited points'],
    ...PUBLICATION_ROWS.map(row => [row.label, getActivityCount(row.id), row.points, result.researchRubric.publicationRowScores[row.id]]),
    ['Publication citation/evidence reference', getTextValue('input_publications_ref')],
    ['Publications B1, capped at 50', result.researchRubric.outputQuality.toFixed(1)],
    ['Books and chapters B2, capped at 20', result.researchRubric.books.toFixed(1)],
    [], ['Grant band and role', 'Declared count', 'Original points each', 'Credited raw points'],
    ...GRANT_ROWS.map(row => [row.label, getActivityCount(row.id), row.points,
      row.id === 'input_grant_applied'
        ? result.researchRubric.grantApplicationsRaw
        : getActivityCount(row.id) * row.points]),
    ['Grants and proposals B3, capped at 50', result.researchRubric.grants.toFixed(1)],
    ['Supervision B4, capped at 40', result.researchRubric.supervision.toFixed(1)],
    ['Innovation B5, capped at 40', result.researchRubric.innovation.toFixed(1)],
    ['Research original raw total', `${result.researchRubric.raw.toFixed(1)} / 200`],
    ['Research original score', `${result.attainmentB.toFixed(1)} / 100`],
    ['Research reviewer reference', getTextValue('input_research_review_ref')],
    [], ['Domain', 'Weighted points'], ['Teaching', result.weightedA.toFixed(2)], ['Research', result.weightedB.toFixed(2)],
    ['Institutional service', result.weightedC.toFixed(2)], ['Officer assessment / CPD', result.weightedD.toFixed(2)],
    ['Clinical / patient care service', result.weightedE.toFixed(2)], ['Valid penalty', result.penalty],
    ['Final score', result.ready ? result.finalScore.toFixed(1) : 'Not assessed'], ['Draft rating', result.rating]
  ];
  const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `KMU_Draft_Appraisal_${slug(getTextValue('input_emp_name'))}.csv`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); showToast('Draft summary exported as CSV.');
};

function loadBlankData() {
  Object.assign(appraisalState, createBlankState());
  renderTeachingCourses();
  ['input_emp_name', 'input_emp_desig', 'input_emp_dept', 'input_emp_cadre',
    'input_profile_assignment_ref', 'input_comm_member_1', 'input_comm_member_2', 'input_comm_member_3',
    'input_red_flag_ref', 'input_red_flag_date', 'input_clin_evidence_ref'].forEach(id => setVal(id, ''));
  setVal('input_leadership_role', 'None'); setVal('input_emp_cycle', 'Calendar Year 2026 (01 January – 31 December 2026)');
  setVal('input_clin_service_mode', '');
  setVal('input_work_assignment', 'AUTO'); setVal('input_wu_exempted', 'N'); setVal('input_additional_appoint', 'N');
  setVal('input_red_flag', '0'); setVal('input_red_flag_inquiry', 'N'); setVal('input_red_flag_appeal', 'N');
  NUMERIC_INPUT_IDS.forEach(id => setVal(id, '')); TARGET_IDS.forEach(id => setVal(id, ''));
  RESEARCH_RUBRIC_TEXT_IDS.forEach(id => setVal(id, ''));
  if (el('input_research_complete')) el('input_research_complete').checked = false;
  if (el('input_research_review_confirm')) el('input_research_review_confirm').checked = false;
  if (el('input_service_complete')) el('input_service_complete').checked = false;
  setVal('input_reviewer_role', ''); setVal('input_reviewer_name', '');
  appraisalState.grantsList = [];
  appraisalState.sectionD.peerScores = blankScores(PEER_PARAMETERS);
  appraisalState.sectionD.cpdScores = blankScores(CPD_TARGETS);
  const override = el('manualProfileOverridePanel'); if (override) override.style.display = 'none';
  updateReportingLine(); autoSelectProfileAndWeights(); initPeerControls();
  updateReviewStageDisplay(); calculateAll();
}

function applyEmployeeProfile(profile) {
  if (!profile || typeof profile !== 'object') throw new Error('Saved employee profile is unavailable.');
  const fields = [
    ['input_emp_desig', profile.substantive_designation],
    ['input_leadership_role', profile.leadership_role],
    ['input_emp_dept', profile.institute],
    ['input_emp_cadre', profile.service_cadre]
  ];
  if (!profile.display_name || String(profile.display_name).trim().length > 160
    || fields.some(([id, value]) => !value || !Array.from(el(id)?.options || []).some(option => option.value === value))) {
    throw new Error('Saved employee profile is incomplete or no longer matches the controlled pilot options. Update it in the Employee Portal.');
  }
  setVal('input_emp_name', safeString(profile.display_name, 160));
  fields.forEach(([id, value]) => setVal(id, value));
  updateReportingLine(); autoSelectProfileAndWeights(); calculateAll();
  return true;
}

window.loadSampleData = function () {
  loadBlankData();
  setVal('input_emp_name', 'Dr. Ayesha Khan (Fictional Example)');
  setVal('input_emp_desig', 'Assistant Professor'); setVal('input_emp_dept', 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar');
  setVal('input_emp_cadre', 'BPS');
  renderTeachingCourses([{ title: 'Fictional course', code: 'EX-301', specialty: 'Example science', theory: '1', practical: '1', review: '86', term: 'Semester 3', level: 'Undergraduate' }]);
  setVal('input_pub_mod_lead', 1); setVal('input_pub_high_lead', 2);
  setVal('input_publications_ref', 'EXAMPLE/DOI/001; EXAMPLE/DOI/002; EXAMPLE/DOI/003');
  if (el('input_research_complete')) el('input_research_complete').checked = true;
  if (el('input_service_complete')) el('input_service_complete').checked = true;
  setVal('input_reviewer_role', 'Designated Appraising Officer');
  setVal('input_reviewer_name', 'Fictional reviewer');
  setVal('input_research_review_ref', 'EXAMPLE/REVIEW/001');
  if (el('input_research_review_confirm')) el('input_research_review_confirm').checked = true;
  setVal('input_book_nat', 1); setVal('input_sup_phd', 1); setVal('input_sup_mphil', 2);
  setVal('input_innov_project', 1); setVal('input_comm_member', 3); setVal('input_comm_chair', 1);
  setVal('input_policy_doc', 1); setVal('input_facility_charge', 1);
  setVal('input_grant_nat_pi', 1); setVal('input_grant_applied', 2);
  PEER_PARAMETERS.forEach(item => { appraisalState.sectionD.peerScores[item.id] = 5; });
  CPD_TARGETS.forEach(item => { appraisalState.sectionD.cpdScores[item.id] = 1; });
  setVal('input_target_teaching', 'Deliver the assigned teaching workload and maintain verified course records.');
  setVal('input_target_pubs', 'Complete the agreed publication milestones recorded in the annual work plan.');
  setVal('input_target_grants', 'Submit one documented competitive proposal in the next reporting period.');
  setVal('input_target_sup', 'Complete agreed postgraduate supervision milestones.');
  setVal('input_target_service', 'Complete the approved CPD target and assigned institutional service.');
  setVal('input_target_skills', 'Complete one relevant teaching or technical development activity.');
  updateReportingLine(); autoSelectProfileAndWeights(); initPeerControls();
  window.continueToPeerReview(); calculateAll();
  showToast('Fictional demonstration data loaded; it has not been stored.');
};

window.switchTab = function (tabId) {
  const account = window.KMUAccount;
  if (account?.canOpenTab && !account.canOpenTab(tabId)) {
    if (account.mode === 'assessee' && account.beginFacultyTab?.(tabId) && account.canOpenTab(tabId)) {
      // The employee explicitly opened the first faculty section; the new case is still unsaved.
    } else {
      showToast(account.mode === 'assessee' && !account.caseOpen
        ? !account.profileComplete
          ? 'Save your complete employee profile before opening an appraisal.'
          : account.ownCases?.length
            ? 'Open your saved case from My appraisals, or start a new case for another cycle.'
            : 'Wait for your appraisals to load, then select the faculty section again.'
        : account.mode === 'assessee'
          ? 'Committee assessment is available only to an assigned assessor.'
          : account.mode === 'assessor' && !account.caseOpen
            ? 'Open an assigned case from your Assessor Portal first.'
            : account.mode === 'administrator' && !account.caseOpen
              ? 'Open a case from Faculty records first.'
              : 'This section is not available in the current portal role.');
      return false;
    }
  }
  if (REVIEW_STAGE_TABS.has(tabId) && !appraisalState.objectiveSubmitted) {
    if (tabId === 'tab-peer') {
      window.switchTab('tab-provisional');
      showToast('Review Section E before continuing to committee assessment.');
      return false;
    }
    showToast('Complete Section E before opening committee assessment.');
    return false;
  }
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.wizard-step').forEach(item => item.classList.remove('active'));
  el(tabId)?.classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  document.querySelector(`[data-wizard="${tabId}"]`)?.classList.add('active');
  window.scrollTo?.({ top: 0, behavior: 'smooth' });
  return true;
};

window.printDossier = async function () {
  if (!canPrintDossierForAccount()) {
    alert('The final PDF becomes available only after the assigned assessor submits the review.');
    return;
  }
  if (window.KMUAccount?.mode === 'assessor'
    && !await window.KMUAccount.verifyActiveSelection()) {
    alert('The current assessor assignment could not be verified. Refresh your queue before printing.');
    return;
  }
  calculateAll(); const readiness = getAssessmentReadiness(); window.switchTab('tab-summary');
  if (!readiness.ready) {
    alert(`The draft work done report cannot be printed until these required items are complete: ${readiness.missing.join(', ')}.`);
    return;
  }
  setTimeout(() => window.print(), 150);
};
let previousModalFocus = null;
window.openModal = function (id) {
  const modal = el(id); if (!modal) return;
  previousModalFocus = document.activeElement; modal.classList.add('active'); modal.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => modal.querySelector('.modal-close, button')?.focus());
};
window.closeModal = function (id) {
  const modal = el(id); if (!modal) return;
  modal.classList.remove('active'); modal.setAttribute('aria-hidden', 'true');
  if (previousModalFocus?.focus) previousModalFocus.focus();
};

function showToast(message) {
  let container = document.querySelector('.toast-container');
  if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
  const toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status');
  toast.textContent = message; container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 250); }, 3000);
}

function initHelpTips() {
  const helpEntries = { ...FIELD_HELP };
  RESEARCH_RUBRIC_TEXT_IDS.forEach(id => {
    if (!helpEntries[id]) helpEntries[id] = 'Cite the publication, institutional evidence or reviewer record and date. Faculty-entered research counts remain reviewable.';
  });
  helpEntries.input_research_review_ref = 'Cite the designated reviewer’s evidence-check record and date. A checked box alone does not authenticate the reviewer or establish that the research was independently verified.';
  helpEntries.input_wu_exempted = 'Select Yes only for an approved reduced teaching load or exemption. In this pilot it removes the rank-target proration, so the Appraising Officer must check the approval before formal use.';
  COUNT_INPUT_IDS.forEach(id => {
    helpEntries[id] = 'Enter the verified non-negative whole-number count for this activity. Fractions are not accepted.';
  });
  TARGET_IDS.forEach(id => {
    helpEntries[id] = 'Write a specific, measurable target agreed for the next calendar-year appraisal cycle; include the expected evidence or milestone.';
  });
  const appendHelpTip = (target, id, helpText) => {
    if (!target || document.querySelector(`.help-tip[data-for="${id}"]`)) return;
    const tip = document.createElement('button'); tip.type = 'button'; tip.className = 'help-tip';
    tip.dataset.for = id; tip.dataset.help = helpText; tip.textContent = '?'; tip.title = helpText;
    tip.setAttribute('aria-label', `Help: ${helpText}`);
    tip.addEventListener('click', () => showToast(helpText));
    target.appendChild(tip);
  };
  Object.entries(helpEntries).forEach(([id, helpText]) => {
    const input = el(id); if (!input) return;
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) appendHelpTip(label, id, helpText);
    else {
      const anchor = document.createElement('span');
      input.insertAdjacentElement('afterend', anchor);
      appendHelpTip(anchor, id, helpText);
    }
  });
  Object.entries(CONTEXT_HELP).forEach(([id, helpText]) => appendHelpTip(el(id), `context-${id}`, helpText));

  COUNT_INPUT_IDS.forEach(id => {
    const input = el(id); if (!input) return;
    input.step = '1'; input.min = '0'; input.inputMode = 'numeric'; input.placeholder = 'e.g., 0';
    setCountValidity(input);
  });
  const pointPlaceholders = {
    input_clin_admin: 'e.g., 85', input_clin_volume: 'e.g., 90',
    input_clin_oncall: 'e.g., 100', input_clin_teaching: 'e.g., 80'
  };
  Object.entries(pointPlaceholders).forEach(([id, placeholder]) => {
    const input = el(id); if (input) input.placeholder = placeholder;
  });
}

function initEventListeners() {
  document.querySelectorAll('.modal-overlay').forEach(modal => modal.setAttribute('aria-hidden', 'true'));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) window.closeModal(activeModal.id);
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.setAttribute('role', 'button'); item.setAttribute('tabindex', '0');
    const activate = () => window.switchTab(item.dataset.tab);
    item.addEventListener('click', activate);
    item.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    });
  });
  document.querySelectorAll('.wizard-step').forEach(item => {
    item.setAttribute('role', 'button'); item.setAttribute('tabindex', '0');
    const activate = () => window.switchTab(item.dataset.wizard);
    item.addEventListener('click', activate);
    item.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    });
  });
  document.querySelectorAll('input, select, textarea').forEach(input => {
    if (input.id === 'draftImportInput') return;
    input.addEventListener('input', () => { setCountValidity(input); calculateAll(); });
    input.addEventListener('change', () => { setCountValidity(input); calculateAll(); });
  });
  ['input_emp_desig'].forEach(id => el(id)?.addEventListener('change', () => {
    updateReportingLine(); autoSelectProfileAndWeights(); calculateAll();
  }));
  ['input_leadership_role'].forEach(id => el(id)?.addEventListener('change', () => {
    updateReportingLine(); calculateAll();
  }));
  ['input_emp_dept', 'input_work_assignment', 'input_profile_assignment_ref'].forEach(id => el(id)?.addEventListener('change', () => {
    appraisalState.manualProfileOverride = false; autoSelectProfileAndWeights(); calculateAll();
  }));
}

window.KMUCalculator = {
  CONFIG_VERSION, PROFILES, determineBaseProfile, computeGrantPoints, classifyScore,
  calculate: calculateAll, collectDraft, cycleDateRange, benchmarkState,
  calculatePilotScenario, weightedStudentReviews, calculateTeachingAttainment, paperPilotPoints,
  scorePublicationCounts, scoreGrantCounts, scoreResearchOriginal, getTeachingLoad, getResearchRubric,
  getObjectiveReadiness, getAssessmentReadiness, lastResult: null,
  restoreDraft: restoreDraftObject, loadBlank: loadBlankData,
  applyEmployeeProfile,
  getObjectiveFingerprint, canEditReviewerScores, canPrintDossierForAccount,
  rebuildReviewerScoreChips: initPeerControls,
  applySubmittedReview(review) {
    const account = window.KMUAccount;
    if (!account?.selectedCaseId || account.selectedCaseStatus !== 'reviewed'
      || !['assessor', 'assessee', 'administrator'].includes(account.mode)) return false;
    const payload = review && typeof review === 'object' ? review : {};
    setVal('input_reviewer_role', safeString(payload.reviewerRole, 80));
    setVal('input_reviewer_name', safeString(payload.reviewerName, 160));
    setVal('input_research_review_ref', safeString(payload.researchReviewReference, 240));
    if (el('input_research_review_confirm')) el('input_research_review_confirm').checked = payload.researchReviewConfirmed === true;
    PEER_PARAMETERS.forEach(item => {
      const score = Number(payload.peerScores?.[item.id]);
      appraisalState.sectionD.peerScores[item.id] = Number.isInteger(score) && score >= 1 && score <= 6 ? score : null;
    });
    CPD_TARGETS.forEach(item => {
      const score = Number(payload.cpdScores?.[item.id]);
      appraisalState.sectionD.cpdScores[item.id] = payload.cpdScores?.[item.id] !== null
        && Number.isInteger(score) && score >= 0 && score <= 2 ? score : null;
    });
    TARGET_IDS.forEach(id => setVal(id, safeString(payload.nextCycleTargets?.[id], 2000)));
    const flag = payload.disciplinaryDeclaration || {};
    setVal('input_red_flag', ['0', '25', '50'].includes(String(flag.penalty)) ? String(flag.penalty) : '0');
    setVal('input_red_flag_ref', safeString(flag.reference, 200));
    setVal('input_red_flag_date', safeString(flag.date, 10));
    setVal('input_red_flag_inquiry', flag.inquiryConcluded === 'Y' ? 'Y' : 'N');
    setVal('input_red_flag_appeal', flag.appealResolved === 'Y' ? 'Y' : 'N');
    initPeerControls(); calculateAll();
    return true;
  },
  openCompletedCaseReport() {
    const account = window.KMUAccount;
    if (!account?.selectedCaseId || account.selectedCaseStatus !== 'reviewed'
      || !['assessor', 'assessee'].includes(account.mode)) return false;
    appraisalState.objectiveSnapshot = getObjectiveFingerprint();
    appraisalState.objectiveSubmitted = true;
    appraisalState.objectiveSubmittedAt = 'faculty cloud submission';
    updateReviewStageDisplay(); calculateAll();
    return true;
  },
  openAssignedCaseForReview() {
    if (window.KMUAccount?.mode !== 'assessor' || !window.KMUAccount.selectedCaseId) return false;
    appraisalState.objectiveSnapshot = getObjectiveFingerprint();
    appraisalState.objectiveSubmitted = true;
    appraisalState.objectiveSubmittedAt = 'faculty cloud submission';
    updateReviewStageDisplay(); initPeerControls(); calculateAll(); window.switchTab('tab-peer');
    return true;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  el('tab-service')?.before(el('tab-clinical'));
  renderTeachingCourses(); loadBlankData(); initHelpTips(); initEventListeners(); checkExistingDraft();
});

window.addEventListener('beforeprint', () => calculateAll());

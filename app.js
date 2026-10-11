/**
 * KMU Faculty Appraisal Calculator — controlled draft pilot.
 * Configuration source: KMU/REG/POL/2026/01-REV controlled pilot.
 * Not an official PER, personnel database, or substitute for applicable law,
 * statutes, appointment orders, approved assignments, or notifications.
 */
'use strict';

const CONFIG_VERSION = 'KMU-CONTROLLED-PILOT-2026-10-11';
const STORAGE_KEY = 'KMU_APPRAISAL_DRAFT_v3_3';
const LEGACY_STORAGE_KEYS = Object.freeze(['KMU_APPRAISAL_DRAFT_v3_2', 'KMU_APPRAISAL_DRAFT_v3_1', 'KMU_APPRAISAL_DRAFT_v3']);
const SCHEMA_VERSION = 3;

const PROFILES = Object.freeze({
  'Balanced Profile': Object.freeze({
    name: 'Balanced Profile', teachingWeight: 30, researchWeight: 30,
    serviceWeight: 20, peerWeight: 20, clinicalWeight: 0, minTeachingWU: 30,
    description: 'Standard academic assignment combining teaching, research and institutional service.'
  }),
  'Research-Focused Profile': Object.freeze({
    name: 'Research-Focused Profile', teachingWeight: 20, researchWeight: 50,
    serviceWeight: 15, peerWeight: 15, clinicalWeight: 0, minTeachingWU: 20,
    description: 'Documented research-intensive annual assignment; it is not inferred from TTS status alone.'
  }),
  'Teaching-Focused Profile (Regional IHS)': Object.freeze({
    name: 'Teaching-Focused Profile (Regional IHS)', teachingWeight: 50, researchWeight: 15,
    serviceWeight: 20, peerWeight: 15, clinicalWeight: 0, minTeachingWU: 50,
    description: 'Regional Institute of Health Sciences assignment with a high teaching-load expectation.'
  }),
  'Clinical-Focused Profile (Hospital Faculty)': Object.freeze({
    name: 'Clinical-Focused Profile (Hospital Faculty)', teachingWeight: 15, researchWeight: 20,
    serviceWeight: 10, peerWeight: 10, clinicalWeight: 45, minTeachingWU: 15,
    description: 'Documented hospital or clinical academic assignment including clinical service.'
  }),
  'Research Cadres / Postdocs': Object.freeze({
    name: 'Research Cadres / Postdocs', teachingWeight: 10, researchWeight: 65,
    serviceWeight: 10, peerWeight: 15, clinicalWeight: 0, minTeachingWU: 10,
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

const RESEARCH_OUTPUT_COUNT = 3;
const RESEARCH_OUTPUT_CRITERIA = Object.freeze([
  { key: 'rigor', label: 'Scientific rigor and ethics', max: 8 },
  { key: 'significance', label: 'Originality and significance', max: 6 },
  { key: 'contribution', label: 'Documented personal contribution', max: 4 },
  { key: 'relevance', label: 'Relevance or usable dissemination', max: 2 }
]);
const RESEARCH_RUBRIC_NUMERIC_IDS = Object.freeze([
  ...Array.from({ length: RESEARCH_OUTPUT_COUNT }, (_, index) => RESEARCH_OUTPUT_CRITERIA.map(criterion => `input_research_output_${index + 1}_${criterion.key}`)).flat(),
  'input_research_execution', 'input_research_funding', 'input_research_translation'
]);
const RESEARCH_RUBRIC_TEXT_IDS = Object.freeze([
  ...Array.from({ length: RESEARCH_OUTPUT_COUNT }, (_, index) => `input_research_output_${index + 1}_id`),
  'input_research_execution_ref', 'input_research_funding_ref',
  'input_research_translation_ref', 'input_research_review_ref'
]);

const NUMERIC_INPUT_IDS = [
  'input_qec_score', 'input_theory_credits', 'input_practical_credits', 'input_approved_teaching_wu',
  'input_actual_wu', // Legacy draft value only: never used for a new teaching score.
  'input_pub_high_lead', 'input_pub_high_co',
  'input_pub_mod_lead', 'input_pub_mod_co', 'input_pub_low_lead', 'input_pub_low_co',
  'input_book_int', 'input_book_nat', 'input_chapter_int', 'input_chapter_nat',
  'input_sup_phd', 'input_sup_mphil', 'input_sup_clin_sr', 'input_sup_clin_jr',
  'input_innov_patent_int', 'input_innov_patent_nat', 'input_innov_project',
  'input_innov_overhead', 'input_comm_member', 'input_comm_chair', 'input_policy_doc',
  'input_facility_charge', 'input_clin_admin', 'input_clin_volume', 'input_clin_oncall',
  'input_clin_teaching', ...RESEARCH_RUBRIC_NUMERIC_IDS
];

const COUNT_INPUT_IDS = Object.freeze([
  'input_pub_high_lead', 'input_pub_high_co', 'input_pub_mod_lead', 'input_pub_mod_co',
  'input_pub_low_lead', 'input_pub_low_co', 'input_book_int', 'input_book_nat',
  'input_chapter_int', 'input_chapter_nat', 'input_sup_phd', 'input_sup_mphil',
  'input_sup_clin_sr', 'input_sup_clin_jr', 'input_innov_patent_int',
  'input_innov_patent_nat', 'input_innov_project', 'input_innov_overhead',
  'input_comm_member', 'input_comm_chair', 'input_policy_doc', 'input_facility_charge'
]);

const NUMERIC_MAXIMA = Object.freeze({
  input_qec_score: 100,
  input_theory_credits: 1000,
  input_practical_credits: 1000,
  input_approved_teaching_wu: 150,
  input_actual_wu: 150,
  input_clin_admin: 100,
  input_clin_volume: 100,
  input_clin_oncall: 100,
  input_clin_teaching: 100,
  input_research_execution: 25,
  input_research_funding: 5,
  input_research_translation: 15,
  ...Object.fromEntries(Array.from({ length: RESEARCH_OUTPUT_COUNT }, (_, index) =>
    RESEARCH_OUTPUT_CRITERIA.map(criterion => [`input_research_output_${index + 1}_${criterion.key}`, criterion.max])).flat())
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
  input_emp_appraiser: 'Draft reporting-line recommendation only. The current appointment or reporting notification prevails.',
  input_emp_reviewer: 'Draft countersigning recommendation only. Verify it against the current reporting notification.',
  input_emp_final: 'Draft final-authority recommendation only. Verify it against the applicable service rules and current notification.',
  input_reporting_ref: 'Enter the current appointment, posting, reporting, workload, or exemption order reference and date, where applicable.',
  input_comm_member_1: 'Optional: enter the member’s name, official designation, and KMU unit exactly as notified.',
  input_comm_member_2: 'Optional: enter the member’s name, official designation, and KMU unit exactly as notified.',
  input_comm_member_3: 'Optional: enter the member’s name, official designation, and KMU unit exactly as notified.',
  input_profile_assignment_ref: 'Required for a manual profile assignment. Cite the approved workload, JD, contract, or assignment reference.',
  input_qec_score: 'Enter the certified annual QEC/student-feedback percentage from 0 to 100.',
  input_theory_credits: 'Add the theory credit-hour component of every KMU course or section personally delivered in this calendar year. Each theory credit is 16 contact hours and 3 draft teaching WU. Enter 0 if none.',
  input_practical_credits: 'Add the practical/lab credit-hour component of every KMU course or section personally delivered in this calendar year. Each practical credit is 32 contact hours and 2 draft teaching WU. Enter 0 if none.',
  input_approved_teaching_wu: 'Optional. Enter a positive annual teaching-WU threshold only where the current approved workload or appointment order explicitly gives a different target; it does not change appraisal weights.',
  input_teaching_target_ref: 'Required when entering a different teaching-WU target. Cite the current approved workload or appointment order and date.',
  input_service_complete: 'Confirm this section is complete, including when every verified institutional-service activity is zero.',
  input_research_complete: 'Confirm this faculty research self-assessment is complete, including a deliberate zero where there was no activity.',
  input_reviewer_role: 'Choose the capacity specified by the current reporting or committee notification; this static pilot cannot authenticate that capacity.',
  input_reviewer_name: 'Enter the designated officer name or exact committee identifier from the current notification.',
  input_research_review_confirm: 'The reviewer confirms that the selected outputs and provisional quality ratings were checked against the actual work and evidence.',
  input_wu_exempted: 'Select Yes only where the shortfall is covered by a documented approval; cite that approval in the reporting-reference field.',
  input_new_grant_title: 'Enter the exact title shown on the award letter or submitted application.',
  input_new_grant_agency: 'Enter the funding body named in the award letter or submission evidence.',
  input_new_grant_amount: 'Enter the total approved or applied-for amount in whole Pakistani rupees.',
  input_new_grant_band: 'Choose the band matching the PKR amount; mismatched records are rejected.',
  input_new_grant_role: 'Select the investigator role stated in the grant record.',
  input_new_grant_status: 'Select Won only for an awarded grant; otherwise select a documented competitive application.',
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
  statusProfileTitle: 'The appraisal mix is assigned from substantive designation and KMU institute/unit. BPS, TTS and Fixed Pay never change it.',
  statusScoreTitle: 'The consolidated score is the sum of weighted objective and Appraising Officer scores, less any valid due-process deduction.',
  statusSplitTitle: 'Both dimensions are displayed as percentages of their own ceilings. The faculty evidence score is provisional until the designated reviewer verifies the research quality entries; officer assessment is completed later.',
  statusRatingTitle: 'The unapproved draft uses fixed absolute score bands only after all required fields pass. This is not a KMU cohort percentile or an official PER; relative above/average/below labels remain deferred.',
  statusCycleTitle: 'Each record covers one calendar year, from 1 January through 31 December.',
  metaSectionTitle: 'Use the substantive appointment and current posting order. Acting or additional leadership roles are recorded separately.',
  profileAssignmentTitle: 'The default mix comes from designation and institute/unit. It changes only for a clinical, regional IHS, dedicated research, or documented special assignment.',
  teachingSectionTitle: 'Enter annual theory and practical course credits separately. A 1+1 course is 16 theory plus 32 practical contact hours, converted to 5 draft teaching WU before the QEC proration rule is applied.',
  teachingScoreTitle: 'This is the 0–100 teaching attainment before the profile weight is applied.',
  teachingContributionTitle: 'Teaching attainment multiplied by the teaching weight contributes this many points to the 100-point total.',
  researchSectionTitle: 'The proposed quality-first pilot scores up to three distinct selected outputs, documented research execution, and mentorship or translation. The draft-policy quantity schedule below is audit trace only.',
  researchScoreTitle: 'This is a provisional 0–100 quality-first research score: at most 60 for three distinct outputs, 25 for research execution, and 15 for mentorship or translation. Reviewer evidence confirmation is required before a final draft rating.',
  researchContributionTitle: 'Research attainment multiplied by the assigned research weight contributes this many points to the 100-point total.',
  serviceSectionTitle: 'Institutional service includes verified committee, policy, leadership and facility responsibilities. Patient care is scored separately for Clinical / Patient Care assignments to avoid double counting.',
  serviceScoreTitle: 'This is the 0–100 institutional-service attainment before the profile weight is applied.',
  serviceContributionTitle: 'Institutional-service attainment multiplied by the service weight contributes this many points to the 100-point total.',
  officerSectionTitle: 'The designated Appraising Officer records all 13 professional criteria and five CPD results. This is the subjective component and remains reviewable.',
  officerScoreTitle: 'This percentage is the attained share of the Section D ceiling; the profile weight determines its contribution to the final score.',
  officerContributionTitle: 'Section D attainment multiplied by the Appraising Officer assessment weight contributes this many points to the 100-point total.',
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

const FICTIONAL_SAMPLE_GRANTS = [
  { id: 'sample-g1', title: 'Fictional Community Diagnostics Study', agency: 'Example National Fund', amount: 6500000, band: 'National 1–10M', role: 'PI', status: 'Won' },
  { id: 'sample-g2', title: 'Fictional Regional Health Data Project', agency: 'Example International Consortium', amount: 14000000, band: 'International >10M', role: 'Co-PI', status: 'Won' },
  { id: 'sample-g3', title: 'Fictional Teaching Laboratory Proposal', agency: 'Example Innovation Fund', amount: 900000, band: 'Small <1M', role: 'PI', status: 'Applied' }
];

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
function getTextValue(id) { return el(id)?.value?.trim() || ''; }
function getInputValue(id) { return Math.max(0, Number.parseFloat(el(id)?.value) || 0); }
function getActivityCount(id) {
  const numeric = Number(getTextValue(id));
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Number(value) || 0)); }
function getTeachingLoad() {
  const theory = el('input_theory_credits');
  const practical = el('input_practical_credits');
  const hasEntry = theory?.value !== '' && practical?.value !== '';
  const valid = [theory, practical].every(input => input && input.validity.valid
    && (input.value === '' || (Number.isFinite(Number(input.value)) && Number(input.value) >= 0)));
  const theoryCredits = valid ? getInputValue('input_theory_credits') : 0;
  const practicalCredits = valid ? getInputValue('input_practical_credits') : 0;
  return {
    hasEntry, valid, theoryCredits, practicalCredits,
    theoryHours: theoryCredits * 16, practicalHours: practicalCredits * 32,
    contactHours: theoryCredits * 16 + practicalCredits * 32,
    teachingWU: theoryCredits * 3 + practicalCredits * 2
  };
}
function getTeachingThreshold(profile) {
  const leadership = getTextValue('input_leadership_role');
  const academicLeader = leadership === 'Dean of Faculty'
    || leadership === 'Director / Principal / Head of Institute';
  const leaderReferenced = academicLeader && Boolean(getTextValue('input_reporting_ref'));
  const ordinaryTarget = Number(profile?.minTeachingWU) || 0;
  const baseTarget = leaderReferenced ? 15 : ordinaryTarget;
  const targetInput = el('input_approved_teaching_wu');
  const overrideEntered = targetInput?.value !== '';
  const overrideValid = overrideEntered && targetInput.validity.valid
    && Number.isFinite(Number(targetInput.value)) && Number(targetInput.value) > 0;
  const overrideReferenced = overrideValid && Boolean(getTextValue('input_teaching_target_ref'));
  return {
    targetWU: overrideReferenced ? Number(targetInput.value) : baseTarget,
    basis: overrideReferenced ? 'Different approved annual teaching target entered; verify the cited order'
      : leaderReferenced ? 'Draft academic-leader threshold (Dean/Director); verify the notified appointment'
        : academicLeader ? 'Substantive profile threshold shown until the Dean/Director appointment reference is entered on Step 1'
          : 'Draft substantive-profile threshold; a separately approved target may be recorded below',
    academicLeader, leaderReferenced, overrideEntered, overrideValid, overrideReferenced
  };
}
function formatTeachingNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function safeString(value, maxLength = 500) { return typeof value === 'string' ? value.slice(0, maxLength) : ''; }
function slug(value) { return (value || 'Faculty').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Faculty'; }

function initResearchOutputCards() {
  const container = el('researchOutputCards'); if (!container) return;
  container.replaceChildren();
  for (let index = 1; index <= RESEARCH_OUTPUT_COUNT; index += 1) {
    const card = document.createElement('div'); card.className = 'research-output-card';
    const heading = document.createElement('div'); heading.className = 'research-output-heading';
    const title = document.createElement('span'); title.textContent = `Selected output ${index}`;
    const subtotal = document.createElement('span'); subtotal.id = `disp_research_output_${index}`; subtotal.textContent = '0 / 20 pts';
    heading.append(title, subtotal); card.appendChild(heading);
    const grid = document.createElement('div'); grid.className = 'research-rubric-grid';
    const record = document.createElement('div'); record.className = 'form-group research-rubric-wide';
    const recordLabel = document.createElement('label'); recordLabel.htmlFor = `input_research_output_${index}_id`;
    recordLabel.textContent = 'Output DOI or unique institutional record ID';
    const recordInput = document.createElement('input'); recordInput.type = 'text'; recordInput.className = 'form-control';
    recordInput.id = recordLabel.htmlFor; recordInput.maxLength = 240;
    recordInput.placeholder = 'Example: DOI 10.xxxx/... or approved KMU record ID';
    const recordHint = document.createElement('span'); recordHint.className = 'field-hint';
    recordHint.textContent = 'Use one identifier per distinct output. A repeated item is counted once and prevents completion.';
    record.append(recordLabel, recordInput, recordHint); grid.appendChild(record);
    const criteria = document.createElement('div'); criteria.className = 'research-criteria-grid research-rubric-wide';
    RESEARCH_OUTPUT_CRITERIA.forEach(criterion => {
      const field = document.createElement('div'); field.className = 'form-group';
      const label = document.createElement('label'); label.htmlFor = `input_research_output_${index}_${criterion.key}`;
      label.textContent = `${criterion.label} (0–${criterion.max})`;
      const input = document.createElement('input'); input.type = 'number'; input.className = 'form-control';
      input.id = label.htmlFor; input.min = '0'; input.max = String(criterion.max); input.step = '1';
      input.placeholder = `Example: ${Math.round(criterion.max * 0.75)}`;
      field.append(label, input); criteria.appendChild(field);
    });
    grid.appendChild(criteria); card.appendChild(grid); container.appendChild(card);
  }
}

function normaliseResearchId(value) {
  return value.trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
}

function getResearchRubric({ requireReview = false } = {}) {
  const issues = [];
  const seen = new Set();
  let outputQuality = 0;
  const outputScores = [];
  for (let index = 1; index <= RESEARCH_OUTPUT_COUNT; index += 1) {
    const identifier = getTextValue(`input_research_output_${index}_id`);
    const criteria = RESEARCH_OUTPUT_CRITERIA.map(({ key, max }) => {
      const input = el(`input_research_output_${index}_${key}`);
      const raw = input?.value ?? '';
      const value = Number(raw);
      return { raw, value, valid: raw !== '' && Number.isInteger(value) && value >= 0 && value <= max && input.validity.valid };
    });
    const anyScore = criteria.some(item => item.raw !== '');
    if ((identifier && !criteria.every(item => item.valid)) || (!identifier && anyScore)) {
      issues.push(`complete identifier and all four ratings for selected output ${index}`);
    }
    const canonicalId = normaliseResearchId(identifier);
    if (canonicalId && seen.has(canonicalId)) issues.push('remove duplicate selected research output identifiers');
    if (canonicalId) seen.add(canonicalId);
    const score = identifier && criteria.every(item => item.valid) && !outputScores.some(item => item.id === canonicalId)
      ? criteria.reduce((sum, item) => sum + item.value, 0) : 0;
    outputScores.push({ id: canonicalId, score });
    outputQuality += score;
  }
  const readScore = (id, maximum, label, referenceId) => {
    const input = el(id);
    const raw = input?.value ?? '';
    if (raw === '') { issues.push(`enter ${label} score, including 0 if no activity`); return 0; }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > maximum || !input.validity.valid) {
      issues.push(`enter a valid ${label} score`); return 0;
    }
    if (value > 0 && !getTextValue(referenceId)) issues.push(`cite ${label} evidence`);
    return value;
  };
  const milestone = readScore('input_research_execution', 25, 'research milestone progress', 'input_research_execution_ref');
  const funding = readScore('input_research_funding', 5, 'competitive funding or proposal', 'input_research_funding_ref');
  const execution = Math.min(25, milestone + funding);
  const translation = readScore('input_research_translation', 15, 'research mentorship or translation', 'input_research_translation_ref');
  if (!el('input_research_complete')?.checked) issues.push('confirm Section B is complete, including zero activity');
  if (requireReview) {
    if (!el('input_research_review_confirm')?.checked) issues.push('Appraising Officer research-evidence confirmation');
    if (!getTextValue('input_research_review_ref')) issues.push('Appraising Officer research-review reference');
  }
  return {
    outputScores, outputQuality: Math.min(60, outputQuality), milestone, funding, execution, translation,
    score: Math.min(100, outputQuality + execution + translation), issues
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
    clinical: profile.clinicalWeight, minTeachingWU: profile.minTeachingWU,
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
  updateElementText('disp_auto_min_wu', `${profile.minTeachingWU} WU`);
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
    getTextValue('input_work_assignment'), getTextValue('input_reporting_ref')
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
  let appraiser = 'Current appointment / reporting notification';
  let reviewer = 'Next superior officer under the current notification';
  const seniorAcademicPost = ['Meritorious Professor', 'Professor', 'Associate Professor'].includes(designation);
  let finalAuthority = seniorAcademicPost ? 'Vice Chancellor' : 'Registrar';
  if (leadership === 'Dean of Faculty') {
    [appraiser, reviewer, finalAuthority] = ['Vice Chancellor', 'Syndicate moderation committee (draft arrangement)', 'Syndicate'];
  } else if (leadership === 'Director / Principal / Head of Institute') {
    [appraiser, reviewer, finalAuthority] = ['Dean of the applicable current faculty', 'Vice Chancellor', 'Vice Chancellor'];
  } else if (leadership === 'Chairperson / Head of Department') {
    [appraiser, reviewer, finalAuthority] = ['Director / Principal', 'Dean of the applicable current faculty', 'Vice Chancellor'];
  } else if (designation === 'Meritorious Professor' || designation === 'Professor' || designation === 'Associate Professor') {
    [appraiser, reviewer, finalAuthority] = ['Head of Department / Director', 'Dean of the applicable current faculty', 'Vice Chancellor'];
  } else if (designation === 'Assistant Professor' || designation === 'Lecturer') {
    [appraiser, reviewer, finalAuthority] = ['Head of Department', 'Director / Dean, as applicable', 'Dean of the applicable current faculty'];
  } else if (designation === 'Demonstrator' || CLINICAL_DESIGNATIONS.has(designation)) {
    [appraiser, reviewer, finalAuthority] = ['Head of Department / Unit Head', 'Director / Principal', 'Dean of the applicable current faculty'];
  } else if (RESEARCH_DESIGNATIONS.has(designation)) {
    [appraiser, reviewer, finalAuthority] = ['Principal Investigator / Laboratory Head', 'Head of Department / Director', 'Dean of the applicable current faculty'];
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

window.setPeerScore = function (id, score) {
  if (!appraisalState.objectiveSubmitted) return;
  appraisalState.sectionD.peerScores[id] = clamp(score, 1, 6); initPeerControls(); calculateAll();
};
window.setCpdScore = function (id, score) {
  if (!appraisalState.objectiveSubmitted) return;
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

function formatCurrencyPKR(amount) { return `PKR ${Math.max(0, Number(amount) || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`; }

function renderGrantsTable() {
  const body = el('grantsTableBody'); if (!body) return;
  body.replaceChildren();
  appraisalState.grantsList.forEach(grant => {
    const points = computeGrantPoints(grant.amount, grant.role, grant.status, grant.band); grant.points = points;
    const row = document.createElement('tr');
    [grant.title, grant.agency, grant.band, formatCurrencyPKR(grant.amount), grant.role,
      grant.status === 'Won' ? 'Won / Awarded' : 'Applied', `${points} pts`].forEach((value, index) => {
      const cell = document.createElement('td'); cell.textContent = safeString(String(value), 250);
      if ([0, 4, 6].includes(index)) cell.style.fontWeight = '700'; row.appendChild(cell);
    });
    const action = document.createElement('td'); action.style.textAlign = 'center';
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-secondary';
    remove.style.cssText = 'padding:2px 8px;font-size:0.75rem;'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => window.deleteGrantRecord(grant.id)); action.appendChild(remove); row.appendChild(action); body.appendChild(row);
  });
}

window.addGrantRecord = function () {
  const title = getTextValue('input_new_grant_title'); const agency = getTextValue('input_new_grant_agency');
  const amountInput = getTextValue('input_new_grant_amount'); const band = getTextValue('input_new_grant_band');
  const role = getTextValue('input_new_grant_role'); const status = getTextValue('input_new_grant_status');
  if (!title || !agency || !amountInput || !band || !['PI', 'Co-PI'].includes(role) || !['Won', 'Applied'].includes(status)) {
    alert('Complete the title, agency, amount, funding band, role and status.'); return;
  }
  const amount = Number(amountInput);
  if (!/^\d+$/.test(amountInput) || !Number.isSafeInteger(amount) || amount <= 0) {
    alert('Enter a valid positive grant amount in whole Pakistani rupees (digits only).'); return;
  }
  const bandMatchesAmount = grantBandMatchesAmount(amount, band);
  if (!bandMatchesAmount) {
    alert('The PKR amount does not match the selected funding band. Correct either value before adding the grant.');
    return;
  }
  appraisalState.grantsList.push({
    id: `grant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: safeString(title, 200), agency: safeString(agency, 160), amount, band, role, status,
    points: computeGrantPoints(amount, role, status, band)
  });
  ['input_new_grant_title', 'input_new_grant_agency', 'input_new_grant_amount'].forEach(id => setVal(id, ''));
  renderGrantsTable(); calculateAll(); showToast('Grant record added to this draft.');
};

window.deleteGrantRecord = function (id) {
  appraisalState.grantsList = appraisalState.grantsList.filter(grant => grant.id !== id);
  renderGrantsTable(); calculateAll(); showToast('Grant record removed.');
};

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
  const open = appraisalState.objectiveSubmitted;
  updateElementText('stageBannerTitle', open ? 'Stage 2 — Designated reviewer assessment' : 'Stage 1 — Faculty evidence');
  updateElementText('stageBannerText', open
    ? 'Faculty evidence was handed off in this browser. The designated Appraising Officer or notified committee may now review the evidence and complete Section D. This is not authenticated access control.'
    : 'Complete the profile, teaching, research, institutional service and, if applicable, clinical sections. Then hand this same-browser pilot draft to the designated reviewer.');
  updateElementText('reviewHandoffStatus', open
    ? `Faculty objective evidence submitted for review at ${appraisalState.objectiveSubmittedAt || 'the current session'}. Recheck all source records before entering Section D scores.`
    : 'This section opens after the faculty member submits a complete objective evidence draft.');
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
  if (REVIEW_STAGE_TABS.has(activeTab)) window.switchTab('tab-service');
  showToast('Faculty evidence changed. Reviewer stage is closed until the objective sections are submitted again.');
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
  if (getTextValue('input_qec_score') === '') missing.push('certified QEC score');
  const workloadExempted = el('input_wu_exempted')?.value === 'Y';
  if (!getTeachingLoad().hasEntry) missing.push('both theory and practical credit-hour totals (enter 0 if none)');
  const teachingThreshold = getTeachingThreshold(appraisalState.activeWeights);
  if (teachingThreshold.academicLeader && !teachingThreshold.leaderReferenced) {
    missing.push('Dean/Director appointment or reporting reference');
  }
  if (teachingThreshold.overrideEntered && !teachingThreshold.overrideReferenced) {
    missing.push('valid approved teaching target and order reference');
  }
  if (workloadExempted && !getTextValue('input_reporting_ref')) missing.push('approved workload-exemption reference');
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
    missing.push('faculty objective-evidence handoff');
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
  const teachingThreshold = getTeachingThreshold(profile);
  const requiredWU = teachingThreshold.targetWU;
  updateElementText('disp_min_wu', appraisalState.profilePending ? '—' : `${formatTeachingNumber(requiredWU)} WU`);
  updateElementText('disp_teaching_target_basis', appraisalState.profilePending
    ? 'The teaching target appears after the substantive designation and institute are selected.' : teachingThreshold.basis);
  updateElementText('dossier_min_wu', appraisalState.profilePending ? 'Pending profile details' : `${formatTeachingNumber(requiredWU)} WU`);

  const qec = clamp(getInputValue('input_qec_score'), 0, 100);
  const teachingLoad = getTeachingLoad();
  const legacyTeachingNote = el('legacyTeachingNote');
  if (legacyTeachingNote) {
    const hasLegacy = appraisalState.legacyTeachingWU !== null;
    legacyTeachingNote.hidden = !hasLegacy;
    if (hasLegacy) legacyTeachingNote.textContent = `This resumed draft had ${formatTeachingNumber(appraisalState.legacyTeachingWU)} teaching WU in the previous portal version. WU cannot identify the theory/practical credit-hour mix, so it has not been converted or scored. Re-enter the verified course credits above and check them against the old record.`;
  }
  const actualWU = teachingLoad.teachingWU;
  const exemptionSelected = el('input_wu_exempted')?.value === 'Y';
  const exemptionReferenced = exemptionSelected && Boolean(getTextValue('input_reporting_ref'));
  const qecInput = el('input_qec_score');
  const teachingReady = !appraisalState.profilePending && teachingLoad.hasEntry && teachingLoad.valid
    && qecInput?.value !== '' && qecInput?.validity.valid;
  const loadRatio = requiredWU > 0 ? Math.min(1, actualWU / requiredWU) : 1;
  const attainmentA = teachingReady ? clamp(qec * (exemptionReferenced ? 1 : loadRatio), 0, 100) : 0;
  const weightedA = attainmentA * profile.teaching / 100;
  updateElementText('disp_teaching_hours', teachingLoad.hasEntry && teachingLoad.valid
    ? `${formatTeachingNumber(teachingLoad.contactHours)} contact hours` : '—');
  updateElementText('disp_teaching_hours_detail', teachingLoad.hasEntry && teachingLoad.valid
    ? `${formatTeachingNumber(teachingLoad.theoryHours)} theory + ${formatTeachingNumber(teachingLoad.practicalHours)} practical`
    : 'Theory + practical hours');
  updateElementText('disp_actual_wu', teachingLoad.hasEntry && teachingLoad.valid
    ? `${formatTeachingNumber(actualWU)} WU` : '—');
  updateElementText('disp_actual_wu_detail', teachingLoad.hasEntry && teachingLoad.valid
    ? `3 × ${formatTeachingNumber(teachingLoad.theoryCredits)} theory + 2 × ${formatTeachingNumber(teachingLoad.practicalCredits)} practical`
    : 'Compared with the profile threshold');
  let teachingExplanation = 'Enter the certified QEC score and teaching credit hours to calculate the effective score.';
  if (appraisalState.profilePending) teachingExplanation = 'Choose a substantive designation and KMU institute on Step 1 to assign a teaching threshold.';
  else if (!teachingLoad.valid) teachingExplanation = 'Check the credit-hour entries: use non-negative numeric values.';
  else if (!teachingLoad.hasEntry) teachingExplanation = 'Enter your annual theory and/or practical credit-hour totals. Enter 0 if no teaching was delivered.';
  else if (!qecInput?.validity.valid || qecInput?.value === '') teachingExplanation = 'Enter a valid certified QEC score from 0 to 100 to calculate the effective score.';
  else if (exemptionReferenced) teachingExplanation = `Documented shortfall exemption selected: effective teaching score is the QEC score (${qec.toFixed(1)}%), subject to verification of the approval reference.`;
  else if (exemptionSelected) teachingExplanation = `An exemption was selected, but no approval reference is entered on Step 1. Standard proration is shown until it is documented: ${qec.toFixed(1)}% × ${formatTeachingNumber(actualWU)} / ${formatTeachingNumber(requiredWU)} WU = ${attainmentA.toFixed(1)}%.`;
  else if (actualWU < requiredWU) teachingExplanation = `QEC ${qec.toFixed(1)}% × (${formatTeachingNumber(actualWU)} delivered / ${formatTeachingNumber(requiredWU)} required WU) = ${attainmentA.toFixed(1)}%.`;
  else teachingExplanation = `Delivered ${formatTeachingNumber(actualWU)} WU meets or exceeds ${formatTeachingNumber(requiredWU)} WU; effective teaching score equals QEC ${qec.toFixed(1)}%.`;
  if (teachingReady && teachingThreshold.overrideEntered && !teachingThreshold.overrideReferenced) {
    teachingExplanation += ' A different teaching target was entered but is not used without a valid value and approval reference.';
  }
  if (teachingReady && teachingThreshold.academicLeader && !teachingThreshold.leaderReferenced) {
    teachingExplanation += ' The Dean/Director threshold is not used until its appointment reference is entered on Step 1.';
  }
  updateElementText('disp_teaching_formula', teachingExplanation);
  updateElementText('disp_effective_teaching', teachingReady ? `${attainmentA.toFixed(1)}%` : '—');
  updateElementText('disp_weight_a', appraisalState.profilePending ? '—' : `${profile.teaching}%`);
  updateElementText('disp_weighted_a', teachingReady ? `${weightedA.toFixed(2)} pts` : '—');

  const b1Raw = getActivityCount('input_pub_high_lead') * 10 + getActivityCount('input_pub_high_co') * 5
    + getActivityCount('input_pub_mod_lead') * 6 + getActivityCount('input_pub_mod_co') * 3
    + getActivityCount('input_pub_low_lead') * 4 + getActivityCount('input_pub_low_co') * 2;
  const b1 = Math.min(50, b1Raw);
  const b2Raw = getActivityCount('input_book_int') * 8 + getActivityCount('input_book_nat') * 5
    + getActivityCount('input_chapter_int') * 4 + getActivityCount('input_chapter_nat') * 2;
  const b2 = Math.min(20, b2Raw);
  let grantWon = 0; let grantApplied = 0;
  appraisalState.grantsList.forEach(grant => {
    const points = computeGrantPoints(grant.amount, grant.role, grant.status, grant.band);
    if (grant.status === 'Won') grantWon += points;
    if (grant.status === 'Applied') grantApplied += points;
  });
  const b3Raw = grantWon + grantApplied;
  const b3 = Math.min(50, grantWon + Math.min(20, grantApplied));
  const b4Raw = getActivityCount('input_sup_phd') * 8 + getActivityCount('input_sup_mphil') * 4
    + getActivityCount('input_sup_clin_sr') * 8 + getActivityCount('input_sup_clin_jr') * 4;
  const b4 = Math.min(40, b4Raw);
  const b5Raw = getActivityCount('input_innov_patent_int') * 10 + getActivityCount('input_innov_patent_nat') * 6
    + getActivityCount('input_innov_project') * 8 + getActivityCount('input_innov_overhead') * 10;
  const b5 = Math.min(40, b5Raw);
  const rawB = Math.min(200, b1 + b2 + b3 + b4 + b5);
  const researchRubric = getResearchRubric();
  const attainmentB = researchRubric.score;
  const weightedB = attainmentB * profile.research / 100;
  [['disp_sub_b1_raw', b1Raw], ['disp_sub_b1', b1], ['disp_sub_b2_raw', b2Raw], ['disp_sub_b2', b2],
    ['disp_sub_b3_raw', b3Raw], ['disp_sub_b3_won', grantWon], ['disp_sub_b3_applied', grantApplied], ['disp_sub_b3', b3],
    ['disp_sub_b4_raw', b4Raw], ['disp_sub_b4', b4], ['disp_sub_b5_raw', b5Raw], ['disp_sub_b5', b5]]
    .forEach(([id, value]) => updateElementText(id, Number(value).toFixed(1)));
  researchRubric.outputScores.forEach((item, index) =>
    updateElementText(`disp_research_output_${index + 1}`, `${item.score} / 20 pts`));
  updateElementText('disp_raw_b', `${attainmentB.toFixed(1)} / 100`);
  updateElementText('disp_research_quality_summary', `${researchRubric.outputQuality.toFixed(1)} / 60 selected-output points`);
  updateElementText('disp_research_execution_summary', `${researchRubric.execution.toFixed(1)} / 25 execution points`);
  updateElementText('disp_research_execution_detail', `milestones ${researchRubric.milestone.toFixed(1)} + optional funding ${researchRubric.funding.toFixed(1)}, capped at 25`);
  updateElementText('disp_research_translation_summary', `${researchRubric.translation.toFixed(1)} / 15 mentorship/translation points`);
  updateElementText('disp_research_verification_state', researchRubric.issues.length
    ? `Provisional; resolve: ${researchRubric.issues.join(', ')}.`
    : el('input_research_review_confirm')?.checked && getTextValue('input_research_review_ref')
      ? 'Appraising Officer review recorded; verify the cited evidence independently.'
      : 'Faculty self-assessment complete; awaiting Appraising Officer evidence review.');
  updateElementText('disp_research_raw_summary', `${rawB.toFixed(1)} raw points`);
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
  const objectiveReady = getObjectiveReadiness().ready;
  const subjectiveReady = appraisalState.objectiveSubmitted
    && Boolean(getTextValue('input_reviewer_role')) && Boolean(getTextValue('input_reviewer_name'))
    && getResearchRubric({ requireReview: true }).issues.length === 0
    && PEER_PARAMETERS.every(item => Number.isInteger(appraisalState.sectionD.peerScores[item.id]))
    && CPD_TARGETS.every(item => Number.isInteger(appraisalState.sectionD.cpdScores[item.id]));
  let rating = 'Incomplete draft'; let ratingClass = 'rating-incomplete';
  let pipStatus = 'Not assessed';
  let pipDescription = `Complete the required fields before a rating or PIP status is calculated: ${readiness.missing.join(', ')}.`;
  if (readiness.ready) {
    ({ rating, ratingClass, pipStatus, pipDescription } = classification);
  }

  updateElementText('liveScore', readiness.ready ? displayedScore.toFixed(1) : '—');
  updateElementText('liveProfileName', appraisalState.profilePending ? 'Profile pending' : profile.name);
  const badge = el('liveRatingBadge'); if (badge) { badge.textContent = rating; badge.className = `rating-badge ${ratingClass}`; }
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
  updateElementText('comparisonNote', objectiveReady && subjectiveReady
    ? `The two dimensions differ by ${Math.abs(objectivePercent - subjectivePercent).toFixed(1)} percentage points. These are percentages of different scoring ceilings, not KMU percentiles. Comparable-faculty categories remain pending cohort calibration.`
    : 'Well-below, below, average, above and well-above-average labels will be added only after KMU validates percentiles for comparable faculty groups. No relative category is assigned in this pilot.');

  updateElementText('dossier_prof_name', appraisalState.profilePending ? 'Pending profile details' : profile.name);
  [['a', profile.teaching], ['b', profile.research], ['c', profile.service], ['d', profile.peer], ['e', profile.clinical]]
    .forEach(([key, value]) => updateElementText(`dossier_weight_${key}`, `${value}%`));
  updateElementText('dossier_raw_a', teachingReady ? `${attainmentA.toFixed(1)} / 100` : 'Pending');
  updateElementText('dossier_teaching_detail', teachingLoad.hasEntry && teachingLoad.valid
    ? `Delivered: ${formatTeachingNumber(teachingLoad.theoryCredits)} theory + ${formatTeachingNumber(teachingLoad.practicalCredits)} practical credits = ${formatTeachingNumber(teachingLoad.contactHours)} contact hours = ${formatTeachingNumber(actualWU)} teaching WU. Draft target: ${formatTeachingNumber(requiredWU)} WU (${teachingThreshold.basis}).`
    : 'Teaching credit-hour conversion and WU threshold pending.');
  updateElementText('dossier_raw_b', `${attainmentB.toFixed(1)} / 100 quality-first pilot (legacy draft raw ${rawB.toFixed(1)} / 200; not scored)`);
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
    profile: profile.name, teachingReady, teachingLoad, teachingTargetWU: requiredWU,
    attainmentA, rawB, researchRubric, attainmentB, rawC, rawD, rawE, weightedA, weightedB,
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
    dossier_reporting_ref: getTextValue('input_reporting_ref') || '—'
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

function updateDossierCompleteness(readiness = getAssessmentReadiness()) {
  const missing = readiness.missing;
  const node = el('dossier_completeness'); if (!node) return;
  document.body?.classList.toggle('dossier-print-ready', missing.length === 0);
  if (missing.length) {
    node.textContent = `Incomplete draft — missing ${missing.join(', ')}`;
    node.className = 'dossier-completeness dossier-incomplete';
  } else {
    node.textContent = 'Draft fields complete — supporting evidence has not been independently verified';
    node.className = 'dossier-completeness dossier-complete';
  }
}

function renderScoreBars(attainment) {
  const container = el('domainProgressContainer'); if (!container) return;
  container.replaceChildren();
  const rows = [
    ['Teaching & Curriculum', attainment.teaching, '#7a1c1c'],
    ['Research, Grants & Innovation', attainment.research, '#c59b27'],
    ['Institutional Service', attainment.service, '#2563eb'],
    ['Appraising Officer Assessment & CPD', attainment.peer, '#059669']
  ];
  if ((appraisalState.activeWeights?.clinical || 0) > 0) rows.push(['Clinical / Patient Care Service', attainment.clinical, '#dc2626']);
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
      finalAuthority: getTextValue('input_emp_final'), reportingRef: getTextValue('input_reporting_ref'),
      profileAssignmentRef: getTextValue('input_profile_assignment_ref'),
      teachingTargetRef: getTextValue('input_teaching_target_ref'),
      clinicalServiceMode: getTextValue('input_clin_service_mode'),
      clinicalEvidenceRef: getTextValue('input_clin_evidence_ref'),
      committeeMember1: getTextValue('input_comm_member_1'),
      committeeMember2: getTextValue('input_comm_member_2'),
      committeeMember3: getTextValue('input_comm_member_3')
    },
    values: Object.fromEntries(NUMERIC_INPUT_IDS.map(id => [id, el(id)?.value ?? ''])),
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
  calculateAll(); window.switchTab(nextTabId); showToast(`Updated. Continuing to ${sectionLabel}.`);
};

window.continueFromService = function () {
  if ((appraisalState.activeWeights?.clinical || 0) > 0) {
    window.switchTab('tab-clinical');
    return;
  }
  window.submitObjectiveForReview();
};

window.submitObjectiveForReview = function () {
  const readiness = getObjectiveReadiness();
  if (!readiness.ready) {
    alert(`Complete the faculty evidence before reviewer handoff: ${readiness.missing.join(', ')}.`);
    return false;
  }
  appraisalState.objectiveSnapshot = getObjectiveFingerprint();
  appraisalState.objectiveSubmitted = true;
  appraisalState.objectiveSubmittedAt = new Date().toLocaleString('en-PK');
  updateReviewStageDisplay();
  calculateAll();
  window.switchTab('tab-peer');
  showToast('Faculty evidence handed off in this browser. Reviewer assessment is now available.');
  return true;
};

window.saveAndReturnLater = function () {
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

function validateImportedDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error('The file does not contain a valid draft object.');
  if (draft.schemaVersion !== SCHEMA_VERSION) throw new Error('This backup uses an unsupported schema version.');
  if (!draft.meta || typeof draft.meta !== 'object') throw new Error('The backup is missing profile metadata.');
  if (!Array.isArray(draft.grantsList) || draft.grantsList.length > 200) throw new Error('The grant ledger is invalid or too large.');
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
    input_work_assignment: safeString(meta.workAssignment, 120), input_reporting_ref: safeString(meta.reportingRef, 200),
    input_profile_assignment_ref: safeString(meta.profileAssignmentRef, 200),
    input_teaching_target_ref: safeString(meta.teachingTargetRef, 200),
    input_clin_service_mode: safeString(meta.clinicalServiceMode, 120),
    input_clin_evidence_ref: safeString(meta.clinicalEvidenceRef, 240),
    input_comm_member_1: safeString(meta.committeeMember1, 160),
    input_comm_member_2: safeString(meta.committeeMember2, 160),
    input_comm_member_3: safeString(meta.committeeMember3, 160)
  };
  Object.entries(metaMapping).forEach(([id, value]) => setVal(id, value));
  RESEARCH_RUBRIC_TEXT_IDS.forEach(id => setVal(id, safeString(draft.research?.text?.[id], 240)));
  setVal('input_reviewer_role', safeString(draft.reviewStage?.reviewerRole, 80));
  setVal('input_reviewer_name', safeString(draft.reviewStage?.reviewerName, 160));
  if (el('input_research_complete')) el('input_research_complete').checked = draft.research?.complete === true;
  if (el('input_research_review_confirm')) el('input_research_review_confirm').checked = draft.research?.reviewConfirmed === true;
  const oldTeachingWU = draft.legacyTeachingWU ?? draft.values?.input_actual_wu;
  appraisalState.legacyTeachingWU = oldTeachingWU === null || oldTeachingWU === undefined || oldTeachingWU === ''
    ? null : Number(oldTeachingWU);
  Object.entries(draft.values || {}).forEach(([id, value]) => {
    if (!NUMERIC_INPUT_IDS.includes(id)) return;
    if (value === '') setVal(id, '');
    else setVal(id, clamp(value, 0, NUMERIC_MAXIMA[id] ?? 10000));
  });
  setVal('input_wu_exempted', draft.wuExempted === 'Y' ? 'Y' : 'N');
  if (el('input_service_complete')) el('input_service_complete').checked = draft.serviceComplete === true;
  setVal('input_additional_appoint', draft.serviceAdditionalAppointment === 'Y' ? 'Y' : 'N');
  TARGET_IDS.forEach(id => setVal(id, safeString(draft.targets?.[id], 2000)));
  appraisalState.grantsList = draft.grantsList.map((grant, index) => ({
    id: `import-${index}-${Date.now()}`, title: safeString(grant.title, 200), agency: safeString(grant.agency, 160),
    amount: clamp(grant.amount, 0, 1e15),
    band: ['International >10M', 'National 1–10M', 'Small <1M'].includes(grant.band) ? grant.band : '',
    role: ['PI', 'Co-PI'].includes(grant.role) ? grant.role : 'PI',
    status: ['Won', 'Applied'].includes(grant.status) ? grant.status : 'Applied'
  }));
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
  appraisalState.manualProfileOverride = Boolean(draft.manualProfileOverride && PROFILES[draft.profile] && getTextValue('input_profile_assignment_ref'));
  if (appraisalState.manualProfileOverride) applyProfile(draft.profile, `Documented assignment reference: ${getTextValue('input_profile_assignment_ref')}`);
  else autoSelectProfileAndWeights();
  appraisalState.objectiveSnapshot = safeString(draft.reviewStage?.objectiveSnapshot, 100000);
  appraisalState.objectiveSubmitted = draft.reviewStage?.objectiveSubmitted === true
    && appraisalState.objectiveSnapshot === getObjectiveFingerprint();
  appraisalState.objectiveSubmittedAt = appraisalState.objectiveSubmitted
    ? safeString(draft.reviewStage?.objectiveSubmittedAt, 80) : '';
  if (!appraisalState.objectiveSubmitted && el('input_research_review_confirm')) {
    el('input_research_review_confirm').checked = false;
  }
  updateReviewStageDisplay();
  initPeerControls(); renderGrantsTable(); calculateAll();
  window.switchTab(el(draft.lastActiveTab) ? draft.lastActiveTab : 'tab-meta');
  const banner = el('draftRecoveryBanner'); if (banner) banner.style.display = 'none';
}

window.restoreDraft = function () {
  try {
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return false;
    restoreDraftObject(JSON.parse(raw)); showToast('Locally stored draft restored.'); return true;
  } catch (error) {
    console.error(error); alert(`The locally stored draft could not be restored: ${error.message}`); return false;
  }
};

window.importDraftBackup = async function (event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
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
    } else if (legacyKeysFound.length) {
      if (info) info.textContent = 'An older pilot draft remains in this browser. It is not opened because its validation rules are obsolete; delete it before entering live-like test data.';
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
    [], ['Theory credits delivered', getTextValue('input_theory_credits')],
    ['Practical credits delivered', getTextValue('input_practical_credits')],
    ['Converted contact hours', result.teachingReady ? formatTeachingNumber(result.teachingLoad.contactHours) : 'Pending'],
    ['Converted teaching WU', result.teachingReady ? formatTeachingNumber(result.teachingLoad.teachingWU) : 'Pending'],
    ['Draft teaching-WU threshold', formatTeachingNumber(result.teachingTargetWU)],
    ['Teaching attainment', result.teachingReady ? `${result.attainmentA.toFixed(1)}%` : 'Pending'],
    [], ['Research selected-output quality', result.researchRubric.outputQuality.toFixed(1)],
    ['Research milestone progress', result.researchRubric.milestone.toFixed(1)],
    ['Competitive funding/proposal bonus (within execution cap)', result.researchRubric.funding.toFixed(1)],
    ['Research execution', result.researchRubric.execution.toFixed(1)],
    ['Research mentorship or translation', result.researchRubric.translation.toFixed(1)],
    ['Research quality-first pilot score', `${result.attainmentB.toFixed(1)} / 100`],
    ['Research reviewer reference', getTextValue('input_research_review_ref')],
    ['Legacy policy-draft raw points (audit only)', result.rawB.toFixed(1)],
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
  ['input_emp_name', 'input_emp_desig', 'input_emp_dept', 'input_emp_cadre', 'input_reporting_ref',
    'input_profile_assignment_ref', 'input_teaching_target_ref', 'input_comm_member_1', 'input_comm_member_2', 'input_comm_member_3',
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
  updateReportingLine(); autoSelectProfileAndWeights(); initPeerControls(); renderGrantsTable();
  updateReviewStageDisplay(); calculateAll();
}

window.loadSampleData = function () {
  loadBlankData();
  setVal('input_emp_name', 'Dr. Ayesha Khan (Fictional Example)');
  setVal('input_emp_desig', 'Assistant Professor'); setVal('input_emp_dept', 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar');
  setVal('input_emp_cadre', 'BPS'); setVal('input_qec_score', 86);
  setVal('input_theory_credits', 10); setVal('input_practical_credits', 2);
  RESEARCH_OUTPUT_CRITERIA.forEach(criterion => setVal(`input_research_output_1_${criterion.key}`, Math.max(1, criterion.max - 1)));
  setVal('input_research_output_1_id', 'EXAMPLE/OUTPUT/001');
  setVal('input_research_execution', 20); setVal('input_research_execution_ref', 'EXAMPLE/ORIC/PLAN/001');
  setVal('input_research_funding', 0);
  setVal('input_research_translation', 10); setVal('input_research_translation_ref', 'EXAMPLE/ASRB/001');
  if (el('input_research_complete')) el('input_research_complete').checked = true;
  if (el('input_service_complete')) el('input_service_complete').checked = true;
  setVal('input_reviewer_role', 'Designated Appraising Officer');
  setVal('input_reviewer_name', 'Fictional reviewer');
  setVal('input_research_review_ref', 'EXAMPLE/REVIEW/001');
  if (el('input_research_review_confirm')) el('input_research_review_confirm').checked = true;
  setVal('input_pub_high_lead', 1); setVal('input_pub_high_co', 1); setVal('input_pub_mod_lead', 2);
  setVal('input_book_nat', 1); setVal('input_sup_phd', 1); setVal('input_sup_mphil', 2);
  setVal('input_innov_project', 1); setVal('input_comm_member', 3); setVal('input_comm_chair', 1);
  setVal('input_policy_doc', 1); setVal('input_facility_charge', 1);
  appraisalState.grantsList = FICTIONAL_SAMPLE_GRANTS.map(grant => ({ ...grant }));
  PEER_PARAMETERS.forEach(item => { appraisalState.sectionD.peerScores[item.id] = 5; });
  CPD_TARGETS.forEach(item => { appraisalState.sectionD.cpdScores[item.id] = 1; });
  setVal('input_target_teaching', 'Deliver the assigned teaching workload and maintain verified course records.');
  setVal('input_target_pubs', 'Complete the agreed publication milestones recorded in the annual work plan.');
  setVal('input_target_grants', 'Submit one documented competitive proposal in the next reporting period.');
  setVal('input_target_sup', 'Complete agreed postgraduate supervision milestones.');
  setVal('input_target_service', 'Complete the approved CPD target and assigned institutional service.');
  setVal('input_target_skills', 'Complete one relevant teaching or technical development activity.');
  updateReportingLine(); autoSelectProfileAndWeights(); initPeerControls(); renderGrantsTable();
  window.submitObjectiveForReview(); calculateAll();
  showToast('Fictional demonstration data loaded; it has not been stored.');
};

window.switchTab = function (tabId) {
  if (REVIEW_STAGE_TABS.has(tabId) && !appraisalState.objectiveSubmitted) {
    showToast('Complete and submit faculty objective evidence before opening the reviewer stage.');
    return;
  }
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.wizard-step').forEach(item => item.classList.remove('active'));
  el(tabId)?.classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
  document.querySelector(`[data-wizard="${tabId}"]`)?.classList.add('active');
  window.scrollTo?.({ top: 0, behavior: 'smooth' });
};

window.printDossier = function () {
  calculateAll(); const readiness = getAssessmentReadiness(); window.switchTab('tab-summary');
  if (!readiness.ready) {
    alert(`The draft dossier cannot be printed until these required items are complete: ${readiness.missing.join(', ')}.`);
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
    helpEntries[id] = id.includes('output')
      ? 'Enter a DOI or unique approved institutional record identifier. One study/output may be selected once; no journal metric automatically certifies its quality.'
      : 'Cite the approved evidence or review reference and date. The faculty score remains provisional until independently checked.';
  });
  RESEARCH_RUBRIC_NUMERIC_IDS.forEach(id => {
    helpEntries[id] = 'Enter a provisional whole-number self-rating within the stated rubric maximum. The Appraising Officer must verify it against the cited evidence.';
  });
  const criterionHelp = {
    rigor: 'Proposed anchor: 0 if evidence or ethics is not verified; 1–3 for major methodological limitations; 4–6 for a sound, reproducible design; 7–8 for especially rigorous, transparent work. Judge the work, not the journal.',
    significance: 'Proposed anchor: 0 if the claim is unsupported; 1–2 for limited incremental value; 3–4 for a meaningful advance; 5–6 for a substantial, well-supported contribution.',
    contribution: 'Proposed anchor: 0 if individual contribution is unverified; 1 for a minor documented role; 2–3 for a material role; 4 for a documented leading role. Author position alone is insufficient.',
    relevance: 'Proposed anchor: 0 for no demonstrated relevance or dissemination; 1 for a clear audience and documented dissemination; 2 for verified usable adoption or substantial field relevance.'
  };
  for (let index = 1; index <= RESEARCH_OUTPUT_COUNT; index += 1) {
    RESEARCH_OUTPUT_CRITERIA.forEach(({ key }) => {
      helpEntries[`input_research_output_${index}_${key}`] = criterionHelp[key];
    });
  }
  helpEntries.input_research_execution = 'Proposed anchor for progress against an approved annual research plan: 0 none; 1–9 limited; 10–17 documented partial progress; 18–22 substantial progress; 23–25 completed high-quality milestones. A grant is not required.';
  helpEntries.input_research_funding = 'Optional 0–5 points within, not above, the 25-point execution ceiling. Count a documented competitive proposal or award only once; enter 0 when none. Winning a grant is not required for full execution credit.';
  helpEntries.input_research_translation = 'Proposed anchor: 0 none; 1–5 limited documented activity; 6–10 meaningful trainee, method, data or translation progress; 11–15 independently verified completion or uptake. Avoid double-counting teaching or clinical service.';
  helpEntries.input_research_review_ref = 'Cite the designated reviewer’s evidence-check record and date. A checked box alone does not authenticate the reviewer or establish that the research was independently verified.';
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
    input_qec_score: 'e.g., 82', input_theory_credits: 'e.g., 1', input_practical_credits: 'e.g., 1',
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
  ['input_emp_dept', 'input_work_assignment', 'input_reporting_ref'].forEach(id => el(id)?.addEventListener('change', () => {
    appraisalState.manualProfileOverride = false; autoSelectProfileAndWeights(); calculateAll();
  }));
}

window.KMUCalculator = {
  CONFIG_VERSION, PROFILES, determineBaseProfile, computeGrantPoints, classifyScore,
  calculate: calculateAll, collectDraft, cycleDateRange, benchmarkState,
  calculatePilotScenario, getTeachingLoad, getResearchRubric,
  getObjectiveReadiness, getAssessmentReadiness, lastResult: null
};

document.addEventListener('DOMContentLoaded', () => {
  initResearchOutputCards(); loadBlankData(); initHelpTips(); initEventListeners(); checkExistingDraft();
});

window.addEventListener('beforeprint', () => calculateAll());

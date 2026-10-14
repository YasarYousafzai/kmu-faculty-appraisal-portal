const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/account.js', ['account.js', 'text/javascript; charset=utf-8']],
  ['/kmu_logo.png', ['kmu_logo.png', 'image/png']],
  ['/KMU_Unified_Policy_Draft.docx', ['KMU_Unified_Policy_Draft.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']]
]);
function assert(value, message) { if (!value) throw new Error(message); }
function near(actual, expected) { assert(Math.abs(actual - expected) < 0.001, `Expected ${expected}, got ${actual}`); }
async function set(page, selector, value) {
  await page.evaluate(([query, selected]) => {
    const node = document.querySelector(query); if (!node) throw new Error(`Missing ${query}`);
    node.value = String(selected);
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }, [selector, value]);
}
async function check(page, selector, value) {
  await page.evaluate(([query, checked]) => {
    const node = document.querySelector(query); if (!node) throw new Error(`Missing ${query}`);
    node.checked = checked; node.dispatchEvent(new Event('change', { bubbles: true }));
  }, [selector, value]);
}
async function fillCourse(page, index, fields) {
  for (const [key, value] of Object.entries(fields)) {
    await set(page, `.teaching-course-card:nth-child(${index}) [data-course-field="${key}"]`, value);
  }
}
async function result(page) { return page.evaluate(() => window.KMUCalculator.lastResult); }

(async () => {
  const server = http.createServer((request, response) => {
    const entry = files.get(new URL(request.url, 'http://127.0.0.1').pathname);
    if (!entry) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' });
    fs.createReadStream(path.join(root, entry[0])).pipe(response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const launch = { headless: true };
  if (process.env.KMU_CHROME_PATH) launch.executablePath = process.env.KMU_CHROME_PATH;
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });

  assert(await page.locator('.teaching-course-card').count() === 3, 'Three starter courses required.');
  assert(await page.locator('.teaching-course-card [data-course-field="theory"]').evaluateAll(nodes => nodes.every(node => node.value === '0')) &&
    await page.locator('.teaching-course-card [data-course-field="practical"]').evaluateAll(nodes => nodes.every(node => node.value === '0')),
  'Theory and practical credits should default to zero in every starter course.');
  assert((await result(page)).teachingLoad.entered.length === 0,
    'Untouched zero-credit starter courses should not be treated as incomplete entries.');
  assert(await page.locator('[id^="input_pub_"]').count() === 6, 'Six publication-count rows required.');
  assert(await page.locator('[id^="input_grant_"]').count() === 6,
    'Six original grant and submitted-proposal count rows required.');
  assert(await page.locator('#input_publications_ref').getAttribute('placeholder') === 'Example: Google Scholar link',
    'The publication-reference example should use a Google Scholar link.');
  assert(await page.locator('#input_books_ref, #input_grants_ref, #input_supervision_ref, #input_innovation_ref').count() === 0,
    'B2–B5 evidence-reference fields should not remain.');
  assert(await page.locator('.research-output-card, #input_new_grant_title').count() === 0,
    'The old per-paper and per-grant entry cards must not remain.');
  assert(await page.locator('.quick-status-bar').count() === 0, 'A score/rating strip must not repeat above every form page.');
  assert(await page.locator('#tab-summary .comparison-panel').count() === 1, 'Scales belong in final dossier.');
  assert(await page.locator('#tab-provisional .comparison-panel').count() === 0,
    'Section E should show objective totals without duplicating the final-page scoring scale.');
  assert(await page.locator('#officialDossierPrintable > .dossier-final-assessment .comparison-panel').count() === 1,
    'The single scoring scale must be in the final sign-off portion of the work-done report.');
  assert(!await page.locator('.comparison-panel').isVisible(), 'Scales must not appear on first page.');
  assert(await page.locator('#input_reporting_ref, #input_approved_teaching_wu').count() === 0, 'Unwanted reference/target fields remain.');
  assert(await page.locator('#input_wu_exempted').count() === 1, 'Exemption field must remain.');
  assert(await page.locator('[data-wizard="tab-peer"]').getAttribute('aria-disabled') === 'true', 'Committee stage must start locked.');

  await set(page, '#input_emp_name', 'Synthetic Professor');
  await set(page, '#input_emp_desig', 'Professor');
  await set(page, '#input_emp_dept', 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar');
  await set(page, '#input_emp_cadre', 'BPS');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'Balanced mapping failed.');
  assert(await page.locator('#input_emp_appraiser').inputValue() === 'Head of Department / Director', 'Appraiser mapping failed.');
  assert(await page.locator('#input_emp_reviewer').inputValue() === 'Additional Director HR', 'Reviewer mapping failed.');
  assert(await page.locator('#input_emp_final').inputValue() === 'Vice Chancellor', 'Final-authority mapping failed.');
  await set(page, '#input_emp_cadre', 'TTS');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'TTS must not change weights.');

  await fillCourse(page, 1, { title: 'Anatomy', code: 'ANAT-301', specialty: 'Anatomy', theory: '1', practical: '1', review: '80', term: 'Semester 3', level: 'Undergraduate' });
  await fillCourse(page, 2, { title: 'Histology', code: 'HIST-401', specialty: 'Histology', theory: '1', practical: '0', review: '90', term: 'Winter Semester', level: 'MPhil / MS' });
  let current = await result(page);
  near(current.teachingLoad.contactHours, 64);
  near(current.teachingLoad.creditsTaught, 3);
  near(current.teachingLoad.reviewAverage, 82.5);
  near(current.teachingTarget.annualTarget, 6);
  near(current.attainmentA, 41.25);
  assert((await page.locator('#disp_teaching_formula').innerText()).includes('48 h × 80.0% + 16 h × 90.0%'),
    'Contact-hour-weighted teaching explanation missing.');
  assert((await page.locator('#disp_teaching_formula').innerText()).includes('3 credits taught ÷ 6 annual pilot target'),
    'Provisional designation-based workload factor is missing.');
  assert(await page.locator('#disp_effective_teaching').innerText() === '41.3%',
    'Faculty-entered courses should immediately contribute under the rank-adjusted pilot formula.');
  await page.evaluate(() => window.addTeachingCourse());
  assert(await page.locator('.teaching-course-card').count() === 4, 'Add course failed.');

  await set(page, '#input_pub_high_lead', 2);
  await set(page, '#input_pub_mod_co', 1);
  await set(page, '#input_publications_ref', 'SYNTHETIC/GOOGLE-SCHOLAR');
  await check(page, '#input_research_complete', true);
  current = await result(page);
  assert(current.researchRubric.publicationCount === 3, 'Publication count rows were not read.');
  await set(page, '#input_pub_low_lead', 1);
  assert((await result(page)).researchRubric.publicationCount === 4, 'Additional publication count was not read.');
  await set(page, '#input_book_nat', 1);
  await set(page, '#input_book_nat', 0);
  await set(page, '#input_sup_mphil', 1);

  // The printable work-done report must carry the evidence behind its totals,
  // not just the Section B/D aggregate scores.
  await set(page, '#input_book_nat', 1);
  await set(page, '#input_chapter_nat', 1);
  await set(page, '#input_innov_patent_nat', 1);
  await set(page, '#input_comm_member', 2);
  await set(page, '#input_facility_charge', 1);
  await set(page, '#input_grant_nat_pi', 1);
  await set(page, '#input_grant_applied', 2);
  assert((await result(page)).researchRubric.issues.length === 0,
    'Positive B2–B5 counts should score without removed evidence-reference fields.');
  near((await result(page)).researchRubric.raw, 56);
  near((await result(page)).attainmentB, 28);

  await check(page, '#input_service_complete', true);
  assert(await page.evaluate(() => window.KMUCalculator.getObjectiveReadiness().ready), 'Faculty evidence should be ready.');
  await page.evaluate(() => window.continueFromResearch());
  assert(await page.locator('#tab-service').evaluate(node => node.classList.contains('active')), 'Nonclinical research should lead to service.');
  await page.locator('#tab-service button[onclick="switchTab(\'tab-provisional\')"]').click();
  assert(await page.locator('#tab-provisional').evaluate(node => node.classList.contains('active')),
    'Section E provisional dossier must follow Service.');
  const sectionEScore = await page.locator('#provisional_objective_total').innerText();
  assert(sectionEScore.includes('/ 80 points') && (await page.locator('#provisional_objective_percent').innerText()).includes('% of the objective ceiling'),
    'Section E must show the weighted faculty objective score against its profile ceiling.');
  current = await result(page);
  assert(parseFloat(sectionEScore).toFixed(2) ===
    (current.weightedA + current.weightedB + current.weightedC + current.weightedE).toFixed(2),
  'Section E objective total must equal the sum of teaching, research, service and any patient-care weighted points.');
  await page.locator('#tab-provisional button[onclick="saveAndReturnLater()"]').click();
  assert(await page.evaluate(() => Boolean(localStorage.getItem('KMU_APPRAISAL_DRAFT_v5'))),
    'Faculty must be able to save the provisional dossier locally.');
  await page.locator('#saveReturnModal .modal-close').click();
  assert(await page.evaluate(() => window.continueToPeerReview()), 'Section E-to-committee transition failed.');
  assert(await page.locator('#tab-peer').evaluate(node => node.classList.contains('active')),
    'Completed provisional dossier must open committee assessment.');
  await set(page, '#input_reviewer_role', 'Designated Appraising Officer');
  await set(page, '#input_reviewer_name', 'Synthetic Reviewer');
  await set(page, '#input_research_review_ref', 'SYNTHETIC/REVIEW');
  await check(page, '#input_research_review_confirm', true);
  for (let index = 1; index <= 13; index += 1) await page.locator(`#chips_peer_${index} button[aria-label$="score 5"]`).click();
  for (let index = 1; index <= 5; index += 1) await page.locator(`#chips_cpd_${index} button[aria-label$="score 2"]`).click();
  current = await result(page);
  assert(current.ready && current.subjectiveReady, 'Committee assessment should complete the draft.');
  await page.evaluate(() => window.switchTab('tab-summary'));
  assert(await page.locator('.comparison-panel').isVisible(), 'Scales must appear on final page.');
  const scaleText = await page.locator('.comparison-panel').innerText();
  assert(scaleText.includes('Objective score') &&
    scaleText.includes('Appraising Officer subjective score') &&
    scaleText.includes('No relative category is assigned in this pilot.'), 'Final dossier scale is missing the requested presentation.');
  assert((await page.locator('#dossierCourseRows').innerText()).includes('ANAT-301'), 'Course evidence missing from dossier.');
  const publicationRows = await page.locator('#dossierResearchPaperRows').innerText();
  assert(publicationRows.includes('IF 5 or above') && publicationRows.includes('2') &&
    publicationRows.includes('IF below 1'), 'Publication-count research evidence missing from dossier.');
  const grantRows = await page.locator('#dossierGrantRows').innerText();
  assert(grantRows.includes('National grant PKR 1–10 million — PI') &&
    grantRows.includes('Competitive applications submitted'), 'Grant-count research evidence missing from dossier.');
  const researchSummary = await page.locator('#dossierResearchSummaryRows').innerText();
  assert(researchSummary.includes('International books 0; national books 1') &&
    researchSummary.includes('MPhil/MS completed 1') &&
    researchSummary.includes('national patents 1') &&
    researchSummary.includes('SYNTHETIC/GOOGLE-SCHOLAR') &&
    !researchSummary.includes('Evidence reference: Not entered'),
    `The dossier should list B2–B5 activity counts without deleted reference requirements. Actual: ${researchSummary}`);
  assert(await page.locator('#dossierServiceRows tr:nth-child(1) td:nth-child(2)').innerText() === '2' &&
    await page.locator('#dossierServiceRows tr:nth-child(4) td:nth-child(2)').innerText() === '1',
    'Institutional-service activity counts missing from dossier.');
  const objectiveText = await page.locator('#dossier_objective_total').innerText();
  const subjectiveText = await page.locator('#dossier_subjective_total').innerText();
  assert(objectiveText.includes('% attainment') && subjectiveText.includes('% attainment'),
    'Both objective and appraising-officer scores must appear in the final dossier.');
  assert(await page.locator('#dossierClinicalEvidence').evaluate(node => getComputedStyle(node).display) === 'none',
    'Clinical evidence should not appear for a nonclinical profile.');
  await page.emulateMedia({ media: 'print' });
  assert(await page.locator('.comparison-panel').isVisible(), 'Scales must appear in PDF print view.');
  assert(await page.locator('#dossierResearchPaperRows').isVisible() &&
    await page.locator('#dossierGrantRows').isVisible() &&
    await page.locator('#dossierResearchSummaryRows').isVisible() &&
    await page.locator('#dossierServiceRows').isVisible(),
    'Work-done evidence must be visible in PDF print view.');
  assert(await page.locator('.dossier-final-assessment').evaluate(node => getComputedStyle(node).breakBefore) === 'page',
    'Final scoring and sign-off must start on the last PDF page.');
  await page.emulateMedia({ media: 'screen' });

  await fillCourse(page, 1, { review: '81' });
  current = await result(page);
  assert(!current.ready && !current.subjectiveReady, 'Faculty edit must invalidate committee result.');
  assert(await page.locator('#tab-provisional').evaluate(node => node.classList.contains('active')),
    'A changed objective dossier must return the reviewer to Section E.');
  assert(await page.locator('[data-wizard="tab-peer"]').getAttribute('aria-disabled') === 'true', 'Committee stage must relock.');
  await set(page, '#input_emp_desig', 'Senior Registrar');
  assert((await result(page)).missing.includes('all four clinical service scores'), 'Clinical evidence must be required.');
  await page.evaluate(() => window.continueFromResearch());
  assert(await page.locator('#tab-clinical').evaluate(node => node.classList.contains('active')), 'Clinical research should lead directly to patient care.');
  await set(page, '#input_clin_service_mode', 'Patient care');
  await set(page, '#input_clin_evidence_ref', 'SYNTHETIC/UNIT-ROSTER');
  await set(page, '#input_clin_admin', 84);
  await set(page, '#input_clin_volume', 91);
  await set(page, '#input_clin_oncall', 96);
  await set(page, '#input_clin_teaching', 86);
  await page.evaluate(() => window.switchTab('tab-provisional'));
  assert(await page.locator('#provisional_clinical_row').isVisible(),
    'Clinical profiles must include patient care in the Section E objective dossier.');
  assert((await page.locator('#provisional_objective_total').innerText()).includes('/ 90 points'),
    'A clinical profile must use its 90-point objective ceiling.');
  assert(await page.locator('#dossierClinicalEvidence').evaluate(node => getComputedStyle(node).display) !== 'none',
    'Clinical evidence must appear for a clinical profile.');
  const clinicalSummary = await page.locator('#dossierClinicalRows').textContent();
  const clinicalEvidence = await page.locator('#dossierClinicalEvidence').textContent();
  assert(clinicalEvidence.includes('SYNTHETIC/UNIT-ROSTER') && clinicalSummary.includes('91.0%'),
    'Patient-care evidence is missing from the dossier.');

  await page.evaluate(() => window.saveAndReturnLater());
  assert(await page.evaluate(() => Boolean(localStorage.getItem('KMU_APPRAISAL_DRAFT_v5'))), 'Explicit save failed.');
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.locator('#draftResumeButton').isVisible(), 'Saved draft should offer explicit resume.');
  await page.locator('#draftResumeButton').click();
  assert(await page.locator('.teaching-course-card').count() === 4, 'Courses were not restored.');
  assert(await page.locator('#input_pub_high_lead').inputValue() === '2' &&
    await page.locator('#input_grant_nat_pi').inputValue() === '1',
    'Publication and grant counts were not restored.');
  await page.evaluate(() => localStorage.clear());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'Mobile layout scrolls horizontally.');
  assert(errors.length === 0, `Browser errors:\n${errors.join('\n')}`);
  console.log('PASS: credit-weighted teaching, count-based research form, reporting line, clinical flow, peer-review gate, PDF scales, persistence and mobile layout.');
  await browser.close();
  await new Promise(resolve => server.close(resolve));
})().catch(error => { console.error(error.stack || error); process.exit(1); });

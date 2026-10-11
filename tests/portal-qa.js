const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const projectRoot = path.resolve(__dirname, '..');
const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/kmu_logo.png', ['kmu_logo.png', 'image/png']],
  ['/KMU_Unified_Policy_Draft.docx', ['KMU_Unified_Policy_Draft.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']]
]);

async function startStaticServer() {
  const server = http.createServer((request, response) => {
    const entry = publicFiles.get(new URL(request.url, 'http://127.0.0.1').pathname);
    if (!entry) { response.writeHead(404); response.end('Not found'); return; }
    const [filename, contentType] = entry;
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(path.join(projectRoot, filename)).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function near(actual, expected, tolerance = 0.001) {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, received ${actual}`);
}
async function setControl(page, id, value) {
  await page.evaluate(([controlId, controlValue]) => {
    const control = document.getElementById(controlId);
    if (!control) throw new Error(`Missing control ${controlId}`);
    control.value = String(controlValue);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, value]);
}
async function setChecked(page, id, checked) {
  await page.evaluate(([controlId, value]) => {
    const control = document.getElementById(controlId);
    control.checked = value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, checked]);
}
async function result(page) { return page.evaluate(() => window.KMUCalculator.lastResult); }

(async () => {
  const server = await startStaticServer();
  const launchOptions = { headless: true };
  if (process.env.KMU_CHROME_PATH) launchOptions.executablePath = process.env.KMU_CHROME_PATH;
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`page: ${error.message}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });

  assert(await page.title() === 'KMU Faculty Appraisal Portal — Controlled Pilot', 'Portal title changed unexpectedly.');
  assert(await page.locator('#input_emp_name').inputValue() === '', 'The default form must be blank.');
  assert(await page.locator('#liveProfileName').innerText() === 'Profile pending', 'The profile must be pending before designation and unit are selected.');
  assert(await page.locator('[data-wizard="tab-peer"]').getAttribute('aria-disabled') === 'true', 'Reviewer stage must start locked.');
  assert(await page.locator('#input_actual_wu').count() === 0, 'The old raw-WU input must not appear.');
  assert(await page.locator('#input_theory_credits').inputValue() === '', 'Theory credits must start blank.');
  assert(await page.locator('#input_practical_credits').inputValue() === '', 'Practical credits must start blank.');
  assert(await page.locator('body').innerText().then(text => text.includes('Controlled pilot only.')), 'Pilot notice is missing.');
  assert(await page.evaluate(() => localStorage.getItem('KMU_APPRAISAL_DRAFT_v3_3')) === null, 'Loading must not save automatically.');
  assert(await page.locator('#liveRatingBadge').innerText() === 'Incomplete draft', 'An unfinished form must not receive a rating.');
  assert(await page.locator('#kpi_pip_status').innerText() === 'Not assessed', 'An unfinished form must not receive a PIP status.');
  assert(await page.locator('.help-tip').count() >= 30, 'Contextual question-mark guidance is missing.');
  assert(await page.locator('header').innerText().then(text => !text.includes('Fictional Sample') && !text.includes('Import Draft')), 'Sample/import controls must not appear in the header.');
  assert(await page.locator('a[download][href="KMU_Unified_Policy_Draft.docx"]').count() >= 1, 'Draft policy download is missing.');
  const cadres = await page.locator('#input_emp_cadre option').evaluateAll(options => options.slice(1).map(option => option.value));
  assert(JSON.stringify(cadres) === JSON.stringify(['BPS', 'TTS', 'Fixed Pay']), 'Pay scale/service cadre choices are incorrect.');
  const designations = await page.locator('#input_emp_desig option').allTextContents();
  assert(!designations.some(label => /BPS|TTS/.test(label)), 'A substantive designation contains a pay scale or cadre.');

  const printGate = await page.evaluate(() => {
    let printed = false; let message = '';
    window.print = () => { printed = true; };
    window.alert = text => { message = String(text); };
    window.printDossier();
    return { printed, message };
  });
  assert(!printGate.printed && printGate.message.includes('cannot be printed'), 'Incomplete print must be blocked.');
  await page.emulateMedia({ media: 'print' });
  assert(await page.locator('#printBlockedNotice').isVisible(), 'Browser print shortcut must show incomplete notice.');
  await page.emulateMedia({ media: 'screen' });

  await setControl(page, 'input_emp_name', 'Synthetic Professor');
  await page.selectOption('#input_emp_desig', 'Professor');
  await page.selectOption('#input_emp_dept', 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar');
  await page.selectOption('#input_emp_cadre', 'BPS');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'Standard Professor mix is incorrect.');
  await page.selectOption('#input_emp_cadre', 'TTS');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'TTS alone must not change the mix.');
  await page.selectOption('#input_work_assignment', 'Research-Focused Profile');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'Unreferenced special assignment must fail closed.');
  await setControl(page, 'input_reporting_ref', 'SYNTHETIC/WORKLOAD/001');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Research-Focused Profile', 'Referenced research assignment should change mix.');
  await page.selectOption('#input_work_assignment', 'AUTO');
  await setControl(page, 'input_reporting_ref', '');
  await page.selectOption('#input_emp_desig', 'Assistant Professor');
  await page.selectOption('#input_emp_dept', 'KMU Institute of Health Sciences, Swabi');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Teaching-Focused Profile (Regional IHS)', 'Regional IHS mapping failed.');
  await page.selectOption('#input_emp_dept', 'KMU Institute of Paramedical Sciences, Lakki Marwat');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'Ambiguous Lakki Marwat unit must not be inferred as IHS.');
  await page.selectOption('#input_emp_desig', 'Research Associate');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Research Cadres / Postdocs', 'Research-cadre mapping failed.');
  await page.selectOption('#input_emp_desig', 'Senior Registrar');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Clinical-Focused Profile (Hospital Faculty)', 'Clinical mapping failed.');
  await page.selectOption('#input_emp_desig', 'Professor');
  await page.selectOption('#input_emp_dept', 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar');

  await setControl(page, 'input_qec_score', 80);
  await setControl(page, 'input_theory_credits', 1);
  assert(await page.locator('#disp_effective_teaching').innerText() === '—', 'Both credit components must be entered explicitly.');
  await setControl(page, 'input_practical_credits', 1);
  let current = await result(page);
  near(current.teachingLoad.contactHours, 48); near(current.teachingLoad.teachingWU, 5);
  near(current.attainmentA, 80 * 5 / 30);
  assert(await page.locator('#disp_teaching_hours').innerText() === '48 contact hours', '1+1 course contact-hour conversion failed.');
  assert((await page.locator('#disp_teaching_formula').innerText()).includes('5 delivered / 30 required WU'), 'Effective teaching formula is not visible.');
  await page.selectOption('#input_leadership_role', 'Dean of Faculty');
  current = await result(page);
  near(current.teachingTargetWU, 30);
  await setControl(page, 'input_reporting_ref', 'SYNTHETIC/DEAN/ORDER');
  current = await result(page);
  near(current.teachingTargetWU, 15);
  await page.selectOption('#input_leadership_role', 'None');
  await setControl(page, 'input_reporting_ref', '');

  for (const [id, value] of [
    ['input_research_output_1_id', '10.1000/synthetic-one'],
    ['input_research_output_1_rigor', 7], ['input_research_output_1_significance', 5],
    ['input_research_output_1_contribution', 4], ['input_research_output_1_relevance', 2],
    ['input_research_output_2_id', '10.1000/synthetic-two'],
    ['input_research_output_2_rigor', 7], ['input_research_output_2_significance', 5],
    ['input_research_output_2_contribution', 3], ['input_research_output_2_relevance', 2],
    ['input_research_execution', 20], ['input_research_execution_ref', 'SYNTHETIC/PLAN'],
    ['input_research_funding', 0], ['input_research_translation', 8],
    ['input_research_translation_ref', 'SYNTHETIC/TRAINEE']
  ]) await setControl(page, id, value);
  await setChecked(page, 'input_research_complete', true);
  current = await result(page);
  near(current.attainmentB, 63); near(current.weightedB, 18.9);
  assert(current.researchRubric.issues.length === 0, 'Two well-documented outputs without a grant should be a complete research submission.');
  await setControl(page, 'input_pub_high_lead', 20);
  near((await result(page)).attainmentB, 63);
  assert((await result(page)).rawB > 0, 'Legacy quantity trace should remain visible but not weighted.');
  await setControl(page, 'input_research_output_2_id', 'doi:10.1000/synthetic-one');
  assert((await result(page)).researchRubric.issues.some(issue => issue.includes('duplicate')), 'Duplicate selected outputs must be flagged.');
  await setControl(page, 'input_research_output_2_id', '10.1000/synthetic-two');
  await setControl(page, 'input_research_funding', 5);
  await setControl(page, 'input_research_funding_ref', 'SYNTHETIC/PROPOSAL');
  near((await result(page)).attainmentB, 68);
  await setControl(page, 'input_research_execution', 25);
  near((await result(page)).attainmentB, 68); // Funding remains inside the 25-point execution ceiling.
  await setControl(page, 'input_research_execution', 20);
  await setControl(page, 'input_research_funding', 0);
  await setControl(page, 'input_research_funding_ref', '');

  await setControl(page, 'input_comm_member', 2);
  await setControl(page, 'input_policy_doc', 1);
  assert(!(await page.evaluate(() => window.KMUCalculator.getObjectiveReadiness().ready)), 'Service completion must be explicit.');
  await setChecked(page, 'input_service_complete', true);
  assert(await page.evaluate(() => window.KMUCalculator.getObjectiveReadiness().ready), 'Faculty evidence should now be ready.');
  assert(await page.locator('[data-wizard="tab-peer"]').getAttribute('aria-disabled') === 'true', 'Reviewer stage must remain locked before handoff.');
  assert(await page.evaluate(() => window.submitObjectiveForReview()), 'Faculty handoff should succeed.');
  assert(await page.locator('[data-wizard="tab-peer"]').getAttribute('aria-disabled') === 'false', 'Reviewer stage did not unlock.');
  assert((await page.locator('#objectiveScaleValue').innerText()).includes('% of ceiling'), 'Objective scale is missing.');
  assert((await page.locator('#subjectiveScaleValue').innerText()) === 'Awaiting reviewer assessment', 'Subjective scale must wait for reviewer.');
  await page.selectOption('#input_reviewer_role', 'Designated Appraising Officer');
  await setControl(page, 'input_reviewer_name', 'Synthetic Reviewer');
  await setControl(page, 'input_research_review_ref', 'SYNTHETIC/REVIEW');
  await setChecked(page, 'input_research_review_confirm', true);
  for (let index = 1; index <= 13; index += 1) await page.locator(`#chips_peer_${index} button[aria-label$="score 5"]`).click();
  for (let index = 1; index <= 5; index += 1) await page.locator(`#chips_cpd_${index} button[aria-label$="score 2"]`).click();
  current = await result(page);
  assert(current.ready && current.subjectiveReady, 'Reviewer assessment should complete the synthetic draft.');
  near(current.subjectivePercent, 75 / 88 * 100);
  assert((await page.locator('#comparisonNote').innerText()).includes('percentage points'), 'The two scales should show their difference.');
  assert(await page.locator('#subjectiveScaleFill').evaluate(node => node.classList.contains('benchmark-high')), 'The ≥80% subjective scale must be green.');
  assert(await page.locator('#objectiveScaleFill').evaluate(node => node.classList.contains('benchmark-low')), 'The <80% objective scale must be red.');

  await setControl(page, 'input_theory_credits', 2);
  current = await result(page);
  assert(!current.ready && !current.subjectiveReady, 'Changing faculty evidence must invalidate the reviewer result.');
  assert(await page.locator('[data-wizard="tab-peer"]').getAttribute('aria-disabled') === 'true', 'Reviewer stage must relock after faculty edit.');
  assert(!await page.locator('#input_research_review_confirm').isChecked(), 'Research review must be re-confirmed after faculty edit.');
  assert(await page.locator('#chips_peer_1 .score-chip-btn.selected').count() === 0, 'Previous subjective scores must be cleared after faculty edit.');

  await page.evaluate(() => window.loadSampleData());
  current = await result(page);
  assert(current.ready && current.finalScore !== null, 'Complete synthetic demonstration should produce a draft score.');
  assert(await page.locator('body').evaluate(body => body.classList.contains('dossier-print-ready')), 'Complete draft should be print-ready.');
  await setControl(page, 'input_qec_score', 101);
  assert(!(await result(page)).ready, 'Out-of-range QEC must block completion.');
  await page.evaluate(() => window.loadSampleData());
  await page.selectOption('#input_emp_desig', 'Senior Registrar');
  assert((await result(page)).missing.includes('all four clinical service scores'), 'Clinical profile must require four patient-care scores.');
  assert(!await page.locator('#input_research_review_confirm').isChecked(), 'Profile change must revoke prior research review.');

  await page.evaluate(() => window.loadSampleData());
  await setControl(page, 'input_new_grant_title', '<img src=x onerror=alert(1)>');
  await setControl(page, 'input_new_grant_agency', '<script>bad()</script>');
  await setControl(page, 'input_new_grant_amount', '500000');
  await setControl(page, 'input_new_grant_band', 'Small <1M');
  await setControl(page, 'input_new_grant_role', 'PI');
  await setControl(page, 'input_new_grant_status', 'Won');
  await page.evaluate(() => window.addGrantRecord());
  assert(await page.locator('#grantsTableBody img, #grantsTableBody script').count() === 0, 'Grant text must not create executable elements.');
  assert((await page.locator('#grantsTableBody').innerText()).includes('<img src=x onerror=alert(1)>'), 'Grant title should render literally.');

  await page.evaluate(() => window.loadSampleData());
  assert(await page.evaluate(() => localStorage.getItem('KMU_APPRAISAL_DRAFT_v3_3')) === null, 'Typing must not auto-save.');
  await page.locator('header button', { hasText: 'Save & Return Later' }).click();
  assert(await page.evaluate(() => Boolean(localStorage.getItem('KMU_APPRAISAL_DRAFT_v3_3'))), 'Explicit save should persist the draft.');
  await page.locator('#saveReturnModal .modal-close').click();
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.locator('#draftResumeButton').isVisible(), 'Saved draft should offer explicit resume.');
  await page.locator('#draftResumeButton').click();
  assert((await result(page)).ready, 'Restored reviewer-stage draft should retain completion and score.');
  await page.evaluate(() => window.switchTab('tab-summary'));
  assert((await page.locator('#dossier_raw_b').innerText()).includes('quality-first pilot'), 'Dossier must distinguish scored research from legacy raw trace.');
  assert((await page.locator('#officialDossierPrintable').innerText()).includes('Not an Official PER'), 'Printable draft notice is missing.');
  await page.screenshot({ path: '/tmp/kmu-portal-desktop.png', fullPage: true });
  await page.evaluate(() => localStorage.clear());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'The 390-pixel layout must not scroll horizontally.');
  await page.screenshot({ path: '/tmp/kmu-portal-mobile.png', fullPage: true });
  await page.evaluate(() => localStorage.setItem('KMU_APPRAISAL_DRAFT_v3', '{"legacy":true}'));
  await page.reload({ waitUntil: 'networkidle' });
  assert((await page.locator('#draftBannerInfo').innerText()).includes('older pilot draft'), 'Legacy browser data must be identified.');
  assert(!await page.locator('#draftResumeButton').isVisible(), 'Obsolete drafts must not resume automatically.');
  assert(errors.length === 0, `Browser errors:\n${errors.join('\n')}`);
  console.log('PASS: teaching conversion, quality-first research, stage gating, profile mapping, safeguards, persistence and responsive rendering.');
  await browser.close();
  await new Promise(resolve => server.close(resolve));
})().catch(error => { console.error(error.stack || error); process.exit(1); });

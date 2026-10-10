const fs = require('fs');
const http = require('http');
const path = require('path');
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
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    fs.createReadStream(path.join(projectRoot, filename)).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function near(actual, expected, tolerance = 0.001) {
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, received ${actual}`);
}

async function setControl(page, id, value) {
  await page.evaluate(([controlId, controlValue]) => {
    const control = document.getElementById(controlId);
    control.value = String(controlValue);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, value]);
}

(async () => {
  const server = await startStaticServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  const launchOptions = { headless: true };
  if (process.env.KMU_CHROME_PATH) launchOptions.executablePath = process.env.KMU_CHROME_PATH;
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`page: ${error.message}`));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  assert(await page.title() === 'KMU Faculty Appraisal Portal — Controlled Pilot', 'Portal title is incorrect.');
  assert(await page.locator('#input_emp_name').inputValue() === '', 'The default form must be blank.');
  assert(await page.locator('body').innerText().then(text => text.includes('Controlled pilot only.')), 'Pilot warning is missing.');
  assert(await page.evaluate(() => localStorage.getItem('KMU_APPRAISAL_DRAFT_v3_2')) === null, 'Initial load must not auto-save.');
  assert((await page.locator('#liveRatingBadge').innerText()).toLowerCase() === 'incomplete draft', 'An unfinished form must not receive an adverse rating.');
  assert(await page.locator('#kpi_pip_status').innerText() === 'Not assessed', 'An unfinished form must not receive a PIP status.');
  assert(await page.locator('#input_qec_score').inputValue() === '', 'Required QEC score must begin blank.');
  assert(await page.locator('#input_actual_wu').inputValue() === '', 'Required teaching workload must begin blank.');
  assert(await page.locator('#cpdTargetsList .score-chip-btn.selected').count() === 0, 'Blank CPD targets must not default to a zero score.');
  assert(await page.locator('.help-tip').count() >= 20, 'Contextual question-mark help is missing.');
  assert(await page.locator('#liveProfileName').innerText() === 'Profile pending', 'The portal must not show Balanced before designation and institute are selected.');
  assert(await page.locator('#disp_auto_min_wu').count() === 0, 'The confusing minimum-workload chip must not appear on the profile page.');
  assert(await page.locator('header').innerText().then(text => !text.includes('Fictional Sample') && !text.includes('Import Draft')), 'Technical sample/import actions must not appear in the header.');
  assert(await page.locator('a[download][href="KMU_Unified_Policy_Draft.docx"]').count() >= 1, 'Draft-policy download is missing.');
  const serviceCadres = await page.locator('#input_emp_cadre option').evaluateAll(options => options.slice(1).map(option => option.value));
  assert(JSON.stringify(serviceCadres) === JSON.stringify(['BPS', 'TTS', 'Fixed Pay']), 'Service cadre must contain only BPS, TTS, and Fixed Pay.');
  const cadreLabel = await page.locator('label[for="input_emp_cadre"]').evaluate(label => label.childNodes[0].textContent.trim());
  assert(cadreLabel === 'Pay Scale & Service Cadre *', 'Pay-scale/service-cadre label is incorrect.');
  const designationLabels = await page.locator('#input_emp_desig option').allTextContents();
  assert(!designationLabels.some(label => /BPS|TTS/.test(label)), 'Substantive designation labels must not contain pay-scale/cadre terms.');
  const printGate = await page.evaluate(() => {
    let printed = false; let message = '';
    window.print = () => { printed = true; };
    window.alert = text => { message = String(text); };
    window.printDossier(); window.switchTab('tab-meta');
    return { printed, message };
  });
  assert(!printGate.printed && printGate.message.includes('cannot be printed'), 'Incomplete dossiers must be blocked from printing.');
  assert(!await page.locator('body').evaluate(body => body.classList.contains('dossier-print-ready')), 'Incomplete dossiers must not be marked print-ready.');
  await page.emulateMedia({ media: 'print' });
  assert(await page.locator('#printBlockedNotice').isVisible(), 'Browser print shortcuts must show the incomplete-draft notice.');
  assert(!await page.locator('#officialDossierPrintable').isVisible(), 'Browser print shortcuts must hide an incomplete dossier.');
  await page.emulateMedia({ media: 'screen' });
  const roundedClassification = await page.evaluate(() => window.KMUCalculator.classifyScore(84.96));
  assert(roundedClassification.score === 85 && roundedClassification.rating === 'Outstanding', 'Rating must use the displayed one-decimal score.');
  const benchmarkBoundaries = await page.evaluate(() => ({
    pending: window.KMUCalculator.benchmarkState(100, false),
    below: window.KMUCalculator.benchmarkState(79.9, true),
    met: window.KMUCalculator.benchmarkState(80, true)
  }));
  assert(JSON.stringify(benchmarkBoundaries) === JSON.stringify({ pending: 'pending', below: 'low', met: 'high' }), 'The 80% benchmark boundary is incorrect.');
  const scenarioAudit = await page.evaluate(() => {
    const calculate = window.KMUCalculator.calculatePilotScenario;
    return {
      balancedStrong: calculate('Balanced Profile', { teaching: 90, researchRaw: 31, service: 80, officer: 85 }),
      teachingFocused: calculate('Teaching-Focused Profile (Regional IHS)', { teaching: 92, researchRaw: 14, service: 75, officer: 85 }),
      clinicalStrong: calculate('Clinical-Focused Profile (Hospital Faculty)', { teaching: 80, researchRaw: 17, service: 70, officer: 85, clinical: 90 }),
      researchFocused: calculate('Research-Focused Profile', { teaching: 75, researchRaw: 44, service: 70, officer: 85 }),
      researchCadre: calculate('Research Cadres / Postdocs', { teaching: 75, researchRaw: 54.5, service: 65, officer: 85 }),
      balancedTypical: calculate('Balanced Profile', { teaching: 70, researchRaw: 18, service: 50, officer: 65 }),
      teachingOnly: calculate('Balanced Profile', { teaching: 95, researchRaw: 2, service: 10, officer: 45 }),
      poor: calculate('Balanced Profile', { teaching: 45, researchRaw: 3, service: 20, officer: 40 }),
      capped: calculate('Balanced Profile', { teaching: 100, researchRaw: 999, service: 100, officer: 100 })
    };
  });
  assert(scenarioAudit.balancedStrong.rating === 'Outstanding', 'Strong balanced performance should be distinguishable as Outstanding.');
  assert(scenarioAudit.teachingFocused.score >= 85, 'A strong teaching-focused faculty member should not be unfairly suppressed by the research domain.');
  assert(scenarioAudit.clinicalStrong.score >= 85, 'Strong clinical/patient-care performance should be distinguishable.');
  assert(scenarioAudit.researchFocused.score >= 85 && scenarioAudit.researchCadre.score >= 85, 'Strong research assignments should be distinguishable without requiring every research category.');
  assert(scenarioAudit.poor.score < scenarioAudit.teachingOnly.score && scenarioAudit.teachingOnly.score < scenarioAudit.balancedTypical.score && scenarioAudit.balancedTypical.score < scenarioAudit.balancedStrong.score, 'Scenario ordering does not discriminate progressively stronger performance.');
  assert(scenarioAudit.capped.researchAttainment === 100 && scenarioAudit.capped.score === 100, 'Extreme research inputs must remain capped at 100% attainment.');
  const calendarRange = await page.evaluate(() => window.KMUCalculator.cycleDateRange('Calendar Year 2026 (01 January – 31 December 2026)'));
  assert(JSON.stringify(calendarRange) === JSON.stringify(['2026-01-01', '2026-12-31']), 'Calendar-year date range is incorrect.');

  await page.selectOption('#input_emp_desig', 'Professor');
  await page.selectOption('#input_emp_dept', 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'Professor should retain the Balanced profile without rank adjustment.');
  assert(await page.locator('#disp_auto_weight_teaching').innerText() === '30%', 'Balanced teaching weight should be 30%.');
  assert(await page.locator('#disp_auto_weight_research').innerText() === '30%', 'Balanced research weight should be 30%.');
  await page.selectOption('#input_emp_cadre', 'TTS');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'TTS status alone must not change the profile.');
  await page.selectOption('#input_work_assignment', 'Research-Focused Profile');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'An unreferenced special work assignment must fail closed.');
  await setControl(page, 'input_reporting_ref', 'EXAMPLE/WORKLOAD/001');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Research-Focused Profile', 'A referenced research-focused assignment should override the default.');
  await page.selectOption('#input_work_assignment', 'AUTO');
  await setControl(page, 'input_reporting_ref', '');

  await page.selectOption('#input_emp_desig', 'Assistant Professor');
  await page.selectOption('#input_emp_dept', 'KMU Institute of Health Sciences, Swabi');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Teaching-Focused Profile (Regional IHS)', 'Regional IHS mapping failed.');
  assert(await page.locator('#disp_auto_weight_teaching').innerText() === '50%', 'Regional IHS teaching weight should be 50%.');
  await page.selectOption('#input_emp_dept', 'KMU Institute of Paramedical Sciences, Lakki Marwat');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Balanced Profile', 'Lakki Marwat must not be misclassified as a regional IHS.');
  await page.selectOption('#input_emp_dept', 'KMU Institute of Health Sciences, Swabi');

  await page.selectOption('#input_emp_desig', 'Research Associate');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Research Cadres / Postdocs', 'Research-cadre mapping failed.');
  assert(await page.locator('#disp_auto_weight_research').innerText() === '65%', 'Research-cadre research weight should be 65%.');

  await page.selectOption('#input_emp_desig', 'Senior Registrar');
  assert(await page.locator('#disp_auto_profile_name').innerText() === 'Clinical-Focused Profile (Hospital Faculty)', 'Clinical designation mapping failed.');
  for (const [id, value] of [['input_clin_admin', 100], ['input_clin_volume', 100], ['input_clin_oncall', 100], ['input_clin_teaching', 100]]) {
    await setControl(page, id, value);
  }
  let result = await page.evaluate(() => window.KMUCalculator.lastResult);
  near(result.rawE, 100); near(result.weightedE, 45);

  await page.selectOption('#input_emp_desig', 'Assistant Professor');
  await page.selectOption('#input_emp_dept', 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar');
  await page.evaluate(() => {
    document.querySelectorAll('input[type="number"]').forEach(input => {
      if (!input.id.startsWith('input_new_grant')) { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  });
  await setControl(page, 'input_pub_high_lead', 0.5);
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  near(result.rawB, 0);
  assert((await page.locator('#input_pub_high_lead').evaluate(input => input.validationMessage)).includes('whole-number'), 'Fractional activity counts must be rejected.');
  await setControl(page, 'input_pub_high_lead', 0);
  for (const [id, value] of [['input_sup_clin_sr', 1], ['input_sup_clin_jr', 1], ['input_innov_patent_int', 1], ['input_innov_patent_nat', 1], ['input_innov_project', 1], ['input_innov_overhead', 1]]) {
    await setControl(page, id, value);
  }
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  assert(await page.locator('#disp_sub_b4').innerText() === '12.0', 'Clinical supervision must score 8 + 4.');
  assert(await page.locator('#disp_sub_b5').innerText() === '34.0', 'Innovation must score 10 + 6 + 8 + 10.');
  near(result.rawB, 46); near(result.researchBenchmark, 30); near(result.attainmentB, 100); near(result.weightedB, 30);

  for (const [id, value] of [['input_comm_member', 5], ['input_comm_chair', 3], ['input_policy_doc', 4], ['input_facility_charge', 3]]) {
    await setControl(page, id, value);
  }
  await setControl(page, 'input_additional_appoint', 'Y');
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  near(result.rawC, 100); near(result.weightedC, 20);
  assert(await page.locator('#disp_comm_chair').innerText() === '20', 'Chairmanship cap must be 20.');
  assert(await page.locator('#disp_policy_doc').innerText() === '30', 'Policy-document cap must be 30.');
  assert(await page.locator('#disp_facility_charge').innerText() === '30', 'Facility-management cap must be 30.');
  assert(await page.locator('#disp_add_appoint').innerText() === '15', 'Additional appointment must score 15.');

  const grants = await page.evaluate(() => ({
    internationalCoPI: window.KMUCalculator.computeGrantPoints(12000000, 'Co-PI', 'Won', 'International >10M'),
    nationalPI: window.KMUCalculator.computeGrantPoints(5000000, 'PI', 'Won', 'National 1–10M'),
    smallCoPI: window.KMUCalculator.computeGrantPoints(500000, 'Co-PI', 'Won', 'Small <1M'),
    application: window.KMUCalculator.computeGrantPoints(5000000, 'PI', 'Applied', 'National 1–10M'),
    invalidBand: window.KMUCalculator.computeGrantPoints(500000, 'PI', 'Won', 'International >10M')
  }));
  near(grants.internationalCoPI, 4.5); near(grants.nationalPI, 8); near(grants.smallCoPI, 0);
  near(grants.application, 2); near(grants.invalidBand, 0);

  await setControl(page, 'input_red_flag', '25');
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  near(result.penalty, 0);
  await setControl(page, 'input_red_flag_ref', 'EXAMPLE/REF/001');
  await setControl(page, 'input_red_flag_date', '2026-01-15');
  await setControl(page, 'input_red_flag_inquiry', 'Y');
  await setControl(page, 'input_red_flag_appeal', 'Y');
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  near(result.penalty, 25);
  await setControl(page, 'input_red_flag_date', '2027-01-15');
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  near(result.penalty, 0);

  await page.fill('#input_emp_name', 'Draft User');
  assert(await page.evaluate(() => localStorage.getItem('KMU_APPRAISAL_DRAFT_v3_2')) === null, 'Typing must not auto-save.');
  await page.locator('header button', { hasText: 'Save & Return Later' }).click();
  assert(await page.evaluate(() => Boolean(localStorage.getItem('KMU_APPRAISAL_DRAFT_v3_2'))), 'Explicit save should persist the draft.');
  await page.locator('#saveReturnModal .modal-close').click();

  await page.evaluate(() => window.loadSampleData());
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  assert(result.ready && result.finalScore !== null && result.rating !== 'Incomplete draft', 'Complete fictional data should produce a draft rating.');
  assert(await page.locator('body').evaluate(body => body.classList.contains('dossier-print-ready')), 'A complete fictional sample should be marked print-ready.');
  assert(await page.locator('#objectiveSplitCard').evaluate(card => card.classList.contains('benchmark-high')), 'Objective attainment at or above 80% must be green.');
  assert(await page.locator('#subjectiveSplitCard').evaluate(card => card.classList.contains('benchmark-low')), 'Subjective attainment below 80% must be red.');
  assert((await page.locator('#disp_objective_score').innerText()).includes('points'), 'Objective display must label weighted points correctly.');

  await page.selectOption('#input_emp_desig', 'Senior Registrar');
  for (const id of ['input_clin_admin', 'input_clin_volume', 'input_clin_oncall', 'input_clin_teaching']) await setControl(page, id, '');
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  assert(!result.ready && result.missing.includes('all four clinical service scores'), 'An active Clinical profile must require all four clinical scores.');
  for (const id of ['input_clin_admin', 'input_clin_volume', 'input_clin_oncall', 'input_clin_teaching']) await setControl(page, id, 0);
  await setControl(page, 'input_clin_service_mode', 'Patient care');
  await setControl(page, 'input_clin_evidence_ref', 'EXAMPLE/CLINICAL/NORM/001');
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  assert(result.ready, 'Explicit zero clinical scores must be distinguishable from blank clinical scores.');

  await page.evaluate(() => window.loadSampleData());
  await setControl(page, 'input_qec_score', 101);
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  assert(!result.ready && result.missing.includes('valid scoring values within the permitted ranges'), 'Out-of-range scoring inputs must block rating and printing.');
  await setControl(page, 'input_qec_score', 86);
  await setControl(page, 'input_pub_high_lead', 0.5);
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  assert(!result.ready, 'Fractional activity counts must block rating and printing.');
  await setControl(page, 'input_pub_high_lead', 1);
  await setControl(page, 'input_red_flag', 25);
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  assert(!result.ready && result.missing.includes('complete and valid disciplinary due-process controls'), 'An unsupported nonzero penalty must block rating and printing.');
  await setControl(page, 'input_red_flag', 0);
  result = await page.evaluate(() => window.KMUCalculator.lastResult);
  assert(result.ready, 'Clearing an unsupported penalty should restore readiness for a complete sample.');

  await setControl(page, 'input_new_grant_title', '<img src=x onerror=alert(1)>');
  await setControl(page, 'input_new_grant_agency', '<script>bad()</script>');
  await setControl(page, 'input_new_grant_amount', '500000');
  await setControl(page, 'input_new_grant_band', 'Small <1M');
  await setControl(page, 'input_new_grant_role', 'PI');
  await setControl(page, 'input_new_grant_status', 'Won');
  await page.evaluate(() => window.addGrantRecord());
  assert(await page.locator('#grantsTableBody img').count() === 0, 'Grant title created an executable HTML node.');
  assert(await page.locator('#grantsTableBody script').count() === 0, 'Grant agency created a script node.');
  assert((await page.locator('#grantsTableBody').innerText()).includes('<img src=x onerror=alert(1)>'), 'Grant title should render as literal text.');

  await page.waitForTimeout(3500);
  await page.screenshot({ path: '/tmp/kmu-portal-desktop.png', fullPage: true });
  await page.evaluate(() => window.switchTab('tab-summary'));
  await page.waitForTimeout(300);
  assert((await page.locator('#dossier_raw_b').innerText()).includes('benchmark 30'), 'Printable dossier must show the pilot research benchmark.');
  assert((await page.locator('#officialDossierPrintable').innerText()).includes('Not an Official PER'), 'Printable dossier draft notice is missing.');
  await page.screenshot({ path: '/tmp/kmu-portal-summary.png', fullPage: true });
  await page.evaluate(() => localStorage.clear());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/kmu-portal-mobile.png', fullPage: true });

  await page.evaluate(() => localStorage.setItem('KMU_APPRAISAL_DRAFT_v3', '{"legacy":true}'));
  await page.reload({ waitUntil: 'networkidle' });
  assert((await page.locator('#draftBannerInfo').innerText()).includes('older pilot draft'), 'Legacy browser data must be detected explicitly.');
  assert(!await page.locator('#draftResumeButton').isVisible(), 'Obsolete drafts must not be offered for automatic restore.');
  await page.evaluate(() => localStorage.clear());

  assert(errors.length === 0, `Browser errors:\n${errors.join('\n')}`);
  console.log('PASS: profile mapping, formulas, penalty safeguards, persistence, XSS handling, and responsive rendering.');
  await browser.close();
  await new Promise(resolve => server.close(resolve));
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

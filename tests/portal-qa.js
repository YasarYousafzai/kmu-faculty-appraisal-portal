const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
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
async function fillCard(page, kind, index, fields) {
  for (const [key, value] of Object.entries(fields)) {
    const selector = kind === 'course'
      ? `.teaching-course-card:nth-child(${index}) [data-course-field="${key}"]`
      : `.research-output-card:nth-child(${index}) [data-paper-field="${key}"]`;
    await set(page, selector, value);
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
  assert(await page.locator('.research-output-card').count() === 4, 'Four starter papers required.');
  assert(await page.locator('.quick-status-bar').count() === 0, 'A score/rating strip must not repeat above every form page.');
  assert(await page.locator('#tab-summary .comparison-panel').count() === 1, 'Scales belong in final dossier.');
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

  await fillCard(page, 'course', 1, { title: 'Anatomy', code: 'ANAT-301', specialty: 'Anatomy', theory: '1', practical: '1', review: '80', term: 'Semester 3', level: 'Undergraduate' });
  await fillCard(page, 'course', 2, { title: 'Histology', code: 'HIST-401', specialty: 'Histology', theory: '1', practical: '0', review: '90', term: 'Winter Semester', level: 'MPhil / MS' });
  let current = await result(page);
  near(current.teachingLoad.contactHours, 64); near(current.attainmentA, 85);
  assert((await page.locator('#disp_teaching_formula').innerText()).includes('80.0 + 90.0'), 'Course-average explanation missing.');
  await page.evaluate(() => window.addTeachingCourse());
  assert(await page.locator('.teaching-course-card').count() === 4, 'Add course failed.');

  await fillCard(page, 'paper', 1, { title: 'Paper A', id: '10.1000/a', impactFactor: '6', role: 'first', indexed: 'Y' });
  await fillCard(page, 'paper', 2, { title: 'Paper B', id: '10.1000/b', impactFactor: '3', role: 'co', indexed: 'Y' });
  await fillCard(page, 'paper', 3, { title: 'Paper C', id: '10.1000/c', impactFactor: '6', role: 'corresponding', indexed: 'Y' });
  await set(page, '#input_research_execution', 20);
  await set(page, '#input_research_execution_ref', 'SYNTHETIC/PLAN');
  await check(page, '#input_research_complete', true);
  current = await result(page);
  near(current.researchRubric.outputQuality, 48); near(current.attainmentB, 68);
  await fillCard(page, 'paper', 4, { title: 'Paper D', id: '10.1000/d', impactFactor: '0.5', role: 'first', indexed: 'Y' });
  near((await result(page)).attainmentB, 68);
  await set(page, '#input_book_nat', 1); await set(page, '#input_books_ref', 'SYNTHETIC/ISBN');
  near((await result(page)).attainmentB, 72);
  await set(page, '#input_book_nat', 0);
  await set(page, '#input_sup_mphil', 1); await set(page, '#input_supervision_ref', 'SYNTHETIC/ASRB');
  near((await result(page)).attainmentB, 72);
  await fillCard(page, 'paper', 4, { id: 'doi:10.1000/a' });
  assert((await result(page)).researchRubric.issues.some(issue => issue.includes('duplicate')), 'Duplicate papers must be flagged.');
  await fillCard(page, 'paper', 4, { id: '10.1000/d' });

  await check(page, '#input_service_complete', true);
  assert(await page.evaluate(() => window.KMUCalculator.getObjectiveReadiness().ready), 'Faculty evidence should be ready.');
  await page.evaluate(() => window.continueFromResearch());
  assert(await page.locator('#tab-service').evaluate(node => node.classList.contains('active')), 'Nonclinical research should lead to service.');
  assert(await page.evaluate(() => window.submitObjectiveForReview()), 'Faculty handoff failed.');
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
  assert(scaleText.includes('Objective Score') && scaleText.includes('Appraising Officer Subjective Score') && !scaleText.includes('Compare'), 'Scale labels are incorrect.');
  assert((await page.locator('#dossierCourseRows').innerText()).includes('ANAT-301'), 'Course evidence missing from dossier.');
  await page.emulateMedia({ media: 'print' });
  assert(await page.locator('.comparison-panel').isVisible(), 'Scales must appear in PDF print view.');
  assert(await page.locator('.dossier-final-assessment').evaluate(node => getComputedStyle(node).breakBefore) === 'page',
    'Final scoring and sign-off must start on the last PDF page.');
  await page.emulateMedia({ media: 'screen' });

  await fillCard(page, 'course', 1, { review: '81' });
  current = await result(page);
  assert(!current.ready && !current.subjectiveReady, 'Faculty edit must invalidate committee result.');
  assert(await page.locator('[data-wizard="tab-peer"]').getAttribute('aria-disabled') === 'true', 'Committee stage must relock.');
  await set(page, '#input_emp_desig', 'Senior Registrar');
  assert((await result(page)).missing.includes('all four clinical service scores'), 'Clinical evidence must be required.');
  await page.evaluate(() => window.continueFromResearch());
  assert(await page.locator('#tab-clinical').evaluate(node => node.classList.contains('active')), 'Clinical research should lead directly to patient care.');

  await page.evaluate(() => window.saveAndReturnLater());
  assert(await page.evaluate(() => Boolean(localStorage.getItem('KMU_APPRAISAL_DRAFT_v4'))), 'Explicit save failed.');
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.locator('#draftResumeButton').isVisible(), 'Saved draft should offer explicit resume.');
  await page.locator('#draftResumeButton').click();
  assert(await page.locator('.teaching-course-card').count() === 4, 'Courses were not restored.');
  assert(await page.locator('.research-output-card').count() === 4, 'Papers were not restored.');
  await page.evaluate(() => localStorage.clear());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), 'Mobile layout scrolls horizontally.');
  assert(errors.length === 0, `Browser errors:\n${errors.join('\n')}`);
  console.log('PASS: course average, research caps, reporting line, clinical flow, committee gate, PDF scales, persistence and mobile layout.');
  await browser.close();
  await new Promise(resolve => server.close(resolve));
})().catch(error => { console.error(error.stack || error); process.exit(1); });

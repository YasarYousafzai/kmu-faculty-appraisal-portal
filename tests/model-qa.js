const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const sandbox = {
  window: { addEventListener() {} },
  document: { addEventListener() {} },
  console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'app.js' });
const { PROFILES, calculatePilotScenario, classifyScore, benchmarkState,
  averageStudentReviews, paperPilotPoints, allocateSelectedPaperPoints, scoreResearchPilot } = sandbox.window.KMUCalculator;

for (const profile of Object.values(PROFILES)) {
  assert.equal(profile.teachingWeight + profile.researchWeight + profile.serviceWeight
    + profile.peerWeight + profile.clinicalWeight, 100, `${profile.name} weights`);
  assert.equal('researchBenchmark' in profile, false, 'Obsolete quantity benchmark must not drive the research score');
}
assert.equal(classifyScore(84.96).rating, 'Outstanding');
assert.equal(benchmarkState(79.9, true), 'low');
assert.equal(benchmarkState(80, true), 'high');
assert.equal(benchmarkState(100, false), 'pending');
assert.equal(averageStudentReviews([80, 90]), 85, 'Course reviews should be an unweighted arithmetic mean.');
assert.equal(averageStudentReviews([80, 90, 100]), 90);
assert.equal(averageStudentReviews([]), 0);
assert.equal(paperPilotPoints(6, 'first', 'Y'), 20);
assert.equal(paperPilotPoints(6, 'corresponding', 'Y'), 20, 'First and corresponding authors share the lead rate.');
assert.equal(paperPilotPoints(3, 'co', 'Y'), 8);
assert.equal(paperPilotPoints(0.5, 'first', 'Y'), 8);
assert.equal(paperPilotPoints(6, 'first', 'N'), 0, 'Unverified indexing must not score.');
assert.equal(allocateSelectedPaperPoints([20, 20, 20]).total, 50, 'Three strong papers reach the publication cap.');
assert.equal(allocateSelectedPaperPoints(Array(10).fill(8)).total, 24,
  'Ten low-band papers must not overwhelm the three-paper cap.');
assert.equal(allocateSelectedPaperPoints([20, 8, 20, 8]).total, 48,
  'A fourth lower-scoring paper must not inflate the selected-paper score.');
const researchCase = (paperScores, booksRaw = 0, milestone = 0, grantStatuses = [], supervisionRaw = 0, innovationRaw = 0) =>
  scoreResearchPilot({ paperScores, booksRaw, milestone, grantStatuses, supervisionRaw, innovationRaw });
assert.equal(researchCase([20, 20, 20], 0, 25, [], 10, 10).score, 95,
  'No annual book or grant should be required for a strong research score.');
assert.equal(researchCase([20, 8, 20], 0, 20, [], 4, 0).score, 72);
assert.equal(researchCase([20, 8, 20], 5, 20, ['Won'], 4, 0).score, 82);
assert.equal(researchCase([20, 8, 20], 0, 25, ['Won'], 0, 0).score, 73,
  'A grant bonus must remain inside the 25-point execution ceiling.');
assert.equal(researchCase([20, 20, 20], 100, 25, ['Won'], 100, 100).score, 100,
  'Each research category must cap at its stated maximum.');

const scenario = (profile, teaching, research, service, officer, clinical = 0) =>
  calculatePilotScenario(profile, { teaching, research, service, officer, clinical });
const weak = scenario('Balanced Profile', 45, 10, 20, 40);
const teachingOnly = scenario('Balanced Profile', 95, 18, 10, 45);
const mixed = scenario('Balanced Profile', 70, 45, 50, 65);
const strong = scenario('Balanced Profile', 90, 85, 80, 85);
assert(weak.score < teachingOnly.score && teachingOnly.score < mixed.score && mixed.score < strong.score,
  'Synthetic weak, single-domain, mixed and strong performances should be distinguishable');
assert.equal(strong.rating, 'Outstanding');

const sameOtherDomainsLowResearch = scenario('Balanced Profile', 80, 25, 65, 75);
const sameOtherDomainsHighResearch = scenario('Balanced Profile', 80, 85, 65, 75);
assert.equal(sameOtherDomainsHighResearch.score - sameOtherDomainsLowResearch.score, 18,
  'A 60-point research quality gap must move a balanced overall score by 18 points');
assert.equal(scenario('Balanced Profile', 100, 999, 100, 100).researchAttainment, 100,
  'Research attainment must cap at 100');

const clinical = scenario('Clinical-Focused Profile (Hospital Faculty)', 80, 60, 70, 85, 90);
const researcher = scenario('Research Cadres / Postdocs', 75, 90, 65, 85);
assert(clinical.score >= 80 && researcher.score >= 85,
  'Main-duty strengths should contribute under clinical and research-cadre mixes');

console.log('PASS: profile totals, course means, paper bands/caps, grant/book limits and synthetic discrimination.');

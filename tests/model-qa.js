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
const { PROFILES, calculatePilotScenario, classifyScore, benchmarkState } = sandbox.window.KMUCalculator;

for (const profile of Object.values(PROFILES)) {
  assert.equal(profile.teachingWeight + profile.researchWeight + profile.serviceWeight
    + profile.peerWeight + profile.clinicalWeight, 100, `${profile.name} weights`);
  assert.equal('researchBenchmark' in profile, false, 'Obsolete quantity benchmark must not drive the research score');
}
assert.equal(classifyScore(84.96).rating, 'Outstanding');
assert.equal(benchmarkState(79.9, true), 'low');
assert.equal(benchmarkState(80, true), 'high');
assert.equal(benchmarkState(100, false), 'pending');

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

console.log('PASS: five profile totals, scoring boundaries, capped research, and synthetic discrimination.');

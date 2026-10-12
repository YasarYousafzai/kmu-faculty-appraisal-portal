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
  weightedStudentReviews, calculateTeachingAttainment, paperPilotPoints, scorePublicationCounts,
  scoreGrantCounts, scoreResearchOriginal, getTeachingLoad } = sandbox.window.KMUCalculator;

function mockTeachingCards(records) {
  sandbox.document.querySelectorAll = selector => {
    assert.equal(selector, '.teaching-course-card');
    return records.map(record => ({
      querySelectorAll: () => Object.entries(record).map(([courseField, value]) => ({
        dataset: { courseField }, value: String(value)
      }))
    }));
  };
}
const blankCourse = { title: '', code: '', specialty: '', theory: '0', practical: '0',
  review: '', term: '', level: '' };
mockTeachingCards([blankCourse, blankCourse, blankCourse]);
let teachingLoad = getTeachingLoad();
assert.equal(teachingLoad.entered.length, 0, 'Default zero-credit course cards are not actual entries.');
assert.equal(teachingLoad.issues.length, 0, 'Untouched course cards must not show completion errors.');
assert.equal(teachingLoad.hasEntry, false, 'Untouched course cards cannot satisfy teaching evidence.');
mockTeachingCards([blankCourse, { ...blankCourse, title: 'Anatomy' }, blankCourse]);
teachingLoad = getTeachingLoad();
assert.equal(teachingLoad.issues.length, 1, 'A partially entered course must still be flagged.');
assert.match(teachingLoad.issues[0], /course 2/, 'The error should identify the actual course card.');
mockTeachingCards([{ ...blankCourse, title: 'Anatomy', code: 'ANAT-301',
  specialty: 'Anatomy', theory: '1', review: '80', term: 'Semester 3',
  level: 'Undergraduate' }, blankCourse, blankCourse]);
teachingLoad = getTeachingLoad();
assert.equal(teachingLoad.issues.length, 0, 'Blank starter cards should not invalidate a completed course.');
assert.equal(teachingLoad.courseCount, 1);
assert.equal(teachingLoad.creditsTaught, 1);
assert.equal(teachingLoad.reviewAverage, 80);

for (const profile of Object.values(PROFILES)) {
  assert.equal(profile.teachingWeight + profile.researchWeight + profile.serviceWeight
    + profile.peerWeight + profile.clinicalWeight, 100, `${profile.name} weights`);
  assert.equal('researchBenchmark' in profile, false, 'Obsolete quantity benchmark must not drive the research score');
}
assert.equal(classifyScore(84.96).rating, 'Outstanding');
assert.equal(benchmarkState(79.9, true), 'low');
assert.equal(benchmarkState(80, true), 'high');
assert.equal(benchmarkState(100, false), 'pending');
assert.equal(weightedStudentReviews([
  { theory: 1, practical: 0, review: 90 },
  { theory: 1, practical: 1, review: 70 }
]), 75, 'A 1+1 course must carry three times the contact-hour weight of a 1+0 course.');
assert.equal(weightedStudentReviews([
  { theory: 2, practical: 0, review: 80 },
  { theory: 0, practical: 1, review: 100 }
]), 90, 'One practical credit represents 32 hours, equivalent to two theory credits.');
assert.equal(weightedStudentReviews([]), 0, 'No courses must not divide by zero.');
assert.equal(weightedStudentReviews([{ theory: 0, practical: 0, review: 90 }]), 0,
  'A zero-credit course must not contribute a score or divide by zero.');
const professorTeaching = calculateTeachingAttainment(82.5, 3, 'Professor');
assert.equal(professorTeaching.perSemesterTarget, 3);
assert.equal(professorTeaching.annualTarget, 6);
assert.equal(professorTeaching.loadFactor, 0.5);
assert.equal(professorTeaching.score, 41.25, 'Half the annual pilot credit load halves the teaching review mean.');
assert.equal(calculateTeachingAttainment(82.5, 6, 'Professor').score, 82.5);
assert.equal(calculateTeachingAttainment(82.5, 12, 'Professor').score, 82.5,
  'Teaching above the annual pilot target must not exceed a 100% workload factor.');
assert.equal(calculateTeachingAttainment(82.5, 3, 'Professor', true).score, 82.5,
  'A declared approved exemption waives provisional workload proration.');
assert.equal(calculateTeachingAttainment(82.5, 3, 'Lecturer').annualTarget, 24);
assert.equal(calculateTeachingAttainment(82.5, 3, 'Meritorious Professor').annualTarget, 6);
assert.equal(calculateTeachingAttainment(82.5, 3, 'Senior Registrar').annualTarget, null,
  'Do not invent an HEC rank target for clinical designations.');
assert.equal(paperPilotPoints(6, 'first', 'Y'), 10);
assert.equal(paperPilotPoints(6, 'corresponding', 'Y'), 10, 'First and corresponding authors share the lead rate.');
assert.equal(paperPilotPoints(3, 'co', 'Y'), 3);
assert.equal(paperPilotPoints(0.5, 'first', 'Y'), 4);
assert.equal(paperPilotPoints(6, 'first', 'N'), 0, 'Unverified indexing must not score.');
const threeHighLead = scorePublicationCounts({ input_pub_high_lead: 3 });
assert.equal(threeHighLead.raw, 30);
assert.equal(threeHighLead.total, 30);
assert.equal(scoreResearchOriginal({ publicationsRaw: threeHighLead.raw }).score, 15,
  'Original /200 denominator means three high-IF lead papers earn 15% research attainment.');
assert.equal(scorePublicationCounts({ input_pub_high_lead: 6 }).total, 50,
  'Six high-IF lead papers reach the original B1 cap.');
assert.equal(scorePublicationCounts({ input_pub_mod_co: 10 }).total, 30,
  'All declared eligible papers count until the original B1 cap, not just the best three.');
const applications = scoreGrantCounts({ input_grant_applied: 11 });
assert.equal(applications.applicationsRaw, 20, 'Competitive applications have a 20-point subcap.');
assert.equal(scoreGrantCounts({ input_grant_int_pi: 4 }).total, 50,
  'Original B3 total is capped at 50.');
assert.equal(scoreResearchOriginal({ publicationsRaw: 60, booksRaw: 24, grantsRaw: 60,
  supervisionRaw: 48, innovationRaw: 50 }).score, 100,
  'The original B1–B5 caps total 200 raw points.');
assert.equal(scoreResearchOriginal({ publicationsRaw: 30, grantsRaw: 8 }).score, 19,
  'One national PI grant adds eight raw points or four research percentage points.');

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

console.log('PASS: profile totals, credit-weighted reviews, provisional rank targets, original B1–B5 scoring and synthetic discrimination.');

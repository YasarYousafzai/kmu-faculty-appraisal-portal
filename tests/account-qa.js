'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'account.js'), 'utf8');
let readyCallback = null;
let networkCalls = 0;
const draft = {
  schemaVersion: 5,
  configVersion: 'PILOT',
  profile: 'Balanced Profile',
  manualProfileOverride: false,
  meta: {
    name: 'Fictional Faculty', desig: 'Assistant Professor', dept: 'KMU unit', cadre: 'BPS',
    cycle: 'Calendar Year 2026', appraiser: 'Head of Department', reviewer: 'Additional Director HR',
    finalAuthority: 'Vice Chancellor', committeeMember1: 'Fictional Committee Member',
    clinicalEvidenceRef: ''
  },
  values: { input_actual_wu: '99', input_pub_high_lead: '1', input_clin_admin: '80', input_reviewer_secret: 'No' },
  teachingCourses: [{ title: 'Fictional course', theory: '1', practical: '0', review: '85' }],
  research: { text: { input_publications_ref: 'https://scholar.google.com/example', input_research_review_ref: 'Never' },
    complete: true, reviewConfirmed: true },
  reviewStage: { reviewerName: 'Never upload', objectiveSubmitted: true },
  sectionD: { peerScores: { peer_1: 6 }, cpdScores: { cpd_1: 2 } },
  targets: { input_target_pubs: 'Never upload' },
  redFlag: { penalty: '50', reference: 'Never upload' },
  wuExempted: 'N', serviceComplete: true, serviceAdditionalAppointment: 'N'
};
const context = {
  window: { KMUCalculator: {
    calculate() {}, collectDraft: () => draft,
    lastResult: { objectiveReady: true, weightedA: 20, weightedB: 5,
      weightedC: 10, weightedE: 0, objectivePercent: 43.75 }
  } },
  document: {
    body: { dataset: {} },
    getElementById: () => null,
    addEventListener(type, callback) { if (type === 'DOMContentLoaded') readyCallback = callback; }
  },
  appraisalState: { activeWeights: { teaching: 30, research: 30, service: 20, clinical: 0 } },
  NUMERIC_INPUT_IDS: ['input_actual_wu', 'input_pub_high_lead', 'input_clin_admin'],
  Blob, Date, fetch: async () => { networkCalls += 1; throw new Error('No network expected'); },
  console
};
vm.runInNewContext(source, context, { filename: 'account.js' });
assert.ok(readyCallback, 'Account initialization must be registered');
readyCallback();
assert.equal(networkCalls, 0, 'Opening the portal must not upload or fetch a legacy local draft');
assert.equal(context.window.KMUAccount.backendVerified, true,
  'Account UI is enabled only after the pilot schema and RLS suite pass');
const account = context.window.KMUAccount;
account.mode = 'assessee';
assert.equal(account.canOpenTab('tab-summary'), false, 'Faculty cannot open an unreviewed final report');
account.selectedCaseId = 'case-1'; account.selectedCaseStatus = 'reviewed';
assert.equal(account.canOpenTab('tab-summary'), false, 'Faculty final report must wait for an RLS-loaded review');
account.reviewLoaded = true;
assert.equal(account.canOpenTab('tab-summary'), true, 'Faculty may read their completed report');
assert.equal(account.canOpenTab('tab-peer'), false, 'Faculty cannot edit assessor scoring');
account.mode = 'assessor'; account.selectedCaseStatus = 'submitted';
assert.equal(account.canOpenTab('tab-peer'), true, 'Assigned assessor can open review stage');
account.selectedCaseId = null;
assert.equal(account.canOpenTab('tab-peer'), false, 'Assessor cannot open review without an assigned case');
account.mode = 'demo';

const payload = context.window.KMUAccount.buildObjectivePayload();
assert.deepEqual(Object.keys(payload).sort(), [
  'schemaVersion', 'configVersion', 'profile', 'manualProfileOverride', 'meta',
  'values', 'teachingCourses', 'research', 'wuExempted', 'serviceComplete',
  'serviceAdditionalAppointment', 'provisional'
].sort());
assert.equal(payload.meta.name, 'Fictional Faculty');
assert.equal(payload.meta.appraiser, 'Head of Department');
assert.equal(payload.meta.reviewer, 'Additional Director HR');
assert.equal(payload.meta.finalAuthority, 'Vice Chancellor');
assert.equal(payload.meta.committeeMember1, 'Fictional Committee Member');
assert.equal(payload.values.input_actual_wu, undefined);
assert.equal(payload.values.input_reviewer_secret, undefined);
assert.equal(payload.research.text.input_research_review_ref, undefined);
assert.equal(payload.research.reviewConfirmed, undefined);
assert.equal(payload.provisional.ready, true);
assert.equal(payload.provisional.source, 'faculty self-entry — unverified');
for (const marker of ['Never upload', 'input_reviewer_secret']) {
  assert.equal(JSON.stringify(payload).includes(marker), false, `Objective payload leaked ${marker}`);
}
assert.equal(networkCalls, 0, 'Calculating an objective payload must not upload it automatically');
console.log('Account QA passed: verified backend flag, no auto-upload, objective-only allowlist and final report gate.');

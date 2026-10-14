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

function authHarness(hash) {
  const ids = ['accountGuest', 'accountSignedIn', 'accountPasswordSetup', 'accountPasswordSetupIntro',
    'accountPasswordSetupForm', 'accountNewPassword', 'accountConfirmPassword', 'accountMessage',
    'accountStatus', 'accountModeBadge', 'accountEmail', 'accountPassword', 'accountDisplayName',
    'accountSignUp', 'accountRecover'];
  const nodes = Object.fromEntries(ids.map(id => [id, {
    hidden: false, textContent: '', value: '', className: '', disabled: false, handlers: {},
    addEventListener(type, callback) { this.handlers[type] = callback; }
  }]));
  let onReady = null;
  const calls = [];
  const location = { hash, pathname: '/kmu-faculty-appraisal-portal/', search: '?v=pilot' };
  const user = { id: 'user-1', email: 'invited@example.edu.pk' };
  const localContext = {
    window: {
      location,
      history: { state: null, replaceState(_state, _unused, path) {
        assert.equal(path, '/kmu-faculty-appraisal-portal/?v=pilot'); location.hash = '';
      } },
      KMUCalculator: { calculate() {}, loadBlank() {} }
    },
    document: {
      body: { dataset: {} }, getElementById: id => nodes[id] || null,
      addEventListener(type, callback) { if (type === 'DOMContentLoaded') onReady = callback; }
    },
    URLSearchParams, Blob, Date, NUMERIC_INPUT_IDS: [], appraisalState: { activeWeights: null },
    fetch: async (url, options) => {
      calls.push({ url, options });
      let result;
      if (url.endsWith('/auth/v1/user') && options.method === 'GET') result = user;
      else if (url.endsWith('/auth/v1/user') && options.method === 'PUT') result = user;
      else if (url.includes('grant_type=password')) result = { access_token: 'fresh-token', refresh_token: 'fresh-refresh', user };
      else if (url.includes('/auth/v1/signup')) result = user;
      else if (url.includes('/rest/v1/')) result = [];
      else if (url.includes('/auth/v1/recover')) result = {};
      else throw new Error(`Unexpected account request: ${url}`);
      return { ok: true, status: 200, text: async () => JSON.stringify(result) };
    },
    console
  };
  vm.runInNewContext(source, localContext, { filename: 'account.js' });
  return { nodes, calls, location, user, account: localContext.window.KMUAccount,
    ready: () => onReady(), tick: () => new Promise(resolve => setImmediate(resolve)) };
}

(async () => {
  const invited = authHarness('#access_token=invite-secret&refresh_token=refresh-secret&token_type=bearer&type=invite');
  assert.equal(invited.location.hash, '', 'Invite tokens must be removed synchronously before network work');
  assert.equal(invited.calls.length, 0, 'Opening a link must not auto-upload local drafts');
  invited.ready(); await invited.tick();
  assert.equal(invited.calls[0].url.endsWith('/auth/v1/user'), true, 'Invite identity must be verified with Supabase');
  assert.equal(invited.calls[0].options.headers.Authorization, 'Bearer invite-secret');
  assert.equal(invited.nodes.accountPasswordSetup.hidden, false, 'Invite should show password setup');
  assert.equal(invited.nodes.accountSignedIn.hidden, true, 'Invite token alone must not open a workspace');
  invited.nodes.accountNewPassword.value = 'first-password';
  invited.nodes.accountConfirmPassword.value = 'different-password';
  await invited.nodes.accountPasswordSetupForm.handlers.submit({ preventDefault() {} });
  assert.equal(invited.calls.some(call => call.options.method === 'PUT'), false, 'Mismatched passwords must not be sent');
  assert.equal(invited.nodes.accountNewPassword.value, '', 'Failed setup must clear password input');
  assert.equal(invited.nodes.accountConfirmPassword.value, '', 'Failed setup must clear confirmation input');
  invited.nodes.accountNewPassword.value = 'new-secure-password';
  invited.nodes.accountConfirmPassword.value = 'new-secure-password';
  await invited.nodes.accountPasswordSetupForm.handlers.submit({ preventDefault() {} });
  const put = invited.calls.find(call => call.url.endsWith('/auth/v1/user') && call.options.method === 'PUT');
  assert.ok(put, 'Password setup must call authenticated Supabase update-user endpoint');
  assert.equal(put.options.headers.Authorization, 'Bearer invite-secret');
  assert.equal(JSON.parse(put.options.body).password, 'new-secure-password');
  const signIn = invited.calls.find(call => call.url.includes('grant_type=password'));
  assert.ok(signIn, 'A fresh password session must be established after setup');
  assert.equal(JSON.parse(signIn.options.body).email, invited.user.email);
  assert.equal(invited.account.session.access_token, 'fresh-token', 'Callback token must be replaced');
  assert.equal(invited.account.mode, 'assessee', 'An invite cannot self-grant assessor/admin roles');
  assert.equal(invited.nodes.accountNewPassword.value, '', 'Successful setup must clear password input');
  assert.equal(invited.nodes.accountConfirmPassword.value, '', 'Successful setup must clear confirmation input');
  assert.equal(invited.location.hash, '', 'Credential fragment must stay cleared');
  assert.equal(invited.calls.some(call => call.url.includes('/rpc/') || call.url.includes('objective_payload')), false,
    'Invite completion must not upload legacy drafts or case data');

  const recovered = authHarness('#access_token=recovery-secret&refresh_token=recovery-refresh&type=recovery');
  recovered.ready(); await recovered.tick();
  assert.equal(recovered.nodes.accountPasswordSetup.hidden, false, 'Recovery should show the same secure password form');
  assert.match(recovered.nodes.accountPasswordSetupIntro.textContent, /Password-reset link verified/);

  const expired = authHarness('#error=access_denied&error_code=otp_expired&error_description=Sensitive-detail');
  assert.equal(expired.location.hash, '', 'Error fragments must also be cleared synchronously');
  expired.ready(); await expired.tick();
  assert.equal(expired.calls.length, 0, 'An expired callback must not make authenticated requests');
  assert.match(expired.nodes.accountMessage.textContent, /invalid, expired, or already used/);
  assert.equal(expired.nodes.accountMessage.textContent.includes('Sensitive-detail'), false,
    'URL error details should not be reflected into the page');

  const ordinary = authHarness(''); ordinary.ready(); ordinary.nodes.accountEmail.value = 'reset@example.edu.pk';
  ordinary.nodes.accountPassword.value = 'old-password';
  await ordinary.nodes.accountRecover.handlers.click({ preventDefault() {} });
  assert.equal(ordinary.nodes.accountPassword.value, '', 'Recovery request must clear the sign-in password input');
  assert.ok(ordinary.calls[0].url.includes('/auth/v1/recover?redirect_to='), 'Recovery email request must use the auth API');
  assert.equal(JSON.parse(ordinary.calls[0].options.body).email, 'reset@example.edu.pk');
  ordinary.nodes.accountEmail.value = 'new@example.edu.pk';
  ordinary.nodes.accountPassword.value = 'signup-password';
  ordinary.nodes.accountDisplayName.value = 'Pilot Faculty';
  await ordinary.nodes.accountSignUp.handlers.click({ preventDefault() {} });
  assert.ok(ordinary.calls.some(call => call.url.includes('/auth/v1/signup?redirect_to=')),
    'Confirmation-required signup must use the allow-listed portal redirect');
  assert.match(ordinary.nodes.accountMessage.textContent, /Check your email for a confirmation link/);
  assert.equal(ordinary.nodes.accountPassword.value, '', 'Signup must clear the password input');
  console.log('Account QA passed: objective allowlist, no auto-upload, secure invite/recovery setup and final report gate.');
})().catch(error => { console.error(error); process.exitCode = 1; });

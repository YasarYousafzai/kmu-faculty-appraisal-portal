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
  values: { input_actual_wu: '99', input_pub_high_lead: '1', input_clin_admin: '80',
    input_clin_opd_sessions: '120', input_clin_patient_contact_hours: '480.5', input_reviewer_secret: 'No' },
  teachingCourses: [{ title: 'Annual MBBS module', code: '', term: 'MBBS Annual Year 3',
    level: 'MBBS', specialty: 'Medicine', theory: '0', practical: '0', hospitalHours: '64', review: '85' }],
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
  NUMERIC_INPUT_IDS: ['input_actual_wu', 'input_pub_high_lead', 'input_clin_admin',
    'input_clin_opd_sessions', 'input_clin_patient_contact_hours'],
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
assert.equal(account.canOpenTab('tab-teaching'), false,
  'A signed-in employee cannot enter an appraisal until a case is explicitly opened');
account.caseOpen = true;
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
account.caseOpen = false;
assert.equal(account.canOpenTab('tab-teaching'), false,
  'An assessor without an opened assignment cannot browse the appraisal form');
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
assert.equal(payload.values.input_clin_opd_sessions, '120');
assert.equal(payload.values.input_clin_patient_contact_hours, '480.5');
assert.equal(payload.teachingCourses[0].hospitalHours, '64');
assert.equal(payload.teachingCourses[0].code, '');
assert.equal(payload.research.text.input_research_review_ref, undefined);
assert.equal(payload.research.reviewConfirmed, undefined);
assert.equal(payload.provisional.ready, true);
assert.equal(payload.provisional.source, 'faculty self-entry — unverified');
for (const marker of ['Never upload', 'input_reviewer_secret']) {
  assert.equal(JSON.stringify(payload).includes(marker), false, `Objective payload leaked ${marker}`);
}
assert.equal(networkCalls, 0, 'Calculating an objective payload must not upload it automatically');

function authHarness(hash, scenario = {}) {
  const ids = ['accountGuest', 'accountSignedIn', 'accountPasswordSetup', 'accountPasswordSetupIntro',
    'accountPasswordSetupForm', 'accountNewPassword', 'accountConfirmPassword', 'accountMessage',
    'accountStatus', 'accountModeBadge', 'accountEmail', 'accountPassword', 'accountDisplayName',
    'accountShowSignUp', 'accountShowSignIn', 'accountSignUpPanel', 'accountSignInPanel',
    'accountSignupForm', 'accountSignupEmail', 'accountSignupPassword', 'accountSignupConfirmPassword',
    'accountSignUp', 'accountRecover', 'accountForm', 'accountSignOut', 'accountNewCase',
    'accountSaveProfile', 'accountSyncDraftProfile',
    'accountAssesseeMode', 'accountAssessorMode', 'accountAdminMode', 'accountCasePanel',
    'accountQueuePanel', 'accountAdminPanel', 'accountProfileSyncNotice', 'employeeProfileStatus',
    'employeeProfileSaveMessage',
    'appraisalWorkspace', 'stageBanner', 'profileSnapshotNotice', 'myCaseList', 'assessorQueue',
    'accountDesignation', 'accountLeadershipRole', 'accountInstitute', 'accountCadre',
    'accountScholarIdentifier',
    'profileDisplayName', 'profileDesignation', 'profileLeadershipRole', 'profileInstitute',
    'profileServiceCadre', 'profileScholarIdentifier', 'input_emp_name', 'input_emp_desig', 'input_leadership_role',
    'input_emp_dept', 'input_emp_cadre'];
  const nodes = Object.fromEntries(ids.map(id => [id, {
    hidden: false, textContent: '', value: '', className: '', disabled: false, handlers: {},
    dataset: {}, children: [], options: [], classList: { toggle() {} },
    addEventListener(type, callback) { this.handlers[type] = callback; },
    replaceChildren(...children) { this.children = children; },
    querySelectorAll() { return []; }
  }]));
  function choices(id, values) {
    nodes[id].options = values.map(value => ({ value, cloneNode() { return { value }; } }));
    nodes[id].children = nodes[id].options;
  }
  choices('input_emp_desig', ['', 'Professor', 'Associate Professor', 'Lecturer']);
  choices('input_leadership_role', ['None', 'Dean of Faculty']);
  choices('input_emp_dept', ['', 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar']);
  choices('input_emp_cadre', ['', 'BPS', 'TTS', 'Fixed Pay']);
  nodes.accountLeadershipRole.value = 'None';
  nodes.profileLeadershipRole.value = 'None';
  let onReady = null;
  const calls = [];
  const appliedProfiles = [];
  const location = { hash, pathname: '/kmu-faculty-appraisal-portal/', search: '?v=pilot' };
  const user = { id: 'user-1', email: 'invited@example.edu.pk' };
  const profile = {
    id: user.id, display_name: 'Registered Faculty', substantive_designation: 'Professor',
    leadership_role: 'None',
    institute: 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar',
    service_cadre: 'BPS', scholar_identifier: '0000-0002-1825-0097',
    profile_updated_at: '2026-10-15T00:00:00Z'
  };
  let currentProfileRows = scenario.profileRows ?? [profile];
  const localContext = {
    window: {
      location,
      history: { state: null, replaceState(_state, _unused, path) {
        assert.equal(path, '/kmu-faculty-appraisal-portal/?v=pilot'); location.hash = '';
      } },
      KMUCalculator: {
        calculate() {}, loadBlank() {},
        applyEmployeeProfile(value) {
          appliedProfiles.push(value);
          nodes.input_emp_name.value = value.display_name;
          nodes.input_emp_desig.value = value.substantive_designation;
          nodes.input_leadership_role.value = value.leadership_role;
          nodes.input_emp_dept.value = value.institute;
          nodes.input_emp_cadre.value = value.service_cadre;
        }
      },
      switchTab() {}
    },
    document: {
      body: { dataset: {} }, getElementById: id => nodes[id] || null,
      addEventListener(type, callback) { if (type === 'DOMContentLoaded') onReady = callback; }
    },
    URLSearchParams, Blob, Date, NUMERIC_INPUT_IDS: [], appraisalState: { activeWeights: null },
    confirm: () => true,
    fetch: async (url, options) => {
      calls.push({ url, options });
      const override = await scenario.fetchOverride?.({ url, options });
      if (override) return override;
      let result;
      if (url.endsWith('/auth/v1/user') && options.method === 'GET') result = user;
      else if (url.endsWith('/auth/v1/user') && options.method === 'PUT') result = user;
      else if (url.includes('grant_type=password')) result = { access_token: 'fresh-token', refresh_token: 'fresh-refresh', user };
      else if (url.includes('/auth/v1/signup')) result = user;
      else if (url.includes('/rest/v1/app_user_profiles')) {
        if (scenario.profileError) return { ok: false, status: 403,
          text: async () => JSON.stringify({ message: 'Profile access denied' }) };
        result = currentProfileRows;
      }
      else if (url.includes('/rest/v1/rpc/save_employee_profile_with_scholar')) {
        if (scenario.profileSaveError) return { ok: false, status: 400,
          text: async () => JSON.stringify({ message: 'Profile save rejected' }) };
        const submitted = JSON.parse(options.body);
        result = {
          id: user.id, display_name: submitted.p_display_name,
          substantive_designation: submitted.p_substantive_designation,
          leadership_role: submitted.p_leadership_role,
          institute: submitted.p_institute, service_cadre: submitted.p_service_cadre,
          scholar_identifier: submitted.p_scholar_identifier
        };
        if (!scenario.profileSaveNotPersisted) currentProfileRows = [result];
      }
      else if (url.includes('/rest/v1/app_assessors')) result = scenario.assessor ? [{ user_id: user.id }] : [];
      else if (url.includes('/rest/v1/app_administrators')) result = scenario.administrator ? [{ user_id: user.id }] : [];
      else if (url.includes('/rest/v1/')) result = [];
      else if (url.includes('/auth/v1/recover')) result = {};
      else throw new Error(`Unexpected account request: ${url}`);
      return { ok: true, status: 200, text: async () => JSON.stringify(result) };
    },
    console
  };
  vm.runInNewContext(source, localContext, { filename: 'account.js' });
  return { nodes, calls, location, user, profile, appliedProfiles, account: localContext.window.KMUAccount,
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
  assert.equal(ordinary.nodes.accountSignUpPanel.hidden, false, 'New-user signup is visible by default');
  assert.equal(ordinary.nodes.accountSignInPanel.hidden, true, 'Sign-in is a separate path');
  await ordinary.nodes.accountShowSignIn.handlers.click({ preventDefault() {} });
  assert.equal(ordinary.nodes.accountSignInPanel.hidden, false, 'Existing users can open sign-in');
  ordinary.nodes.accountPassword.value = 'old-password';
  await ordinary.nodes.accountRecover.handlers.click({ preventDefault() {} });
  assert.equal(ordinary.nodes.accountPassword.value, '', 'Recovery request must clear the sign-in password input');
  assert.ok(ordinary.calls[0].url.includes('/auth/v1/recover?redirect_to='), 'Recovery email request must use the auth API');
  assert.equal(JSON.parse(ordinary.calls[0].options.body).email, 'reset@example.edu.pk');
  await ordinary.nodes.accountShowSignUp.handlers.click({ preventDefault() {} });
  assert.equal(ordinary.nodes.accountSignUpPanel.hidden, false, 'New users can open their own registration form');
  ordinary.nodes.accountSignupEmail.value = 'new@example.edu.pk';
  ordinary.nodes.accountSignupPassword.value = 'signup-password';
  ordinary.nodes.accountSignupConfirmPassword.value = 'wrong-password';
  ordinary.nodes.accountDisplayName.value = 'Pilot Faculty';
  ordinary.nodes.accountDesignation.value = 'Professor';
  ordinary.nodes.accountLeadershipRole.value = 'None';
  ordinary.nodes.accountInstitute.value = 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar';
  ordinary.nodes.accountCadre.value = 'BPS';
  ordinary.nodes.accountScholarIdentifier.value = 'https://scholar.google.com/citations?user=fictional';
  await ordinary.nodes.accountSignupForm.handlers.submit({ preventDefault() {} });
  assert.equal(ordinary.calls.filter(call => call.url.includes('/auth/v1/signup')).length, 0,
    'Mismatched passwords must not create an account');
  assert.match(ordinary.nodes.accountMessage.textContent, /two passwords do not match/i);
  ordinary.nodes.accountSignupPassword.value = 'signup-password';
  ordinary.nodes.accountSignupConfirmPassword.value = 'signup-password';
  await ordinary.nodes.accountSignupForm.handlers.submit({ preventDefault() {} });
  const signup = ordinary.calls.find(call => call.url.includes('/auth/v1/signup?redirect_to='));
  assert.ok(signup,
    'Confirmation-required signup must use the allow-listed portal redirect');
  const signupBody = JSON.parse(signup.options.body);
  assert.deepEqual(signupBody.data, {
    display_name: 'Pilot Faculty', substantive_designation: 'Professor', leadership_role: 'None',
    institute: 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar', service_cadre: 'BPS',
    scholar_identifier: 'https://scholar.google.com/citations?user=fictional'
  }, 'Job-related details should be captured at registration, without any assessor or administrator role');
  assert.equal(Object.hasOwn(signupBody.data, 'role'), false, 'The user cannot self-select an account role');
  assert.match(ordinary.nodes.accountMessage.textContent, /Check your email for a confirmation link/);
  assert.equal(ordinary.nodes.accountSignInPanel.hidden, false, 'Registration leads to the existing-user sign-in path');
  assert.equal(ordinary.nodes.accountEmail.value, 'new@example.edu.pk', 'Registration carries the email to sign-in');
  assert.equal(ordinary.nodes.accountSignupPassword.value, '', 'Signup must clear the password input');
  assert.equal(ordinary.nodes.accountSignupConfirmPassword.value, '', 'Signup must clear the confirmation input');

  const limited = authHarness('', { fetchOverride: ({ url }) => {
    if (!url.includes('/auth/v1/signup')) return null;
    return { ok: false, status: 429, text: async () => JSON.stringify({
      error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded'
    }) };
  } });
  limited.ready();
  limited.nodes.accountSignupEmail.value = 'limited@example.edu.pk';
  limited.nodes.accountSignupPassword.value = 'signup-password';
  limited.nodes.accountSignupConfirmPassword.value = 'signup-password';
  limited.nodes.accountDisplayName.value = 'Pilot Faculty';
  limited.nodes.accountDesignation.value = 'Professor';
  limited.nodes.accountLeadershipRole.value = 'None';
  limited.nodes.accountInstitute.value = 'KMU Institute of Basic Medical Sciences (KMU-IBMS), Peshawar';
  limited.nodes.accountCadre.value = 'BPS';
  await limited.nodes.accountSignupForm.handlers.submit({ preventDefault() {} });
  assert.match(limited.nodes.accountMessage.textContent, /pilot email service has reached its sending limit/i,
    'Email quota errors should explain the service problem rather than suggest a profile correction');
  assert.match(limited.nodes.accountMessage.textContent, /do not keep retrying/i);
  assert.equal(limited.nodes.accountSignupPassword.value, '', 'Failed signup must clear the password input');
  assert.equal(limited.calls.filter(call => call.url.includes('/auth/v1/signup')).length, 1,
    'The portal must not retry a rate-limited signup automatically');

  const signed = authHarness(''); signed.ready();
  signed.nodes.accountEmail.value = signed.user.email;
  signed.nodes.accountPassword.value = 'portal-password';
  await signed.nodes.accountForm.handlers.submit({ preventDefault() {} });
  assert.equal(signed.account.mode, 'assessee', 'Valid sign-in opens the employee portal');
  assert.equal(signed.account.profileComplete, true, 'The saved employee profile is loaded');
  assert.equal(signed.account.profile.id, signed.user.id, 'Loaded profile belongs to signed-in user');
  assert.equal(signed.nodes.profileDisplayName.value, 'Registered Faculty', 'Profile edit form is hydrated');
  assert.equal(signed.nodes.profileScholarIdentifier.value, '0000-0002-1825-0097',
    'The scholarly identifier is hydrated from the saved employee profile.');
  assert.equal(signed.account.caseOpen, false, 'Sign-in must not silently open or upload an appraisal');
  assert.equal(signed.nodes.appraisalWorkspace.hidden, true, 'Employee dashboard hides the appraisal until a case opens');
  assert.equal(signed.appliedProfiles.length, 0, 'No registration data is copied into a case without user action');
  const direct = authHarness(''); direct.ready();
  direct.nodes.accountEmail.value = direct.user.email;
  direct.nodes.accountPassword.value = 'portal-password';
  await direct.nodes.accountForm.handlers.submit({ preventDefault() {} });
  await direct.nodes.accountSaveProfile.handlers.click({ preventDefault() {} });
  assert.equal(direct.account.beginFacultyTab('tab-teaching'), true,
    'Selecting Teaching after saving the employee profile explicitly opens a new unsaved case');
  for (const tab of ['tab-teaching', 'tab-research', 'tab-clinical', 'tab-service', 'tab-provisional']) {
    assert.equal(direct.account.canOpenTab(tab), true, `Employee can open ${tab} in their case`);
  }
  assert.equal(direct.account.canOpenTab('tab-peer'), false,
    'Opening faculty sections must not grant committee assessment access');
  const existing = authHarness('');
  existing.ready(); existing.nodes.accountEmail.value = existing.user.email;
  existing.nodes.accountPassword.value = 'portal-password';
  await existing.nodes.accountForm.handlers.submit({ preventDefault() {} });
  existing.account.ownCases = [{ id: 'draft-1', cycle_year: 2026, status: 'draft' }];
  assert.equal(existing.account.beginFacultyTab('tab-research'), false,
    'Navigation must not silently create a duplicate when a cloud case already exists');
  assert.match(existing.nodes.accountMessage.textContent, /Open your saved case under My appraisals/);
  await signed.nodes.accountNewCase.handlers.click({ preventDefault() {} });
  assert.equal(signed.account.caseOpen, true, 'New-case action opens the appraisal');
  assert.equal(signed.appliedProfiles.length, 1, 'New appraisal receives the saved employee profile');
  assert.equal(signed.appliedProfiles[0].display_name, 'Registered Faculty');
  assert.equal(signed.appliedProfiles[0].substantive_designation, 'Professor');
  assert.equal(signed.nodes.input_emp_name.disabled, true, 'Appraisal identity is read-only for the signed-in employee');
  assert.equal(signed.nodes.input_emp_desig.disabled, true, 'Appraisal designation is read-only for the signed-in employee');
  signed.nodes.profileDisplayName.value = 'Registered Faculty Updated';
  signed.nodes.profileDesignation.value = 'Associate Professor';
  signed.nodes.profileScholarIdentifier.value = 'https://orcid.org/0000-0002-1825-0097';
  await signed.nodes.accountSaveProfile.handlers.click({ preventDefault() {} });
  const profileSave = signed.calls.find(call => call.url.includes('/rest/v1/rpc/save_employee_profile_with_scholar'));
  assert.ok(profileSave, 'Employee profile edits use the owner-checked save RPC');
  const profileSaveBody = JSON.parse(profileSave.options.body);
  assert.equal(profileSaveBody.p_display_name, 'Registered Faculty Updated');
  assert.equal(profileSaveBody.p_substantive_designation, 'Associate Professor');
  assert.equal(profileSaveBody.p_scholar_identifier, 'https://orcid.org/0000-0002-1825-0097');
  assert.equal(Object.hasOwn(profileSaveBody, 'p_user_id'), false, 'Profile-save RPC does not accept a target user ID');
  assert.equal(signed.account.profile.display_name, 'Registered Faculty Updated', 'Saved profile reloads');
  assert.equal(signed.account.profile.scholar_identifier, 'https://orcid.org/0000-0002-1825-0097');
  assert.match(signed.nodes.employeeProfileSaveMessage.textContent, /Profile saved to your employee account/,
    'Profile-save confirmation appears beside the save button');
  assert.equal(signed.nodes.input_emp_name.value, 'Registered Faculty',
    'Changing the employee profile must not silently rewrite an open appraisal snapshot');
  assert.equal(signed.nodes.accountProfileSyncNotice.hidden, false,
    'Changed profile offers an explicit draft synchronization action');
  await signed.nodes.accountSyncDraftProfile.handlers.click({ preventDefault() {} });
  assert.equal(signed.nodes.input_emp_name.value, 'Registered Faculty Updated',
    'Explicit sync applies current job details to an editable draft');
  await signed.nodes.accountSignOut.handlers.click({ preventDefault() {} });
  assert.equal(signed.account.session, null, 'Sign-out discards the in-memory session');
  assert.equal(signed.account.profile, null, 'Sign-out clears the employee profile');
  assert.equal(signed.account.caseOpen, false, 'Sign-out closes the prior case');
  assert.equal(signed.nodes.profileDisplayName.value, '', 'Sign-out clears profile edit fields');
  assert.equal(signed.nodes.appraisalWorkspace.hidden, false, 'Signed-out visitor returns only to local demo');

  const singleName = authHarness(''); singleName.ready();
  singleName.nodes.accountEmail.value = singleName.user.email;
  singleName.nodes.accountPassword.value = 'portal-password';
  await singleName.nodes.accountForm.handlers.submit({ preventDefault() {} });
  singleName.nodes.profileDisplayName.value = 'Ayesha';
  await singleName.nodes.accountSaveProfile.handlers.click({ preventDefault() {} });
  assert.equal(singleName.account.profile.display_name, 'Ayesha',
    'A single official name is accepted by the employee-profile save flow');

  const failedSave = authHarness('', { profileSaveError: true }); failedSave.ready();
  failedSave.nodes.accountEmail.value = failedSave.user.email;
  failedSave.nodes.accountPassword.value = 'portal-password';
  await failedSave.nodes.accountForm.handlers.submit({ preventDefault() {} });
  await failedSave.nodes.accountSaveProfile.handlers.click({ preventDefault() {} });
  assert.match(failedSave.nodes.employeeProfileSaveMessage.textContent, /Not saved: Profile save rejected/,
    'A rejected profile save shows its reason beside the button');
  assert.equal(failedSave.nodes.accountSaveProfile.disabled, false,
    'Save can be retried after a failed request');

  const unconfirmedSave = authHarness('', { profileSaveNotPersisted: true }); unconfirmedSave.ready();
  unconfirmedSave.nodes.accountEmail.value = unconfirmedSave.user.email;
  unconfirmedSave.nodes.accountPassword.value = 'portal-password';
  await unconfirmedSave.nodes.accountForm.handlers.submit({ preventDefault() {} });
  unconfirmedSave.nodes.profileDisplayName.value = 'A New Name';
  await unconfirmedSave.nodes.accountSaveProfile.handlers.click({ preventDefault() {} });
  assert.match(unconfirmedSave.nodes.employeeProfileSaveMessage.textContent, /Not saved: The saved profile could not be verified/,
    'The UI must not claim success when a reloaded profile does not match');

  const legacy = authHarness('', { profileRows: [{ id: 'user-1', display_name: 'Invited Legacy' }], assessor: true });
  legacy.ready(); legacy.nodes.accountEmail.value = legacy.user.email;
  legacy.nodes.accountPassword.value = 'portal-password';
  await legacy.nodes.accountForm.handlers.submit({ preventDefault() {} });
  assert.equal(legacy.account.profileComplete, false, 'Old invited accounts need to complete their job profile');
  assert.equal(legacy.account.assessor, true, 'An independently granted assessor role remains available');
  assert.equal(legacy.nodes.accountNewCase.disabled, true, 'Incomplete employee profile cannot start an appraisal');
  await legacy.nodes.accountNewCase.handlers.click({ preventDefault() {} });
  assert.equal(legacy.account.caseOpen, false, 'Bypassing the disabled button still fails closed');
  await legacy.nodes.accountAssessorMode.handlers.click({ preventDefault() {} });
  assert.equal(legacy.account.mode, 'assessor', 'Assessor may use only the independently granted assessor workspace');
  assert.equal(legacy.account.caseOpen, false, 'No case opens without a current assignment');
  assert.equal(legacy.account.canOpenTab('tab-peer'), false, 'Empty assessor queue does not open review fields');

  const denied = authHarness('', { profileError: true }); denied.ready();
  denied.nodes.accountEmail.value = denied.user.email;
  denied.nodes.accountPassword.value = 'portal-password';
  await denied.nodes.accountForm.handlers.submit({ preventDefault() {} });
  assert.equal(denied.account.session, null, 'Profile fetch failure must tear down the session');
  assert.equal(denied.account.user, null, 'Profile fetch failure must not leave a signed-in identity');
  assert.equal(denied.account.mode, 'demo', 'Profile fetch failure fails closed to local demo');
  assert.equal(denied.account.caseOpen, false, 'Profile fetch failure cannot open an appraisal');
  assert.equal(denied.calls.some(call => call.url.includes('/rest/v1/appraisal_cases')), false,
    'Failed profile load must not fetch cases');

  const mismatched = authHarness('', {
    profileRows: [{ ...signed.profile, id: 'some-other-user' }]
  });
  mismatched.ready(); mismatched.nodes.accountEmail.value = mismatched.user.email;
  mismatched.nodes.accountPassword.value = 'portal-password';
  await mismatched.nodes.accountForm.handlers.submit({ preventDefault() {} });
  assert.equal(mismatched.account.session, null, 'A profile row for another account must be rejected');
  assert.equal(mismatched.account.profile, null, 'Cross-user profile data must not remain in memory');
  assert.equal(mismatched.account.caseOpen, false, 'Mismatched profile cannot open an appraisal');

  // A stale response for account A must not repopulate private state after
  // signing out and authenticating as account B in the same browser tab.
  let releaseOldProfile;
  const oldProfileBlocked = new Promise(resolve => { releaseOldProfile = resolve; });
  const secondUser = { id: 'user-2', email: 'second@example.edu.pk' };
  const secondProfile = {
    ...signed.profile, id: secondUser.id, display_name: 'Second Faculty',
    substantive_designation: 'Lecturer'
  };
  const race = authHarness('', { fetchOverride: async ({ url, options }) => {
    if (url.includes('grant_type=password')) {
      const email = JSON.parse(options.body).email;
      const selected = email === secondUser.email ? secondUser : {
        id: 'user-1', email: 'invited@example.edu.pk'
      };
      return { ok: true, status: 200, text: async () => JSON.stringify({
        access_token: `token-${selected.id}`, refresh_token: `refresh-${selected.id}`, user: selected
      }) };
    }
    if (url.includes('/rest/v1/app_user_profiles')) {
      const second = url.includes(encodeURIComponent(secondUser.id));
      if (!second) await oldProfileBlocked;
      return { ok: true, status: 200, text: async () => JSON.stringify(second
        ? [secondProfile] : [signed.profile]) };
    }
    if (url.endsWith('/auth/v1/logout')) {
      return { ok: true, status: 200, text: async () => '{}' };
    }
    return null;
  } });
  race.ready();
  race.nodes.accountEmail.value = 'invited@example.edu.pk';
  race.nodes.accountPassword.value = 'password-one';
  const oldSignIn = race.nodes.accountForm.handlers.submit({ preventDefault() {} });
  for (let attempt = 0; attempt < 5; attempt += 1) await race.tick();
  assert.equal(race.calls.some(call => call.url.includes('/rest/v1/app_user_profiles')),
    true, 'First sign-in must reach its delayed employee profile read');
  await race.nodes.accountSignOut.handlers.click({ preventDefault() {} });
  race.nodes.accountEmail.value = secondUser.email;
  race.nodes.accountPassword.value = 'password-two';
  await race.nodes.accountForm.handlers.submit({ preventDefault() {} });
  assert.equal(race.account.user.id, secondUser.id, 'Second account is signed in before stale response arrives');
  assert.equal(race.account.profile.display_name, secondProfile.display_name,
    'Second account profile is active before stale response arrives');
  releaseOldProfile();
  await oldSignIn;
  assert.equal(race.account.user.id, secondUser.id, 'Stale first-account response cannot replace second identity');
  assert.equal(race.account.profile.id, secondUser.id, 'Stale first-account response cannot replace second profile');
  assert.equal(race.nodes.profileDisplayName.value, secondProfile.display_name,
    'Stale first-account response cannot repaint the private profile form');
  assert.equal(race.account.mode, 'assessee', 'Stale first-account response cannot change the active role');

  console.log('Account QA passed: profile registration/prefill, employee/assessor isolation, stale-response isolation, fail-closed load, no auto-upload and auth recovery.');
})().catch(error => { console.error(error); process.exitCode = 1; });

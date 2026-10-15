/**
 * Optional authenticated pilot workflow. The published calculator remains a
 * clearly labelled local demo unless the schema/RLS deployment is verified.
 * The browser key is intentionally public; all case access must be enforced
 * in Supabase RLS and RPCs, never by this script alone.
 */
'use strict';

const KMU_ACCOUNT_CONFIG = Object.freeze({
  url: 'https://wiglqhoihnlmalfzqepk.supabase.co',
  publishableKey: 'sb_publishable_gVh-8mS-4Ns0Nd9QxFFXeg_A-Oa-9yN',
  backendVerified: true // Pilot schema and rollback-only RLS suite verified on 14 October 2026.
});

(function () {
  const $ = id => document.getElementById(id);
  const AUTH_LINK_TYPES = new Set(['invite', 'recovery', 'signup']);
  // Capture only in memory and strip credentials from the address bar before any
  // asynchronous work. Never place callback tokens in drafts or browser storage.
  function consumeAuthFragment() {
    const location = window.location;
    const hash = location?.hash;
    if (!hash || hash === '#') return null;
    const params = new URLSearchParams(hash.slice(1));
    if (!['access_token', 'refresh_token', 'type', 'error', 'error_code'].some(key => params.has(key))) return null;
    try {
      window.history.replaceState(window.history.state, '', `${location.pathname}${location.search}`);
    } catch {
      // Even if History API is unavailable, do not leave a credential fragment visible.
      location.hash = '';
    }
    if (hash.length > 16384 || params.has('error')) return { error: true };
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const tokenType = params.get('token_type');
    if (!AUTH_LINK_TYPES.has(type) || !accessToken || !refreshToken
      || (tokenType && tokenType.toLowerCase() !== 'bearer')) return { error: true };
    return { type, accessToken, refreshToken };
  }
  let pendingAuthRedirect = consumeAuthFragment();
  let pendingPasswordSetup = null;
  let accountLoading = false;
  // In-flight reads must never hydrate another person's workspace after a
  // sign-out, account change or portal switch. These counters are not security
  // boundaries (RLS is); they prevent stale private data from flashing in UI.
  let accountGeneration = 0;
  let viewGeneration = 0;
  let signInAttempt = 0;
  class StaleAccountRequest extends Error {}
  function captureView() {
    return { accountGeneration, viewGeneration, userId: account.user?.id, mode: account.mode };
  }
  function viewIsCurrent(view) {
    return view.accountGeneration === accountGeneration && view.viewGeneration === viewGeneration
      && view.userId === account.user?.id && view.mode === account.mode;
  }
  function ensureCurrent(view) {
    if (!viewIsCurrent(view)) throw new StaleAccountRequest('The account view changed.');
  }
  const ACCOUNT_REVIEW_TABS = new Set(['tab-peer', 'tab-targets', 'tab-redflag', 'tab-summary']);
  const OBJECTIVE_TABS = ['tab-meta', 'tab-teaching', 'tab-research', 'tab-clinical', 'tab-service'];
  const FACULTY_TABS = new Set([...OBJECTIVE_TABS, 'tab-provisional']);
  const PROFILE_FIELDS = Object.freeze({
    name: 'input_emp_name', designation: 'input_emp_desig', leadership: 'input_leadership_role',
    institute: 'input_emp_dept', cadre: 'input_emp_cadre'
  });
  const PROFILE_SELECTS = Object.freeze([
    ['input_emp_desig', 'accountDesignation', 'profileDesignation'],
    ['input_leadership_role', 'accountLeadershipRole', 'profileLeadershipRole'],
    ['input_emp_dept', 'accountInstitute', 'profileInstitute'],
    ['input_emp_cadre', 'accountCadre', 'profileServiceCadre']
  ]);
  const MAX_PAYLOAD_BYTES = 180000;
  const account = window.KMUAccount = {
    mode: 'demo', session: null, user: null, assessor: false, administrator: false,
    selectedCaseId: null, selectedCaseStatus: null, reviewLoaded: false, caseOpen: false,
    profile: null, profileComplete: false, ownCases: null,
    backendVerified: KMU_ACCOUNT_CONFIG.backendVerified,
    buildObjectivePayload: () => objectivePayload(),
    canOpenTab(tabId) {
      if (this.mode === 'demo') return true;
      if (!this.caseOpen) return false;
      if (this.mode === 'assessee') {
        if (tabId === 'tab-summary') return this.selectedCaseStatus === 'reviewed' && this.reviewLoaded;
        return !ACCOUNT_REVIEW_TABS.has(tabId);
      }
      if (this.mode === 'administrator') {
        if (tabId === 'tab-summary') return this.selectedCaseStatus === 'reviewed' && this.reviewLoaded;
        return !ACCOUNT_REVIEW_TABS.has(tabId);
      }
      return this.mode === 'assessor' && (!ACCOUNT_REVIEW_TABS.has(tabId)
        || Boolean(this.selectedCaseId && ['submitted', 'reviewed'].includes(this.selectedCaseStatus)));
    },
    saveCurrent: () => saveCurrent(),
    saveAndReturn: () => saveAndReturn(),
    beginFacultyTab: tabId => beginFacultyTab(tabId),
    submitObjective: () => submitObjective(),
    verifyActiveSelection: () => verifyActiveSelection(),
    loadMyProfile: () => loadMyProfile(),
    applySavedProfileToNewCase: () => applySavedProfileToNewCase()
  };

  function setMessage(text, kind = '') {
    const node = $('accountMessage');
    if (node) { node.textContent = text; node.className = `account-message ${kind}`.trim(); }
  }
  function setProfileSaveMessage(text, kind = '') {
    const node = $('employeeProfileSaveMessage');
    if (node) { node.textContent = text; node.className = `account-message ${kind}`.trim(); }
  }
  function setText(id, value) { const node = $(id); if (node) node.textContent = String(value); }
  function show(id, visible) { const node = $(id); if (node) node.hidden = !visible; }
  function clearPrivatePanels() {
    ['myCaseList', 'assessorQueue', 'accountAdminUsers', 'adminFacultyRecords', 'adminAssessorId',
      'adminRevokeAssessorId', 'adminCaseId', 'adminAssignAssessorId', 'adminUnassignId']
      .forEach(id => $(id)?.replaceChildren());
    setProfileSaveMessage('');
  }
  function populateProfileSelects() {
    PROFILE_SELECTS.forEach(([sourceId, registrationId, employeeId]) => {
      const source = $(sourceId);
      if (!source) return;
      [registrationId, employeeId].forEach(id => {
        const target = $(id);
        if (target) target.replaceChildren(...Array.from(source.children, child => child.cloneNode(true)));
      });
    });
  }
  function allowedOption(sourceId, value) {
    const source = $(sourceId);
    return Boolean(source && Array.from(source.options).some(option => option.value === value && option.value !== ''));
  }
  function readProfileInputs(kind) {
    const registration = kind === 'registration';
    const id = (registrationId, employeeId) => registration ? registrationId : employeeId;
    return {
      display_name: ($(id('accountDisplayName', 'profileDisplayName'))?.value || '').trim(),
      substantive_designation: $(id('accountDesignation', 'profileDesignation'))?.value || '',
      leadership_role: $(id('accountLeadershipRole', 'profileLeadershipRole'))?.value || 'None',
      institute: $(id('accountInstitute', 'profileInstitute'))?.value || '',
      service_cadre: $(id('accountCadre', 'profileServiceCadre'))?.value || ''
    };
  }
  function validateProfile(profile) {
    if (!profile.display_name || profile.display_name.length > 160) throw new Error('Enter your full name (at most 160 characters).');
    if (!allowedOption('input_emp_desig', profile.substantive_designation)) throw new Error('Choose a substantive designation from the pilot list.');
    if (!allowedOption('input_leadership_role', profile.leadership_role)) throw new Error('Choose a valid additional leadership appointment.');
    if (!allowedOption('input_emp_dept', profile.institute)) throw new Error('Choose your current KMU institute or unit.');
    if (!allowedOption('input_emp_cadre', profile.service_cadre)) throw new Error('Choose BPS, TTS or Fixed Pay.');
    return profile;
  }
  function profileIsComplete(profile) {
    try { validateProfile(profile); return true; } catch { return false; }
  }
  function profileFromRow(row, user) {
    return {
      id: row?.id || user?.id || '', display_name: row?.display_name || '',
      substantive_designation: row?.substantive_designation || '',
      leadership_role: row?.leadership_role ?? '', institute: row?.institute || '',
      service_cadre: row?.service_cadre || '', profile_updated_at: row?.profile_updated_at || null
    };
  }
  function ownProfileFromRows(rows, user) {
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.id || rows[0].id !== user?.id) {
      throw new Error('Your employee profile could not be verified for this signed-in account.');
    }
    return profileFromRow(rows[0], user);
  }
  function populateEmployeeProfileForm() {
    const profile = account.profile || {};
    const values = {
      profileDisplayName: profile.display_name || '', profileDesignation: profile.substantive_designation || '',
      profileLeadershipRole: profile.leadership_role || 'None', profileInstitute: profile.institute || '',
      profileServiceCadre: profile.service_cadre || ''
    };
    Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
  }
  function setProfileIdentityReadonly(readonly) {
    Object.values(PROFILE_FIELDS).forEach(id => { if ($(id)) $(id).disabled = readonly; });
  }
  function caseIdentityDiffers() {
    const profile = account.profile;
    if (!profile || !account.caseOpen) return false;
    return ($('input_emp_name')?.value || '').trim() !== profile.display_name
      || ($('input_emp_desig')?.value || '') !== profile.substantive_designation
      || ($('input_leadership_role')?.value || 'None') !== profile.leadership_role
      || ($('input_emp_dept')?.value || '') !== profile.institute
      || ($('input_emp_cadre')?.value || '') !== profile.service_cadre;
  }
  function updateProfileSyncNotice() {
    show('accountProfileSyncNotice', account.mode === 'assessee' && account.profileComplete
      && account.caseOpen && (!account.selectedCaseStatus || account.selectedCaseStatus === 'draft')
      && caseIdentityDiffers());
  }
  function assertBackend() {
    if (!KMU_ACCOUNT_CONFIG.backendVerified) {
      throw new Error('Account setup is not yet enabled. The database security checks must pass first; use local demo mode meanwhile.');
    }
  }
  function plainError(result, fallback) {
    const detail = result?.msg || result?.error_description || result?.message || result?.error;
    return new Error(typeof detail === 'string' ? detail.slice(0, 240) : fallback);
  }
  async function request(path, { method = 'GET', body, authenticated = true, retry = true } = {}) {
    assertBackend();
    if (authenticated && !account.session?.access_token) throw new Error('Sign in before accessing cloud cases.');
    const requestGeneration = accountGeneration;
    const headers = { apikey: KMU_ACCOUNT_CONFIG.publishableKey, 'Content-Type': 'application/json' };
    if (authenticated) headers.Authorization = `Bearer ${account.session.access_token}`;
    const response = await fetch(`${KMU_ACCOUNT_CONFIG.url}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', referrerPolicy: 'no-referrer'
    });
    if (authenticated && requestGeneration !== accountGeneration) throw new StaleAccountRequest();
    if (response.status === 401 && authenticated && retry && account.session?.refresh_token) {
      await refreshSession(requestGeneration);
      return request(path, { method, body, authenticated, retry: false });
    }
    const raw = await response.text();
    if (authenticated && requestGeneration !== accountGeneration) throw new StaleAccountRequest();
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* API errors may be plain text. */ }
    if (!response.ok) throw plainError(parsed, `The account service returned ${response.status}.`);
    return parsed;
  }
  async function refreshSession(expectedGeneration = accountGeneration) {
    const token = account.session?.refresh_token;
    if (!token) throw new Error('Your session expired; sign in again.');
    const response = await fetch(`${KMU_ACCOUNT_CONFIG.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: KMU_ACCOUNT_CONFIG.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token }), cache: 'no-store', referrerPolicy: 'no-referrer'
    });
    const data = await response.json().catch(() => null);
    if (expectedGeneration !== accountGeneration) throw new StaleAccountRequest();
    if (!response.ok || !data?.access_token) { account.session = null; throw plainError(data, 'Your session expired; sign in again.'); }
    account.session = data;
  }
  const rest = (table, query) => request(`/rest/v1/${table}?${query}`);
  const rpc = (name, body) => request(`/rest/v1/rpc/${name}`, { method: 'POST', body });
  const first = result => Array.isArray(result) ? result[0] : result;
  const encode = value => encodeURIComponent(String(value));

  async function loadMyProfile() {
    if (!account.user?.id) throw new Error('Sign in before loading your employee profile.');
    const view = captureView();
    const rows = await rest('app_user_profiles',
      `select=id,display_name,substantive_designation,leadership_role,institute,service_cadre,profile_updated_at&id=eq.${encode(account.user.id)}`);
    ensureCurrent(view);
    account.profile = ownProfileFromRows(rows, account.user);
    account.profileComplete = profileIsComplete(account.profile);
    populateEmployeeProfileForm(); render();
    return account.profile;
  }
  async function saveEmployeeProfile() {
    if (!account.user?.id || !account.session?.access_token) throw new Error('Sign in before saving your employee profile.');
    const view = captureView();
    const profile = validateProfile(readProfileInputs('employee'));
    const saved = first(await rpc('save_employee_profile', {
      p_display_name: profile.display_name,
      p_substantive_designation: profile.substantive_designation,
      p_leadership_role: profile.leadership_role,
      p_institute: profile.institute,
      p_service_cadre: profile.service_cadre
    }));
    ensureCurrent(view);
    if (!saved?.id || saved.id !== account.user.id) throw new Error('The database did not confirm your employee profile.');
    const persisted = await loadMyProfile();
    ensureCurrent(view);
    if (['display_name', 'substantive_designation', 'leadership_role', 'institute', 'service_cadre']
      .some(field => persisted?.[field] !== profile[field])) {
      throw new Error('The saved profile could not be verified after reloading. Please retry or contact the portal administrator.');
    }
    const changedOpenCase = account.caseOpen && caseIdentityDiffers();
    setMessage(changedOpenCase && (!account.selectedCaseStatus || account.selectedCaseStatus === 'draft')
      ? 'Employee profile saved. The open appraisal retains its original snapshot; use “Update this draft from my profile” if you want to change it.'
      : changedOpenCase
        ? 'Employee profile saved. The submitted or reviewed case remains unchanged; a new cycle will use these details.'
        : 'Employee profile saved. New appraisals will use these job details.', 'success');
    return account.profile;
  }
  function applySavedProfileToNewCase() {
    if (account.mode !== 'assessee' || !account.profileComplete) {
      throw new Error('Complete and save your employee profile before starting a new appraisal.');
    }
    if (account.selectedCaseId || account.selectedCaseStatus) {
      throw new Error('A saved case is open. Use the explicit draft-sync action to change its job details.');
    }
    if (typeof window.KMUCalculator.applyEmployeeProfile !== 'function') {
      throw new Error('The appraisal form cannot apply your saved employee profile.');
    }
    window.KMUCalculator.applyEmployeeProfile(account.profile);
    updateProfileSyncNotice();
    return true;
  }

  function setObjectiveReadonly(readonly) {
    OBJECTIVE_TABS.forEach(tabId => {
      const tab = $(tabId); if (!tab) return;
      tab.classList.toggle('account-readonly', readonly);
      tab.querySelectorAll('input, select, textarea, button').forEach(node => {
        if (readonly) {
          if (!node.disabled) { node.disabled = true; node.dataset.accountDisabled = '1'; }
        } else if (node.dataset.accountDisabled === '1') {
          node.disabled = false; delete node.dataset.accountDisabled;
        }
      });
    });
    // Section E's submission controls are separate from objective input controls.
    show('objectiveSaveButton', !readonly || account.mode === 'demo');
    show('objectiveSubmitButton', !readonly || account.mode === 'demo');
    if (!readonly) setProfileIdentityReadonly(account.mode !== 'demo');
  }
  function setReviewReadonly(readonly) {
    ['tab-peer', 'tab-targets', 'tab-redflag'].forEach(tabId => {
      $(tabId)?.querySelectorAll('input, select, textarea, button.score-chip-btn').forEach(node => {
        if (readonly) {
          if (!node.disabled) { node.disabled = true; node.dataset.reviewDisabled = '1'; }
        } else if (node.dataset.reviewDisabled === '1') {
          node.disabled = false; delete node.dataset.reviewDisabled;
        }
      });
    });
  }
  function render() {
    const authLinkOpen = Boolean(pendingAuthRedirect || pendingPasswordSetup);
    const signed = Boolean(account.user && account.session && !authLinkOpen);
    document.body.dataset.accountMode = account.mode;
    show('accountGuest', !signed && !authLinkOpen);
    show('accountPasswordSetup', Boolean(pendingPasswordSetup));
    show('accountSignedIn', signed);
    show('appraisalWorkspace', !signed || account.caseOpen);
    show('stageBanner', !signed || account.caseOpen);
    show('profileSnapshotNotice', signed && account.caseOpen);
    setText('profileSnapshotNotice', account.mode === 'assessor'
      ? 'These are the employee’s submitted job details for this case. They are read-only for the assessor.'
      : account.mode === 'administrator'
        ? 'Administrator read-only view: these job details are the saved case snapshot, not the employee’s current editable profile.'
      : 'These identity fields come from your saved Employee Portal profile and are read-only in this appraisal. An existing draft changes only when you explicitly sync it.');
    show('accountAssessorMode', signed && account.assessor);
    show('accountAdminMode', signed && account.administrator);
    [['accountAssesseeMode', 'assessee'], ['accountAssessorMode', 'assessor'],
      ['accountAdminMode', 'administrator']].forEach(([id, mode]) => {
      const button = $(id); if (!button) return;
      button.classList?.toggle('role-active', signed && account.mode === mode);
      button.setAttribute?.('aria-pressed', String(signed && account.mode === mode));
    });
    show('accountCasePanel', signed && !accountLoading && account.mode === 'assessee');
    show('accountQueuePanel', signed && !accountLoading && account.mode === 'assessor');
    show('accountAdminPanel', signed && !accountLoading && account.mode === 'administrator');
    show('adminCloseCase', signed && account.mode === 'administrator' && account.caseOpen);
    show('accountSubmitReview', account.mode === 'assessor'
      && Boolean(account.selectedCaseId && account.selectedCaseStatus === 'submitted'));
    setText('accountModeBadge', signed ? ({ assessee: 'Employee', assessor: 'Assessor', administrator: 'Administrator' }[account.mode] || 'Account') : 'Local demo');
    setText('accountStatus', authLinkOpen
      ? pendingPasswordSetup ? `Complete password setup for ${pendingPasswordSetup.email}.` : 'Checking the account link…'
      : signed && accountLoading ? `Loading your employee profile and granted roles for ${account.user.email}…`
      : signed ? `Signed in as ${account.user.email}. ${account.mode === 'assessor'
        ? 'Assessor Portal — assigned cases only.' : account.mode === 'administrator' ? 'Administrator workspace.' : 'Employee Portal.'} This session lasts only in this tab; a refresh signs you out.`
      : 'Local demo mode — no shared case or assessor access.');
    const profileStatus = $('employeeProfileStatus');
    if (profileStatus) {
      profileStatus.dataset.complete = String(account.profileComplete);
      profileStatus.textContent = !signed ? '' : accountLoading ? 'Loading employee profile…' : account.profileComplete
        ? `Profile ready: ${account.profile.display_name} · ${account.profile.substantive_designation} · ${account.profile.institute}.`
        : 'Your employee profile is incomplete. Save your name, substantive designation, additional role, KMU unit and service cadre before starting a new appraisal.';
    }
    if ($('accountNewCase')) $('accountNewCase').disabled = signed && (accountLoading || !account.profileComplete);
    ['accountAssesseeMode', 'accountAssessorMode', 'accountAdminMode'].forEach(id => {
      if ($(id)) $(id).disabled = accountLoading;
    });
    updateProfileSyncNotice();
    setText('provisionalStorageNote', account.mode === 'assessee'
      ? account.selectedCaseStatus === 'submitted'
        ? 'This faculty case has been submitted and is read-only. Its score remains a provisional faculty calculation, not a verified or official appraisal.'
        : 'Save the faculty-only objective draft to your account, then explicitly submit it for assignment to an assessor. Nothing from an older browser draft is uploaded automatically.'
      : account.mode === 'demo'
        ? 'In local demo mode, saving keeps the draft only in this browser and does not submit it to an assessor. Use fictional or non-confidential data.'
        : 'Objective entries are read-only here. Only the faculty account can submit the objective case.');
    setText('objectiveSaveButton', account.mode === 'assessee' ? '💾 Save and return to Employee Portal' : '💾 Save provisional dossier on this browser');
    setText('objectiveSubmitButton', account.mode === 'assessee' ? 'Submit objective case to assessor queue ➔' : 'Continue to Committee Assessment ➔');
    setText('headerSaveButton', account.mode === 'assessee' ? '💾 Save and return' : '💾 Save & Return Later');
    show('headerSaveButton', account.mode === 'demo' || (account.mode === 'assessee'
      && account.caseOpen && !['submitted', 'reviewed'].includes(account.selectedCaseStatus)));
    setText('reviewAccessNote', account.mode === 'assessor'
      ? 'This case was retrieved under your assigned assessor account. Only the separate subjective assessment is submitted by you; faculty objective entries are read-only and still require institutional verification.'
      : account.mode === 'demo'
        ? 'Local demo mode has no assessor authentication: the faculty-to-reviewer transition is only a page sequence. Do not use it for real personnel decisions.'
        : 'Only an assigned assessor can open this stage after the faculty member submits the objective case.');
    const cloudSaveIndicator = account.mode === 'assessee'
      ? account.selectedCaseStatus === 'submitted' ? 'Cloud case submitted' : 'Cloud draft not saved this session'
      : account.mode === 'assessor' ? 'Assessment not submitted' : null;
    if (cloudSaveIndicator) setText('lastSavedIndicator', cloudSaveIndicator);
    setProfileIdentityReadonly(signed);
    window.KMUCalculator.calculate();
  }
  function clearLocalRecoveryNotice() { show('draftRecoveryBanner', false); }
  async function activateSession(data) {
    if (!data?.access_token || !data?.user?.id) throw new Error('Sign-in did not return a valid account session.');
    accountGeneration += 1; viewGeneration += 1;
    accountLoading = true;
    account.session = data; account.user = data.user;
    account.assessor = false; account.administrator = false; account.profile = null;
    account.profileComplete = false; account.ownCases = null;
    account.mode = 'assessee'; account.caseOpen = false;
    account.selectedCaseId = null; account.selectedCaseStatus = null; account.reviewLoaded = false;
    clearPrivatePanels(); populateEmployeeProfileForm();
    setObjectiveReadonly(false); setReviewReadonly(false); window.KMUCalculator.loadBlank(); render();
    const view = captureView();
    try {
      const uid = encode(data.user.id);
      const [assessorRows, adminRows, profileRows] = await Promise.all([
        rest('app_assessors', `select=user_id&user_id=eq.${uid}&revoked_at=is.null`),
        rest('app_administrators', `select=user_id&user_id=eq.${uid}&revoked_at=is.null`),
        rest('app_user_profiles',
          `select=id,display_name,substantive_designation,leadership_role,institute,service_cadre,profile_updated_at&id=eq.${uid}`)
      ]);
      ensureCurrent(view);
      account.assessor = Array.isArray(assessorRows) && assessorRows.length > 0;
      account.administrator = Array.isArray(adminRows) && adminRows.length > 0;
      account.profile = ownProfileFromRows(profileRows, account.user);
      account.profileComplete = profileIsComplete(account.profile);
      accountLoading = false;
      populateEmployeeProfileForm();
      clearLocalRecoveryNotice();
      render(); await listOwnCases();
      ensureCurrent(view);
      setMessage(account.profileComplete
        ? 'Signed in to your Employee Portal. Choose an existing case or start a new one. Local browser drafts were not uploaded.'
        : 'Signed in. Complete and save your employee profile before starting a new appraisal. Assessor/administrator roles, if granted, remain available.', 'success');
    } catch (error) {
      if (!viewIsCurrent(view)) return false;
      accountGeneration += 1; viewGeneration += 1;
      accountLoading = false;
      account.session = null; account.user = null; account.mode = 'demo';
      account.assessor = false; account.administrator = false; account.profile = null;
      account.profileComplete = false; account.ownCases = null;
      account.caseOpen = false; clearPrivatePanels();
      populateEmployeeProfileForm(); window.KMUCalculator.loadBlank(); render();
      throw new Error(`Account access is not ready: ${error.message}`);
    }
  }
  async function authenticate(email, password) {
    const attempt = ++signInAttempt;
    const data = await request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email, password }, authenticated: false
    });
    if (attempt !== signInAttempt) return false;
    await activateSession(data);
  }
  async function processAuthRedirect() {
    const callback = pendingAuthRedirect;
    if (!callback) return;
    if (callback.error) {
      pendingAuthRedirect = null; render();
      setMessage('This account link is invalid, expired, or already used. Request a fresh invitation or password-reset link.', 'error');
      return;
    }
    try {
      assertBackend();
      account.session = { access_token: callback.accessToken, refresh_token: callback.refreshToken };
      const user = await request('/auth/v1/user');
      if (!user?.id || !user?.email) throw new Error('The account link did not identify a user.');
      account.user = user;
      pendingAuthRedirect = null;
      if (callback.type === 'signup') {
        await activateSession({ ...account.session, user });
        setMessage('Email confirmed. Your faculty account is ready. Local drafts were not uploaded.', 'success');
        return;
      }
      pendingPasswordSetup = { type: callback.type, email: user.email, userId: user.id };
      setText('accountPasswordSetupIntro', callback.type === 'invite'
        ? `Invitation verified for ${user.email}. Choose a password to activate your account.`
        : `Password-reset link verified for ${user.email}. Choose a new password.`);
      render();
      setMessage('Account link verified. Enter and confirm your new password below.', 'success');
    } catch {
      account.session = null; account.user = null; pendingPasswordSetup = null; pendingAuthRedirect = null;
      render();
      setMessage('This account link could not be verified. It may have expired or already been used. Request a new link.', 'error');
    }
  }
  async function finishPasswordSetup() {
    if (!pendingPasswordSetup || !account.session?.access_token) throw new Error('Open a fresh invitation or reset link first.');
    const passwordInput = $('accountNewPassword');
    const confirmationInput = $('accountConfirmPassword');
    const password = passwordInput.value;
    const confirmation = confirmationInput.value;
    try {
      if (password.length < 8) throw new Error('Use at least 8 characters for the new password.');
      if (password !== confirmation) throw new Error('The two passwords do not match.');
      const email = pendingPasswordSetup.email;
      await request('/auth/v1/user', { method: 'PUT', body: { password } });
      // A password change may revoke the callback session. Drop it and establish
      // a fresh session with the user-entered password before loading any roles.
      pendingPasswordSetup = null; account.session = null; account.user = null; render();
      try {
        await authenticate(email, password);
        setMessage('Password set and signed in. Your available roles are now loaded.', 'success');
      } catch {
        account.session = null; account.user = null; account.mode = 'demo'; render();
        setMessage('Password set. Please sign in with your new password. If access is not ready, contact the portal administrator.', 'success');
      }
    } finally {
      passwordInput.value = '';
      confirmationInput.value = '';
    }
  }
  async function requestPasswordRecovery(email) {
    if (!email) throw new Error('Enter your email / username first.');
    const redirectTo = 'https://yasaryousafzai.github.io/kmu-faculty-appraisal-portal/';
    await request(`/auth/v1/recover?redirect_to=${encode(redirectTo)}`, {
      method: 'POST', body: { email }, authenticated: false
    });
    setMessage('If that account exists and email delivery is available, a password-reset link will arrive. Check your inbox and spam folder.', 'success');
  }
  async function register(email, password, profileFields) {
    const profile = validateProfile(profileFields);
    const redirectTo = 'https://yasaryousafzai.github.io/kmu-faculty-appraisal-portal/';
    const result = await request(`/auth/v1/signup?redirect_to=${encode(redirectTo)}`, {
      method: 'POST', body: { email, password, data: profile }, authenticated: false
    });
    // Raw GoTrue REST returns a top-level user for confirmation-required signups,
    // and a session-shaped response when email confirmation is not required.
    if (!result?.id && !result?.user?.id) throw new Error('Registration did not return an account.');
    if (result.access_token) {
      await authenticate(email, password);
    } else {
      setMessage('Registration requested. Check your email for a confirmation link, then sign in. Your employee profile was provided with registration; assessor access is never self-assigned.', 'success');
    }
  }
  function objectivePayload() {
    window.KMUCalculator.calculate();
    const draft = window.KMUCalculator.collectDraft('tab-provisional');
    const result = window.KMUCalculator.lastResult;
    const objectiveFields = NUMERIC_INPUT_IDS.filter(id => id !== 'input_actual_wu');
    const metaFields = ['name', 'desig', 'leadershipRole', 'dept', 'cadre', 'cycle', 'workAssignment',
      'profileAssignmentRef', 'clinicalServiceMode', 'clinicalEvidenceRef',
      'appraiser', 'reviewer', 'finalAuthority',
      'committeeMember1', 'committeeMember2', 'committeeMember3'];
    const meta = Object.fromEntries(metaFields.map(key => [key, draft.meta[key] || '']));
    const weights = appraisalState.activeWeights;
    const ceiling = weights ? weights.teaching + weights.research + weights.service + weights.clinical : 0;
    const score = result ? result.weightedA + result.weightedB + result.weightedC + result.weightedE : 0;
    const payload = {
      schemaVersion: draft.schemaVersion,
      configVersion: draft.configVersion,
      profile: draft.profile,
      manualProfileOverride: draft.manualProfileOverride,
      meta,
      values: Object.fromEntries(objectiveFields.map(id => [id, draft.values[id] ?? ''])),
      teachingCourses: draft.teachingCourses,
      research: { text: { input_publications_ref: draft.research.text.input_publications_ref || '' },
        complete: draft.research.complete },
      wuExempted: draft.wuExempted,
      serviceComplete: draft.serviceComplete,
      serviceAdditionalAppointment: draft.serviceAdditionalAppointment,
      provisional: { source: 'faculty self-entry — unverified', calculatedAt: new Date().toISOString(),
        ready: Boolean(result?.objectiveReady), objectiveScore: score, objectiveCeiling: ceiling,
        objectivePercent: result?.objectivePercent ?? 0,
        teachingPoints: result?.weightedA ?? 0, researchPoints: result?.weightedB ?? 0,
        servicePoints: result?.weightedC ?? 0, patientCarePoints: result?.weightedE ?? 0 }
    };
    if (new Blob([JSON.stringify(payload)]).size > MAX_PAYLOAD_BYTES) throw new Error('The case is too large to save. Reduce unusually long entries.');
    return payload;
  }
  function cycleYear() {
    const cycle = $('input_emp_cycle')?.value || '';
    const year = Number(cycle.match(/20\d{2}/)?.[0]);
    if (!Number.isInteger(year) || ![2025, 2026, 2027].includes(year)) {
      throw new Error('Choose one of the appraisal cycles currently offered on the faculty profile (2025–2027).');
    }
    return year;
  }
  async function saveObjective({ quiet = false } = {}) {
    if (account.mode !== 'assessee') throw new Error('Only the faculty account may save objective evidence.');
    const view = captureView();
    if (account.selectedCaseStatus === 'submitted' || account.selectedCaseStatus === 'reviewed') {
      throw new Error('A submitted case is read-only. Start a new case only for a different cycle.');
    }
    const payload = objectivePayload();
    if (!payload.meta.name || !payload.meta.desig || !payload.meta.dept) {
      throw new Error('Complete your faculty name, substantive designation and KMU institute before saving a cloud case.');
    }
    const saved = first(await rpc('save_appraisal_draft', {
      p_case_id: account.selectedCaseId,
      p_cycle_year: cycleYear(), p_designation: payload.meta.desig,
      p_institute: payload.meta.dept, p_objective_payload: payload
    }));
    ensureCurrent(view);
    if (!saved?.id || saved.faculty_id !== account.user.id || saved.status !== 'draft') {
      throw new Error('The database did not confirm ownership of the saved draft.');
    }
    account.selectedCaseId = saved.id; account.selectedCaseStatus = saved.status; account.reviewLoaded = false;
    setText('lastSavedIndicator', 'Cloud draft saved');
    if (!quiet) setMessage('Cloud draft saved to your faculty account. It has not been submitted to an assessor.', 'success');
    await listOwnCases();
    ensureCurrent(view);
    return saved;
  }
  async function submitObjective() {
    const view = captureView();
    try {
      if (account.mode !== 'assessee') throw new Error('Sign in as faculty to submit the objective case.');
      const readiness = window.KMUCalculator.getObjectiveReadiness();
      if (!readiness.ready) throw new Error(`Complete these objective entries first: ${readiness.missing.join('; ')}.`);
      const saved = await saveObjective({ quiet: true });
      ensureCurrent(view);
      if (!confirm('Submit this objective case for administrator assignment to an assessor? You cannot edit it after submission.')) return false;
      const submitted = first(await rpc('submit_appraisal_case', { p_case_id: saved.id }));
      ensureCurrent(view);
      if (!submitted?.id || submitted.status !== 'submitted') throw new Error('The database did not confirm submission.');
      account.selectedCaseStatus = submitted.status; account.reviewLoaded = false;
      setObjectiveReadonly(true); render();
      setText('lastSavedIndicator', 'Cloud case submitted');
      await listOwnCases();
      ensureCurrent(view);
      setMessage('Objective case submitted. It is awaiting administrator assignment to an assessor; no reviewer has been automatically appointed.', 'success');
      return true;
    } catch (error) { if (viewIsCurrent(view)) setMessage(error.message, 'error'); return false; }
  }
  async function saveCurrent() {
    try {
      if (account.mode === 'assessee') return await saveObjective();
      if (account.mode === 'assessor') throw new Error('Assessor entries remain in this tab until you submit them. Draft assessment saving is not available in this pilot.');
      throw new Error('Switch to your faculty case to save objective evidence.');
    } catch (error) { setMessage(error.message, 'error'); return false; }
  }
  async function saveAndReturn() {
    if (account.mode !== 'assessee') return saveCurrent();
    try {
      if (!account.caseOpen) throw new Error('Open an appraisal from the Employee Portal before saving.');
      await saveObjective({ quiet: true });
      viewGeneration += 1;
      account.selectedCaseId = null; account.selectedCaseStatus = null;
      account.reviewLoaded = false; account.caseOpen = false;
      setObjectiveReadonly(false); setReviewReadonly(false);
      window.KMUCalculator.loadBlank(); render();
      setText('lastSavedIndicator', 'Cloud draft saved');
      try {
        await listOwnCases();
        setMessage('Draft saved to your Employee Portal. Open it from My appraisals to continue later.', 'success');
      } catch (listError) {
        setMessage('Draft saved. Refresh My appraisals if it does not appear in the case list.', 'success');
      }
      window.showToast?.('Draft saved. Returned to Employee Portal.');
      $('accountTitle')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return true;
    } catch (error) {
      if (error instanceof StaleAccountRequest) return false;
      setMessage(`Not saved: ${error.message}`, 'error');
      window.showToast?.(`Not saved: ${error.message}`);
      $('accountMessage')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return false;
    }
  }
  function draftFromObjective(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('The case payload is invalid.');
    if (payload.schemaVersion !== 5 || !payload.meta || !Array.isArray(payload.teachingCourses)) {
      throw new Error('This case is not compatible with the current calculator version.');
    }
    return {
      schemaVersion: 5, configVersion: payload.configVersion, profile: payload.profile,
      manualProfileOverride: Boolean(payload.manualProfileOverride),
      meta: payload.meta, values: payload.values || {}, teachingCourses: payload.teachingCourses,
      research: payload.research || { text: {}, complete: false },
      wuExempted: payload.wuExempted || 'N', serviceComplete: payload.serviceComplete === true,
      serviceAdditionalAppointment: payload.serviceAdditionalAppointment || 'N',
      grantsList: [], sectionD: { peerScores: {}, cpdScores: {} }, targets: {}, redFlag: {},
      reviewStage: { objectiveSubmitted: false, objectiveSnapshot: '', objectiveSubmittedAt: '', reviewerRole: '', reviewerName: '' },
      lastActiveTab: 'tab-provisional'
    };
  }
  async function listOwnCases() {
    if (account.mode !== 'assessee') return;
    const view = captureView();
    const box = $('myCaseList');
    box?.replaceChildren();
    const rows = await rest('appraisal_cases', `select=id,faculty_id,cycle_year,designation,institute,status,updated_at&faculty_id=eq.${encode(account.user.id)}&order=updated_at.desc`);
    ensureCurrent(view);
    account.ownCases = rows;
    if (!box) return;
    if (!rows?.length) { box.textContent = 'No cloud cases yet. Complete your faculty profile and save a draft.'; return; }
    rows.forEach(row => {
      const wrapper = document.createElement('div'); wrapper.className = 'account-list-row';
      const info = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = `${row.cycle_year} — ${row.designation || 'Designation pending'}`;
      const sub = document.createElement('small'); sub.textContent = `${row.institute || 'Institute pending'} · ${row.status}`;
      info.append(title, sub);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary';
      button.textContent = row.id === account.selectedCaseId ? 'Open now' : 'Open case';
      button.addEventListener('click', async () => {
        const clickView = captureView();
        try {
          const caseRows = await rest('appraisal_cases', `select=id,faculty_id,cycle_year,status,objective_payload&id=eq.${encode(row.id)}&faculty_id=eq.${encode(account.user.id)}`);
          ensureCurrent(clickView);
          const current = caseRows?.[0];
          if (!current || current.faculty_id !== account.user.id) throw new Error('This faculty case is unavailable.');
          account.selectedCaseId = current.id; account.selectedCaseStatus = current.status;
          account.reviewLoaded = false; account.caseOpen = true;
          setObjectiveReadonly(false); window.KMUCalculator.restoreDraft(draftFromObjective(current.objective_payload));
          setObjectiveReadonly(current.status !== 'draft'); setReviewReadonly(true); render();
          if (current.status === 'reviewed') {
            const reviews = await rest('assessor_reviews', `select=case_id,subjective_payload&case_id=eq.${encode(row.id)}`);
            ensureCurrent(clickView);
            if (!reviews?.[0]?.subjective_payload) throw new Error('The completed assessment is not available to your account.');
            window.KMUCalculator.openCompletedCaseReport();
            if (!window.KMUCalculator.applySubmittedReview(reviews[0].subjective_payload)) {
              throw new Error('The completed assessment could not be displayed.');
            }
            account.reviewLoaded = true; setReviewReadonly(true); render();
            window.switchTab('tab-summary');
            setMessage('Your reviewed dossier is open read-only. The report and PDF include the declared objective evidence and assessor score.', 'success');
          } else {
            window.switchTab('tab-provisional');
            setMessage(`Opened your ${current.cycle_year} ${current.status} case.`, 'success');
          }
        } catch (error) { if (viewIsCurrent(clickView)) setMessage(error.message, 'error'); }
      });
      wrapper.append(info, button); box.appendChild(wrapper);
    });
  }
  async function listAssignedCases() {
    if (account.mode !== 'assessor' || !account.assessor) throw new Error('Assessor access has not been granted to this account.');
    const view = captureView();
    const box = $('assessorQueue');
    box?.replaceChildren();
    const assignments = await rest('assessor_assignments', `select=case_id&assessor_id=eq.${encode(account.user.id)}&revoked_at=is.null`);
    ensureCurrent(view);
    if (!box) return;
    if (!assignments?.length) { box.textContent = 'No cases are assigned to your account.'; return; }
    const entries = [];
    for (const assignment of assignments) {
      const rows = await rest('appraisal_cases', `select=id,faculty_id,cycle_year,designation,institute,status,objective_payload&id=eq.${encode(assignment.case_id)}`);
      ensureCurrent(view);
      const row = rows?.[0]; if (!row || !['submitted', 'reviewed'].includes(row.status)) continue;
      // A case is a historical snapshot. A later profile edit must not rename
      // the submitted faculty evidence in an assessor's queue.
      const snapshotName = row.objective_payload?.meta?.name;
      const facultyName = typeof snapshotName === 'string' && snapshotName.trim()
        ? snapshotName.trim() : 'Faculty name unavailable';
      const wrapper = document.createElement('div'); wrapper.className = 'account-list-row';
      const info = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = `${facultyName} · ${row.cycle_year} — ${row.designation || 'Faculty'} · ${row.status}`;
      const sub = document.createElement('small'); sub.textContent = row.institute || 'KMU unit not recorded';
      info.append(title, sub);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary';
      button.textContent = row.status === 'reviewed' ? 'View submitted case' : 'Open assessment';
      button.addEventListener('click', async () => {
        const clickView = captureView();
        try {
          const stillAssigned = await rest('assessor_assignments', `select=id&case_id=eq.${encode(row.id)}&assessor_id=eq.${encode(account.user.id)}&revoked_at=is.null`);
          ensureCurrent(clickView);
          if (!stillAssigned?.length) throw new Error('This assignment is no longer active. Refresh your queue.');
          const caseRows = await rest('appraisal_cases', `select=id,faculty_id,status,objective_payload&id=eq.${encode(row.id)}`);
          ensureCurrent(clickView);
          const current = caseRows?.[0];
          if (!current || !['submitted', 'reviewed'].includes(current.status)) {
            throw new Error('The assigned case is no longer available for review.');
          }
          account.selectedCaseId = current.id; account.selectedCaseStatus = current.status;
          account.reviewLoaded = false; account.caseOpen = true;
          setObjectiveReadonly(false); setReviewReadonly(false);
          window.KMUCalculator.restoreDraft(draftFromObjective(current.objective_payload));
          setObjectiveReadonly(true); setReviewReadonly(current.status !== 'submitted'); render();
          window.KMUCalculator.openAssignedCaseForReview();
          if (current.status === 'reviewed') {
            const reviews = await rest('assessor_reviews', `select=case_id,assessor_id,subjective_payload&case_id=eq.${encode(row.id)}`);
            ensureCurrent(clickView);
            const review = reviews?.[0];
            if (!review || review.assessor_id !== account.user.id) throw new Error('The completed review is unavailable to this account.');
            window.KMUCalculator.applySubmittedReview(review.subjective_payload);
            account.reviewLoaded = true;
            window.switchTab('tab-summary');
          }
          setMessage(current.status === 'submitted'
            ? 'Assigned case opened. Faculty objective entries are read-only. Complete and submit your separate assessment.'
            : 'Completed assessment opened read-only while your assignment remains active.', 'success');
        } catch (error) { if (viewIsCurrent(clickView)) setMessage(error.message, 'error'); }
      });
      wrapper.append(info, button); entries.push(wrapper);
    }
    ensureCurrent(view);
    box.replaceChildren(...entries);
    if (!entries.length) box.textContent = 'No submitted cases are currently available in your assignments.';
  }
  async function submitReview() {
    const view = captureView();
    try {
      if (account.mode !== 'assessor' || !account.assessor || !account.selectedCaseId || account.selectedCaseStatus !== 'submitted') {
        throw new Error('Open a submitted case assigned to your account first.');
      }
      const ready = window.KMUCalculator.getAssessmentReadiness();
      if (!ready.ready) throw new Error(`Complete the assessor fields first: ${ready.missing.join('; ')}.`);
      if (!confirm('Submit this separate assessor assessment? This pilot does not support editing a submitted review.')) return;
      window.KMUCalculator.calculate();
      const draft = window.KMUCalculator.collectDraft('tab-summary');
      const result = window.KMUCalculator.lastResult;
      const payload = {
        configVersion: draft.configVersion, source: 'assigned assessor — provisional',
        submittedBy: account.user.id, reviewerRole: draft.reviewStage.reviewerRole,
        reviewerName: draft.reviewStage.reviewerName,
        researchReviewReference: draft.research.text.input_research_review_ref || '',
        researchReviewConfirmed: draft.research.reviewConfirmed === true,
        peerScores: draft.sectionD.peerScores, cpdScores: draft.sectionD.cpdScores,
        nextCycleTargets: draft.targets, disciplinaryDeclaration: draft.redFlag,
        provisional: { subjectivePercent: result.subjectivePercent,
          subjectivePoints: result.weightedD, displayedFinalScore: result.finalScore,
          calculatedAt: new Date().toISOString(), verifiedByServer: false }
      };
      const review = first(await rpc('submit_assessor_review', {
        p_case_id: account.selectedCaseId, p_subjective_payload: payload
      }));
      ensureCurrent(view);
      if (!review?.case_id || review.case_id !== account.selectedCaseId || review.assessor_id !== account.user.id) {
        throw new Error('The database did not confirm this assessment under your account.');
      }
      account.selectedCaseStatus = 'reviewed'; account.reviewLoaded = true;
      setReviewReadonly(true); render(); window.switchTab('tab-summary');
      await listAssignedCases();
      ensureCurrent(view);
      setMessage('Assessment submitted under your assigned assessor account. Scores remain pilot calculations pending KMU approval.', 'success');
    } catch (error) { if (viewIsCurrent(view)) setMessage(error.message, 'error'); }
  }
  async function verifyActiveSelection() {
    if (account.mode !== 'assessor') return true;
    if (!account.selectedCaseId || !account.user?.id) return false;
    const view = captureView();
    try {
      const rows = await rest('assessor_assignments',
        `select=id&case_id=eq.${encode(account.selectedCaseId)}&assessor_id=eq.${encode(account.user.id)}&revoked_at=is.null`);
      ensureCurrent(view);
      if (rows?.length) return true;
    } catch (error) {
      if (!viewIsCurrent(view)) return false;
      setMessage(`Cannot verify current assignment: ${error.message}`, 'error');
    }
    account.selectedCaseId = null; account.selectedCaseStatus = null; account.reviewLoaded = false; account.caseOpen = false;
    setObjectiveReadonly(false); setReviewReadonly(false); window.KMUCalculator.loadBlank(); render();
    setMessage('This assessor assignment is no longer active. The opened case has been cleared.', 'error');
    return false;
  }
  async function loadAdmin() {
    if (account.mode !== 'administrator' || !account.administrator) throw new Error('Administrator access is not granted.');
    const view = captureView();
    ['adminAssessorId', 'adminRevokeAssessorId', 'adminCaseId', 'adminAssignAssessorId',
      'adminUnassignId'].forEach(id => $(id)?.replaceChildren());
    setText('accountAdminUsers', 'Loading administrator records…');
    setText('adminFacultyRecords', 'Loading faculty records…');
    const [profiles, assessorRoles, cases, assignments] = await Promise.all([
      rest('app_user_profiles', 'select=id,display_name,login_email,substantive_designation,leadership_role,institute,service_cadre&order=display_name.asc'),
      rest('app_assessors', 'select=user_id&revoked_at=is.null'),
      rest('appraisal_cases', 'select=id,faculty_id,cycle_year,designation,institute,status,updated_at&order=updated_at.desc'),
      rest('assessor_assignments', 'select=case_id,assessor_id&revoked_at=is.null')
    ]);
    ensureCurrent(view);
    const assessorIds = new Set((assessorRoles || []).map(row => row.user_id));
    const assignedCaseIds = new Set((assignments || []).map(row => row.case_id));
    const submittedCases = (cases || []).filter(row => row.status === 'submitted');
    const byId = new Map((profiles || []).map(row => [row.id,
      `${row.display_name || 'Unnamed account'} — ${row.login_email || 'email unavailable'} (${row.id.slice(0, 8)})`]));
    function options(selectId, entries, placeholder) {
      const select = $(selectId); if (!select) return;
      select.replaceChildren(); const firstOption = document.createElement('option');
      firstOption.value = ''; firstOption.textContent = placeholder; select.appendChild(firstOption);
      entries.forEach(([value, label]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label;
        select.appendChild(option);
      });
    }
    options('adminAssessorId', (profiles || []).filter(row => !assessorIds.has(row.id))
      .map(row => [row.id, byId.get(row.id)]), 'Select an account');
    options('adminAssignAssessorId', [...assessorIds].map(id => [id, byId.get(id) || id]), 'Select an assessor');
    options('adminRevokeAssessorId', [...assessorIds].map(id => [id, byId.get(id) || id]), 'Select an assessor');
    options('adminCaseId', submittedCases.filter(row => !assignedCaseIds.has(row.id)).map(row => [row.id,
      `${row.cycle_year} · ${byId.get(row.faculty_id) || row.designation || 'Faculty'} · ${row.id.slice(0, 8)}`]), 'Select a submitted case');
    options('adminUnassignId', (assignments || []).map(row => [
      `${row.case_id}|${row.assessor_id}`,
      `${row.case_id.slice(0, 8)} · ${byId.get(row.assessor_id) || row.assessor_id}`
    ]), 'Select an active assignment');
    setText('accountAdminUsers', `${profiles?.length || 0} registered accounts · ${assessorIds.size} assessors · ${cases?.length || 0} saved dossiers (${submittedCases.length} submitted, ${submittedCases.filter(row => !assignedCaseIds.has(row.id)).length} awaiting assignment).`);
    const roster = $('adminFacultyRecords');
    if (!roster) return;
    roster.replaceChildren();
    if (!profiles?.length) { roster.textContent = 'No registered pilot accounts found.'; return; }
    const casesByFaculty = new Map();
    (cases || []).forEach(row => {
      if (!casesByFaculty.has(row.faculty_id)) casesByFaculty.set(row.faculty_id, []);
      casesByFaculty.get(row.faculty_id).push(row);
    });
    profiles.forEach(profile => {
      const card = document.createElement('div'); card.className = 'admin-record';
      const heading = document.createElement('strong');
      heading.textContent = profile.display_name || 'Name not provided';
      const detail = document.createElement('small');
      detail.textContent = [profile.login_email, profile.substantive_designation,
        profile.leadership_role && profile.leadership_role !== 'None' ? profile.leadership_role : '',
        profile.institute, profile.service_cadre].filter(Boolean).join(' · ') || 'Employee profile incomplete';
      card.append(heading, detail);
      const facultyCases = casesByFaculty.get(profile.id) || [];
      if (!facultyCases.length) {
        const empty = document.createElement('span'); empty.className = 'admin-record-empty';
        empty.textContent = 'No saved appraisal dossier'; card.appendChild(empty);
      }
      facultyCases.forEach(row => {
        const line = document.createElement('div'); line.className = 'admin-record-case';
        const label = document.createElement('span');
        label.textContent = `${row.cycle_year} · ${row.designation} · ${row.status} · ${row.institute}`;
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'btn btn-secondary'; button.textContent = 'View dossier';
        button.addEventListener('click', () => { void openAdminCase(row.id); });
        line.append(label, button); card.appendChild(line);
      });
      roster.appendChild(card);
    });
  }
  async function openAdminCase(caseId) {
    if (account.mode !== 'administrator' || !account.administrator) throw new Error('Administrator access is not granted.');
    const view = captureView();
    try {
      const rows = await rest('appraisal_cases',
        `select=id,faculty_id,status,objective_payload&id=eq.${encode(caseId)}`);
      ensureCurrent(view);
      const selected = rows?.[0];
      if (!selected || selected.id !== caseId) throw new Error('This dossier is unavailable to the administrator account.');
      account.selectedCaseId = selected.id; account.selectedCaseStatus = selected.status;
      account.reviewLoaded = false; account.caseOpen = true;
      setObjectiveReadonly(false); setReviewReadonly(false);
      window.KMUCalculator.restoreDraft(draftFromObjective(selected.objective_payload));
      setObjectiveReadonly(true); setReviewReadonly(true); render();
      if (selected.status === 'reviewed') {
        const reviews = await rest('assessor_reviews',
          `select=case_id,subjective_payload&case_id=eq.${encode(caseId)}`);
        ensureCurrent(view);
        if (!reviews?.[0]?.subjective_payload) throw new Error('The recorded assessment could not be loaded.');
        if (!window.KMUCalculator.openCompletedCaseReport()
          || !window.KMUCalculator.applySubmittedReview(reviews[0].subjective_payload)) {
          throw new Error('The reviewed dossier could not be displayed.');
        }
        account.reviewLoaded = true; render(); window.switchTab('tab-summary');
      } else {
        window.switchTab('tab-provisional');
      }
      $('appraisalWorkspace')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      setMessage('Administrator view is read-only. The displayed evidence is the saved case snapshot.', 'success');
    } catch (error) {
      if (error instanceof StaleAccountRequest) return;
      account.selectedCaseId = null; account.selectedCaseStatus = null;
      account.reviewLoaded = false; account.caseOpen = false;
      setObjectiveReadonly(false); setReviewReadonly(false);
      window.KMUCalculator.loadBlank(); render();
      setMessage(error.message, 'error');
    }
  }
  async function setMode(mode) {
    if (accountLoading) throw new Error('Wait for your employee profile and roles to finish loading.');
    if (mode === 'assessor' && !account.assessor) throw new Error('Assessor role is not granted to this account.');
    if (mode === 'administrator' && !account.administrator) throw new Error('Administrator role is not granted to this account.');
    if (!account.user) throw new Error('Sign in first.');
    viewGeneration += 1;
    clearPrivatePanels();
    account.mode = mode; account.selectedCaseId = null; account.selectedCaseStatus = null;
    account.reviewLoaded = false; account.caseOpen = false;
    account.ownCases = null;
    setObjectiveReadonly(false); setReviewReadonly(false); window.KMUCalculator.loadBlank();
    clearLocalRecoveryNotice(); render();
    const view = captureView();
    if (mode === 'assessee') { await loadMyProfile(); await listOwnCases(); }
    if (mode === 'assessor') await listAssignedCases();
    if (mode === 'administrator') await loadAdmin();
    ensureCurrent(view);
    setMessage(`Opened ${mode} workspace.`, 'success');
  }
  function startNewFacultyCase() {
    if (account.mode !== 'assessee' || !account.user || !account.session || !account.profileComplete) {
      throw new Error('Complete and save your employee profile before starting an appraisal.');
    }
    if (account.caseOpen && !confirm('Start a blank faculty case? Unsaved entries in the open form will be lost.')) return false;
    account.selectedCaseId = null; account.selectedCaseStatus = null;
    account.reviewLoaded = false; account.caseOpen = true;
    setObjectiveReadonly(false); window.KMUCalculator.loadBlank();
    applySavedProfileToNewCase(); render();
    setMessage('New appraisal opened with your saved employee profile. Complete this cycle’s assignment and evidence, then save the cloud draft explicitly.', 'success');
    return true;
  }
  function beginFacultyTab(tabId) {
    if (account.mode !== 'assessee' || !FACULTY_TABS.has(tabId) || account.caseOpen) return false;
    if (!account.user || !account.session || !account.profileComplete) {
      setMessage('Save your complete employee profile before opening the appraisal.', 'error');
      $('employeeProfileForm')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return false;
    }
    if (account.ownCases === null) {
      setMessage('Your appraisals are still loading. Please try again in a moment.', 'error');
      return false;
    }
    if (account.ownCases.length) {
      setMessage('Open your saved case under My appraisals, or choose Start new faculty case for a different appraisal cycle.', 'error');
      $('myCaseList')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return false;
    }
    return startNewFacultyCase();
  }
  function safeAction(fn) {
    return async event => {
      event?.preventDefault?.();
      try { setMessage('Working…'); await fn(event); }
      catch (error) {
        if (!(error instanceof StaleAccountRequest)) setMessage(error.message || 'The request failed.', 'error');
      }
    };
  }
  function bind() {
    $('accountForm')?.addEventListener('submit', safeAction(async () => {
      const email = $('accountEmail').value.trim().toLowerCase(); const password = $('accountPassword').value;
      try { await authenticate(email, password); }
      finally { $('accountPassword').value = ''; }
    }));
    $('accountSignUp')?.addEventListener('click', safeAction(async () => {
      const email = $('accountEmail').value.trim().toLowerCase(); const password = $('accountPassword').value;
      try {
        if (!email || !password) throw new Error('Enter an email and password first.');
        if (password.length < 8) throw new Error('Use at least 8 characters for your portal password.');
        await register(email, password, readProfileInputs('registration'));
      } finally { $('accountPassword').value = ''; }
    }));
    $('accountRecover')?.addEventListener('click', safeAction(async () => {
      $('accountPassword').value = '';
      await requestPasswordRecovery($('accountEmail').value.trim().toLowerCase());
    }));
    $('accountPasswordSetupForm')?.addEventListener('submit', safeAction(() => finishPasswordSetup()));
    ['profileDisplayName', 'profileDesignation', 'profileLeadershipRole',
      'profileInstitute', 'profileServiceCadre'].forEach(id => {
      $(id)?.addEventListener('input', () => setProfileSaveMessage('Unsaved profile changes.'));
      $(id)?.addEventListener('change', () => setProfileSaveMessage('Unsaved profile changes.'));
    });
    $('accountSaveProfile')?.addEventListener('click', async event => {
      event?.preventDefault?.();
      const button = $('accountSaveProfile');
      if (!button || button.disabled) return;
      button.disabled = true;
      button.textContent = 'Saving employee profile…';
      setProfileSaveMessage('Saving to your employee account…');
      try {
        await saveEmployeeProfile();
        setProfileSaveMessage('Profile saved to your employee account. New appraisals will use these details.', 'success');
      } catch (error) {
        if (error instanceof StaleAccountRequest) return;
        const message = `Not saved: ${error.message || 'The account service did not confirm the save.'}`;
        setProfileSaveMessage(message, 'error');
        setMessage(message, 'error');
      } finally {
        button.disabled = false;
        button.textContent = 'Save employee profile';
      }
    });
    $('accountSyncDraftProfile')?.addEventListener('click', safeAction(() => {
      if (account.mode !== 'assessee' || !account.caseOpen || !account.profileComplete
        || (account.selectedCaseStatus && account.selectedCaseStatus !== 'draft')) {
        throw new Error('Only an open, editable employee draft can use the current job profile.');
      }
      if (!confirm('Copy your current saved employee profile into this draft? This changes the draft identity and designation; submitted cases remain unchanged. Save the cloud draft afterward to keep the change.')) return;
      window.KMUCalculator.applyEmployeeProfile(account.profile);
      render();
      setMessage('Current employee profile copied into this editable draft. Save the cloud draft to keep this change; no submitted case was altered.', 'success');
    }));
    $('accountSignOut')?.addEventListener('click', safeAction(async () => {
      const oldAccessToken = account.session?.access_token;
      accountGeneration += 1; viewGeneration += 1; signInAttempt += 1;
      accountLoading = false;
      account.session = null; account.user = null; account.assessor = false; account.administrator = false;
      account.profile = null; account.profileComplete = false; account.ownCases = null;
      account.caseOpen = false;
      account.mode = 'demo'; account.selectedCaseId = null; account.selectedCaseStatus = null; account.reviewLoaded = false;
      clearPrivatePanels();
      populateEmployeeProfileForm();
      ['accountEmail', 'accountPassword', 'accountDisplayName', 'accountDesignation',
        'accountInstitute', 'accountCadre'].forEach(id => { if ($(id)) $(id).value = ''; });
      if ($('accountLeadershipRole')) $('accountLeadershipRole').value = 'None';
      setObjectiveReadonly(false); setReviewReadonly(false); window.KMUCalculator.loadBlank();
      render(); setText('lastSavedIndicator', 'Local demo — no cloud case open');
      setMessage('Signed out. The calculator is back in local demo mode.', 'success');
      // Revoke the old session after clearing every private view. A slow logout
      // response must never keep a previous employee's workspace on screen.
      if (oldAccessToken) void fetch(`${KMU_ACCOUNT_CONFIG.url}/auth/v1/logout`, {
        method: 'POST', headers: {
          apikey: KMU_ACCOUNT_CONFIG.publishableKey,
          Authorization: `Bearer ${oldAccessToken}`
        }, cache: 'no-store', referrerPolicy: 'no-referrer'
      }).catch(() => null);
    }));
    $('accountAssesseeMode')?.addEventListener('click', safeAction(() => setMode('assessee')));
    $('accountAssessorMode')?.addEventListener('click', safeAction(() => setMode('assessor')));
    $('accountAdminMode')?.addEventListener('click', safeAction(() => setMode('administrator')));
    $('accountRefreshCases')?.addEventListener('click', safeAction(() => listOwnCases()));
    $('accountRefreshQueue')?.addEventListener('click', safeAction(() => listAssignedCases()));
    $('accountRefreshAdmin')?.addEventListener('click', safeAction(() => loadAdmin()));
    $('adminCloseCase')?.addEventListener('click', safeAction(() => {
      if (account.mode !== 'administrator') return;
      viewGeneration += 1;
      account.selectedCaseId = null; account.selectedCaseStatus = null;
      account.reviewLoaded = false; account.caseOpen = false;
      setObjectiveReadonly(false); setReviewReadonly(false);
      window.KMUCalculator.loadBlank(); render();
      $('accountAdminPanel')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      setMessage('Returned to the administrator’s faculty records.', 'success');
    }));
    $('accountNewCase')?.addEventListener('click', safeAction(() => {
      if (startNewFacultyCase()) window.switchTab('tab-meta');
    }));
    $('accountSubmitReview')?.addEventListener('click', safeAction(() => submitReview()));
    $('adminGrantAssessor')?.addEventListener('click', safeAction(async () => {
      const userId = $('adminAssessorId').value;
      if (!userId) throw new Error('Choose a registered account first.');
      if (!confirm('Grant this account assessor access?')) return;
      await rpc('grant_assessor', { p_user_id: userId }); await loadAdmin();
      setMessage('Assessor access granted by the administrator account.', 'success');
    }));
    $('adminRevokeAssessor')?.addEventListener('click', safeAction(async () => {
      const userId = $('adminRevokeAssessorId').value;
      if (!userId) throw new Error('Choose an assessor first.');
      if (!confirm('Revoke this account’s assessor access and active assignments?')) return;
      await rpc('revoke_assessor', { p_user_id: userId }); await loadAdmin();
      setMessage('Assessor access revoked.', 'success');
    }));
    $('adminAssignCase')?.addEventListener('click', safeAction(async () => {
      const caseId = $('adminCaseId').value, assessorId = $('adminAssignAssessorId').value;
      if (!caseId || !assessorId) throw new Error('Choose both a submitted case and an assessor.');
      if (!confirm('Assign this submitted case to the selected assessor?')) return;
      await rpc('assign_assessor', { p_case_id: caseId, p_assessor_id: assessorId }); await loadAdmin();
      setMessage('Case assigned. The assessor can now see it in their queue.', 'success');
    }));
    $('adminUnassignCase')?.addEventListener('click', safeAction(async () => {
      const [caseId, assessorId] = ($('adminUnassignId').value || '').split('|');
      if (!caseId || !assessorId) throw new Error('Choose an active assignment first.');
      if (!confirm('Revoke this assessor’s access to the selected case?')) return;
      await rpc('unassign_assessor', { p_case_id: caseId, p_assessor_id: assessorId }); await loadAdmin();
      setMessage('Case assignment revoked.', 'success');
    }));
  }
  document.addEventListener('DOMContentLoaded', () => {
    populateProfileSelects(); bind(); render();
    if (pendingAuthRedirect) {
      void processAuthRedirect();
    }
    if (!KMU_ACCOUNT_CONFIG.backendVerified) {
      ['accountSignIn', 'accountSignUp', 'accountRecover'].forEach(id => { if ($(id)) $(id).disabled = true; });
      if (!pendingAuthRedirect) setMessage('Account sign-in will open after the database security checks pass. The calculator remains available as a local demo.');
    }
  });
})();

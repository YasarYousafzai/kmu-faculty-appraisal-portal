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
  const ACCOUNT_REVIEW_TABS = new Set(['tab-peer', 'tab-targets', 'tab-redflag', 'tab-summary']);
  const OBJECTIVE_TABS = ['tab-meta', 'tab-teaching', 'tab-research', 'tab-clinical', 'tab-service'];
  const MAX_PAYLOAD_BYTES = 180000;
  const account = window.KMUAccount = {
    mode: 'demo', session: null, user: null, assessor: false, administrator: false,
    selectedCaseId: null, selectedCaseStatus: null, reviewLoaded: false,
    backendVerified: KMU_ACCOUNT_CONFIG.backendVerified,
    buildObjectivePayload: () => objectivePayload(),
    canOpenTab(tabId) {
      if (this.mode === 'demo') return true;
      if (this.mode === 'assessee') {
        if (tabId === 'tab-summary') return this.selectedCaseStatus === 'reviewed' && this.reviewLoaded;
        return !ACCOUNT_REVIEW_TABS.has(tabId);
      }
      if (this.mode === 'administrator') return !ACCOUNT_REVIEW_TABS.has(tabId);
      return this.mode === 'assessor' && (!ACCOUNT_REVIEW_TABS.has(tabId)
        || Boolean(this.selectedCaseId && ['submitted', 'reviewed'].includes(this.selectedCaseStatus)));
    },
    saveCurrent: () => saveCurrent(),
    submitObjective: () => submitObjective(),
    verifyActiveSelection: () => verifyActiveSelection()
  };

  function setMessage(text, kind = '') {
    const node = $('accountMessage');
    if (node) { node.textContent = text; node.className = `account-message ${kind}`.trim(); }
  }
  function setText(id, value) { const node = $(id); if (node) node.textContent = String(value); }
  function show(id, visible) { const node = $(id); if (node) node.hidden = !visible; }
  function clearPrivatePanels() {
    ['myCaseList', 'assessorQueue', 'accountAdminUsers', 'adminAssessorId',
      'adminRevokeAssessorId', 'adminCaseId', 'adminAssignAssessorId', 'adminUnassignId']
      .forEach(id => $(id)?.replaceChildren());
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
    const headers = { apikey: KMU_ACCOUNT_CONFIG.publishableKey, 'Content-Type': 'application/json' };
    if (authenticated) headers.Authorization = `Bearer ${account.session.access_token}`;
    const response = await fetch(`${KMU_ACCOUNT_CONFIG.url}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', referrerPolicy: 'no-referrer'
    });
    if (response.status === 401 && authenticated && retry && account.session?.refresh_token) {
      await refreshSession();
      return request(path, { method, body, authenticated, retry: false });
    }
    const raw = await response.text();
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* API errors may be plain text. */ }
    if (!response.ok) throw plainError(parsed, `The account service returned ${response.status}.`);
    return parsed;
  }
  async function refreshSession() {
    const token = account.session?.refresh_token;
    if (!token) throw new Error('Your session expired; sign in again.');
    const response = await fetch(`${KMU_ACCOUNT_CONFIG.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: KMU_ACCOUNT_CONFIG.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token }), cache: 'no-store', referrerPolicy: 'no-referrer'
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access_token) { account.session = null; throw plainError(data, 'Your session expired; sign in again.'); }
    account.session = data;
  }
  const rest = (table, query) => request(`/rest/v1/${table}?${query}`);
  const rpc = (name, body) => request(`/rest/v1/rpc/${name}`, { method: 'POST', body });
  const first = result => Array.isArray(result) ? result[0] : result;
  const encode = value => encodeURIComponent(String(value));

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
    show('accountAssessorMode', signed && account.assessor);
    show('accountAdminMode', signed && account.administrator);
    show('accountCasePanel', signed && account.mode === 'assessee');
    show('accountQueuePanel', signed && account.mode === 'assessor');
    show('accountAdminPanel', signed && account.mode === 'administrator');
    show('accountSubmitReview', account.mode === 'assessor'
      && Boolean(account.selectedCaseId && account.selectedCaseStatus === 'submitted'));
    setText('accountModeBadge', signed ? ({ assessee: 'Faculty', assessor: 'Assessor', administrator: 'Administrator' }[account.mode] || 'Account') : 'Local demo');
    setText('accountStatus', authLinkOpen
      ? pendingPasswordSetup ? `Complete password setup for ${pendingPasswordSetup.email}.` : 'Checking the account link…'
      : signed ? `Signed in as ${account.user.email}. ${account.mode === 'assessor'
        ? 'Assigned assessor workspace.' : account.mode === 'administrator' ? 'Administrator workspace.' : 'Faculty (assessee) workspace.'}`
      : 'Local demo mode — no shared case or assessor access.');
    setText('provisionalStorageNote', account.mode === 'assessee'
      ? account.selectedCaseStatus === 'submitted'
        ? 'This faculty case has been submitted and is read-only. Its score remains a provisional faculty calculation, not a verified or official appraisal.'
        : 'Save the faculty-only objective draft to your account, then explicitly submit it for assignment to an assessor. Nothing from an older browser draft is uploaded automatically.'
      : account.mode === 'demo'
        ? 'In local demo mode, saving keeps the draft only in this browser and does not submit it to an assessor. Use fictional or non-confidential data.'
        : 'Objective entries are read-only here. Only the faculty account can submit the objective case.');
    setText('objectiveSaveButton', account.mode === 'assessee' ? '💾 Save cloud draft' : '💾 Save provisional dossier on this browser');
    setText('objectiveSubmitButton', account.mode === 'assessee' ? 'Submit objective case to assessor queue ➔' : 'Continue to Committee Assessment ➔');
    setText('headerSaveButton', account.mode === 'assessee' ? '💾 Save cloud draft' : '💾 Save & Return Later');
    show('headerSaveButton', account.mode === 'demo' || account.mode === 'assessee');
    setText('reviewAccessNote', account.mode === 'assessor'
      ? 'This case was retrieved under your assigned assessor account. Only the separate subjective assessment is submitted by you; faculty objective entries are read-only and still require institutional verification.'
      : account.mode === 'demo'
        ? 'Local demo mode has no assessor authentication: the faculty-to-reviewer transition is only a page sequence. Do not use it for real personnel decisions.'
        : 'Only an assigned assessor can open this stage after the faculty member submits the objective case.');
    const cloudSaveIndicator = account.mode === 'assessee'
      ? account.selectedCaseStatus === 'submitted' ? 'Cloud case submitted' : 'Cloud draft not saved this session'
      : account.mode === 'assessor' ? 'Assessment not submitted' : null;
    if (cloudSaveIndicator) setText('lastSavedIndicator', cloudSaveIndicator);
    window.KMUCalculator.calculate();
  }
  function clearLocalRecoveryNotice() { show('draftRecoveryBanner', false); }
  async function activateSession(data) {
    if (!data?.access_token || !data?.user?.id) throw new Error('Sign-in did not return a valid account session.');
    account.session = data; account.user = data.user;
    try {
      const uid = encode(data.user.id);
      const [assessorRows, adminRows] = await Promise.all([
        rest('app_assessors', `select=user_id&user_id=eq.${uid}&revoked_at=is.null`),
        rest('app_administrators', `select=user_id&user_id=eq.${uid}&revoked_at=is.null`)
      ]);
      account.assessor = Array.isArray(assessorRows) && assessorRows.length > 0;
      account.administrator = Array.isArray(adminRows) && adminRows.length > 0;
      account.mode = 'assessee'; account.selectedCaseId = null; account.selectedCaseStatus = null; account.reviewLoaded = false;
      clearLocalRecoveryNotice();
      setObjectiveReadonly(false); setReviewReadonly(false);
      window.KMUCalculator.loadBlank(); render(); await listOwnCases();
      setMessage('Signed in. Choose an existing cloud case or start a new one. Local browser drafts were not uploaded.', 'success');
    } catch (error) {
      account.session = null; account.user = null; account.mode = 'demo';
      account.assessor = false; account.administrator = false; clearPrivatePanels(); render();
      throw new Error(`Account access is not ready: ${error.message}`);
    }
  }
  async function authenticate(email, password) {
    const data = await request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email, password }, authenticated: false
    });
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
  async function register(email, password, displayName) {
    if (!displayName.trim()) throw new Error('Enter your name for the faculty account.');
    const redirectTo = 'https://yasaryousafzai.github.io/kmu-faculty-appraisal-portal/';
    const result = await request(`/auth/v1/signup?redirect_to=${encode(redirectTo)}`, {
      method: 'POST', body: { email, password, data: { display_name: displayName.trim() } }, authenticated: false
    });
    // Raw GoTrue REST returns a top-level user for confirmation-required signups,
    // and a session-shaped response when email confirmation is not required.
    if (!result?.id && !result?.user?.id) throw new Error('Registration did not return an account.');
    if (result.access_token) {
      await authenticate(email, password);
    } else {
      setMessage('Registration requested. Check your email for a confirmation link, then sign in. Your account starts as faculty/assessee only.', 'success');
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
    if (!saved?.id || saved.faculty_id !== account.user.id || saved.status !== 'draft') {
      throw new Error('The database did not confirm ownership of the saved draft.');
    }
    account.selectedCaseId = saved.id; account.selectedCaseStatus = saved.status; account.reviewLoaded = false;
    setText('lastSavedIndicator', 'Cloud draft saved');
    if (!quiet) setMessage('Cloud draft saved to your faculty account. It has not been submitted to an assessor.', 'success');
    await listOwnCases();
    return saved;
  }
  async function submitObjective() {
    try {
      if (account.mode !== 'assessee') throw new Error('Sign in as faculty to submit the objective case.');
      const readiness = window.KMUCalculator.getObjectiveReadiness();
      if (!readiness.ready) throw new Error(`Complete these objective entries first: ${readiness.missing.join('; ')}.`);
      const saved = await saveObjective({ quiet: true });
      if (!confirm('Submit this objective case for administrator assignment to an assessor? You cannot edit it after submission.')) return false;
      const submitted = first(await rpc('submit_appraisal_case', { p_case_id: saved.id }));
      if (!submitted?.id || submitted.status !== 'submitted') throw new Error('The database did not confirm submission.');
      account.selectedCaseStatus = submitted.status; account.reviewLoaded = false;
      setObjectiveReadonly(true); render();
      setText('lastSavedIndicator', 'Cloud case submitted');
      await listOwnCases();
      setMessage('Objective case submitted. It is awaiting administrator assignment to an assessor; no reviewer has been automatically appointed.', 'success');
      return true;
    } catch (error) { setMessage(error.message, 'error'); return false; }
  }
  async function saveCurrent() {
    try {
      if (account.mode === 'assessee') return await saveObjective();
      if (account.mode === 'assessor') throw new Error('Assessor entries remain in this tab until you submit them. Draft assessment saving is not available in this pilot.');
      throw new Error('Switch to your faculty case to save objective evidence.');
    } catch (error) { setMessage(error.message, 'error'); return false; }
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
    const rows = await rest('appraisal_cases', `select=id,faculty_id,cycle_year,designation,institute,status,updated_at&faculty_id=eq.${encode(account.user.id)}&order=updated_at.desc`);
    const box = $('myCaseList'); if (!box) return;
    box.replaceChildren();
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
        try {
          const caseRows = await rest('appraisal_cases', `select=id,faculty_id,cycle_year,status,objective_payload&id=eq.${encode(row.id)}&faculty_id=eq.${encode(account.user.id)}`);
          const current = caseRows?.[0];
          if (!current || current.faculty_id !== account.user.id) throw new Error('This faculty case is unavailable.');
          setObjectiveReadonly(false); window.KMUCalculator.restoreDraft(draftFromObjective(current.objective_payload));
          account.selectedCaseId = current.id; account.selectedCaseStatus = current.status; account.reviewLoaded = false;
          setObjectiveReadonly(current.status !== 'draft'); setReviewReadonly(true); render();
          if (current.status === 'reviewed') {
            const reviews = await rest('assessor_reviews', `select=case_id,subjective_payload&case_id=eq.${encode(row.id)}`);
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
        } catch (error) { setMessage(error.message, 'error'); }
      });
      wrapper.append(info, button); box.appendChild(wrapper);
    });
  }
  async function listAssignedCases() {
    if (account.mode !== 'assessor' || !account.assessor) throw new Error('Assessor access has not been granted to this account.');
    const assignments = await rest('assessor_assignments', `select=case_id&assessor_id=eq.${encode(account.user.id)}&revoked_at=is.null`);
    const box = $('assessorQueue'); if (!box) return;
    box.replaceChildren();
    if (!assignments?.length) { box.textContent = 'No cases are assigned to your account.'; return; }
    for (const assignment of assignments) {
      const rows = await rest('appraisal_cases', `select=id,faculty_id,cycle_year,designation,institute,status&id=eq.${encode(assignment.case_id)}`);
      const row = rows?.[0]; if (!row) continue;
      const profiles = await rest('app_user_profiles', `select=display_name&id=eq.${encode(row.faculty_id)}`);
      const facultyName = profiles?.[0]?.display_name?.trim() || 'Faculty name unavailable';
      const wrapper = document.createElement('div'); wrapper.className = 'account-list-row';
      const info = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = `${facultyName} · ${row.cycle_year} — ${row.designation || 'Faculty'} · ${row.status}`;
      const sub = document.createElement('small'); sub.textContent = row.institute || 'KMU unit not recorded';
      info.append(title, sub);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn-secondary';
      button.textContent = row.status === 'reviewed' ? 'View submitted case' : 'Open assessment';
      button.addEventListener('click', async () => {
        try {
          const stillAssigned = await rest('assessor_assignments', `select=id&case_id=eq.${encode(row.id)}&assessor_id=eq.${encode(account.user.id)}&revoked_at=is.null`);
          if (!stillAssigned?.length) throw new Error('This assignment is no longer active. Refresh your queue.');
          const caseRows = await rest('appraisal_cases', `select=id,faculty_id,status,objective_payload&id=eq.${encode(row.id)}`);
          const current = caseRows?.[0];
          if (!current || !['submitted', 'reviewed'].includes(current.status)) {
            throw new Error('The assigned case is no longer available for review.');
          }
          setObjectiveReadonly(false); setReviewReadonly(false);
          window.KMUCalculator.restoreDraft(draftFromObjective(current.objective_payload));
          account.selectedCaseId = current.id; account.selectedCaseStatus = current.status; account.reviewLoaded = false;
          setObjectiveReadonly(true); setReviewReadonly(current.status !== 'submitted'); render();
          window.KMUCalculator.openAssignedCaseForReview();
          if (current.status === 'reviewed') {
            const reviews = await rest('assessor_reviews', `select=case_id,assessor_id,subjective_payload&case_id=eq.${encode(row.id)}`);
            const review = reviews?.[0];
            if (!review || review.assessor_id !== account.user.id) throw new Error('The completed review is unavailable to this account.');
            window.KMUCalculator.applySubmittedReview(review.subjective_payload);
            account.reviewLoaded = true;
            window.switchTab('tab-summary');
          }
          setMessage(current.status === 'submitted'
            ? 'Assigned case opened. Faculty objective entries are read-only. Complete and submit your separate assessment.'
            : 'Completed assessment opened read-only while your assignment remains active.', 'success');
        } catch (error) { setMessage(error.message, 'error'); }
      });
      wrapper.append(info, button); box.appendChild(wrapper);
    }
  }
  async function submitReview() {
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
      if (!review?.case_id || review.case_id !== account.selectedCaseId || review.assessor_id !== account.user.id) {
        throw new Error('The database did not confirm this assessment under your account.');
      }
      account.selectedCaseStatus = 'reviewed'; account.reviewLoaded = true;
      setReviewReadonly(true); render(); window.switchTab('tab-summary');
      await listAssignedCases();
      setMessage('Assessment submitted under your assigned assessor account. Scores remain pilot calculations pending KMU approval.', 'success');
    } catch (error) { setMessage(error.message, 'error'); }
  }
  async function verifyActiveSelection() {
    if (account.mode !== 'assessor') return true;
    if (!account.selectedCaseId || !account.user?.id) return false;
    try {
      const rows = await rest('assessor_assignments',
        `select=id&case_id=eq.${encode(account.selectedCaseId)}&assessor_id=eq.${encode(account.user.id)}&revoked_at=is.null`);
      if (rows?.length) return true;
    } catch (error) {
      setMessage(`Cannot verify current assignment: ${error.message}`, 'error');
    }
    account.selectedCaseId = null; account.selectedCaseStatus = null; account.reviewLoaded = false;
    setObjectiveReadonly(false); setReviewReadonly(false); window.KMUCalculator.loadBlank(); render();
    setMessage('This assessor assignment is no longer active. The opened case has been cleared.', 'error');
    return false;
  }
  async function loadAdmin() {
    if (account.mode !== 'administrator' || !account.administrator) throw new Error('Administrator access is not granted.');
    const [profiles, assessorRoles, cases, assignments] = await Promise.all([
      rest('app_user_profiles', 'select=id,display_name,login_email&order=display_name.asc'),
      rest('app_assessors', 'select=user_id&revoked_at=is.null'),
      rest('appraisal_cases', 'select=id,faculty_id,cycle_year,designation,status&status=eq.submitted&order=updated_at.desc'),
      rest('assessor_assignments', 'select=case_id,assessor_id&revoked_at=is.null')
    ]);
    const assessorIds = new Set((assessorRoles || []).map(row => row.user_id));
    const assignedCaseIds = new Set((assignments || []).map(row => row.case_id));
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
    options('adminCaseId', (cases || []).filter(row => !assignedCaseIds.has(row.id)).map(row => [row.id,
      `${row.cycle_year} · ${byId.get(row.faculty_id) || row.designation || 'Faculty'} · ${row.id.slice(0, 8)}`]), 'Select a submitted case');
    options('adminUnassignId', (assignments || []).map(row => [
      `${row.case_id}|${row.assessor_id}`,
      `${row.case_id.slice(0, 8)} · ${byId.get(row.assessor_id) || row.assessor_id}`
    ]), 'Select an active assignment');
    setText('accountAdminUsers', `${profiles?.length || 0} registered accounts · ${assessorIds.size} assessors · ${cases?.length || 0} submitted cases available for assignment.`);
  }
  async function setMode(mode) {
    if (mode === 'assessor' && !account.assessor) throw new Error('Assessor role is not granted to this account.');
    if (mode === 'administrator' && !account.administrator) throw new Error('Administrator role is not granted to this account.');
    if (!account.user) throw new Error('Sign in first.');
    account.mode = mode; account.selectedCaseId = null; account.selectedCaseStatus = null; account.reviewLoaded = false;
    setObjectiveReadonly(false); setReviewReadonly(false); window.KMUCalculator.loadBlank();
    clearLocalRecoveryNotice(); render();
    if (mode === 'assessee') await listOwnCases();
    if (mode === 'assessor') await listAssignedCases();
    if (mode === 'administrator') await loadAdmin();
    setMessage(`Opened ${mode} workspace.`, 'success');
  }
  function safeAction(fn) {
    return async event => {
      event?.preventDefault?.();
      try { setMessage('Working…'); await fn(event); }
      catch (error) { setMessage(error.message || 'The request failed.', 'error'); }
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
      const name = $('accountDisplayName').value;
      try {
        if (!email || !password) throw new Error('Enter an email and password first.');
        await register(email, password, name);
      } finally { $('accountPassword').value = ''; }
    }));
    $('accountRecover')?.addEventListener('click', safeAction(async () => {
      $('accountPassword').value = '';
      await requestPasswordRecovery($('accountEmail').value.trim().toLowerCase());
    }));
    $('accountPasswordSetupForm')?.addEventListener('submit', safeAction(() => finishPasswordSetup()));
    $('accountSignOut')?.addEventListener('click', safeAction(async () => {
      if (account.session?.access_token) await request('/auth/v1/logout', { method: 'POST' }).catch(() => null);
      account.session = null; account.user = null; account.assessor = false; account.administrator = false;
      account.mode = 'demo'; account.selectedCaseId = null; account.selectedCaseStatus = null; account.reviewLoaded = false;
      clearPrivatePanels();
      setObjectiveReadonly(false); setReviewReadonly(false); window.KMUCalculator.loadBlank();
      render(); setText('lastSavedIndicator', 'Local demo — no cloud case open');
      setMessage('Signed out. The calculator is back in local demo mode.', 'success');
    }));
    $('accountAssesseeMode')?.addEventListener('click', safeAction(() => setMode('assessee')));
    $('accountAssessorMode')?.addEventListener('click', safeAction(() => setMode('assessor')));
    $('accountAdminMode')?.addEventListener('click', safeAction(() => setMode('administrator')));
    $('accountRefreshCases')?.addEventListener('click', safeAction(() => listOwnCases()));
    $('accountRefreshQueue')?.addEventListener('click', safeAction(() => listAssignedCases()));
    $('accountRefreshAdmin')?.addEventListener('click', safeAction(() => loadAdmin()));
    $('accountNewCase')?.addEventListener('click', safeAction(() => {
      if (!confirm('Start a blank faculty case? Unsaved entries in the open form will be lost.')) return;
      account.selectedCaseId = null; account.selectedCaseStatus = null; account.reviewLoaded = false;
      setObjectiveReadonly(false); window.KMUCalculator.loadBlank(); render(); window.switchTab('tab-meta');
      setMessage('Blank faculty case opened. Save it explicitly when ready.', 'success');
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
    bind(); render();
    if (pendingAuthRedirect) {
      void processAuthRedirect();
    }
    if (!KMU_ACCOUNT_CONFIG.backendVerified) {
      ['accountSignIn', 'accountSignUp', 'accountRecover'].forEach(id => { if ($(id)) $(id).disabled = true; });
      if (!pendingAuthRedirect) setMessage('Account sign-in will open after the database security checks pass. The calculator remains available as a local demo.');
    }
  });
})();

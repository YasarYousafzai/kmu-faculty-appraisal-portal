/**
 * KMU Faculty Annual Performance Appraisal System (v3.0)
 * Official statutory engine implementing KMU/REG/POL/2026/01-REV
 * Features:
 * - Real-time calculation according to Section 9 formulas and ceilings
 * - Calendar year cycle: 01 January to 31 December
 * - Appraising Officer designated as Concerned Dean
 * - Non-essential fields for 3 Appraisal Committee Members
 * - Separate Objective and Subjective (Dean's) scoring and grading scales
 * - Structured next year's targets section matching guidance and Excel calculator
 * - Explicit clarification note on teaching workload
 * - Research Grants Ledger with Funding Agency & Grant Amount directly calculating marks
 * - Save & Continue on every section
 * - Save & Return Later with local persistence and cross-device backup export
 */

// Statutory Profile Configuration Matrix
const PROFILES = {
  'Balanced Profile': {
    name: 'Balanced Profile',
    teachingWeight: 30,
    researchWeight: 30,
    serviceWeight: 20,
    peerWeight: 20,
    clinicalWeight: 0,
    minTeachingWU: 30,
    description: 'Standard teaching, postgraduate research and departmental service profile.'
  },
  'Research-Focused Profile': {
    name: 'Research-Focused Profile',
    teachingWeight: 20,
    researchWeight: 50,
    serviceWeight: 15,
    peerWeight: 15,
    clinicalWeight: 0,
    minTeachingWU: 20,
    description: 'High research-intensity faculty and grant investigators.'
  },
  'Teaching-Focused Profile (Regional IHS)': {
    name: 'Teaching-Focused Profile (Regional IHS)',
    teachingWeight: 50,
    researchWeight: 15,
    serviceWeight: 20,
    peerWeight: 15,
    clinicalWeight: 0,
    minTeachingWU: 50,
    description: 'Regional Institute of Health Sciences faculty with heavy contact hours.'
  },
  'Clinical-Focused Profile (Hospital Faculty)': {
    name: 'Clinical-Focused Profile (Hospital Faculty)',
    teachingWeight: 15,
    researchWeight: 20,
    serviceWeight: 10,
    peerWeight: 10,
    clinicalWeight: 45,
    minTeachingWU: 15,
    description: 'Faculty managing hospital teaching units, wards, OPDs and emergency care.'
  },
  'Research Cadres / Postdocs': {
    name: 'Research Cadres / Postdocs',
    teachingWeight: 10,
    researchWeight: 65,
    serviceWeight: 10,
    peerWeight: 15,
    clinicalWeight: 0,
    minTeachingWU: 10,
    description: 'Dedicated postdocs, research scientists, and specialized laboratory investigators.'
  }
};

// 13 Core Parameters (Rated 1 - 6, Max 78) - Evaluated by Concerned Dean
const PEER_PARAMETERS = [
  { id: 'peer_1', label: '1. Punctuality & Attendance', desc: 'Punctuality at lectures, duties and institutional meetings.' },
  { id: 'peer_2', label: '2. Collegiality & Teamwork', desc: 'Constructive contribution to faculty and departmental harmony.' },
  { id: 'peer_3', label: '3. Communication Skills', desc: 'Clear, respectful, and articulate interaction with colleagues and students.' },
  { id: 'peer_4', label: '4. Ethical Conduct & Integrity', desc: 'Moral rectitude, research honesty, exam confidentiality and fairness.' },
  { id: 'peer_5', label: '5. Responsiveness to Students/Patients', desc: 'Accessibility and timely grievance addressal for learners/clients.' },
  { id: 'peer_6', label: '6. Mentorship of Junior Colleagues', desc: 'Proactive support and guidance for junior faculty and scholars.' },
  { id: 'peer_7', label: '7. Compliance with Policies & SOPs', desc: 'Adherence to KMU statutes, biosafety codes, and administrative guidelines.' },
  { id: 'peer_8', label: '8. Initiative & Proactivity', desc: 'Self-driven efforts to improve institutional programs and laboratories.' },
  { id: 'peer_9', label: '9. Conflict Resolution & Composure', desc: 'Maturity and professionalism in handling disagreements.' },
  { id: 'peer_10', label: '10. Adaptability to Change', desc: 'Flexibility with curriculum changes, LMS systems and organizational updates.' },
  { id: 'peer_11', label: '11. Professional Decorum & Appearance', desc: 'Role-model behavior reflecting the dignity of the university.' },
  { id: 'peer_12', label: '12. Institutional Citizenship & Loyalty', desc: 'Dedication to KMU vision, reputation, and public service missions.' },
  { id: 'peer_13', label: '13. Quality & Timeliness of Records', desc: 'Attendance submission, student logs, and file turnaround.' }
];

// 5 CPD Targets (Rated 0 - 2, Max 10) - Evaluated by Concerned Dean
const CPD_TARGETS = [
  { id: 'cpd_1', label: 'CME/CPD Credit Hours vs Annual Target', desc: 'Approved professional development credit hours earned.' },
  { id: 'cpd_2', label: 'Workshop / Training / Short Course Attended', desc: 'Formally documented capacity-building program.' },
  { id: 'cpd_3', label: 'Professional Certification Obtained or Renewed', desc: 'Board, council, or specialized technical credential.' },
  { id: 'cpd_4', label: 'Cross-Training / New Technical Skill Acquired', desc: 'Mastery of new laboratory assays or pedagogical technology.' },
  { id: 'cpd_5', label: 'Presenter / Facilitator at a CPD Event', desc: 'Resource person for conferences, webinars, or workshops.' }
];

// Sample Grants Ledger
const DEFAULT_GRANTS = [
  { id: 'g1', title: 'Molecular Genomic Surveillance of Enteric Pathogens in KP', agency: 'Higher Education Commission (HEC)', amount: 7500000, role: 'PI', status: 'Won', points: 8 },
  { id: 'g2', title: 'Multi-center Genomic Analysis of SFTSV & Tick-Borne Arboviruses', agency: 'NIH / International Consortium', amount: 15000000, role: 'Co-PI', status: 'Won', points: 4.5 },
  { id: 'g3', title: 'KMU IPDM Internal Laboratory Innovation & Biobanking Assay Setup', agency: 'KMU Internal Start-Up Grant', amount: 850000, role: 'PI', status: 'Won', points: 4 },
  { id: 'g4', title: 'Prenatal Beta-Thalassemia Rapid Screening Assay Commercialization', agency: 'Pakistan Science Foundation (PSF)', amount: 6500000, role: 'PI', status: 'Applied', points: 2 },
  { id: 'g5', title: 'Point-of-Care Molecular Diagnostic Kit for Primary Healthcare', agency: 'Global Challenges Fund (GCF)', amount: 12000000, role: 'Co-PI', status: 'Applied', points: 2 }
];

// State container
let appraisalState = {
  employee: {
    name: 'Dr. Yasar Mehmood Yousafzai',
    designation: 'Associate Professor',
    department: 'Institute of Pathology & Diagnostic Medicine (IPDM)',
    faculty: 'Faculty of Pathology & Diagnostic Medicine (FPDM)',
    payScale: 'BPS-20 (Regular)',
    cycle: '2026 (01 January – 31 December 2026)',
    appraiser: 'Dean, Faculty of Pathology & Diagnostic Medicine',
    reviewer: 'Vice Chancellor, KMU',
    committeeMember1: 'Prof. Dr. Muhammad Saleem, Professor IBMS',
    committeeMember2: 'Dr. Bushra Rehman, Assistant Professor IPDM',
    committeeMember3: 'Dr. Kinza Ayaz, Assistant Professor IPDM'
  },
  selectedProfile: 'Balanced Profile',
  sectionA: { qecScore: 86, actualWU: 34, exempted: 'N' },
  sectionB: {
    pub_high_lead: 2, pub_high_co: 2, pub_mod_lead: 3, pub_mod_co: 2, pub_low_lead: 1, pub_low_co: 0,
    book_int: 0, book_nat: 1, chapter_int: 2, chapter_nat: 1,
    sup_phd: 2, sup_mphil: 4, sup_clin_sr: 0, sup_clin_jr: 0,
    innov_patent_int: 0, innov_patent_nat: 1, innov_project: 1, innov_overhead: 2
  },
  grantsList: [...DEFAULT_GRANTS],
  sectionC: {
    comm_member: 4, comm_chair: 1, policy_doc: 3, facility_charge: 1, additional_appoint: 'N'
  },
  sectionD: {
    peerScores: {
      peer_1: 5, peer_2: 5, peer_3: 6, peer_4: 6, peer_5: 5,
      peer_6: 5, peer_7: 6, peer_8: 5, peer_9: 5, peer_10: 5,
      peer_11: 6, peer_12: 6, peer_13: 5
    },
    cpdScores: { cpd_1: 2, cpd_2: 2, cpd_3: 1, cpd_4: 2, cpd_5: 2 }
  },
  sectionE: { clin_admin: 0, clin_volume: 0, clin_oncall: 0, clin_teaching: 0 },
  nextYearTargets: {
    teaching: 'Deliver minimum 34 teaching Workload Units across BS and MPhil pathology courses; maintain verified course folders on CMS and target QEC student evaluation score >85%.',
    publications: 'Publish at least 3 peer-reviewed original research manuscripts in indexed W/X category journals with Impact Factor >= 5.0.',
    grants: 'Submit at least 2 major competitive research grant proposals to national (HEC/PSF) and international funding agencies (Wellcome/NIH) with minimum target volume >PKR 10 Million.',
    supervision: 'Supervise 2 enrolled PhD scholars through ASRB milestone defense and guide 4 MPhil candidates towards successful thesis completion.',
    service_cpd: 'Maintain diagnostic quality standards for IPDM laboratories, complete 30 CME/CPD credit hours, and lead curriculum module revision.'
  },
  redFlag: { penalty: 0, refNo: '', refDate: '' }
};

// Global Tab Switching function
window.switchTab = function(tabId) {
  const contents = document.querySelectorAll('.tab-content');
  const navItems = document.querySelectorAll('.nav-item');
  const wizardSteps = document.querySelectorAll('.wizard-step');

  contents.forEach(tab => tab.classList.remove('active'));
  navItems.forEach(item => item.classList.remove('active'));
  wizardSteps.forEach(step => step.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  const targetNav = document.querySelector(`[data-tab="${tabId}"]`);
  const targetStep = document.querySelector(`[data-wizard="${tabId}"]`);

  if (targetTab) targetTab.classList.add('active');
  if (targetNav) targetNav.classList.add('active');
  if (targetStep) targetStep.classList.add('active');

  if (typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// SAVE AND CONTINUE FUNCTION
window.saveAndContinue = function(nextTabId, sectionLabel) {
  saveAllData(nextTabId);
  window.switchTab(nextTabId);
  showToast(`✓ Saved! Continuing to ${sectionLabel}`);
};

// SAVE AND RETURN LATER FUNCTION
window.saveAndReturnLater = function() {
  const currentActiveTab = document.querySelector('.tab-content.active')?.id || 'tab-meta';
  saveAllData(currentActiveTab);
  
  const empName = document.getElementById('input_emp_name')?.value || 'Faculty Member';
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const modalTime = document.getElementById('saveModalTime');
  const modalEmp = document.getElementById('saveModalSummary');
  const modalStep = document.getElementById('saveModalStep');
  
  if (modalTime) modalTime.textContent = timeStr;
  if (modalEmp) modalEmp.textContent = empName;
  if (modalStep) {
    const stepName = document.querySelector(`[data-wizard="${currentActiveTab}"] span:last-child`)?.textContent || 'Current Section';
    modalStep.textContent = stepName;
  }
  
  window.openModal('saveReturnModal');
  showToast(`✓ Progress safely saved! You can resume anytime.`);
};

// CORE DATA SERIALIZATION ENGINE
function saveAllData(activeTabId) {
  const currentTab = activeTabId || document.querySelector('.tab-content.active')?.id || 'tab-meta';
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const draft = {
    lastActiveTab: currentTab,
    savedAt: now.toISOString(),
    savedTimeFormatted: timeStr,
    profile: appraisalState.selectedProfile,
    meta: {
      name: document.getElementById('input_emp_name')?.value || '',
      desig: document.getElementById('input_emp_desig')?.value || '',
      dept: document.getElementById('input_emp_dept')?.value || '',
      cadre: document.getElementById('input_emp_cadre')?.value || 'BPS-20 (Regular)',
      cycle: document.getElementById('input_emp_cycle')?.value || '2026 (01 January – 31 December 2026)',
      appraiser: document.getElementById('input_emp_appraiser')?.value || '',
      reviewer: document.getElementById('input_emp_reviewer')?.value || '',
      committeeMember1: document.getElementById('input_comm_member_1')?.value || '',
      committeeMember2: document.getElementById('input_comm_member_2')?.value || '',
      committeeMember3: document.getElementById('input_comm_member_3')?.value || ''
    },
    sectionA: {
      qecScore: document.getElementById('input_qec_score')?.value || '0',
      actualWU: document.getElementById('input_actual_wu')?.value || '0',
      exempted: document.getElementById('input_wu_exempted')?.value || 'N'
    },
    sectionB: {
      pub_high_lead: document.getElementById('input_pub_high_lead')?.value || '0',
      pub_high_co: document.getElementById('input_pub_high_co')?.value || '0',
      pub_mod_lead: document.getElementById('input_pub_mod_lead')?.value || '0',
      pub_mod_co: document.getElementById('input_pub_mod_co')?.value || '0',
      pub_low_lead: document.getElementById('input_pub_low_lead')?.value || '0',
      pub_low_co: document.getElementById('input_pub_low_co')?.value || '0',
      book_int: document.getElementById('input_book_int')?.value || '0',
      book_nat: document.getElementById('input_book_nat')?.value || '0',
      chapter_int: document.getElementById('input_chapter_int')?.value || '0',
      chapter_nat: document.getElementById('input_chapter_nat')?.value || '0',
      sup_phd: document.getElementById('input_sup_phd')?.value || '0',
      sup_mphil: document.getElementById('input_sup_mphil')?.value || '0',
      sup_clin_sr: document.getElementById('input_sup_clin_sr')?.value || '0',
      sup_clin_jr: document.getElementById('input_sup_clin_jr')?.value || '0',
      innov_patent_int: document.getElementById('input_innov_patent_int')?.value || '0',
      innov_patent_nat: document.getElementById('input_innov_patent_nat')?.value || '0',
      innov_project: document.getElementById('input_innov_project')?.value || '0',
      innov_overhead: document.getElementById('input_innov_overhead')?.value || '0'
    },
    grantsList: appraisalState.grantsList,
    sectionC: {
      comm_member: document.getElementById('input_comm_member')?.value || '0',
      comm_chair: document.getElementById('input_comm_chair')?.value || '0',
      policy_doc: document.getElementById('input_policy_doc')?.value || '0',
      facility_charge: document.getElementById('input_facility_charge')?.value || '0',
      additional_appoint: document.getElementById('input_additional_appoint')?.value || 'N'
    },
    sectionD: {
      peerScores: appraisalState.sectionD.peerScores,
      cpdScores: appraisalState.sectionD.cpdScores
    },
    sectionE: {
      clin_admin: document.getElementById('input_clin_admin')?.value || '0',
      clin_volume: document.getElementById('input_clin_volume')?.value || '0',
      clin_oncall: document.getElementById('input_clin_oncall')?.value || '0',
      clin_teaching: document.getElementById('input_clin_teaching')?.value || '0'
    },
    nextYearTargets: {
      teaching: document.getElementById('input_target_teaching')?.value || '',
      publications: document.getElementById('input_target_pubs')?.value || '',
      grants: document.getElementById('input_target_grants')?.value || '',
      supervision: document.getElementById('input_target_sup')?.value || '',
      service_cpd: document.getElementById('input_target_service')?.value || '',
      skills_leadership: document.getElementById('input_target_skills')?.value || ''
    },
    redFlag: {
      penalty: document.getElementById('input_red_flag')?.value || '0',
      refNo: document.getElementById('input_red_flag_ref')?.value || '',
      refDate: document.getElementById('input_red_flag_date')?.value || ''
    }
  };

  try {
    localStorage.setItem('KMU_APPRAISAL_DRAFT_v3', JSON.stringify(draft));
    const indicator = document.getElementById('lastSavedIndicator');
    if (indicator) {
      indicator.textContent = `Saved: ${timeStr}`;
    }
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
  return draft;
}

// RESTORE DRAFT FUNCTION
window.restoreDraft = function() {
  try {
    const raw = localStorage.getItem('KMU_APPRAISAL_DRAFT_v3');
    if (!raw) return false;
    const draft = JSON.parse(raw);

    if (draft.profile) {
      appraisalState.selectedProfile = draft.profile;
      window.selectProfile(draft.profile);
    }

    if (draft.meta) {
      const m = draft.meta;
      setVal('input_emp_name', m.name);
      setVal('input_emp_desig', m.desig);
      setVal('input_emp_dept', m.dept);
      setVal('input_emp_cadre', m.cadre);
      setVal('input_emp_cycle', m.cycle);
      setVal('input_emp_appraiser', m.appraiser);
      setVal('input_emp_reviewer', m.reviewer);
      setVal('input_comm_member_1', m.committeeMember1);
      setVal('input_comm_member_2', m.committeeMember2);
      setVal('input_comm_member_3', m.committeeMember3);

      updateElementText('dossier_emp_name', m.name || '—');
      updateElementText('dossier_emp_desig', m.desig || '—');
      updateElementText('dossier_emp_dept', m.dept || '—');
      updateElementText('dossier_emp_cadre', m.cadre || '—');
      updateElementText('dossier_emp_cycle', m.cycle || '—');
      updateElementText('sig_comm_1_name', m.committeeMember1 || 'Prof. Dr. Muhammad Saleem');
      updateElementText('sig_comm_2_name', m.committeeMember2 || 'Dr. Bushra Rehman');
      updateElementText('sig_comm_3_name', m.committeeMember3 || 'Dr. Kinza Ayaz');
    }

    if (draft.sectionA) {
      setVal('input_qec_score', draft.sectionA.qecScore);
      setVal('input_actual_wu', draft.sectionA.actualWU);
      setVal('input_wu_exempted', draft.sectionA.exempted);
    }

    if (draft.sectionB) {
      Object.keys(draft.sectionB).forEach(key => {
        setVal(`input_${key}`, draft.sectionB[key]);
      });
    }

    if (draft.grantsList && Array.isArray(draft.grantsList)) {
      appraisalState.grantsList = draft.grantsList;
      renderGrantsTable();
    }

    if (draft.sectionC) {
      Object.keys(draft.sectionC).forEach(key => {
        setVal(`input_${key}`, draft.sectionC[key]);
      });
    }

    if (draft.sectionD) {
      if (draft.sectionD.peerScores) appraisalState.sectionD.peerScores = draft.sectionD.peerScores;
      if (draft.sectionD.cpdScores) appraisalState.sectionD.cpdScores = draft.sectionD.cpdScores;
      initPeerControls();
    }

    if (draft.sectionE) {
      Object.keys(draft.sectionE).forEach(key => {
        setVal(`input_${key}`, draft.sectionE[key]);
      });
    }

    if (draft.nextYearTargets) {
      setVal('input_target_teaching', draft.nextYearTargets.teaching);
      setVal('input_target_pubs', draft.nextYearTargets.publications);
      setVal('input_target_grants', draft.nextYearTargets.grants);
      setVal('input_target_sup', draft.nextYearTargets.supervision);
      setVal('input_target_service', draft.nextYearTargets.service_cpd);
      setVal('input_target_skills', draft.nextYearTargets.skills_leadership || appraisalState.nextYearTargets.skills_leadership);
    }

    if (draft.redFlag) {
      setVal('input_red_flag', draft.redFlag.penalty);
      setVal('input_red_flag_ref', draft.redFlag.refNo);
      setVal('input_red_flag_date', draft.redFlag.refDate);
    }

    calculateAll();

    const targetTab = draft.lastActiveTab || 'tab-meta';
    window.switchTab(targetTab);

    const banner = document.getElementById('draftRecoveryBanner');
    if (banner) banner.style.display = 'none';

    showToast(`✓ Restored draft from ${draft.savedTimeFormatted || 'previous session'}`);
    return true;
  } catch (e) {
    console.error('Draft restore failed:', e);
    return false;
  }
};

// CHECK EXISTING DRAFT ON PAGE LOAD
function checkExistingDraft() {
  try {
    const raw = localStorage.getItem('KMU_APPRAISAL_DRAFT_v3');
    if (!raw) return;
    const draft = JSON.parse(raw);
    const banner = document.getElementById('draftRecoveryBanner');
    if (banner && draft.meta) {
      const empName = draft.meta.name || 'Faculty Member';
      const timeStr = draft.savedTimeFormatted || 'earlier';
      const infoSpan = document.getElementById('draftBannerInfo');
      if (infoSpan) {
        infoSpan.innerHTML = `<strong>In-Progress Draft Detected:</strong> Saved for <strong>${empName}</strong> at ${timeStr}.`;
      }
      banner.style.display = 'flex';
    }
  } catch (e) {}
}

// CLEAR DRAFT / START FRESH
window.clearDraftAndStartFresh = function() {
  if (confirm('Start a fresh appraisal? This will reset all fields.')) {
    localStorage.removeItem('KMU_APPRAISAL_DRAFT_v3');
    const banner = document.getElementById('draftRecoveryBanner');
    if (banner) banner.style.display = 'none';
    window.loadSampleData();
    window.switchTab('tab-meta');
    showToast('Started fresh appraisal form.');
  }
};

// DOWNLOAD OFFLINE DRAFT BACKUP (.JSON)
window.downloadDraftBackup = function() {
  const raw = localStorage.getItem('KMU_APPRAISAL_DRAFT_v3');
  const draft = raw ? JSON.parse(raw) : saveAllData();
  const empName = draft.meta?.name || 'Faculty';
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KMU_Appraisal_Draft_${empName.replace(/[^a-zA-Z0-9]/g, '_')}_2026.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ Draft backup file downloaded.');
};

// HELPER: SET VALUE SAFELY
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

// Navigation helpers
window.goToProfileStep = function() {
  window.saveAndContinue('tab-profile', 'Step 2: Profile Selection');
};

window.goToTeachingStep = function() {
  window.saveAndContinue('tab-teaching', 'Step 3: Teaching Scoring');
};

// --- RESEARCH GRANTS LEDGER FUNCTIONS ---
function computeGrantPoints(amount, role, status) {
  if (status === 'Applied') {
    return 2.0; // 2 points per application submitted
  }
  // Won / Awarded:
  const amtNum = parseFloat(amount) || 0;
  if (amtNum >= 10000000) { // Major International/National > 10M PKR
    return role === 'PI' ? 15.0 : 4.5;
  } else if (amtNum >= 1000000) { // National 1M - 10M PKR
    return role === 'PI' ? 8.0 : 4.0;
  } else { // Small competitive grant < 1M PKR
    return role === 'PI' ? 4.0 : 2.0;
  }
}

function formatCurrencyPKR(amount) {
  const num = parseFloat(amount) || 0;
  if (num >= 10000000) {
    return `PKR ${(num / 1000000).toFixed(2)} M (>10M Major)`;
  } else if (num >= 1000000) {
    return `PKR ${(num / 1000000).toFixed(2)} M (1-10M National)`;
  } else {
    return `PKR ${(num / 1000).toFixed(0)} K (<1M Small)`;
  }
}

function renderGrantsTable() {
  const tbody = document.getElementById('grantsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let wonTotal = 0;
  let appliedTotal = 0;

  appraisalState.grantsList.forEach((grant, idx) => {
    const pts = computeGrantPoints(grant.amount, grant.role, grant.status);
    grant.points = pts;
    if (grant.status === 'Won') wonTotal += pts;
    if (grant.status === 'Applied') appliedTotal += pts;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${grant.title}</strong></td>
      <td><span style="font-weight:600; color:var(--kmu-maroon);">${grant.agency}</span></td>
      <td>${formatCurrencyPKR(grant.amount)}</td>
      <td><strong>${grant.role}</strong></td>
      <td>
        <span class="grant-table-badge ${grant.status === 'Won' ? 'grant-badge-won' : 'grant-badge-applied'}">
          ${grant.status === 'Won' ? 'Won / Awarded' : 'Applied'}
        </span>
      </td>
      <td><strong style="color:var(--emerald-600);">${pts} pts</strong></td>
      <td style="text-align:center;">
        <button type="button" class="btn btn-secondary" style="padding:2px 8px; font-size:0.75rem;" onclick="deleteGrantRecord('${grant.id}')">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const appliedCapped = Math.min(20, appliedTotal);
  const subB3Capped = Math.min(50, wonTotal + appliedCapped);

  updateElementText('disp_sub_b3_won', wonTotal.toFixed(1));
  updateElementText('disp_sub_b3_applied', appliedTotal.toFixed(1));
  updateElementText('disp_sub_b3', subB3Capped.toFixed(1));
  updateElementText('disp_sub_b3_raw', (wonTotal + appliedTotal).toFixed(1));
  
  // Recalculate research score
  calculateAll();
}

window.addGrantRecord = function() {
  const title = document.getElementById('input_new_grant_title')?.value?.trim();
  const agency = document.getElementById('input_new_grant_agency')?.value?.trim();
  const amountStr = document.getElementById('input_new_grant_amount')?.value?.trim();
  const role = document.getElementById('input_new_grant_role')?.value || 'PI';
  const status = document.getElementById('input_new_grant_status')?.value || 'Won';

  if (!title || !agency || !amountStr) {
    alert('Please enter the Project Title, Funding Agency, and Grant Amount (in PKR).');
    return;
  }

  // Parse amount in PKR (handles 12M, 12000000, 7.5, etc.)
  let amount = parseFloat(amountStr);
  if (amount < 1000) {
    // If entered in Millions e.g. 7.5
    amount = amount * 1000000;
  }

  const newGrant = {
    id: 'g_' + Date.now(),
    title: title,
    agency: agency,
    amount: amount,
    role: role,
    status: status,
    points: computeGrantPoints(amount, role, status)
  };

  appraisalState.grantsList.push(newGrant);
  renderGrantsTable();

  // Reset input fields
  document.getElementById('input_new_grant_title').value = '';
  document.getElementById('input_new_grant_agency').value = '';
  document.getElementById('input_new_grant_amount').value = '';

  showToast(`✓ Grant Added: ${title} (${formatCurrencyPKR(amount)})`);
};

window.deleteGrantRecord = function(grantId) {
  appraisalState.grantsList = appraisalState.grantsList.filter(g => g.id !== grantId);
  renderGrantsTable();
  showToast('Grant removed from ledger.');
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initProfileCards();
  initPeerControls();
  initEventListeners();
  
  const restored = window.restoreDraft();
  if (!restored) {
    window.loadSampleData();
  }
  checkExistingDraft();
  renderGrantsTable();
  calculateAll();
});

// Render Profile Selection Cards
function initProfileCards() {
  const container = document.getElementById('profileCardsContainer');
  if (!container) return;
  container.innerHTML = '';

  Object.keys(PROFILES).forEach(key => {
    const prof = PROFILES[key];
    const card = document.createElement('div');
    card.className = `profile-card ${key === appraisalState.selectedProfile ? 'selected' : ''}`;
    card.onclick = () => window.selectProfile(key);

    card.innerHTML = `
      <div class="profile-title">${prof.name}</div>
      <p style="font-size:0.75rem; color:#64748b; margin-bottom:0.5rem;">${prof.description}</p>
      <ul class="profile-breakdown">
        <li><span>Teaching:</span> <strong>${prof.teachingWeight}%</strong> (Min WU: ${prof.minTeachingWU})</li>
        <li><span>Research & Innovation:</span> <strong>${prof.researchWeight}%</strong></li>
        <li><span>Institutional Service:</span> <strong>${prof.serviceWeight}%</strong></li>
        <li><span>Dean's Peer & CPD:</span> <strong>${prof.peerWeight}%</strong></li>
        ${prof.clinicalWeight > 0 ? `<li><span style="color:#b91c1c; font-weight:700;">Clinical Service:</span> <strong style="color:#b91c1c;">${prof.clinicalWeight}%</strong></li>` : ''}
      </ul>
    `;
    container.appendChild(card);
  });
}

// Select Profile
window.selectProfile = function(profileKey) {
  appraisalState.selectedProfile = profileKey;
  initProfileCards();
  toggleClinicalSection();
  calculateAll();
  showToast(`Profile activated: ${profileKey}`);
};

// Toggle Clinical Section
function toggleClinicalSection() {
  const isClinical = appraisalState.selectedProfile === 'Clinical-Focused Profile (Hospital Faculty)';
  const clinNavItem = document.getElementById('navItemClinical');
  const clinPill = document.getElementById('navPillClinical');
  
  if (clinNavItem) {
    if (isClinical) {
      clinNavItem.style.display = 'flex';
      if (clinPill) {
        clinPill.textContent = '45%';
        clinPill.style.background = '#7a1c1c';
        clinPill.style.color = '#fff';
      }
    } else {
      clinNavItem.style.display = 'none';
    }
  }
}

// Render Peer Review Sliders/Chips
function initPeerControls() {
  const peerList = document.getElementById('peerParametersList');
  if (peerList) {
    peerList.innerHTML = '';
    PEER_PARAMETERS.forEach(param => {
      const currentVal = appraisalState.sectionD.peerScores[param.id] || 4;
      const row = document.createElement('div');
      row.className = 'peer-item-card';
      row.innerHTML = `
        <div class="peer-item-info">
          <div class="peer-item-title">${param.label}</div>
          <div style="font-size:0.75rem; color:#64748b;">${param.desc}</div>
        </div>
        <div class="peer-item-scale" id="chips_${param.id}">
          ${[1, 2, 3, 4, 5, 6].map(score => `
            <button type="button" class="score-chip-btn ${currentVal === score ? 'selected' : ''}" 
              onclick="setPeerScore('${param.id}', ${score})">${score}</button>
          `).join('')}
        </div>
      `;
      peerList.appendChild(row);
    });
  }

  const cpdList = document.getElementById('cpdTargetsList');
  if (cpdList) {
    cpdList.innerHTML = '';
    CPD_TARGETS.forEach(target => {
      const currentVal = appraisalState.sectionD.cpdScores[target.id] || 0;
      const row = document.createElement('div');
      row.className = 'peer-item-card';
      row.innerHTML = `
        <div class="peer-item-info">
          <div class="peer-item-title">${target.label}</div>
          <div style="font-size:0.75rem; color:#64748b;">${target.desc}</div>
        </div>
        <div class="peer-item-scale" id="chips_${target.id}">
          ${[0, 1, 2].map(score => `
            <button type="button" class="score-chip-btn ${currentVal === score ? 'selected' : ''}" 
              onclick="setCpdScore('${target.id}', ${score})">${score}</button>
          `).join('')}
        </div>
      `;
      cpdList.appendChild(row);
    });
  }
}

window.setPeerScore = function(paramId, score) {
  appraisalState.sectionD.peerScores[paramId] = score;
  const container = document.getElementById(`chips_${paramId}`);
  if (container) {
    container.querySelectorAll('.score-chip-btn').forEach((btn, idx) => {
      btn.classList.toggle('selected', idx + 1 === score);
    });
  }
  calculateAll();
};

window.setCpdScore = function(targetId, score) {
  appraisalState.sectionD.cpdScores[targetId] = score;
  const container = document.getElementById(`chips_${targetId}`);
  if (container) {
    container.querySelectorAll('.score-chip-btn').forEach((btn, idx) => {
      btn.classList.toggle('selected', idx === score);
    });
  }
  calculateAll();
};

// Global Calculation Engine
function calculateAll() {
  const prof = PROFILES[appraisalState.selectedProfile] || PROFILES['Balanced Profile'];
  
  const wTeaching = prof.teachingWeight / 100;
  const wResearch = prof.researchWeight / 100;
  const wService = prof.serviceWeight / 100;
  const wPeer = prof.peerWeight / 100;
  const wClinical = prof.clinicalWeight / 100;
  const minTeachingWU = prof.minTeachingWU;

  updateElementText('navPillTeaching', `${prof.teachingWeight}%`);
  updateElementText('navPillResearch', `${prof.researchWeight}%`);
  updateElementText('navPillService', `${prof.serviceWeight}%`);
  updateElementText('navPillPeer', `${prof.peerWeight}%`);
  if (prof.clinicalWeight > 0) {
    updateElementText('navPillClinical', `${prof.clinicalWeight}%`);
  }

  // --- 1. SECTION A: TEACHING ---
  const qecScore = Math.min(100, Math.max(0, parseFloat(document.getElementById('input_qec_score')?.value) || 0));
  const actualWU = Math.max(0, parseFloat(document.getElementById('input_actual_wu')?.value) || 0);
  const exempted = document.getElementById('input_wu_exempted')?.value || 'N';

  updateElementText('disp_min_wu', minTeachingWU);
  updateElementText('dossier_min_wu', `${minTeachingWU} WU`);
  
  let effectiveTeaching = qecScore;
  if (exempted !== 'Y' && minTeachingWU > 0 && actualWU < minTeachingWU) {
    effectiveTeaching = qecScore * (actualWU / minTeachingWU);
  }
  effectiveTeaching = Math.min(100, Math.max(0, effectiveTeaching));
  
  const rawA = effectiveTeaching;
  const weightedA = (rawA / 100) * wTeaching * 100;

  updateElementText('disp_effective_teaching', effectiveTeaching.toFixed(1));
  updateElementText('disp_raw_a', rawA.toFixed(1));
  updateElementText('disp_weight_a', `${prof.teachingWeight}%`);
  updateElementText('disp_weighted_a', weightedA.toFixed(2));

  // --- 2. SECTION B: RESEARCH ---
  const pubHighLead = getInputValue('input_pub_high_lead') * 10;
  const pubHighCo = getInputValue('input_pub_high_co') * 5;
  const pubModLead = getInputValue('input_pub_mod_lead') * 6;
  const pubModCo = getInputValue('input_pub_mod_co') * 3;
  const pubLowLead = getInputValue('input_pub_low_lead') * 4;
  const pubLowCo = getInputValue('input_pub_low_co') * 2;
  const subB1Raw = pubHighLead + pubHighCo + pubModLead + pubModCo + pubLowLead + pubLowCo;
  const subB1Capped = Math.min(50, subB1Raw);

  updateElementText('disp_sub_b1', subB1Capped.toFixed(1));
  updateElementText('disp_sub_b1_raw', subB1Raw);

  const bookInt = getInputValue('input_book_int') * 8;
  const bookNat = getInputValue('input_book_nat') * 5;
  const chapInt = getInputValue('input_chapter_int') * 4;
  const chapNat = getInputValue('input_chapter_nat') * 2;
  const subB2Raw = bookInt + bookNat + chapInt + chapNat;
  const subB2Capped = Math.min(20, subB2Raw);

  updateElementText('disp_sub_b2', subB2Capped.toFixed(1));
  updateElementText('disp_sub_b2_raw', subB2Raw);

  // Grants calculated directly from grantsList ledger
  let wonSum = 0;
  let appliedSum = 0;
  appraisalState.grantsList.forEach(g => {
    const pts = computeGrantPoints(g.amount, g.role, g.status);
    if (g.status === 'Won') wonSum += pts;
    if (g.status === 'Applied') appliedSum += pts;
  });
  const subB3Capped = Math.min(50, wonSum + Math.min(20, appliedSum));

  updateElementText('disp_sub_b3_won', wonSum.toFixed(1));
  updateElementText('disp_sub_b3_applied', appliedSum.toFixed(1));
  updateElementText('disp_sub_b3', subB3Capped.toFixed(1));
  updateElementText('disp_sub_b3_raw', (wonSum + appliedSum).toFixed(1));

  const supPhD = getInputValue('input_sup_phd') * 8;
  const supMPhil = getInputValue('input_sup_mphil') * 4;
  const supClinSr = getInputValue('input_sup_clin_sr') * 8;
  const supClinJr = getInputValue('input_sup_clin_jr') * 4;
  const subB4Raw = supPhD + supMPhil + supClinSr + supClinJr;
  const subB4Capped = Math.min(40, subB4Raw);

  updateElementText('disp_sub_b4', subB4Capped.toFixed(1));
  updateElementText('disp_sub_b4_raw', subB4Raw);

  const innPatInt = getInputValue('input_innov_patent_int') * 10;
  const innPatNat = getInputValue('input_innov_patent_nat') * 6;
  const innProj = getInputValue('input_innov_project') * 8;
  const innOverhead = getInputValue('input_innov_overhead') * 10;
  const subB5Raw = innPatInt + innPatNat + innProj + innOverhead;
  const subB5Capped = Math.min(40, subB5Raw);

  updateElementText('disp_sub_b5', subB5Capped.toFixed(1));
  updateElementText('disp_sub_b5_raw', subB5Raw);

  const rawB = Math.min(200, subB1Capped + subB2Capped + subB3Capped + subB4Capped + subB5Capped);
  const weightedB = (rawB / 200) * wResearch * 100;

  updateElementText('disp_raw_b', rawB.toFixed(1));
  updateElementText('disp_weight_b', `${prof.researchWeight}%`);
  updateElementText('disp_weighted_b', weightedB.toFixed(2));

  // --- 3. SECTION C: SERVICE ---
  const commMember = Math.min(25, getInputValue('input_comm_member') * 5);
  const commChair = Math.min(20, getInputValue('input_comm_chair') * 10);
  const policyDoc = Math.min(30, getInputValue('input_policy_doc') * 10);
  const facilityCharge = Math.min(30, getInputValue('input_facility_charge') * 15);
  const addAppoint = document.getElementById('input_additional_appoint')?.value === 'Y' ? 15 : 0;

  const rawC = Math.min(100, commMember + commChair + policyDoc + facilityCharge + addAppoint);
  const weightedC = (rawC / 100) * wService * 100;

  updateElementText('disp_comm_member', commMember);
  updateElementText('disp_comm_chair', commChair);
  updateElementText('disp_policy_doc', policyDoc);
  updateElementText('disp_facility_charge', facilityCharge);
  updateElementText('disp_add_appoint', addAppoint);

  updateElementText('disp_raw_c', rawC.toFixed(1));
  updateElementText('disp_raw_c_card', rawC.toFixed(1));
  updateElementText('disp_weight_c', `${prof.serviceWeight}%`);
  updateElementText('disp_weighted_c', weightedC.toFixed(2));

  // --- 4. SECTION D: PEER EVALUATION & CPD (SUBJECTIVE - DEAN'S EVALUATION) ---
  let peerCoreSum = 0;
  PEER_PARAMETERS.forEach(p => {
    peerCoreSum += appraisalState.sectionD.peerScores[p.id] || 1;
  });
  peerCoreSum = Math.min(78, peerCoreSum);

  let cpdSum = 0;
  CPD_TARGETS.forEach(t => {
    cpdSum += appraisalState.sectionD.cpdScores[t.id] || 0;
  });
  cpdSum = Math.min(10, cpdSum);

  const rawD = Math.min(88, peerCoreSum + cpdSum);
  const weightedD = (rawD / 88) * wPeer * 100;

  updateElementText('disp_peer_core_sum', peerCoreSum);
  updateElementText('disp_cpd_sum', cpdSum);
  updateElementText('disp_raw_d', rawD.toFixed(1));
  updateElementText('disp_weight_d', `${prof.peerWeight}%`);
  updateElementText('disp_weighted_d', weightedD.toFixed(2));

  // --- 5. SECTION E: CLINICAL ---
  let rawE = 0;
  let weightedE = 0;
  if (prof.clinicalWeight > 0) {
    const clinAdmin = Math.min(25, Math.max(0, getInputValue('input_clin_admin')));
    const clinVolume = Math.min(35, Math.max(0, getInputValue('input_clin_volume')));
    const clinOncall = Math.min(20, Math.max(0, getInputValue('input_clin_oncall')));
    const clinTeaching = Math.min(20, Math.max(0, getInputValue('input_clin_teaching')));
    rawE = Math.min(100, clinAdmin + clinVolume + clinOncall + clinTeaching);
    weightedE = (rawE / 100) * wClinical * 100;
  }
  updateElementText('disp_raw_e', rawE.toFixed(1));
  updateElementText('disp_raw_e_card', rawE.toFixed(1));
  updateElementText('disp_weight_e', `${prof.clinicalWeight}%`);
  updateElementText('disp_weighted_e', weightedE.toFixed(2));

  // --- 6. RED FLAG / DISCIPLINARY PENALTY ---
  const redFlagSelect = parseInt(document.getElementById('input_red_flag')?.value) || 0;
  const refNo = document.getElementById('input_red_flag_ref')?.value?.trim() || '';
  const refDate = document.getElementById('input_red_flag_date')?.value?.trim() || '';
  
  let validPenalty = 0;
  const warningBox = document.getElementById('redFlagStatutoryWarning');
  
  if (redFlagSelect > 0) {
    if (refNo.length > 2 && refDate.length > 4) {
      validPenalty = redFlagSelect;
      if (warningBox) warningBox.style.display = 'none';
    } else {
      validPenalty = 0;
      if (warningBox) {
        warningBox.style.display = 'block';
        warningBox.innerHTML = `<strong>Statutory Safeguard Active:</strong> Red Flag deduction of -${redFlagSelect} pts cannot be enacted without an authenticated Inquiry Notification Reference Number and Date under KMU Efficiency & Discipline Statutes (Section 9.4).`;
      }
    }
  } else {
    if (warningBox) warningBox.style.display = 'none';
  }
  updateElementText('disp_red_flag_penalty', `-${validPenalty} pts`);

  // --- 7. SEPARATE OBJECTIVE VS SUBJECTIVE SCORES ---
  const objectiveScore = weightedA + weightedB + weightedC + weightedE;
  const objectiveMaxWeight = (prof.teachingWeight + prof.researchWeight + prof.serviceWeight + prof.clinicalWeight);
  const objectivePercent = objectiveMaxWeight > 0 ? (objectiveScore / objectiveMaxWeight) * 100 : 0;

  const subjectiveScore = weightedD; // Concerned Dean's Qualitative Assessment
  const subjectiveMaxWeight = prof.peerWeight;
  const subjectivePercent = subjectiveMaxWeight > 0 ? (subjectiveScore / subjectiveMaxWeight) * 100 : 0;

  const finalScore = Math.max(0, (objectiveScore + subjectiveScore) - validPenalty);

  // Performance Rating Classification
  let ratingBand = 'Unsatisfactory';
  let ratingClass = 'rating-unsatisfactory';
  let pipStatus = 'MANDATORY PIP (3–6 months)';
  let pipDesc = 'Statutory Performance Improvement Plan triggered under Section 9.5. Commences within 30 days.';

  if (finalScore >= 85.0) {
    ratingBand = 'Outstanding';
    ratingClass = 'rating-outstanding';
    pipStatus = 'Not Required';
    pipDesc = 'Exceeds Expectations with Distinction. Eligible for institutional awards & expedited increment.';
  } else if (finalScore >= 75.0) {
    ratingBand = 'Very Good';
    ratingClass = 'rating-very-good';
    pipStatus = 'Not Required';
    pipDesc = 'Exceeds Expectations. Highly commendable professional delivery.';
  } else if (finalScore >= 60.0) {
    ratingBand = 'Good';
    ratingClass = 'rating-good';
    pipStatus = 'Not Required';
    pipDesc = 'Meets Expectations. Meets institutional benchmarks.';
  } else if (finalScore >= 50.0) {
    ratingBand = 'Average';
    ratingClass = 'rating-average';
    pipStatus = 'Discretionary PIP';
    pipDesc = 'Needs Improvement. Reviewing Officer may mandate targeted 3-month mentoring.';
  }

  // Objective Grading scale
  let objGrade = 'Meets Expectations';
  if (objectivePercent >= 85) objGrade = 'Outstanding';
  else if (objectivePercent >= 75) objGrade = 'Very Good';
  else if (objectivePercent < 50) objGrade = 'Unsatisfactory';

  // Subjective (Dean's) Grading scale
  let subjGrade = 'Satisfactory Conduct';
  if (subjectivePercent >= 85) subjGrade = 'Distinguished Decorum & Leadership';
  else if (subjectivePercent >= 75) subjGrade = 'Commendable Conduct';
  else if (subjectivePercent < 60) subjGrade = 'Remediation Recommended';

  // Update Status Bar & KPIs
  updateElementText('liveScore', finalScore.toFixed(1));
  const badge = document.getElementById('liveRatingBadge');
  if (badge) {
    badge.textContent = ratingBand;
    badge.className = `rating-badge ${ratingClass}`;
  }
  updateElementText('liveProfileName', prof.name);
  updateElementText('top_pip_status', pipStatus);

  updateElementText('kpi_final_score', `${finalScore.toFixed(1)}%`);
  updateElementText('kpi_rating_band', ratingBand);
  updateElementText('kpi_pip_status', pipStatus);
  updateElementText('kpi_pip_desc', pipDesc);
  updateElementText('kpi_penalty_applied', validPenalty > 0 ? `-${validPenalty} pts` : 'None');

  // Update Split Objective vs Subjective DOM Displays
  updateElementText('disp_objective_score', `${objectiveScore.toFixed(2)} / ${objectiveMaxWeight}%`);
  updateElementText('disp_objective_pct', `${objectivePercent.toFixed(1)}% (${objGrade})`);
  updateElementText('disp_subjective_score', `${subjectiveScore.toFixed(2)} / ${subjectiveMaxWeight}%`);
  updateElementText('disp_subjective_pct', `${subjectivePercent.toFixed(1)}% (${subjGrade})`);

  // Update Official Dossier Document Table
  updateElementText('dossier_prof_name', prof.name);
  updateElementText('dossier_weight_a', `${prof.teachingWeight}%`);
  updateElementText('dossier_raw_a', `${rawA.toFixed(1)} / 100`);
  updateElementText('dossier_weighted_a', weightedA.toFixed(2));

  updateElementText('dossier_weight_b', `${prof.researchWeight}%`);
  updateElementText('dossier_raw_b', `${rawB.toFixed(1)} / 200`);
  updateElementText('dossier_weighted_b', weightedB.toFixed(2));

  updateElementText('dossier_weight_c', `${prof.serviceWeight}%`);
  updateElementText('dossier_raw_c', `${rawC.toFixed(1)} / 100`);
  updateElementText('dossier_weighted_c', weightedC.toFixed(2));

  updateElementText('dossier_weight_d', `${prof.peerWeight}%`);
  updateElementText('dossier_raw_d', `${rawD.toFixed(1)} / 88`);
  updateElementText('dossier_weighted_d', weightedD.toFixed(2));

  const clinDossierRow = document.getElementById('dossier_row_clinical');
  if (clinDossierRow) {
    if (prof.clinicalWeight > 0) {
      clinDossierRow.style.display = 'table-row';
      updateElementText('dossier_weight_e', `${prof.clinicalWeight}%`);
      updateElementText('dossier_raw_e', `${rawE.toFixed(1)} / 100`);
      updateElementText('dossier_weighted_e', weightedE.toFixed(2));
    } else {
      clinDossierRow.style.display = 'none';
    }
  }

  updateElementText('dossier_objective_total', `${objectiveScore.toFixed(2)} / ${objectiveMaxWeight}% (${objectivePercent.toFixed(1)}%)`);
  updateElementText('dossier_subjective_total', `${subjectiveScore.toFixed(2)} / ${subjectiveMaxWeight}% (${subjectivePercent.toFixed(1)}%)`);
  updateElementText('dossier_penalty', validPenalty > 0 ? `-${validPenalty} pts (${refNo})` : '0 pts');
  updateElementText('dossier_final_score', `${finalScore.toFixed(1)} / 100`);
  updateElementText('dossier_final_rating', ratingBand);
  updateElementText('dossier_pip_note', pipStatus);

  // Sync targets to printable dossier
  const tTeaching = document.getElementById('input_target_teaching')?.value || appraisalState.nextYearTargets.teaching;
  const tPubs = document.getElementById('input_target_pubs')?.value || appraisalState.nextYearTargets.publications;
  const tGrants = document.getElementById('input_target_grants')?.value || appraisalState.nextYearTargets.grants;
  const tSup = document.getElementById('input_target_sup')?.value || appraisalState.nextYearTargets.supervision;
  const tService = document.getElementById('input_target_service')?.value || appraisalState.nextYearTargets.service_cpd;
  const tSkills = document.getElementById('input_target_skills')?.value || appraisalState.nextYearTargets.skills_leadership;

  updateElementText('dossier_target_teaching', tTeaching);
  updateElementText('dossier_target_pubs', tPubs);
  updateElementText('dossier_target_grants', tGrants);
  updateElementText('dossier_target_sup', tSup);
  updateElementText('dossier_target_service', tService);
  updateElementText('dossier_target_skills', tSkills);

  renderScoreBars({
    teaching: (rawA / 100) * 100,
    research: (rawB / 200) * 100,
    service: (rawC / 100) * 100,
    peer: (rawD / 88) * 100,
    clinical: prof.clinicalWeight > 0 ? (rawE / 100) * 100 : 0
  });
}

function renderScoreBars(attainment) {
  const container = document.getElementById('domainProgressContainer');
  if (!container) return;
  const isClinical = PROFILES[appraisalState.selectedProfile]?.clinicalWeight > 0;

  container.innerHTML = `
    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span>Teaching & Curriculum (Objective)</span>
        <span>${attainment.teaching.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#7a1c1c; width:${Math.min(100, attainment.teaching)}%; height:100%;"></div>
      </div>
    </div>

    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span>Research, Grants & Innovation (Objective)</span>
        <span>${attainment.research.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#c59b27; width:${Math.min(100, attainment.research)}%; height:100%;"></div>
      </div>
    </div>

    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span>Institutional Service (Objective)</span>
        <span>${attainment.service.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#2563eb; width:${Math.min(100, attainment.service)}%; height:100%;"></div>
      </div>
    </div>

    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span>Dean's Peer Evaluation & CPD (Subjective)</span>
        <span>${attainment.peer.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#059669; width:${Math.min(100, attainment.peer)}%; height:100%;"></div>
      </div>
    </div>

    ${isClinical ? `
    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span style="color:#b91c1c;">Clinical & Diagnostic Care (Objective)</span>
        <span>${attainment.clinical.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#dc2626; width:${Math.min(100, attainment.clinical)}%; height:100%;"></div>
      </div>
    </div>
    ` : ''}
  `;
}

function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? Math.max(0, parseFloat(el.value) || 0) : 0;
}

function updateElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function initEventListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      if (tabId) window.switchTab(tabId);
    });
  });

  document.querySelectorAll('.wizard-step').forEach(step => {
    step.addEventListener('click', () => {
      const tabId = step.getAttribute('data-wizard');
      if (tabId) window.switchTab(tabId);
    });
  });

  document.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', () => {
      calculateAll();
      saveAllData();
    });
    input.addEventListener('change', () => {
      calculateAll();
      saveAllData();
    });
  });

  ['emp_name', 'emp_desig', 'emp_dept', 'emp_cadre', 'emp_cycle', 'emp_appraiser', 'emp_reviewer'].forEach(f => {
    const input = document.getElementById(`input_${f}`);
    if (input) {
      input.addEventListener('input', () => {
        updateElementText(`dossier_${f}`, input.value || '—');
      });
      input.addEventListener('change', () => {
        updateElementText(`dossier_${f}`, input.value || '—');
      });
    }
  });

  ['comm_member_1', 'comm_member_2', 'comm_member_3'].forEach((f, idx) => {
    const input = document.getElementById(`input_${f}`);
    if (input) {
      const syncComm = () => {
        const val = input.value || '—';
        updateElementText(`dossier_${f}`, val);
        updateElementText(`sig_comm_${idx + 1}_name`, val);
      };
      input.addEventListener('input', syncComm);
      input.addEventListener('change', syncComm);
    }
  });
}

window.loadSampleData = function() {
  setVal('input_emp_name', 'Dr. Yasar Mehmood Yousafzai');
  setVal('input_emp_desig', 'Associate Professor');
  setVal('input_emp_dept', 'Institute of Pathology & Diagnostic Medicine (IPDM)');
  setVal('input_emp_cadre', 'BPS-20 (Regular)');
  setVal('input_emp_cycle', '2026 (01 January – 31 December 2026)');
  setVal('input_emp_appraiser', 'Dean, Faculty of Pathology & Diagnostic Medicine');
  setVal('input_emp_reviewer', 'Vice Chancellor, KMU');

  setVal('input_comm_member_1', 'Prof. Dr. Muhammad Saleem, Professor IBMS');
  setVal('input_comm_member_2', 'Dr. Bushra Rehman, Assistant Professor IPDM');
  setVal('input_comm_member_3', 'Dr. Kinza Ayaz, Assistant Professor IPDM');

  setVal('input_qec_score', '86');
  setVal('input_actual_wu', '34');
  setVal('input_wu_exempted', 'N');

  setVal('input_pub_high_lead', '2');
  setVal('input_pub_high_co', '2');
  setVal('input_pub_mod_lead', '3');
  setVal('input_pub_mod_co', '2');
  setVal('input_pub_low_lead', '1');
  setVal('input_pub_low_co', '0');

  setVal('input_book_int', '0');
  setVal('input_book_nat', '1');
  setVal('input_chapter_int', '2');
  setVal('input_chapter_nat', '1');

  appraisalState.grantsList = [...DEFAULT_GRANTS];
  renderGrantsTable();

  setVal('input_sup_phd', '2');
  setVal('input_sup_mphil', '4');
  setVal('input_sup_clin_sr', '0');
  setVal('input_sup_clin_jr', '0');

  setVal('input_innov_patent_int', '0');
  setVal('input_innov_patent_nat', '1');
  setVal('input_innov_project', '1');
  setVal('input_innov_overhead', '2');

  setVal('input_comm_member', '4');
  setVal('input_comm_chair', '1');
  setVal('input_policy_doc', '3');
  setVal('input_facility_charge', '1');
  setVal('input_additional_appoint', 'N');

  PEER_PARAMETERS.forEach(p => {
    appraisalState.sectionD.peerScores[p.id] = 5;
  });
  appraisalState.sectionD.peerScores['peer_4'] = 6;
  appraisalState.sectionD.peerScores['peer_12'] = 6;

  CPD_TARGETS.forEach(t => {
    appraisalState.sectionD.cpdScores[t.id] = 2;
  });

  initPeerControls();

  setVal('input_target_teaching', appraisalState.nextYearTargets.teaching);
  setVal('input_target_pubs', appraisalState.nextYearTargets.publications);
  setVal('input_target_grants', appraisalState.nextYearTargets.grants);
  setVal('input_target_sup', appraisalState.nextYearTargets.supervision);
  setVal('input_target_service', appraisalState.nextYearTargets.service_cpd);
  setVal('input_target_skills', appraisalState.nextYearTargets.skills_leadership);

  setVal('input_red_flag', '0');
  setVal('input_red_flag_ref', '');
  setVal('input_red_flag_date', '');

  ['emp_name', 'emp_desig', 'emp_dept', 'emp_cadre', 'emp_cycle', 'emp_appraiser', 'emp_reviewer'].forEach(f => {
    const val = document.getElementById(`input_${f}`)?.value;
    updateElementText(`dossier_${f}`, val || '—');
  });

  ['comm_member_1', 'comm_member_2', 'comm_member_3'].forEach((f, idx) => {
    const val = document.getElementById(`input_${f}`)?.value || '—';
    updateElementText(`dossier_${f}`, val);
    updateElementText(`sig_comm_${idx + 1}_name`, val);
  });

  window.selectProfile('Balanced Profile');
  calculateAll();
  saveAllData('tab-meta');
  showToast('✓ Verified KMU Faculty Profile Loaded!');
};

window.exportJSON = function() {
  const raw = localStorage.getItem('KMU_APPRAISAL_DRAFT_v3');
  const draft = raw ? JSON.parse(raw) : saveAllData();
  const empName = draft.meta?.name || 'Faculty';
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KMU_PER_Appraisal_${empName.replace(/[^a-zA-Z0-9]/g, '_')}_2026.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Appraisal Data Exported to JSON');
};

window.exportCSV = function() {
  var empName = document.getElementById('input_emp_name')?.value || 'Faculty';
  var prof = PROFILES[appraisalState.selectedProfile];
  var lines = [
    'Khyber Medical University (KMU) Peshawar — Annual Performance Appraisal Summary',
    'Document Reference,KMU/REG/POL/2026/01-REV (v3.0)',
    'Employee Name,' + empName,
    'Designation,' + (document.getElementById('input_emp_desig')?.value || ''),
    'Department,' + (document.getElementById('input_emp_dept')?.value || ''),
    'Appraisal Profile,' + prof.name,
    'Appraisal Cycle,' + (document.getElementById('input_emp_cycle')?.value || ''),
    '',
    'Performance Classification,Score,Scale',
    'Objective Performance Score (A+B+C+E),' + (document.getElementById('disp_objective_score')?.textContent || '') + ',' + (document.getElementById('disp_objective_pct')?.textContent || ''),
    'Subjective Performance Score (Dean - D),' + (document.getElementById('disp_subjective_score')?.textContent || '') + ',' + (document.getElementById('disp_subjective_pct')?.textContent || ''),
    'Disciplinary Red Flag Penalty,,,,' + (document.getElementById('disp_red_flag_penalty')?.textContent || '0'),
    'Consolidated Final Score,,,,' + (document.getElementById('liveScore')?.textContent || ''),
    'Performance Rating Band,,,,' + (document.getElementById('liveRatingBadge')?.textContent || ''),
    'PIP Procedure Status,,,,' + (document.getElementById('kpi_pip_status')?.textContent || '')
  ];

  var blob = new Blob([lines.join(String.fromCharCode(10))], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'KMU_PER_Summary_' + empName.replace(/[^a-zA-Z0-9]/g, '_') + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Summary CSV Exported');
};

window.printDossier = function() {
  window.switchTab('tab-summary');
  setTimeout(() => window.print(), 200);
};

window.openModal = function(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('active');
};

window.closeModal = function(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('active');
};

function showToast(msg) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✓</span> <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.remove) toast.remove();
      else if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, 3500);
}

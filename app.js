/**
 * KMU Faculty Annual Performance Appraisal System (v3.0)
 * Official statutory engine implementing KMU/REG/POL/2026/01-REV and
 * companion KMU Faculty Annual Performance Appraisal Calculator.
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

// 13 Core Parameters (Rated 1 - 6, Max 78)
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

// 5 CPD Targets (Rated 0 - 2, Max 10)
const CPD_TARGETS = [
  { id: 'cpd_1', label: 'CME/CPD Credit Hours vs Annual Target', desc: 'Approved professional development credit hours earned.' },
  { id: 'cpd_2', label: 'Workshop / Training / Short Course Attended', desc: 'Formally documented capacity-building program.' },
  { id: 'cpd_3', label: 'Professional Certification Obtained or Renewed', desc: 'Board, council, or specialized technical credential.' },
  { id: 'cpd_4', label: 'Cross-Training / New Technical Skill Acquired', desc: 'Mastery of new laboratory assays or pedagogical technology.' },
  { id: 'cpd_5', label: 'Presenter / Facilitator at a CPD Event', desc: 'Resource person for conferences, webinars, or workshops.' }
];

// State container
let appraisalState = {
  employee: {
    name: '',
    id: '',
    designation: 'Associate Professor',
    department: 'Institute of Pathology & Diagnostic Medicine (IPDM)',
    faculty: 'Faculty of Pathology & Diagnostic Medicine (FPDM)',
    payScale: 'BPS-20',
    cycle: '2025–2026',
    appraiser: '',
    reviewer: '',
    finalAuthority: 'Vice Chancellor'
  },
  selectedProfile: 'Balanced Profile',
  customWeights: null,
  sectionA: {
    qecScore: 82,
    actualWU: 32,
    exempted: 'N'
  },
  sectionB: {
    // B1: Publications
    pub_high_lead: 1,
    pub_high_co: 2,
    pub_mod_lead: 2,
    pub_mod_co: 1,
    pub_low_lead: 1,
    pub_low_co: 0,
    // B2: Books
    book_int: 0,
    book_nat: 1,
    chapter_int: 1,
    chapter_nat: 0,
    // B3: Grants Won & Applied
    grant_int_pi: 0,
    grant_int_copi: 1,
    grant_nat_pi: 1,
    grant_nat_copi: 1,
    grant_small_pi: 1,
    grant_applied: 3,
    // B4: Supervision
    sup_phd: 1,
    sup_mphil: 3,
    sup_clin_sr: 0,
    sup_clin_jr: 0,
    // B5: Innovation & Commercialization
    innov_patent_int: 0,
    innov_patent_nat: 1,
    innov_project: 1,
    innov_overhead: 1
  },
  sectionC: {
    comm_member: 3,
    comm_chair: 1,
    policy_doc: 2,
    facility_charge: 1,
    additional_appoint: 'N'
  },
  sectionD: {
    peerScores: {
      peer_1: 5, peer_2: 5, peer_3: 6, peer_4: 6, peer_5: 5,
      peer_6: 5, peer_7: 6, peer_8: 5, peer_9: 5, peer_10: 5,
      peer_11: 6, peer_12: 6, peer_13: 5
    },
    cpdScores: {
      cpd_1: 2, cpd_2: 2, cpd_3: 1, cpd_4: 2, cpd_5: 2
    }
  },
  sectionE: {
    clin_admin: 0,
    clin_volume: 0,
    clin_oncall: 0,
    clin_teaching: 0
  },
  redFlag: {
    penalty: 0,
    refNo: '',
    refDate: ''
  },
  narrative: {
    strengths: '',
    areasForImprovement: '',
    agreedTargets: '',
    appraiserRemarks: '',
    reviewerRemarks: '',
    appealFiled: 'N'
  }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initProfileCards();
  initPeerControls();
  initEventListeners();
  loadFromLocalStorage();
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
    card.onclick = () => selectProfile(key);

    card.innerHTML = `
      <div class="profile-title">${prof.name}</div>
      <p style="font-size:0.75rem; color:#64748b; margin-bottom:0.5rem;">${prof.description}</p>
      <ul class="profile-breakdown">
        <li><span>Teaching:</span> <strong>${prof.teachingWeight}%</strong> (Min WU: ${prof.minTeachingWU})</li>
        <li><span>Research & Innovation:</span> <strong>${prof.researchWeight}%</strong></li>
        <li><span>Institutional Service:</span> <strong>${prof.serviceWeight}%</strong></li>
        <li><span>Peer & CPD:</span> <strong>${prof.peerWeight}%</strong></li>
        ${prof.clinicalWeight > 0 ? `<li><span style="color:#b91c1c; font-weight:700;">Clinical Service:</span> <strong style="color:#b91c1c;">${prof.clinicalWeight}%</strong></li>` : ''}
      </ul>
    `;
    container.appendChild(card);
  });
}

// Select Profile
function selectProfile(profileKey) {
  appraisalState.selectedProfile = profileKey;
  initProfileCards();
  toggleClinicalSection();
  calculateAll();
  showToast(`Profile switched to: ${profileKey}`);
}

// Toggle Clinical Section visibility based on Profile
function toggleClinicalSection() {
  const isClinical = appraisalState.selectedProfile === 'Clinical-Focused Profile (Hospital Faculty)';
  const clinNavItem = document.getElementById('navItemClinical');
  const clinPill = document.getElementById('navPillClinical');
  
  if (clinNavItem) {
    if (isClinical) {
      clinNavItem.style.display = 'flex';
      clinPill.textContent = '45%';
      clinPill.style.background = '#7a1c1c';
      clinPill.style.color = '#fff';
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

function setPeerScore(paramId, score) {
  appraisalState.sectionD.peerScores[paramId] = score;
  const container = document.getElementById(`chips_${paramId}`);
  if (container) {
    container.querySelectorAll('.score-chip-btn').forEach((btn, idx) => {
      btn.classList.toggle('selected', idx + 1 === score);
    });
  }
  calculateAll();
}

function setCpdScore(targetId, score) {
  appraisalState.sectionD.cpdScores[targetId] = score;
  const container = document.getElementById(`chips_${targetId}`);
  if (container) {
    container.querySelectorAll('.score-chip-btn').forEach((btn, idx) => {
      btn.classList.toggle('selected', idx === score);
    });
  }
  calculateAll();
}

// Global Calculation Engine
function calculateAll() {
  const prof = PROFILES[appraisalState.selectedProfile] || PROFILES['Balanced Profile'];
  
  // Weights
  const wTeaching = prof.teachingWeight / 100;
  const wResearch = prof.researchWeight / 100;
  const wService = prof.serviceWeight / 100;
  const wPeer = prof.peerWeight / 100;
  const wClinical = prof.clinicalWeight / 100;
  const minTeachingWU = prof.minTeachingWU;

  // Update DOM Pills for weights
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
  updateElementText('dossier_min_wu', minTeachingWU);
  
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
  // B1: Publications
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

  // B2: Books
  const bookInt = getInputValue('input_book_int') * 8;
  const bookNat = getInputValue('input_book_nat') * 5;
  const chapInt = getInputValue('input_chapter_int') * 4;
  const chapNat = getInputValue('input_chapter_nat') * 2;
  const subB2Raw = bookInt + bookNat + chapInt + chapNat;
  const subB2Capped = Math.min(20, subB2Raw);

  updateElementText('disp_sub_b2', subB2Capped.toFixed(1));
  updateElementText('disp_sub_b2_raw', subB2Raw);

  // B3: Grants Won & Applied
  const grantIntPI = getInputValue('input_grant_int_pi') * 15;
  const grantIntCoPI = getInputValue('input_grant_int_copi') * 4.5;
  const grantNatPI = getInputValue('input_grant_nat_pi') * 8;
  const grantNatCoPI = getInputValue('input_grant_nat_copi') * 4;
  const grantSmallPI = getInputValue('input_grant_small_pi') * 4;
  const grantWonSum = grantIntPI + grantIntCoPI + grantNatPI + grantNatCoPI + grantSmallPI;

  const grantAppliedRaw = getInputValue('input_grant_applied') * 2;
  const grantAppliedCapped = Math.min(20, grantAppliedRaw);

  const subB3Raw = grantWonSum + grantAppliedRaw;
  const subB3Capped = Math.min(50, grantWonSum + grantAppliedCapped);

  updateElementText('disp_sub_b3', subB3Capped.toFixed(1));
  updateElementText('disp_sub_b3_raw', subB3Raw);

  // B4: Supervision
  const supPhD = getInputValue('input_sup_phd') * 8;
  const supMPhil = getInputValue('input_sup_mphil') * 4;
  const supClinSr = getInputValue('input_sup_clin_sr') * 8;
  const supClinJr = getInputValue('input_sup_clin_jr') * 4;
  const subB4Raw = supPhD + supMPhil + supClinSr + supClinJr;
  const subB4Capped = Math.min(40, subB4Raw);

  updateElementText('disp_sub_b4', subB4Capped.toFixed(1));
  updateElementText('disp_sub_b4_raw', subB4Raw);

  // B5: Innovation & Commercialization
  const innPatInt = getInputValue('input_innov_patent_int') * 10;
  const innPatNat = getInputValue('input_innov_patent_nat') * 6;
  const innProj = getInputValue('input_innov_project') * 8;
  const innOverhead = getInputValue('input_innov_overhead') * 10;
  const subB5Raw = innPatInt + innPatNat + innProj + innOverhead;
  const subB5Capped = Math.min(40, subB5Raw);

  updateElementText('disp_sub_b5', subB5Capped.toFixed(1));
  updateElementText('disp_sub_b5_raw', subB5Raw);

  // Section B Total (Max 200)
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
  updateElementText('disp_weight_c', `${prof.serviceWeight}%`);
  updateElementText('disp_weighted_c', weightedC.toFixed(2));

  // --- 4. SECTION D: PEER EVALUATION & CPD ---
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

  // --- 7. CONSOLIDATED FINAL SCORE ---
  const sumWeighted = weightedA + weightedB + weightedC + weightedD + weightedE;
  const finalScore = Math.max(0, sumWeighted - validPenalty);

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

  // Update Status Bar
  updateElementText('liveScore', finalScore.toFixed(1));
  const badge = document.getElementById('liveRatingBadge');
  if (badge) {
    badge.textContent = ratingBand;
    badge.className = `rating-badge ${ratingClass}`;
  }
  updateElementText('liveProfileName', prof.name);

  // Update Summary Tab KPIs
  updateElementText('kpi_final_score', `${finalScore.toFixed(1)}%`);
  updateElementText('kpi_rating_band', ratingBand);
  updateElementText('kpi_pip_status', pipStatus);
  updateElementText('kpi_pip_desc', pipDesc);
  updateElementText('kpi_penalty_applied', validPenalty > 0 ? `-${validPenalty} pts` : 'None');

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

  updateElementText('dossier_penalty', validPenalty > 0 ? `-${validPenalty} pts (${refNo})` : '0 pts');
  updateElementText('dossier_final_score', `${finalScore.toFixed(1)} / 100`);
  updateElementText('dossier_final_rating', ratingBand);
  updateElementText('dossier_pip_note', pipStatus);

  // Sync state
  appraisalState.finalScore = finalScore;
  appraisalState.ratingBand = ratingBand;
  appraisalState.pipStatus = pipStatus;

  // Render Visual Bar Representation
  renderScoreBars({
    teaching: (rawA / 100) * 100,
    research: (rawB / 200) * 100,
    service: (rawC / 100) * 100,
    peer: (rawD / 88) * 100,
    clinical: prof.clinicalWeight > 0 ? (rawE / 100) * 100 : 0
  });

  saveToLocalStorage();
}

// Render percentage bars
function renderScoreBars(attainment) {
  const container = document.getElementById('domainProgressContainer');
  if (!container) return;
  const isClinical = PROFILES[appraisalState.selectedProfile]?.clinicalWeight > 0;

  container.innerHTML = `
    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span>Teaching & Curriculum</span>
        <span>${attainment.teaching.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#7a1c1c; width:${Math.min(100, attainment.teaching)}%; height:100%;"></div>
      </div>
    </div>

    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span>Research, Grants & Innovation</span>
        <span>${attainment.research.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#c59b27; width:${Math.min(100, attainment.research)}%; height:100%;"></div>
      </div>
    </div>

    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span>Institutional Service</span>
        <span>${attainment.service.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#2563eb; width:${Math.min(100, attainment.service)}%; height:100%;"></div>
      </div>
    </div>

    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span>Peer Conduct & CPD</span>
        <span>${attainment.peer.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#059669; width:${Math.min(100, attainment.peer)}%; height:100%;"></div>
      </div>
    </div>

    ${isClinical ? `
    <div style="margin-bottom:0.75rem;">
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
        <span style="color:#b91c1c;">Clinical & Diagnostic Care</span>
        <span>${attainment.clinical.toFixed(1)}%</span>
      </div>
      <div style="background:#e2e8f0; border-radius:9999px; height:8px; overflow:hidden;">
        <div style="background:#dc2626; width:${Math.min(100, attainment.clinical)}%; height:100%;"></div>
      </div>
    </div>
    ` : ''}
  `;
}

// Helpers
function getInputValue(id) {
  const el = document.getElementById(id);
  return el ? Math.max(0, parseFloat(el.value) || 0) : 0;
}

function updateElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  const targetNav = document.querySelector(`[data-tab="${tabId}"]`);

  if (targetTab) targetTab.classList.add('active');
  if (targetNav) targetNav.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Attach Event Listeners
function initEventListeners() {
  // Navigation clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
    });
  });

  // Re-calculate on all numeric and select inputs
  document.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', calculateAll);
    input.addEventListener('change', calculateAll);
  });

  // Sync employee meta info to dossier
  ['emp_name', 'emp_id', 'emp_desig', 'emp_dept', 'emp_cadre', 'emp_cycle', 'emp_appraiser', 'emp_reviewer'].forEach(f => {
    const input = document.getElementById(`input_${f}`);
    if (input) {
      input.addEventListener('input', () => {
        updateElementText(`dossier_${f}`, input.value || '—');
      });
    }
  });
}

// Pre-fill Sample Verified Profile (Dr. Yasar Yousafzai / Associate Professor, IPDM)
function loadSampleData() {
  document.getElementById('input_emp_name').value = 'Dr. Yasar Mehmood Yousafzai';
  document.getElementById('input_emp_id').value = 'KMU-FAC-2016-042';
  document.getElementById('input_emp_desig').value = 'Associate Professor';
  document.getElementById('input_emp_dept').value = 'Institute of Pathology & Diagnostic Medicine (IPDM)';
  document.getElementById('input_emp_cadre').value = 'BPS-20 (Regular)';
  document.getElementById('input_emp_cycle').value = '2025–2026';
  document.getElementById('input_emp_appraiser').value = 'Dean, Faculty of Pathology & Diagnostic Medicine';
  document.getElementById('input_emp_reviewer').value = 'Vice Chancellor, KMU';

  // Section A
  document.getElementById('input_qec_score').value = '86';
  document.getElementById('input_actual_wu').value = '34';
  document.getElementById('input_wu_exempted').value = 'N';

  // Section B
  document.getElementById('input_pub_high_lead').value = '2';
  document.getElementById('input_pub_high_co').value = '2';
  document.getElementById('input_pub_mod_lead').value = '3';
  document.getElementById('input_pub_mod_co').value = '2';
  document.getElementById('input_pub_low_lead').value = '1';
  document.getElementById('input_pub_low_co').value = '0';

  document.getElementById('input_book_int').value = '0';
  document.getElementById('input_book_nat').value = '1';
  document.getElementById('input_chapter_int').value = '2';
  document.getElementById('input_chapter_nat').value = '1';

  document.getElementById('input_grant_int_pi').value = '0';
  document.getElementById('input_grant_int_copi').value = '1';
  document.getElementById('input_grant_nat_pi').value = '1';
  document.getElementById('input_grant_nat_copi').value = '2';
  document.getElementById('input_grant_small_pi').value = '1';
  document.getElementById('input_grant_applied').value = '4';

  document.getElementById('input_sup_phd').value = '2';
  document.getElementById('input_sup_mphil').value = '4';
  document.getElementById('input_sup_clin_sr').value = '0';
  document.getElementById('input_sup_clin_jr').value = '0';

  document.getElementById('input_innov_patent_int').value = '0';
  document.getElementById('input_innov_patent_nat').value = '1';
  document.getElementById('input_innov_project').value = '1';
  document.getElementById('input_innov_overhead').value = '2';

  // Section C
  document.getElementById('input_comm_member').value = '4';
  document.getElementById('input_comm_chair').value = '1';
  document.getElementById('input_policy_doc').value = '3';
  document.getElementById('input_facility_charge').value = '1';
  document.getElementById('input_additional_appoint').value = 'N';

  // Section D
  PEER_PARAMETERS.forEach(p => {
    appraisalState.sectionD.peerScores[p.id] = 5;
  });
  appraisalState.sectionD.peerScores['peer_4'] = 6;
  appraisalState.sectionD.peerScores['peer_12'] = 6;

  CPD_TARGETS.forEach(t => {
    appraisalState.sectionD.cpdScores[t.id] = 2;
  });

  initPeerControls();

  // Red flag
  document.getElementById('input_red_flag').value = '0';
  document.getElementById('input_red_flag_ref').value = '';
  document.getElementById('input_red_flag_date').value = '';

  // Trigger meta sync
  ['emp_name', 'emp_id', 'emp_desig', 'emp_dept', 'emp_cadre', 'emp_cycle', 'emp_appraiser', 'emp_reviewer'].forEach(f => {
    const val = document.getElementById(`input_${f}`)?.value;
    updateElementText(`dossier_${f}`, val || '—');
  });

  selectProfile('Balanced Profile');
  calculateAll();
  showToast('Standard KMU Faculty Profile Loaded Successfully!');
}

// Reset Form
function resetForm() {
  if (!confirm('Are you sure you want to clear the form and start a new appraisal record?')) return;
  localStorage.removeItem('KMU_APPRAISAL_STATE_v3');
  location.reload();
}

// Local Storage Persistence
function saveToLocalStorage() {
  try {
    const dataToSave = {
      profile: appraisalState.selectedProfile,
      meta: {
        name: document.getElementById('input_emp_name')?.value || '',
        id: document.getElementById('input_emp_id')?.value || '',
        desig: document.getElementById('input_emp_desig')?.value || '',
        dept: document.getElementById('input_emp_dept')?.value || '',
        cadre: document.getElementById('input_emp_cadre')?.value || '',
        cycle: document.getElementById('input_emp_cycle')?.value || '',
        appraiser: document.getElementById('input_emp_appraiser')?.value || '',
        reviewer: document.getElementById('input_emp_reviewer')?.value || ''
      },
      peerScores: appraisalState.sectionD.peerScores,
      cpdScores: appraisalState.sectionD.cpdScores
    };
    localStorage.setItem('KMU_APPRAISAL_STATE_v3', JSON.stringify(dataToSave));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem('KMU_APPRAISAL_STATE_v3');
    if (!saved) {
      loadSampleData();
      return;
    }
    const data = JSON.parse(saved);
    if (data.profile) appraisalState.selectedProfile = data.profile;
    if (data.meta) {
      document.getElementById('input_emp_name').value = data.meta.name || '';
      document.getElementById('input_emp_id').value = data.meta.id || '';
      document.getElementById('input_emp_desig').value = data.meta.desig || '';
      document.getElementById('input_emp_dept').value = data.meta.dept || '';
      document.getElementById('input_emp_cadre').value = data.meta.cadre || '';
      document.getElementById('input_emp_cycle').value = data.meta.cycle || '';
      document.getElementById('input_emp_appraiser').value = data.meta.appraiser || '';
      document.getElementById('input_emp_reviewer').value = data.meta.reviewer || '';
      
      ['emp_name', 'emp_id', 'emp_desig', 'emp_dept', 'emp_cadre', 'emp_cycle', 'emp_appraiser', 'emp_reviewer'].forEach(f => {
        const val = document.getElementById(`input_${f}`)?.value;
        updateElementText(`dossier_${f}`, val || '—');
      });
    }
    if (data.peerScores) appraisalState.sectionD.peerScores = data.peerScores;
    if (data.cpdScores) appraisalState.sectionD.cpdScores = data.cpdScores;
    initPeerControls();
  } catch (e) {
    console.warn('LocalStorage load failed:', e);
  }
}

// Export Dossier JSON
function exportJSON() {
  const exportBlob = new Blob([JSON.stringify(appraisalState, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(exportBlob);
  const a = document.createElement('a');
  const empName = document.getElementById('input_emp_name')?.value || 'Faculty';
  a.href = url;
  a.download = `KMU_PER_Appraisal_${empName.replace(/[^a-zA-Z0-9]/g, '_')}_2026.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Appraisal Data Exported to JSON');
}

// Export CSV Summary
function exportCSV() {
  const empName = document.getElementById('input_emp_name')?.value || 'Faculty';
  const prof = PROFILES[appraisalState.selectedProfile];
  const csvRows = [
    ['Khyber Medical University (KMU) Peshawar — Annual Performance Appraisal Summary'],
    ['Document Reference', 'KMU/REG/POL/2026/01-REV (v3.0)'],
    ['Employee Name', empName],
    ['Employee ID', document.getElementById('input_emp_id')?.value || ''],
    ['Designation', document.getElementById('input_emp_desig')?.value || ''],
    ['Department', document.getElementById('input_emp_dept')?.value || ''],
    ['Appraisal Profile', prof.name],
    ['Appraisal Cycle', document.getElementById('input_emp_cycle')?.value || ''],
    [],
    ['Section', 'Weight (%)', 'Raw Points', 'Max Base', 'Weighted Score'],
    ['Section A: Teaching', prof.teachingWeight, document.getElementById('disp_raw_a')?.textContent || '', 100, document.getElementById('disp_weighted_a')?.textContent || ''],
    ['Section B: Research & Innovation', prof.researchWeight, document.getElementById('disp_raw_b')?.textContent || '', 200, document.getElementById('disp_weighted_b')?.textContent || ''],
    ['Section C: Institutional Service', prof.serviceWeight, document.getElementById('disp_raw_c')?.textContent || '', 100, document.getElementById('disp_weighted_c')?.textContent || ''],
    ['Section D: Peer & Professional Conduct', prof.peerWeight, document.getElementById('disp_raw_d')?.textContent || '', 88, document.getElementById('disp_weighted_d')?.textContent || ''],
    ['Section E: Clinical Service', prof.clinicalWeight, document.getElementById('disp_raw_e')?.textContent || '', 100, document.getElementById('disp_weighted_e')?.textContent || ''],
    ['Disciplinary Red Flag Penalty', '', '', '', document.getElementById('disp_red_flag_penalty')?.textContent || '0'],
    ['Consolidated Final Score', '', '', '', document.getElementById('liveScore')?.textContent || ''],
    ['Performance Rating Band', '', '', '', document.getElementById('liveRatingBadge')?.textContent || ''],
    ['PIP Procedure Status', '', '', '', document.getElementById('kpi_pip_status')?.textContent || '']
  ];

  const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("
");
  const encodedUri = encodeURI(csvContent);
  const a = document.createElement("a");
  a.setAttribute("href", encodedUri);
  a.setAttribute("download", `KMU_PER_Summary_${empName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Summary CSV Exported');
}

// Print Official PER Dossier
function printDossier() {
  switchTab('tab-summary');
  window.print();
}

// Modals
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('active');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('active');
}

// Toast notification
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
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

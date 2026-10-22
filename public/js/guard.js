/**
 * SocietyHub — Gate Security Control Center (guard.js)
 * ─────────────────────────────────────────────────────
 * Security Guard portal:
 *   1. Entry Desk        — visitor registration + pre-approved fast entry
 *   2. Pending Approvals — live resident-approval queue + guard override
 *   3. Inside Society    — check-in / check-out + QR gate pass
 *   4. Deliveries        — quick in/out for delivery agents
 *   5. Visitor History   — searchable gate log + date filter + CSV export
 *   6. Emergency Alerts  — resident SOS alerts with resolve workflow
 *
 * Role guard: ONLY 'Security Guard' may use this portal.
 */

'use strict';

/* ══════════════════════════════════════════════
   Globals & constants
   ══════════════════════════════════════════════ */

let guardUser = null;
let activeGuardTab = 'entry';
let historyTableApi = null;
let guardAutoTimer = null;
let fastEntryPavId = null;
let photoCaptured = false;

const GUARD_TYPE_META = {
  'Guest': { icon: 'fa-user-group', tone: 'primary' },
  'Delivery': { icon: 'fa-box-open', tone: 'success' },
  'Cab': { icon: 'fa-taxi', tone: 'info' },
  'Service Provider': { icon: 'fa-screwdriver-wrench', tone: 'warning' },
  'Staff': { icon: 'fa-user-gear', tone: 'navy' },
  'Other': { icon: 'fa-circle-question', tone: 'secondary' }
};

const EMERGENCY_ICONS = {
  'Fire': 'fa-fire',
  'Medical': 'fa-heart-pulse',
  'Security': 'fa-user-shield',
  'Lift': 'fa-elevator',
  'Elevator': 'fa-elevator',
  'Water': 'fa-droplet',
  'Gas Leak': 'fa-smog',
  'Earthquake': 'fa-house-crack',
  'Other': 'fa-triangle-exclamation'
};

/* ══════════════════════════════════════════════
   Small helpers
   ══════════════════════════════════════════════ */

function esc(value) {
  return window.SHUI ? SHUI.escapeHtml(value) : String(value === null || value === undefined ? '' : value);
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** Local-timezone YYYY-MM-DD (matches SystemDB._nowStamp format). */
function localTodaySlug() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function isTodayStamp(stamp) {
  return !!stamp && String(stamp).startsWith(localTodaySlug());
}

function parseStamp(s) {
  if (!s || s === 'Still In Society') return null;
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

function fmtDuration(mins) {
  if (mins === null || mins === undefined || mins === '') return '—';
  const m = Number(mins);
  if (!isFinite(m)) return '—';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h + ' hr' + (r ? ' ' + r + ' min' : '');
}

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return digits;
}

function isValidPhone(raw) {
  return /^[6-9]\d{9}$/.test(normalizePhone(raw));
}

function typeMeta(type) {
  return GUARD_TYPE_META[type] || GUARD_TYPE_META['Other'];
}

function typeIconHtml(type) {
  return '<i class="fa-solid ' + typeMeta(type).icon + '"></i>';
}

function typeBadge(type) {
  const m = typeMeta(type);
  return '<span class="sh-badge sh-badge--' + m.tone + '"><i class="fa-solid ' + m.icon + '"></i>' + esc(type || 'Other') + '</span>';
}

function getVisitorsSafe() {
  try { return SystemDB.getVisitors() || []; } catch (e) { return []; }
}

function getPreApprovedSafe() {
  try { return SystemDB.getPreApprovedVisitors() || []; } catch (e) { return []; }
}

function getEmergencySafe() {
  try { return SystemDB.getEmergencyAlerts() || []; } catch (e) { return []; }
}

/** Find the resident account for a flat (falls back to name match). */
function findResident(flat, name) {
  try {
    const users = SystemDB.getUsers() || [];
    return (
      users.find(u => (u.role === 'Resident' || u.role === 'Admin') && u.flat && u.flat === flat) ||
      users.find(u => (u.role === 'Resident' || u.role === 'Admin') && name && u.name === name) ||
      null
    );
  } catch (e) {
    return null;
  }
}

/** Notify the resident of a flat (targets the user id when found). */
function notifyResident(flat, residentName, payload) {
  try {
    const resident = findResident(flat, residentName);
    SystemDB.notify(Object.assign({ target: resident ? resident.id : 'Resident' }, payload));
  } catch (e) { /* notifications are non-fatal */ }
}

/* ══════════════════════════════════════════════
   Boot
   ══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await SystemDB.init();
  } catch (err) {
    console.error('[guard] SystemDB failed to initialize', err);
  }

  guardUser = SystemDB.getCurrentUser();

  // Role guard — this portal is exclusively for Security Guards.
  if (!guardUser || guardUser.role !== 'Security Guard') {
    const portals = { 'Admin': 'admin.html', 'Resident': 'resident.html', 'Committee Member': 'committee.html' };
    window.location.href = (guardUser && portals[guardUser.role]) || 'index.html';
    return;
  }
  if (guardUser.status && guardUser.status !== 'Approved') {
    window.location.href = 'waiting-approval.html';
    return;
  }

  // Navbar identity
  const nameEl = document.getElementById('guardName');
  if (nameEl) nameEl.textContent = guardUser.name || 'Security Guard';
  const gateEl = document.getElementById('guardGate');
  if (gateEl) gateEl.textContent = guardUser.gateAssigned || 'Main Gate';
  const avatarEl = document.getElementById('guardAvatar');
  if (avatarEl && guardUser.avatar) avatarEl.src = guardUser.avatar;

  const modeBadgeEl = document.getElementById('guardModeBadge');
  if (modeBadgeEl) {
    const isDemo = SystemDB.isDemoMode();
    const socCode = SystemDB.getSocietyCode();
    const socSettings = (SystemDB.data && SystemDB.data.societySettings) || {};
    const socName = socSettings.name || guardUser.societyName || sessionStorage.getItem('ssm_society_name') || 'Society Gate';
    modeBadgeEl.className = 'badge rounded-pill px-3 py-2 fs-8 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm';
    if (isDemo) {
      modeBadgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
      modeBadgeEl.style.color = '#F59E0B';
      modeBadgeEl.style.border = '1px solid rgba(245, 158, 11, 0.3)';
      modeBadgeEl.innerHTML = '<i class="fa-solid fa-flask me-1"></i> Demo Mode &middot; Sample Gate';
    } else {
      modeBadgeEl.style.background = 'rgba(14, 165, 233, 0.15)';
      modeBadgeEl.style.color = '#38BDF8';
      modeBadgeEl.style.border = '1px solid rgba(14, 165, 233, 0.3)';
      modeBadgeEl.innerHTML = `<i class="fa-solid fa-building me-1"></i> ${esc(socName)} &middot; <strong class="ms-1" style="font-family:monospace;letter-spacing:1px;">${esc(socCode)}</strong>`;
    }
  }

  renderPageHeader();
  showSkeletons();
  renderPhotoBox();
  bindTabs();
  bindEntryForm();

  const historyDateEl = document.getElementById('historyDate');
  if (historyDateEl) historyDateEl.addEventListener('change', () => renderHistory());

  // First real render (after a brief skeleton pass)
  setTimeout(() => {
    try {
      renderAll();
      if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    } catch (err) {
      console.error('[guard] initial render failed', err);
    }
  }, 400);

  // Live sync: refresh KPIs + list-style tabs every 30s
  guardAutoTimer = setInterval(() => {
    try {
      renderKPIs();
      renderTabBadges();
      if (['pending', 'inside', 'deliveries', 'emergency'].indexOf(activeGuardTab) !== -1) {
        renderTab(activeGuardTab);
      }
      if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    } catch (e) { /* keep the timer alive */ }
  }, 30000);
});

/* ══════════════════════════════════════════════
   Page scaffolding
   ══════════════════════════════════════════════ */

function renderPageHeader() {
  const host = document.getElementById('guardPageHeader');
  if (!host || !window.SHUI) return;
  const gate = guardUser.gateAssigned || 'Main Gate';
  const shift = guardUser.shift || 'Gate Duty';
  host.innerHTML = SHUI.pageHeader({
    title: 'Gate Security Control',
    subtitle: gate + ' · ' + shift + ' · ' + SHUI.formatDate(new Date()),
    actionsHtml:
      '<button type="button" class="btn btn-outline-secondary rounded-pill px-3" onclick="refreshGuardDashboard()">' +
      '<i class="fa-solid fa-rotate me-1"></i> Refresh</button>'
  });
}

function showSkeletons() {
  const kpi = document.getElementById('kpiRow');
  if (kpi && window.SHUI) {
    let html = '';
    for (let i = 0; i < 6; i++) {
      html += '<div class="col-6 col-md-4 col-xl-2"><div class="hub-card p-3">' + SHUI.skeletonHtml(3) + '</div></div>';
    }
    kpi.innerHTML = html;
  }
  ['pendingList', 'insideList', 'deliveryList', 'emergencyList', 'expectedTodayList'].forEach(id => {
    const el = document.getElementById(id);
    if (el && window.SHUI) el.innerHTML = '<div class="hub-card p-4">' + SHUI.skeletonHtml(4) + '</div>';
  });
}

function renderAll() {
  try { renderKPIs(); } catch (e) { console.error('[guard] KPI render failed', e); }
  try { renderTabBadges(); } catch (e) { console.error('[guard] tab badge render failed', e); }
  try { renderTab(activeGuardTab); } catch (e) { console.error('[guard] tab render failed', e); }
}

function renderTab(tab) {
  switch (tab) {
    case 'entry': renderEntryDesk(); break;
    case 'pending': renderPendingApprovals(); break;
    case 'inside': renderInsideSociety(); break;
    case 'deliveries': renderDeliveries(); break;
    case 'history': renderHistory(); break;
    case 'emergency': renderEmergencyAlerts(); break;
  }
}

/* ══════════════════════════════════════════════
   Tabs
   ══════════════════════════════════════════════ */

function bindTabs() {
  document.querySelectorAll('[data-guard-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchGuardTab(btn.getAttribute('data-guard-tab')));
  });
}

function switchGuardTab(tab) {
  activeGuardTab = tab;
  document.querySelectorAll('[data-guard-tab]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-guard-tab') === tab);
  });
  document.querySelectorAll('.guard-pane').forEach(p => {
    const isTarget = p.id === 'tab-guard-' + tab;
    p.classList.toggle('show', isTarget);
    p.classList.toggle('active', isTarget);
  });
  try { renderTab(tab); } catch (e) { console.error('[guard] tab render failed', e); }
}

/* ══════════════════════════════════════════════
   KPI cards & tab badges
   ══════════════════════════════════════════════ */

function computeStats() {
  const visitors = getVisitorsSafe();
  const today = visitors.filter(v => isTodayStamp(v.entryTime));
  return {
    all: visitors,
    today: today,
    inside: visitors.filter(v => v.status === 'Checked In'),
    insideTab: visitors.filter(v => v.status === 'Approved' || v.status === 'Checked In'),
    pending: visitors.filter(v => v.status === 'Pending'),
    expected: getPreApprovedSafe().filter(p => p.expectedDate === localTodaySlug() && p.status === 'Pending'),
    deliveries: today.filter(v => v.type === 'Delivery'),
    vehicles: today.filter(v => v.vehicleNo && v.vehicleNo !== 'N/A'),
    emergencies: getEmergencySafe().filter(a => a.status === 'Active')
  };
}

function renderKPIs() {
  const host = document.getElementById('kpiRow');
  if (!host || !window.SHUI) return;
  const s = computeStats();
  const cards = [
    SHUI.statCard({ label: 'Visitors Today', value: s.today.length, sub: 'Gate passes issued', icon: 'fa-address-card', tone: 'primary' }),
    SHUI.statCard({ label: 'Currently Inside', value: s.inside.length, sub: 'Checked in right now', icon: 'fa-house-user', tone: 'info' }),
    SHUI.statCard({ label: 'Expected Today', value: s.expected.length, sub: 'Pre-approved visitors', icon: 'fa-calendar-check', tone: 'success' }),
    SHUI.statCard({ label: 'Pending Approvals', value: s.pending.length, sub: 'Waiting on residents', icon: 'fa-hourglass-half', tone: 'warning' }),
    SHUI.statCard({ label: 'Deliveries Today', value: s.deliveries.length, sub: 'Parcels & food', icon: 'fa-box-open', tone: 'navy' }),
    SHUI.statCard({ label: 'Vehicle Entries', value: s.vehicles.length, sub: 'Logged with plate no.', icon: 'fa-car-side', tone: 'danger' })
  ];
  host.innerHTML = cards.map((card, i) =>
    '<div class="col-6 col-md-4 col-xl-2" style="animation-delay:' + (i * 40) + 'ms">' + card + '</div>'
  ).join('');
}

function renderTabBadges() {
  const s = computeStats();
  setTabBadge('tabPendingCount', s.pending.length);
  setTabBadge('tabInsideCount', s.insideTab.length);
  setTabBadge('tabEmergencyCount', s.emergencies.length);
}

function setTabBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count > 99 ? '99+' : String(count);
  el.classList.toggle('d-none', count === 0);
}

/* ══════════════════════════════════════════════
   1) Entry Desk
   ══════════════════════════════════════════════ */

function renderEntryDesk() {
  populateResidentSelect();
  renderExpectedToday();
}

function populateResidentSelect() {
  const select = document.getElementById('visResident');
  if (!select) return;
  const currentValue = select.value;
  let residents = [];
  try {
    residents = (SystemDB.getUsers() || [])
      .filter(u => u.role === 'Resident' && u.flat && u.status !== 'Pending')
      .sort((a, b) => String(a.flat).localeCompare(String(b.flat)));
  } catch (e) { residents = []; }

  select.innerHTML = '<option value="" disabled selected>Select resident / flat…</option>' +
    residents.map(r =>
      '<option value="' + esc(r.flat) + '" data-name="' + esc(r.name) + '" data-phone="' + esc(r.phone || '') + '" data-id="' + esc(r.id) + '">' +
      esc(r.flat) + ' — ' + esc(r.name) +
      '</option>'
    ).join('');
  if (currentValue) select.value = currentValue;
}

function renderExpectedToday() {
  const host = document.getElementById('expectedTodayList');
  if (!host || !window.SHUI) return;
  const list = getPreApprovedSafe()
    .filter(p => p.expectedDate === localTodaySlug())
    .sort((a, b) => String(a.expectedTimeFrom || '').localeCompare(String(b.expectedTimeFrom || '')));

  if (!list.length) {
    host.innerHTML = SHUI.emptyState({
      icon: 'fa-calendar-day',
      title: 'No pre-approved visitors today',
      subtitle: 'Residents can pre-register visitors from their portal — expected arrivals appear here for fast entry.'
    });
    return;
  }

  host.innerHTML = list.map(p => {
    const arrived = p.status === 'Arrived';
    return (
      '<div class="d-flex align-items-center justify-content-between gap-2 border rounded-3 p-3 mb-2" style="border-color: var(--border-color) !important;">' +
      '  <div class="d-flex align-items-center gap-3" style="min-width:0;">' +
      '    <div class="metric-icon bg-icon-success" style="width:42px;height:42px;min-width:42px;font-size:1rem;">' + typeIconHtml(p.type || 'Guest') + '</div>' +
      '    <div style="min-width:0;">' +
      '      <div class="fw-bold text-heading text-truncate">' + esc(p.visitorName) + '</div>' +
      '      <div class="caption-text">' + esc(p.flat || '') + ' · ' + esc(p.expectedTimeFrom || '—') + ' – ' + esc(p.expectedTimeTo || '—') + '</div>' +
      '    </div>' +
      '  </div>' +
      (arrived ? SHUI.badge('Arrived', 'success') : SHUI.badge('Expected', 'warning')) +
      '</div>'
    );
  }).join('');
}

function renderPhotoBox() {
  const box = document.getElementById('photoBox');
  if (!box) return;
  box.innerHTML = photoCaptured
    ? '<i class="fa-solid fa-circle-check text-success fa-lg mb-1"></i>' +
      '<span class="caption-text fw-semibold d-block">Photo captured (simulated)</span>' +
      '<span class="caption-text">Tap to remove</span>'
    : '<i class="fa-solid fa-camera text-muted fa-lg mb-1"></i>' +
      '<span class="caption-text fw-semibold d-block">Visitor photo (optional)</span>' +
      '<span class="caption-text">Tap to capture at gate</span>';
  box.style.borderColor = photoCaptured ? 'var(--accent-success)' : 'var(--border-dark)';
}

function bindEntryForm() {
  const form = document.getElementById('visitorEntryForm');
  if (!form) return;

  const residentSel = document.getElementById('visResident');
  const nameEl = document.getElementById('visName');
  const phoneEl = document.getElementById('visPhone');
  const purposeEl = document.getElementById('visPurpose');
  const photoBox = document.getElementById('photoBox');

  residentSel.addEventListener('change', () => {
    const opt = residentSel.options[residentSel.selectedIndex];
    const flat = residentSel.value || '';
    const flatEl = document.getElementById('visFlat');
    if (flatEl) flatEl.value = flat;
    const info = document.getElementById('visResidentInfo');
    if (info) {
      info.innerHTML = flat && opt
        ? '<i class="fa-solid fa-user me-1"></i>' + esc(opt.getAttribute('data-name') || '') +
          ' &nbsp;·&nbsp; <i class="fa-solid fa-phone me-1"></i>' + esc(opt.getAttribute('data-phone') || '—')
        : '';
    }
    clearFieldError(residentSel);
    checkPreApprovedMatch();
  });

  [nameEl, phoneEl].forEach(el => {
    el.addEventListener('input', () => {
      clearFieldError(el);
      checkPreApprovedMatch();
    });
  });
  purposeEl.addEventListener('input', () => clearFieldError(purposeEl));

  photoBox.addEventListener('click', () => {
    photoCaptured = !photoCaptured;
    renderPhotoBox();
  });
  photoBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      photoCaptured = !photoCaptured;
      renderPhotoBox();
    }
  });

  form.addEventListener('submit', onVisitorSubmit);
}

/* ── Inline validation helpers ── */

function setFieldError(input, message) {
  if (!input) return;
  input.classList.add('is-invalid');
  const group = input.closest('.field-group');
  const feedback = group ? group.querySelector('.invalid-feedback') : null;
  if (feedback) {
    feedback.textContent = message;
    feedback.style.display = 'block';
  }
}

function clearFieldError(input) {
  if (!input) return;
  input.classList.remove('is-invalid');
  const group = input.closest('.field-group');
  const feedback = group ? group.querySelector('.invalid-feedback') : null;
  if (feedback) feedback.style.display = 'none';
}

/* ── Pre-approved matching & fast entry ── */

function findPreApprovedMatch() {
  const sel = document.getElementById('visResident');
  const flat = sel ? sel.value : '';
  const name = (document.getElementById('visName').value || '').trim().toLowerCase();
  const phone = normalizePhone(document.getElementById('visPhone').value || '');
  if (!flat || (!name && !phone)) return null;

  return getPreApprovedSafe().find(p =>
    p.status === 'Pending' &&
    p.expectedDate === localTodaySlug() &&
    p.flat === flat &&
    ((name && String(p.visitorName || '').toLowerCase() === name) ||
     (phone && normalizePhone(p.visitorPhone || '') === phone))
  ) || null;
}

function checkPreApprovedMatch() {
  const box = document.getElementById('preApprovedSuggestion');
  if (!box) return;
  const match = findPreApprovedMatch();
  if (!match) {
    box.classList.add('d-none');
    box.innerHTML = '';
    fastEntryPavId = null;
    return;
  }
  fastEntryPavId = match.id;
  box.classList.remove('d-none');
  box.innerHTML =
    '<div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">' +
    '  <span><i class="fa-solid fa-bolt me-1"></i><strong>Pre-approved — fast entry available.</strong> ' +
    esc(match.visitorName) + ' is expected for Flat ' + esc(match.flat) +
    (match.expectedTimeFrom ? ' (' + esc(match.expectedTimeFrom) + ' – ' + esc(match.expectedTimeTo || '') + ')' : '') + '.</span>' +
    '  <button type="button" class="btn btn-success btn-sm rounded-pill px-3" onclick="applyFastEntry(\'' + esc(match.id) + '\')">' +
    '    <i class="fa-solid fa-bolt me-1"></i>Fast Entry' +
    '  </button>' +
    '</div>';
}

/** Fill the entry form from the pre-registration for one-tap fast entry. */
window.applyFastEntry = function (pavId) {
  const p = getPreApprovedSafe().find(x => x.id === pavId);
  if (!p) return;
  const nameEl = document.getElementById('visName');
  const phoneEl = document.getElementById('visPhone');
  const typeEl = document.getElementById('visType');
  const purposeEl = document.getElementById('visPurpose');
  const sel = document.getElementById('visResident');

  if (nameEl) nameEl.value = p.visitorName || '';
  if (phoneEl) phoneEl.value = p.visitorPhone || '';
  if (typeEl && p.type) typeEl.value = p.type;
  if (purposeEl) purposeEl.value = p.purpose || '';
  if (sel && p.flat) {
    sel.value = p.flat;
    sel.dispatchEvent(new Event('change'));
  }
  fastEntryPavId = p.id;
  SHUI.toast('Pre-approved details filled — submit to issue the fast-entry pass.', 'info');
};

/* ── Submit ── */

async function onVisitorSubmit(e) {
  e.preventDefault();

  const nameEl = document.getElementById('visName');
  const phoneEl = document.getElementById('visPhone');
  const sel = document.getElementById('visResident');
  const typeEl = document.getElementById('visType');
  const purposeEl = document.getElementById('visPurpose');
  const vehicleEl = document.getElementById('visVehicle');
  const submitBtn = document.getElementById('visSubmitBtn');

  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  const flat = sel.value;
  const opt = sel.options[sel.selectedIndex];
  const residentName = (opt && opt.getAttribute('data-name')) || ('Resident of ' + flat);
  const type = typeEl.value;
  const purpose = purposeEl.value.trim();
  const vehicleNo = vehicleEl.value.trim();

  let valid = true;
  if (name.length < 2) { setFieldError(nameEl, 'Enter the visitor’s full name.'); valid = false; }
  if (!isValidPhone(phone)) { setFieldError(phoneEl, 'Enter a valid 10-digit Indian mobile number.'); valid = false; }
  if (!flat) { setFieldError(sel, 'Select the resident / destination flat.'); valid = false; }
  if (!purpose) { setFieldError(purposeEl, 'Enter the purpose of the visit.'); valid = false; }
  if (!valid) return;

  submitBtn.disabled = true;
  try {
    const match = findPreApprovedMatch();
    const res = SystemDB.addVisitor({
      name: name,
      phone: normalizePhone(phone),
      flat: flat,
      residentName: residentName,
      purpose: purpose,
      vehicleNo: vehicleNo,
      type: type,
      preApproved: !!match
    });
    if (!res || !res.success) throw new Error((res && res.message) || 'Could not register the visitor.');
    const visitor = res.visitor;

    if (match) {
      // Fast entry: pre-approved by the resident, auto-approved at the gate.
      SystemDB.approveVisitor(visitor.id);
      SystemDB.updateDoc('preApprovedVisitors', match.id, { status: 'Arrived' });
      SystemDB.logAudit('Visitor Fast Entry (Pre-Approved)', 'Gate Security',
        visitor.name + ' → Flat ' + flat + ' — pre-approved by ' + (match.residentName || 'resident') + ', pass ' + visitor.gatePassCode);
      notifyResident(flat, residentName, {
        type: 'visitor',
        title: 'Your pre-approved visitor has arrived',
        message: visitor.name + ' entered through ' + (guardUser.gateAssigned || 'the gate') + ' with fast entry (Pass ' + visitor.gatePassCode + ').',
        link: 'resident.html'
      });
      showEntryResult(visitor, 'approved');
    } else {
      // Standard flow: resident approves from their portal / notification bell.
      notifyResident(flat, residentName, {
        type: 'visitor',
        title: 'Visitor at gate: ' + name,
        message: name + ' (' + type + ' — ' + purpose + ') is waiting at ' + (guardUser.gateAssigned || 'the gate') + ' for Flat ' + flat + '. Please approve or deny.',
        link: 'resident.html'
      });
      showEntryResult(visitor, 'pending');
    }

    resetEntryForm();
    renderAll();
  } catch (err) {
    console.error('[guard] visitor entry failed', err);
    SHUI.toast(err.message || 'Something went wrong while registering the visitor.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function showEntryResult(visitor, mode) {
  const box = document.getElementById('entryResult');
  if (!box) return;
  box.classList.remove('d-none', 'alert-success', 'alert-warning', 'alert-danger');
  if (mode === 'approved') {
    box.classList.add('alert-success');
    box.innerHTML = '<i class="fa-solid fa-bolt me-1"></i><strong>Fast entry issued!</strong> Pass ' +
      '<strong class="font-monospace">' + esc(visitor.gatePassCode) + '</strong> — pre-approved visitor approved for Flat ' +
      esc(visitor.flat) + '. Complete the check-in under <em>Inside Society</em>.';
    SHUI.toast('Fast entry pass ' + visitor.gatePassCode + ' issued for ' + visitor.name + '.', 'success');
  } else {
    box.classList.add('alert-warning');
    box.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i><strong>Entry request sent.</strong> Pass ' +
      '<strong class="font-monospace">' + esc(visitor.gatePassCode) + '</strong> — waiting for ' + esc(visitor.residentName) +
      ' (Flat ' + esc(visitor.flat) + ') to approve. Track it under <em>Pending Approvals</em>.';
    SHUI.toast('Entry request sent to ' + visitor.residentName + ' for approval.', 'info');
  }
}

function resetEntryForm() {
  const form = document.getElementById('visitorEntryForm');
  if (form) {
    form.reset();
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    form.querySelectorAll('.invalid-feedback').forEach(el => { el.style.display = 'none'; });
  }
  const flatEl = document.getElementById('visFlat');
  if (flatEl) flatEl.value = '';
  const info = document.getElementById('visResidentInfo');
  if (info) info.innerHTML = '';
  const suggestion = document.getElementById('preApprovedSuggestion');
  if (suggestion) { suggestion.classList.add('d-none'); suggestion.innerHTML = ''; }
  fastEntryPavId = null;
  photoCaptured = false;
  renderPhotoBox();
}

/* ══════════════════════════════════════════════
   2) Pending Approvals
   ══════════════════════════════════════════════ */

function renderPendingApprovals() {
  const host = document.getElementById('pendingList');
  if (!host || !window.SHUI) return;
  const pending = getVisitorsSafe().filter(v => v.status === 'Pending');

  if (!pending.length) {
    host.innerHTML = SHUI.emptyState({
      icon: 'fa-circle-check',
      title: 'No pending approvals',
      subtitle: 'New visitor entry requests appear here the moment they are logged at the gate.'
    });
    return;
  }

  host.innerHTML = pending.map(pendingCard).join('');
}

function pendingCard(v) {
  const resident = findResident(v.flat, v.residentName);
  const phone = resident && resident.phone ? String(resident.phone) : '';
  const logged = v.entryTime ? SHUI.timeAgo(v.entryTime) : '';

  return (
    '<div class="hub-card p-3 mb-3 fade-up">' +
    '  <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">' +
    '    <div class="d-flex gap-3 align-items-start flex-grow-1" style="min-width: 230px;">' +
    '      <div class="metric-icon bg-icon-warning">' + typeIconHtml(v.type) + '</div>' +
    '      <div style="min-width: 0;">' +
    '        <div class="d-flex align-items-center gap-2 flex-wrap">' +
    '          <span class="fw-bold text-heading">' + esc(v.name) + '</span>' +
    typeBadge(v.type) +
    (v.preApproved ? SHUI.badge('Pre-Registered', 'success') : '') +
    '        </div>' +
    '        <div class="caption-text mt-1">' + esc(v.purpose || 'Visit') + ' · Pass <span class="font-monospace fw-semibold">' + esc(v.gatePassCode) + '</span>' +
    (v.vehicleNo && v.vehicleNo !== 'N/A' ? ' · <i class="fa-solid fa-car me-1"></i>' + esc(v.vehicleNo) : '') + '</div>' +
    '        <div class="d-flex align-items-center gap-2 flex-wrap mt-2">' +
    SHUI.badge('Flat ' + (v.flat || '—'), 'primary') +
    '          <span class="caption-text"><i class="fa-solid fa-user me-1"></i>' + esc(v.residentName || 'Resident') + '</span>' +
    (phone
      ? ' <a class="btn btn-sm btn-outline-primary rounded-pill px-2 py-0 fs-8" href="tel:' + esc(phone) + '"><i class="fa-solid fa-phone me-1"></i>Call Resident</a>'
      : '') +
    '        </div>' +
    (logged ? '<div class="caption-text mt-1"><i class="fa-regular fa-clock me-1"></i>Logged ' + esc(logged) + '</div>' : '') +
    '      </div>' +
    '    </div>' +
    '    <div class="d-flex flex-column gap-2 align-items-md-end">' +
    SHUI.statusBadge(v.status) +
    '      <div class="d-flex gap-2 flex-wrap">' +
    '        <button type="button" class="btn btn-success btn-sm rounded-pill px-3" onclick="guardApprove(\'' + esc(v.id) + '\')"><i class="fa-solid fa-check me-1"></i>Mark Approved</button>' +
    '        <button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="guardReject(\'' + esc(v.id) + '\')"><i class="fa-solid fa-xmark me-1"></i>Reject</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>'
  );
}

/** Guard override approval (residents normally approve from their portal). */
window.guardApprove = async function (id) {
  const vis = getVisitorsSafe().find(v => v.id === id);
  if (!vis) return;
  const ok = await SHUI.confirm({
    title: 'Approve as guard override?',
    message: vis.name + ' → Flat ' + vis.flat + '. Residents normally approve from their portal. Override only after verifying the visitor’s ID — this action is recorded in the audit log.',
    confirmText: 'Override & Approve'
  });
  if (!ok) return;

  const res = SystemDB.approveVisitor(id);
  if (!res || !res.success) {
    SHUI.toast((res && res.message) || 'Could not approve the visitor.', 'error');
    return;
  }
  SystemDB.logAudit('Visitor Approved (Guard Override)', 'Gate Security',
    vis.name + ' → Flat ' + vis.flat + ' — guard override by ' + (guardUser ? guardUser.name : 'guard') + ' at ' + (guardUser ? (guardUser.gateAssigned || 'gate') : 'gate'));
  notifyResident(vis.flat, vis.residentName, {
    type: 'visitor',
    title: 'Visitor approved via guard override',
    message: vis.name + ' was approved for Flat ' + vis.flat + ' by the security team after ID verification.',
    link: 'resident.html'
  });
  SHUI.toast(vis.name + ' approved — complete the check-in under Inside Society.', 'success');
  renderAll();
};

window.guardReject = async function (id) {
  const vis = getVisitorsSafe().find(v => v.id === id);
  if (!vis) return;
  const ok = await SHUI.confirm({
    title: 'Reject this visitor?',
    message: vis.name + ' (Flat ' + vis.flat + ') will be denied entry and the resident will be informed.',
    confirmText: 'Reject Entry',
    danger: true
  });
  if (!ok) return;

  const res = SystemDB.rejectVisitor(id);
  if (!res || !res.success) {
    SHUI.toast((res && res.message) || 'Could not reject the visitor.', 'error');
    return;
  }
  notifyResident(vis.flat, vis.residentName, {
    type: 'visitor',
    title: 'Visitor entry rejected',
    message: vis.name + ' was denied entry at ' + (guardUser ? (guardUser.gateAssigned || 'the gate') : 'the gate') + '.',
    link: 'resident.html'
  });
  SHUI.toast(vis.name + ' rejected — resident notified.', 'warning');
  renderAll();
};

window.refreshPending = function () {
  try {
    renderTabBadges();
    renderPendingApprovals();
    SHUI.toast('Pending approvals refreshed.', 'info');
  } catch (e) {
    console.error('[guard] refresh failed', e);
  }
};

/* ══════════════════════════════════════════════
   3) Inside Society
   ══════════════════════════════════════════════ */

function renderInsideSociety() {
  const host = document.getElementById('insideList');
  if (!host || !window.SHUI) return;
  const list = getVisitorsSafe()
    .filter(v => v.status === 'Approved' || v.status === 'Checked In')
    .sort((a, b) => String(b.entryTime || '').localeCompare(String(a.entryTime || '')));

  if (!list.length) {
    host.innerHTML = SHUI.emptyState({
      icon: 'fa-house-user',
      title: 'No visitors inside right now',
      subtitle: 'Approved visitors appear here once they are at the gate. Check them in to start the visit timer.'
    });
    return;
  }

  host.innerHTML = list.map(insideCard).join('');
}

function insideCard(v) {
  const checkedIn = v.status === 'Checked In';
  const entry = parseStamp(v.entryTime);
  const insideFor = checkedIn && entry
    ? fmtDuration(Math.max(0, Math.round((Date.now() - entry.getTime()) / 60000)))
    : '';

  const actions =
    (checkedIn
      ? '<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="guardCheckOut(\'' + esc(v.id) + '\')"><i class="fa-solid fa-right-from-bracket me-1"></i>Check Out</button>'
      : '<button type="button" class="btn btn-primary btn-sm rounded-pill px-3" onclick="guardCheckIn(\'' + esc(v.id) + '\')"><i class="fa-solid fa-right-to-bracket me-1"></i>Check In</button>') +
    '<button type="button" class="btn btn-outline-secondary btn-sm rounded-pill px-3" onclick="showVisitorQR(\'' + esc(v.id) + '\')"><i class="fa-solid fa-qrcode me-1"></i>QR Pass</button>';

  return (
    '<div class="hub-card p-3 mb-3 fade-up">' +
    '  <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap">' +
    '    <div class="d-flex gap-3 align-items-start flex-grow-1" style="min-width: 230px;">' +
    '      <div class="metric-icon ' + (checkedIn ? 'bg-icon-info' : 'bg-icon-primary') + '">' + typeIconHtml(v.type) + '</div>' +
    '      <div style="min-width: 0;">' +
    '        <div class="d-flex align-items-center gap-2 flex-wrap">' +
    '          <span class="fw-bold text-heading">' + esc(v.name) + '</span>' +
    typeBadge(v.type) +
    (v.preApproved ? SHUI.badge('Pre-Approved', 'success') : '') +
    '        </div>' +
    '        <div class="caption-text mt-1">' + esc(v.purpose || 'Visit') + ' · Pass <span class="font-monospace fw-semibold">' + esc(v.gatePassCode) + '</span>' +
    (v.vehicleNo && v.vehicleNo !== 'N/A' ? ' · <i class="fa-solid fa-car me-1"></i>' + esc(v.vehicleNo) : '') + '</div>' +
    '        <div class="d-flex align-items-center gap-2 flex-wrap mt-2">' +
    SHUI.badge('Flat ' + (v.flat || '—'), 'primary') +
    '          <span class="caption-text"><i class="fa-solid fa-user me-1"></i>' + esc(v.residentName || 'Resident') + '</span>' +
    '        </div>' +
    '        <div class="caption-text mt-1">' +
    (checkedIn
      ? '<i class="fa-solid fa-stopwatch me-1"></i>Inside for ' + esc(insideFor || '—') + ' · entered ' + esc(v.entryTime || '—')
      : '<i class="fa-regular fa-clock me-1"></i>Approved — awaiting physical check-in') +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="d-flex flex-column gap-2 align-items-md-end">' +
    SHUI.statusBadge(v.status) +
    '      <div class="d-flex gap-2 flex-wrap">' + actions + '</div>' +
    '    </div>' +
    '  </div>' +
    '</div>'
  );
}

window.guardCheckIn = function (id) {
  const res = SystemDB.checkInVisitor(id);
  if (!res || !res.success) {
    SHUI.toast((res && res.message) || 'Check-in failed.', 'error');
    return;
  }
  const time = String(res.visitor.entryTime || '').split(' ')[1] || '';
  SHUI.toast(res.visitor.name + ' checked in' + (time ? ' at ' + time : '') + '.', 'success');
  renderAll();
};

window.guardCheckOut = function (id) {
  const res = SystemDB.checkOutVisitor(id);
  if (!res || !res.success) {
    SHUI.toast((res && res.message) || 'Check-out failed.', 'error');
    return;
  }
  const duration = res.visitor.durationMins !== null && res.visitor.durationMins !== undefined
    ? ' Visit duration: ' + fmtDuration(res.visitor.durationMins) + '.'
    : '';
  SHUI.toast(res.visitor.name + ' checked out.' + duration, 'success');
  renderAll();
};

/** Show the deterministic QR gate pass for a visitor. */
window.showVisitorQR = function (id) {
  const vis = getVisitorsSafe().find(v => v.id === id);
  if (!vis) return;
  const nameEl = document.getElementById('qrVisitorName');
  const metaEl = document.getElementById('qrVisitorMeta');
  const host = document.getElementById('qrHost');
  if (!nameEl || !metaEl || !host) return;

  nameEl.textContent = vis.name;
  metaEl.textContent = (vis.type || 'Visitor') + ' · Flat ' + (vis.flat || '—') + ' · Pass ' + (vis.gatePassCode || '');
  host.innerHTML = '';
  SHUI.initQR(host, vis.gatePassCode || vis.id);

  const modalEl = document.getElementById('qrModal');
  if (window.bootstrap && bootstrap.Modal && modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
};

/* ══════════════════════════════════════════════
   4) Deliveries
   ══════════════════════════════════════════════ */

function renderDeliveries() {
  const host = document.getElementById('deliveryList');
  if (!host || !window.SHUI) return;

  const statusOrder = { 'Pending': 0, 'Approved': 1, 'Checked In': 2, 'Checked Out': 3, 'Rejected': 4 };
  const list = getVisitorsSafe()
    .filter(v => v.type === 'Delivery' &&
      (isTodayStamp(v.entryTime) || ['Pending', 'Approved', 'Checked In'].indexOf(v.status) !== -1))
    .sort((a, b) =>
      ((statusOrder[a.status] || 9) - (statusOrder[b.status] || 9)) ||
      String(b.entryTime || '').localeCompare(String(a.entryTime || '')));

  if (!list.length) {
    host.innerHTML = SHUI.emptyState({
      icon: 'fa-box-open',
      title: 'No deliveries yet',
      subtitle: 'Parcel, food and courier entries logged with type "Delivery" appear here with quick in/out actions.'
    });
    return;
  }

  const insideCount = list.filter(v => v.status === 'Checked In').length;
  const summary =
    '<div class="d-flex gap-2 flex-wrap mb-3">' +
    SHUI.badge(list.length + ' delivery record' + (list.length === 1 ? '' : 's'), 'secondary') +
    SHUI.badge(insideCount + ' inside now', 'info') +
    '</div>';

  host.innerHTML = summary + list.map(deliveryCard).join('');
}

function deliveryCard(v) {
  let actionHtml = '';
  if (v.status === 'Pending') {
    actionHtml =
      '<button type="button" class="btn btn-success btn-sm rounded-pill px-3" onclick="guardApprove(\'' + esc(v.id) + '\')"><i class="fa-solid fa-check me-1"></i>Approve</button>' +
      '<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="guardReject(\'' + esc(v.id) + '\')"><i class="fa-solid fa-xmark me-1"></i>Reject</button>';
  } else if (v.status === 'Approved') {
    actionHtml =
      '<button type="button" class="btn btn-primary btn-sm rounded-pill px-3" onclick="guardCheckIn(\'' + esc(v.id) + '\')"><i class="fa-solid fa-right-to-bracket me-1"></i>Check In</button>';
  } else if (v.status === 'Checked In') {
    actionHtml =
      '<button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="guardCheckOut(\'' + esc(v.id) + '\')"><i class="fa-solid fa-right-from-bracket me-1"></i>Check Out</button>';
  } else if (v.status === 'Checked Out') {
    const exitClock = String(v.exitTime || '').split(' ')[1] || '';
    actionHtml = '<span class="caption-text"><i class="fa-solid fa-circle-check text-success me-1"></i>Exited ' + esc(exitClock || '—') +
      (v.durationMins !== null && v.durationMins !== undefined ? ' · ' + esc(fmtDuration(v.durationMins)) : '') + '</span>';
  } else {
    actionHtml = SHUI.statusBadge(v.status);
  }

  return (
    '<div class="hub-card p-3 mb-3 fade-up">' +
    '  <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap">' +
    '    <div class="d-flex gap-3 align-items-center flex-grow-1" style="min-width: 220px;">' +
    '      <div class="metric-icon bg-icon-success"><i class="fa-solid fa-box-open"></i></div>' +
    '      <div style="min-width: 0;">' +
    '        <div class="d-flex align-items-center gap-2 flex-wrap">' +
    '          <span class="fw-bold text-heading">' + esc(v.name) + '</span>' +
    SHUI.badge('Flat ' + (v.flat || '—'), 'primary') +
    (v.preApproved ? SHUI.badge('Pre-Approved', 'success') : '') +
    '        </div>' +
    '        <div class="caption-text mt-1">' + esc(v.purpose || 'Delivery') +
    ' · <i class="fa-solid fa-phone me-1"></i>' + esc(v.phone || '—') +
    (v.vehicleNo && v.vehicleNo !== 'N/A' ? ' · <i class="fa-solid fa-car me-1"></i>' + esc(v.vehicleNo) : '') +
    ' · <span class="font-monospace">' + esc(v.gatePassCode) + '</span></div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="d-flex align-items-center gap-2 flex-wrap">' +
    SHUI.statusBadge(v.status) +
    actionHtml +
    '    </div>' +
    '  </div>' +
    '</div>'
  );
}

/* ══════════════════════════════════════════════
   5) Visitor History
   ══════════════════════════════════════════════ */

function getHistoryRows() {
  const dateEl = document.getElementById('historyDate');
  const dateFilter = dateEl ? dateEl.value : '';
  let rows = getVisitorsSafe().slice();
  if (dateFilter) rows = rows.filter(v => String(v.entryTime || '').startsWith(dateFilter));
  rows.sort((a, b) => String(b.entryTime || '').localeCompare(String(a.entryTime || '')));
  return rows;
}

function renderHistory() {
  const host = document.getElementById('historyTableHost');
  if (!host || !window.SHUI) return;
  const rows = getHistoryRows();

  const columns = [
    {
      key: 'name', label: 'Visitor',
      render: r => '<div class="fw-semibold">' + esc(r.name) + '</div><small class="text-muted">' + esc(r.phone || '') + '</small>'
    },
    { key: 'type', label: 'Type', render: r => typeBadge(r.type) },
    { key: 'flat', label: 'Flat', render: r => SHUI.badge(r.flat || '—', 'primary') },
    { key: 'purpose', label: 'Purpose', render: r => '<span class="fs-7">' + esc(r.purpose || '—') + '</span>' },
    { key: 'entryTime', label: 'Entry', render: r => '<span class="fs-7">' + esc(r.entryTime || '—') + '</span>' },
    {
      key: 'exitTime', label: 'Exit',
      render: r => r.exitTime === 'Still In Society'
        ? SHUI.badge('Still In Society', 'info')
        : '<span class="fs-7">' + esc(r.exitTime || '—') + '</span>'
    },
    { key: 'durationMins', label: 'Duration', render: r => '<span class="fs-7">' + esc(fmtDuration(r.durationMins)) + '</span>' },
    { key: 'status', label: 'Status', render: r => SHUI.statusBadge(r.status) },
    { key: 'gatePassCode', label: 'Pass', render: r => '<span class="font-monospace fs-7">' + esc(r.gatePassCode || '') + '</span>' }
  ];

  if (!historyTableApi) {
    historyTableApi = SHUI.renderTable(host, {
      columns: columns,
      rows: rows,
      pageSize: 10,
      searchKeys: ['name', 'phone', 'type', 'flat', 'purpose', 'gatePassCode', 'status'],
      emptyState: {
        icon: 'fa-box-archive',
        title: 'No visitor records',
        subtitle: 'Gate passes issued at the entry desk will appear here. Adjust the date filter or search.'
      }
    });
  } else {
    historyTableApi.refresh(rows);
  }
}

window.clearHistoryDate = function () {
  const dateEl = document.getElementById('historyDate');
  if (dateEl) dateEl.value = '';
  try { renderHistory(); } catch (e) { console.error('[guard] history render failed', e); }
};

window.exportHistoryCSV = function () {
  const rows = getHistoryRows();
  if (!rows.length) {
    SHUI.toast('No records to export for the selected filter.', 'warning');
    return;
  }
  const csvRows = rows.map(r => ({
    'Pass Code': r.gatePassCode || '',
    'Visitor': r.name || '',
    'Phone': r.phone || '',
    'Type': r.type || '',
    'Flat': r.flat || '',
    'Resident': r.residentName || '',
    'Purpose': r.purpose || '',
    'Vehicle': r.vehicleNo === 'N/A' ? '' : (r.vehicleNo || ''),
    'Entry': r.entryTime || '',
    'Exit': r.exitTime || '',
    'Duration (min)': r.durationMins === null || r.durationMins === undefined ? '' : r.durationMins,
    'Status': r.status || '',
    'Pre-Approved': r.preApproved ? 'Yes' : 'No'
  }));
  try {
    SystemDB.exportToCSV('societyhub-visitor-history-' + localTodaySlug() + '.csv', csvRows);
    SystemDB.logAudit('Visitor History Exported', 'Gate Security', csvRows.length + ' visitor records exported to CSV');
    SHUI.toast('Visitor history CSV downloaded.', 'success');
  } catch (e) {
    console.error('[guard] CSV export failed', e);
    SHUI.toast('CSV export failed. Please try again.', 'error');
  }
};

/* ════════════════════════════════════════════���═
   6) Emergency Alerts
   ══════════════════════════════════════════════ */

function renderEmergencyAlerts() {
  const host = document.getElementById('emergencyList');
  if (!host || !window.SHUI) return;

  const alerts = getEmergencySafe();
  const active = alerts.filter(a => a.status === 'Active');
  const resolved = alerts.filter(a => a.status === 'Resolved').slice(0, 5);

  let html = '';
  if (!active.length) {
    html += SHUI.emptyState({
      icon: 'fa-shield-heart',
      title: 'No active emergencies',
      subtitle: 'SOS alerts raised by residents appear here instantly so the guard team can respond first.'
    });
  } else {
    html += active.map(emergencyCard).join('');
  }

  if (resolved.length) {
    html += '<h6 class="fw-bold text-muted text-uppercase mt-4 mb-3" style="font-size:12px;letter-spacing:.8px;">Recently Resolved</h6>';
    html += resolved.map(resolvedAlertRow).join('');
  }

  host.innerHTML = html;
}

function emergencyCard(a) {
  const icon = EMERGENCY_ICONS[a.type] || EMERGENCY_ICONS['Other'];
  const flatText = a.raisedByFlat ? ' · Flat ' + esc(a.raisedByFlat) : '';
  return (
    '<div class="hub-card p-4 mb-3 fade-up" style="border-color: rgba(239, 68, 68, 0.45); background: rgba(239, 68, 68, 0.06);">' +
    '  <div class="d-flex align-items-start gap-3 flex-wrap">' +
    '    <div class="metric-icon bg-icon-danger"><i class="fa-solid ' + icon + '"></i></div>' +
    '    <div class="flex-grow-1" style="min-width: 220px;">' +
    '      <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">' +
    '        <h5 class="fw-bold mb-1 text-danger">' + esc(a.type || 'General') + ' Emergency</h5>' +
    SHUI.badge('Active', 'danger') +
    '      </div>' +
    '      <p class="mb-2">' + esc(a.message || 'An emergency has been reported in the society.') + '</p>' +
    '      <div class="caption-text"><i class="fa-solid fa-user me-1"></i>' + esc(a.raisedBy || 'Resident') + flatText +
    ' · <i class="fa-regular fa-clock mx-1"></i>' + esc(SHUI.timeAgo(a.raisedAt)) + '</div>' +
    (a.notes ? '<div class="caption-text mt-1"><i class="fa-solid fa-note-sticky me-1"></i>' + esc(a.notes) + '</div>' : '') +
    '    </div>' +
    '    <button type="button" class="btn btn-danger rounded-pill px-4" onclick="resolveEmergency(\'' + esc(a.id) + '\')">' +
    '      <i class="fa-solid fa-check-double me-1"></i>Resolve' +
    '    </button>' +
    '  </div>' +
    '</div>'
  );
}

function resolvedAlertRow(a) {
  const icon = EMERGENCY_ICONS[a.type] || EMERGENCY_ICONS['Other'];
  return (
    '<div class="d-flex align-items-center gap-3 border rounded-3 p-3 mb-2" style="border-color: var(--border-color) !important;">' +
    '  <i class="fa-solid ' + icon + ' text-muted"></i>' +
    '  <div class="flex-grow-1" style="min-width:0;">' +
    '    <span class="fw-semibold">' + esc(a.type || 'General') + '</span>' +
    '    <span class="caption-text"> — ' + esc(a.message || '') + '</span>' +
    '  </div>' +
    SHUI.badge('Resolved', 'success') +
    '  <span class="caption-text text-nowrap">' + esc(SHUI.timeAgo(a.resolvedAt || a.raisedAt)) + '</span>' +
    '</div>'
  );
}

window.resolveEmergency = async function (id) {
  const alertItem = getEmergencySafe().find(a => a.id === id);
  if (!alertItem) return;
  const ok = await SHUI.confirm({
    title: 'Mark this emergency resolved?',
    message: (alertItem.type || 'General') + ' alert raised by ' + (alertItem.raisedBy || 'a resident') +
      ' will be closed. Confirm the situation is fully handled first.',
    confirmText: 'Yes, Resolve',
    danger: true
  });
  if (!ok) return;

  const res = SystemDB.resolveEmergency(id);
  if (!res || !res.success) {
    SHUI.toast((res && res.message) || 'Could not resolve the alert.', 'error');
    return;
  }
  // Inform the resident who raised the alert (when the account exists).
  try {
    const users = SystemDB.getUsers() || [];
    const raiser = users.find(u => u.name === alertItem.raisedBy);
    if (raiser) {
      SystemDB.notify({
        target: raiser.id,
        type: 'emergency',
        title: 'Your emergency alert was resolved',
        message: 'The security team resolved your ' + (alertItem.type || 'general') + ' alert.',
        link: 'resident.html'
      });
    }
  } catch (e) { /* non-fatal */ }
  SHUI.toast('Emergency marked resolved.', 'success');
  renderAll();
};

/* ══════════════════════════════════════════════
   Global actions
   ══════════════════════════════════════════════ */

window.refreshGuardDashboard = function () {
  try {
    renderAll();
    if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    SHUI.toast('Dashboard refreshed.', 'info');
  } catch (e) {
    console.error('[guard] refresh failed', e);
  }
};

window.logout = async function () {
  if (window.Clerk && window.Clerk.user) {
    try { await window.Clerk.signOut(); } catch (e) { /* non-fatal */ }
  }
  sessionStorage.clear();
  window.location.href = 'login.html';
};

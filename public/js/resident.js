/**
 * SocietyHub — Resident Portal (resident.js)
 * ─────────────────────────────────────────────────
 * Tabs: Dashboard · Maintenance & Bills · Complaints · Visitors & Passes ·
 *       Amenity Booking · Family Members · Notices & Events · Documents ·
 *       Polls · Emergency SOS
 *
 * Contract: SystemDB (db.js v4) + SHUI (ui.js) + notifications.js + receipt.js
 */

/* global SystemDB, SHUI, bootstrap, downloadPDFReceipt, firebaseSignOut, updateNotificationBadge */

let currentUser = null;

/* SHUI.renderTable handles — created once, refreshed afterwards */
const tableHandles = {};

/* ──────────────────────────────────────────────
   Small helpers
   ────────────────────────────────────────────── */
const esc = (v) => SHUI.escapeHtml(v);

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function societySettings() {
  return (SystemDB.data && SystemDB.data.societySettings) || {};
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showModal(id) {
  const el = document.getElementById(id);
  if (el && window.bootstrap) bootstrap.Modal.getOrCreateInstance(el).show();
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el && window.bootstrap) {
    const inst = bootstrap.Modal.getInstance(el);
    if (inst) inst.hide();
  }
}

function setFieldError(input, show) {
  if (!input) return;
  if (show) input.classList.add('is-invalid');
  else input.classList.remove('is-invalid');
}

function myBills() {
  return SystemDB.getMaintenance().filter(
    (m) => m.flat === currentUser.flat || m.residentName === currentUser.name
  );
}

function myComplaints() {
  return SystemDB.getComplaints().filter(
    (c) => c.flat === currentUser.flat || c.residentName === currentUser.name || c.residentId === currentUser.id
  );
}

function myVisitors() {
  return SystemDB.getVisitors().filter(
    (v) => v.flat === currentUser.flat || v.residentName === currentUser.name
  );
}

function myBookings() {
  return SystemDB.getBookings().filter(
    (b) => b.flat === currentUser.flat || b.residentName === currentUser.name
  );
}

function priorityBadge(p) {
  const tone = p === 'High' ? 'danger' : p === 'Medium' ? 'warning' : 'secondary';
  return SHUI.badge(p || 'Medium', tone);
}

function noticeBadge(category) {
  const tone =
    category === 'Emergency' ? 'danger' :
    category === 'Meeting' ? 'warning' :
    category === 'Rules' ? 'info' :
    category === 'General' ? 'primary' : 'secondary';
  return SHUI.badge(category || 'General', tone);
}

function timelineTone(action) {
  const a = String(action || '').toLowerCase();
  if (a.indexOf('resolved') !== -1 || a.indexOf('closed') !== -1 || a.indexOf('checked out') !== -1) return 'success';
  if (a.indexOf('reject') !== -1 || a.indexOf('denied') !== -1) return 'danger';
  if (a.indexOf('progress') !== -1 || a.indexOf('assigned') !== -1 || a.indexOf('checked in') !== -1) return 'info';
  if (a.indexOf('note') !== -1) return 'muted';
  if (a.indexOf('approved') !== -1) return 'success';
  return 'primary';
}

function renderTimeline(timeline) {
  const items = Array.isArray(timeline) ? timeline.slice() : [];
  if (!items.length) {
    return SHUI.emptyState({ icon: 'fa-clock-rotate-left', title: 'No timeline yet', subtitle: 'Updates will appear here as the society team works on it.' });
  }
  return (
    '<ul class="sh-timeline">' +
    items
      .map((t) => {
        const tone = timelineTone(t.action);
        return (
          '<li class="sh-timeline__item sh-timeline__item--' + tone + '">' +
          '<p class="sh-timeline__title">' + esc(t.action || 'Update') +
          ' <span class="text-muted fw-semibold">&middot; ' + esc(t.by || 'System') + '</span></p>' +
          (t.note ? '<p class="sh-timeline__note">' + esc(t.note) + '</p>' : '') +
          '<span class="sh-timeline__time">' + esc(SHUI.formatDateTime(t.at)) + '</span>' +
          '</li>'
        );
      })
      .join('') +
    '</ul>'
  );
}

/* ──────────────────────────────────────────────
   Boot
   ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  showInitialSkeletons();

  // Role guard (sessionStorage read — safe before DB init)
  currentUser = SystemDB.getCurrentUser();
  if (!currentUser) { window.location.href = 'login.html'; return; }
  if (currentUser.role === 'Admin') { window.location.href = 'admin.html'; return; }
  if (currentUser.role === 'Security Guard') { window.location.href = 'guard.html'; return; }
  if (currentUser.status && currentUser.status !== 'Approved') { window.location.href = 'waiting-approval.html'; return; }

  try {
    await SystemDB.init();
  } catch (err) {
    console.error('SystemDB init failed', err);
  }

  if (currentUser.role === 'Committee Member') {
    const isCommActive = (window.SystemDB && typeof SystemDB.isCommitteeEnabled === 'function')
      ? SystemDB.isCommitteeEnabled()
      : true;
    if (isCommActive) {
      window.location.href = 'committee.html';
      return;
    }
  } else if (currentUser.role !== 'Resident') {
    window.location.href = 'index.html';
    return;
  }

  initHeaderProfile();
  bindForms();
  loadResidentDashboard();
  activateTabFromHash();
  window.addEventListener('hashchange', activateTabFromHash);
});

function showInitialSkeletons() {
  const hosts = [
    ['homeContent', 8], ['currentBillCard', 2], ['billsTableHost', 4],
    ['complaintsTableHost', 4], ['visitorsTableHost', 4], ['preVisitorsHost', 3],
    ['amenitiesGrid', 3], ['upcomingBookingsHost', 3], ['pastBookingsHost', 3],
    ['familyGrid', 3], ['resNoticesContainer', 3], ['resEventsContainer', 3],
    ['documentsTableHost', 4], ['pollsContainer', 3], ['sosAlertsHost', 2]
  ];
  hosts.forEach(([id, rows]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="col-12"><div class="hub-card p-4">' + SHUI.skeletonHtml(rows) + '</div></div>';
  });
  const contacts = document.getElementById('emergencyContactsList');
  if (contacts) contacts.innerHTML = SHUI.skeletonHtml(5);
}

function initHeaderProfile() {
  setText('resName', currentUser.name || 'Resident');
  setText('resFlat', 'Flat: ' + (currentUser.flat || currentUser.flat_no || '—'));
  if (currentUser.avatar) {
    const img = document.getElementById('resAvatar');
    if (img) img.src = currentUser.avatar;
  }

  const isDemo = SystemDB.isDemoMode();
  const socCode = SystemDB.getSocietyCode();
  const settings = societySettings();
  const socName = settings.name || currentUser.societyName || sessionStorage.getItem('ssm_society_name') || 'My Society';

  const badgeEl = document.getElementById('resModeBadge');
  if (badgeEl) {
    badgeEl.className = 'badge rounded-pill px-3 py-2 fs-8 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm';
    if (isDemo) {
      badgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
      badgeEl.style.color = '#F59E0B';
      badgeEl.style.border = '1px solid rgba(245, 158, 11, 0.3)';
      badgeEl.innerHTML = '<i class="fa-solid fa-flask me-1"></i> Demo Mode &middot; Sample Data';
    } else {
      badgeEl.style.background = 'rgba(14, 165, 233, 0.15)';
      badgeEl.style.color = '#38BDF8';
      badgeEl.style.border = '1px solid rgba(14, 165, 233, 0.3)';
      badgeEl.innerHTML = `<i class="fa-solid fa-building me-1"></i> ${esc(socName)} &middot; <strong class="ms-1" style="font-family:monospace;letter-spacing:1px;">${esc(socCode)}</strong>`;
    }
  }

  // Amenity booking date defaults
  const bookDate = document.getElementById('bookDate');
  if (bookDate) {
    bookDate.min = todayISO();
    bookDate.value = todayISO();
  }
  const visDate = document.getElementById('visExpectedDate');
  if (visDate) visDate.min = todayISO();
}

function activateTabFromHash() {
  const valid = ['home', 'bills', 'complaints', 'visitors', 'amenities', 'family', 'notices', 'documents', 'polls', 'sos'];
  const h = (window.location.hash || '').replace('#', '').toLowerCase();
  if (valid.indexOf(h) === -1) return;
  const btn = document.getElementById('tab-res-' + h + '-btn');
  if (btn && window.bootstrap && bootstrap.Tab) {
    bootstrap.Tab.getOrCreateInstance(btn).show();
  }
}

function switchTab(name) {
  const btn = document.getElementById('tab-res-' + name + '-btn');
  if (btn && window.bootstrap && bootstrap.Tab) bootstrap.Tab.getOrCreateInstance(btn).show();
}

/* ──────────────────────────────────────────────
   Global refresh (also called by notifications.js)
   ────────────────────────────────────────────── */
function loadResidentDashboard() {
  if (!currentUser || !SystemDB.data) return;
  const renders = [
    checkVisitorApprovalsBanner, renderHome, renderCurrentBillCard, renderBills,
    renderComplaints, renderVisitors, renderPreVisitors, renderAmenities,
    renderBookings, renderFamily, renderNotices, renderEvents,
    renderDocuments, renderPolls, renderEmergencyContacts, renderSosAlerts
  ];
  renders.forEach((fn) => {
    try { fn(); } catch (err) { console.error('[resident] render failed:', fn.name, err); }
  });
  if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
}

/* ──────────────────────────────────────────────
   Visitor approval banner (gate requests)
   ────────────────────────────────────────────── */
function checkVisitorApprovalsBanner() {
  const visitors = myVisitors().filter((v) => v.status === 'Pending');
  const banner = document.getElementById('visitorApprovalBanner');
  const details = document.getElementById('bannerVisitorDetails');
  const btns = document.getElementById('bannerActionBtns');
  if (!banner || !details || !btns) return;

  if (visitors.length > 0) {
    const v = visitors[0];
    details.textContent =
      `${v.name} (${v.purpose || 'Visit'}) is waiting at the gate for Flat ${v.flat}. Pass: ${v.gatePassCode || '—'}` +
      (visitors.length > 1 ? `  (+${visitors.length - 1} more)` : '');
    btns.innerHTML =
      `<button class="btn btn-sm btn-success rounded-pill px-3" onclick="respondVisitor('${esc(v.id)}', 'Approved')">` +
      `<i class="fa-solid fa-circle-check me-1"></i> Approve Entry</button>` +
      `<button class="btn btn-sm btn-danger rounded-pill px-3" onclick="respondVisitor('${esc(v.id)}', 'Rejected')">` +
      `<i class="fa-solid fa-circle-xmark me-1"></i> Deny Entry</button>`;
    banner.classList.remove('d-none');
  } else {
    banner.classList.add('d-none');
    btns.innerHTML = '';
  }
}

async function respondVisitor(id, status) {
  if (status === 'Rejected') {
    const ok = await SHUI.confirm({
      title: 'Deny visitor entry?',
      message: 'The gate staff will be informed that this visitor is not allowed in.',
      confirmText: 'Deny Entry',
      danger: true
    });
    if (!ok) return;
  }

  const res = status === 'Approved' ? SystemDB.approveVisitor(id) : SystemDB.rejectVisitor(id);
  if (!res || !res.success) {
    SHUI.toast((res && res.message) || 'Could not update the visitor.', 'error');
    return;
  }

  SystemDB.notify({
    target: 'Security Guard',
    type: 'visitor',
    title: status === 'Approved' ? 'Visitor entry approved by resident' : 'Visitor entry denied by resident',
    message: `${currentUser.name} (${currentUser.flat}) ${status === 'Approved' ? 'approved' : 'denied'} entry for ${res.visitor.name}.`,
    link: 'guard.html'
  });

  SHUI.toast(
    status === 'Approved' ? 'Visitor approved — gate staff informed.' : 'Visitor entry denied.',
    status === 'Approved' ? 'success' : 'warning'
  );
  loadResidentDashboard();
}

/* ──────────────────────────────────────────────
   TAB 1 — Dashboard
   ────────────────────────────────────────────── */
function renderHome() {
  const el = document.getElementById('homeContent');
  if (!el) return;
  const settings = societySettings();

  const bills = myBills();
  const unpaid = bills.filter((b) => b.status === 'Unpaid');
  const unpaidTotal = unpaid.reduce((s, b) => s + (Number(b.amount) || 0), 0);

  const today = todayISO();
  const upcomingBookings = myBookings().filter((b) => b.status === 'Confirmed' && String(b.date) >= today);

  const visitors = myVisitors();
  const todaysVisitors = visitors.filter(
    (v) => String(v.entryTime || '').indexOf(today) === 0 || v.status === 'Pending' || v.status === 'Checked In'
  );

  const openComplaints = myComplaints().filter(
    (c) => ['Resolved', 'Closed'].indexOf(SHUI.normalizeComplaintStatus(c.status)) === -1
  );

  const notices = SystemDB.getNotices().slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const recentNotices = notices.slice(0, 2);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = String(currentUser.name || 'Resident').split(' ')[0];

  let html = '';

  /* Welcome card */
  html += `
    <div class="hub-card p-4 p-md-5 mb-4 position-relative overflow-hidden fade-up">
      <div class="row align-items-center mb-4">
        <div class="col-md-8">
          <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2 rounded-pill mb-2 caption-text fs-8">
            <i class="fa-solid fa-house-user me-1"></i> ${esc(settings.name || 'SocietyHub')}
          </span>
          <h2 class="fw-bold mb-2">${esc(greeting)}, ${esc(firstName)}!</h2>
          <p class="body-text mb-0 text-muted">
            Flat <strong class="text-heading">${esc(currentUser.flat || '—')}</strong> &middot;
            ${esc(currentUser.tower || 'Tower A')} &middot; Here is everything happening in your society today.
          </p>
        </div>
        <div class="col-md-4 text-md-end mt-3 mt-md-0">
          <div class="d-inline-block hub-card rounded-4 p-3 border text-center" style="background: var(--surface-card);">
            <span class="caption-text text-uppercase fw-semibold d-block fs-8">Flat Number</span>
            <h3 class="fw-bold text-primary mb-0">${esc(currentUser.flat || '—')}</h3>
          </div>
        </div>
      </div>

      <div class="p-3 rounded-3 border" id="resProfileDetails" style="background: var(--surface-card);">
        <div class="row g-3 small">
          <div class="col-6 col-md-3"><span class="text-muted d-block fs-8">Tower / Block</span><strong class="fw-bold">${esc(currentUser.tower || 'Tower A')} (${esc(currentUser.block || 'Phase 1')})</strong></div>
          <div class="col-6 col-md-3"><span class="text-muted d-block fs-8">Occupancy</span><strong class="fw-bold">${esc(currentUser.residentType || 'Owner')}</strong></div>
          <div class="col-6 col-md-3"><span class="text-muted d-block fs-8">Move-In Date</span><strong class="fw-bold">${esc(SHUI.formatDate(currentUser.moveInDate))}</strong></div>
          <div class="col-6 col-md-3"><span class="text-muted d-block fs-8">Parking Slot</span><strong class="fw-bold text-primary">${esc(currentUser.parkingSlot || '—')}</strong></div>
          <div class="col-6 col-md-3"><span class="text-muted d-block fs-8">Monthly Maintenance</span><strong class="fw-bold">${esc(currentUser.maintenanceDues || '₹3,500/month')}</strong></div>
          <div class="col-6 col-md-3"><span class="text-muted d-block fs-8">Household</span><strong class="fw-bold">${esc(currentUser.familyCount || (SystemDB.getFamilyMembers(currentUser.id).length + 1) + ' Members')}</strong></div>
          <div class="col-6 col-md-3"><span class="text-muted d-block fs-8">Phone</span><strong class="fw-bold">${esc(currentUser.phone || '—')}</strong></div>
          <div class="col-6 col-md-3"><span class="text-muted d-block fs-8">Email</span><strong class="fw-bold text-truncate d-inline-block" style="max-width:100%;">${esc(currentUser.email || '—')}</strong></div>
        </div>
      </div>
    </div>`;

  /* KPI row */
  html += `
    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">${SHUI.statCard({
        label: 'Maintenance Due',
        value: SHUI.formatINR(unpaidTotal),
        sub: unpaid.length ? unpaid.length + ' pending bill' + (unpaid.length > 1 ? 's' : '') : 'All dues cleared',
        icon: 'fa-solid fa-file-invoice-dollar',
        tone: unpaidTotal > 0 ? 'danger' : 'success'
      })}</div>
      <div class="col-sm-6 col-xl-3">${SHUI.statCard({
        label: 'Upcoming Bookings',
        value: String(upcomingBookings.length),
        sub: upcomingBookings.length ? 'Next: ' + SHUI.formatDate(upcomingBookings[0].date) : 'No reservations',
        icon: 'fa-solid fa-calendar-check',
        tone: 'info'
      })}</div>
      <div class="col-sm-6 col-xl-3">${SHUI.statCard({
        label: "Today's Visitors",
        value: String(todaysVisitors.length),
        sub: todaysVisitors.length ? 'Expected / at gate' : 'None expected',
        icon: 'fa-solid fa-user-check',
        tone: 'primary'
      })}</div>
      <div class="col-sm-6 col-xl-3">${SHUI.statCard({
        label: 'Open Complaints',
        value: String(openComplaints.length),
        sub: openComplaints.length ? 'Being tracked' : 'Nothing pending',
        icon: 'fa-solid fa-headset',
        tone: openComplaints.length ? 'warning' : 'success'
      })}</div>
    </div>`;

  /* Quick actions */
  html += `
    <h5 class="fw-bold mb-3"><i class="fa-solid fa-bolt text-warning me-2"></i>Quick Actions</h5>
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-4 col-xl-2">
        <button type="button" class="quick-action-card w-100" onclick="quickPayMaintenance()">
          <span class="quick-action-card__icon"><i class="fa-solid fa-file-invoice-dollar"></i></span>
          <span>Pay Maintenance</span>
        </button>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <button type="button" class="quick-action-card w-100" onclick="showModal('addVisitorModal')">
          <span class="quick-action-card__icon"><i class="fa-solid fa-user-plus"></i></span>
          <span>Add Visitor</span>
        </button>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <button type="button" class="quick-action-card w-100" onclick="openBookingModal()">
          <span class="quick-action-card__icon"><i class="fa-solid fa-calendar-plus"></i></span>
          <span>Book Amenity</span>
        </button>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <button type="button" class="quick-action-card w-100" onclick="showModal('newComplaintModal')">
          <span class="quick-action-card__icon"><i class="fa-solid fa-headset"></i></span>
          <span>Raise Complaint</span>
        </button>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <a href="vehicles.html" class="quick-action-card w-100">
          <span class="quick-action-card__icon"><i class="fa-solid fa-car"></i></span>
          <span>Add Vehicle</span>
        </a>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <button type="button" class="quick-action-card w-100" onclick="openFamilyModal()">
          <span class="quick-action-card__icon"><i class="fa-solid fa-people-roof"></i></span>
          <span>Add Family Member</span>
        </button>
      </div>
    </div>`;

  /* Recent notices highlight */
  html += `<h5 class="fw-bold mb-3"><i class="fa-solid fa-bullhorn text-primary me-2"></i>Recent Notices</h5>`;
  if (!recentNotices.length) {
    html += '<div class="hub-card p-4">' + SHUI.emptyState({ icon: 'fa-bullhorn', title: 'No notices yet', subtitle: 'Society announcements will appear here.' }) + '</div>';
  } else {
    html += '<div class="row g-3">' + recentNotices.map((n) => noticeCardHtml(n)).join('') + '</div>';
  }

  el.innerHTML = html;
}

function quickPayMaintenance() {
  const unpaid = myBills()
    .filter((b) => b.status === 'Unpaid')
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  if (!unpaid.length) {
    SHUI.toast('No pending dues — you are all paid up!', 'success');
    switchTab('bills');
    return;
  }
  openPayModal(unpaid[0].id);
}

/* ──────────────────────────────────────────────
   TAB 2 — Maintenance & Bills
   ────────────────────────────────────────────── */
function renderCurrentBillCard() {
  const host = document.getElementById('currentBillCard');
  if (!host) return;
  const settings = societySettings();
  const pct = Number(settings.lateFeePercentage) || 0;
  const grace = Number(settings.graceDays) || 0;

  const unpaid = myBills()
    .filter((b) => b.status === 'Unpaid')
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

  if (!unpaid.length) {
    host.innerHTML = `
      <div class="hub-card p-4 fade-up" style="border-left: 4px solid var(--accent-success);">
        <div class="d-flex align-items-center gap-3">
          <div class="metric-icon bg-icon-success"><i class="fa-solid fa-circle-check"></i></div>
          <div>
            <h5 class="fw-bold mb-1">You're all caught up!</h5>
            <p class="caption-text mb-0">No pending maintenance bills for Flat ${esc(currentUser.flat || '—')}. New bills appear here when the society generates them.</p>
          </div>
        </div>
      </div>`;
    return;
  }

  const b = unpaid[0];
  const overdue = b.dueDate && String(b.dueDate) < todayISO();

  host.innerHTML = `
    <div class="hub-card p-4 fade-up" style="border-left: 4px solid ${overdue ? 'var(--accent-danger)' : 'var(--accent-warning)'};">
      <div class="row align-items-center g-3">
        <div class="col-md-5">
          <div class="d-flex align-items-center gap-2 mb-1">
            <h5 class="fw-bold mb-0">${esc(b.month)}</h5>
            ${overdue ? SHUI.badge('Overdue', 'danger') : SHUI.badge('Due', 'warning')}
          </div>
          <span class="caption-text">Invoice ${esc(b.id)} &middot; Flat ${esc(b.flat)}</span>
        </div>
        <div class="col-md-4">
          <span class="caption-text d-block fs-8">Amount Payable</span>
          <span class="fs-3 fw-bold text-heading">${SHUI.formatINR(b.amount)}</span>
          <span class="caption-text d-block fs-8 mt-1"><i class="fa-solid fa-calendar-day me-1"></i>Due ${esc(SHUI.formatDate(b.dueDate))}</span>
        </div>
        <div class="col-md-3 text-md-end">
          <button class="btn btn-success rounded-pill px-4 fw-bold" onclick="openPayModal('${esc(b.id)}')">
            <i class="fa-solid fa-credit-card me-1"></i> Pay Now
          </button>
        </div>
      </div>
      <div class="caption-text mt-3 pt-3 border-top fs-8">
        <i class="fa-solid fa-circle-info me-1 text-warning"></i>
        Pay on time to avoid penalties: a <strong>${esc(pct)}% late fee</strong> applies if the bill remains unpaid
        ${grace > 0 ? `more than <strong>${esc(grace)} days</strong> after the due date` : 'after the due date'}.
      </div>
    </div>`;
}

function renderBills() {
  const rows = myBills().slice().sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')));
  const opts = {
    columns: [
      { key: 'id', label: 'Invoice' },
      { key: 'month', label: 'Billing Month' },
      { key: 'amount', label: 'Amount', render: (r) => '<span class="fw-bold">' + SHUI.formatINR(r.amount) + '</span>' },
      { key: 'dueDate', label: 'Due Date', render: (r) => esc(SHUI.formatDate(r.dueDate)) },
      { key: 'status', label: 'Status', render: (r) => SHUI.statusBadge(r.status) },
      {
        key: 'paymentDate', label: 'Paid On',
        render: (r) => (r.status === 'Paid' ? esc(SHUI.formatDate(r.paymentDate)) : '<span class="text-muted">—</span>')
      },
      {
        key: '_actions', label: 'Actions', sortable: false,
        render: (r) =>
          r.status === 'Unpaid'
            ? `<button class="btn btn-sm btn-success rounded-pill px-3" onclick="openPayModal('${esc(r.id)}')"><i class="fa-solid fa-credit-card me-1"></i>Pay Now</button>`
            : `<button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="downloadPDFReceipt('${esc(r.id)}')"><i class="fa-solid fa-file-pdf me-1"></i>Receipt</button>`
      }
    ],
    rows,
    pageSize: 8,
    searchKeys: ['id', 'month', 'status'],
    emptyState: { icon: 'fa-receipt', title: 'No bills yet', subtitle: 'Your maintenance invoices will appear here once generated by the society.' }
  };

  if (!tableHandles.bills) tableHandles.bills = SHUI.renderTable('#billsTableHost', opts);
  else tableHandles.bills.refresh(rows);
}

function openPayModal(billId) {
  const bill = myBills().find((b) => b.id === billId);
  if (!bill) { SHUI.toast('Bill not found.', 'error'); return; }
  if (bill.status === 'Paid') { downloadPDFReceipt(billId); return; }

  document.getElementById('payBillId').value = bill.id;
  setText('payBillInvoiceLabel', bill.id);
  setText('payBillMonth', bill.month);
  setText('payBillDueDate', SHUI.formatDate(bill.dueDate));
  setText('payBillAmount', SHUI.formatINR(bill.amount));
  showPayStep('form');
  showModal('payBillModal');
}

function showPayStep(step) {
  const form = document.getElementById('payStepForm');
  const processing = document.getElementById('payStepProcessing');
  const success = document.getElementById('payStepSuccess');
  const footer = document.getElementById('payBillModalFooter');
  if (form) form.classList.toggle('d-none', step !== 'form');
  if (processing) processing.classList.toggle('d-none', step !== 'processing');
  if (success) success.classList.toggle('d-none', step !== 'success');
  if (footer) footer.classList.toggle('d-none', step !== 'form');
}

function processPayment(e) {
  e.preventDefault();
  const billId = document.getElementById('payBillId').value;
  const method = document.getElementById('payMethod').value;
  const bill = SystemDB.getMaintenance().find((b) => b.id === billId);
  if (!bill) { SHUI.toast('Bill not found.', 'error'); return; }

  showPayStep('processing');

  // Simulated gateway latency (1.2s)
  setTimeout(() => {
    const res = SystemDB.payMaintenance(billId, method);
    if (res && res.success) {
      SystemDB.notify({
        target: 'Admin',
        type: 'payment',
        title: 'Maintenance Payment Received',
        message: `${currentUser.name} (${currentUser.flat}) paid ${bill.month} maintenance of ${SHUI.formatINR(bill.amount)} via ${method}. Receipt ${res.bill.receiptNo}.`,
        link: 'admin.html'
      });
      setText('paySuccessTxn', res.bill.txnId);
      setText('paySuccessReceipt', res.bill.receiptNo);
      const dlBtn = document.getElementById('btnDownloadNewReceipt');
      if (dlBtn) dlBtn.setAttribute('data-bill-id', bill.id);
      showPayStep('success');
      SHUI.toast('Payment successful — receipt ' + res.bill.receiptNo + ' generated.', 'success');
      loadResidentDashboard();
    } else {
      showPayStep('form');
      SHUI.toast((res && res.message) || 'Payment failed. Please try again.', 'error');
    }
  }, 1200);
}

/* ──────────────────────────────────────────────
   TAB 3 — Complaints
   ────────────────────────────────────────────── */
function renderComplaints() {
  const rows = myComplaints().slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const opts = {
    columns: [
      { key: 'id', label: 'Ticket' },
      {
        key: 'title', label: 'Complaint',
        render: (r) =>
          '<div class="fw-semibold">' + esc(r.title) + '</div>' +
          '<small class="text-muted">' + esc(r.category) + (r.assignedTo ? ' &middot; ' + esc(r.assignedTo) : '') + '</small>'
      },
      { key: 'priority', label: 'Priority', render: (r) => priorityBadge(r.priority) },
      { key: 'status', label: 'Status', render: (r) => SHUI.statusBadge(SHUI.normalizeComplaintStatus(r.status)) },
      { key: 'date', label: 'Submitted', render: (r) => esc(SHUI.formatDate(r.date)) },
      {
        key: '_actions', label: 'Actions', sortable: false,
        render: (r) => `<button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="openComplaintDetail('${esc(r.id)}')"><i class="fa-solid fa-eye me-1"></i>View</button>`
      }
    ],
    rows,
    pageSize: 8,
    searchKeys: ['id', 'title', 'category', 'status', 'priority'],
    emptyState: {
      icon: 'fa-headset', title: 'No complaints raised',
      subtitle: 'That is a good thing! Raise one if something needs the society team\'s attention.',
      actionHtml: '<button class="btn btn-primary-custom btn-sm rounded-pill px-3" data-bs-toggle="modal" data-bs-target="#newComplaintModal"><i class="fa-solid fa-plus me-1"></i>Raise Complaint</button>'
    }
  };

  if (!tableHandles.complaints) tableHandles.complaints = SHUI.renderTable('#complaintsTableHost', opts);
  else tableHandles.complaints.refresh(rows);
}

function submitComplaint(e) {
  e.preventDefault();
  const titleEl = document.getElementById('cmpTitle');
  const descEl = document.getElementById('cmpDesc');
  const title = titleEl.value.trim();
  const description = descEl.value.trim();

  let valid = true;
  if (title.length < 5) { setFieldError(titleEl, true); valid = false; } else setFieldError(titleEl, false);
  if (description.length < 10) { setFieldError(descEl, true); valid = false; } else setFieldError(descEl, false);
  if (!valid) return;

  const payload = {
    category: document.getElementById('cmpCategory').value,
    title,
    description,
    priority: document.getElementById('cmpPriority').value
  };

  const res = SystemDB.addComplaint(payload);

  // Optional attachment filename (demo upload — name only)
  const image = document.getElementById('cmpImage').value.trim();
  if (res && res.complaint && image) {
    res.complaint.attachment = image;
    SystemDB.save();
  }

  hideModal('newComplaintModal');
  e.target.reset();
  loadResidentDashboard();
  SHUI.toast('Complaint registered. Ticket ID: ' + (res && res.complaint ? res.complaint.id : '—'), 'success');
}

function openComplaintDetail(id) {
  const c = SystemDB.getComplaints().find((x) => x.id === id);
  if (!c) { SHUI.toast('Complaint not found.', 'error'); return; }
  const body = document.getElementById('complaintDetailBody');
  if (!body) return;

  const status = SHUI.normalizeComplaintStatus(c.status);
  body.innerHTML = `
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <h5 class="fw-bold mb-1">${esc(c.title)}</h5>
        <span class="caption-text">${esc(c.id)} &middot; Flat ${esc(c.flat || '—')} &middot; Submitted ${esc(SHUI.formatDate(c.date))}</span>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        ${SHUI.badge(c.category || 'Other', 'secondary')}
        ${priorityBadge(c.priority)}
        ${SHUI.statusBadge(status)}
      </div>
    </div>

    <div class="p-3 rounded-3 border mb-3" style="background: var(--surface-card);">
      <span class="caption-text fw-semibold d-block mb-1 fs-8">Description</span>
      <p class="mb-0 fs-7">${esc(c.description || '—')}</p>
      ${c.attachment ? `<div class="caption-text mt-2 fs-8"><i class="fa-solid fa-paperclip me-1"></i>Attachment: ${esc(c.attachment)} <span class="text-muted">(demo — filename only)</span></div>` : ''}
      ${c.assignedTo ? `<div class="caption-text mt-2 fs-8"><i class="fa-solid fa-user-gear me-1"></i>Assigned to: <strong>${esc(c.assignedTo)}</strong></div>` : ''}
    </div>

    <h6 class="fw-bold mb-3"><i class="fa-solid fa-timeline text-primary me-2"></i>Timeline</h6>
    <div class="mb-3">${renderTimeline(c.timeline)}</div>

    <form id="complaintNoteForm" class="border-top pt-3">
      <input type="hidden" id="complaintNoteId" value="${esc(c.id)}">
      <label class="form-label caption-text fw-semibold" for="complaintNoteText">Add a note</label>
      <textarea class="form-control mb-2" id="complaintNoteText" rows="2" placeholder="Add an update or extra detail for the society team…"></textarea>
      <div class="invalid-feedback mb-2" id="complaintNoteErr">Please write a short note first.</div>
      <button type="submit" class="btn btn-primary-custom btn-sm rounded-pill px-3">
        <i class="fa-solid fa-plus me-1"></i>Add Note
      </button>
    </form>`;

  document.getElementById('complaintNoteForm').addEventListener('submit', submitComplaintNote);
  showModal('complaintDetailModal');
}

function submitComplaintNote(e) {
  e.preventDefault();
  const id = document.getElementById('complaintNoteId').value;
  const textEl = document.getElementById('complaintNoteText');
  const note = textEl.value.trim();
  if (!note) {
    setFieldError(textEl, true);
    return;
  }
  setFieldError(textEl, false);

  const res = SystemDB.addComplaintNote(id, note);
  if (!res || !res.success) {
    SHUI.toast((res && res.message) || 'Could not add the note.', 'error');
    return;
  }
  SystemDB.logAudit('Complaint Note Added', 'Complaints', `${id}: resident note added`);
  SystemDB.notify({
    target: 'Admin',
    type: 'complaint',
    title: 'Resident note on ' + id,
    message: `${currentUser.name} (${currentUser.flat}) added a note: "${note}"`,
    link: 'admin.html'
  });
  SHUI.toast('Note added to the complaint timeline.', 'success');
  openComplaintDetail(id); // re-render timeline inside the modal
  loadResidentDashboard();
}

/* ──────────────────────────────────────────────
   TAB 4 — Visitors & Passes
   ────────────────────────────────────────────── */
function renderVisitors() {
  const rows = myVisitors().slice().sort((a, b) => String(b.entryTime || '').localeCompare(String(a.entryTime || '')));
  const opts = {
    columns: [
      {
        key: 'gatePassCode', label: 'Gate Pass',
        render: (r) => '<span class="badge font-monospace" style="background:var(--surface-active);color:var(--text-heading);border:1px solid var(--border-color);">' + esc(r.gatePassCode || '—') + '</span>'
      },
      {
        key: 'name', label: 'Visitor',
        render: (r) => '<div class="fw-semibold">' + esc(r.name) + '</div><small class="text-muted">' + esc(r.phone || '') + '</small>'
      },
      { key: 'type', label: 'Type', render: (r) => SHUI.badge(r.type || 'Other', 'info') },
      { key: 'purpose', label: 'Purpose', render: (r) => '<span class="fs-7">' + esc(r.purpose || '—') + '</span>' },
      { key: 'entryTime', label: 'Entry Time', render: (r) => '<span class="fs-7">' + esc(SHUI.formatDateTime(r.entryTime)) + '</span>' },
      { key: 'status', label: 'Status', render: (r) => SHUI.statusBadge(r.status) },
      {
        key: '_actions', label: 'Actions', sortable: false,
        render: (r) => {
          if (r.status === 'Pending') {
            return (
              `<div class="d-flex gap-1 flex-wrap">` +
              `<button class="btn btn-sm btn-success rounded-pill px-2" onclick="respondVisitor('${esc(r.id)}', 'Approved')" title="Approve entry"><i class="fa-solid fa-check me-1"></i>Approve</button>` +
              `<button class="btn btn-sm btn-outline-danger rounded-pill px-2" onclick="respondVisitor('${esc(r.id)}', 'Rejected')" title="Deny entry"><i class="fa-solid fa-xmark me-1"></i>Deny</button>` +
              `</div>`
            );
          }
          if (r.status === 'Approved' || r.status === 'Checked In') {
            return `<button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="showVisitorPass('${esc(r.id)}')"><i class="fa-solid fa-qrcode me-1"></i>Pass</button>`;
          }
          return '<span class="text-muted small">—</span>';
        }
      }
    ],
    rows,
    pageSize: 8,
    searchKeys: ['name', 'purpose', 'type', 'status', 'gatePassCode', 'phone'],
    emptyState: { icon: 'fa-user-check', title: 'No visitors logged', subtitle: 'Visitors arriving for your flat will appear here with live status.' }
  };

  if (!tableHandles.visitors) tableHandles.visitors = SHUI.renderTable('#visitorsTableHost', opts);
  else tableHandles.visitors.refresh(rows);
}

function renderPreVisitors() {
  const rows = SystemDB.getPreApprovedVisitors()
    .filter((p) => p.residentId === currentUser.id || p.flat === currentUser.flat)
    .sort((a, b) => String(b.expectedDate || '').localeCompare(String(a.expectedDate || '')));
  const opts = {
    columns: [
      {
        key: 'visitorName', label: 'Visitor',
        render: (r) => '<div class="fw-semibold">' + esc(r.visitorName) + '</div><small class="text-muted">' + esc(r.visitorPhone || '') + '</small>'
      },
      { key: 'purpose', label: 'Purpose', render: (r) => '<span class="fs-7">' + esc(r.purpose || '—') + '</span>' },
      {
        key: 'expectedDate', label: 'Expected',
        render: (r) => {
          const window = r.expectedTimeFrom && r.expectedTimeTo ? ` (${esc(r.expectedTimeFrom)}–${esc(r.expectedTimeTo)})` : '';
          return '<span class="fs-7">' + esc(SHUI.formatDate(r.expectedDate)) + window + '</span>';
        }
      },
      { key: 'status', label: 'Status', render: (r) => SHUI.statusBadge(r.status || 'Pending') },
      {
        key: '_actions', label: 'Actions', sortable: false,
        render: (r) => `<button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="deletePreVisitor('${esc(r.id)}')"><i class="fa-solid fa-trash me-1"></i>Remove</button>`
      }
    ],
    rows,
    pageSize: 6,
    searchKeys: ['visitorName', 'purpose', 'status'],
    emptyState: { icon: 'fa-user-clock', title: 'No pre-registered visits', subtitle: 'Pre-register expected visitors so the gate can verify them quickly on arrival.' }
  };

  if (!tableHandles.preVisitors) tableHandles.preVisitors = SHUI.renderTable('#preVisitorsHost', opts);
  else tableHandles.preVisitors.refresh(rows);
}

function toggleVisitorPreFields() {
  const pre = document.getElementById('visPreRegister');
  const dateEl = document.getElementById('visExpectedDate');
  if (!pre || !dateEl) return;
  if (pre.checked) {
    dateEl.setAttribute('required', 'required');
  } else {
    dateEl.removeAttribute('required');
    dateEl.value = '';
    document.getElementById('visExpectedFrom').value = '';
    document.getElementById('visExpectedTo').value = '';
  }
}

function submitVisitor(e) {
  e.preventDefault();
  const nameEl = document.getElementById('visName');
  const phoneEl = document.getElementById('visPhone');
  const purposeEl = document.getElementById('visPurpose');
  const dateEl = document.getElementById('visExpectedDate');
  const pre = document.getElementById('visPreRegister').checked;

  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  const purpose = purposeEl.value.trim();
  const type = document.getElementById('visType').value;
  const vehicle = document.getElementById('visVehicle').value.trim();

  let valid = true;
  if (name.length < 2) { setFieldError(nameEl, true); valid = false; } else setFieldError(nameEl, false);
  if (!/^[6-9]\d{9}$/.test(phone)) { setFieldError(phoneEl, true); valid = false; } else setFieldError(phoneEl, false);
  if (purpose.length < 3) { setFieldError(purposeEl, true); valid = false; } else setFieldError(purposeEl, false);
  if (pre && !dateEl.value) { setFieldError(dateEl, true); valid = false; } else setFieldError(dateEl, false);
  if (!valid) return;

  if (pre) {
    // Advance registration for an expected visitor
    const res = SystemDB.addPreApprovedVisitor({
      visitorName: name,
      visitorPhone: phone,
      purpose,
      expectedDate: dateEl.value,
      expectedTimeFrom: document.getElementById('visExpectedFrom').value || '',
      expectedTimeTo: document.getElementById('visExpectedTo').value || ''
    });
    if (res && res.entry) {
      res.entry.type = type;
      res.entry.vehicleNo = vehicle || 'N/A';
      SystemDB.save();
    }
    SystemDB.logAudit('Visitor Pre-Registered', 'Gate Security', `${name} (${type}) expected ${dateEl.value} → Flat ${currentUser.flat}`);
    SystemDB.notify({
      target: 'Security Guard',
      type: 'visitor',
      title: `Visitor pre-registered for Flat ${currentUser.flat}`,
      message: `${name} (${type}, ${purpose}) is expected on ${SHUI.formatDate(dateEl.value)}.`,
      link: 'guard.html'
    });
    SHUI.toast('Visitor pre-registered — gate staff has been informed.', 'success');
  } else {
    // Visitor waiting at the gate right now
    const res = SystemDB.addVisitor({
      name,
      phone,
      flat: currentUser.flat,
      residentName: currentUser.name,
      purpose,
      type,
      vehicleNo: vehicle || 'N/A'
    });
    if (res && res.visitor) {
      SystemDB.notify({
        target: 'Security Guard',
        type: 'visitor',
        title: `Visitor at gate for Flat ${currentUser.flat}`,
        message: `${name} (${type}) has arrived — ${purpose}. Gate pass ${res.visitor.gatePassCode}.`,
        link: 'guard.html'
      });
      SHUI.toast('Visitor entry created with pass ' + res.visitor.gatePassCode + '. Approve it from the Visitors tab or notification bell.', 'success');
    }
  }

  hideModal('addVisitorModal');
  e.target.reset();
  document.getElementById('visPreRegister').checked = true;
  toggleVisitorPreFields();
  loadResidentDashboard();
}

async function deletePreVisitor(id) {
  const ok = await SHUI.confirm({
    title: 'Remove pre-registered visitor?',
    message: 'The gate will no longer expect this visitor.',
    confirmText: 'Remove',
    danger: true
  });
  if (!ok) return;
  SystemDB.deletePreApprovedVisitor(id);
  SystemDB.logAudit('Pre-Registered Visitor Removed', 'Gate Security', `Removed pre-approved entry ${id}`);
  SHUI.toast('Pre-registered visitor removed.', 'success');
  loadResidentDashboard();
}

function showVisitorPass(id) {
  const v = myVisitors().find((x) => x.id === id);
  if (!v) { SHUI.toast('Visitor not found.', 'error'); return; }
  const body = document.getElementById('visitorPassBody');
  if (!body) return;

  body.innerHTML = `
    <div class="mb-3">
      <h5 class="fw-bold mb-1">${esc(v.name)}</h5>
      <p class="caption-text mb-2">${esc(v.type || 'Visitor')} &middot; ${esc(v.purpose || 'Visit')} &middot; Flat ${esc(v.flat)}</p>
      ${SHUI.statusBadge(v.status)}
    </div>
    <div class="d-flex justify-content-center mb-3"><div id="visitorQrHost"></div></div>
    <p class="caption-text mb-0">Gate pass code: <strong class="font-monospace">${esc(v.gatePassCode || '—')}</strong><br>Share this with your visitor — the gate scans it on arrival.</p>`;

  showModal('visitorPassModal');
  const qrHost = document.getElementById('visitorQrHost');
  if (qrHost) SHUI.initQR(qrHost, v.gatePassCode || v.id);
}

/* ──────────────────────────────────────────────
   TAB 5 — Amenity Booking
   ────────────────────────────────────────────── */
function renderAmenities() {
  const grid = document.getElementById('amenitiesGrid');
  const select = document.getElementById('bookAmenitySelect');
  const amenities = SystemDB.getAmenities();

  if (grid) {
    if (!amenities.length) {
      grid.innerHTML = '<div class="col-12"><div class="hub-card p-4">' +
        SHUI.emptyState({ icon: 'fa-calendar-check', title: 'No amenities configured', subtitle: 'The society has not published bookable amenities yet.' }) +
        '</div></div>';
    } else {
      grid.innerHTML = amenities
        .map((a) => `
          <div class="col-md-6 col-xl-4">
            <div class="hub-card p-4 h-100 d-flex flex-column fade-up">
              <div class="d-flex align-items-center gap-3 mb-3">
                <div class="metric-icon bg-icon-primary"><i class="fa-solid ${esc(a.icon || 'fa-building')}"></i></div>
                <div class="min-w-0">
                  <h6 class="fw-bold mb-0 text-truncate">${esc(a.name)}</h6>
                  <span class="caption-text fs-8"><i class="fa-solid fa-users me-1"></i>Up to ${esc(a.capacity)} guests</span>
                </div>
              </div>
              <p class="text-muted fs-7 flex-grow-1 mb-3">${esc(a.description || '')}</p>
              <div class="d-flex align-items-center justify-content-between border-top pt-3 mt-auto">
                <div>
                  <span class="fw-bold text-primary">${SHUI.formatINR(a.rate)}</span>
                  <span class="caption-text fs-8">/ slot</span>
                  <div class="caption-text fs-8 text-muted">Morning &middot; Evening &middot; Full day</div>
                </div>
                <button class="btn btn-primary-custom btn-sm rounded-pill px-3" onclick="openBookingModal('${esc(a.id)}')">
                  <i class="fa-solid fa-calendar-plus me-1"></i>Book
                </button>
              </div>
            </div>
          </div>`)
        .join('');
    }
  }

  if (select) {
    select.innerHTML = amenities
      .map((a) => `<option value="${esc(a.id)}">${esc(a.name)} — ${SHUI.formatINR(a.rate)}/slot</option>`)
      .join('');
  }
}

function openBookingModal(amenityId) {
  const select = document.getElementById('bookAmenitySelect');
  const dateEl = document.getElementById('bookDate');
  const alertEl = document.getElementById('bookingConflictAlert');
  if (alertEl) alertEl.classList.add('d-none');
  if (dateEl) {
    dateEl.min = todayISO();
    if (!dateEl.value || dateEl.value < todayISO()) dateEl.value = todayISO();
  }
  const form = document.getElementById('bookAmenityForm');
  if (form) {
    form.reset();
    if (dateEl) dateEl.value = todayISO();
  }
  if (amenityId && select) select.value = amenityId;
  showModal('bookAmenityModal');
}

function submitBooking(e) {
  e.preventDefault();
  const purposeEl = document.getElementById('bookPurpose');
  const dateEl = document.getElementById('bookDate');
  const purpose = purposeEl.value.trim();
  const alertEl = document.getElementById('bookingConflictAlert');

  let valid = true;
  if (!purpose) { setFieldError(purposeEl, true); valid = false; } else setFieldError(purposeEl, false);
  if (!dateEl.value || dateEl.value < todayISO()) { setFieldError(dateEl, true); valid = false; } else setFieldError(dateEl, false);
  if (alertEl) alertEl.classList.add('d-none');
  if (!valid) return;

  const res = SystemDB.bookAmenity({
    amenityId: document.getElementById('bookAmenitySelect').value,
    date: dateEl.value,
    timeSlot: document.getElementById('bookTimeSlot').value,
    purpose
  });

  if (res && res.success) {
    SystemDB.notify({
      target: 'Admin',
      type: 'booking',
      title: 'New Amenity Booking',
      message: `${currentUser.name} (${currentUser.flat}) booked ${res.booking.amenityName} on ${SHUI.formatDate(res.booking.date)} [${res.booking.timeSlot}].`,
      link: 'admin.html'
    });
    hideModal('bookAmenityModal');
    e.target.reset();
    SHUI.toast('Reservation confirmed for ' + res.booking.amenityName + '!', 'success');
    loadResidentDashboard();
  } else if (alertEl) {
    // Conflict detection — show the engine's message inline
    alertEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> ' + esc((res && res.message) || 'This slot is not available.');
    alertEl.classList.remove('d-none');
  }
}

function renderBookings() {
  const today = todayISO();
  const mine = myBookings();
  const upcoming = mine
    .filter((b) => b.status === 'Confirmed' && String(b.date) >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const past = mine
    .filter((b) => !(b.status === 'Confirmed' && String(b.date) >= today))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const columns = [
    { key: 'id', label: 'Booking' },
    { key: 'amenityName', label: 'Amenity', render: (r) => '<span class="fw-semibold">' + esc(r.amenityName) + '</span>' },
    { key: 'date', label: 'Date', render: (r) => esc(SHUI.formatDate(r.date)) },
    { key: 'timeSlot', label: 'Time Slot', render: (r) => '<span class="fs-7">' + esc(r.timeSlot) + '</span>' },
    { key: 'purpose', label: 'Purpose', render: (r) => '<span class="fs-7">' + esc(r.purpose || '—') + '</span>' },
    { key: 'amount', label: 'Amount', render: (r) => '<span class="fw-bold">' + SHUI.formatINR(r.amount) + '</span>' },
    { key: 'status', label: 'Status', render: (r) => SHUI.statusBadge(r.status) },
    {
      key: '_actions', label: 'Actions', sortable: false,
      render: (r) =>
        r.status === 'Confirmed' && String(r.date) >= today
          ? `<button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="cancelBookingItem('${esc(r.id)}')"><i class="fa-solid fa-ban me-1"></i>Cancel</button>`
          : '<span class="text-muted small">—</span>'
    }
  ];

  const upcomingOpts = {
    columns, rows: upcoming, pageSize: 6,
    searchKeys: ['id', 'amenityName', 'purpose', 'status'],
    emptyState: { icon: 'fa-calendar-check', title: 'No upcoming bookings', subtitle: 'Book an amenity slot and it will show up here.' }
  };
  const pastOpts = {
    columns, rows: past, pageSize: 6,
    searchKeys: ['id', 'amenityName', 'purpose', 'status'],
    emptyState: { icon: 'fa-clock-rotate-left', title: 'No booking history', subtitle: 'Past and cancelled reservations will appear here.' }
  };

  if (!tableHandles.upcomingBookings) tableHandles.upcomingBookings = SHUI.renderTable('#upcomingBookingsHost', upcomingOpts);
  else tableHandles.upcomingBookings.refresh(upcoming);

  if (!tableHandles.pastBookings) tableHandles.pastBookings = SHUI.renderTable('#pastBookingsHost', pastOpts);
  else tableHandles.pastBookings.refresh(past);
}

async function cancelBookingItem(id) {
  const booking = SystemDB.getBookings().find((b) => b.id === id);
  const ok = await SHUI.confirm({
    title: 'Cancel this reservation?',
    message: booking
      ? `${booking.amenityName} on ${SHUI.formatDate(booking.date)} [${booking.timeSlot}] will be released for other residents.`
      : 'This booking will be cancelled.',
    confirmText: 'Cancel Booking',
    danger: true
  });
  if (!ok) return;

  const res = SystemDB.cancelBooking(id);
  if (res && res.success) {
    SystemDB.notify({
      target: 'Admin',
      type: 'booking',
      title: 'Amenity Booking Cancelled',
      message: `${currentUser.name} (${currentUser.flat}) cancelled ${res.booking.amenityName} on ${SHUI.formatDate(res.booking.date)}.`,
      link: 'admin.html'
    });
    SHUI.toast('Booking cancelled.', 'success');
    loadResidentDashboard();
  } else {
    SHUI.toast((res && res.message) || 'Could not cancel the booking.', 'error');
  }
}

/* ──────────────────────────────────────────────
   TAB 6 — Family Members
   ────────────────────────────────────────────── */
function renderFamily() {
  const grid = document.getElementById('familyGrid');
  if (!grid) return;
  const members = SystemDB.getFamilyMembers(currentUser.id);

  if (!members.length) {
    grid.innerHTML =
      '<div class="col-12"><div class="hub-card p-4">' +
      SHUI.emptyState({
        icon: 'fa-people-roof',
        title: 'No family members added',
        subtitle: 'Add the people living in your flat for gate verification and emergencies.',
        actionHtml: '<button class="btn btn-primary-custom btn-sm rounded-pill px-3" onclick="openFamilyModal()"><i class="fa-solid fa-user-plus me-1"></i>Add Member</button>'
      }) +
      '</div></div>';
    return;
  }

  grid.innerHTML = members
    .map((m) => `
      <div class="col-md-6 col-xl-4">
        <div class="hub-card p-4 h-100 fade-up">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="metric-icon bg-icon-primary"><i class="fa-solid fa-user"></i></div>
            <div class="flex-grow-1 min-w-0">
              <h6 class="fw-bold mb-0 text-truncate">
                ${esc(m.name)}
                ${m.emergencyContact ? '<i class="fa-solid fa-star text-warning ms-1" title="Emergency contact" style="font-size:12px;"></i>' : ''}
              </h6>
              <span class="caption-text fs-8">${esc(m.relationship || 'Other')}</span>
            </div>
          </div>
          <div class="fs-7 mb-1"><i class="fa-solid fa-cake-candles text-muted me-2"></i>Age: <strong>${esc(m.age || '—')}</strong></div>
          <div class="fs-7 mb-3"><i class="fa-solid fa-phone text-muted me-2"></i>${m.phone ? esc(m.phone) : '<span class="text-muted">No phone added</span>'}</div>
          <div class="d-flex gap-2 mt-auto">
            <button class="btn btn-sm btn-outline-primary rounded-pill px-3 flex-fill" onclick="openFamilyModal('${esc(m.id)}')">
              <i class="fa-solid fa-pen me-1"></i>Edit
            </button>
            <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="removeFamilyMember('${esc(m.id)}')" title="Remove member">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>`)
    .join('');
}

function openFamilyModal(memberId) {
  const form = document.getElementById('familyMemberForm');
  const title = document.getElementById('familyModalTitle');
  if (form) form.reset();
  ['famName', 'famAge', 'famPhone'].forEach((id) => setFieldError(document.getElementById(id), false));
  document.getElementById('famEditId').value = '';

  if (memberId) {
    const m = SystemDB.getFamilyMembers(currentUser.id).find((x) => x.id === memberId);
    if (!m) { SHUI.toast('Member not found.', 'error'); return; }
    document.getElementById('famEditId').value = m.id;
    document.getElementById('famName').value = m.name || '';
    document.getElementById('famRelationship').value = m.relationship || 'Other';
    document.getElementById('famAge').value = m.age || '';
    document.getElementById('famPhone').value = m.phone || '';
    document.getElementById('famEmergency').checked = !!m.emergencyContact;
    if (title) title.innerHTML = '<i class="fa-solid fa-user-pen me-2 text-primary"></i>Edit Family Member';
  } else {
    if (title) title.innerHTML = '<i class="fa-solid fa-user-plus me-2 text-primary"></i>Add Family Member';
  }
  showModal('familyMemberModal');
}

function saveFamilyMember(e) {
  e.preventDefault();
  const nameEl = document.getElementById('famName');
  const ageEl = document.getElementById('famAge');
  const phoneEl = document.getElementById('famPhone');

  const name = nameEl.value.trim();
  const age = parseInt(ageEl.value, 10);
  const phone = phoneEl.value.trim();

  let valid = true;
  if (name.length < 2) { setFieldError(nameEl, true); valid = false; } else setFieldError(nameEl, false);
  if (isNaN(age) || age < 1 || age > 120) { setFieldError(ageEl, true); valid = false; } else setFieldError(ageEl, false);
  if (phone && !/^[6-9]\d{9}$/.test(phone)) { setFieldError(phoneEl, true); valid = false; } else setFieldError(phoneEl, false);
  if (!valid) return;

  const payload = {
    userId: currentUser.id,
    name,
    relationship: document.getElementById('famRelationship').value,
    age,
    phone,
    emergencyContact: document.getElementById('famEmergency').checked
  };

  const editId = document.getElementById('famEditId').value;
  if (editId) {
    const res = SystemDB.updateDoc('familyMembers', editId, payload);
    if (!res || !res.success) { SHUI.toast((res && res.message) || 'Could not update member.', 'error'); return; }
    SystemDB.logAudit('Family Member Updated', 'Profile', `Updated ${name} (${payload.relationship})`);
    SHUI.toast('Family member updated.', 'success');
  } else {
    SystemDB.addFamilyMember(payload);
    SHUI.toast(name + ' added to your family members.', 'success');
  }

  hideModal('familyMemberModal');
  loadResidentDashboard();
}

async function removeFamilyMember(id) {
  const m = SystemDB.getFamilyMembers(currentUser.id).find((x) => x.id === id);
  const ok = await SHUI.confirm({
    title: 'Remove family member?',
    message: m ? `${m.name} will be removed from your flat's member list.` : 'This member will be removed.',
    confirmText: 'Remove',
    danger: true
  });
  if (!ok) return;
  SystemDB.deleteFamilyMember(id);
  SHUI.toast('Family member removed.', 'success');
  loadResidentDashboard();
}

/* ──────────────────────────────────────────────
   TAB 7 — Notices & Events
   ────────────────────────────────────────────── */
function noticeCardHtml(n) {
  const isEmergency = n.category === 'Emergency';
  return `
    <div class="col-md-6">
      <div class="hub-card p-4 h-100 fade-up" ${isEmergency ? 'style="border: 1px solid rgba(239,68,68,0.4);"' : ''}>
        <div class="d-flex align-items-center justify-content-between mb-2 gap-2">
          ${noticeBadge(n.category)}
          <small class="text-muted caption-text fs-8"><i class="fa-solid fa-calendar me-1"></i>${esc(SHUI.formatDate(n.date))}</small>
        </div>
        <h6 class="fw-bold mb-2">${esc(n.title)}</h6>
        <p class="text-muted fs-7 flex-grow-1 mb-3">${esc(n.content || '')}</p>
        <small class="text-muted d-block border-top pt-2 mt-auto fs-8">
          <i class="fa-solid fa-bullhorn me-1"></i>Issued by ${esc(n.postedBy || 'Society Office')}
        </small>
      </div>
    </div>`;
}

function renderNotices() {
  const container = document.getElementById('resNoticesContainer');
  if (!container) return;
  const notices = SystemDB.getNotices().slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  if (!notices.length) {
    container.innerHTML = '<div class="col-12"><div class="hub-card p-4">' +
      SHUI.emptyState({ icon: 'fa-bullhorn', title: 'No notices published', subtitle: 'Official society announcements will appear here.' }) +
      '</div></div>';
    return;
  }
  container.innerHTML = notices.map(noticeCardHtml).join('');
}

function renderEvents() {
  const container = document.getElementById('resEventsContainer');
  if (!container) return;
  const events = SystemDB.getEvents().slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  if (!events.length) {
    container.innerHTML = '<div class="col-12"><div class="hub-card p-4">' +
      SHUI.emptyState({ icon: 'fa-calendar-days', title: 'No events scheduled', subtitle: 'Society events and gatherings will appear here.' }) +
      '</div></div>';
    return;
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  container.innerHTML = events
    .map((ev) => {
      const d = new Date(String(ev.date || '').replace(/-/g, '/'));
      const day = isNaN(d.getTime()) ? '—' : d.getDate();
      const mon = isNaN(d.getTime()) ? '' : months[d.getMonth()];
      const time = ev.startTime && ev.endTime ? `${esc(ev.startTime)} – ${esc(ev.endTime)}` : '';
      return `
        <div class="col-md-6">
          <div class="hub-card p-4 h-100 d-flex gap-3 fade-up">
            <div class="text-center rounded-3 px-3 py-2 flex-shrink-0" style="background: rgba(37,99,235,0.1); min-width: 64px; height: fit-content;">
              <div class="fw-bold" style="font-size:22px;color:var(--accent-primary);line-height:1.1;">${esc(day)}</div>
              <div class="caption-text fw-bold" style="color:var(--accent-primary);">${esc(mon)}</div>
            </div>
            <div class="min-w-0 flex-grow-1">
              <div class="d-flex align-items-center justify-content-between gap-2 mb-1 flex-wrap">
                <h6 class="fw-bold mb-0 text-truncate">${esc(ev.title)}</h6>
                ${SHUI.statusBadge(ev.status || 'Upcoming')}
              </div>
              <div class="caption-text fs-8 mb-2">
                ${time ? `<i class="fa-solid fa-clock me-1"></i>${time} &middot; ` : ''}
                <i class="fa-solid fa-location-dot me-1"></i>${esc(ev.location || 'Society premises')}
              </div>
              <p class="text-muted fs-7 mb-2">${esc(ev.description || '')}</p>
              ${SHUI.badge(ev.category || 'General', 'secondary')}
            </div>
          </div>
        </div>`;
    })
    .join('');
}

/* ──────────────────────────────────────────────
   TAB 8 — Documents
   ────────────────────────────────────────────── */
function renderDocuments() {
  const rows = SystemDB.getDocuments()
    .filter((d) => d.access === 'All' || String(d.access || '').indexOf('Resident') !== -1)
    .sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));

  const opts = {
    columns: [
      {
        key: 'title', label: 'Document',
        render: (r) => '<div class="fw-semibold">' + esc(r.title) + '</div><small class="text-muted font-monospace">' + esc(r.fileName || '') + '</small>'
      },
      { key: 'category', label: 'Category', render: (r) => SHUI.badge(r.category || 'General', 'secondary') },
      { key: 'fileType', label: 'Type', render: (r) => SHUI.badge(r.fileType || 'FILE', 'info') },
      { key: 'sizeKB', label: 'Size', render: (r) => '<span class="fs-7">' + esc(Number(r.sizeKB) || 0) + ' KB</span>' },
      { key: 'uploadedAt', label: 'Uploaded', render: (r) => esc(SHUI.formatDate(r.uploadedAt)) },
      {
        key: '_actions', label: 'Actions', sortable: false,
        render: (r) => `<button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="demoDownloadDocument('${esc(r.id)}')"><i class="fa-solid fa-download me-1"></i>Download</button>`
      }
    ],
    rows,
    pageSize: 8,
    searchKeys: ['title', 'category', 'fileType', 'fileName'],
    emptyState: { icon: 'fa-folder-open', title: 'No documents shared', subtitle: 'Society documents shared with all residents will appear here.' }
  };

  if (!tableHandles.documents) tableHandles.documents = SHUI.renderTable('#documentsTableHost', opts);
  else tableHandles.documents.refresh(rows);
}

function demoDownloadDocument(id) {
  const doc = SystemDB.getDocuments().find((d) => d.id === id);
  if (!doc) { SHUI.toast('Document not found.', 'error'); return; }
  SHUI.toast('Demo download — "' + (doc.fileName || doc.title) + '" would download in a live deployment.', 'info');
}

/* ──────────────────────────────────────────────
   TAB 9 — Polls
   ────────────────────────────────────────────── */
function renderPolls() {
  const container = document.getElementById('pollsContainer');
  if (!container) return;
  const polls = SystemDB.getPolls();
  const today = todayISO();

  if (!polls.length) {
    container.innerHTML = '<div class="col-12"><div class="hub-card p-4">' +
      SHUI.emptyState({ icon: 'fa-square-poll-vertical', title: 'No active polls', subtitle: 'Committee polls will appear here for you to vote on.' }) +
      '</div></div>';
    return;
  }

  const colors = SHUI.chartColors();
  const voterKey = currentUser.id || currentUser.email;

  container.innerHTML = polls
    .map((poll) => {
      const closed = poll.status === 'Closed' || (poll.endDate && String(poll.endDate) < today);
      const hasVoted = Array.isArray(poll.voters) && poll.voters.indexOf(voterKey) !== -1;
      const showResults = closed || hasVoted;
      const total = Number(poll.totalVotes) || poll.options.reduce((s, o) => s + (Number(o.votes) || 0), 0);

      let bodyHtml = '';
      if (showResults) {
        bodyHtml = poll.options
          .map((opt, i) => {
            const pct = total > 0 ? Math.round(((Number(opt.votes) || 0) / total) * 100) : 0;
            const color = colors.palette[i % colors.palette.length];
            return `
              <div class="mb-3">
                <div class="d-flex justify-content-between fs-7 mb-1">
                  <span class="fw-semibold">${esc(opt.text)}</span>
                  <span class="text-muted fw-bold">${pct}% &middot; ${Number(opt.votes) || 0} votes</span>
                </div>
                <div class="progress" style="height: 9px; border-radius: 6px; background: var(--surface-active);">
                  <div class="progress-bar" role="progressbar" style="width:${pct}%;background:${color};" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
              </div>`;
          })
          .join('');
        bodyHtml += closed
          ? '<p class="caption-text mb-0"><i class="fa-solid fa-lock me-1"></i>This poll is closed. Final results are shown.</p>'
          : '<p class="caption-text mb-0 text-success"><i class="fa-solid fa-circle-check me-1"></i>You have voted in this poll.</p>';
      } else {
        bodyHtml = poll.options
          .map(
            (opt) => `
              <button type="button" class="btn btn-outline-primary rounded-pill px-4 py-2 mb-2 w-100 text-start fw-semibold"
                onclick="castVote('${esc(poll.id)}', '${esc(opt.id)}')">
                <i class="fa-solid fa-square-poll-vertical me-2 opacity-50"></i>${esc(opt.text)}
              </button>`
          )
          .join('');
        bodyHtml += '<p class="caption-text mb-0 mt-1"><i class="fa-solid fa-circle-info me-1"></i>Results are revealed after you vote.</p>';
      }

      return `
        <div class="col-lg-6">
          <div class="hub-card p-4 h-100 fade-up">
            <div class="d-flex align-items-center justify-content-between gap-2 mb-2 flex-wrap">
              ${SHUI.badge(poll.category || 'General', 'secondary')}
              ${closed ? SHUI.badge('Closed', 'danger') : SHUI.badge('Active', 'success')}
            </div>
            <h6 class="fw-bold mb-1">${esc(poll.title)}</h6>
            <p class="text-muted fs-7 mb-3">${esc(poll.description || '')}</p>
            ${bodyHtml}
            <div class="caption-text fs-8 text-muted border-top pt-2 mt-3">
              <i class="fa-solid fa-users me-1"></i>${total} vote${total === 1 ? '' : 's'} &middot;
              <i class="fa-solid fa-calendar me-1"></i>${closed ? 'Ended' : 'Ends'} ${esc(SHUI.formatDate(poll.endDate))} &middot;
              by ${esc(poll.createdBy || 'Committee')}
            </div>
          </div>
        </div>`;
    })
    .join('');
}

function castVote(pollId, optionId) {
  const res = SystemDB.votePoll(pollId, optionId);
  if (res && res.success) {
    SHUI.toast('Your vote has been recorded. Thank you!', 'success');
  } else {
    SHUI.toast((res && res.message) || 'Could not record your vote.', 'warning');
  }
  renderPolls();
}

/* ──────────────────────────────────────────────
   TAB 10 — Emergency SOS
   ────────────────────────────────────────────── */
function renderEmergencyContacts() {
  const host = document.getElementById('emergencyContactsList');
  if (!host) return;
  const settings = societySettings();
  const contacts = [
    { icon: 'fa-user-shield', label: 'Security Desk (24×7)', value: 'Gate 1 — +91 98200 11001', tel: '+919820011001', tone: 'danger' },
    { icon: 'fa-building-columns', label: 'Society Office', value: esc(settings.name || 'SocietyHub') + ' — 022 2650 4400', tel: '02226504400', tone: 'primary' },
    { icon: 'fa-fire-extinguisher', label: 'Fire Station', value: 'Dial 101', tel: '101', tone: 'danger' },
    { icon: 'fa-truck-medical', label: 'Ambulance', value: 'Dial 102', tel: '102', tone: 'success' },
    { icon: 'fa-shield-halved', label: 'Police Control Room', value: 'Dial 100', tel: '100', tone: 'info' }
  ];

  host.innerHTML = contacts
    .map(
      (c) => `
        <a href="tel:${esc(c.tel)}" class="d-flex align-items-center gap-3 p-2 rounded-3 text-decoration-none"
           style="background: var(--surface-card); border: 1px solid var(--border-color); transition: border-color .2s ease;">
          <div class="metric-icon bg-icon-${c.tone}" style="width:42px;height:42px;min-width:42px;font-size:16px;"><i class="fa-solid ${c.icon}"></i></div>
          <div class="min-w-0">
            <div class="fw-bold fs-7 text-heading">${c.label}</div>
            <div class="caption-text fs-8">${c.value}</div>
          </div>
          <i class="fa-solid fa-phone ms-auto text-muted"></i>
        </a>`
    )
    .join('');
}

async function triggerSOS(e) {
  e.preventDefault();
  const typeEl = document.getElementById('sosType');
  const msgEl = document.getElementById('sosMessage');
  const message = msgEl.value.trim();
  if (!message) { setFieldError(msgEl, true); return; }
  setFieldError(msgEl, false);

  const type = typeEl.value;
  const ok = await SHUI.confirm({
    title: 'Trigger emergency alert?',
    message: `A ${type} emergency alert will be broadcast immediately to society security, admin and all staff. Use only for genuine emergencies.`,
    confirmText: 'Trigger SOS',
    danger: true
  });
  if (!ok) return;

  const res = SystemDB.raiseEmergency({ type, message });
  if (res && res.success) {
    SHUI.toast('SOS broadcast sent — security and society staff have been alerted.', 'success');
    e.target.reset();
    loadResidentDashboard();
  } else {
    SHUI.toast('Could not send the alert. Please try again.', 'error');
  }
}

function renderSosAlerts() {
  const rows = SystemDB.getEmergencyAlerts()
    .filter((a) => a.raisedBy === currentUser.name || a.raisedByFlat === currentUser.flat)
    .sort((a, b) => String(b.raisedAt || '').localeCompare(String(a.raisedAt || '')));

  const opts = {
    columns: [
      { key: 'type', label: 'Type', render: (r) => SHUI.badge(r.type || 'General', 'danger') },
      { key: 'message', label: 'Message', render: (r) => '<span class="fs-7">' + esc(r.message || '—') + '</span>' },
      { key: 'status', label: 'Status', render: (r) => SHUI.statusBadge(r.status) },
      { key: 'raisedAt', label: 'Raised At', render: (r) => '<span class="fs-7">' + esc(SHUI.formatDateTime(r.raisedAt)) + '</span>' }
    ],
    rows,
    pageSize: 5,
    searchKeys: ['type', 'message', 'status'],
    emptyState: { icon: 'fa-tower-broadcast', title: 'No alerts raised', subtitle: 'Emergency alerts raised from your account will appear here.' }
  };

  if (!tableHandles.sosAlerts) tableHandles.sosAlerts = SHUI.renderTable('#sosAlertsHost', opts);
  else tableHandles.sosAlerts.refresh(rows);
}

/* ──────────────────────────────────────────────
   Form bindings
   ────────────────────────────────────────────── */
function bindForms() {
  const payForm = document.getElementById('payBillForm');
  if (payForm) payForm.addEventListener('submit', processPayment);

  const dlBtn = document.getElementById('btnDownloadNewReceipt');
  if (dlBtn) {
    dlBtn.addEventListener('click', () => {
      const id = dlBtn.getAttribute('data-bill-id');
      if (id) downloadPDFReceipt(id);
    });
  }

  const payModal = document.getElementById('payBillModal');
  if (payModal) {
    payModal.addEventListener('hidden.bs.modal', () => {
      showPayStep('form');
      const form = document.getElementById('payBillForm');
      if (form) form.reset();
    });
  }

  const complaintForm = document.getElementById('newComplaintForm');
  if (complaintForm) complaintForm.addEventListener('submit', submitComplaint);

  const bookingForm = document.getElementById('bookAmenityForm');
  if (bookingForm) bookingForm.addEventListener('submit', submitBooking);

  const visitorForm = document.getElementById('addVisitorForm');
  if (visitorForm) visitorForm.addEventListener('submit', submitVisitor);

  const preToggle = document.getElementById('visPreRegister');
  if (preToggle) preToggle.addEventListener('change', toggleVisitorPreFields);

  const familyForm = document.getElementById('familyMemberForm');
  if (familyForm) familyForm.addEventListener('submit', saveFamilyMember);

  const sosForm = document.getElementById('sosForm');
  if (sosForm) sosForm.addEventListener('submit', triggerSOS);
}

/* ──────────────────────────────────────────────
   Logout
   ────────────────────────────────────────────── */
async function logout() {
  if (window.Clerk && window.Clerk.user) {
    try { await window.Clerk.signOut(); } catch (err) { /* non-fatal */ }
  }
  sessionStorage.clear();
  window.location.href = 'login.html';
}

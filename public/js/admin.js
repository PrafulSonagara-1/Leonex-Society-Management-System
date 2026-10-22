/**
 * Smart Society Management System - Admin Dashboard JS
 */

let billingChartInstance = null;
let complaintChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  await SystemDB.init();

  const currentUser = SystemDB.getCurrentUser();
  if (!currentUser || currentUser.role !== 'Admin') {
    window.location.href = 'index.html';
    return;
  }

  const isDemo = SystemDB.isDemoMode();
  const socCode = SystemDB.getSocietyCode();
  const socName = (SystemDB.data && SystemDB.data.societySettings && SystemDB.data.societySettings.name)
    || currentUser.societyName
    || sessionStorage.getItem('ssm_society_name')
    || 'My Society';

  const badgeEl = document.getElementById('adminModeBadge');
  if (badgeEl) {
    if (isDemo) {
      badgeEl.className = 'badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-30 rounded-pill px-3 py-2 fs-8 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm';
      badgeEl.innerHTML = '<i class="fa-solid fa-flask"></i> Demo Mode · Sample Data';
      badgeEl.title = 'You are exploring the interactive demo dataset';
    } else {
      badgeEl.className = 'badge bg-info bg-opacity-20 text-info border border-info border-opacity-30 rounded-pill px-3 py-2 fs-8 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm';
      badgeEl.innerHTML = `<i class="fa-solid fa-building"></i> ${socName} · <code>${socCode}</code>`;
      badgeEl.title = 'Active Society Code: ' + socCode;
    }
  }

  const subEl = document.getElementById('adminSocietySub');
  if (subEl) {
    subEl.textContent = isDemo
      ? 'Interactive demo control center — testing with sample residents, bills, and complaints.'
      : `Active Society: ${socName} (Code: ${socCode}) · Manage your society residents, finances, and security.`;
  }

  const adminNameEl = document.getElementById('adminName');
  if (adminNameEl) adminNameEl.textContent = currentUser.name;
  if (currentUser.avatar) {
    const adminAvatarEl = document.getElementById('adminAvatar');
    if (adminAvatarEl) adminAvatarEl.src = currentUser.avatar;
  }

  loadAdminDashboard();

  // Optional Committee Module Switch
  const commToggle = document.getElementById('toggleCommitteeModule');
  if (commToggle) {
    commToggle.addEventListener('change', (e) => {
      handleCommitteeModuleToggle(e.target.checked);
    });
  }

  document.getElementById('changeRoleForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('roleUserId').value;
    const newRole = document.getElementById('roleSelect').value;

    const isCommEnabled = (window.SystemDB && typeof SystemDB.isCommitteeEnabled === 'function')
      ? SystemDB.isCommitteeEnabled()
      : true;

    if (newRole === 'Committee Member' && !isCommEnabled) {
      if (typeof showToast === 'function') {
        showToast('Committee Member role is disabled in Society Settings. Please enable the Committee Panel first.', 'warning');
      }
      return;
    }

    SystemDB.updateUserRole(id, newRole);
    const modalEl = document.getElementById('changeRoleModal');
    bootstrap.Modal.getInstance(modalEl).hide();
    loadAdminDashboard();
    if (typeof showToast === 'function') {
      showToast(`User role successfully updated to ${newRole}!`, "success");
    }
  });

  // Modal forms
  document.getElementById('addResidentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('resName').value;
    const flat = document.getElementById('resFlat').value;
    const phone = document.getElementById('resPhone').value;
    const email = document.getElementById('resEmail').value;

    SystemDB.addResident({ name, flat, phone, email });
    const modalEl = document.getElementById('addResidentModal');
    bootstrap.Modal.getInstance(modalEl).hide();
    document.getElementById('addResidentForm').reset();
    loadAdminDashboard();
    if (typeof showToast === 'function') {
      showToast(`Resident ${name} registered successfully!`, "success");
    }
  });

  document.getElementById('updateComplaintForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editCmpId').value;
    const status = document.getElementById('editCmpStatus').value;
    const notes = document.getElementById('editCmpNotes').value;

    SystemDB.updateComplaintStatus(id, status, notes);
    const modalEl = document.getElementById('updateComplaintModal');
    bootstrap.Modal.getInstance(modalEl).hide();
    loadAdminDashboard();
    if (typeof showToast === 'function') {
      showToast(`Complaint ${id} status updated to ${status}.`, "success");
    }
  });

  document.getElementById('addNoticeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('noticeTitle').value;
    const category = document.getElementById('noticeCategory').value;
    const content = document.getElementById('noticeContent').value;

    SystemDB.addNotice({ title, category, content });
    const modalEl = document.getElementById('addNoticeModal');
    bootstrap.Modal.getInstance(modalEl).hide();
    document.getElementById('addNoticeForm').reset();
    loadAdminDashboard();
    if (typeof showToast === 'function') {
      showToast("Society Announcement Notice published!", "success");
    }
  });
});

function loadAdminDashboard() {
  renderNewSocietyBanner();
  renderKPIs();
  renderCharts();
  renderResidentsTable();
  renderTowersAndFlats();
  renderAmenitiesDashboard();
  renderComplaintsTable();
  renderBillingTable();
  renderNotices();
  renderVisitorsTable();
  renderRoleSettingsTable();
  renderAuditLogs();
  loadPendingApprovals();
}

function renderNewSocietyBanner() {
  const banner = document.getElementById('newSocietyWelcomeBanner');
  if (!banner) return;
  const isDemo = SystemDB.isDemoMode();
  if (isDemo) {
    banner.innerHTML = '';
    return;
  }
  const socCode = SystemDB.getSocietyCode();
  const socName = (SystemDB.data && SystemDB.data.societySettings && SystemDB.data.societySettings.name)
    || sessionStorage.getItem('ssm_society_name')
    || 'Your Society';
  const residents = (SystemDB.getResidents ? SystemDB.getResidents() : []).filter(r => r.role === 'Resident');

  if (residents.length === 0) {
    banner.innerHTML = `
      <div class="alert border border-primary border-opacity-25 rounded-4 p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3 shadow-sm" style="background: rgba(99, 102, 241, 0.08);">
        <div class="d-flex align-items-center gap-3">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366F1, #4F46E5); display:flex; align-items:center; justify-content:center; color:#fff; font-size:20px; flex-shrink:0;">
            <i class="fa-solid fa-building-circle-check"></i>
          </div>
          <div>
            <div class="fw-bold text-white fs-6">Welcome to ${socName}! Your society dashboard is active.</div>
            <div class="text-secondary fs-8">Share your unique Society Code <strong class="text-warning font-monospace fs-7 px-2 py-0.5 rounded" style="background: rgba(0,0,0,0.4);">${socCode}</strong> with residents so they can join their flats.</div>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-gold rounded-pill px-3 d-inline-flex align-items-center gap-2" onclick="copySocietyCode('${socCode}')">
            <i class="fa-regular fa-copy"></i> Copy Society Code
          </button>
          <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" data-bs-toggle="modal" data-bs-target="#addResidentModal">
            <i class="fa-solid fa-user-plus me-1"></i> Add Resident
          </button>
        </div>
      </div>
    `;
  } else {
    banner.innerHTML = '';
  }
}

function copySocietyCode(code) {
  if (!code) code = SystemDB.getSocietyCode();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      if (typeof showToast === 'function') {
        showToast('Society Code ' + code + ' copied to clipboard!', 'success');
      } else {
        alert('Society Code ' + code + ' copied to clipboard!');
      }
    }).catch(() => {
      prompt('Your Society Code is:', code);
    });
  } else {
    prompt('Your Society Code is:', code);
  }
}
window.copySocietyCode = copySocietyCode;

function renderKPIs() {
  const residents = SystemDB.getResidents().filter(r => r.role === 'Resident');
  document.getElementById('kpiResidents').textContent = residents.length;

  const maintenance = SystemDB.getMaintenance();
  const currentMonth = SystemDB._currentMonthLabel ? SystemDB._currentMonthLabel() : 'July 2026';
  const monthBills = maintenance.filter(m => m.month === currentMonth || m.month.includes('2026'));
  const targetBills = monthBills.length ? monthBills : maintenance;
  const paidBills = targetBills.filter(m => m.status === 'Paid');
  const paidTotal = paidBills.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const rate = targetBills.length ? Math.round((paidBills.length / targetBills.length) * 100) : 0;

  document.getElementById('kpiCollection').textContent = `₹${paidTotal.toLocaleString()}`;
  document.getElementById('kpiCollectionRate').textContent = `${rate}% Collected (${paidBills.length}/${targetBills.length} Flatted)`;

  const complaints = SystemDB.getComplaints();
  const pending = complaints.filter(c => c.status === 'Pending' || c.status === 'Open' || c.status === 'In Progress' || c.status === 'Assigned');
  document.getElementById('kpiPendingComplaints').textContent = pending.length;

  const visitors = SystemDB.getVisitors();
  document.getElementById('kpiVisitors').textContent = visitors.length;
}

function renderCharts() {
  const maintenance = SystemDB.getMaintenance();
  const currentMonth = SystemDB._currentMonthLabel ? SystemDB._currentMonthLabel() : 'July 2026';
  const monthBills = maintenance.filter(m => m.month === currentMonth || m.month.includes('2026'));
  const targetBills = monthBills.length ? monthBills : maintenance;
  const paidSum = targetBills.filter(m => m.status === 'Paid').reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const unpaidSum = targetBills.filter(m => m.status === 'Unpaid').reduce((a, b) => a + (Number(b.amount) || 0), 0);

  // Billing Bar Chart
  const ctxBilling = document.getElementById('billingChart').getContext('2d');
  if (billingChartInstance) billingChartInstance.destroy();

  billingChartInstance = new Chart(ctxBilling, {
    type: 'bar',
    data: {
      labels: ['Collected Amount', 'Pending Dues'],
      datasets: [{
        label: 'Maintenance (₹)',
        data: [paidSum, unpaidSum],
        backgroundColor: ['#10b981', '#ef4444'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });

  // Complaint Doughnut Chart
  const complaints = SystemDB.getComplaints();
  const pendingCount = complaints.filter(c => c.status === 'Pending' || c.status === 'Open').length;
  const progressCount = complaints.filter(c => c.status === 'In Progress' || c.status === 'Assigned').length;
  const resolvedCount = complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
  const totalCmp = pendingCount + progressCount + resolvedCount;

  const ctxCmp = document.getElementById('complaintChart').getContext('2d');
  if (complaintChartInstance) complaintChartInstance.destroy();

  complaintChartInstance = new Chart(ctxCmp, {
    type: 'doughnut',
    data: {
      labels: totalCmp > 0 ? ['Pending / Open', 'In Progress', 'Resolved'] : ['No Complaints Recorded'],
      datasets: [{
        data: totalCmp > 0 ? [pendingCount, progressCount, resolvedCount] : [1],
        backgroundColor: totalCmp > 0 ? ['#f59e0b', '#0ea5e9', '#10b981'] : ['rgba(255, 255, 255, 0.12)']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderResidentsTable() {
  const tbody = document.getElementById('residentsTableBody');
  if (!tbody) return;

  const socCode = SystemDB.getSocietyCode();
  // Show ALL members, sorted: Admin → Committee → Resident → Security Guard
  const roleOrder = { 'Admin': 0, 'Committee Member': 1, 'Resident': 2, 'Security Guard': 3 };
  const allUsers = (SystemDB.data && SystemDB.data.users) ? [...SystemDB.data.users] : [];
  allUsers.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));

  if (!allUsers.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <i class="fa-solid fa-users-slash fs-2 d-block mb-2 opacity-50"></i>
          <div class="fw-semibold text-white">No members registered yet</div>
          <small class="text-muted">Invite residents by sharing your society code <strong>${socCode}</strong> or click <strong>Add Resident</strong> above.</small>
        </td>
      </tr>`;
    return;
  }

  const roleBadgeClass = {
    'Admin': 'bg-danger text-white',
    'Committee Member': 'bg-info text-dark',
    'Resident': 'bg-primary text-white',
    'Security Guard': 'bg-warning text-dark'
  };

  let rowsHtml = allUsers.map(r => {
    const avatarUrl = getMemberAvatar(r);
    const badgeCls = roleBadgeClass[r.role] || 'bg-secondary text-white';

    // Role-specific detail line
    let detailLine = '';
    if (r.role === 'Resident') {
      detailLine = `
        <small class="text-muted d-block">
          ${r.residentType || 'Owner'} · ${r.tower || ''}
          ${r.parkingSlot ? `· <i class="fa-solid fa-square-parking text-primary"></i> ${r.parkingSlot}` : ''}
          ${r.familyCount ? `· <i class="fa-solid fa-users text-success"></i> ${r.familyCount}` : ''}
        </small>`;
    } else if (r.role === 'Security Guard') {
      detailLine = `<small class="text-muted d-block"><i class="fa-solid fa-clock me-1"></i>${r.shift || 'Morning Shift'} · ${r.gateAssigned || 'Gate 1'}</small>`;
    } else if (r.role === 'Committee Member') {
      detailLine = `<small class="text-muted d-block"><i class="fa-solid fa-star me-1 text-warning"></i>${r.designation || 'Managing Executive'}</small>`;
    } else if (r.role === 'Admin') {
      detailLine = `<small class="text-muted d-block"><i class="fa-solid fa-shield-halved me-1 text-danger"></i>${r.designation || 'Society Secretary'}</small>`;
    }

    return `
    <tr>
      <td>
        <div class="d-flex align-items-center gap-3">
          <img src="${avatarUrl}" class="rounded-circle border border-2" width="40" height="40" alt="${r.name}" 
               style="object-fit:cover; flex-shrink:0;">
          <div>
            <div class="fw-bold text-heading">${r.name}</div>
            ${detailLine}
          </div>
        </div>
      </td>
      <td>
        <span class="badge bg-secondary bg-opacity-15 text-heading border" style="font-size:12px; padding:5px 10px;">
          <i class="fa-solid fa-building me-1"></i>${r.flat || r.gateAssigned || '—'}
        </span>
      </td>
      <td class="text-muted" style="font-size:13px; max-width:200px;">
        <a href="mailto:${r.email}" class="text-muted text-decoration-none">${r.email || '—'}</a>
      </td>
      <td style="font-size:13px;">
        ${r.phone ? `<a href="tel:${r.phone}" class="text-decoration-none text-heading">${r.phone}</a>` : '<span class="text-muted">—</span>'}
      </td>
      <td>
        <span class="badge ${badgeCls} px-3 py-1 rounded-pill">${r.role}</span>
      </td>
      <td>
        <span class="badge ${r.status === 'Approved' ? 'bg-success' : r.status === 'Pending' ? 'bg-warning text-dark' : 'bg-danger'} bg-opacity-15 
              text-${r.status === 'Approved' ? 'success' : r.status === 'Pending' ? 'warning' : 'danger'} border 
              border-${r.status === 'Approved' ? 'success' : r.status === 'Pending' ? 'warning' : 'danger'} border-opacity-25">
          ${r.status || 'Approved'}
        </span>
      </td>
      <td class="text-end">
        <div class="d-flex gap-1 justify-content-end">
          <button class="btn btn-sm btn-outline-info rounded-pill px-2" 
            onclick="openAllocateModal('${r.id}','${r.name.replace(/'/g,"\\'")}','${r.email || ''}','${r.role}','${r.flat||''}')" 
            title="Allot Flat / Update Details">
            <i class="fa-solid fa-building-circle-check"></i>
          </button>
          <button class="btn btn-sm btn-outline-primary rounded-pill px-2"
            onclick="openChangeRoleModal('${r.id}','${r.name.replace(/'/g,"\\'")}','${r.role}')"
            title="Change Role">
            <i class="fa-solid fa-user-gear"></i>
          </button>
          ${r.role !== 'Admin' ? `
          <button class="btn btn-sm btn-outline-danger rounded-pill px-2" 
            onclick="deleteRes('${r.id}')" title="Remove Member">
            <i class="fa-solid fa-trash-can"></i>
          </button>` : '<span class="text-muted small px-2">Secretary</span>'}
        </div>
      </td>
    </tr>`;
  }).join('');

  if (allUsers.length === 1 && allUsers[0].role === 'Admin') {
    rowsHtml += `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted" style="background: rgba(255, 255, 255, 0.015);">
          <i class="fa-solid fa-user-plus me-1 text-primary"></i> No additional residents yet. Share code <strong class="text-warning font-monospace">${socCode}</strong> with residents or click <strong>Add Resident</strong> above to register flats.
        </td>
      </tr>`;
  }

  tbody.innerHTML = rowsHtml;
}

function deleteRes(id) {
  if (confirm("Are you sure you want to remove this resident?")) {
    SystemDB.deleteResident(id);
    loadAdminDashboard();
  }
}

function renderComplaintsTable() {
  const tbody = document.getElementById('adminComplaintsTableBody');
  if (!tbody) return;
  const complaints = SystemDB.getComplaints();

  if (!complaints || complaints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <i class="fa-regular fa-circle-check fs-2 text-success d-block mb-2 opacity-75"></i>
          <div class="fw-semibold text-white fs-7">No complaints registered</div>
          <small class="text-muted">Complaints submitted by residents will appear here for assignment and tracking.</small>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = complaints.map(c => `
    <tr>
      <td class="fw-bold fs-7">${c.id}</td>
      <td>
        <div class="fw-semibold">${c.residentName}</div>
        <small class="text-muted">Flat: ${c.flat}</small>
      </td>
      <td>
        <div class="fw-semibold">${c.title}</div>
        <small class="badge bg-light text-secondary border me-1">${c.category}</small>
        <small class="text-muted d-block mt-1">${c.description}</small>
      </td>
      <td>
        <span class="badge ${c.priority === 'High' ? 'bg-danger text-white' : 'bg-secondary-subtle text-dark'}">${c.priority}</span>
      </td>
      <td>
        <span class="${c.status === 'Pending' ? 'badge-pending' : c.status === 'In Progress' ? 'badge-progress' : 'badge-resolved'}">
          ${c.status}
        </span>
      </td>
      <td class="text-muted fs-7">${c.date}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="openUpdateCmpModal('${c.id}', '${c.title.replace(/'/g, "\\'")}', '${c.status}', '${(c.notes||'').replace(/'/g, "\\'")}')">
          <i class="fa-solid fa-pen-to-square me-1"></i> Update
        </button>
      </td>
    </tr>
  `).join('');
}

function openUpdateCmpModal(id, title, status, notes) {
  document.getElementById('editCmpId').value = id;
  document.getElementById('editCmpTitle').value = `${id}: ${title}`;
  document.getElementById('editCmpStatus').value = status;
  document.getElementById('editCmpNotes').value = notes;
  new bootstrap.Modal(document.getElementById('updateComplaintModal')).show();
}

function renderBillingTable() {
  const tbody = document.getElementById('adminBillingTableBody');
  if (!tbody) return;
  const maintenance = SystemDB.getMaintenance();

  if (!maintenance || maintenance.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <i class="fa-solid fa-file-invoice-dollar fs-2 text-primary d-block mb-2 opacity-75"></i>
          <div class="fw-semibold text-white fs-7">No maintenance bills generated yet</div>
          <small class="text-muted">Click "Generate Monthly Bills" to issue maintenance dues for registered flats.</small>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = maintenance.map(m => `
    <tr>
      <td class="fw-bold fs-7">${m.id}</td>
      <td>
        <div class="fw-semibold">${m.residentName}</div>
        <small class="text-muted">${m.flat}</small>
      </td>
      <td>${m.month}</td>
      <td class="fw-bold">₹${Number(m.amount || 0).toLocaleString()}</td>
      <td>
        <span class="${m.status === 'Paid' ? 'badge-paid' : 'badge-unpaid'}">${m.status}</span>
      </td>
      <td class="text-muted fs-7">${m.paymentDate || '--'}</td>
      <td class="fs-7 text-primary">${m.receiptNo || '--'}</td>
    </tr>
  `).join('');
}

function renderNotices() {
  const container = document.getElementById('adminNoticesContainer');
  if (!container) return;
  const notices = SystemDB.getNotices();

  if (!notices || notices.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="p-4 rounded-4" style="background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.12);">
          <i class="fa-regular fa-bell-slash fs-2 text-muted d-block mb-2 opacity-50"></i>
          <div class="fw-semibold text-white fs-7">No announcements posted</div>
          <small class="text-muted d-block mb-3">Publish notices to broadcast announcements, maintenance updates, and meetings.</small>
          <button class="btn btn-sm btn-gold rounded-pill px-3" data-bs-toggle="modal" data-bs-target="#addNoticeModal">
            <i class="fa-solid fa-plus me-1"></i> Post Announcement
          </button>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = notices.map(n => `
    <div class="col-md-6">
      <div class="card border-0 shadow-sm rounded-4 p-4 h-100 position-relative">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="badge ${n.category === 'Emergency' ? 'bg-danger' : n.category === 'Meeting' ? 'bg-warning text-dark' : 'bg-primary'} px-3 py-2">
            ${n.category}
          </span>
          <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteNoticeItem('${n.id}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <h5 class="fw-bold text-dark mb-2">${n.title}</h5>
        <p class="text-muted fs-7 flex-grow-1">${n.content}</p>
        <div class="d-flex align-items-center justify-content-between pt-3 border-top mt-auto fs-8 text-muted">
          <span><i class="fa-solid fa-user me-1"></i> Posted by ${n.postedBy || 'Admin'}</span>
          <span><i class="fa-solid fa-calendar me-1"></i> ${n.date}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function deleteNoticeItem(id) {
  if (confirm("Delete this notice announcement?")) {
    SystemDB.deleteNotice(id);
    loadAdminDashboard();
  }
}

function renderVisitorsTable() {
  const tbody = document.getElementById('adminVisitorsTableBody');
  if (!tbody) return;
  const visitors = SystemDB.getVisitors();

  if (!visitors || visitors.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <i class="fa-solid fa-id-badge fs-2 text-warning d-block mb-2 opacity-75"></i>
          <div class="fw-semibold text-white fs-7">No gate entries logged today</div>
          <small class="text-muted">Visitor, delivery, and cab entries verified by the guard desk will appear here.</small>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = visitors.map(v => `
    <tr>
      <td><span class="badge bg-secondary text-white font-monospace">${v.gatePassCode || '—'}</span></td>
      <td>
        <div class="fw-semibold">${v.name}</div>
        <small class="text-muted">${v.phone || '—'}</small>
      </td>
      <td><span class="badge bg-light text-dark border">${v.flat || '—'}</span></td>
      <td class="fs-7">${v.purpose || 'Visit'}</td>
      <td class="fs-7 text-muted">${v.entryTime || '--'}</td>
      <td class="fs-7 text-muted">${v.exitTime || '--'}</td>
      <td>
        <span class="badge ${v.status === 'Approved' ? 'bg-success' : v.status === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark'}">
          ${v.status}
        </span>
      </td>
    </tr>
  `).join('');
}

function renderRoleSettingsTable() {
  const tbody = document.getElementById('roleSettingsTableBody');

  syncCommitteeModuleUI();

  if (!tbody) return;

  const isCommActive = (window.SystemDB && typeof SystemDB.isCommitteeEnabled === 'function')
    ? SystemDB.isCommitteeEnabled()
    : true;

  const roleOrder = { 'Admin': 0, 'Committee Member': 1, 'Resident': 2, 'Security Guard': 3 };
  const users = [...(SystemDB.data.users || [])];
  users.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));

  const roleBadge = {
    'Admin': 'bg-danger text-white',
    'Resident': 'bg-primary text-white',
    'Security Guard': 'bg-warning text-dark',
    'Committee Member': 'bg-info text-dark'
  };

  tbody.innerHTML = users.map(u => {
    const avatarUrl = getMemberAvatar(u);
    const badge = roleBadge[u.role] || 'bg-secondary text-white';

    const roleBadgeHtml = (u.role === 'Committee Member' && !isCommActive)
      ? `<span class="badge bg-secondary text-white px-3 py-1 rounded-pill" style="font-size:12px;">Committee Member <span class="badge bg-warning text-dark ms-1" style="font-size:9px;">Panel Paused</span></span>`
      : `<span class="badge ${badge} px-3 py-1 rounded-pill" style="font-size:12px;">${u.role}</span>`;

    const detailInfo = u.role === 'Security Guard'
      ? `<small class="d-block text-muted"><i class="fa-solid fa-clock me-1"></i>${u.shift || 'Morning Shift'}</small>
         <small class="d-block text-muted"><i class="fa-solid fa-door-open me-1"></i>${u.gateAssigned || 'Gate 1'} · ${u.empId || '—'}</small>`
      : u.role === 'Resident'
      ? `<small class="d-block text-muted">${u.residentType || 'Owner'} · ${u.tower || 'Tower A'}
         ${u.familyCount ? `· <i class="fa-solid fa-users"></i> ${u.familyCount}` : ''}</small>
         <small class="d-block text-muted">Move-in: ${u.moveInDate || '—'}</small>`
      : u.role === 'Committee Member'
      ? `<small class="d-block text-muted"><i class="fa-solid fa-star me-1 text-warning"></i>${u.designation || 'Managing Executive'}</small>`
      : `<small class="d-block text-muted"><i class="fa-solid fa-shield-halved me-1 text-danger"></i>${u.designation || 'Super Administrator'}</small>`;

    const duesOrSalary = u.role === 'Security Guard'
      ? `<span class="fw-bold text-success">${u.salary || '₹18,000/month'}</span><small class="d-block text-muted">Monthly Salary</small>`
      : u.role === 'Resident'
      ? `<span class="fw-bold text-warning">${u.maintenanceDues || '₹3,500/month'}</span><small class="d-block text-muted">Maintenance</small>`
      : u.role === 'Committee Member'
      ? `<span class="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25">Society Service</span>`
      : `<span class="badge bg-danger bg-opacity-15 text-danger border border-danger border-opacity-25">Full Access</span>`;

    const flatOrGate = u.flat || u.gateAssigned || '—';
    const parking = u.parkingSlot || (u.role === 'Security Guard' ? u.gateAssigned : '—');

    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-3">
            <img src="${avatarUrl}" class="rounded-circle border border-2" width="42" height="42" alt="${u.name}" style="object-fit:cover;flex-shrink:0;">
            <div>
              <div class="fw-bold text-heading">${u.name}</div>
              <small class="text-muted d-block" style="font-size:12px;">${u.email}</small>
              ${u.phone ? `<small class="text-muted" style="font-size:11px;"><i class="fa-solid fa-phone me-1"></i>${u.phone}</small>` : ''}
            </div>
          </div>
        </td>
        <td>${roleBadgeHtml}</td>
        <td>
          <span class="badge bg-secondary bg-opacity-15 text-heading border" style="font-size:12px; padding:5px 10px;">
            <i class="fa-solid fa-building me-1"></i>${flatOrGate}
          </span>
          ${u.tower ? `<small class="d-block text-muted mt-1">${u.tower}</small>` : ''}
        </td>
        <td>${detailInfo}</td>
        <td>${duesOrSalary}</td>
        <td>
          <span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">
            ${parking}
          </span>
        </td>
        <td class="text-end">
          <div class="d-flex gap-1 justify-content-end flex-wrap">
            <button class="btn btn-sm ${u.role === 'Admin' ? 'btn-outline-danger' : 'btn-outline-success'} rounded-pill"
              onclick="toggleAdminRole('${u.id}', '${u.role}')"
              title="${u.role === 'Admin' ? 'Revoke Admin' : 'Grant Admin'}">
              <i class="fa-solid ${u.role === 'Admin' ? 'fa-user-minus' : 'fa-user-shield'} me-1"></i>
              ${u.role === 'Admin' ? 'Revoke' : 'Grant Admin'}
            </button>
            <button class="btn btn-sm btn-outline-primary rounded-pill"
              onclick="openChangeRoleModal('${u.id}', '${u.name.replace(/'/g,"\\'")}', '${u.role}')"
              title="Change Role">
              <i class="fa-solid fa-pen-to-square me-1"></i> Role
            </button>
            <button class="btn btn-sm btn-outline-info rounded-pill"
              onclick="openAllocateModal('${u.id}', '${u.name.replace(/'/g,"\\'")}', '${u.email}', '${u.role}', '${u.flat || ''}')"
              title="Allot Flat & Dues">
              <i class="fa-solid fa-building-circle-check me-1"></i> Allot
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function syncCommitteeModuleUI() {
  const isEnabled = (window.SystemDB && typeof SystemDB.isCommitteeEnabled === 'function')
    ? SystemDB.isCommitteeEnabled()
    : true;

  const toggle = document.getElementById('toggleCommitteeModule');
  const label = document.getElementById('toggleCommitteeModuleLabel');
  const badge = document.getElementById('commModuleStatusBadge');
  const desc = document.getElementById('committeeModuleDesc');
  const countEl = document.getElementById('activeCommitteeCount');

  if (toggle) toggle.checked = isEnabled;
  if (label) label.textContent = isEnabled ? 'Committee Panel Active' : 'Committee Panel Disabled';
  if (badge) {
    if (isEnabled) {
      badge.className = 'badge bg-success bg-opacity-20 text-success border border-success border-opacity-30 rounded-pill px-2.5 py-1 fs-9 fw-bold';
      badge.textContent = 'Active & Enabled';
    } else {
      badge.className = 'badge bg-secondary bg-opacity-25 text-warning border border-warning border-opacity-30 rounded-pill px-2.5 py-1 fs-9 fw-bold';
      badge.textContent = 'Disabled by Secretary';
    }
  }
  if (desc) {
    desc.innerHTML = isEnabled
      ? 'Committee oversight panel (<code>committee.html</code>) is live for elected governance members, treasurers and auditors.'
      : 'Committee oversight panel (<code>committee.html</code>) is disabled. Society operates in direct Secretary / Admin mode.';
  }

  const users = (SystemDB.data && SystemDB.data.users) || [];
  const commCount = users.filter(u => u.role === 'Committee Member').length;
  if (countEl) countEl.textContent = commCount;
}

function handleCommitteeModuleToggle(enabled) {
  if (window.SystemDB && typeof SystemDB.setCommitteeEnabled === 'function') {
    SystemDB.setCommitteeEnabled(enabled);
  }
  syncCommitteeModuleUI();
  renderRoleSettingsTable();

  if (typeof showToast === 'function') {
    showToast(
      enabled
        ? 'Committee Governance Panel enabled! Committee Members can now access committee.html.'
        : 'Committee Governance Panel disabled. Access to committee.html is now restricted.',
      enabled ? 'success' : 'info'
    );
  }
}

function toggleAdminRole(userId, currentRole) {
  const newRole = currentRole === 'Admin' ? 'Resident' : 'Admin';
  if (confirm(`Are you sure you want to ${newRole === 'Admin' ? 'Grant Admin Rights to' : 'Remove Admin Rights from'} this user?`)) {
    SystemDB.updateUserRole(userId, newRole);
    loadAdminDashboard();
  }
}

function openChangeRoleModal(id, name, role) {
  document.getElementById('roleUserId').value = id;
  document.getElementById('roleUserName').value = name;
  document.getElementById('roleSelect').value = role;

  const isCommEnabled = (window.SystemDB && typeof SystemDB.isCommitteeEnabled === 'function')
    ? SystemDB.isCommitteeEnabled()
    : true;
  const commOpt = document.getElementById('optRoleCommittee');
  const alertEl = document.getElementById('roleCommitteeDisabledAlert');

  if (commOpt) {
    if (isCommEnabled) {
      commOpt.disabled = false;
      commOpt.textContent = 'Committee Member';
    } else {
      commOpt.disabled = true;
      commOpt.textContent = 'Committee Member (Disabled in Settings)';
    }
  }

  if (alertEl) {
    if (!isCommEnabled && role === 'Committee Member') {
      alertEl.classList.remove('d-none');
    } else {
      alertEl.classList.add('d-none');
    }
  }

  new bootstrap.Modal(document.getElementById('changeRoleModal')).show();
}

function logout() {
  SystemDB.logout();
  window.location.href = 'index.html';
}

// ─── Member Approval Center ─────────────────────────────────────

async function loadPendingApprovals() {
  const token = SystemDB.getToken();
  if (!token) return;

  try {
    const res = await fetch('/api/auth/pending', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.success) {
      renderPendingResidents(data.users.filter(u => u.role === 'Resident'));
      renderPendingGuards(data.users.filter(u => u.role === 'Security Guard'));

      // Update badge
      const badge = document.getElementById('pendingCountBadge');
      if (badge) {
        const count = data.users.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
      }
    }
  } catch (err) {
    console.error('Failed to load pending approvals:', err);
  }

  // Also load all members
  loadAllMembers();
}

function renderPendingResidents(users) {
  const tbody = document.getElementById('pendingResidentsBody');
  const empty = document.getElementById('noPendingResidents');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div class="d-flex align-items-center gap-2">
          <img src="${u.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + u.name}" class="rounded-circle" width="36" height="36">
          <div>
            <div class="fw-semibold">${u.name}</div>
            <small class="text-muted">${u.email}</small>
          </div>
        </div>
      </td>
      <td class="fs-7">${u.phone || '--'}</td>
      <td class="fs-7 text-muted">${u.registeredAt || '--'}</td>
      <td>
        ${u.aadhaar ? `<span class="badge bg-light text-dark border"><i class="fa-solid fa-id-card me-1"></i>${u.aadhaar}</span>` : '<span class="text-muted">None</span>'}
        ${u.familyMembers ? `<br><small class="text-muted">Family: ${u.familyMembers}</small>` : ''}
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-success rounded-pill px-3 me-1" onclick="openApproveModal('${u.id}', '${u.name.replace(/'/g, "\\'")}', '${u.email}', '${u.role}', '${u.avatar || ''}')">
          <i class="fa-solid fa-check me-1"></i> Approve
        </button>
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="openRejectModal('${u.id}', '${u.name.replace(/'/g, "\\'")}')">
          <i class="fa-solid fa-xmark me-1"></i> Reject
        </button>
      </td>
    </tr>
  `).join('');
}

function renderPendingGuards(users) {
  const tbody = document.getElementById('pendingGuardsBody');
  const empty = document.getElementById('noPendingGuards');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div class="d-flex align-items-center gap-2">
          <img src="${u.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + u.name}" class="rounded-circle" width="36" height="36">
          <div>
            <div class="fw-semibold">${u.name}</div>
            <small class="text-muted">${u.email}</small>
          </div>
        </div>
      </td>
      <td class="fs-7">${u.phone || '--'}</td>
      <td class="fs-7">${u.employeeId || '--'}</td>
      <td class="fs-7 text-muted">${u.registeredAt || '--'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-success rounded-pill px-3 me-1" onclick="openApproveModal('${u.id}', '${u.name.replace(/'/g, "\\'")}', '${u.email}', '${u.role}', '${u.avatar || ''}')">
          <i class="fa-solid fa-check me-1"></i> Approve
        </button>
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="openRejectModal('${u.id}', '${u.name.replace(/'/g, "\\'")}')">
          <i class="fa-solid fa-xmark me-1"></i> Reject
        </button>
      </td>
    </tr>
  `).join('');
}

function openApproveModal(userId, name, email, role, avatar) {
  document.getElementById('approveUserId').value = userId;
  document.getElementById('approveUserName').textContent = name;
  document.getElementById('approveUserEmail').textContent = email;
  document.getElementById('approveUserRole').textContent = role;
  document.getElementById('approveUserAvatar').src = avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + name;

  // Show/hide role-specific fields
  const isGuard = role === 'Security Guard';
  document.getElementById('residentAssignmentFields').classList.toggle('d-none', isGuard);
  document.getElementById('guardAssignmentFields').classList.toggle('d-none', !isGuard);

  new bootstrap.Modal(document.getElementById('approveMemberModal')).show();
}

function openRejectModal(userId, name) {
  document.getElementById('rejectUserId').value = userId;
  document.getElementById('rejectReason').value = '';
  new bootstrap.Modal(document.getElementById('rejectMemberModal')).show();
}

// Approve form handler
const approveMemberFormEl = document.getElementById('approveMemberForm');
if (approveMemberFormEl) {
  approveMemberFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = SystemDB.getToken();
    const userId = document.getElementById('approveUserId').value;
    const isGuard = document.getElementById('approveUserRole').textContent === 'Security Guard';

    const body = { userId };
    if (isGuard) {
      body.guardId = document.getElementById('approveGuardId').value;
      body.gateAssignment = document.getElementById('approveGate').value;
      body.shift = document.getElementById('approveShift').value;
      body.salary = document.getElementById('approveSalary').value;
      body.joiningDate = document.getElementById('approveJoiningDate').value;
    } else {
      body.tower = document.getElementById('approveTower').value;
      body.floor = document.getElementById('approveFloor').value;
      body.flat = document.getElementById('approveFlat').value;
      body.residentType = document.getElementById('approveResidentType').value;
      body.moveInDate = document.getElementById('approveMoveInDate').value;
      body.parkingSlot = document.getElementById('approveParking').value;
      body.rent = document.getElementById('approveRent').value;
      body.maintenanceAmount = document.getElementById('approveMaintenance').value;
      body.emergencyContact = document.getElementById('approveEmergency').value;
      body.vehicleNumbers = document.getElementById('approveVehicles').value;
      body.waterMeter = document.getElementById('approveWaterMeter').value;
      body.electricMeter = document.getElementById('approveElectricMeter').value;
    }
    body.notes = document.getElementById('approveNotes').value;

    try {
      const res = await fetch('/api/auth/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        bootstrap.Modal.getInstance(document.getElementById('approveMemberModal')).hide();
        alert('Member approved successfully!');
        loadPendingApprovals();
        loadAdminDashboard();
      } else {
        alert('Error: ' + data.message);
      }
    } catch (err) {
      alert('Server error. Please try again.');
    }
  });
}

// Reject form handler
const rejectMemberFormEl = document.getElementById('rejectMemberForm');
if (rejectMemberFormEl) {
  rejectMemberFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = SystemDB.getToken();
    const userId = document.getElementById('rejectUserId').value;
    const reason = document.getElementById('rejectReason').value;

    try {
      const res = await fetch('/api/auth/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ userId, reason }),
      });
      const data = await res.json();
      if (data.success) {
        bootstrap.Modal.getInstance(document.getElementById('rejectMemberModal')).hide();
        alert('Member registration rejected.');
        loadPendingApprovals();
      } else {
        alert('Error: ' + data.message);
      }
    } catch (err) {
      alert('Server error. Please try again.');
    }
  });
}

// Load all members
async function loadAllMembers() {
  const token = SystemDB.getToken();
  if (!token) return;

  try {
    const res = await fetch('/api/auth/all', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.success) {
      renderAllMembers(data.users);
    }
  } catch (err) {
    console.error('Failed to load all members:', err);
  }
}

function getMemberAvatar(user) {
  if (user.avatar && (user.avatar.includes('gender=male') || user.avatar.includes('gender=female'))) {
    return user.avatar;
  }
  const name = user.name || '';
  const isFemale = /(Priya|Neha|Kavya|Ananya|Sneha|Pooja|Ritu|Anita|Sunita|Simran|Aarti|Mrs|Ms|Girl|Female)/i.test(name);
  const gender = isFemale ? 'female' : 'male';
  const seed = name.split(' ')[0] || 'User';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&gender=${gender}`;
}

function renderAllMembers(users) {
  const tbody = document.getElementById('allMembersBody');
  if (!tbody) return;

  tbody.innerHTML = users.map(u => {
    const statusBadge = u.status === 'Approved' ? 'bg-success' :
                        u.status === 'Pending' ? 'bg-warning text-dark' :
                        u.status === 'Rejected' ? 'bg-danger' : 'bg-secondary';
    const avatarUrl = getMemberAvatar(u);
    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-2">
            <img src="${avatarUrl}" class="rounded-circle border" width="36" height="36" alt="${u.name}">
            <div>
              <div class="fw-semibold text-heading">${u.name}</div>
              <small class="text-muted">${u.email}</small>
            </div>
          </div>
        </td>
        <td><span class="badge ${u.role === 'Admin' ? 'bg-danger' : u.role === 'Resident' ? 'bg-primary' : u.role === 'Security Guard' ? 'bg-warning text-dark' : 'bg-info'}">${u.role}</span></td>
        <td class="fs-7">${u.flat || '--'}</td>
        <td><span class="badge ${statusBadge}">${u.status || 'Approved'}</span></td>
        <td class="fs-7 text-muted">${u.registeredAt || '--'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-info border-0 rounded-pill px-2" onclick="openAllocateModal('${u.id}', '${u.name.replace(/'/g, "\\'")}', '${u.email}', '${u.role}', '${u.flat || ''}')" title="Allot Flat Details">
            <i class="fa-solid fa-building-circle-check"></i>
          </button>
          <button class="btn btn-sm btn-outline-primary border-0 rounded-pill px-2" onclick="viewMemberDetails('${u.id}', '${u.name.replace(/'/g, "\\'")}', '${u.email}', '${u.role}', '${u.flat || ''}', '${u.phone || ''}', '${u.status || 'Approved'}', '${u.registeredAt || ''}', '${u.approvedAt || ''}')" title="View Details">
            <i class="fa-solid fa-eye"></i>
          </button>
          ${u.status === 'Pending' ? `
            <button class="btn btn-sm btn-outline-success border-0 rounded-pill px-2" onclick="openApproveModal('${u.id}', '${u.name.replace(/'/g, "\\'")}', '${u.email}', '${u.role}', '${u.avatar || ''}')" title="Approve">
              <i class="fa-solid fa-check"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger border-0 rounded-pill px-2" onclick="openRejectModal('${u.id}', '${u.name.replace(/'/g, "\\'")}')" title="Reject">
              <i class="fa-solid fa-xmark"></i>
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function openAllocateModal(userId, name, email, role, flat) {
  document.getElementById('allocUserId').value = userId;
  document.getElementById('allocUserName').value = `${name} (${email})`;
  document.getElementById('allocRole').value = role || 'Resident';
  document.getElementById('allocFlat').value = flat || '';
  document.getElementById('allocTower').value = 'Tower A';
  document.getElementById('allocFloor').value = '3rd Floor';
  document.getElementById('allocMaintenance').value = 3500;
  document.getElementById('allocParking').value = 'P-' + Math.floor(10 + Math.random() * 80);

  const modalEl = document.getElementById('allocateFlatModal');
  if (modalEl) {
    new bootstrap.Modal(modalEl).show();
  }
}

// Allocate Flat Form Submit
const allocForm = document.getElementById('allocateFlatForm');
if (allocForm) {
  allocForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userId = document.getElementById('allocUserId').value;
    const allocData = {
      role: document.getElementById('allocRole').value,
      tower: document.getElementById('allocTower').value,
      floor: document.getElementById('allocFloor').value,
      flat: document.getElementById('allocFlat').value,
      type: document.getElementById('allocType').value,
      maintenance: document.getElementById('allocMaintenance').value,
      parking: document.getElementById('allocParking').value
    };

    SystemDB.updateUserAllocation(userId, allocData);
    const modalEl = document.getElementById('allocateFlatModal');
    if (modalEl && bootstrap.Modal.getInstance(modalEl)) {
      bootstrap.Modal.getInstance(modalEl).hide();
    }
    alert(`Flat ${allocData.flat} allotted to user and account approved successfully!`);
    loadAdminDashboard();
    loadAllMembers();
  });
}

function viewMemberDetails(id, name, email, role, flat, phone, status, registeredAt, approvedAt) {
  const body = document.getElementById('memberDetailsBody');
  body.innerHTML = `
    <div class="row g-3">
      <div class="col-6"><strong>Name:</strong> ${name}</div>
      <div class="col-6"><strong>Email:</strong> ${email}</div>
      <div class="col-6"><strong>Role:</strong> ${role}</div>
      <div class="col-6"><strong>Status:</strong> <span class="badge ${status === 'Approved' ? 'bg-success' : status === 'Pending' ? 'bg-warning text-dark' : 'bg-danger'}">${status}</span></div>
      <div class="col-6"><strong>Flat/Gate:</strong> ${flat || 'Not assigned'}</div>
      <div class="col-6"><strong>Phone:</strong> ${phone || '--'}</div>
      <div class="col-6"><strong>Registered:</strong> ${registeredAt || '--'}</div>
      <div class="col-6"><strong>Approved:</strong> ${approvedAt || '--'}</div>
    </div>
  `;
  new bootstrap.Modal(document.getElementById('memberDetailsModal')).show();
}

function renderAuditLogs() {
  const tbody = document.getElementById('auditLogsTableBody');
  if (!tbody) return;
  const logs = SystemDB.getAuditLogs();

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <i class="fa-solid fa-list-check fs-3 d-block mb-2 opacity-50"></i>
          <div class="fw-semibold text-white fs-7">No audit records yet</div>
          <small class="text-muted">Administrative actions, role updates, and bill payments will be logged here.</small>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => `
    <tr>
      <td class="fw-bold fs-7 font-monospace">${l.id}</td>
      <td class="fs-7 text-muted">${l.timestamp}</td>
      <td>
        <div class="fw-semibold text-heading">${l.user}</div>
        <small class="badge bg-secondary bg-opacity-25 text-heading border" style="font-size:10px;">${l.role}</small>
      </td>
      <td><span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25">${l.action}</span></td>
      <td><span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25">${l.module}</span></td>
      <td class="fs-7 text-secondary">${l.details}</td>
    </tr>
  `).join('');
}

function exportAuditLogsCSV() {
  const logs = SystemDB.getAuditLogs();
  if (!logs || !logs.length) {
    if (typeof showToast === 'function') showToast("No audit logs available for export.", "warning");
    return;
  }
  SystemDB.exportToCSV('SocietyHub_AuditLogs_' + new Date().toISOString().slice(0,10) + '.csv', logs);
  if (typeof showToast === 'function') showToast("Audit logs exported to CSV successfully!", "success");
}

// ══════════════════════════════════════════════════════════════════════════════
// TOWERS & FLATS INTERACTIVE MANAGER LOGIC
// ══════════════════════════════════════════════════════════════════════════════
let activeTowerFilter = 'ALL';
let currentFlatsView = 'grid';

function renderTowersAndFlats() {
  const flatsContainer = document.getElementById('tab-towers');
  if (!flatsContainer) return;

  const towers = (typeof SystemDB.getTowers === 'function') ? SystemDB.getTowers() : [
    { name: 'Tower A', wing: 'Sunrise Wing', prefix: 'A', totalFlats: 20 },
    { name: 'Tower B', wing: 'Meadows Wing', prefix: 'B', totalFlats: 20 },
    { name: 'Tower C', wing: 'Greenview Wing', prefix: 'C', totalFlats: 20 }
  ];
  const flats = (typeof SystemDB.getFlats === 'function') ? SystemDB.getFlats() : [];

  // Calculate Metrics
  const totalUnits = flats.length;
  const occupiedUnits = flats.filter(f => f.status === 'Occupied').length;
  const vacantUnits = flats.filter(f => f.status === 'Vacant').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const ownerCount = flats.filter(f => f.status === 'Occupied' && (f.occupantType === 'Owner' || !f.occupantType)).length;
  const tenantCount = flats.filter(f => f.status === 'Occupied' && f.occupantType === 'Tenant').length;

  // Render KPIs
  const totalEl = document.getElementById('kpiTotalFlats');
  if (totalEl) totalEl.textContent = totalUnits;

  const towersCountEl = document.getElementById('kpiTowersCount');
  if (towersCountEl) towersCountEl.textContent = `${towers.length} Wings / Towers`;

  const occEl = document.getElementById('kpiOccupiedFlats');
  if (occEl) occEl.textContent = occupiedUnits;

  const occRateEl = document.getElementById('kpiOccupancyRate');
  if (occRateEl) occRateEl.textContent = `${occupancyRate}% Occupancy`;

  const vacEl = document.getElementById('kpiVacantFlats');
  if (vacEl) vacEl.textContent = vacantUnits;

  const splitEl = document.getElementById('kpiTenancySplit');
  if (splitEl) splitEl.textContent = `${ownerCount} / ${tenantCount}`;

  const ownerEl = document.getElementById('kpiOwnerCount');
  if (ownerEl) ownerEl.textContent = ownerCount;

  const tenantEl = document.getElementById('kpiTenantCount');
  if (tenantEl) tenantEl.textContent = tenantCount;

  // Populate Tower Filter Dropdown
  const towerSelect = document.getElementById('flatTowerFilterSelect');
  if (towerSelect) {
    const prevVal = towerSelect.value;
    towerSelect.innerHTML = '<option value="ALL">All Towers / Wings</option>' +
      towers.map(t => `<option value="${t.name}">${t.name} (${t.wing || 'Wing'})</option>`).join('');
    if (prevVal) towerSelect.value = prevVal;
  }

  // Render Tower Summary Selector Cards
  renderTowerSummaryCards(towers, flats);

  // Render Views (Grid and Table)
  filterFlats();
}

function renderTowerSummaryCards(towers, flats) {
  const container = document.getElementById('towersSummaryCards');
  if (!container) return;

  const totalUnits = flats.length;
  const occupiedTotal = flats.filter(f => f.status === 'Occupied').length;
  const vacantTotal = flats.filter(f => f.status === 'Vacant').length;
  const totalRate = totalUnits > 0 ? Math.round((occupiedTotal / totalUnits) * 100) : 0;

  let html = `
    <div class="col-lg-3 col-md-6">
      <div class="tower-filter-card ${activeTowerFilter === 'ALL' ? 'active' : ''}" onclick="selectTowerFilter('ALL')">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <div class="fw-bold text-white fs-6">
            <i class="fa-solid fa-city text-primary me-2"></i>All Wings
          </div>
          <span class="badge ${activeTowerFilter === 'ALL' ? 'bg-primary' : 'bg-secondary bg-opacity-25 text-secondary'} fs-9">
            ${activeTowerFilter === 'ALL' ? 'Selected' : 'View All'}
          </span>
        </div>
        <div class="text-secondary fs-8 mb-2">${totalUnits} Total Units • ${occupiedTotal} Occupied • ${vacantTotal} Vacant</div>
        <div class="progress rounded-pill" style="height: 6px; background: rgba(255,255,255,0.08);">
          <div class="progress-bar bg-primary" role="progressbar" style="width: ${totalRate}%;"></div>
        </div>
      </div>
    </div>
  `;

  towers.forEach(t => {
    const towerFlats = flats.filter(f => f.tower === t.name || (f.tower && f.tower.startsWith(t.name)) || (t.name && t.name.startsWith(f.tower)));
    const count = towerFlats.length;
    const occ = towerFlats.filter(f => f.status === 'Occupied').length;
    const vac = towerFlats.filter(f => f.status === 'Vacant').length;
    const rate = count > 0 ? Math.round((occ / count) * 100) : 0;
    const isSelected = activeTowerFilter === t.name;

    html += `
      <div class="col-lg-3 col-md-6">
        <div class="tower-filter-card ${isSelected ? 'active' : ''}" onclick="selectTowerFilter('${t.name}')">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="fw-bold text-white fs-6">
              <i class="fa-solid fa-building text-info me-2"></i>${t.name}
            </div>
            <span class="badge ${isSelected ? 'bg-primary' : 'bg-secondary bg-opacity-25 text-secondary'} fs-9">
              ${isSelected ? 'Selected' : (rate + '%')}
            </span>
          </div>
          <div class="text-secondary fs-8 mb-2">${t.wing || 'Wing'} • ${count} Flats (${occ} Occ. • ${vac} Vac.)</div>
          <div class="progress rounded-pill" style="height: 6px; background: rgba(255,255,255,0.08);">
            <div class="progress-bar ${rate > 80 ? 'bg-success' : rate > 50 ? 'bg-info' : 'bg-warning'}" role="progressbar" style="width: ${rate}%;"></div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function selectTowerFilter(towerName) {
  activeTowerFilter = towerName;
  const selectEl = document.getElementById('flatTowerFilterSelect');
  if (selectEl) selectEl.value = towerName;
  const towers = (typeof SystemDB.getTowers === 'function') ? SystemDB.getTowers() : [];
  const flats = (typeof SystemDB.getFlats === 'function') ? SystemDB.getFlats() : [];
  renderTowerSummaryCards(towers, flats);
  filterFlats();
}

function filterFlats() {
  const query = (document.getElementById('flatSearchInput')?.value || '').trim().toLowerCase();
  const towerSelect = document.getElementById('flatTowerFilterSelect')?.value || activeTowerFilter;
  const statusFilter = document.getElementById('flatStatusFilterSelect')?.value || 'ALL';
  const floorFilter = document.getElementById('flatFloorFilterSelect')?.value || 'ALL';

  activeTowerFilter = towerSelect;

  let flats = (typeof SystemDB.getFlats === 'function') ? SystemDB.getFlats() : [];

  if (towerSelect !== 'ALL') {
    flats = flats.filter(f => f.tower === towerSelect || (f.tower && f.tower.startsWith(towerSelect)) || (towerSelect && towerSelect.startsWith(f.tower)));
  }

  if (statusFilter === 'Occupied') {
    flats = flats.filter(f => f.status === 'Occupied');
  } else if (statusFilter === 'Vacant') {
    flats = flats.filter(f => f.status === 'Vacant');
  } else if (statusFilter === 'Owner') {
    flats = flats.filter(f => f.status === 'Occupied' && (f.occupantType === 'Owner' || !f.occupantType));
  } else if (statusFilter === 'Tenant') {
    flats = flats.filter(f => f.status === 'Occupied' && f.occupantType === 'Tenant');
  }

  if (floorFilter !== 'ALL') {
    flats = flats.filter(f => String(f.floor) === String(floorFilter));
  }

  if (query) {
    flats = flats.filter(f =>
      (f.flatNo && f.flatNo.toLowerCase().includes(query)) ||
      (f.occupantName && f.occupantName.toLowerCase().includes(query)) ||
      (f.parkingSlot && f.parkingSlot.toLowerCase().includes(query)) ||
      (f.tower && f.tower.toLowerCase().includes(query)) ||
      (f.bhk && f.bhk.toLowerCase().includes(query))
    );
  }

  renderFloorGridView(flats);
  renderFlatsTableView(flats);
}

function switchFlatsView(mode) {
  currentFlatsView = mode;
  const gridView = document.getElementById('towersFloorGridView');
  const tableView = document.getElementById('towersTableView');
  const btnGrid = document.getElementById('btnViewGrid');
  const btnTable = document.getElementById('btnViewTable');

  if (mode === 'grid') {
    if (gridView) gridView.classList.remove('d-none');
    if (tableView) tableView.classList.add('d-none');
    if (btnGrid) {
      btnGrid.className = 'btn btn-primary';
    }
    if (btnTable) {
      btnTable.className = 'btn btn-outline-secondary';
    }
  } else {
    if (gridView) gridView.classList.add('d-none');
    if (tableView) tableView.classList.remove('d-none');
    if (btnGrid) {
      btnGrid.className = 'btn btn-outline-secondary';
    }
    if (btnTable) {
      btnTable.className = 'btn btn-primary';
    }
  }
}

function renderFloorGridView(flats) {
  const container = document.getElementById('towersFloorGridView');
  if (!container) return;

  if (!flats || flats.length === 0) {
    container.innerHTML = `
      <div class="sa-card p-5 text-center text-secondary">
        <i class="fa-solid fa-building-circle-xmark fs-1 text-muted mb-3 d-block opacity-40"></i>
        <h5 class="fw-bold text-white mb-1">No Flats Matched</h5>
        <p class="fs-7 text-secondary mb-3">No residential units match your current search and filter criteria.</p>
        <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="resetFlatsFilters()">
          <i class="fa-solid fa-filter-circle-xmark me-1"></i> Clear Filters
        </button>
      </div>
    `;
    return;
  }

  // Group flats by floor (descending: 5, 4, 3, 2, 1)
  const floorMap = {};
  flats.forEach(f => {
    let fl = 1;
    if (typeof f.floor === 'number' && !isNaN(f.floor)) {
      fl = f.floor;
    } else if (f.floor) {
      const match = String(f.floor).match(/\d+/);
      fl = match ? parseInt(match[0], 10) : 1;
    } else if (f.floorLabel) {
      const match = String(f.floorLabel).match(/\d+/);
      fl = match ? parseInt(match[0], 10) : 1;
    } else if (f.flatNo) {
      const match = String(f.flatNo).match(/\d+/);
      fl = match ? Math.floor(parseInt(match[0], 10) / 100) : 1;
    }
    if (isNaN(fl) || fl < 1) fl = 1;

    if (!floorMap[fl]) floorMap[fl] = [];
    floorMap[fl].push(f);
  });

  const sortedFloors = Object.keys(floorMap).map(k => parseInt(k, 10)).filter(n => !isNaN(n)).sort((a, b) => b - a);

  let html = '';
  sortedFloors.forEach(floor => {
    const list = floorMap[floor] || [];
    const floorFlats = list.slice().sort((a, b) => {
      const aVal = String(a.flatNo || a.flat || '');
      const bVal = String(b.flatNo || b.flat || '');
      return aVal.localeCompare(bVal);
    });
    const floorLabel = `${floor}${floor === 1 ? 'st' : floor === 2 ? 'nd' : floor === 3 ? 'rd' : 'th'} Floor`;
    const floorOccupied = floorFlats.filter(f => f.status === 'Occupied').length;

    html += `
      <div class="floor-row-wrapper mb-3">
        <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-primary bg-opacity-20 text-info border border-primary border-opacity-30 rounded-pill px-3 py-1 fs-8 fw-bold">
              <i class="fa-solid fa-layer-group me-1"></i> ${floorLabel}
            </span>
            <span class="text-secondary fs-8">${floorFlats.length} Units mapped</span>
          </div>
          <div class="text-secondary fs-8">
            <span class="text-success fw-semibold">${floorOccupied} Occupied</span> • <span class="text-warning fw-semibold">${floorFlats.length - floorOccupied} Vacant</span>
          </div>
        </div>

        <div class="row g-3">
    `;

    floorFlats.forEach(f => {
      const flatNum = f.flatNo || f.flat || 'Unit';
      const isOccupied = f.status === 'Occupied';
      const isOwner = f.occupantType === 'Owner' || !f.occupantType;
      const cardClass = isOccupied ? (isOwner ? 'occupied-owner' : 'occupied-tenant') : 'vacant-unit';
      const statusBadge = isOccupied
        ? `<span class="badge ${isOwner ? 'bg-success bg-opacity-20 text-success border border-success border-opacity-30' : 'bg-purple-500 bg-opacity-20 text-purple border border-purple-500 border-opacity-30'} rounded-pill fs-9 fw-semibold px-2 py-0.5">${isOwner ? 'Owner' : 'Tenant'}</span>`
        : `<span class="badge bg-warning bg-opacity-20 text-warning border border-warning border-opacity-30 rounded-pill fs-9 fw-semibold px-2 py-0.5">Vacant</span>`;

      const avatar = f.occupantAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(f.occupantName || flatNum)}`;

      html += `
        <div class="col-xl-3 col-lg-4 col-md-6">
          <div class="flat-unit-card ${cardClass}" onclick="openFlatDetailsModal('${flatNum}')" title="Click to view details for Flat ${flatNum}">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <div class="d-flex align-items-center gap-2">
                <span class="fw-bold text-white fs-5 font-monospace">${flatNum}</span>
                <span class="badge bg-secondary bg-opacity-25 text-heading border fs-9">${f.bhk || '2 BHK'}</span>
              </div>
              ${statusBadge}
            </div>

            <div class="mb-2">
              ${isOccupied ? `
                <div class="d-flex align-items-center gap-2">
                  <img src="${avatar}" class="rounded-circle border" width="30" height="30" alt="${f.occupantName || 'Resident'}">
                  <div class="text-truncate">
                    <div class="fw-semibold text-white fs-8 text-truncate">${f.occupantName || 'Resident'}</div>
                    <small class="text-secondary fs-9 d-block text-truncate">${f.occupantPhone || f.occupantEmail || 'Active'}</small>
                  </div>
                </div>
              ` : `
                <div class="d-flex align-items-center justify-content-between text-secondary fs-8 py-1">
                  <span><i class="fa-regular fa-circle-check text-muted me-1"></i>Ready for allotment</span>
                  <button class="btn btn-xs btn-outline-warning rounded-pill px-2 py-0.5 fs-9" onclick="event.stopPropagation(); openAllotForFlat('${flatNum}', '${f.tower}', '${f.floor}')">
                    + Allot
                  </button>
                </div>
              `}
            </div>

            <div class="d-flex align-items-center justify-content-between pt-2 border-top border-secondary border-opacity-10 fs-9 text-secondary">
              <span><i class="fa-solid fa-building me-1 opacity-50"></i>${f.tower}</span>
              <span><i class="fa-solid fa-square-parking me-1 opacity-50"></i>${f.parkingSlot || 'N/A'}</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderFlatsTableView(flats) {
  const tbody = document.getElementById('flatsTableBody');
  if (!tbody) return;

  if (!flats || flats.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted">
          <i class="fa-solid fa-building-circle-xmark fs-2 d-block mb-2 opacity-40"></i>
          <span class="fw-semibold text-white fs-7">No units found matching filters</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = flats.map(f => {
    const flatNum = f.flatNo || f.flat || 'Unit';
    const isOccupied = f.status === 'Occupied';
    const isOwner = f.occupantType === 'Owner' || !f.occupantType;
    const statusBadge = isOccupied
      ? `<span class="badge ${isOwner ? 'bg-success' : 'bg-purple-600'} rounded-pill px-2 py-1 fs-9">${isOwner ? 'Occupied (Owner)' : 'Occupied (Tenant)'}</span>`
      : `<span class="badge bg-warning text-dark rounded-pill px-2 py-1 fs-9">Vacant Unit</span>`;

    const avatar = f.occupantAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(f.occupantName || flatNum)}`;

    return `
      <tr>
        <td>
          <span class="fw-bold text-white fs-7 font-monospace">${flatNum}</span>
        </td>
        <td>
          <div class="fw-semibold text-white fs-8">${f.tower}</div>
          <small class="text-muted fs-9">${f.wing || ''}</small>
        </td>
        <td class="fs-8 text-secondary">${f.floorLabel || (f.floor ? (String(f.floor).includes('Floor') ? f.floor : `${f.floor}${f.floor === 1 ? 'st' : f.floor === 2 ? 'nd' : f.floor === 3 ? 'rd' : 'th'} Floor`) : '1st Floor')}</td>
        <td>
          <span class="badge bg-secondary bg-opacity-25 text-heading border fs-9">${f.bhk || '2 BHK'}</span>
          <small class="text-muted fs-9 d-block mt-0.5">${f.areaSqFt ? f.areaSqFt + ' sq.ft' : ''}</small>
        </td>
        <td>
          ${isOccupied ? `
            <div class="d-flex align-items-center gap-2">
              <img src="${avatar}" class="rounded-circle border" width="30" height="30" alt="${f.occupantName || 'Resident'}">
              <div>
                <div class="fw-semibold text-white fs-8">${f.occupantName || 'Resident'}</div>
                <small class="text-muted fs-9">${f.occupantPhone || f.occupantEmail || ''}</small>
              </div>
            </div>
          ` : `
            <span class="text-muted fs-8 fst-italic">Unoccupied</span>
          `}
        </td>
        <td>${statusBadge}</td>
        <td>
          <span class="badge bg-secondary bg-opacity-15 text-heading font-monospace fs-9 border">${f.parkingSlot || 'N/A'}</span>
        </td>
        <td class="fs-8 text-heading font-monospace">₹${(f.maintenanceAmount || 3500).toLocaleString()}/mo</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-info rounded-pill px-2 py-1" onclick="openFlatDetailsModal('${flatNum}')" title="View Flat Details">
            <i class="fa-solid fa-eye"></i> Details
          </button>
          ${!isOccupied ? `
            <button class="btn btn-sm btn-gold rounded-pill px-2 py-1 ms-1" onclick="openAllotForFlat('${flatNum}', '${f.tower}', '${f.floor}')" title="Allot Resident">
              <i class="fa-solid fa-user-plus"></i> Allot
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

function resetFlatsFilters() {
  const searchInput = document.getElementById('flatSearchInput');
  if (searchInput) searchInput.value = '';

  const towerSelect = document.getElementById('flatTowerFilterSelect');
  if (towerSelect) towerSelect.value = 'ALL';

  const statusSelect = document.getElementById('flatStatusFilterSelect');
  if (statusSelect) statusSelect.value = 'ALL';

  const floorSelect = document.getElementById('flatFloorFilterSelect');
  if (floorSelect) floorSelect.value = 'ALL';

  selectTowerFilter('ALL');
}

function openFlatDetailsModal(flatNo) {
  const flats = (typeof SystemDB.getFlats === 'function') ? SystemDB.getFlats() : [];
  const flat = flats.find(f => (f.flatNo || f.flat) === flatNo);
  if (!flat) return;

  const titleEl = document.getElementById('detailModalTitle');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-house-chimney text-info me-2"></i>Flat ${flat.flatNo} — ${flat.tower}`;
  }

  const badgeEl = document.getElementById('detailModalStatusBadge');
  if (badgeEl) {
    badgeEl.className = flat.status === 'Occupied'
      ? (flat.occupantType === 'Owner' || !flat.occupantType ? 'badge bg-success rounded-pill px-3 py-1' : 'badge bg-purple-600 rounded-pill px-3 py-1')
      : 'badge bg-warning text-dark rounded-pill px-3 py-1';
    badgeEl.textContent = flat.status === 'Occupied' ? `Occupied (${flat.occupantType || 'Owner'})` : 'Vacant Unit';
  }

  const bodyEl = document.getElementById('flatDetailsBody');
  if (bodyEl) {
    const isOccupied = flat.status === 'Occupied';
    const avatar = flat.occupantAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(flat.occupantName || flat.flatNo)}`;

    bodyEl.innerHTML = `
      <div class="row g-4">
        <!-- Flat Property Specs -->
        <div class="col-md-6">
          <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
            <div class="text-secondary fs-8 fw-semibold text-uppercase tracking-wider mb-2">Property Specifications</div>
            <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10 fs-8">
              <span class="text-secondary">Unit Number:</span>
              <span class="fw-bold text-white font-monospace">${flat.flatNo}</span>
            </div>
            <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10 fs-8">
              <span class="text-secondary">Wing / Tower:</span>
              <span class="fw-semibold text-white">${flat.tower} (${flat.wing || 'Wing'})</span>
            </div>
            <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10 fs-8">
              <span class="text-secondary">Floor:</span>
              <span class="text-white">${flat.floorLabel || (flat.floor ? (String(flat.floor).includes('Floor') ? flat.floor : `${flat.floor}${flat.floor === 1 ? 'st' : flat.floor === 2 ? 'nd' : flat.floor === 3 ? 'rd' : 'th'} Floor`) : '1st Floor')}</span>
            </div>
            <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10 fs-8">
              <span class="text-secondary">Configuration:</span>
              <span class="badge bg-secondary bg-opacity-25 text-heading border">${flat.bhk || '2 BHK'}</span>
            </div>
            <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10 fs-8">
              <span class="text-secondary">Carpet Area:</span>
              <span class="text-white">${flat.areaSqFt ? flat.areaSqFt + ' sq.ft' : '1,100 sq.ft'}</span>
            </div>
            <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10 fs-8">
              <span class="text-secondary">Allotted Parking:</span>
              <span class="font-monospace text-warning fw-semibold">${flat.parkingSlot || 'Unassigned'}</span>
            </div>
            <div class="d-flex justify-content-between pt-1 fs-8">
              <span class="text-secondary">Standard Maintenance:</span>
              <span class="fw-bold text-success font-monospace">₹${(flat.maintenanceAmount || 3500).toLocaleString()}/month</span>
            </div>
          </div>
        </div>

        <!-- Occupancy & Resident Details -->
        <div class="col-md-6">
          <div class="p-3 rounded-3 h-100" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
            <div class="text-secondary fs-8 fw-semibold text-uppercase tracking-wider mb-2">Occupancy & Resident</div>
            ${isOccupied ? `
              <div class="d-flex align-items-center gap-3 mb-3">
                <img src="${avatar}" class="rounded-circle border" width="48" height="48" alt="${flat.occupantName}">
                <div>
                  <div class="fw-bold text-white fs-6">${flat.occupantName}</div>
                  <span class="badge ${flat.occupantType === 'Owner' || !flat.occupantType ? 'bg-success' : 'bg-purple-600'} rounded-pill fs-9">
                    ${flat.occupantType || 'Owner'}
                  </span>
                </div>
              </div>
              <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10 fs-8">
                <span class="text-secondary">Contact Phone:</span>
                <span class="text-white">${flat.occupantPhone || 'Not recorded'}</span>
              </div>
              <div class="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10 fs-8">
                <span class="text-secondary">Email:</span>
                <span class="text-white">${flat.occupantEmail || '—'}</span>
              </div>
              <div class="d-flex justify-content-between pt-1 fs-8">
                <span class="text-secondary">Status:</span>
                <span class="text-success"><i class="fa-solid fa-circle-check me-1"></i>Active Resident</span>
              </div>
            ` : `
              <div class="text-center py-4">
                <i class="fa-solid fa-door-open fs-1 text-warning mb-2 d-block opacity-60"></i>
                <div class="fw-bold text-white fs-7 mb-1">Unit is Unoccupied</div>
                <p class="text-secondary fs-8 mb-3">No resident is currently registered or allotted to this flat.</p>
                <button class="btn btn-sm btn-gold rounded-pill px-3" onclick="bootstrap.Modal.getInstance(document.getElementById('flatDetailsModal')).hide(); openAllotForFlat('${flat.flatNo}', '${flat.tower}', '${flat.floor}')">
                  <i class="fa-solid fa-user-plus me-1"></i> Allot Resident Now
                </button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // Action button
  const allotBtn = document.getElementById('btnActionFlatAllot');
  if (allotBtn) {
    allotBtn.innerHTML = flat.status === 'Occupied'
      ? '<i class="fa-solid fa-user-pen me-1"></i> Change / Reallot'
      : '<i class="fa-solid fa-user-plus me-1"></i> Allot Resident';
    allotBtn.onclick = () => {
      const modalInst = bootstrap.Modal.getInstance(document.getElementById('flatDetailsModal'));
      if (modalInst) modalInst.hide();
      openAllotForFlat(flat.flatNo, flat.tower, flat.floor);
    };
  }

  // Delete flat button
  const delBtn = document.getElementById('btnDeleteFlat');
  if (delBtn) {
    delBtn.onclick = () => deleteFlatFromDetails(flat.flatNo);
  }

  const modalEl = document.getElementById('flatDetailsModal');
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

function openAllotForFlat(flatNo, tower, floor) {
  const flatInput = document.getElementById('allocFlat');
  if (flatInput) flatInput.value = flatNo || '';

  const towerSelect = document.getElementById('allocTower');
  if (towerSelect && tower) towerSelect.value = tower;

  const floorInput = document.getElementById('allocFloor');
  if (floorInput && floor) floorInput.value = `${floor}${floor === 1 ? 'st' : floor === 2 ? 'nd' : floor === 3 ? 'rd' : 'th'} Floor`;

  const parkingInput = document.getElementById('allocParking');
  if (parkingInput) parkingInput.value = 'P-' + (flatNo || '').replace(/[^0-9A-Z]/gi, '');

  // Populate users in allocUserSelect
  const userSelect = document.getElementById('allocUserSelect');
  if (userSelect) {
    const residents = SystemDB.getResidents ? SystemDB.getResidents() : [];
    userSelect.innerHTML = '<option value="">-- Choose Resident / User to Allot --</option>' +
      residents.map(u => `<option value="${u.id}" data-name="${u.name}" data-role="${u.role || 'Resident'}">${u.name} (${u.email || u.id}) · Currently: ${u.flat || 'No flat'}</option>`).join('');
  }

  const modalEl = document.getElementById('allocateFlatModal');
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

function syncAllocUserSelect() {
  const select = document.getElementById('allocUserSelect');
  if (!select) return;
  const opt = select.options[select.selectedIndex];
  if (!opt) return;

  const userId = select.value;
  const userName = opt.getAttribute('data-name') || '';
  const userRole = opt.getAttribute('data-role') || 'Resident';

  const idEl = document.getElementById('allocUserId');
  if (idEl) idEl.value = userId;

  const nameEl = document.getElementById('allocUserName');
  if (nameEl) nameEl.value = userName;

  const roleEl = document.getElementById('allocRole');
  if (roleEl) roleEl.value = userRole;
}

function deleteFlatFromDetails(flatNo) {
  if (!confirm(`Are you sure you want to remove Flat ${flatNo} from the society records?`)) return;

  if (typeof SystemDB.deleteFlat === 'function') {
    SystemDB.deleteFlat(flatNo);
  }

  const modalInst = bootstrap.Modal.getInstance(document.getElementById('flatDetailsModal'));
  if (modalInst) modalInst.hide();

  if (typeof showToast === 'function') {
    showToast(`Flat ${flatNo} removed successfully.`, 'success');
  }

  renderTowersAndFlats();
}

function openAddFlatModal() {
  const form = document.getElementById('addNewFlatForm');
  if (form) form.reset();

  handleNewFlatTowerChange();
  const modalEl = document.getElementById('addNewFlatModal');
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

function handleNewFlatTowerChange() {
  const tower = document.getElementById('newFlatTower')?.value || 'Tower A';
  const floor = document.getElementById('newFlatFloor')?.value || '1';
  const prefix = tower === 'Tower B' ? 'B' : tower === 'Tower C' ? 'C' : 'A';
  const flatInput = document.getElementById('newFlatNumber');
  const parkInput = document.getElementById('newFlatParking');
  if (flatInput) flatInput.value = `${prefix}-${floor}05`;
  if (parkInput) parkInput.value = `P-${prefix}${floor}05`;
}

function handleNewFlatFloorChange() {
  handleNewFlatTowerChange();
}

function handleAddNewFlatSubmit(event) {
  event.preventDefault();

  const tower = document.getElementById('newFlatTower').value;
  const floor = document.getElementById('newFlatFloor').value;
  const flatNo = document.getElementById('newFlatNumber').value.trim();
  const bhk = document.getElementById('newFlatBhk').value;
  const areaSqFt = document.getElementById('newFlatSqft').value;
  const parkingSlot = document.getElementById('newFlatParking').value.trim();
  const maintenanceAmount = document.getElementById('newFlatMaintenance').value;

  if (typeof SystemDB.addFlat !== 'function') {
    alert('SystemDB flat creation not available.');
    return;
  }

  const res = SystemDB.addFlat({
    tower,
    floor,
    flatNo,
    bhk,
    areaSqFt,
    parkingSlot,
    maintenanceAmount
  });

  if (res.success) {
    const modalInst = bootstrap.Modal.getInstance(document.getElementById('addNewFlatModal'));
    if (modalInst) modalInst.hide();

    if (typeof showToast === 'function') {
      showToast(`Flat ${flatNo} added to ${tower} successfully!`, 'success');
    } else {
      alert(`Flat ${flatNo} added successfully!`);
    }

    renderTowersAndFlats();
  } else {
    alert(res.message || 'Failed to add flat.');
  }
}

function exportFlatsCSV() {
  const flats = (typeof SystemDB.getFlats === 'function') ? SystemDB.getFlats() : [];
  if (!flats || !flats.length) {
    if (typeof showToast === 'function') showToast("No flats records available to export.", "warning");
    return;
  }

  const rows = flats.map(f => ({
    'Flat No': f.flatNo,
    'Tower': f.tower,
    'Wing': f.wing || '',
    'Floor': f.floor,
    'BHK': f.bhk || '',
    'Area (sq.ft)': f.areaSqFt || '',
    'Occupancy Status': f.status,
    'Resident Type': f.occupantType || (f.status === 'Occupied' ? 'Owner' : 'Vacant'),
    'Resident Name': f.occupantName || 'Vacant',
    'Phone': f.occupantPhone || '',
    'Email': f.occupantEmail || '',
    'Parking Slot': f.parkingSlot || '',
    'Monthly Maintenance': f.maintenanceAmount || 3500
  }));

  SystemDB.exportToCSV('SocietyHub_Flats_Directory_' + new Date().toISOString().slice(0,10) + '.csv', rows);
  if (typeof showToast === 'function') showToast("Flats directory exported to CSV successfully!", "success");
}

// Global window mappings for Towers & Flats
window.renderTowersAndFlats = renderTowersAndFlats;
window.selectTowerFilter = selectTowerFilter;
window.filterFlats = filterFlats;
window.switchFlatsView = switchFlatsView;
window.openFlatDetailsModal = openFlatDetailsModal;
window.openAllotForFlat = openAllotForFlat;
window.syncAllocUserSelect = syncAllocUserSelect;
window.deleteFlatFromDetails = deleteFlatFromDetails;
window.openAddFlatModal = openAddFlatModal;
window.handleNewFlatTowerChange = handleNewFlatTowerChange;
window.handleNewFlatFloorChange = handleNewFlatFloorChange;
window.handleAddNewFlatSubmit = handleAddNewFlatSubmit;
window.exportFlatsCSV = exportFlatsCSV;
window.resetFlatsFilters = resetFlatsFilters;

// ═══════════════════════════════════════════════════════════════════════════
// AMENITY & FACILITY MANAGEMENT LOGIC
// ═══════════════════════════════════════════════════════════════════════════

function renderAmenitiesDashboard() {
  const container = document.getElementById('tab-amenities');
  if (!container) return;

  const amenities = (typeof SystemDB.getAmenities === 'function') ? SystemDB.getAmenities() : [];
  const bookings = (typeof SystemDB.getBookings === 'function') ? SystemDB.getBookings() : [];

  // Update KPIs
  const totalAmenitiesEl = document.getElementById('kpiTotalAmenities');
  if (totalAmenitiesEl) totalAmenitiesEl.textContent = `${amenities.length} Facilities`;

  const operationalCount = amenities.filter(a => a.status !== 'Maintenance').length;
  const operationalEl = document.getElementById('kpiOperationalCount');
  if (operationalEl) operationalEl.textContent = `${operationalCount} Operational`;

  const confirmedBookings = bookings.filter(b => b.status === 'Confirmed');
  const activeBookingsEl = document.getElementById('kpiActiveBookings');
  if (activeBookingsEl) activeBookingsEl.textContent = confirmedBookings.length;

  const confirmedSubEl = document.getElementById('kpiConfirmedBookings');
  if (confirmedSubEl) confirmedSubEl.textContent = `${confirmedBookings.length} Confirmed`;

  // Calculate revenue from confirmed bookings
  const revenue = confirmedBookings.reduce((sum, b) => sum + (parseInt(b.amount, 10) || 0), 0);
  const revenueEl = document.getElementById('kpiAmenityRevenue');
  if (revenueEl) revenueEl.textContent = '₹' + revenue.toLocaleString('en-IN');

  // Most popular amenity
  const amenityBookingCounts = {};
  bookings.forEach(b => {
    const key = b.amenityName || b.amenityId || 'Facility';
    amenityBookingCounts[key] = (amenityBookingCounts[key] || 0) + 1;
  });

  let topAmenity = 'None';
  let topCount = 0;
  Object.keys(amenityBookingCounts).forEach(name => {
    if (amenityBookingCounts[name] > topCount) {
      topCount = amenityBookingCounts[name];
      topAmenity = name;
    }
  });

  const popularEl = document.getElementById('kpiPopularAmenity');
  if (popularEl) popularEl.textContent = topAmenity;
  const popularSubEl = document.getElementById('kpiPopularAmenitySub');
  if (popularSubEl) popularSubEl.textContent = topCount > 0 ? `${topCount} reservations booked` : 'No reservations yet';

  // Render Amenities Cards Grid
  renderAmenitiesGrid(amenities);

  // Populate Filter Select & Booking Modal Select
  populateAmenitySelects(amenities);

  // Render Bookings Table
  filterBookings();
}

function renderAmenitiesGrid(amenities) {
  const grid = document.getElementById('adminAmenitiesGrid');
  if (!grid) return;

  if (!amenities || amenities.length === 0) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="sa-card p-5 text-center text-secondary">
          <i class="fa-solid fa-shapes fs-1 mb-3 opacity-40"></i>
          <h5 class="fw-bold text-white mb-1">No Facilities Registered</h5>
          <p class="fs-8 mb-3">Add clubhouse, pool, sports court, or event halls for residents to reserve.</p>
          <button class="btn btn-gold btn-sm rounded-pill px-4" onclick="openAddAmenityModal()">
            <i class="fa-solid fa-plus me-1"></i> Add First Facility
          </button>
        </div>
      </div>
    `;
    return;
  }

  // Predefined icon color styles
  const iconThemes = [
    { bg: 'rgba(212, 149, 90, 0.15)', color: '#D4955A' }, // Gold
    { bg: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA' }, // Blue
    { bg: 'rgba(16, 185, 129, 0.15)', color: '#34D399' }, // Green
    { bg: 'rgba(14, 165, 233, 0.15)', color: '#38BDF8' }, // Sky
    { bg: 'rgba(244, 63, 94, 0.15)', color: '#FB7185' },  // Rose
    { bg: 'rgba(168, 85, 247, 0.15)', color: '#C084FC' }  // Purple
  ];

  grid.innerHTML = amenities.map((amn, index) => {
    const theme = iconThemes[index % iconThemes.length];
    const iconClass = amn.icon ? (amn.icon.startsWith('fa-') ? `fa-solid ${amn.icon}` : amn.icon) : 'fa-solid fa-building';
    const isMaintenance = (amn.status === 'Maintenance');
    const statusBadge = isMaintenance
      ? `<span class="badge bg-warning bg-opacity-15 text-warning border border-warning border-opacity-25 fs-9"><i class="fa-solid fa-screwdriver-wrench me-1"></i>Maintenance</span>`
      : `<span class="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25 fs-9"><i class="fa-solid fa-circle-check me-1"></i>Active</span>`;

    const rateText = (amn.rate && parseInt(amn.rate, 10) > 0) ? `₹${parseInt(amn.rate, 10).toLocaleString('en-IN')} / slot` : 'Free / Complimentary';

    return `
      <div class="col-xl-4 col-md-6">
        <div class="sa-card h-100 p-4 d-flex flex-column justify-content-between position-relative">
          <div>
            <div class="d-flex align-items-start justify-content-between mb-3">
              <div class="d-flex align-items-center gap-3">
                <div style="width: 46px; height: 46px; border-radius: 12px; background: ${theme.bg}; color: ${theme.color}; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                  <i class="${iconClass}"></i>
                </div>
                <div>
                  <h6 class="fw-bold text-white mb-0" style="font-size: 15px;">${amn.name}</h6>
                  <span class="text-secondary font-monospace fs-9">${amn.id}</span>
                </div>
              </div>
              <div>${statusBadge}</div>
            </div>

            <p class="text-secondary fs-8 mb-3" style="min-height: 38px; line-height: 1.5;">${amn.description || 'Community facility available for resident use.'}</p>

            <div class="d-flex align-items-center gap-3 p-2 rounded-3 mb-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
              <div class="d-flex align-items-center gap-1 fs-8 text-secondary">
                <i class="fa-solid fa-users text-primary"></i>
                <span>${amn.capacity || 50} Cap</span>
              </div>
              <div class="vr opacity-25"></div>
              <div class="d-flex align-items-center gap-1 fs-8 text-secondary">
                <i class="fa-solid fa-indian-rupee-sign text-success"></i>
                <span class="text-heading fw-semibold">${rateText}</span>
              </div>
            </div>
          </div>

          <div class="d-flex align-items-center justify-content-between pt-2 border-top border-white border-opacity-10 mt-2">
            <button class="btn btn-outline-danger btn-sm rounded-pill px-3 fs-8" onclick="deleteAmenityAction('${amn.id}', '${amn.name.replace(/'/g, "\\'")}')" title="Delete Facility">
              <i class="fa-solid fa-trash-can me-1"></i> Remove
            </button>
            <button class="btn btn-gold btn-sm rounded-pill px-3 fs-8 d-inline-flex align-items-center gap-1" onclick="openAdminBookingModal('${amn.id}')">
              <i class="fa-solid fa-calendar-plus"></i> Book Slot
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function populateAmenitySelects(amenities) {
  // Populate filter dropdown
  const filterSelect = document.getElementById('bookingAmenityFilter');
  if (filterSelect) {
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = `<option value="ALL">All Facilities (${amenities.length})</option>` +
      amenities.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    if (currentVal) filterSelect.value = currentVal;
  }

  // Populate booking modal select
  const modalSelect = document.getElementById('adminBookAmenitySelect');
  if (modalSelect) {
    modalSelect.innerHTML = amenities.map(a => `<option value="${a.id}" data-rate="${a.rate || 0}">${a.name} (₹${(a.rate || 0).toLocaleString('en-IN')})</option>`).join('');
  }
}

function filterBookings() {
  const tbody = document.getElementById('adminBookingsTableBody');
  if (!tbody) return;

  const bookings = (typeof SystemDB.getBookings === 'function') ? SystemDB.getBookings() : [];
  const searchInput = (document.getElementById('bookingSearchInput')?.value || '').toLowerCase().trim();
  const amenityFilter = document.getElementById('bookingAmenityFilter')?.value || 'ALL';
  const statusFilter = document.getElementById('bookingStatusFilter')?.value || 'ALL';

  let filtered = bookings.filter(b => {
    // Search filter
    if (searchInput) {
      const matchSearch =
        (b.id && b.id.toLowerCase().includes(searchInput)) ||
        (b.residentName && b.residentName.toLowerCase().includes(searchInput)) ||
        (b.flat && b.flat.toLowerCase().includes(searchInput)) ||
        (b.amenityName && b.amenityName.toLowerCase().includes(searchInput)) ||
        (b.purpose && b.purpose.toLowerCase().includes(searchInput));
      if (!matchSearch) return false;
    }

    // Amenity filter
    if (amenityFilter !== 'ALL') {
      if (b.amenityId !== amenityFilter && b.amenityName !== amenityFilter) return false;
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      if (b.status !== statusFilter) return false;
    }

    return true;
  });

  // Update badge count
  const badge = document.getElementById('bookingsCountBadge');
  if (badge) badge.textContent = `${filtered.length} Bookings Recorded`;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-secondary">
          <i class="fa-solid fa-calendar-xmark fs-2 mb-2 opacity-50"></i>
          <p class="mb-0 fs-8">No booking records found matching current filters.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    const isCancelled = (b.status === 'Cancelled');
    const statusBadge = isCancelled
      ? `<span class="badge bg-danger bg-opacity-15 text-danger border border-danger border-opacity-25"><i class="fa-solid fa-ban me-1"></i>Cancelled</span>`
      : `<span class="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25"><i class="fa-solid fa-circle-check me-1"></i>Confirmed</span>`;

    const feeText = (b.amount && parseInt(b.amount, 10) > 0) ? `₹${parseInt(b.amount, 10).toLocaleString('en-IN')}` : 'Free';

    return `
      <tr>
        <td>
          <span class="fw-bold font-monospace text-primary">${b.id}</span>
        </td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <i class="fa-solid fa-shapes text-warning fs-8"></i>
            <span class="fw-semibold text-white">${b.amenityName || 'Facility'}</span>
          </div>
        </td>
        <td>
          <div class="fw-semibold text-white">${b.residentName || 'Resident'}</div>
          <span class="badge bg-secondary bg-opacity-25 text-heading font-monospace fs-9">${b.flat || 'N/A'}</span>
        </td>
        <td>
          <div class="text-white fs-8"><i class="fa-regular fa-calendar me-1 text-info"></i>${b.date}</div>
          <small class="text-secondary fs-9">${b.timeSlot || 'Full Day'}</small>
        </td>
        <td>
          <span class="text-secondary fs-8">${b.purpose || 'Personal Event'}</span>
        </td>
        <td>
          <span class="fw-bold text-success font-monospace fs-8">${feeText}</span>
        </td>
        <td>${statusBadge}</td>
        <td class="text-end">
          <div class="d-inline-flex align-items-center gap-1">
            <button class="btn btn-outline-info btn-xs rounded-pill px-2" onclick="openBookingDetailsModal('${b.id}')" title="View Booking Details">
              <i class="fa-solid fa-eye"></i>
            </button>
            ${!isCancelled ? `
              <button class="btn btn-outline-danger btn-xs rounded-pill px-2" onclick="cancelBookingAction('${b.id}')" title="Cancel Booking">
                <i class="fa-solid fa-ban"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function resetBookingFilters() {
  const searchEl = document.getElementById('bookingSearchInput');
  if (searchEl) searchEl.value = '';
  const amnEl = document.getElementById('bookingAmenityFilter');
  if (amnEl) amnEl.value = 'ALL';
  const statusEl = document.getElementById('bookingStatusFilter');
  if (statusEl) statusEl.value = 'ALL';
  filterBookings();
}

function openAddAmenityModal() {
  const form = document.getElementById('addAmenityForm');
  if (form) form.reset();
  const modalEl = document.getElementById('addAmenityModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function handleAddNewAmenitySubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const name = document.getElementById('newAmenityName')?.value.trim();
  const icon = document.getElementById('newAmenityIcon')?.value || 'fa-building';
  const capacity = document.getElementById('newAmenityCapacity')?.value || 50;
  const rate = document.getElementById('newAmenityRate')?.value || 0;
  const status = document.getElementById('newAmenityStatus')?.value || 'Active';
  const desc = document.getElementById('newAmenityDesc')?.value.trim();

  if (!name) {
    alert('Please enter a facility name.');
    return;
  }

  const res = SystemDB.addAmenity({
    name,
    icon,
    capacity,
    rate,
    status,
    description: desc
  });

  if (res && res.success) {
    const modalEl = document.getElementById('addAmenityModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    if (typeof showToast === 'function') {
      showToast(`Facility "${name}" created successfully!`, "success");
    }
    renderAmenitiesDashboard();
  } else {
    alert(res?.message || 'Failed to add facility.');
  }
}

function deleteAmenityAction(amenityId, amenityName) {
  if (!confirm(`Are you sure you want to remove facility "${amenityName}"?`)) return;
  const res = SystemDB.deleteAmenity(amenityId);
  if (res && res.success) {
    if (typeof showToast === 'function') {
      showToast(`Facility "${amenityName}" removed.`, "success");
    }
    renderAmenitiesDashboard();
  } else {
    alert('Failed to delete facility.');
  }
}

function openAdminBookingModal(preselectedAmenityId) {
  // Populate residents select
  const resSelect = document.getElementById('adminBookResidentSelect');
  if (resSelect) {
    const residents = (typeof SystemDB.getResidents === 'function') ? SystemDB.getResidents() : [];
    if (residents.length) {
      resSelect.innerHTML = residents.map(r => `<option value="${r.name}|${r.flat || ''}">${r.name} (${r.flat || 'Flat N/A'})</option>`).join('');
    } else {
      resSelect.innerHTML = '<option value="Priya Verma|C-501">Priya Verma (C-501)</option>';
    }
  }

  // Preselect amenity if specified
  const amnSelect = document.getElementById('adminBookAmenitySelect');
  if (amnSelect && preselectedAmenityId) {
    amnSelect.value = preselectedAmenityId;
  }

  // Set default reservation date to tomorrow
  const dateInput = document.getElementById('adminBookDate');
  if (dateInput) {
    const tomorrow = new Date(Date.now() + 86400000);
    dateInput.value = tomorrow.toISOString().split('T')[0];
    dateInput.min = new Date().toISOString().split('T')[0];
  }

  handleAdminBookingAmenityChange();

  const modalEl = document.getElementById('adminBookAmenityModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function handleAdminBookingAmenityChange() {
  const amnSelect = document.getElementById('adminBookAmenitySelect');
  const feeDisplay = document.getElementById('adminBookFeeDisplay');
  if (!amnSelect || !feeDisplay) return;

  const selectedOpt = amnSelect.selectedOptions[0];
  const rate = selectedOpt ? parseInt(selectedOpt.getAttribute('data-rate'), 10) || 0 : 0;
  feeDisplay.textContent = rate > 0 ? `₹${rate.toLocaleString('en-IN')}` : 'Complimentary (₹0)';
}

function handleAdminBookingSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const amnSelect = document.getElementById('adminBookAmenitySelect');
  const resSelect = document.getElementById('adminBookResidentSelect');
  const dateInput = document.getElementById('adminBookDate');
  const slotSelect = document.getElementById('adminBookTimeSlot');
  const purposeInput = document.getElementById('adminBookPurpose');

  if (!amnSelect || !resSelect || !dateInput || !slotSelect) return;

  const amenityId = amnSelect.value;
  const [residentName, flat] = resSelect.value.split('|');
  const date = dateInput.value;
  const timeSlot = slotSelect.value;
  const purpose = purposeInput ? purposeInput.value.trim() : 'Personal Event';

  const res = SystemDB.bookAmenity({
    amenityId,
    residentName,
    flat,
    date,
    timeSlot,
    purpose
  });

  if (res && res.success) {
    const modalEl = document.getElementById('adminBookAmenityModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
    if (typeof showToast === 'function') {
      showToast(`Slot reserved for ${residentName} (${res.booking.id})!`, "success");
    }
    renderAmenitiesDashboard();
  } else {
    alert(res.message || 'Failed to book amenity.');
  }
}

function openBookingDetailsModal(bookingId) {
  const bookings = (typeof SystemDB.getBookings === 'function') ? SystemDB.getBookings() : [];
  const b = bookings.find(item => item.id === bookingId);
  if (!b) return;

  const modalBody = document.getElementById('bookingDetailsBody');
  const statusBadge = document.getElementById('bookingDetailStatusBadge');
  const cancelBtn = document.getElementById('btnCancelBookingAction');

  if (statusBadge) {
    statusBadge.textContent = b.status;
    statusBadge.className = `badge ${b.status === 'Confirmed' ? 'bg-success' : 'bg-danger'}`;
  }

  if (modalBody) {
    modalBody.innerHTML = `
      <div class="p-3 rounded-3 mb-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
        <div class="row g-2">
          <div class="col-6">
            <span class="text-secondary fs-9">Booking ID</span>
            <div class="fw-bold font-monospace text-primary">${b.id}</div>
          </div>
          <div class="col-6">
            <span class="text-secondary fs-9">Facility</span>
            <div class="fw-bold text-white">${b.amenityName}</div>
          </div>
          <div class="col-6">
            <span class="text-secondary fs-9">Resident</span>
            <div class="fw-bold text-white">${b.residentName}</div>
          </div>
          <div class="col-6">
            <span class="text-secondary fs-9">Flat</span>
            <div class="fw-bold font-monospace text-heading">${b.flat || 'N/A'}</div>
          </div>
          <div class="col-6">
            <span class="text-secondary fs-9">Date</span>
            <div class="text-white">${b.date}</div>
          </div>
          <div class="col-6">
            <span class="text-secondary fs-9">Time Slot</span>
            <div class="text-white">${b.timeSlot}</div>
          </div>
          <div class="col-6">
            <span class="text-secondary fs-9">Booking Fee</span>
            <div class="fw-bold text-success">₹${(b.amount || 0).toLocaleString('en-IN')}</div>
          </div>
          <div class="col-6">
            <span class="text-secondary fs-9">Status</span>
            <div class="fw-semibold text-white">${b.status}</div>
          </div>
          <div class="col-12 mt-2 pt-2 border-top border-white border-opacity-10">
            <span class="text-secondary fs-9">Event Purpose</span>
            <div class="text-white fs-8">${b.purpose || 'Personal gathering'}</div>
          </div>
        </div>
      </div>
    `;
  }

  if (cancelBtn) {
    if (b.status === 'Confirmed') {
      cancelBtn.style.display = 'inline-block';
      cancelBtn.onclick = () => cancelBookingAction(b.id);
    } else {
      cancelBtn.style.display = 'none';
    }
  }

  const modalEl = document.getElementById('bookingDetailsModal');
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function cancelBookingAction(bookingId) {
  if (!confirm(`Are you sure you want to cancel booking ${bookingId}?`)) return;
  const res = SystemDB.cancelBooking(bookingId);
  if (res && res.success) {
    const detailsModalEl = document.getElementById('bookingDetailsModal');
    if (detailsModalEl) {
      const modal = bootstrap.Modal.getInstance(detailsModalEl);
      if (modal) modal.hide();
    }
    if (typeof showToast === 'function') {
      showToast(`Reservation ${bookingId} cancelled.`, "warning");
    }
    renderAmenitiesDashboard();
  } else {
    alert(res?.message || 'Failed to cancel booking.');
  }
}

function exportAmenityBookingsCSV() {
  const bookings = (typeof SystemDB.getBookings === 'function') ? SystemDB.getBookings() : [];
  if (!bookings || !bookings.length) {
    if (typeof showToast === 'function') showToast("No booking records to export.", "warning");
    return;
  }

  const rows = bookings.map(b => ({
    'Booking ID': b.id,
    'Facility': b.amenityName || '',
    'Resident Name': b.residentName || '',
    'Flat': b.flat || '',
    'Date': b.date || '',
    'Time Slot': b.timeSlot || '',
    'Purpose': b.purpose || '',
    'Fee (INR)': b.amount || 0,
    'Status': b.status || ''
  }));

  SystemDB.exportToCSV('SocietyHub_Amenity_Bookings_' + new Date().toISOString().slice(0,10) + '.csv', rows);
  if (typeof showToast === 'function') showToast("Amenity reservations exported to CSV!", "success");
}

// Global window mappings for Amenities
window.renderAmenitiesDashboard = renderAmenitiesDashboard;
window.filterBookings = filterBookings;
window.resetBookingFilters = resetBookingFilters;
window.openAddAmenityModal = openAddAmenityModal;
window.handleAddNewAmenitySubmit = handleAddNewAmenitySubmit;
window.deleteAmenityAction = deleteAmenityAction;
window.openAdminBookingModal = openAdminBookingModal;
window.handleAdminBookingAmenityChange = handleAdminBookingAmenityChange;
window.handleAdminBookingSubmit = handleAdminBookingSubmit;
window.openBookingDetailsModal = openBookingDetailsModal;
window.cancelBookingAction = cancelBookingAction;
window.exportAmenityBookingsCSV = exportAmenityBookingsCSV;


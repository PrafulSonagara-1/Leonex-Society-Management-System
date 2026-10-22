/**
 * SocietyHub — Committee Governance Portal Controller (committee.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (window.SystemDB) await SystemDB.init();
  } catch (e) {
    console.warn('SystemDB init warning:', e);
  }

  const isEnabled = (window.SystemDB && typeof SystemDB.isCommitteeEnabled === 'function')
    ? SystemDB.isCommitteeEnabled()
    : true;

  if (!isEnabled) {
    showCommitteeDisabledScreen();
    return;
  }

  loadCommitteeData();
  bindCommitteePollForm();
});

function showCommitteeDisabledScreen() {
  const container = document.querySelector('.container-fluid.px-3.px-lg-4.py-4');
  if (!container) return;

  const currentUser = (window.SystemDB && SystemDB.getCurrentUser()) || {};
  const isAdmin = currentUser.role === 'Admin';
  const isDemo = window.SystemDB ? SystemDB.isDemoMode() : false;

  container.innerHTML = `
    <div class="row justify-content-center py-5">
      <div class="col-md-8 col-lg-6 text-center">
        <div class="sa-card p-5 border border-warning border-opacity-30 shadow-lg" style="background: linear-gradient(145deg, #181820, #121217); border-radius: 24px;">
          <div class="mb-4 d-inline-flex align-items-center justify-content-center rounded-circle" style="width: 80px; height: 80px; background: rgba(245, 158, 11, 0.15); color: #F59E0B; font-size: 36px;">
            <i class="fa-solid fa-users-slash"></i>
          </div>
          <h3 class="fw-bold text-white mb-2">Committee Governance Portal Inactive</h3>
          <p class="text-secondary fs-7 mb-4">
            The Society Secretary / Admin has made the Committee Panel optional and has currently disabled committee oversight for this society.
          </p>

          <div class="p-3 mb-4 rounded-3 text-start d-flex align-items-start gap-3" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);">
            <i class="fa-solid fa-circle-info text-info mt-1"></i>
            <div class="fs-8 text-secondary">
              <strong class="text-white d-block mb-1">Direct Secretary Administration Mode</strong>
              In this mode, all society approvals, financial ledger reviews, and announcements are handled directly from the Society Admin Control Center.
            </div>
          </div>

          <div class="d-flex flex-column flex-sm-row gap-3 justify-content-center">
            ${(isAdmin || isDemo) ? `
              <button class="btn btn-warning rounded-pill px-4 fw-semibold" onclick="enableCommitteeModuleDirectly()">
                <i class="fa-solid fa-toggle-on me-2"></i>Enable Committee Panel
              </button>
            ` : ''}
            <a href="resident.html" class="btn btn-outline-primary rounded-pill px-4 fw-semibold">
              <i class="fa-solid fa-house-user me-2"></i>Resident Portal
            </a>
            <a href="admin.html" class="btn btn-outline-secondary rounded-pill px-4 fw-semibold">
              <i class="fa-solid fa-user-gear me-2"></i>Admin Portal
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.enableCommitteeModuleDirectly = function () {
  if (window.SystemDB && typeof SystemDB.setCommitteeEnabled === 'function') {
    SystemDB.setCommitteeEnabled(true);
    if (typeof showToast === 'function') {
      showToast('Committee Panel enabled! Reloading portal...', 'success');
    }
    setTimeout(() => location.reload(), 400);
  }
};

function loadCommitteeData() {
  const user = (window.SystemDB && SystemDB.getCurrentUser()) || null;
  const isDemo = window.SystemDB ? SystemDB.isDemoMode() : false;
  const d = (window.SystemDB && SystemDB.data) || {};
  const users = d.users || [];
  const complaints = d.complaints || [];
  const bills = d.bills || d.maintenance || [];

  if (user) {
    const nameEl = document.getElementById('commName');
    if (nameEl) nameEl.textContent = user.name || 'Committee Auditor';
  }

  // Navbar dynamic badge
  const modeBadgeEl = document.getElementById('commModeBadge');
  if (modeBadgeEl) {
    const socCode = (window.SystemDB && SystemDB.getSocietyCode()) || 'DEMO01';
    const socSettings = (d && d.societySettings) || {};
    const socName = socSettings.name || (user && user.societyName) || sessionStorage.getItem('ssm_society_name') || 'Society Governance';
    modeBadgeEl.className = 'badge rounded-pill px-3 py-2 fs-8 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm';
    if (isDemo) {
      modeBadgeEl.style.background = 'rgba(245, 158, 11, 0.15)';
      modeBadgeEl.style.color = '#F59E0B';
      modeBadgeEl.style.border = '1px solid rgba(245, 158, 11, 0.3)';
      modeBadgeEl.innerHTML = '<i class="fa-solid fa-flask me-1"></i> Demo Mode &middot; Sample Audit';
    } else {
      modeBadgeEl.style.background = 'rgba(14, 165, 233, 0.15)';
      modeBadgeEl.style.color = '#38BDF8';
      modeBadgeEl.style.border = '1px solid rgba(14, 165, 233, 0.3)';
      modeBadgeEl.innerHTML = `<i class="fa-solid fa-building me-1"></i> ${socName} &middot; <strong class="ms-1" style="font-family:monospace;letter-spacing:1px;">${socCode}</strong>`;
    }
  }

  // Residents count
  const actualResCount = users.filter(u => u.role === 'Resident').length;
  const resCount = isDemo ? (actualResCount || 18) : actualResCount;
  const countEl = document.getElementById('commResidentsCount');
  if (countEl) countEl.textContent = String(resCount);

  // Collections and Dues calculation
  let totalPaid = 0;
  let totalDues = 0;

  bills.forEach(b => {
    const amt = parseFloat(String(b.amount || '0').replace(/[^0-9.]/g, '')) || 0;
    if (b.status === 'Paid') totalPaid += amt;
    else totalDues += amt;
  });

  if (isDemo && totalPaid === 0) totalPaid = 142500;
  if (isDemo && totalDues === 0) totalDues = 28000;

  const collEl = document.getElementById('commTotalColl');
  if (collEl) collEl.textContent = '₹' + totalPaid.toLocaleString('en-IN');

  const duesEl = document.getElementById('commDues');
  if (duesEl) duesEl.textContent = '₹' + totalDues.toLocaleString('en-IN');

  // Complaint resolution rate
  const resolved = complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
  let rateStr = '100%';
  if (complaints.length > 0) {
    rateStr = Math.round((resolved / complaints.length) * 100) + '%';
  } else if (isDemo) {
    rateStr = '94%';
  } else {
    rateStr = '—';
  }
  const rateEl = document.getElementById('commResolutionRate');
  if (rateEl) rateEl.textContent = rateStr;

  // Render Revenue Trend Chart
  renderCommitteeChart();
  renderCommitteeRatioChart(totalPaid, totalDues);
  renderAuditTable(bills);
  renderPolls(d.polls || []);
  renderCollectionsTable(bills);
  renderExpensesTable(d.expenses || []);
  renderComplaintsTable(complaints);
  renderNotices(d.notices || []);
}

function renderCommitteeChart() {
  const canvas = document.getElementById('committeeRevenueChart');
  if (!canvas || !window.Chart) return;
  const isDemo = window.SystemDB ? SystemDB.isDemoMode() : false;

  const collData = isDemo ? [120000, 135000, 128000, 142000, 139000, 150000, 145000, 155000] : [0, 0, 0, 0, 0, 0, 0, 0];
  const expData = isDemo ? [85000, 92000, 88000, 95000, 102000, 91000, 98000, 104000] : [0, 0, 0, 0, 0, 0, 0, 0];

  const ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
      datasets: [
        {
          label: 'Maintenance Collections (₹)',
          data: collData,
          borderColor: '#D4955A',
          backgroundColor: 'rgba(212,149,90,0.1)',
          tension: 0.35,
          fill: true
        },
        {
          label: 'Society Expenses (₹)',
          data: expData,
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99,102,241,0.06)',
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, color: '#94A3B8', font: { size: 12 } } }
      },
      scales: {
        y: {
          ticks: { callback: v => '₹' + (v / 1000) + 'k', color: '#94A3B8' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        x: {
          ticks: { color: '#94A3B8' },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

function renderCommitteeRatioChart(paid, dues) {
  const canvas = document.getElementById('committeeRatioChart');
  if (!canvas || !window.Chart) return;

  const isZero = (paid === 0 && dues === 0);
  const chartData = isZero ? [1] : [paid, dues];
  const chartBg = isZero ? ['rgba(255,255,255,0.08)'] : ['#10B981', '#EF4444'];
  const chartLabels = isZero ? ['No Financial Records'] : ['Collected Pool', 'Outstanding Dues'];

  const ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [
        {
          data: chartData,
          backgroundColor: chartBg,
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94A3B8', boxWidth: 12 } }
      },
      cutout: '70%'
    }
  });
}

function renderAuditTable(bills) {
  const host = document.getElementById('commAuditTableBody');
  if (!host) return;
  const isDemo = window.SystemDB ? SystemDB.isDemoMode() : false;

  if (!bills.length && !isDemo) {
    host.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><i class="fa-solid fa-file-invoice me-2"></i>No maintenance invoices generated yet</td></tr>';
    return;
  }

  const list = bills.length ? bills : [
    { id: 'INV-2024-001', residentName: 'Jenil Barad', flat: 'A-101', month: 'Aug 2024', amount: '₹4,500', status: 'Paid', receiptNo: 'RCP-8821' },
    { id: 'INV-2024-002', residentName: 'Amit Patel', flat: 'A-402', month: 'Aug 2024', amount: '₹4,500', status: 'Paid', receiptNo: 'RCP-8822' },
    { id: 'INV-2024-003', residentName: 'Priya Sharma', flat: 'B-201', month: 'Aug 2024', amount: '₹4,500', status: 'Pending', receiptNo: '—' },
    { id: 'INV-2024-004', residentName: 'Vikram Malhotra', flat: 'B-502', month: 'Aug 2024', amount: '₹5,200', status: 'Paid', receiptNo: 'RCP-8824' },
    { id: 'INV-2024-005', residentName: 'Neha Desai', flat: 'C-301', month: 'Aug 2024', amount: '₹4,500', status: 'Paid', receiptNo: 'RCP-8825' }
  ];

  host.innerHTML = list.slice(0, 10).map(b => `
    <tr>
      <td class="fw-bold text-white">${b.id || 'INV-001'}</td>
      <td>${b.residentName || 'Resident'} (${b.flat || b.flatNo || 'A-101'})</td>
      <td>${b.month || b.billingMonth || 'Current'}</td>
      <td class="fw-semibold text-white">${typeof b.amount === 'number' ? '₹' + b.amount.toLocaleString('en-IN') : b.amount}</td>
      <td>
        <span class="badge rounded-pill ${b.status === 'Paid' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} px-2 py-1">
          ${b.status || 'Pending'}
        </span>
      </td>
      <td class="text-secondary">${b.receiptNo || b.receiptId || '—'}</td>
    </tr>
  `).join('');
}

function renderCollectionsTable(bills) {
  const host = document.getElementById('commCollectionsTableBody');
  if (!host) return;
  const isDemo = window.SystemDB ? SystemDB.isDemoMode() : false;

  if (!bills.length && !isDemo) {
    host.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4"><i class="fa-solid fa-receipt me-2"></i>No collections recorded yet</td></tr>';
    return;
  }

  const list = bills.length ? bills : [
    { flat: 'A-101', residentName: 'Jenil Barad', amount: '₹4,500', status: 'Paid', dueDate: '10 Aug 2024' },
    { flat: 'A-402', residentName: 'Amit Patel', amount: '₹4,500', status: 'Paid', dueDate: '10 Aug 2024' },
    { flat: 'B-201', residentName: 'Priya Sharma', amount: '₹4,500', status: 'Pending', dueDate: '10 Aug 2024' },
    { flat: 'B-502', residentName: 'Vikram Malhotra', amount: '₹5,200', status: 'Paid', dueDate: '10 Aug 2024' }
  ];

  host.innerHTML = list.map(b => `
    <tr>
      <td class="fw-bold text-white">${b.flat || 'A-101'}</td>
      <td>${b.residentName || 'Resident'}</td>
      <td class="fw-semibold text-white">${typeof b.amount === 'number' ? '₹' + b.amount.toLocaleString('en-IN') : b.amount}</td>
      <td><span class="badge rounded-pill ${b.status === 'Paid' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} px-2 py-1">${b.status || 'Pending'}</span></td>
      <td class="text-secondary">${b.dueDate || '10th of Month'}</td>
    </tr>
  `).join('');
}

function renderExpensesTable(expenses) {
  const host = document.getElementById('commExpensesTableBody');
  if (!host) return;
  const isDemo = window.SystemDB ? SystemDB.isDemoMode() : false;

  if (!expenses.length && !isDemo) {
    host.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4"><i class="fa-solid fa-money-bill-wave me-2"></i>No society expenses recorded yet</td></tr>';
    return;
  }

  const list = expenses.length ? expenses : [
    { category: 'Security Agency Payroll', payee: 'Apex Guard Services', amount: '₹42,000', date: '01 Aug 2024', approvedBy: 'Secretary' },
    { category: 'Lift AMC Maintenance', payee: 'Otis Elevators Ltd', amount: '₹18,500', date: '05 Aug 2024', approvedBy: 'Treasurer' },
    { category: 'Common Area Electricity', payee: 'Torrent Power', amount: '₹24,300', date: '08 Aug 2024', approvedBy: 'Treasurer' },
    { category: 'Garden & Landscaping', payee: 'GreenCare Landscapers', amount: '₹9,000', date: '12 Aug 2024', approvedBy: 'Secretary' }
  ];

  host.innerHTML = list.map(e => `
    <tr>
      <td class="fw-bold text-white">${e.category || 'General'}</td>
      <td>${e.payee || 'Vendor'}</td>
      <td class="fw-semibold text-danger">-${typeof e.amount === 'number' ? '₹' + e.amount.toLocaleString('en-IN') : e.amount}</td>
      <td class="text-secondary">${e.date || '01 Aug 2024'}</td>
      <td><span class="badge rounded-pill bg-primary-subtle text-primary px-2 py-1">${e.approvedBy || 'Managing Committee'}</span></td>
    </tr>
  `).join('');
}

function renderComplaintsTable(complaints) {
  const host = document.getElementById('commComplaintsTableBody');
  if (!host) return;
  const isDemo = window.SystemDB ? SystemDB.isDemoMode() : false;

  if (!complaints.length && !isDemo) {
    host.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4"><i class="fa-solid fa-circle-check me-2"></i>No complaints raised</td></tr>';
    return;
  }

  const list = complaints.length ? complaints : [
    { id: 'CMP-101', resident: 'Amit Patel (A-402)', category: 'Plumbing', priority: 'High', status: 'Resolved' },
    { id: 'CMP-102', resident: 'Priya Sharma (B-201)', category: 'Electrical', priority: 'Medium', status: 'In Progress' },
    { id: 'CMP-103', resident: 'Vikram Malhotra (B-502)', category: 'Carpentry', priority: 'Low', status: 'Resolved' }
  ];

  host.innerHTML = list.map(c => `
    <tr>
      <td class="fw-bold text-white">${c.id || 'CMP-001'}</td>
      <td>${c.resident || (c.residentName ? c.residentName + ' (' + c.flat + ')' : 'Resident')}</td>
      <td>${c.category || 'General'}</td>
      <td><span class="badge rounded-pill ${c.priority === 'High' ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning'} px-2 py-1">${c.priority || 'Medium'}</span></td>
      <td><span class="badge rounded-pill ${c.status === 'Resolved' ? 'bg-success-subtle text-success' : 'bg-info-subtle text-info'} px-2 py-1">${c.status || 'Active'}</span></td>
    </tr>
  `).join('');
}

function renderNotices(notices) {
  const host = document.getElementById('commNoticesContainer');
  if (!host) return;
  const isDemo = window.SystemDB ? SystemDB.isDemoMode() : false;

  if (!notices.length && !isDemo) {
    host.innerHTML = '<div class="col-12"><div class="p-4 text-center text-muted rounded-3" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);"><i class="fa-regular fa-bell fs-3 mb-2 d-block"></i>No society notices published yet</div></div>';
    return;
  }

  const list = notices.length ? notices : [
    { title: 'Annual General Body Meeting (AGM)', date: '15 Sep 2024', category: 'Meeting', body: 'The 12th AGM will be held at the Clubhouse hall at 10:00 AM. Audit accounts for FY24 will be presented for adoption.' },
    { title: 'Solar Rooftop Installation Update', date: '28 Aug 2024', category: 'Infrastructure', body: 'Vendor contract finalized. Installation begins on Tower B terrace next Monday. Minimal power disruption expected.' }
  ];

  host.innerHTML = list.map(n => `
    <div class="col-md-6">
      <div class="p-3 rounded-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="badge rounded-pill bg-primary-subtle text-primary fs-9">${n.category || 'Notice'}</span>
          <small class="text-secondary fs-9">${n.date || 'Recent'}</small>
        </div>
        <h6 class="fw-bold text-white mb-2">${n.title}</h6>
        <p class="text-secondary fs-8 mb-0">${n.body}</p>
      </div>
    </div>
  `).join('');
}

function renderPolls(polls) {
  const hosts = [document.getElementById('commPollsContainer'), document.getElementById('commDedicatedPollsContainer')];
  const isDemo = window.SystemDB ? SystemDB.isDemoMode() : false;

  if (!polls.length && !isDemo) {
    hosts.forEach(host => {
      if (host) host.innerHTML = '<div class="col-12"><div class="p-4 text-center text-muted rounded-3" style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1);"><i class="fa-solid fa-square-poll-vertical fs-3 mb-2 d-block"></i>No active polls or voting sessions</div></div>';
    });
    return;
  }

  const list = polls.length ? polls : [
    {
      title: 'Roof Waterproofing Budget Allocation (₹3.5 Lakhs)',
      category: 'Infrastructure & Energy',
      endDate: '2024-09-30',
      description: 'Allocate capital fund reserves for waterproofing terraces of Towers A, B, and C before monsoon.',
      options: [{ text: 'Approve Budget', votes: 14 }, { text: 'Reject', votes: 2 }, { text: 'Need Vendor Clarification', votes: 1 }],
      status: 'Active'
    },
    {
      title: 'EV Charging Station Installation in Basement 1',
      category: 'Amenities & Upgrades',
      endDate: '2024-10-15',
      description: 'Partner with Tata Power for 4 dedicated commercial AC fast chargers in visitor parking bay.',
      options: [{ text: 'Yes, Install Chargers', votes: 16 }, { text: 'No, Not Needed', votes: 3 }],
      status: 'Active'
    }
  ];

  const html = list.map(p => {
    const totalVotes = p.options.reduce((sum, o) => sum + (o.votes || 0), 0) || 1;
    return `
      <div class="col-md-6">
        <div class="p-4 rounded-3 h-100" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="badge rounded-pill bg-warning-subtle text-warning fs-9">${p.category || 'Voting Poll'}</span>
            <span class="badge rounded-pill bg-success-subtle text-success fs-9">${p.status || 'Active'}</span>
          </div>
          <h6 class="fw-bold text-white mb-2">${p.title}</h6>
          <p class="text-secondary fs-8 mb-3">${p.description || ''}</p>
          <div class="space-y-2">
            ${p.options.map(opt => {
              const pct = Math.round(((opt.votes || 0) / totalVotes) * 100);
              return `
                <div class="mb-2">
                  <div class="d-flex justify-content-between text-secondary fs-8 mb-1">
                    <span>${opt.text}</span>
                    <span class="fw-bold text-white">${opt.votes || 0} votes (${pct}%)</span>
                  </div>
                  <div class="progress" style="height: 6px; background: rgba(255,255,255,0.08);">
                    <div class="progress-bar bg-warning" style="width: ${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  hosts.forEach(h => {
    if (h) h.innerHTML = html;
  });
}

function bindCommitteePollForm() {
  const form = document.getElementById('createPollForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('pollTitle')?.value || '';
    const category = document.getElementById('pollCategory')?.value || 'General';
    const endDate = document.getElementById('pollEndDate')?.value || '';
    const desc = document.getElementById('pollDesc')?.value || '';
    const optionsRaw = document.getElementById('pollOptionsInput')?.value || '';

    const options = optionsRaw.split(',').map(o => o.trim()).filter(Boolean);

    if (window.SystemDB && SystemDB.addDoc) {
      SystemDB.addDoc('polls', {
        title,
        category,
        description: desc,
        endDate,
        options: options.map(opt => ({ text: opt, votes: 0 })),
        votedUserIds: [],
        status: 'Active'
      }, 'POL');
    }

    if (window.bootstrap) {
      const modalEl = document.getElementById('createPollModal');
      if (modalEl) {
        const inst = bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
      }
    }

    form.reset();
    alert('Voting poll successfully published to all society resident portals!');
    loadCommitteeData();
  });
}

function logout() {
  sessionStorage.clear();
  window.location.href = 'login.html';
}

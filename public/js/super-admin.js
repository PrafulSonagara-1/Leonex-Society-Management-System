/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SocietyHub / Leonex SSMS — Super Admin Client Controller
 * Secure administration portal with Name & Strong Password Auth + MySQL
 * ══════════════════════════════════════════════════════════════════════════════
 */

// Global State
let currentSuperAdminToken = null;
let currentSuperAdminUser = null;
let currentClerkToken = null;
let currentClerkUserId = null;
let currentSelectedSociety = null;
let currentSocietyFilter = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
  await initSuperAdminAuth();
});

/**
 * Initialize Super Admin Authentication & Verification
 */
async function initSuperAdminAuth() {
  const gate = document.getElementById('saSecurityGate');
  const denied = document.getElementById('accessDeniedOverlay');
  const mainApp = document.getElementById('mainAppLayout');

  try {
    // 1. Check for stored Super Admin JWT token in session or local storage
    currentSuperAdminToken =
      sessionStorage.getItem('ssm_super_admin_token') ||
      localStorage.getItem('ssm_super_admin_token');

    const storedUser =
      sessionStorage.getItem('ssm_super_admin_user') ||
      localStorage.getItem('ssm_super_admin_user');

    if (storedUser) {
      try { currentSuperAdminUser = JSON.parse(storedUser); } catch (e) {}
    }

    // 2. Fallback: check Clerk SDK session
    try {
      if (window.Clerk && window.Clerk.user) {
        currentClerkUserId = window.Clerk.user.id;
        if (window.Clerk.session) {
          currentClerkToken = await window.Clerk.session.getToken();
        }
      }
    } catch (e) {}

    // 3. Fallback: check stored dev token
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('clerk_id')) {
      currentClerkUserId = urlParams.get('clerk_id');
      sessionStorage.setItem('ssm_clerk_dev_id', currentClerkUserId);
    } else if (sessionStorage.getItem('ssm_clerk_dev_id')) {
      currentClerkUserId = sessionStorage.getItem('ssm_clerk_dev_id');
    }

    // 4. Verify credentials with the backend
    const authHeaders = getAuthHeaders();
    if (currentSuperAdminToken || currentClerkToken || currentClerkUserId) {
      const resp = await fetch('/api/super-admin/verify', {
        method: 'GET',
        headers: authHeaders
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.authorized) {
          if (data.user) {
            currentSuperAdminUser = data.user;
            sessionStorage.setItem('ssm_super_admin_user', JSON.stringify(data.user));
          }
          revealDashboard(data);
          return;
        }
      }
    }

    // If verification was not successful, display the Super Admin Security Gate
    showSecurityGate();

  } catch (err) {
    console.error('Super Admin Auth verification error:', err);
    showSecurityGate();
  }
}

/**
 * Reveal the Super Admin Dashboard after verified authentication
 */
function revealDashboard(data) {
  const gate = document.getElementById('saSecurityGate');
  const denied = document.getElementById('accessDeniedOverlay');
  const mainApp = document.getElementById('mainAppLayout');

  if (gate) gate.style.display = 'none';
  if (denied) denied.style.display = 'none';
  if (mainApp) mainApp.style.display = 'flex';

  // Populate owner display info
  const user = currentSuperAdminUser || (data && data.user) || {};
  const ownerName = user.name || 'Leonex System Owner';
  const ownerUsername = user.username || 'superadmin';

  // Pre-fill credentials form inputs
  const nameInput = document.getElementById('saInputName');
  const userInput = document.getElementById('saInputUsername');
  if (nameInput) nameInput.value = ownerName;
  if (userInput) userInput.value = ownerUsername;

  const modalName = document.getElementById('modalInputName');
  const modalUser = document.getElementById('modalInputUsername');
  if (modalName) modalName.value = ownerName;
  if (modalUser) modalUser.value = ownerUsername;

  // Initialize sidebar if sidebar.js is loaded
  if (window.leonexInitSidebar) {
    window.leonexInitSidebar();
  }

  // Load initial data
  refreshDashboardData();
  loadSocietiesDropdowns();
}

/**
 * Show Master Security Gate for Name + Strong Password login
 */
async function showSecurityGate() {
  const gate = document.getElementById('saSecurityGate');
  const denied = document.getElementById('accessDeniedOverlay');
  const mainApp = document.getElementById('mainAppLayout');

  if (mainApp) mainApp.style.display = 'none';
  if (denied) denied.style.display = 'none';
  if (gate) gate.style.display = 'flex';

  // Fetch configured username/name for pre-fill
  try {
    const res = await fetch('/api/super-admin/auth/status');
    if (res.ok) {
      const status = await res.json();
      if (status.username) {
        const uInput = document.getElementById('gateUsername');
        if (uInput && (!uInput.value || uInput.value === 'superadmin')) {
          uInput.value = status.username;
        }
      }
    }
  } catch (e) {}

  const passInput = document.getElementById('gatePassword');
  if (passInput) {
    passInput.value = '';
    setTimeout(() => passInput.focus(), 150);
  }
}

/**
 * Handle Super Admin Login from Master Security Gate
 */
async function handleSecurityGateLogin(event) {
  event.preventDefault();
  const username = document.getElementById('gateUsername')?.value.trim();
  const password = document.getElementById('gatePassword')?.value;
  const remember = document.getElementById('gateRememberMe')?.checked;
  const submitBtn = document.getElementById('gateUnlockBtn');
  const errorBox = document.getElementById('gateErrorAlert');
  const errorMsg = document.getElementById('gateErrorMessage');

  if (!username || !password) {
    if (errorBox) {
      errorBox.classList.remove('d-none');
      if (errorMsg) errorMsg.textContent = 'Please enter both your name/username and strong password.';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Verifying Credentials…';
  }
  if (errorBox) errorBox.classList.add('d-none');

  try {
    const resp = await fetch('/api/super-admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await resp.json();

    if (resp.ok && data.success && data.token) {
      // Store token & user profile
      currentSuperAdminToken = data.token;
      currentSuperAdminUser = data.user;

      sessionStorage.setItem('ssm_super_admin_token', data.token);
      sessionStorage.setItem('ssm_super_admin_user', JSON.stringify(data.user));
      sessionStorage.setItem('ssm_auth_token', data.token);
      sessionStorage.setItem('ssm_current_user', JSON.stringify({
        id: data.user.id || 'superadmin',
        name: data.user.name,
        role: 'Super Admin',
        authProvider: 'system_owner'
      }));

      if (remember) {
        localStorage.setItem('ssm_super_admin_token', data.token);
        localStorage.setItem('ssm_super_admin_user', JSON.stringify(data.user));
      }

      showToast(`Master access granted! Welcome, ${data.user.name}`, 'success');
      revealDashboard(data);
    } else {
      if (errorBox) {
        errorBox.classList.remove('d-none');
        if (errorMsg) errorMsg.textContent = data.message || 'Invalid Super Admin credentials. Please check your password.';
      }
    }
  } catch (err) {
    console.error('Super Admin login error:', err);
    if (errorBox) {
      errorBox.classList.remove('d-none');
      if (errorMsg) errorMsg.textContent = 'Server connection error. Please verify the backend is active.';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-lock-open me-2"></i> Unlock Master Dashboard';
    }
  }
}

/**
 * 1-Click Fill Default Master Credentials
 */
function autoFillDefaultCredentials() {
  const uInput = document.getElementById('gateUsername');
  const pInput = document.getElementById('gatePassword');
  if (uInput) uInput.value = 'superadmin';
  if (pInput) pInput.value = 'SuperAdmin@2026!';
  showToast('Filled default master credentials: superadmin / SuperAdmin@2026!', 'info');
}

/**
 * Toggle Password Visibility on any password field
 */
function togglePassVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  }
}

/**
 * Password Strength Evaluator
 * Checks: 8+ chars, uppercase, lowercase, number, symbol
 */
function evaluatePasswordStrength(password) {
  const hasLen = Boolean(password && password.length >= 8);
  const hasUpper = Boolean(/[A-Z]/.test(password || ''));
  const hasLower = Boolean(/[a-z]/.test(password || ''));
  const hasNum = Boolean(/[0-9]/.test(password || ''));
  const hasSym = Boolean(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password || ''));

  const score = [hasLen, hasUpper, hasLower, hasNum, hasSym].filter(Boolean).length;
  return { score, hasLen, hasUpper, hasLower, hasNum, hasSym, isStrong: score === 5 };
}

/**
 * Real-time Password Strength UI handler
 */
function onNewPasswordInput(password, scope) {
  const prefix = scope === 'modal' ? 'modal' : 'settings';
  const label = document.getElementById(`${prefix}StrengthLabel`);
  const bar = document.getElementById(`${prefix}StrengthBar`);

  const { score, hasLen, hasUpper, hasLower, hasNum, hasSym } = evaluatePasswordStrength(password);

  // Update requirement chips
  const updateChip = (id, valid) => {
    const el = document.getElementById(id);
    if (el) {
      if (valid) el.classList.add('badge-rule-passed');
      else el.classList.remove('badge-rule-passed');
    }
  };

  if (scope === 'modal') {
    updateChip('modal-chip-len', hasLen);
    updateChip('modal-chip-upper', hasUpper);
    updateChip('modal-chip-lower', hasLower);
    updateChip('modal-chip-num', hasNum);
    updateChip('modal-chip-sym', hasSym);
  } else {
    updateChip('chip-len', hasLen);
    updateChip('chip-upper', hasUpper);
    updateChip('chip-lower', hasLower);
    updateChip('chip-num', hasNum);
    updateChip('chip-sym', hasSym);
  }

  // Update progress bar
  const pct = (score / 5) * 100;
  if (bar) {
    bar.style.width = `${pct}%`;
    if (score <= 2) bar.style.backgroundColor = '#EF4444'; // Red
    else if (score <= 4) bar.style.backgroundColor = '#F59E0B'; // Amber
    else bar.style.backgroundColor = '#10B981'; // Green
  }

  // Update text label
  if (label) {
    if (!password) {
      label.textContent = 'Enter password';
      label.style.color = '#64748B';
    } else if (score <= 2) {
      label.textContent = 'Weak (Needs complexity)';
      label.style.color = '#EF4444';
    } else if (score <= 4) {
      label.textContent = 'Moderate (Almost there)';
      label.style.color = '#F59E0B';
    } else {
      label.textContent = 'Very Strong & Secure ✓';
      label.style.color = '#10B981';
    }
  }

  checkConfirmPasswordMatch(scope);
}

/**
 * Check if confirm password matches new password
 */
function checkConfirmPasswordMatch(scope) {
  const prefix = scope === 'modal' ? 'modal' : 'settings';
  const newPass = document.getElementById(`${prefix === 'modal' ? 'modalInputNewPass' : 'saInputNewPass'}`)?.value || '';
  const confirmPass = document.getElementById(`${prefix === 'modal' ? 'modalInputConfirmPass' : 'saInputConfirmPass'}`)?.value || '';
  const feedback = document.getElementById(`${prefix}MatchFeedback`);

  if (!feedback) return;

  if (!confirmPass) {
    feedback.style.color = 'transparent';
    feedback.innerHTML = '&nbsp;';
  } else if (newPass === confirmPass) {
    feedback.style.color = '#10B981';
    feedback.innerHTML = '<i class="fa-solid fa-check me-1"></i> Passwords match.';
  } else {
    feedback.style.color = '#EF4444';
    feedback.innerHTML = '<i class="fa-solid fa-xmark me-1"></i> Passwords do not match.';
  }
}

/**
 * Update Super Admin Credentials & Strong Password (from Settings tab)
 */
async function handleUpdateCredentials(event) {
  event.preventDefault();
  const currentPassword = document.getElementById('saInputCurrentPass')?.value;
  const newName = document.getElementById('saInputName')?.value.trim();
  const newUsername = document.getElementById('saInputUsername')?.value.trim();
  const newPassword = document.getElementById('saInputNewPass')?.value;
  const confirmPassword = document.getElementById('saInputConfirmPass')?.value;
  const saveBtn = document.getElementById('saveCredsBtn');

  if (!currentPassword) {
    showToast('Current password is required to verify your identity.', 'warning');
    return;
  }

  if (newPassword) {
    if (newPassword !== confirmPassword) {
      showToast('New password and confirm password do not match.', 'danger');
      return;
    }
    const { isStrong } = evaluatePasswordStrength(newPassword);
    if (!isStrong) {
      showToast('New password must satisfy all 5 strong password requirements.', 'warning');
      return;
    }
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Saving Credentials…';
  }

  try {
    const res = await fetch('/api/super-admin/auth/change-credentials', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        currentPassword,
        newName,
        newUsername,
        newPassword
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      if (data.token) {
        currentSuperAdminToken = data.token;
        sessionStorage.setItem('ssm_super_admin_token', data.token);
        if (localStorage.getItem('ssm_super_admin_token')) {
          localStorage.setItem('ssm_super_admin_token', data.token);
        }
      }
      if (data.user) {
        currentSuperAdminUser = data.user;
        sessionStorage.setItem('ssm_super_admin_user', JSON.stringify(data.user));
      }

      showToast('Super Admin credentials and strong password updated successfully!', 'success');
      resetCredentialsForm();
    } else {
      showToast(data.message || 'Failed to update credentials.', 'danger');
    }
  } catch (err) {
    console.error('Update credentials error:', err);
    showToast('Server error while saving credentials.', 'danger');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Save New Strong Password';
    }
  }
}

/**
 * Update Super Admin Credentials & Strong Password (from Navbar Modal)
 */
async function handleModalUpdateCredentials(event) {
  event.preventDefault();
  const currentPassword = document.getElementById('modalInputCurrentPass')?.value;
  const newName = document.getElementById('modalInputName')?.value.trim();
  const newUsername = document.getElementById('modalInputUsername')?.value.trim();
  const newPassword = document.getElementById('modalInputNewPass')?.value;
  const confirmPassword = document.getElementById('modalInputConfirmPass')?.value;
  const saveBtn = document.getElementById('modalSaveCredsBtn');

  if (!currentPassword) {
    showToast('Current password is required to verify identity.', 'warning');
    return;
  }

  if (newPassword) {
    if (newPassword !== confirmPassword) {
      showToast('New password and confirm password do not match.', 'danger');
      return;
    }
    const { isStrong } = evaluatePasswordStrength(newPassword);
    if (!isStrong) {
      showToast('New password must satisfy all 5 strong password requirements.', 'warning');
      return;
    }
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> Updating…';
  }

  try {
    const res = await fetch('/api/super-admin/auth/change-credentials', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        currentPassword,
        newName,
        newUsername,
        newPassword
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      if (data.token) {
        currentSuperAdminToken = data.token;
        sessionStorage.setItem('ssm_super_admin_token', data.token);
      }
      if (data.user) {
        currentSuperAdminUser = data.user;
        sessionStorage.setItem('ssm_super_admin_user', JSON.stringify(data.user));
      }

      showToast('Super Admin strong password updated successfully!', 'success');

      // Close modal
      const modalEl = document.getElementById('saCredentialsModal');
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        const modalInstance = window.bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
      }

      // Reset modal password fields
      const p1 = document.getElementById('modalInputCurrentPass');
      const p2 = document.getElementById('modalInputNewPass');
      const p3 = document.getElementById('modalInputConfirmPass');
      if (p1) p1.value = '';
      if (p2) p2.value = '';
      if (p3) p3.value = '';
    } else {
      showToast(data.message || 'Failed to update credentials.', 'danger');
    }
  } catch (err) {
    console.error('Update credentials modal error:', err);
    showToast('Server error while saving credentials.', 'danger');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Update Strong Password';
    }
  }
}

/**
 * Open Credentials Modal from Navbar
 */
function openCredentialsModal() {
  const modalEl = document.getElementById('saCredentialsModal');
  if (!modalEl) return;

  const user = currentSuperAdminUser || {};
  const modalName = document.getElementById('modalInputName');
  const modalUser = document.getElementById('modalInputUsername');
  if (modalName) modalName.value = user.name || 'Leonex System Owner';
  if (modalUser) modalUser.value = user.username || 'superadmin';

  if (window.bootstrap && window.bootstrap.Modal) {
    const modal = new window.bootstrap.Modal(modalEl);
    modal.show();
  }
}

/**
 * Reset Credentials Form fields
 */
function resetCredentialsForm() {
  const p1 = document.getElementById('saInputCurrentPass');
  const p2 = document.getElementById('saInputNewPass');
  const p3 = document.getElementById('saInputConfirmPass');
  if (p1) p1.value = '';
  if (p2) p2.value = '';
  if (p3) p3.value = '';
  onNewPasswordInput('', 'settings');
}

/**
 * Standard Auth Request Headers with Super Admin JWT or Clerk token
 */
function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (currentSuperAdminToken) {
    headers['Authorization'] = `Bearer ${currentSuperAdminToken}`;
  } else if (currentClerkToken) {
    headers['Authorization'] = `Bearer ${currentClerkToken}`;
  }
  if (currentClerkUserId) {
    headers['x-clerk-user-id'] = currentClerkUserId;
    if (!headers['Authorization']) {
      headers['Authorization'] = `Bearer ${currentClerkUserId}`;
    }
  }
  return headers;
}

/**
 * Sign Out
 */
async function handleSuperAdminLogout() {
  try {
    if (currentClerkUserId) {
      fetch('/api/auth/clerk-logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkUserId: currentClerkUserId })
      }).catch(() => {});
    }
    if (window.Clerk && typeof window.Clerk.signOut === 'function') {
      await window.Clerk.signOut();
    }
  } catch (e) {}

  currentSuperAdminToken = null;
  currentSuperAdminUser = null;
  sessionStorage.removeItem('ssm_super_admin_token');
  sessionStorage.removeItem('ssm_super_admin_user');
  sessionStorage.removeItem('ssm_clerk_dev_id');
  localStorage.removeItem('ssm_super_admin_token');
  localStorage.removeItem('ssm_super_admin_user');

  showToast('Logged out from Super Admin Control Center.', 'info');
  setTimeout(() => {
    window.location.reload();
  }, 400);
}
window.superAdminLogout = handleSuperAdminLogout;

// ══════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ══════════════════════════════════════════════════════════════

async function refreshDashboardData() {
  try {
    const res = await fetch('/api/super-admin/dashboard', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load dashboard metrics');
    const data = await res.json();

    const m = data.metrics || {};

    // Societies metrics
    setText('dashTotalSocieties', m.totalSocieties || 0);
    setText('dashActiveSocieties', m.activeSocieties || 0);
    setText('dashInactiveSocieties', m.inactiveSocieties || 0);
    setText('dashSuspendedSocieties', m.suspendedSocieties || 0);

    // Users metrics
    setText('dashTotalUsers', m.totalUsers || 0);
    setText('dashResidents', m.totalResidents || 0);
    setText('dashSecretaries', m.totalSecretaries || 0);
    setText('dashGuards', m.totalGuards || 0);
    setText('dashCommittee', m.totalCommittee || 0);

    // Render Recent Login Activity table
    renderDashRecentLogins(data.recentLogins || []);

    // Render Recent Society Activity table
    renderDashRecentSocieties(data.recentSocieties || []);

  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to sync platform metrics: ' + err.message, 'danger');
  }
}

function renderDashRecentLogins(logins) {
  const tbody = document.getElementById('dashRecentLoginsBody');
  if (!tbody) return;

  if (!logins || logins.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-secondary">No recent login records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = logins.map(l => {
    const { date, time } = formatDateTime(l.login_at);
    return `
      <tr>
        <td class="fw-bold text-white">${escapeHtml(l.user_name || 'Member')}</td>
        <td><span class="sa-role-badge sa-role-${(l.role || 'RESIDENT').toLowerCase()}">${formatRole(l.role)}</span></td>
        <td><span class="text-secondary">${escapeHtml(l.society_name || l.society_id || 'Platform')}</span></td>
        <td class="text-secondary fs-8">${escapeHtml(l.email || 'N/A')}</td>
        <td class="text-white fs-8">${date}</td>
        <td class="text-secondary fs-8">${time}</td>
      </tr>
    `;
  }).join('');
}

function renderDashRecentSocieties(societies) {
  const tbody = document.getElementById('dashRecentSocietiesBody');
  if (!tbody) return;

  if (!societies || societies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-secondary">No societies registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = societies.map(s => {
    const { date } = formatDateTime(s.created_at);
    return `
      <tr>
        <td>
          <div class="fw-bold text-white">${escapeHtml(s.society_name)}</div>
          <span class="sa-badge-soc mt-1">${escapeHtml(s.society_id)}</span>
        </td>
        <td>${getStatusPill(s.status)}</td>
        <td class="text-secondary fs-8">${escapeHtml(s.secretary_name || 'Unassigned')}</td>
        <td class="text-secondary fs-8">${date}</td>
        <td class="text-end fw-bold text-white fs-7">${s.total_users_count || 0}</td>
      </tr>
    `;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// SOCIETIES MANAGEMENT VIEW
// ══════════════════════════════════════════════════════════════

async function loadSocietiesView() {
  const tbody = document.getElementById('societiesTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-secondary"><div class="spinner-border spinner-border-sm text-warning me-2"></div>Loading societies...</td></tr>`;

  try {
    const search = (document.getElementById('socSearchInput')?.value || '').trim();
    let url = `/api/super-admin/societies?status=${encodeURIComponent(currentSocietyFilter)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch societies');
    const data = await res.json();
    const list = data.societies || [];

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-secondary">No societies match the selected criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(s => {
      const { date } = formatDateTime(s.created_at);
      return `
        <tr>
          <td><span class="sa-badge-soc">${escapeHtml(s.society_id)}</span></td>
          <td class="fw-bold text-white">${escapeHtml(s.society_name)}</td>
          <td>
            <div class="text-white fs-8 fw-semibold">${escapeHtml(s.secretary_name || 'Unassigned')}</div>
            <div class="text-secondary fs-9">${escapeHtml(s.secretary_email || 'N/A')}</div>
          </td>
          <td class="text-end fw-bold text-success">${s.residents_count || 0}</td>
          <td class="text-end fw-bold text-warning">${s.guards_count || 0}</td>
          <td class="text-end fw-bold text-info" style="color: #C084FC !important;">${s.committee_count || 0}</td>
          <td>${getStatusPill(s.status)}</td>
          <td class="text-secondary fs-8">${date}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-warning rounded-pill px-3 py-1 fs-8" onclick="openSocietyDetailModal('${escapeHtml(s.society_id)}')">
              <i class="fa-solid fa-eye me-1"></i> Details
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading societies:', err);
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger">Failed to load societies: ${err.message}</td></tr>`;
  }
}

function setSocietyStatusFilter(status, btn) {
  currentSocietyFilter = status;
  const group = document.getElementById('socStatusFilterGroup');
  if (group) {
    group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  loadSocietiesView();
}

function switchSocietyTab(status) {
  triggerNavTab('tab-sa-societies-btn');
  currentSocietyFilter = status;
  const group = document.getElementById('socStatusFilterGroup');
  if (group) {
    group.querySelectorAll('button').forEach(b => {
      if (b.textContent.trim().toUpperCase() === status || (status === 'ALL' && b.textContent.trim() === 'All')) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }
  loadSocietiesView();
}

async function openSocietyDetailModal(societyId) {
  try {
    const res = await fetch(`/api/super-admin/societies/${encodeURIComponent(societyId)}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load society details');
    const data = await res.json();
    const s = data.society;
    currentSelectedSociety = s;

    setText('modalSocId', s.society_id);
    setText('modalSocName', s.society_name);
    setText('modalSocAddress', s.address);
    setText('modalSocSecretary', s.secretary_name || 'Unassigned');
    setText('modalSocSecEmail', s.secretary_email || 'No email assigned');
    setText('modalSocRegistered', formatDateTime(s.created_at).full);
    document.getElementById('modalSocStatusPill').innerHTML = getStatusPill(s.status);

    setText('modalSocResCount', s.residents_count || 0);
    setText('modalSocGrdCount', s.guards_count || 0);
    setText('modalSocCmtCount', s.committee_count || 0);

    const modalEl = document.getElementById('societyDetailModal');
    if (modalEl && window.bootstrap) {
      new bootstrap.Modal(modalEl).show();
    }
  } catch (err) {
    showToast('Failed to open society details: ' + err.message, 'danger');
  }
}

async function changeModalSocietyStatus(newStatus) {
  if (!currentSelectedSociety) return;
  try {
    const res = await fetch(`/api/super-admin/societies/${encodeURIComponent(currentSelectedSociety.society_id)}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update status');

    currentSelectedSociety.status = newStatus;
    document.getElementById('modalSocStatusPill').innerHTML = getStatusPill(newStatus);
    showToast(`Society ${currentSelectedSociety.society_id} status updated to ${newStatus}.`, 'success');
    loadSocietiesView();
    refreshDashboardData();
  } catch (err) {
    showToast('Failed to update status: ' + err.message, 'danger');
  }
}

async function handleCreateSociety(e) {
  e.preventDefault();
  const name = document.getElementById('newSocName')?.value.trim();
  const address = document.getElementById('newSocAddress')?.value.trim();
  const adminId = document.getElementById('newSocAdminId')?.value.trim() || null;
  const saveBtn = document.getElementById('saveSocBtn');

  if (!name || !address) {
    showToast('Please provide society name and address.', 'warning');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
  }

  try {
    const res = await fetch('/api/super-admin/societies', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ society_name: name, address, admin_clerk_user_id: adminId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create society');

    showToast(`Society ${data.society.society_id} (${data.society.society_name}) registered successfully!`, 'success');
    document.getElementById('createSocietyForm')?.reset();

    const modalEl = document.getElementById('addSocietyModal');
    if (modalEl && window.bootstrap) {
      bootstrap.Modal.getInstance(modalEl)?.hide();
    }

    loadSocietiesView();
    loadSocietiesDropdowns();
    refreshDashboardData();
  } catch (err) {
    showToast('Registration error: ' + err.message, 'danger');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = 'Register Society';
    }
  }
}

// ══════════════════════════════════════════════════════════════
// ALL USERS VIEW
// ══════════════════════════════════════════════════════════════

async function loadUsersView() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-secondary"><div class="spinner-border spinner-border-sm text-warning me-2"></div>Loading users directory...</td></tr>`;

  try {
    const role = document.getElementById('userRoleFilter')?.value || 'ALL';
    const status = document.getElementById('userStatusFilter')?.value || 'ALL';
    const societyId = document.getElementById('userSocietyFilter')?.value || 'ALL';
    const search = (document.getElementById('userSearchInput')?.value || '').trim();

    let url = `/api/super-admin/users?role=${encodeURIComponent(role)}&status=${encodeURIComponent(status)}&society_id=${encodeURIComponent(societyId)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    const users = data.users || [];

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-secondary">No users found matching the selected filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const reg = formatDateTime(u.registered_at).date;
      const lastLogin = u.last_login_at ? formatDateTime(u.last_login_at).full : 'Never';
      const isSuperAdminUser = u.role === 'SUPER_ADMIN';

      return `
        <tr>
          <td>
            <div class="fw-bold text-white">${escapeHtml(u.name)}</div>
            <div class="text-secondary fs-9 font-monospace">${escapeHtml(u.clerk_user_id)}</div>
          </td>
          <td class="text-secondary fs-8">${escapeHtml(u.email || 'N/A')}</td>
          <td><span class="sa-role-badge sa-role-${(u.role || 'RESIDENT').toLowerCase()}">${formatRole(u.role)}</span></td>
          <td>
            ${u.society_id ? `<span class="sa-badge-soc me-1">${escapeHtml(u.society_id)}</span>` : ''}
            <span class="text-white fs-8">${escapeHtml(u.society_name || (u.society_id ? u.society_id : 'Platform'))}</span>
          </td>
          <td class="text-secondary fs-8">${reg}</td>
          <td class="text-secondary fs-8">${lastLogin}</td>
          <td>${getStatusPill(u.status)}</td>
          <td class="text-end">
            ${isSuperAdminUser ? '<span class="badge bg-dark border border-secondary text-secondary">Protected</span>' : `
              <div class="dropdown d-inline-block">
                <button class="btn btn-sm btn-outline-secondary dropdown-toggle rounded-pill px-2 py-1 fs-8" type="button" data-bs-toggle="dropdown">
                  Status
                </button>
                <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end">
                  <li><a class="dropdown-item fs-8" href="javascript:void(0)" onclick="changeUserStatus('${escapeHtml(u.clerk_user_id)}', 'ACTIVE')"><i class="fa-solid fa-circle-check text-success me-2"></i>ACTIVE</a></li>
                  <li><a class="dropdown-item fs-8" href="javascript:void(0)" onclick="changeUserStatus('${escapeHtml(u.clerk_user_id)}', 'INACTIVE')"><i class="fa-solid fa-circle-pause text-secondary me-2"></i>INACTIVE</a></li>
                  <li><a class="dropdown-item fs-8" href="javascript:void(0)" onclick="changeUserStatus('${escapeHtml(u.clerk_user_id)}', 'SUSPENDED')"><i class="fa-solid fa-ban text-danger me-2"></i>SUSPENDED</a></li>
                </ul>
              </div>
            `}
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading users:', err);
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Failed to load users: ${err.message}</td></tr>`;
  }
}

function switchUserTab(role) {
  triggerNavTab('tab-sa-users-btn');
  const roleSelect = document.getElementById('userRoleFilter');
  if (roleSelect) {
    roleSelect.value = role;
  }
  loadUsersView();
}

async function changeUserStatus(clerkUserId, newStatus) {
  try {
    const res = await fetch(`/api/super-admin/users/${encodeURIComponent(clerkUserId)}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update user status');

    showToast(`User status updated to ${newStatus}.`, 'success');
    loadUsersView();
    refreshDashboardData();
  } catch (err) {
    showToast('Failed to update status: ' + err.message, 'danger');
  }
}

// ══════════════════════════════════════════════════════════════
// LOGIN ACTIVITY VIEW
// ══════════════════════════════════════════════════════════════

async function loadLoginActivityView() {
  const tbody = document.getElementById('loginHistoryTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-secondary"><div class="spinner-border spinner-border-sm text-warning me-2"></div>Loading login history...</td></tr>`;

  try {
    const timeframe = document.getElementById('loginTimeframeFilter')?.value || '';
    const societyId = document.getElementById('loginSocietyFilter')?.value || 'ALL';
    const role = document.getElementById('loginRoleFilter')?.value || 'ALL';
    const search = (document.getElementById('loginSearchInput')?.value || '').trim();

    let url = `/api/super-admin/login-history?limit=150`;
    if (timeframe) url += `&timeframe=${encodeURIComponent(timeframe)}`;
    if (societyId && societyId !== 'ALL') url += `&society_id=${encodeURIComponent(societyId)}`;
    if (role && role !== 'ALL') url += `&role=${encodeURIComponent(role)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch login history');
    const data = await res.json();
    const logs = data.loginHistory || [];

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-secondary">No login events match the selected filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const loginDt = formatDateTime(l.login_at);
      const logoutDt = l.logout_at ? formatDateTime(l.logout_at).time : '<span class="text-success fs-9"><span class="live-dot me-1" style="width:6px;height:6px;"></span>Active</span>';

      return `
        <tr>
          <td>
            <div class="fw-bold text-white">${escapeHtml(l.user_name || 'Member')}</div>
            <div class="text-secondary fs-9 font-monospace">${escapeHtml(l.clerk_user_id)}</div>
          </td>
          <td class="text-secondary fs-8">${escapeHtml(l.email || 'N/A')}</td>
          <td><span class="sa-role-badge sa-role-${(l.role || 'RESIDENT').toLowerCase()}">${formatRole(l.role)}</span></td>
          <td>
            ${l.society_id ? `<span class="sa-badge-soc me-1">${escapeHtml(l.society_id)}</span>` : ''}
            <span class="text-white fs-8">${escapeHtml(l.society_name || (l.society_id ? l.society_id : 'Platform'))}</span>
          </td>
          <td class="text-white fs-8">${loginDt.date}</td>
          <td class="text-secondary fs-8">${loginDt.time}</td>
          <td class="text-secondary fs-8">${logoutDt}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading login history:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load login history: ${err.message}</td></tr>`;
  }
}

// ══════════════════════════════════════════════════════════════
// DROPDOWNS & NAVIGATION HELPERS
// ══════════════════════════════════════════════════════════════

async function loadSocietiesDropdowns() {
  try {
    const res = await fetch('/api/super-admin/societies', { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const societies = data.societies || [];

    const userSelect = document.getElementById('userSocietyFilter');
    const loginSelect = document.getElementById('loginSocietyFilter');

    const optionsHtml = `<option value="ALL">All Societies</option>` +
      societies.map(s => `<option value="${escapeHtml(s.society_id)}">${escapeHtml(s.society_name)} (${s.society_id})</option>`).join('');

    if (userSelect) userSelect.innerHTML = optionsHtml;
    if (loginSelect) loginSelect.innerHTML = optionsHtml;
  } catch (e) {}
}

function triggerNavTab(tabBtnId) {
  const btn = document.getElementById(tabBtnId);
  if (btn) {
    if (window.bootstrap && bootstrap.Tab) {
      bootstrap.Tab.getOrCreateInstance(btn).show();
    } else {
      btn.click();
    }
  }
}

// ══════════════════════════════════════════════════════════════
// FORMATTERS & UTILITIES
// ══════════════════════════════════════════════════════════════

function formatDateTime(isoString) {
  if (!isoString) return { date: '-', time: '-', full: '-' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: isoString, time: '', full: isoString };

    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date, time, full: `${date} at ${time}` };
  } catch (e) {
    return { date: isoString, time: '', full: isoString };
  }
}

function getStatusPill(status) {
  const s = (status || 'ACTIVE').toUpperCase();
  let cls = 'sa-status-active';
  let icon = 'fa-circle-check';
  if (s === 'INACTIVE') { cls = 'sa-status-inactive'; icon = 'fa-circle-pause'; }
  if (s === 'SUSPENDED') { cls = 'sa-status-suspended'; icon = 'fa-ban'; }
  return `<span class="sa-status-pill ${cls}"><i class="fa-solid ${icon}"></i>${s}</span>`;
}

function formatRole(role) {
  const r = (role || 'RESIDENT').toUpperCase();
  const map = {
    'SUPER_ADMIN': 'Super Admin',
    'SECRETARY': 'Secretary',
    'RESIDENT': 'Resident',
    'GUARD': 'Guard',
    'COMMITTEE': 'Committee'
  };
  return map[r] || r;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:380px;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg = type === 'success' ? '#10B981' : (type === 'danger' ? '#EF4444' : (type === 'warning' ? '#F59E0B' : '#D4955A'));
  const icon = type === 'success' ? 'fa-circle-check' : (type === 'danger' ? 'fa-circle-xmark' : (type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info'));

  toast.style.cssText = `background:#101625;border:1px solid ${bg};color:#fff;padding:12px 18px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,0.6);display:flex;align-items:center;gap:12px;font-size:13px;animation:fadeUp 0.3s ease;`;
  toast.innerHTML = `
    <i class="fa-solid ${icon}" style="color:${bg};font-size:18px;"></i>
    <span style="flex:1;line-height:1.4;">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function toggleMaintenanceMode(isLocked) {
  showToast(isLocked ? 'Maintenance Lock Activated. Society members will see a maintenance notice.' : 'Maintenance Lock Deactivated. Platform operational.', isLocked ? 'warning' : 'success');
}

// Hook up tab change listeners to auto-load tab content
document.addEventListener('DOMContentLoaded', () => {
  const socTabBtn = document.getElementById('tab-sa-societies-btn');
  const usrTabBtn = document.getElementById('tab-sa-users-btn');
  const logTabBtn = document.getElementById('tab-sa-logs-btn');

  if (socTabBtn) socTabBtn.addEventListener('shown.bs.tab', loadSocietiesView);
  if (usrTabBtn) usrTabBtn.addEventListener('shown.bs.tab', loadUsersView);
  if (logTabBtn) logTabBtn.addEventListener('shown.bs.tab', loadLoginActivityView);
});

// Explicitly bind to window for HTML onclick and sidebar interaction
window.triggerNavTab = triggerNavTab;
window.switchSocietyTab = switchSocietyTab;
window.switchUserTab = switchUserTab;
window.setSocietyStatusFilter = setSocietyStatusFilter;
window.openSocietyDetailModal = openSocietyDetailModal;
window.changeModalSocietyStatus = changeModalSocietyStatus;
window.changeUserStatus = changeUserStatus;
window.debounce = debounce;
window.loadSocietiesView = loadSocietiesView;
window.loadUsersView = loadUsersView;
window.loadLoginActivityView = loadLoginActivityView;
window.refreshDashboardData = refreshDashboardData;
window.toggleMaintenanceMode = toggleMaintenanceMode;
window.handleCreateSociety = handleCreateSociety;
window.loginAsDevSuperAdmin = loginAsDevSuperAdmin;
window.triggerClerkSignIn = triggerClerkSignIn;


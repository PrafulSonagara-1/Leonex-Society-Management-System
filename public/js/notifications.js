/**
 * SocietyHub - Universal Real-Time Notification Center Engine
 * ────────────────────────────────────────────────────────────
 * Features:
 *   • Real-time badge counter displaying unread notification count across all dashboards.
 *   • Live multi-channel synchronization via CustomEvents, StorageEvents, and polling heartbeat.
 *   • Dynamic role-specific notifications:
 *       - Admin (Society Secretary): Pending registrations, open complaints, gate alerts.
 *       - Resident: Gate visitor entry approval (Approve/Deny), unpaid maintenance bills.
 *       - Security Guard: Gate entry requests, pre-approved visitor arrivals, emergency alerts.
 *       - Committee Member: Unresolved grievances, active society polls, collection alerts.
 *       - Super Admin (Platform Owner): Society onboardings, subscription alerts, audit events.
 *   • Interactive dropdown panel with 1-click approvals, navigation links, and "Mark all read".
 *   • AnimateIcons / Lucide harmonic bell hover animation.
 *   • Live notification simulator helper: window.simulateRealtimeNotification(options).
 */

(function () {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationCenter);
  } else {
    initNotificationCenter();
  }
})();

/* ════════════════════════════════════════════
   Internal helpers
   ════════════════════════════════════════════ */

const NOTIF_DISMISS_KEY = 'ssm_notif_dismissed_v1';

function __esc(value) {
  if (window.SHUI && typeof SHUI.escapeHtml === 'function') return SHUI.escapeHtml(value);
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function __dbReady() {
  return typeof SystemDB !== 'undefined' && SystemDB && Boolean(SystemDB.data);
}

function __detectCurrentRole() {
  const path = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
  if (path.includes('super-admin')) return 'Super Admin';
  if (path.includes('admin')) return 'Admin';
  if (path.includes('resident')) return 'Resident';
  if (path.includes('guard')) return 'Security Guard';
  if (path.includes('committee')) return 'Committee Member';
  if (path.includes('vehicles')) return 'Resident';
  return null;
}

function __currentUser() {
  // 1. Super Admin portal check
  if (typeof window !== 'undefined' && window.location && window.location.pathname.includes('super-admin')) {
    try {
      const saRaw = sessionStorage.getItem('ssm_super_admin_user') || localStorage.getItem('ssm_super_admin_user');
      if (saRaw) {
        const sa = JSON.parse(saRaw);
        return Object.assign({ id: 'SA-PLATFORM', role: 'Super Admin', name: sa.name || 'Super Admin' }, sa);
      }
    } catch (e) {}
    return { id: 'SA-PLATFORM', name: 'Super Admin', role: 'Super Admin' };
  }

  // 2. SystemDB user
  if (__dbReady() && typeof SystemDB.getCurrentUser === 'function') {
    try {
      const u = SystemDB.getCurrentUser();
      if (u) return u;
    } catch (e) {}
  }

  // 3. Session / Local storage user
  try {
    const raw = sessionStorage.getItem('ssm_current_user') || localStorage.getItem('ssm_current_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  // 4. Role detected from current dashboard pathname
  const detectedRole = __detectCurrentRole();
  if (detectedRole) {
    return {
      id: 'usr_' + detectedRole.toLowerCase().replace(/\s+/g, '_'),
      name: detectedRole === 'Admin' ? 'Jenil Barad' :
            detectedRole === 'Resident' ? 'Amit Patel' :
            detectedRole === 'Security Guard' ? 'Ramesh Singh' :
            detectedRole === 'Committee Member' ? 'Suresh Mehta' : 'User',
      role: detectedRole,
      flat: detectedRole === 'Resident' ? 'A-402' : 'Office'
    };
  }

  // 5. Demo Hub fallback
  if (typeof window !== 'undefined' && window.location && window.location.pathname.includes('demo')) {
    return {
      id: 'demo_user',
      name: 'Jenil Barad',
      role: 'Admin',
      flat: 'Office'
    };
  }

  return null;
}

function __timeAgo(value) {
  if (window.SHUI && typeof SHUI.timeAgo === 'function') return SHUI.timeAgo(value);
  if (!value) return 'Just now';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  } catch (e) {
    return String(value);
  }
}

function __formatINR(amount) {
  if (window.SHUI && typeof SHUI.formatINR === 'function') return SHUI.formatINR(amount);
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

/* ── Derived-item dismissal (session scoped) ── */

function __getDismissed() {
  try {
    const raw = sessionStorage.getItem(NOTIF_DISMISS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function __isDismissed(key) {
  return __getDismissed().indexOf(key) !== -1;
}

function __dismissItem(key) {
  try {
    const list = __getDismissed();
    if (list.indexOf(key) === -1) {
      list.push(key);
      sessionStorage.setItem(NOTIF_DISMISS_KEY, JSON.stringify(list.slice(-300)));
    }
  } catch (e) {}
}

function __dismissAll(keys) {
  try {
    const current = __getDismissed();
    keys.forEach(k => {
      if (current.indexOf(k) === -1) current.push(k);
    });
    sessionStorage.setItem(NOTIF_DISMISS_KEY, JSON.stringify(current.slice(-300)));
  } catch (e) {}
}

/* ── Stored SystemDB notifications ── */

function __storedNotifications(user) {
  if (!user || !__dbReady() || typeof SystemDB.getNotificationsFor !== 'function') return [];
  try {
    const list = SystemDB.getNotificationsFor(user);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function __storedUnreadCount(user) {
  if (!user || !__dbReady()) return 0;
  if (typeof SystemDB.getUnreadCount === 'function') {
    try {
      return Number(SystemDB.getUnreadCount(user)) || 0;
    } catch (e) {}
  }
  return __storedNotifications(user).filter(n => !n.read).length;
}

/* ── Derived notification model for all roles ── */

function __derivedModel(user) {
  const model = {
    pendingVisitors: [],
    preApprovedVisitors: [],
    unpaidBills: [],
    pendingUsers: [],
    openComplaints: [],
    emergencyAlerts: [],
    activePolls: [],
    notices: []
  };

  if (!__dbReady()) return model;

  const role = user ? user.role : '';

  // 1. Resident Model
  if (role === 'Resident') {
    const visitors = typeof SystemDB.getVisitors === 'function' ? SystemDB.getVisitors() : [];
    model.pendingVisitors = visitors.filter(v => {
      if (v.status !== 'Pending') return false;
      const flatMatch = user.flat && (v.flat === user.flat || v.flat === user.flat_no);
      const nameMatch = user.name && v.residentName && (
        v.residentName === user.name ||
        v.residentName.toLowerCase().includes(user.name.split(' ')[0].toLowerCase())
      );
      return flatMatch || nameMatch;
    });

    const bills = typeof SystemDB.getMaintenance === 'function' ? SystemDB.getMaintenance() : [];
    model.unpaidBills = bills.filter(m => {
      if (m.status !== 'Unpaid') return false;
      const flatMatch = user.flat && (m.flat === user.flat || m.flat === user.flat_no);
      const nameMatch = user.name && m.residentName && (
        m.residentName === user.name ||
        m.residentName.toLowerCase().includes(user.name.split(' ')[0].toLowerCase())
      );
      return flatMatch || nameMatch;
    });
  }

  // 2. Admin (Society Secretary) Model
  if (role === 'Admin') {
    const users = typeof SystemDB.getUsers === 'function' ? SystemDB.getUsers() : [];
    model.pendingUsers = users.filter(u => u.status === 'Pending');

    const complaints = typeof SystemDB.getComplaints === 'function' ? SystemDB.getComplaints() : [];
    model.openComplaints = complaints.filter(c => c.status === 'Open' || c.status === 'Pending').slice(0, 3);
  }

  // 3. Security Guard Model
  if (role === 'Security Guard') {
    const visitors = typeof SystemDB.getVisitors === 'function' ? SystemDB.getVisitors() : [];
    model.pendingVisitors = visitors.filter(v => v.status === 'Pending').slice(0, 3);
    model.preApprovedVisitors = visitors.filter(v => v.status === 'Pre-Approved').slice(0, 2);
  }

  // 4. Committee Member Model
  if (role === 'Committee Member') {
    const complaints = typeof SystemDB.getComplaints === 'function' ? SystemDB.getComplaints() : [];
    model.openComplaints = complaints.filter(c => c.status === 'Open').slice(0, 3);

    const polls = typeof SystemDB.getPolls === 'function' ? SystemDB.getPolls() : [];
    model.activePolls = polls.filter(p => p.status === 'Active').slice(0, 2);
  }

  // 5. Active Emergency Alerts (High urgency for all society roles)
  const alerts = typeof SystemDB.getEmergencyAlerts === 'function' ? SystemDB.getEmergencyAlerts() : [];
  model.emergencyAlerts = alerts.filter(a => a.status === 'Active');

  // 6. Notices fallback if stored notifications don't already have them
  const hasNoticesInFeed = __storedNotifications(user).some(n => n.type === 'notice');
  if (!hasNoticesInFeed) {
    const notices = typeof SystemDB.getNotices === 'function' ? SystemDB.getNotices() : [];
    model.notices = notices.slice(0, 2);
  }

  return model;
}

function __derivedKeys(model) {
  const keys = [];
  model.emergencyAlerts.forEach(a => keys.push('emergency:' + a.id));
  model.pendingVisitors.forEach(v => keys.push('visitor:' + v.id));
  model.preApprovedVisitors.forEach(p => keys.push('previsitor:' + p.id));
  model.unpaidBills.forEach(m => keys.push('bill:' + m.id));
  model.pendingUsers.forEach(u => keys.push('approval:' + u.id));
  model.openComplaints.forEach(c => keys.push('complaint:' + c.id));
  model.activePolls.forEach(po => keys.push('poll:' + po.id));
  model.notices.forEach(n => keys.push('notice:' + n.id));
  return keys;
}

function __derivedActiveCount(model) {
  let count = 0;
  model.emergencyAlerts.forEach(a => { if (!__isDismissed('emergency:' + a.id)) count++; });
  model.pendingVisitors.forEach(v => { if (!__isDismissed('visitor:' + v.id)) count++; });
  model.preApprovedVisitors.forEach(p => { if (!__isDismissed('previsitor:' + p.id)) count++; });
  model.unpaidBills.forEach(m => { if (!__isDismissed('bill:' + m.id)) count++; });
  model.pendingUsers.forEach(u => { if (!__isDismissed('approval:' + u.id)) count++; });
  model.openComplaints.forEach(c => { if (!__isDismissed('complaint:' + c.id)) count++; });
  model.activePolls.forEach(po => { if (!__isDismissed('poll:' + po.id)) count++; });
  model.notices.forEach(n => { if (!__isDismissed('notice:' + n.id)) count++; });
  return count;
}

/* ════════════════════════════════════════════
   Badge & Counts
   ════════════════════════════════════════════ */

function getActiveNotificationCount() {
  const user = __currentUser();
  if (!user) return 0;

  let count = __storedUnreadCount(user);
  count += __derivedActiveCount(__derivedModel(user));
  return count;
}

function updateNotificationBadge() {
  const dots = document.querySelectorAll('.notif-dot');
  if (!dots.length) return;

  const count = getActiveNotificationCount();

  dots.forEach(dot => {
    if (count > 0) {
      dot.style.display = 'inline-flex';
      dot.textContent = count > 99 ? '99+' : String(count);
      dot.setAttribute('title', `${count} New Notification${count === 1 ? '' : 's'}`);
      dot.setAttribute('aria-label', `${count} unread notifications`);
    } else {
      dot.style.display = 'none';
      dot.textContent = '';
      dot.setAttribute('title', 'No new notifications');
      dot.setAttribute('aria-label', 'No unread notifications');
    }
  });

  // If dropdown is currently open, refresh its content smoothly
  const dropdown = document.getElementById('globalNotifDropdown');
  if (dropdown && dropdown.classList.contains('show')) {
    renderNotificationList(dropdown);
  }
}

/* ════════════════════════════════════════════
   Initialization
   ════════════════════════════════════════════ */

let __notifInitialized = false;

function initNotificationCenter() {
  const notifBtns = document.querySelectorAll('.btn-nav-icon');
  if (!notifBtns.length) return;

  notifBtns.forEach(btn => {
    const wrapper = btn.parentElement;
    if (wrapper) wrapper.style.position = 'relative';

    // Enhance with AnimateIcons / Lucide animated bell SVG
    if (!btn.querySelector('.animate-bell-icon')) {
      const faBell = btn.querySelector('.fa-bell');
      const dot = btn.querySelector('.notif-dot');
      const svgHtml = `
        <svg class="animate-bell-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path class="animate-bell-clapper" d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path class="animate-bell-body" d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        </svg>
      `;
      if (faBell) {
        faBell.outerHTML = svgHtml;
      } else if (!dot) {
        btn.innerHTML = svgHtml + `<span class="notif-dot"></span>`;
      } else {
        btn.insertAdjacentHTML('afterbegin', svgHtml);
      }
    }

    // Attach smooth physics ring completion listeners (AnimateIcons hover effect)
    btn.addEventListener('mouseenter', () => {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      btn.classList.remove('is-bell-ringing');
      void btn.offsetWidth; // trigger reflow to restart keyframe animation cleanly
      btn.classList.add('is-bell-ringing');
    });

    btn.addEventListener('animationend', (e) => {
      if (e.animationName === 'bellAnimateRotate') {
        btn.classList.remove('is-bell-ringing');
      }
    });

    // Handle button click toggle
    if (!btn.hasAttribute('onclick')) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotificationPanel(btn);
      });
    }
  });

  // Global listeners for dismissals outside & Escape
  if (!__notifInitialized) {
    __notifInitialized = true;

    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('globalNotifDropdown');
      if (dropdown && !dropdown.contains(e.target) && !e.target.closest('.btn-nav-icon')) {
        dropdown.classList.remove('show');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const dropdown = document.getElementById('globalNotifDropdown');
        if (dropdown) dropdown.classList.remove('show');
      }
    });

    // Reactive listeners for real-time synchronization
    window.addEventListener('ssm:notification-update', updateNotificationBadge);
    window.addEventListener('ssm:db-ready', updateNotificationBadge);
    window.addEventListener('storage', (e) => {
      if (e.key && (e.key.startsWith('ssm_') || e.key.includes('society'))) {
        updateNotificationBadge();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateNotificationBadge();
    });

    // Continuous readiness verification: check every 120ms until SystemDB is ready
    let attempts = 0;
    const readinessTimer = setInterval(() => {
      attempts++;
      if (__dbReady() || attempts > 35) {
        clearInterval(readinessTimer);
        updateNotificationBadge();
      }
    }, 120);

    // Continuous background real-time heartbeat polling every 3 seconds
    setInterval(updateNotificationBadge, 3000);
  }

  updateNotificationBadge();
}

/* ════════════════════════════════════════════
   Panel open/close
   ════════════════════════════════════════════ */

function toggleNotificationPanel(btnOrEvent) {
  let dropdown = document.getElementById('globalNotifDropdown');

  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'globalNotifDropdown';
    dropdown.className = 'notif-panel-dropdown';
    document.body.appendChild(dropdown);

    // Delegated click: stored notifications navigate + mark read
    dropdown.addEventListener('click', (e) => {
      if (e.target.closest('button, a, .notif-action-btn')) return;
      const item = e.target.closest('[data-notif-id]');
      if (item) {
        openStoredNotification(
          item.getAttribute('data-notif-id'),
          item.getAttribute('data-notif-link') || ''
        );
      }
    });
  }

  const btn = (btnOrEvent && btnOrEvent.nodeType)
    ? btnOrEvent
    : (document.querySelector('.btn-nav-icon') || document.body);
  const rect = btn.getBoundingClientRect
    ? btn.getBoundingClientRect()
    : { bottom: 60, right: window.innerWidth - 16 };

  dropdown.style.position = 'fixed';
  dropdown.style.top = (rect.bottom + 10) + 'px';
  dropdown.style.right = Math.max(16, (window.innerWidth - rect.right)) + 'px';
  dropdown.style.zIndex = '2100';

  if (dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
    return;
  }

  renderNotificationList(dropdown);
  dropdown.classList.add('show');
}

/* ════════════════════════════════════════════
   Rendering
   ════════════════════════════════════════════ */

const NOTIF_TYPE_ICONS = {
  visitor: { icon: 'fa-shield-cat', tone: 'warning', label: 'text-warning' },
  bill: { icon: 'fa-receipt', tone: 'danger', label: 'text-danger' },
  payment: { icon: 'fa-wallet', tone: 'success', label: 'text-success' },
  complaint: { icon: 'fa-screwdriver-wrench', tone: 'info', label: 'text-info' },
  amenity: { icon: 'fa-calendar-check', tone: 'primary', label: 'text-primary' },
  booking: { icon: 'fa-calendar-check', tone: 'primary', label: 'text-primary' },
  notice: { icon: 'fa-bullhorn', tone: 'info', label: 'text-info' },
  emergency: { icon: 'fa-triangle-exclamation', tone: 'danger', label: 'text-danger' },
  approval: { icon: 'fa-user-clock', tone: 'primary', label: 'text-primary' },
  poll: { icon: 'fa-square-poll-vertical', tone: 'info', label: 'text-info' },
  system: { icon: 'fa-bell', tone: 'primary', label: 'text-primary' }
};

function __notifIconMeta(type) {
  return NOTIF_TYPE_ICONS[type] || NOTIF_TYPE_ICONS.system;
}

function renderNotificationList(dropdown) {
  const user = __currentUser();
  const model = __derivedModel(user);
  const stored = __storedNotifications(user);

  let itemsHTML = '';
  let activeCount = 0;

  /* 1. Emergency Alerts (High Priority for all roles) */
  model.emergencyAlerts.forEach(a => {
    const key = 'emergency:' + a.id;
    if (__isDismissed(key)) return;
    activeCount++;
    itemsHTML += `
      <div class="notif-item unread" style="border-left: 3px solid #EF4444; background: rgba(239,68,68,0.08);">
        <div class="notif-icon-box bg-danger bg-opacity-15 text-danger">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="small text-danger fw-bold"><i class="fa-solid fa-bolt me-1"></i>EMERGENCY ALERT: ${__esc(a.type || 'SOS')}</strong>
            <button class="btn btn-link text-muted p-0 notif-action-btn" title="Dismiss" onclick="dismissDerivedNotif('${key}')">
              <i class="fa-solid fa-xmark fs-7"></i>
            </button>
          </div>
          <p class="mb-1 text-heading small" style="font-size:12.5px;">${__esc(a.message || 'Society emergency alert broadcasted.')}</p>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <span class="caption-text text-muted" style="font-size:10px;">Raised by: ${__esc(a.raisedBy || 'Staff')} (${__esc(__timeAgo(a.raisedAt))})</span>
            <a href="guard.html" class="btn btn-xs btn-outline-danger py-0 px-2 rounded-pill" style="font-size:10.5px;">View Gate SOS</a>
          </div>
        </div>
      </div>
    `;
  });

  /* 2. Stored SystemDB notifications (unread first) */
  const sortedStored = stored.slice().sort((a, b) => {
    const aRead = a.read ? 1 : 0;
    const bRead = b.read ? 1 : 0;
    if (aRead !== bRead) return aRead - bRead;
    return String(b.createdAt || b.at || b.date || '').localeCompare(String(a.createdAt || a.at || a.date || ''));
  });

  sortedStored.slice(0, 10).forEach(n => {
    const meta = __notifIconMeta(n.type);
    const unread = !n.read;
    if (unread) activeCount++;
    const link = n.link ? String(n.link) : '';
    itemsHTML += `
      <div class="notif-item ${unread ? 'unread' : ''} ${link ? 'clickable' : ''}"
           ${unread ? 'data-notif-id="' + __esc(n.id) + '"' : ''}
           ${link ? 'data-notif-link="' + __esc(link) + '"' : ''}
           ${link ? 'role="button" tabindex="0"' : ''}>
        <div class="notif-icon-box bg-${meta.tone} bg-opacity-10 ${meta.label}">
          <i class="fa-solid ${meta.icon}"></i>
        </div>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center gap-2 mb-1">
            <strong class="small text-heading" style="font-size:12.5px;">${__esc(n.title || 'Notification')}</strong>
            <span class="caption-text text-muted" style="font-size:10.5px;white-space:nowrap;">${__esc(__timeAgo(n.createdAt || n.at || n.date))}</span>
          </div>
          <p class="mb-0 text-muted small" style="font-size:12px; line-height: 1.45;">${__esc(n.message || '')}</p>
          ${link ? '<span class="caption-text text-primary fw-semibold mt-1 d-inline-block" style="font-size:11px;">View details <i class="fa-solid fa-arrow-right ms-1" style="font-size:9px;"></i></span>' : ''}
        </div>
      </div>
    `;
  });

  /* 3. Resident: Pending Gate Visitor Entry Requests */
  if (user && user.role === 'Resident') {
    model.pendingVisitors.forEach(v => {
      const key = 'visitor:' + v.id;
      if (__isDismissed(key)) return;
      activeCount++;
      itemsHTML += `
        <div class="notif-item unread" style="background: rgba(245, 158, 11, 0.08);">
          <div class="notif-icon-box bg-warning bg-opacity-10 text-warning">
            <i class="fa-solid fa-shield-cat"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong class="small text-warning fw-bold">Visitor Waiting at Gate</strong>
              <span class="caption-text text-muted" style="font-size:11px;">Pass #${__esc(v.gatePassCode || '—')}</span>
            </div>
            <p class="mb-2 small text-heading" style="font-size:12.5px;">
              <strong>${__esc(v.name)}</strong> (${__esc(v.purpose || 'Visit')}) is at ${__esc(v.gate || 'Gate 1')} requesting entry to Flat ${__esc(v.flat)}.
            </p>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-success rounded-pill px-3 py-1 text-white fw-bold notif-action-btn" style="font-size:11px;" onclick="handleNotifVisitor('${__esc(v.id)}', 'Approved')">
                <i class="fa-solid fa-check me-1"></i> Approve
              </button>
              <button class="btn btn-sm btn-outline-danger rounded-pill px-3 py-1 fw-bold notif-action-btn" style="font-size:11px;" onclick="handleNotifVisitor('${__esc(v.id)}', 'Rejected')">
                <i class="fa-solid fa-xmark me-1"></i> Deny
              </button>
            </div>
          </div>
        </div>
      `;
    });

    /* 4. Resident: Pending Maintenance Bills */
    model.unpaidBills.forEach(m => {
      const key = 'bill:' + m.id;
      if (__isDismissed(key)) return;
      activeCount++;
      itemsHTML += `
        <div class="notif-item unread">
          <div class="notif-icon-box bg-danger bg-opacity-10 text-danger">
            <i class="fa-solid fa-receipt"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong class="small text-danger fw-semibold">Pending Maintenance Bill</strong>
              <span class="caption-text text-muted" style="font-size:11px;">Due: ${__esc(m.dueDate || 'End of Month')}</span>
            </div>
            <p class="mb-1 small text-heading" style="font-size:12.5px;">${__esc(m.month || 'Maintenance Dues')}: <strong class="text-danger">${__esc(__formatINR(m.amount))}</strong></p>
            <a href="resident.html#bills" class="small text-primary fw-bold text-decoration-none" style="font-size:11.5px;">Pay Bill via UPI →</a>
          </div>
        </div>
      `;
    });
  }

  /* 5. Admin: Pending Resident Registration Approvals */
  if (user && user.role === 'Admin' && model.pendingUsers.length > 0) {
    const unreadUsers = model.pendingUsers.filter(u => !__isDismissed('approval:' + u.id));
    if (unreadUsers.length > 0) {
      activeCount += unreadUsers.length;
      itemsHTML += `
        <div class="notif-item unread">
          <div class="notif-icon-box bg-primary bg-opacity-10 text-primary">
            <i class="fa-solid fa-user-clock"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong class="small text-primary fw-bold">Resident Registrations</strong>
              <span class="badge bg-danger rounded-pill" style="font-size:10px;">${unreadUsers.length} Pending</span>
            </div>
            <p class="mb-1 small text-muted" style="font-size:12px;">New resident applicants are waiting for flat allotment and secretary approval.</p>
            <a href="admin.html#tab-residents" class="small text-primary fw-bold text-decoration-none" style="font-size:11.5px;">Review &amp; Approve Applicants →</a>
          </div>
        </div>
      `;
    }
  }

  /* 6. Admin & Committee Member: Open Complaints */
  if (user && (user.role === 'Admin' || user.role === 'Committee Member') && model.openComplaints.length > 0) {
    const unreadComplaints = model.openComplaints.filter(c => !__isDismissed('complaint:' + c.id));
    if (unreadComplaints.length > 0) {
      activeCount += unreadComplaints.length;
      itemsHTML += `
        <div class="notif-item unread">
          <div class="notif-icon-box bg-warning bg-opacity-10 text-warning">
            <i class="fa-solid fa-screwdriver-wrench"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong class="small text-warning fw-bold">Active Resident Grievances</strong>
              <span class="badge bg-warning text-dark rounded-pill" style="font-size:10px;">${unreadComplaints.length} Open</span>
            </div>
            <p class="mb-1 small text-muted" style="font-size:12px;">Tickets pending maintenance contractor allocation or resolution SLA.</p>
            <a href="${user.role === 'Admin' ? 'admin.html#tab-complaints' : 'committee.html#complaints'}" class="small text-primary fw-bold text-decoration-none" style="font-size:11.5px;">View Grievance Queue →</a>
          </div>
        </div>
      `;
    }
  }

  /* 7. Security Guard: Gate Visitors Waiting & Pre-Approved Arrivals */
  if (user && user.role === 'Security Guard') {
    model.pendingVisitors.forEach(v => {
      const key = 'visitor:' + v.id;
      if (__isDismissed(key)) return;
      activeCount++;
      itemsHTML += `
        <div class="notif-item unread">
          <div class="notif-icon-box bg-warning bg-opacity-10 text-warning">
            <i class="fa-solid fa-person-walking-dashed-line-arrow-right"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong class="small text-warning fw-bold">Gate Entry Awaiting Check-In</strong>
              <span class="caption-text text-muted" style="font-size:10.5px;">${__esc(v.flat)}</span>
            </div>
            <p class="mb-1 small text-heading" style="font-size:12px;">${__esc(v.name)} (${__esc(v.purpose || 'Visitor')}) at ${__esc(v.gate || 'Gate 1')}.</p>
            <a href="guard.html" class="small text-primary fw-bold text-decoration-none" style="font-size:11.5px;">Open Guard Console →</a>
          </div>
        </div>
      `;
    });

    model.preApprovedVisitors.forEach(p => {
      const key = 'previsitor:' + p.id;
      if (__isDismissed(key)) return;
      activeCount++;
      itemsHTML += `
        <div class="notif-item unread">
          <div class="notif-icon-box bg-success bg-opacity-10 text-success">
            <i class="fa-solid fa-ticket"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong class="small text-success fw-bold">Pre-Approved Visitor Expected</strong>
              <span class="badge bg-success bg-opacity-20 text-success rounded-pill" style="font-size:9.5px;">Passcode Ready</span>
            </div>
            <p class="mb-1 small text-heading" style="font-size:12px;">${__esc(p.name)} arriving for Flat ${__esc(p.flat)} (Code: ${__esc(p.gatePassCode || '—')}).</p>
            <a href="guard.html" class="small text-primary fw-bold text-decoration-none" style="font-size:11.5px;">Verify Passcode →</a>
          </div>
        </div>
      `;
    });
  }

  /* 8. Committee Member: Active Polls */
  if (user && user.role === 'Committee Member' && model.activePolls.length > 0) {
    const unreadPolls = model.activePolls.filter(po => !__isDismissed('poll:' + po.id));
    if (unreadPolls.length > 0) {
      activeCount += unreadPolls.length;
      itemsHTML += `
        <div class="notif-item unread">
          <div class="notif-icon-box bg-info bg-opacity-10 text-info">
            <i class="fa-solid fa-square-poll-vertical"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <strong class="small text-info fw-bold">Active Community Opinion Poll</strong>
              <span class="badge bg-info bg-opacity-20 text-info rounded-pill" style="font-size:10px;">Voting Open</span>
            </div>
            <p class="mb-1 small text-muted" style="font-size:12px;">${__esc(unreadPolls[0].title || 'Society digital resolution awaiting votes.')}</p>
            <a href="committee.html#polls" class="small text-primary fw-bold text-decoration-none" style="font-size:11.5px;">View Poll Results →</a>
          </div>
        </div>
      `;
    }
  }

  /* 9. Society Notices */
  model.notices.forEach(n => {
    const key = 'notice:' + n.id;
    if (__isDismissed(key)) return;
    activeCount++;
    itemsHTML += `
      <div class="notif-item unread">
        <div class="notif-icon-box bg-info bg-opacity-10 text-info">
          <i class="fa-solid fa-bullhorn"></i>
        </div>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong class="small text-heading fw-bold">${__esc(n.title || 'Society Announcement')}</strong>
            <span class="caption-text text-muted" style="font-size:10.5px;">${__esc(n.date || 'Notice')}</span>
          </div>
          <p class="mb-0 text-muted small" style="font-size:12px; line-height:1.4;">${__esc(n.description || n.content || 'Important update.')}</p>
        </div>
      </div>
    `;
  });

  // Empty state fallback
  if (!itemsHTML) {
    itemsHTML = `
      <div class="p-4 text-center text-muted">
        <div class="mb-2 opacity-50">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-muted">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            <line x1="2" y1="2" x2="22" y2="22"></line>
          </svg>
        </div>
        <strong class="small d-block text-heading mb-1">You're all caught up!</strong>
        <span class="caption-text text-muted d-block" style="font-size:11.5px;">No unread notifications at this time.</span>
      </div>
    `;
  }

  dropdown.innerHTML = `
    <div class="notif-panel-header">
      <div class="d-flex align-items-center gap-2">
        <i class="fa-solid fa-bell text-primary fs-6"></i>
        <strong class="small mb-0 text-heading">Notifications</strong>
        ${activeCount > 0 ? `<span class="badge bg-primary rounded-pill px-2 py-0.5" style="font-size:10px;">${activeCount} New</span>` : ''}
      </div>
      <button class="btn btn-link btn-sm text-primary p-0 text-decoration-none caption-text fw-bold" onclick="clearAllNotifications()">
        <i class="fa-solid fa-check-double me-1"></i>Mark all read
      </button>
    </div>
    <div class="notif-panel-body">
      ${itemsHTML}
    </div>
  `;
}

/* ════════════════════════════════════════════
   Actions & Handlers
   ════════════════════════════════════════════ */

/** Dismiss an individual derived item for this session */
function dismissDerivedNotif(key) {
  __dismissItem(key);
  updateNotificationBadge();
  const dropdown = document.getElementById('globalNotifDropdown');
  if (dropdown && dropdown.classList.contains('show')) {
    renderNotificationList(dropdown);
  }
}

/** Open a stored notification: mark read, then navigate to its link */
function openStoredNotification(id, link) {
  if (__dbReady() && typeof SystemDB.markNotificationRead === 'function') {
    try {
      SystemDB.markNotificationRead(id);
    } catch (e) {}
  }
  updateNotificationBadge();
  const dropdown = document.getElementById('globalNotifDropdown');
  if (link) {
    if (dropdown) dropdown.classList.remove('show');
    window.location.href = link;
  } else if (dropdown && dropdown.classList.contains('show')) {
    renderNotificationList(dropdown);
  }
}

/** Resident: Approve or deny a visitor waiting at the gate */
function handleNotifVisitor(id, status) {
  if (!__dbReady()) return;

  const visitor = (typeof SystemDB.getVisitors === 'function' ? SystemDB.getVisitors() : []).find(v => v.id === id);
  const approved = status === 'Approved';

  let result = { success: true };
  try {
    if (approved && typeof SystemDB.approveVisitor === 'function') {
      result = SystemDB.approveVisitor(id);
    } else if (!approved && typeof SystemDB.rejectVisitor === 'function') {
      result = SystemDB.rejectVisitor(id);
    } else if (typeof SystemDB.updateVisitorStatus === 'function') {
      result = SystemDB.updateVisitorStatus(id, status);
    }
  } catch (e) {
    result = { success: false, message: 'Could not update visitor status.' };
  }

  if (result && result.success === false) {
    showToast(result.message || 'Could not update visitor entry.', 'error');
    return;
  }

  const name = visitor ? visitor.name : id;
  const flat = visitor ? visitor.flat : '';

  if (typeof SystemDB.logAudit === 'function') {
    SystemDB.logAudit(
      approved ? 'Approved Gate Visitor' : 'Denied Gate Visitor',
      'Gate Security',
      `${name} → Flat ${flat} (${approved ? 'entry approved by resident' : 'entry denied by resident'})`
    );
  }

  if (typeof SystemDB.notify === 'function') {
    try {
      SystemDB.notify({
        target: 'Security Guard',
        type: 'visitor',
        title: approved ? 'Visitor Entry Approved' : 'Visitor Entry Denied',
        message: `Resident ${approved ? 'approved' : 'denied'} entry for ${name} (Flat ${flat}).`,
        link: 'guard.html'
      });
    } catch (e) {}
  }

  showToast(
    approved ? 'Visitor approved — gate staff informed.' : 'Visitor entry denied.',
    approved ? 'success' : 'warning'
  );

  updateNotificationBadge();
  const dropdown = document.getElementById('globalNotifDropdown');
  if (dropdown && dropdown.classList.contains('show')) renderNotificationList(dropdown);
  if (typeof loadResidentDashboard === 'function') loadResidentDashboard();
}

/** Mark everything read: stored notifications in DB + derived items dismissed */
function clearAllNotifications() {
  const user = __currentUser();

  if (user && __dbReady() && typeof SystemDB.markAllNotificationsRead === 'function') {
    try {
      SystemDB.markAllNotificationsRead(user);
    } catch (e) {}
  }

  // Dismiss all currently rendered derived items for this session
  __dismissAll(__derivedKeys(__derivedModel(user)));

  updateNotificationBadge();

  const dropdown = document.getElementById('globalNotifDropdown');
  if (dropdown && dropdown.classList.contains('show')) {
    renderNotificationList(dropdown);
  }

  showToast('All notifications marked as read', 'success');
}

/** Global dispatcher helper to refresh notifications everywhere */
window.dispatchNotifUpdate = function () {
  updateNotificationBadge();
  const dropdown = document.getElementById('globalNotifDropdown');
  if (dropdown && dropdown.classList.contains('show')) {
    renderNotificationList(dropdown);
  }
};

/** Simulate a real-time incoming notification (for live tests & demonstrations) */
window.simulateRealtimeNotification = function (options) {
  const opt = options || {};
  const user = __currentUser();

  const payload = {
    target: opt.target || (user ? user.role : 'all'),
    type: opt.type || 'system',
    title: opt.title || 'Live Society Alert',
    message: opt.message || 'New real-time update from society management.',
    link: opt.link || ''
  };

  if (__dbReady() && typeof SystemDB.notify === 'function') {
    SystemDB.notify(payload);
  }

  // Trigger AnimateIcons harmonic bell ring animation on navbar bell
  document.querySelectorAll('.btn-nav-icon').forEach(btn => {
    btn.classList.remove('is-bell-ringing');
    void btn.offsetWidth;
    btn.classList.add('is-bell-ringing');
  });

  // Display toast alert
  showToast(payload.title + ': ' + payload.message, 'info');

  updateNotificationBadge();
};

/* ════════════════════════════════════════════
   Toast Notifications
   ════════════════════════════════════════════ */

function showToast(message, type = 'success') {
  let container = document.getElementById('globalToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'globalToastContainer';
    container.className = 'toast-container-custom';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-custom ${type}`;

  const iconClass = type === 'success' ? 'fa-circle-check text-success' :
                    type === 'error' ? 'fa-circle-xmark text-danger' :
                    type === 'warning' ? 'fa-triangle-exclamation text-warning' : 'fa-bell text-primary';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} fs-5"></i>
    <div class="flex-grow-1" style="font-size:13px; font-weight:500;">${__esc(message)}</div>
    <button class="btn-close ms-2" style="font-size:10px;" onclick="this.parentElement.remove()"></button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOutRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Expose public API
window.showToast = showToast;
window.handleNotifVisitor = handleNotifVisitor;
window.clearAllNotifications = clearAllNotifications;
window.updateNotificationBadge = updateNotificationBadge;
window.toggleNotificationPanel = toggleNotificationPanel;
window.dismissDerivedNotif = dismissDerivedNotif;
window.getActiveNotificationCount = getActiveNotificationCount;

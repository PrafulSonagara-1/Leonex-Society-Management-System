/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SOCIETYHUB — CLERK READY-MADE NAVBAR USER BUTTON & PROFILE DROPDOWN
 * Integrates Clerk SDK with native <UserButton /> when authenticated via Clerk,
 * and provides Clerk's pixel-perfect ready-made design for demo & local users.
 * ══════════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  const CLERK_PUBLISHABLE_KEY = 'pk_test_c3VpdGVkLXJvdWdoeS0xNzk4LmNsZXJrLmFjY291bnRzLmRldiQ';

  function getCurrentUser() {
    try {
      if (window.SystemDB && typeof window.SystemDB.getCurrentUser === 'function') {
        const u = window.SystemDB.getCurrentUser();
        if (u) return u;
      }
      const raw = sessionStorage.getItem('ssm_current_user') || sessionStorage.getItem('ssm_clerk_user');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading session user:', e);
    }
    return {
      name: 'Member',
      role: 'Resident',
      email: 'member@leonex.io',
      flat: 'A-101',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
    };
  }

  // Universal Logout Function
  window.logout = async function () {
    try {
      if (window.Clerk && window.Clerk.user) {
        try {
          await window.Clerk.signOut();
        } catch (e) {
          console.warn('Clerk signout warning:', e);
        }
      }
      if (window.SystemDB && typeof window.SystemDB.logout === 'function') {
        window.SystemDB.logout();
      }
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      sessionStorage.clear();
      window.location.href = 'login.html';
    }
  };

  window.superAdminLogout = window.logout;

  // Render Clerk-styled ready-made UserButton UI
  function renderClerkReadyMadeButton(container, user) {
    const avatarUrl = user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name || 'User')}`;
    const userName = user.name || 'Member';
    const userRole = user.role || 'Resident';
    const userEmail = user.email || (user.flat ? `Flat ${user.flat}` : 'resident@leonex.io');

    container.innerHTML = `
      <div class="clerk-user-button-wrapper position-relative">
        <button type="button" class="clerk-user-btn-trigger" id="clerkUserBtnTrigger" aria-label="Open User Menu" aria-expanded="false" aria-haspopup="true">
          <div class="clerk-avatar-ring">
            <img class="clerk-user-avatar" id="clerkNavAvatar" src="${avatarUrl}" alt="${userName}" />
          </div>
          <div class="clerk-user-preview d-none d-md-flex flex-column text-start ms-2">
            <span class="clerk-user-name" id="clerkNavName">${userName}</span>
            <span class="clerk-user-role-label">${userRole}${user.flat ? ' &bull; ' + user.flat : ''}</span>
          </div>
          <i class="fa-solid fa-chevron-down clerk-user-chevron ms-2 d-none d-sm-inline-block"></i>
        </button>

        <div class="clerk-user-popover" id="clerkUserPopover" style="display: none;" role="menu" aria-label="User Account Menu">
          <!-- Popover Header -->
          <div class="clerk-popover-header">
            <div class="clerk-avatar-ring large">
              <img class="clerk-popover-avatar" src="${avatarUrl}" alt="${userName}" />
            </div>
            <div class="clerk-popover-user-info">
              <div class="clerk-popover-name">${userName}</div>
              <div class="clerk-popover-email text-truncate">${userEmail}</div>
              <div class="mt-1">
                <span class="clerk-role-badge">${userRole}</span>
              </div>
            </div>
          </div>

          <div class="clerk-popover-divider"></div>

          <!-- Popover Menu List -->
          <div class="clerk-popover-menu">
            <a href="profile.html" class="clerk-popover-item" role="menuitem">
              <div class="clerk-popover-item-icon icon-settings">
                <i class="fa-solid fa-user-gear"></i>
              </div>
              <div class="clerk-popover-item-content">
                <span class="clerk-popover-item-title">Profile Settings</span>
                <span class="clerk-popover-item-subtitle">Manage details, security & theme</span>
              </div>
              <i class="fa-solid fa-chevron-right clerk-popover-item-arrow"></i>
            </a>

            <div class="clerk-popover-divider my-1"></div>

            <button type="button" class="clerk-popover-item clerk-popover-item-danger w-100" id="clerkDropdownLogoutBtn" role="menuitem">
              <div class="clerk-popover-item-icon icon-logout">
                <i class="fa-solid fa-right-from-bracket"></i>
              </div>
              <div class="clerk-popover-item-content">
                <span class="clerk-popover-item-title">Sign Out</span>
                <span class="clerk-popover-item-subtitle">Exit your current session</span>
              </div>
            </button>
          </div>

          <div class="clerk-popover-footer">
            <div class="d-flex align-items-center justify-content-between">
              <span class="clerk-footer-brand"><i class="fa-solid fa-shield-halved text-warning me-1"></i> Leonex</span>
              <span class="clerk-footer-status"><span class="clerk-status-dot"></span> Active</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Connect toggle events
    const trigger = document.getElementById('clerkUserBtnTrigger');
    const popover = document.getElementById('clerkUserPopover');
    const logoutBtn = document.getElementById('clerkDropdownLogoutBtn');

    if (trigger && popover) {
      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        const isVisible = popover.style.display !== 'none';
        if (isVisible) {
          closePopover();
        } else {
          openPopover();
        }
      });

      function openPopover() {
        popover.style.display = 'block';
        popover.classList.add('clerk-popover-anim-in');
        trigger.setAttribute('aria-expanded', 'true');
        trigger.classList.add('active');
      }

      function closePopover() {
        popover.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        trigger.classList.remove('active');
      }

      document.addEventListener('click', function (e) {
        if (!container.contains(e.target)) {
          closePopover();
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          closePopover();
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.logout();
      });
    }

    // Keep backward compatibility with existing avatar IDs if present on page
    syncExistingAvatarElements(user);
  }

  function syncExistingAvatarElements(user) {
    const avatarUrl = user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name || 'User')}`;
    const userName = user.name || 'Member';

    ['adminAvatar', 'resAvatar', 'guardAvatar', 'commAvatar', 'saAvatar'].forEach(id => {
      const el = document.getElementById(id);
      if (el && avatarUrl) el.src = avatarUrl;
    });

    ['adminName', 'resName', 'guardName', 'commName', 'saName'].forEach(id => {
      const el = document.getElementById(id);
      if (el && userName) el.textContent = userName;
    });
  }

  // Mount Clerk native or ready-made button
  async function setupClerkNavbar() {
    const container = document.getElementById('clerkUserNav') || document.querySelector('.clerk-user-nav-container');
    if (!container) return;

    const user = getCurrentUser();

    // Try Clerk SDK if loaded
    if (window.Clerk) {
      try {
        if (!window.Clerk.loaded && typeof window.Clerk.load === 'function') {
          await window.Clerk.load();
        }

        if (window.Clerk.user) {
          // User is authenticated via Clerk! Mount native UserButton
          container.innerHTML = `<div id="clerk-native-user-button"></div>`;
          window.Clerk.mountUserButton(document.getElementById('clerk-native-user-button'), {
            afterSignOutUrl: 'login.html',
            userProfileMode: 'modal'
          });

          // Listen for sign-out from Clerk
          window.Clerk.addListener(({ user: clerkUser }) => {
            if (!clerkUser) {
              sessionStorage.clear();
              window.location.href = 'login.html';
            }
          });
          return;
        }
      } catch (err) {
        console.warn('Clerk SDK init note:', err);
      }
    }

    // Default to Clerk ready-made design (for demo users, local sessions, or before Clerk sync)
    renderClerkReadyMadeButton(container, user);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupClerkNavbar);
  } else {
    setupClerkNavbar();
  }
})();

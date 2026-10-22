/**
 * Leonex SSMS — Progressive Web App (PWA) Manager
 * Handles Service Worker Registration & App Install Experience
 */

(function () {
  'use strict';

  let deferredInstallPrompt = null;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[Leonex PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[Leonex PWA] Service Worker registration failed:', err);
        });
    });
  }

  // If already running as standalone installed app, don't show prompts
  if (isStandalone) {
    document.documentElement.classList.add('is-pwa-standalone');
    console.log('[Leonex PWA] Running in standalone installed mode');
    return;
  }

  // Capture install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[Leonex PWA] beforeinstallprompt captured');
    checkAndDisplayInstallUI();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallUI();
    if (typeof showToast === 'function') {
      showToast('Leonex SSMS was successfully installed on your device!', 'success');
    }
    console.log('[Leonex PWA] App installed successfully');
  });

  function isLoggedIn() {
    try {
      const user = sessionStorage.getItem('ssm_current_user');
      return !!user;
    } catch (e) {
      return false;
    }
  }

  function isDashboardPage() {
    const path = window.location.pathname.toLowerCase();
    return (
      path.includes('admin.html') ||
      path.includes('resident.html') ||
      path.includes('guard.html') ||
      path.includes('committee.html') ||
      path.includes('super-admin.html') ||
      path.includes('vehicles.html') ||
      path.includes('profile.html')
    );
  }

  function checkAndDisplayInstallUI() {
    // Show install prompt primarily after user login or on dashboard pages
    if (!isLoggedIn() && !isDashboardPage()) {
      return;
    }

    // 1. Look for existing button placeholder with id #pwaInstallBtn
    const existingBtn = document.getElementById('pwaInstallBtn');
    if (existingBtn) {
      existingBtn.classList.remove('d-none');
      existingBtn.style.display = 'inline-flex';
      existingBtn.onclick = triggerInstall;
    }

    // 2. Create or display floating banner if not dismissed this session
    if (!sessionStorage.getItem('leonex_pwa_banner_dismissed')) {
      showFloatingInstallBanner();
    }
  }

  function triggerInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[Leonex PWA] User accepted the install prompt');
          hideInstallUI();
        } else {
          console.log('[Leonex PWA] User dismissed the install prompt');
        }
        deferredInstallPrompt = null;
      });
    } else {
      // iOS / manual install instruction
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert('To install Leonex on your iOS device:\n1. Tap the Share icon (square with arrow) at the bottom.\n2. Scroll down and select "Add to Home Screen".');
      } else {
        alert('To install Leonex SSMS, click the browser menu (â‹® or icon in the URL bar) and select "Install Leonex SSMS".');
      }
    }
  }

  function showFloatingInstallBanner() {
    if (document.getElementById('leonexPwaBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'leonexPwaBanner';
    banner.className = 'leonex-pwa-banner';
    banner.innerHTML = `
      <div class="leonex-pwa-banner-card">
        <div class="leonex-pwa-banner-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v13M5 11l7 7 7-7M2 19v2h20v-2"/>
          </svg>
        </div>
        <div class="leonex-pwa-banner-content">
          <div class="leonex-pwa-banner-title">Install Leonex SSMS</div>
          <div class="leonex-pwa-banner-desc">Get faster access, desktop notifications &amp; native experience.</div>
        </div>
        <div class="leonex-pwa-banner-actions">
          <button class="leonex-pwa-install-action" id="leonexPwaBannerInstallBtn">
            Install App
          </button>
          <button class="leonex-pwa-dismiss-action" id="leonexPwaBannerCloseBtn" title="Dismiss">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `;

    // Inject styles for the banner
    const style = document.createElement('style');
    style.textContent = `
      .leonex-pwa-banner {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        animation: lxSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      @keyframes lxSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .leonex-pwa-banner-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 18px;
        background: #111827;
        color: #F9FAFB;
        border: 1px solid rgba(99, 102, 241, 0.35);
        box-shadow: 0 16px 36px -8px rgba(0,0,0,0.5), 0 0 20px rgba(99, 102, 241, 0.2);
        border-radius: 16px;
        max-width: 440px;
        backdrop-filter: blur(12px);
      }
      [data-theme="light"] .leonex-pwa-banner-card {
        background: #FFFFFF;
        color: #0F172A;
        border: 1px solid #E2E8F0;
        box-shadow: 0 16px 36px -8px rgba(15, 23, 42, 0.15), 0 0 20px rgba(99, 102, 241, 0.12);
      }
      .leonex-pwa-banner-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
        color: #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      }
      .leonex-pwa-banner-content {
        flex: 1;
        min-width: 0;
      }
      .leonex-pwa-banner-title {
        font-size: 13.5px;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 1.3;
      }
      .leonex-pwa-banner-desc {
        font-size: 11.5px;
        color: #9CA3AF;
        line-height: 1.3;
        margin-top: 2px;
      }
      [data-theme="light"] .leonex-pwa-banner-desc {
        color: #64748B;
      }
      .leonex-pwa-banner-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .leonex-pwa-install-action {
        background: #6366F1;
        color: #FFFFFF;
        border: none;
        padding: 7px 14px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 10px rgba(99, 102, 241, 0.35);
      }
      .leonex-pwa-install-action:hover {
        background: #4F46E5;
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(99, 102, 241, 0.45);
      }
      .leonex-pwa-dismiss-action {
        background: transparent;
        border: none;
        color: #9CA3AF;
        cursor: pointer;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: color 0.15s ease;
      }
      .leonex-pwa-dismiss-action:hover {
        color: #F43F5E;
      }
      @media (max-width: 576px) {
        .leonex-pwa-banner {
          left: 12px;
          right: 12px;
          bottom: 12px;
        }
        .leonex-pwa-banner-card {
          max-width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(banner);

    document.getElementById('leonexPwaBannerInstallBtn').addEventListener('click', () => {
      triggerInstall();
    });

    document.getElementById('leonexPwaBannerCloseBtn').addEventListener('click', () => {
      sessionStorage.setItem('leonex_pwa_banner_dismissed', 'true');
      hideInstallUI();
    });
  }

  function hideInstallUI() {
    const banner = document.getElementById('leonexPwaBanner');
    if (banner) banner.remove();
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.classList.add('d-none');
  }

  // Trigger check on load and storage change
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkAndDisplayInstallUI, 600);
    });
  } else {
    setTimeout(checkAndDisplayInstallUI, 600);
  }

  window.LeonexPWA = {
    triggerInstall: triggerInstall,
    isStandalone: isStandalone
  };
})();

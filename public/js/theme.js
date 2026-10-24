/**
 * SocietyHub - Animated Theme Controller (21st.dev / shadcn style)
 * Loads in <head> to prevent flash of wrong theme (FOUC).
 *
 * Supported values: 'dark' | 'light'
 * toggleTheme triggers an animated Sun/Moon morph + circular View Transition reveal.
 */

(function () {
  const STORAGE_KEY = 'ssm_theme_preference';

  function getStoredPref() {
    let pref = null;
    try {
      pref = localStorage.getItem(STORAGE_KEY);
    } catch (e) { /* storage unavailable */ }
    return (pref === 'light') ? 'light' : 'dark';
  }

  function resolveTheme(pref) {
    return pref === 'light' ? 'light' : 'dark';
  }

  function applyTheme(pref) {
    const theme = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme-mode', theme);

    // Update theme meta color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0e0e12' : '#ffffff');
    }
  }

  // Shared with the global toggle functions
  window.__ssmTheme = {
    STORAGE_KEY: STORAGE_KEY,
    getStoredPref: getStoredPref,
    resolveTheme: resolveTheme,
    applyTheme: applyTheme
  };

  // Apply immediately upon script execution
  applyTheme(getStoredPref());
})();

/**
 * Creates the animated Sun-to-Moon morphing SVG template
 */
function createThemeToggleSvg(maskId) {
  return `
    <svg class="theme-toggle-svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <mask id="${maskId}">
        <rect x="0" y="0" width="100%" height="100%" fill="white" />
        <circle class="theme-toggle-mask-circle" cx="19" cy="5" r="9" fill="black" />
      </mask>
      <circle class="theme-toggle-core" cx="12" cy="12" r="9" mask="url(#${maskId})" />
      <g class="theme-toggle-rays">
        <line x1="12" y1="1.5" x2="12" y2="4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="12" y1="19.8" x2="12" y2="22.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="4.5" y1="4.5" x2="6.4" y2="6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="17.6" y1="17.6" x2="19.5" y2="19.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="1.5" y1="12" x2="4.2" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="19.8" y1="12" x2="22.5" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="4.5" y1="19.5" x2="6.4" y2="17.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <line x1="17.6" y1="6.4" x2="19.5" y2="4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </g>
      <g class="theme-toggle-stars">
        <circle class="theme-toggle-star star-1" cx="19" cy="8" r="1.1" fill="currentColor" />
        <circle class="theme-toggle-star star-2" cx="5.5" cy="17.5" r="0.8" fill="currentColor" />
        <circle class="theme-toggle-star star-3" cx="18" cy="17" r="0.7" fill="currentColor" />
      </g>
    </svg>
  `;
}

/**
 * Injects animated SVG markup into all .btn-theme-toggle buttons on the page
 */
function initThemeToggleButtons() {
  const buttons = document.querySelectorAll('.btn-theme-toggle');
  buttons.forEach((btn, idx) => {
    if (!btn.querySelector('.theme-toggle-svg')) {
      const maskId = `theme-toggle-mask-${idx}-${Math.random().toString(36).substr(2, 5)}`;
      btn.innerHTML = createThemeToggleSvg(maskId);
    }
    btn.onclick = function (e) {
      if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
      }
      toggleTheme(e);
    };
  });

  const activeTheme = document.documentElement.getAttribute('data-theme') ||
    (window.__ssmTheme ? window.__ssmTheme.getStoredPref() : 'dark');
  updateThemeIcon(activeTheme);
}

/**
 * Animated theme toggle with smooth CSS-accelerated transition and SVG state morphing
 * Eliminates browser view-transition freezing/stuttering
 */
function toggleTheme(event) {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }

  const current = document.documentElement.getAttribute('data-theme') ||
    (window.__ssmTheme ? window.__ssmTheme.getStoredPref() : 'dark');
  const next = (current === 'light') ? 'dark' : 'light';

  const root = document.documentElement;

  // Apply smooth transition class to documentElement
  root.classList.add('theme-transitioning');

  try {
    localStorage.setItem('ssm_theme_preference', next);
  } catch (e) { /* storage unavailable */ }

  if (window.__ssmTheme && typeof window.__ssmTheme.applyTheme === 'function') {
    window.__ssmTheme.applyTheme(next);
  } else {
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.setAttribute('data-theme-mode', next);
  }

  updateThemeIcon(next);

  // Notify any active listeners of theme change
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));

  // Remove transition class after animation completes so standard transitions aren't affected
  if (window.__themeTransitionTimer) {
    clearTimeout(window.__themeTransitionTimer);
  }
  window.__themeTransitionTimer = setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, 450);
}

/**
 * Update button accessibility attributes and titles
 */
function updateThemeIcon(mode) {
  const currentTheme = (mode === 'light') ? 'light' : 'dark';

  const buttons = document.querySelectorAll('.btn-theme-toggle');
  buttons.forEach(btn => {
    const label = currentTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
    btn.setAttribute('data-theme-state', currentTheme);
  });

  // Backward compatibility with legacy font-awesome icons if any exist elsewhere
  const legacyIcons = document.querySelectorAll('#themeIcon:not(.theme-toggle-svg *), .theme-toggle-icon:not(.theme-toggle-svg *)');
  legacyIcons.forEach(icon => {
    if (currentTheme === 'dark') {
      icon.className = 'fa-solid fa-moon theme-toggle-icon';
    } else {
      icon.className = 'fa-solid fa-sun theme-toggle-icon';
    }
  });
}

// Initialize on DOMContentLoaded and immediately if document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeToggleButtons);
} else {
  initThemeToggleButtons();
}

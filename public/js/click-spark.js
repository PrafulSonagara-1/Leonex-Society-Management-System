/**
 * click-spark.js — React Bits ClickSpark Animation for Landing Page
 * Faithfully ports @react-bits/ClickSpark-TS-TW to vanilla JS for SocietyHub
 *
 * Configuration:
 *  - sparkColor:  #ffffff (with light theme contrast auto-adaptation)
 *  - sparkSize:   10
 *  - sparkRadius: 15
 *  - sparkCount:  8
 *  - duration:    400ms
 *  - easing:      ease-out (t * (2 - t))
 *  - extraScale:  1.0
 *
 * Rules:
 *  - Active ONLY on the landing page (index.html)
 *  - Triggers ONLY on empty or blank space
 *  - Strictly ignores hero section (#home, .cosmic-hero, dashboard preview)
 *  - Strictly ignores buttons, links, form inputs, and interactive controls
 */

(function () {
  'use strict';

  // Safeguard: Ensure this only activates on the landing page
  const isLandingPage =
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('/index.html') ||
    window.location.pathname.endsWith('/') ||
    document.querySelector('.cosmic-hero') !== null;

  if (!isLandingPage) return;

  // Reduced motion preference
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionQuery.matches) return;

  // Configuration identical to React Bits ClickSpark component
  const CONFIG = {
    sparkColor: '#ffffff',
    sparkSize: 10,
    sparkRadius: 15,
    sparkCount: 8,
    duration: 400, // ms
    easing: 'ease-out',
    extraScale: 1.0,
    lineWidth: 2
  };

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let animId = null;
  const sparks = [];

  // Easing functions
  function easeFunc(t, easing) {
    switch (easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'ease-out':
      default:
        return t * (2 - t);
    }
  }

  // Setup full-viewport overlay canvas
  function setupCanvas() {
    canvas = document.getElementById('clickSparkCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'clickSparkCanvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100vw',
        'height: 100vh',
        'pointer-events: none',
        'z-index: 99998',
        'display: block'
      ].join(';');
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext('2d', { alpha: true });
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  // Animation Loop — Active strictly while sparks are in flight (0% idle CPU)
  function draw(now) {
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Theme detection: In light mode, use crisp high-contrast dark charcoal/slate
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const activeColor = isDark ? CONFIG.sparkColor : '#18181b';

    ctx.strokeStyle = activeColor;
    ctx.lineWidth = CONFIG.lineWidth;
    ctx.lineCap = 'round';
    if (isDark) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 4;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 2;
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      const elapsed = now - spark.startTime;

      if (elapsed >= CONFIG.duration) {
        sparks.splice(i, 1);
        continue;
      }

      const progress = elapsed / CONFIG.duration;
      const eased = easeFunc(progress, CONFIG.easing);

      const distance = eased * CONFIG.sparkRadius * CONFIG.extraScale;
      const lineLength = CONFIG.sparkSize * (1 - eased);

      const x1 = spark.x + distance * Math.cos(spark.angle);
      const y1 = spark.y + distance * Math.sin(spark.angle);
      const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
      const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();

    if (sparks.length > 0) {
      animId = requestAnimationFrame(draw);
    } else {
      animId = null;
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  function ensureLoopRunning() {
    if (!animId) {
      animId = requestAnimationFrame(draw);
    }
  }

  /**
   * Determine if the clicked element should trigger a ClickSpark.
   * Criteria:
   *  - Must NOT be inside the hero section (.cosmic-hero, #home, dashboard preview)
   *  - Must NOT be inside navigation header (.cosmic-header-wrap)
   *  - Must NOT be on a button, link, or interactive element
   *  - Must NOT have cursor: pointer
   *  - Must NOT be media (svg, img, video)
   *  - Only triggers on blank/empty spaces across the landing page
   */
  function isExcludedTarget(target) {
    if (!target) return true;

    // 1. Exclude Hero Section & Dashboard Preview (already has cosmic shooting stars)
    if (target.closest('.cosmic-hero, #home, .cosmic-dash-wrap, #cosmicDashboard, #cosmicRainCanvas')) {
      return true;
    }

    // 2. Exclude Header & Navigation Bar
    if (target.closest('header, .cosmic-header-wrap, .cosmic-nav-pill, #navMobileDrawer')) {
      return true;
    }

    // 3. Exclude Buttons, Links, Form Controls, and Modals
    if (
      target.closest(
        'button, a, input, select, textarea, label, ' +
        '[role="button"], [role="link"], ' +
        '.cosmic-btn-primary, .cosmic-btn-ghost, .cosmic-nav-cta, .cosmic-role-cta, ' +
        '.btn-theme-toggle, .faq-trigger, .cosmic-dash-menu-btn, .cosmic-nav-toggle, ' +
        '.modal, .dropdown'
      )
    ) {
      return true;
    }

    // 4. Exclude media elements and icons
    if (target.closest('svg, img, video, canvas, iframe, i.fa-solid, i.fa-regular, i.fa-brands')) {
      return true;
    }

    // 5. Exclude any element explicitly styled with cursor: pointer
    try {
      const computed = window.getComputedStyle(target);
      if (computed.cursor === 'pointer') {
        return true;
      }
    } catch (err) {}

    return false;
  }

  // Handle pointer/click events
  function handleClick(e) {
    if (e.clientX == null || e.clientY == null) return;

    // Check exclusion filters
    if (isExcludedTarget(e.target)) {
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const now = performance.now();

    // Spawn sparks evenly spaced in a 360-degree circle
    for (let i = 0; i < CONFIG.sparkCount; i++) {
      sparks.push({
        x,
        y,
        angle: (2 * Math.PI * i) / CONFIG.sparkCount,
        startTime: now
      });
    }

    ensureLoopRunning();
  }

  // Initialize
  function init() {
    setupCanvas();
    // Using click event to guarantee natural user click interaction
    document.addEventListener('click', handleClick, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

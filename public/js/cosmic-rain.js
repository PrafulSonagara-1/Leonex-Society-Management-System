/**
 * cosmic-rain.js — Cinematic Shooting Star Sky & Astronomical Telescope Star Interaction
 * Inspired by cosmic.shadcnuikit.com & celestial astrophotography
 *
 * Features:
 *  - Ambient Stars: Fall vertically (top to bottom) with dynamic speeds (1.2 to 4.4), varied lengths (35 to 165px), thin delicate strokes (0.8 to 1.3px), and seamless tapered streaks (no dots)
 *  - Speed-Dependent Bubble Counts with Consistently Small Size (1.2 - 2.4px): High speed = 12-16 bubbles, Low speed = 4-6 bubbles
 *  - User Click Interaction:
 *      * Origin: Always fixed at top-left outside viewport (-70, -70)
 *      * Flight: Brisk medium speed with identical sleek tapered trail design as ambient stars (no circle head)
 *      * Star at Click: Real telescope astrophotography star (matching user photo) with sharp 4-point diagonal diffraction spikes ("X" cross), cyan-white ethereal airy disc halo, and diamond-white celestial core
 *      * Duration: Extended glow duration of ~1400ms (1.4s) with sustained twinkle & shimmer before smooth ethereal fade-out
 */

(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CFG = {
    maxMeteors: 3,                 // Decreased: only 2-3 active ambient shooting stars at a time (uncluttered)
    spawnProbability: 0.022,       // Calm, graceful star cadence
    speedMin: 1.1,                 // Diverse speed spectrum: slow, medium, and fast
    speedMax: 6.4,
    lengthMin: 30,                 // Length scales with speed
    lengthMax: 135,
    widthMin: 0.75,                // Crisp, visible, and refined width
    widthMax: 1.25,

    // Impact Bubble Parameters (Translucent Micro-Bubbles)
    dropletRadiusMin: 1.4,         // Delicate translucent micro-bubbles
    dropletRadiusMax: 2.6,
    dropletLifeMin: 55,
    dropletLifeMax: 100,

    // Ambient floating stardust
    ambientStarCount: 36,

    // Pure Caramel Palette (#A66E43, #B97D4E, #C68A5A, #915C34, #D49A68)
    caramelColors: [
      { r: 166, g: 110, b: 67 },   // Base Caramel (#A66E43)
      { r: 185, g: 125, b: 78 },   // Warm Amber Caramel (#B97D4E)
      { r: 198, g: 138, b: 90 },   // Luminous Golden Caramel (#C68A5A)
      { r: 212, g: 154, b: 104 },  // Soft Caramel Tint (#D49A68)
      { r: 145, g: 92, b: 52 },   // Deep Warm Caramel (#915C34)
    ],
  };

  let canvas, ctx;
  let meteors = [];
  let clickStars = [];             // Interactive click-to-shooting-star instances
  let droplets = [];
  let ripples = [];
  let flashes = [];
  let spaceGlows = [];
  let ambientStars = [];
  let dashRect = null;
  let animId = null;
  let dpr = 1;

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function isDarkTheme() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    return theme !== 'light';
  }

  // ── INITIALIZATION ────────────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('cosmicRainCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', refreshDashRect, { passive: true });

    // Seed ambient floating stardust
    seedAmbientStars();

    // Initial staggered shooting stars
    for (let i = 0; i < 2; i++) {
      const m = createMeteor();
      m.y = rand(0, (canvas.height / dpr) * 0.5);
      meteors.push(m);
    }

    // Interactive click listener: only active in black/dark theme (disabled in white theme)
    const hero = canvas.closest('.cosmic-hero') || canvas.parentElement;
    if (hero) {
      hero.addEventListener('click', (e) => {
        if (!isDarkTheme()) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        spawnClickStar(clickX, clickY);
      }, { passive: true });
    }

    // Interactive mouse spotlight tracking for benefit & role cards
    initSpotlightCards();

    // Single Shared Sliding Hover Background on Feature Cards (Inspired by cosmic.shadcnuikit.com)
    initFeatureSharedHover();

    // MagicUI Ripple Button Click Effect (Landing Page Buttons)
    initRippleButtons();

    tick();
  }

  function initRippleButtons() {
    const btnSelector = '.cosmic-btn-primary, .cosmic-btn-ghost, .cosmic-nav-cta, .cosmic-role-cta, .cosmic-theme-btn, .cosmic-dash-menu-btn, .cosmic-ripple-btn';
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest(btnSelector);
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 2.2;

      const ripple = document.createElement('span');
      ripple.className = 'cosmic-btn-ripple';
      ripple.style.width = `${Math.round(size)}px`;
      ripple.style.height = `${Math.round(size)}px`;
      ripple.style.left = `${Math.round(x - size / 2)}px`;
      ripple.style.top = `${Math.round(y - size / 2)}px`;

      btn.appendChild(ripple);

      ripple.addEventListener('animationend', () => {
        ripple.remove();
      });
      setTimeout(() => {
        if (ripple.parentElement) ripple.remove();
      }, 700);
    });
  }

  function initFeatureSharedHover() {
    const grid = document.getElementById('cosmicFeatGrid') || document.querySelector('.cosmic-feat-grid');
    if (!grid) return;

    let sharedBg = document.getElementById('cosmicFeatSharedBg');
    if (!sharedBg) {
      sharedBg = document.createElement('div');
      sharedBg.id = 'cosmicFeatSharedBg';
      sharedBg.className = 'cosmic-feat-shared-bg';
      sharedBg.setAttribute('aria-hidden', 'true');
      grid.prepend(sharedBg);
    }

    const cards = Array.from(grid.querySelectorAll('.cosmic-feat-grid-card'));
    if (!cards.length) return;

    let activeCard = null;
    let isHovered = false;
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function updatePosition(card, immediate = false) {
      if (!card) return;
      const gridRect = grid.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();

      const x = cardRect.left - gridRect.left;
      const y = cardRect.top - gridRect.top;
      const w = cardRect.width;
      const h = cardRect.height;

      if (immediate || isReducedMotion) {
        sharedBg.style.transition = 'opacity 0.25s ease';
      } else {
        sharedBg.style.transition = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), width 0.38s cubic-bezier(0.22, 1, 0.36, 1), height 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease, visibility 0.28s ease';
      }

      sharedBg.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      sharedBg.style.width = `${Math.round(w)}px`;
      sharedBg.style.height = `${Math.round(h)}px`;
      sharedBg.style.opacity = '1';
      sharedBg.style.visibility = 'visible';
    }

    function setActive(card) {
      if (!card) return;
      const wasInactive = !isHovered;
      isHovered = true;
      activeCard = card;

      cards.forEach((c) => c.classList.remove('is-active'));
      card.classList.add('is-active');

      if (wasInactive) {
        // First entry: position immediately without sliding from a stale position
        updatePosition(card, true);
      } else {
        // Moving between cards: smoothly glide across grid
        updatePosition(card, false);
      }
    }

    function clearActive() {
      isHovered = false;
      activeCard = null;
      cards.forEach((c) => c.classList.remove('is-active'));
      sharedBg.style.opacity = '0';
      sharedBg.style.visibility = 'hidden';
    }

    cards.forEach((card) => {
      // Pointer & Mouse Events
      card.addEventListener('pointerenter', () => setActive(card));
      card.addEventListener('mouseenter', () => setActive(card));
      card.addEventListener('touchstart', () => setActive(card), { passive: true });

      // Keyboard Focus Accessibility
      card.addEventListener('focus', () => setActive(card));
      card.addEventListener('blur', () => {
        setTimeout(() => {
          if (!grid.contains(document.activeElement)) {
            clearActive();
          }
        }, 10);
      });
    });

    grid.addEventListener('pointerleave', () => clearActive());
    grid.addEventListener('mouseleave', () => clearActive());

    // Window Resize / Orientation recalculation
    window.addEventListener('resize', () => {
      if (activeCard && isHovered) {
        updatePosition(activeCard, true);
      }
    }, { passive: true });
  }

  function initSpotlightCards() {
    const cards = document.querySelectorAll('.cosmic-bcard, .cosmic-role-card');
    cards.forEach((card) => {
      const updateCoords = (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      };
      card.addEventListener('mousemove', updateCoords, { passive: true });
      card.addEventListener('pointermove', updateCoords, { passive: true });
      card.addEventListener('pointerenter', updateCoords, { passive: true });
    });
  }

  function resize() {
    if (!canvas) return;
    const hero = canvas.closest('.cosmic-hero') || canvas.parentElement;
    if (!hero) return;

    dpr = window.devicePixelRatio || 1;
    const w = hero.offsetWidth;
    const h = hero.offsetHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    refreshDashRect();
    seedAmbientStars();
  }

  function refreshDashRect() {
    const dashEl = document.getElementById('cosmicDashboard');
    if (!dashEl || !canvas) {
      dashRect = null;
      return;
    }
    const hero = canvas.closest('.cosmic-hero') || canvas.parentElement;
    const heroRect = hero.getBoundingClientRect();
    const dRect = dashEl.getBoundingClientRect();

    dashRect = {
      left: dRect.left - heroRect.left,
      right: dRect.right - heroRect.left,
      top: dRect.top - heroRect.top,
      bottom: dRect.bottom - heroRect.top,
      width: dRect.width,
    };
  }

  function seedAmbientStars() {
    if (!canvas) return;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ambientStars = [];

    for (let i = 0; i < CFG.ambientStarCount; i++) {
      ambientStars.push({
        x: rand(0, w),
        y: rand(0, h),
        radius: rand(0.9, 1.8),
        color: randChoice(CFG.caramelColors),
        alpha: rand(0.2, 0.55),
        twinkleSpeed: rand(0.012, 0.028),
        twinklePhase: rand(0, Math.PI * 2),
      });
    }
  }

  // ── AMBIENT METEORS (Straight Top-to-Bottom, Varied Speeds & Lengths, Thin) ───
  function createMeteor() {
    const w = canvas ? canvas.width / dpr : 1200;
    const color = randChoice(CFG.caramelColors);

    // 3 Distinct Speed Tiers so every star has a visibly different speed (never uniform):
    // 35% slow serene glide, 40% medium natural, 25% fast swift streak
    const speedRoll = Math.random();
    let speed, length, width;

    if (speedRoll < 0.35) {
      // Tier 1: Slow, gentle glide (majestic slow motion)
      speed = rand(1.1, 1.7);
      length = rand(30, 50);
      width = rand(0.75, 0.95);
    } else if (speedRoll < 0.75) {
      // Tier 2: Medium natural pace
      speed = rand(2.4, 3.4);
      length = rand(55, 85);
      width = rand(0.85, 1.10);
    } else {
      // Tier 3: Fast swift shooting star (brisk atmospheric streak)
      speed = rand(4.8, 6.4);
      length = rand(95, 135);
      width = rand(0.95, 1.25);
    }

    return {
      x: rand(w * 0.05, w * 0.95),
      y: rand(-140, -30),
      vx: 0,                        // Purely straight vertical top-to-bottom
      vy: speed,
      speed: speed,
      length: length,
      width: width,
      alpha: rand(0.50, 0.68),      // Soft, gentle warm luminescence
      color: color,
    };
  }

  // ── USER CLICK STAR (Matching Trail Design, Brisk Speed, Extended Astrophotography Star) ──
  function spawnClickStar(targetX, targetY) {
    if (!isDarkTheme()) return; // Disabled in white theme (active only in black theme)

    const startX = -70;
    const startY = -70;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Medium constant responsive speed: ~300ms to 540ms flight
    const travelDuration = REDUCED ? 0 : Math.min(540, Math.max(300, (distance / 1000) * 240 + 280));
    const maxTrailLength = Math.min(110, Math.max(45, distance * 0.13)); // Balanced trail length
    const baseSize = rand(7.0, 9.5); // Refined celestial star size matching photo
    const color = CFG.caramelColors[2];

    const now = performance.now();
    const glowDuration = 1400; // Increased duration: 1.4s (1400ms)

    clickStars.push({
      id: Math.random(),
      startX: startX,
      startY: startY,
      targetX: targetX,
      targetY: targetY,
      dx: dx,
      dy: dy,
      distance: distance,
      angle: angle,
      maxTrailLength: maxTrailLength,
      baseSize: baseSize,
      color: color,
      startTime: now,
      travelDuration: travelDuration,
      glowDuration: glowDuration,
      tArrive: now + travelDuration,
      tEnd: now + travelDuration + glowDuration,
    });
  }

  // ── SURFACE COLLISION: SUBTLE LOCALIZED GLOW & SMALL SLOW-MOTION BUBBLES ────
  function triggerSurfaceImpact(x, y, impactSpeed) {
    const bubbleColor = { r: 170, g: 118, b: 73 }; // rgb(170, 118, 73)

    // 1. Subtle, small localized accent glow (not full/overpowering)
    spaceGlows.push({
      x: x,
      y: y,
      radius: 4,
      maxRadius: rand(24, 38), // Small, restrained localized glow pool
      alpha: 0.28,             // Low intensity, delicate aura
      life: 55,
      maxLife: 55,
      color: bubbleColor,
    });

    // 2. Small, low-speed bubbles in rgb(170, 118, 73)
    const count = Math.floor(rand(10, 14)); // Clean, balanced count

    for (let i = 0; i < count; i++) {
      // Small bubble size: radius 1.4px to 2.6px (small delicate bubbles)
      const radius = rand(1.4, 2.6);
      const life = Math.floor(rand(75, 110)); // Long calm floating duration

      // Calm, low-speed velocity distribution:
      let vx, vy;
      const type = i % 3;
      if (type === 0) {
        // Base low cluster: slow upward drift
        vx = rand(-0.25, 0.25);
        vy = -rand(0.20, 0.45);
      } else if (type === 1) {
        // Mid floaters: gentle rise
        vx = rand(-0.45, 0.45);
        vy = -rand(0.40, 0.70);
      } else {
        // Outer floaters: slow gentle arc
        const side = Math.random() < 0.5 ? -1 : 1;
        vx = side * rand(0.35, 0.70);
        vy = -rand(0.65, 1.05);
      }

      droplets.push({
        x: x + rand(-3, 3),
        y: y - 1,
        vx: vx,
        vy: vy,
        buoyancy: -0.0004, // Very gentle upward micro-float
        friction: 0.976,   // Smooth calm deceleration, zero rush
        radius: radius,
        initialRadius: radius,
        delay: 0,          // All at once
        life: life,
        maxLife: life,
        color: bubbleColor,
        baseAlpha: rand(0.70, 0.90), // Solid visible bubble in rgb(170, 118, 73)
        wobble: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.015, 0.03),
        wobbleAmp: rand(0.02, 0.05),
      });
    }
  }

  // ── RENDERERS ─────────────────────────────────────────────────────────────
  function drawAmbientStars() {
    for (let i = 0; i < ambientStars.length; i++) {
      const s = ambientStars[i];
      s.twinklePhase += s.twinkleSpeed;
      const alpha = s.alpha * (0.6 + 0.4 * Math.sin(s.twinklePhase));
      const { r, g, b } = s.color;

      ctx.save();
      if (isDarkTheme()) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(160, 95, 40, ${Math.min(0.95, alpha * 1.35)})`;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Realistic Ambient Shooting Star Design (Straight top-to-bottom, seamless tapered line)
  function drawMeteor(m) {
    const tailX = m.x;
    const tailY = m.y - m.length;

    const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
    const { r, g, b } = m.color;

    if (isDarkTheme()) {
      // EXACT ORIGINAL BLACK THEME DESIGN (NO CHANGES)
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
      grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${m.alpha * 0.20})`);
      grad.addColorStop(0.70, `rgba(${r + 10 > 255 ? 255 : r + 10}, ${g + 8 > 255 ? 255 : g + 8}, ${b + 5}, ${m.alpha * 0.52})`);
      grad.addColorStop(0.92, `rgba(240, 222, 205, ${m.alpha * 0.70})`);
      grad.addColorStop(1, `rgba(250, 240, 230, ${m.alpha * 0.80})`);

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.lineCap = 'round';

      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${m.alpha * 0.42})`;
      ctx.shadowBlur = 2.2;

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();

      ctx.restore();
    } else {
      // SHOOTING STAR IN WHITE THEME: Decreased thickness & darkness in rgb(170, 118, 73)
      grad.addColorStop(0, 'rgba(170, 118, 73, 0)');
      grad.addColorStop(0.35, 'rgba(170, 118, 73, 0.18)');
      grad.addColorStop(0.70, 'rgba(170, 118, 73, 0.38)');
      grad.addColorStop(0.92, 'rgba(170, 118, 73, 0.55)');
      grad.addColorStop(1, 'rgba(170, 118, 73, 0.65)');

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(0.85, m.width * 0.95);
      ctx.lineCap = 'round';

      ctx.shadowColor = 'rgba(170, 118, 73, 0.25)';
      ctx.shadowBlur = 1.8;

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();

      ctx.restore();
    }
  }

  // ── CLICK SHOOTING STAR & EXTENDED ASTROPHOTOGRAPHY STAR (Matching User Image) ──
  function renderClickStar(star, now) {
    // PHASE 1: SHOOTING TRAIL (Same tapered streak, brisk medium speed, no slowdown)
    if (now < star.tArrive) {
      const tNorm = Math.min(1, Math.max(0, (now - star.startTime) / star.travelDuration));
      const progress = tNorm * (2 - tNorm * 0.5) / 1.5;

      const headX = star.startX + star.dx * progress;
      const headY = star.startY + star.dy * progress;

      let trailFade = 1.0;
      if (tNorm > 0.80) {
        trailFade = Math.max(0, (1 - tNorm) / 0.20);
      }
      const currentTrailLength = star.maxTrailLength * Math.min(1, tNorm * 3) * trailFade;

      const tailX = headX - Math.cos(star.angle) * currentTrailLength;
      const tailY = headY - Math.sin(star.angle) * currentTrailLength;

      if (currentTrailLength > 2) {
        const { r, g, b } = star.color;
        const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);

        if (isDarkTheme()) {
          // BALANCED DESIGN: Subdued, smooth warm luminescence (EXACT ORIGINAL BLACK THEME)
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
          grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${0.20 * trailFade})`);
          grad.addColorStop(0.70, `rgba(${r + 10 > 255 ? 255 : r + 10}, ${g + 8 > 255 ? 255 : g + 8}, ${b + 5}, ${0.52 * trailFade})`);
          grad.addColorStop(0.92, `rgba(240, 222, 205, ${0.70 * trailFade})`);
          grad.addColorStop(1, `rgba(250, 240, 230, ${0.80 * trailFade})`);

          ctx.save();
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.82; // Sleek and refined
          ctx.lineCap = 'round';
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.42 * trailFade})`;
          ctx.shadowBlur = 2.2;

          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(headX, headY);
          ctx.stroke();
          ctx.restore();
        } else {
          // White Theme Click Star Trail: Decreased thickness & darkness in rgb(170, 118, 73)
          grad.addColorStop(0, 'rgba(170, 118, 73, 0)');
          grad.addColorStop(0.35, `rgba(170, 118, 73, ${0.18 * trailFade})`);
          grad.addColorStop(0.70, `rgba(170, 118, 73, ${0.38 * trailFade})`);
          grad.addColorStop(0.92, `rgba(170, 118, 73, ${0.55 * trailFade})`);
          grad.addColorStop(1, `rgba(170, 118, 73, ${0.65 * trailFade})`);

          ctx.save();
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.95;
          ctx.lineCap = 'round';
          ctx.shadowColor = `rgba(170, 118, 73, ${0.25 * trailFade})`;
          ctx.shadowBlur = 1.8;

          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(headX, headY);
          ctx.stroke();
          ctx.restore();
        }
      }
      return;
    }

    // PHASE 2: EXTENDED GLOWING TELESCOPE STAR (~1400ms duration, matching user photo)
    const elapsed = now - star.tArrive;
    const totalGlowDuration = star.glowDuration || 1400;
    const progress = Math.min(1, Math.max(0, elapsed / totalGlowDuration)); // 0 -> 1

    if (progress >= 1.0) return; // Finished & disappeared

    // Lifecycle Animation:
    // 0 -> 180ms: smooth bloom expansion (scale: 0.4 -> 1.35x, alpha: 0.7 -> 1.0)
    // 180 -> 950ms: sustained brilliant twinkle (scale: 1.0 + 0.07 * sin, alpha: ~1.0)
    // 950 -> 1400ms: ethereal smooth fade-out (alpha: 1.0 -> 0)
    let scale = 1.0;
    let alpha = 1.0;
    let shimmer = 1.0;

    if (elapsed < 180) {
      const p = elapsed / 180;
      const easedP = Math.sin(p * Math.PI * 0.5);
      scale = 0.4 + 0.95 * easedP;
      alpha = 0.7 + 0.3 * easedP;
    } else if (elapsed < 950) {
      const p = (elapsed - 180) / 770;
      shimmer = 1.0 + 0.07 * Math.sin(p * Math.PI * 6);
      scale = 1.0 * shimmer;
      alpha = 0.92 + 0.08 * Math.sin(p * Math.PI * 4);
    } else {
      const p = (elapsed - 950) / 450;
      scale = 1.0 - 0.25 * p;
      alpha = Math.max(0, 1.0 - p);
    }

    const posX = star.targetX;
    const posY = star.targetY;
    const size = (star.baseSize || 8.0) * scale;

    ctx.save();

    // 1. Soft Circular Cyan-Blue Airy Disc Nebula Halo (Matching Reference Photo)
    const haloRadius = size * 3.8;
    const haloGrad = ctx.createRadialGradient(posX, posY, 0, posX, posY, haloRadius);
    haloGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
    haloGrad.addColorStop(0.18, `rgba(215, 240, 255, ${alpha * 0.75})`);
    haloGrad.addColorStop(0.40, `rgba(165, 215, 255, ${alpha * 0.40})`);
    haloGrad.addColorStop(0.70, `rgba(125, 185, 255, ${alpha * 0.12})`);
    haloGrad.addColorStop(1, 'rgba(100, 170, 255, 0)');

    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(posX, posY, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. 4 Sharp Diagonal Telescope Diffraction Spikes ("X" Cross Angle ~45°)
    const spikeLength = size * 5.2;
    const spikeAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]; // 45°, 135°, 225°, 315°

    ctx.shadowColor = 'rgba(186, 230, 253, 0.95)';
    ctx.shadowBlur = 8;

    for (let i = 0; i < spikeAngles.length; i++) {
      const ang = spikeAngles[i];
      const tipX = posX + Math.cos(ang) * spikeLength;
      const tipY = posY + Math.sin(ang) * spikeLength;

      const spikeGrad = ctx.createLinearGradient(posX, posY, tipX, tipY);
      spikeGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.98})`);
      spikeGrad.addColorStop(0.30, `rgba(215, 240, 255, ${alpha * 0.75})`);
      spikeGrad.addColorStop(0.65, `rgba(165, 215, 255, ${alpha * 0.35})`);
      spikeGrad.addColorStop(1, 'rgba(140, 200, 255, 0)');

      ctx.strokeStyle = spikeGrad;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(posX, posY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }

    // 3. Subtle Horizontal & Vertical Minor Rays (+ Cross Accent)
    const minorRayLength = size * 2.2;
    const minorAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]; // 0°, 90°, 180°, 270°
    for (let i = 0; i < minorAngles.length; i++) {
      const ang = minorAngles[i];
      const tipX = posX + Math.cos(ang) * minorRayLength;
      const tipY = posY + Math.sin(ang) * minorRayLength;

      const minorGrad = ctx.createLinearGradient(posX, posY, tipX, tipY);
      minorGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.85})`);
      minorGrad.addColorStop(0.50, `rgba(200, 230, 255, ${alpha * 0.35})`);
      minorGrad.addColorStop(1, 'rgba(160, 210, 255, 0)');

      ctx.strokeStyle = minorGrad;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(posX, posY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }

    // 4. Pure White Blazing Celestial Core
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(posX, posY, Math.max(1.0, size * 0.28), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Subtle, restrained surface glow (not full/overpowering)
  function drawSpaceGlow(g) {
    const progress = 1 - (g.life / g.maxLife);
    if (progress >= 1.0) return;

    const alpha = g.alpha * Math.sin(progress * Math.PI);
    if (alpha <= 0.002) return;

    const currentR = g.radius + (g.maxRadius - g.radius) * Math.sin(progress * Math.PI * 0.5);
    const { r, g: gVal, b } = g.color;

    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(1.35, 0.65);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentR);
    if (isDarkTheme()) {
      // EXACT ORIGINAL BLACK THEME DESIGN
      grad.addColorStop(0, `rgba(${r}, ${gVal}, ${b}, ${alpha * 0.35})`);
      grad.addColorStop(0.4, `rgba(${r}, ${gVal}, ${b}, ${alpha * 0.16})`);
      grad.addColorStop(0.8, `rgba(${r}, ${gVal}, ${b}, ${alpha * 0.03})`);
      grad.addColorStop(1, `rgba(${r}, ${gVal}, ${b}, 0)`);
    } else {
      // Soft warm amber surface glow in white theme
      grad.addColorStop(0, `rgba(170, 105, 45, ${alpha * 0.38})`);
      grad.addColorStop(0.4, `rgba(170, 105, 45, ${alpha * 0.16})`);
      grad.addColorStop(0.8, `rgba(170, 105, 45, ${alpha * 0.03})`);
      grad.addColorStop(1, `rgba(170, 105, 45, 0)`);
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, currentR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFlash(f) {
    const progress = 1 - (f.life / f.maxLife);
    const currentR = f.maxRadius * Math.sin(progress * Math.PI * 0.5);
    const alpha = f.alpha * (1 - progress);
    const { r, g, b } = f.color;

    ctx.save();
    const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, currentR);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.45})`);
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(f.x, f.y, currentR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRipple(rip) {
    const progress = 1 - (rip.life / rip.maxLife);
    const currentR = rip.radius + (rip.maxRadius - rip.radius) * progress;
    const alpha = rip.alpha * (1 - progress);
    const { r, g, b } = rip.color;

    ctx.save();
    if (isDarkTheme()) {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.60})`;
    } else {
      ctx.strokeStyle = `rgba(130, 65, 20, ${alpha * 0.70})`;
    }
    ctx.lineWidth = 1.2 * (1 - progress);
    ctx.beginPath();
    ctx.ellipse(rip.x, rip.y, currentR * 1.8, currentR * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Small Solid Bubble in rgb(170, 118, 73)
  function drawDroplet(d) {
    const age = d.maxLife - d.life;
    const progress = d.life / d.maxLife; // 1.0 -> 0.0
    const fadeIn = Math.min(1.0, age / 5);
    const fadeOut = Math.pow(progress, 1.25);
    const alpha = (d.baseAlpha || 0.85) * fadeIn * fadeOut;
    const { r, g, b } = d.color; // rgb(170, 118, 73)

    const currentR = Math.max(0.7, d.initialRadius * (0.85 + 0.15 * progress));

    ctx.save();
    if (isDarkTheme()) {
      // Solid filled circle in rgb(170, 118, 73) (EXACT ORIGINAL DARK THEME)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, currentR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Crisp high-contrast bubble in rgb(170, 118, 73) for white theme
      ctx.shadowColor = `rgba(80, 40, 12, ${alpha * 0.55})`;
      ctx.shadowBlur = 3.5;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1.0, alpha * 1.25)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, currentR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(110, 55, 20, ${alpha * 0.75})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── ANIMATION TICK LOOP ───────────────────────────────────────────────────
  function tick() {
    if (!canvas || !ctx) return;

    const now = performance.now();
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    if (Math.random() < 0.03) {
      refreshDashRect();
    }

    // 1. Ambient stardust
    drawAmbientStars();

    // 2. Space Glow Nebula clouds
    const nextSpaceGlows = [];
    for (let i = 0; i < spaceGlows.length; i++) {
      const g = spaceGlows[i];
      g.life--;
      if (g.life > 0) {
        drawSpaceGlow(g);
        nextSpaceGlows.push(g);
      }
    }
    spaceGlows = nextSpaceGlows;

    // 3. Spawn continuous ambient meteors (only in black theme)
    if (meteors.length < CFG.maxMeteors && Math.random() < CFG.spawnProbability) {
      meteors.push(createMeteor());
    }

    // 4. Update & render ambient meteors
    const nextMeteors = [];
    for (let i = 0; i < meteors.length; i++) {
      const m = meteors[i];
      m.x += m.vx;
      m.y += m.vy;

      let completed = false;

      // Check collision with top surface of dashboard (for ambient meteors)
      if (dashRect) {
        if (m.x >= dashRect.left && m.x <= dashRect.right) {
          if (m.y >= dashRect.top - 6 && m.y <= dashRect.top + 22) {
            triggerSurfaceImpact(m.x, dashRect.top, m.vy);
            completed = true;
          }
        }
      }

      // Bottom canvas exit
      if (!completed && (m.y >= h + 60 || m.x >= w + 100 || m.x <= -100)) {
        completed = true;
      }

      if (!completed) {
        drawMeteor(m);
        nextMeteors.push(m);
      }
    }
    meteors = nextMeteors;

    // 5. Update & render Interactive Click Stars (Active only in black theme)
    const nextClickStars = [];
    if (isDarkTheme()) {
      for (let i = 0; i < clickStars.length; i++) {
        const cs = clickStars[i];
        if (now <= cs.tEnd) {
          renderClickStar(cs, now);
          nextClickStars.push(cs);
        }
      }
    }
    clickStars = nextClickStars;

    // 6. Update & render flashes
    const nextFlashes = [];
    for (let i = 0; i < flashes.length; i++) {
      const f = flashes[i];
      f.life--;
      if (f.life > 0) {
        drawFlash(f);
        nextFlashes.push(f);
      }
    }
    flashes = nextFlashes;

    // 7. Update & render surface ripples
    const nextRipples = [];
    for (let i = 0; i < ripples.length; i++) {
      const rip = ripples[i];
      rip.life--;
      if (rip.life > 0) {
        drawRipple(rip);
        nextRipples.push(rip);
      }
    }
    ripples = nextRipples;

    // 8. Update & render floating micro-bubbles
    const nextDroplets = [];
    for (let i = 0; i < droplets.length; i++) {
      const d = droplets[i];
      // Staggered emergence: wait for delay countdown
      if (d.delay && d.delay > 0) {
        d.delay--;
        nextDroplets.push(d);
        continue;
      }

      d.x += d.vx;
      d.y += d.vy;

      // Natural organic horizontal bubble sway
      if (d.wobble !== undefined) {
        d.wobble += d.wobbleSpeed;
        d.x += Math.sin(d.wobble) * d.wobbleAmp;
      }

      d.vx *= d.friction;
      d.vy *= d.friction;

      if (d.buoyancy !== undefined) {
        d.vy += d.buoyancy;
      } else if (d.gravity !== undefined) {
        d.vy += d.gravity;
      }

      d.life--;

      if (d.life > 0) {
        drawDroplet(d);
        nextDroplets.push(d);
      }
    }
    droplets = nextDroplets;

    animId = requestAnimationFrame(tick);
  }

  // ── BOOTSTRAP ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CosmicRain = {
    refresh: refreshDashRect,
    triggerImpact: triggerSurfaceImpact,
    spawnMeteor: spawnClickStar,
    stop: () => { if (animId) cancelAnimationFrame(animId); },
    start: () => { if (!animId) tick(); },
  };

})();

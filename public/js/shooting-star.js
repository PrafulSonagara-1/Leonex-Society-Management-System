/**
 * shooting-star.js — Global Click-Triggered Shooting Star Impact Animation
 * SocietyHub Landing Page
 *
 * Effect Description:
 *  1. Streak Phase (~150-200ms): Thin bright vertical line (#F0B37E to #FFFFFF)
 *     accelerating down from 60-80px above to the click point (ease-in).
 *  2. Burst Phase (1.0-1.5s): 15-25 warm amber/copper/gold particles launching outward
 *     in 360° with randomized velocity, downward gravity drift, deceleration, and fade/shrink.
 *  3. Performance & Memory: Fixed full-viewport overlay canvas (pointer-events: none),
 *     RAF loop active only while animating, concurrency capped at 180 particles,
 *     respects prefers-reduced-motion.
 */

(function () {
  'use strict';

  // ── Reduced Motion Check ──────────────────────────────────────────────────
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReducedMotion = motionQuery.matches;
  if (motionQuery.addEventListener) {
    motionQuery.addEventListener('change', (e) => {
      prefersReducedMotion = e.matches;
    });
  }

  // ── Color Palette (SocietyHub Warm Amber / Copper / Gold Family) ───────────
  const COLOR_PALETTE = [
    { r: 201, g: 121, b: 63 },  // Amber / Copper (#C9793F)
    { r: 217, g: 148, b: 95 },  // Medium Copper (#D9945F)
    { r: 240, g: 179, b: 126 }, // Warm Gold (#F0B37E)
    { r: 232, g: 152, b: 78 },  // Radiant Amber (#E8984E)
    { r: 255, g: 214, b: 165 }, // Soft Gold Highlight (#FFD6A5)
    { r: 255, g: 240, b: 220 }  // Specular Warm White
  ];

  const MAX_CONCURRENT_PARTICLES = 180;

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let animFrameId = null;

  const activeStreaks = [];
  const activeParticles = [];

  // Helper random functions
  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ── Canvas Setup ──────────────────────────────────────────────────────────
  function setupCanvas() {
    canvas = document.getElementById('shootingStarCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'shootingStarCanvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100vw',
        'height: 100vh',
        'pointer-events: none',
        'z-index: 999999',
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

  // ── Streak Spawner (Phase 1) ──────────────────────────────────────────────
  function createStreak(targetX, targetY) {
    const travelDistance = randomRange(50, 70);
    const startY = targetY - travelDistance;
    const length = randomRange(32, 48); // Balanced length: visible and clean
    const width = randomRange(1.8, 2.4); // Balanced width: sleek and crisp
    const duration = randomRange(160, 195); // ms

    return {
      targetX,
      targetY,
      startY,
      travelDistance,
      length,
      width,
      duration,
      startTime: performance.now(),
      completed: false
    };
  }

  // ── Burst Spawner (Phase 2) ───────────────────────────────────────────────
  function triggerBurst(x, y) {
    const count = Math.floor(randomRange(14, 22));

    for (let i = 0; i < count; i++) {
      // 360° random distribution with subtle upward bias for ember feel
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(1.4, 3.8);
      const size = randomRange(1.8, 4.2); // Delicate micro-particle diameter 1.8-4.2px
      const lifespan = randomRange(800, 1300); // 0.8 - 1.3s
      const color = randomChoice(COLOR_PALETTE);
      const gravity = randomRange(0.03, 0.07); // Slight downward gravity drift
      const friction = randomRange(0.960, 0.975); // Ease-out deceleration

      activeParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: size / 2,
        initialRadius: size / 2,
        color,
        gravity,
        friction,
        lifespan,
        remainingLife: lifespan,
        startTime: performance.now()
      });
    }

    // Cap maximum concurrent particles to prevent any jank
    if (activeParticles.length > MAX_CONCURRENT_PARTICLES) {
      const overflow = activeParticles.length - MAX_CONCURRENT_PARTICLES;
      activeParticles.splice(0, overflow);
    }
  }

  // ── Animation Loop ────────────────────────────────────────────────────────
  function updateAndRender(now) {
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // 1. Render & Update Streaks
    for (let i = activeStreaks.length - 1; i >= 0; i--) {
      const streak = activeStreaks[i];
      const elapsed = now - streak.startTime;
      const progress = Math.min(elapsed / streak.duration, 1.0);

      // Ease-in quadratic acceleration: starts slightly slower, accelerates into impact
      const easeProgress = progress * progress;

      // Current head (leading tip)
      const currentHeadY = streak.startY + streak.travelDistance * easeProgress;
      // Tail follows behind, stretching during flight
      const currentTailY = currentHeadY - streak.length * Math.min(1.0, progress * 1.5);

      if (progress >= 1.0) {
        // Streak reaches impact point
        triggerBurst(streak.targetX, streak.targetY);
        activeStreaks.splice(i, 1);
        continue;
      }

      // Draw Streak with Gradient (subdued, silky warm gold -> gentle tip)
      const grad = ctx.createLinearGradient(
        streak.targetX,
        currentTailY,
        streak.targetX,
        currentHeadY
      );
      grad.addColorStop(0, 'rgba(240, 179, 126, 0)');
      grad.addColorStop(0.35, 'rgba(240, 179, 126, 0.22)');
      grad.addColorStop(0.75, 'rgba(240, 179, 126, 0.55)');
      grad.addColorStop(1, 'rgba(250, 238, 225, 0.78)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(streak.targetX, currentTailY);
      ctx.lineTo(streak.targetX, currentHeadY);
      ctx.strokeStyle = grad;
      ctx.lineWidth = streak.width;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(240, 179, 126, 0.42)';
      ctx.shadowBlur = 2.8;
      ctx.stroke();

      // Gentle glowing tip
      ctx.beginPath();
      ctx.arc(streak.targetX, currentHeadY, streak.width * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 248, 240, 0.80)';
      ctx.shadowColor = 'rgba(255, 232, 209, 0.55)';
      ctx.shadowBlur = 3.5;
      ctx.fill();
      ctx.restore();
    }

    // 2. Render & Update Burst Particles
    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      const elapsed = now - p.startTime;

      if (elapsed >= p.lifespan) {
        // Particle completed lifespan -> Cleanup
        activeParticles.splice(i, 1);
        continue;
      }

      const lifeRatio = 1.0 - elapsed / p.lifespan; // 1.0 -> 0.0
      // Smooth fade out
      const opacity = Math.max(0, lifeRatio);
      // Particle shrinks slightly as it fades (down to ~35% of initial size)
      const currentRadius = Math.max(0.5, p.initialRadius * (0.35 + 0.65 * lifeRatio));

      // Physics: Apply deceleration & downward gravity drift
      p.vx *= p.friction;
      p.vy = p.vy * p.friction + p.gravity;
      p.x += p.vx;
      p.y += p.vy;

      // Draw particle circle with warm glowing ember style
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${opacity.toFixed(3)})`;
      ctx.shadowColor = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${(opacity * 0.9).toFixed(3)})`;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // Continue loop if any streaks or particles remain active
    if (activeStreaks.length > 0 || activeParticles.length > 0) {
      animFrameId = requestAnimationFrame(updateAndRender);
    } else {
      animFrameId = null;
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  function ensureLoopRunning() {
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(updateAndRender);
    }
  }

  function isDarkTheme() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    return theme !== 'light';
  }

  // ── Global Pointer / Click Trigger Listener ──────────────────────────────
  function handlePointerDown(e) {
    if (prefersReducedMotion) return;
    if (!isDarkTheme()) return; // Only active in black theme

    // Read exact client coordinates
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (clientX == null || clientY == null) return;

    // Spawn shooting star streak targeting (clientX, clientY)
    activeStreaks.push(createStreak(clientX, clientY));
    ensureLoopRunning();
  }

  // ── Initialization ────────────────────────────────────────────────────────
  function init() {
    setupCanvas();

    // Attach additive, non-blocking listener at the document level
    // pointerdown provides immediate tactile responsiveness on both mouse click and mobile touch/tap
    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

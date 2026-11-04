/**
 * space.js — 3D Starfield Warp Effect
 *
 * Algorithm:
 *   Each star has (x, y, z) coordinates in a virtual 3D space.
 *   Every frame each star is projected to 2D as (cx + x/z, cy + y/z)
 *   and drawn as a circle whose radius is proportional to (1/z).
 *   z is decremented each frame (star moves toward viewer).
 *   When z falls below 1 the star wraps back to a large z (far away).
 *
 * Uses window.LabUtils (getCSSVar, getThemeColors, createCanvas,
 *   initFullscreen, initPointer, initVisibilityPause, exportPNG,
 *   createDeltaTimer, createPanel, createHelp, createFullscreenBtn,
 *   bindKeys, syncTheme).
 */
(function () {
  'use strict';

  /* ─── Constants ─────────────────────────────────────────────────── */
  const CONTAINER_ID  = 'sketch-container';
  const MAX_Z         = 1000;   // depth range
  const SPREAD        = 1;      // half-width of initial x/y distribution (normalised)

  /* ─── State ──────────────────────────────────────────────────────── */
  let canvas, ctx, W, H;
  let stars     = [];
  let hue       = 0;            // global hue counter for spectrum mode
  let paused    = false;
  let rafId     = null;

  // Pointer tracking – the warp-centre drifts toward the pointer smoothly
  let pointerX  = 0.5;          // normalised [0,1]
  let pointerY  = 0.5;
  let centreX   = 0;            // actual pixel centre (updated each frame)
  let centreY   = 0;

  /* ─── Settings (driven by panel controls) ────────────────────────── */
  const cfg = {
    starCount : 800,
    speed     : 2,
    trail     : false,
    colorMode : 'spectrum',    // 'spectrum' | 'accent' | 'white'
  };

  /* ─── Accent colours (read from CSS vars once at init) ───────────── */
  let accentColors = [];

  /* ─── Star factory ───────────────────────────────────────────────── */
  function makeStar(randomZ) {
    return {
      x : (Math.random() - 0.5) * 2 * MAX_Z,  // wide spread in world space
      y : (Math.random() - 0.5) * 2 * MAX_Z,
      z : randomZ ? Math.random() * MAX_Z + 1 : MAX_Z,
      hue: Math.random() * 360,  // per-star hue offset for spectrum mode
    };
  }

  function buildStars() {
    stars = [];
    for (let i = 0; i < cfg.starCount; i++) {
      stars.push(makeStar(true));  // spread z randomly on first build
    }
  }

  function resetStars() {
    buildStars();
    hue = 0;
  }

  /* ─── Canvas setup ───────────────────────────────────────────────── */
  function setupCanvas() {
    const container = document.getElementById(CONTAINER_ID);
    ({ canvas, ctx } = LabUtils.createCanvas(container));
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    W = canvas.width  = canvas.offsetWidth  || window.innerWidth;
    H = canvas.height = canvas.offsetHeight || (window.innerHeight - 48);
  }

  /* ─── Colour helpers ─────────────────────────────────────────────── */
  function starColor(star, alpha) {
    if (cfg.colorMode === 'white') {
      return alpha < 1 ? `rgba(255,255,255,${alpha.toFixed(2)})` : '#fff';
    }
    if (cfg.colorMode === 'accent') {
      // Pick from accent palette by per-star hue bucket
      const idx = Math.floor(star.hue / 120) % accentColors.length;
      const col = accentColors[idx];
      if (alpha >= 1) return col;
      // Crude alpha: re-parse hex to rgba
      const r = parseInt(col.slice(1,3),16);
      const g = parseInt(col.slice(3,5),16);
      const b = parseInt(col.slice(5,7),16);
      return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
    }
    // spectrum: global hue + per-star offset
    const h = (hue + star.hue) % 360;
    return `hsla(${h},100%,80%,${alpha.toFixed(2)})`;
  }

  /* ─── Draw ───────────────────────────────────────────────────────── */
  function draw() {
    const bgColor = LabUtils.getThemeColors().bg;

    if (cfg.trail) {
      // Semi-transparent overlay creates motion-blur trails
      ctx.fillStyle = bgColor.startsWith('#')
        ? hexToRgba(bgColor, 0.18)
        : bgColor;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    // Smoothly drift the warp centre toward the pointer
    centreX += (pointerX * W - centreX) * 0.05;
    centreY += (pointerY * H - centreY) * 0.05;

    // Advance global hue
    hue = (hue + 0.4) % 360;

    // Update & draw each star
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];

      // Move toward viewer
      s.z -= cfg.speed;

      // Wrap: star passed the camera → recycle far away
      if (s.z < 1) {
        stars[i] = makeStar(false);
        continue;
      }

      // Project to screen
      const sx = centreX + s.x / s.z;
      const sy = centreY + s.y / s.z;

      // Skip stars that projected off-canvas
      if (sx < 0 || sx > W || sy < 0 || sy > H) {
        // Don't recycle — just skip; they may drift back into view
        continue;
      }

      // Radius grows as star approaches (smaller z → bigger radius)
      const radius = Math.max(0.3, (1 - s.z / MAX_Z) * 4);
      // Brightness fades with distance
      const alpha  = Math.min(1, (1 - s.z / MAX_Z) * 1.6 + 0.1);

      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = starColor(s, alpha);
      ctx.fill();
    }
  }

  /* ─── Loop ───────────────────────────────────────────────────────── */
  function loop() {
    if (!paused) draw();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId) return;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ─── Play / Pause ───────────────────────────────────────────────── */
  function setPaused(val) {
    paused = val;
  }

  function togglePause() {
    setPaused(!paused);
  }

  /* ─── Utility: hex → rgba string ────────────────────────────────── */
  function hexToRgba(hex, alpha) {
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ─── Panel / Controls ───────────────────────────────────────────── */
  function buildPanel() {
    const panel = LabUtils.createPanel('Controls');

    panel.addSlider('Stars', 100, 3000, cfg.starCount, 50, v => {
      cfg.starCount = v;
      // Adjust array size without full reset if shrinking
      if (v < stars.length) {
        stars.length = v;
      } else {
        while (stars.length < v) stars.push(makeStar(true));
      }
    });

    panel.addSlider('Speed', 0.5, 8, cfg.speed, 0.5, v => {
      cfg.speed = v;
    });

    panel.addToggle('Trails', cfg.trail, v => {
      cfg.trail = v;
    });

    panel.addSelect('Color', ['spectrum','accent','white'], cfg.colorMode, v => {
      cfg.colorMode = v;
    });

    panel.addSeparator();

    panel.addButtons([
      {
        label: paused ? '▶ Play' : '⏸ Pause',
        id: 'btn-playpause',
        onClick: (btn) => {
          togglePause();
          btn.textContent = paused ? '▶ Play' : '⏸ Pause';
        }
      },
      {
        label: '↺ Reset',
        onClick: () => resetStars()
      },
    ]);

    // Fullscreen & export buttons
    LabUtils.createFullscreenBtn(document.getElementById(CONTAINER_ID));

    panel.addButtons([
      {
        label: 'Save PNG',
        onClick: () => LabUtils.exportPNG(canvas, 'space-travel')
      }
    ]);

    panel.addSeparator();
    panel.addHint('Drag mouse to shift warp centre.');
  }

  /* ─── Help overlay ───────────────────────────────────────────────── */
  function buildHelp() {
    LabUtils.createHelp([
      ['Space', 'Play / Pause'],
      ['R',     'Reset stars'],
      ['F',     'Fullscreen'],
      ['S',     'Save PNG'],
    ]);
  }

  /* ─── Key bindings ───────────────────────────────────────────────── */
  function buildKeys() {
    LabUtils.bindKeys({
      ' '       : () => {
        togglePause();
        const btn = document.getElementById('btn-playpause');
        if (btn) btn.textContent = paused ? '▶ Play' : '⏸ Pause';
      },
      'r'       : () => resetStars(),
      'R'       : () => resetStars(),
      'f'       : () => LabUtils.initFullscreen(document.getElementById(CONTAINER_ID)),
      'F'       : () => LabUtils.initFullscreen(document.getElementById(CONTAINER_ID)),
      's'       : () => LabUtils.exportPNG(canvas, 'space-travel'),
      'S'       : () => LabUtils.exportPNG(canvas, 'space-travel'),
    });
  }

  /* ─── Pointer tracking ───────────────────────────────────────────── */
  function buildPointer() {
    // LabUtils.initPointer returns normalized pointer position if available,
    // but we also listen directly for precise control.
    const container = document.getElementById(CONTAINER_ID);
    container.addEventListener('pointermove', e => {
      const rect = container.getBoundingClientRect();
      pointerX = (e.clientX - rect.left) / rect.width;
      pointerY = (e.clientY - rect.top)  / rect.height;
    });
    // Also initialise centreX/Y to canvas centre
    centreX = W / 2;
    centreY = H / 2;
  }

  /* ─── Reduced-motion check ───────────────────────────────────────── */
  function checkReducedMotion() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPaused(true);
      // Update play button if it already exists
      const btn = document.getElementById('btn-playpause');
      if (btn) btn.textContent = '▶ Play';
    }
  }

  /* ─── Init ───────────────────────────────────────────────────────── */
  function init() {
    // Read accent colours from CSS vars
    accentColors = [
      LabUtils.getCSSVar('--clr-accent-1') || '#c4b0f5',
      LabUtils.getCSSVar('--clr-accent-2') || '#f47aaa',
      LabUtils.getCSSVar('--clr-accent-3') || '#6eb8f5',
    ];

    setupCanvas();
    buildStars();

    // Set initial centre to canvas centre
    centreX = W / 2;
    centreY = H / 2;
    pointerX = 0.5;
    pointerY = 0.5;

    buildPanel();
    buildHelp();
    buildKeys();
    buildPointer();

    // Sync accent colours when theme changes
    LabUtils.syncTheme(() => {
      accentColors = [
        LabUtils.getCSSVar('--clr-accent-1') || '#c4b0f5',
        LabUtils.getCSSVar('--clr-accent-2') || '#f47aaa',
        LabUtils.getCSSVar('--clr-accent-3') || '#6eb8f5',
      ];
    });

    // Pause when tab is hidden
    LabUtils.initVisibilityPause(() => setPaused(true), () => setPaused(false));

    checkReducedMotion();
    startLoop();
  }

  // Boot once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

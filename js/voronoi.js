/**
 * voronoi.js — Weighted Voronoi Stippling
 *
 * Algorithm:
 *  1. Load images/eye.jpg and sample it at canvas dimensions.
 *  2. Place N points via rejection-sampling biased toward dark pixels.
 *  3. Each Lloyd relaxation step computes weighted centroids from pixel
 *   brightness for each Voronoi cell, then lerps each point toward
 *   its centroid. This pulls points into the image's dark regions.
 *
 * Controls (LabUtils panel):
 *  - Point count (500–5000, default 2000)  → regenerate on change
 *  - Steps per frame (1–10, default 1)    → Lloyd iterations per frame
 *  - Display mode: points | cells | filled
 *  - Show edges toggle
 *  - Lerp amount (0.1–1.0, default 0.5)
 *  - Play/Pause (Space), Reset (R), Fullscreen (F), Save PNG (S)
 *
 * Performance notes:
 *  - Pixel sampling skips every other pixel (stride 2) during Lloyd.
 *  - Relaxation only runs when isRelaxing === true.
 *  - Image is scaled into an offscreen p5.Graphics at canvas resolution.
 */

(function () {
 'use strict';

 /* ─── d3-delaunay UMD is loaded before this script.
     It exposes `d3` or `Delaunay` on window depending on build.
     The CDN UMD build exposes window.d3 with { Delaunay }.      ─── */
 const getDelaunay = () => {
  if (window.d3 && window.d3.Delaunay) return window.d3.Delaunay;
  if (window.Delaunay) return window.Delaunay;
  throw new Error('d3-delaunay not found on window');
 };

 new p5(function (p) {

  /* ── State ─────────────────────────────────────────────────── */
  let img;          // source image
  let offscreen;       // p5.Graphics holding the rescaled image
  let pixelData = null;   // Uint8ClampedArray of offscreen pixels (RGBA)
  let offW, offH;      // offscreen dimensions (matches canvas)

  let pts = [];       // Float32Array pairs [x0,y0, x1,y1, …]
  let numPoints  = 2000;
  let stepsPerFrame = 1;
  let displayMode = 'points';
  let showEdges  = false;
  let lerpAmt   = 0.5;
  let isRelaxing = false;  // only relax when true
  let reducedMotion = false;

  // Theme colours (refreshed on syncTheme)
  let clrBg, clrFg, clrBorder, clrAccent1, clrFgMuted;

  /* ── p5 Lifecycle ──────────────────────────────────────────── */
  p.preload = function () {
   img = p.loadImage('images/eye.jpg');
  };

  p.setup = function () {
   reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

   const container = document.getElementById('sketch-container');
   const cnv = LabUtils.createCanvas(p, container);
   cnv.elt.setAttribute('aria-label', 'Voronoi stippling canvas');

   refreshTheme();
   buildOffscreen();
   scatterPoints();

   // Start relaxing unless reduced-motion preference
   isRelaxing = !reducedMotion;

   buildPanel();
   buildHelp();
   LabUtils.createFullscreenBtn(container);
   LabUtils.bindKeys(p, {
    ' ': toggleRelax,
    'r': resetPoints,
    'R': resetPoints,
    'f': () => LabUtils.initFullscreen(container),
    'F': () => LabUtils.initFullscreen(container),
    's': () => LabUtils.exportPNG(cnv, 'voronoi'),
    'S': () => LabUtils.exportPNG(cnv, 'voronoi'),
   });

   LabUtils.syncTheme(refreshTheme);
   LabUtils.initVisibilityPause(p);
   p.frameRate(60);
  };

  p.draw = function () {
   p.background(clrBg);

   if (isRelaxing) {
    for (let s = 0; s < stepsPerFrame; s++) lloydStep();
   }

   drawVoronoi();
  };

  p.windowResized = function () {
   const container = document.getElementById('sketch-container');
   LabUtils.createCanvas(p, container);
   buildOffscreen();
   // Re-normalise existing points to new canvas size
   scatterPoints();
  };

  /* ── Offscreen pixel buffer ────────────────────────────────── */
  function buildOffscreen() {
   offW = p.width;
   offH = p.height;
   if (offscreen) offscreen.remove();
   offscreen = p.createGraphics(offW, offH);
   offscreen.image(img, 0, 0, offW, offH);
   offscreen.loadPixels();
   pixelData = offscreen.pixels.slice(); // copy Uint8ClampedArray
  }

  /** Brightness (0=black, 255=white) for canvas pixel at (x,y). */
  function brightness(x, y) {
   const xi = Math.floor(x);
   const yi = Math.floor(y);
   if (xi < 0 || xi >= offW || yi < 0 || yi >= offH) return 255;
   const idx = (yi * offW + xi) * 4;
   // luminance approximation
   return 0.299 * pixelData[idx] + 0.587 * pixelData[idx + 1] + 0.114 * pixelData[idx + 2];
  }

  /* ── Point scattering ─────────────────────────────────────── */
  function scatterPoints() {
   pts = new Float32Array(numPoints * 2);
   let placed = 0;
   const maxTries = numPoints * 50;
   let tries = 0;
   while (placed < numPoints && tries < maxTries) {
    tries++;
    const x = p.random(offW);
    const y = p.random(offH);
    const b = brightness(x, y);
    // Rejection sampling: dark pixels more likely accepted
    // P(accept) = 1 - b/255
    if (p.random() < 1.0 - b / 255.0) {
     pts[placed * 2]   = x;
     pts[placed * 2 + 1] = y;
     placed++;
    }
   }
   // Fill remaining if rejection sampling ran out
   while (placed < numPoints) {
    pts[placed * 2]   = p.random(offW);
    pts[placed * 2 + 1] = p.random(offH);
    placed++;
   }
  }

  function resetPoints() {
   scatterPoints();
  }

  /* ── Lloyd Relaxation ─────────────────────────────────────── */
  function lloydStep() {
   if (!pixelData || numPoints < 3) return;

   const Delaunay = getDelaunay();
   const coords = pts; // already flat [x0,y0,…]
   let delaunay;
   try {
    delaunay = Delaunay.from(Array.from({ length: numPoints }, (_, i) => [pts[i*2], pts[i*2+1]]));
   } catch (e) { return; }

   const voronoi = delaunay.voronoi([0, 0, offW, offH]);

   // Accumulators for weighted centroid per cell
   const wx = new Float64Array(numPoints);
   const wy = new Float64Array(numPoints);
   const wt = new Float64Array(numPoints);

   // Iterate over pixels (stride 2 for speed)
   const stride = 2;
   for (let py = 0; py < offH; py += stride) {
    for (let px = 0; px < offW; px += stride) {
     const b  = brightness(px, py);
     const w  = 1.0 - b / 255.0; // dark = high weight
     if (w < 0.01) continue;   // skip near-white pixels
     const idx = delaunay.find(px, py);
     wx[idx] += px * w;
     wy[idx] += py * w;
     wt[idx] += w;
    }
   }

   // Move each point toward its weighted centroid
   for (let i = 0; i < numPoints; i++) {
    if (wt[i] > 0) {
     const cx = wx[i] / wt[i];
     const cy = wy[i] / wt[i];
     pts[i * 2]   += (cx - pts[i * 2])   * lerpAmt;
     pts[i * 2 + 1] += (cy - pts[i * 2 + 1]) * lerpAmt;
    }
   }
  }

  /* ── Drawing ──────────────────────────────────────────────── */
  function drawVoronoi() {
   if (numPoints < 3) {
    // Fallback: just dots
    p.fill(clrFg);
    p.noStroke();
    for (let i = 0; i < numPoints; i++) {
     p.circle(pts[i*2], pts[i*2+1], 3);
    }
    return;
   }

   const Delaunay = getDelaunay();
   let delaunay, voronoi;
   try {
    delaunay = Delaunay.from(Array.from({ length: numPoints }, (_, i) => [pts[i*2], pts[i*2+1]]));
    voronoi = delaunay.voronoi([0, 0, p.width, p.height]);
   } catch (e) { return; }

   /* — Filled mode: fill each cell by its point's image brightness — */
   if (displayMode === 'filled') {
    p.noStroke();
    for (let i = 0; i < numPoints; i++) {
     const b = brightness(pts[i*2], pts[i*2+1]);
     p.fill(b);
     const cell = voronoi.cellPolygon(i);
     if (!cell) continue;
     p.beginShape();
     for (const [cx, cy] of cell) p.vertex(cx, cy);
     p.endShape(p.CLOSE);
    }
   }

   /* — Cell edges — */
   if (displayMode === 'cells' || (displayMode === 'filled' && showEdges) || (displayMode === 'points' && showEdges)) {
    p.stroke(clrBorder);
    p.strokeWeight(0.5);
    p.noFill();
    for (let i = 0; i < numPoints; i++) {
     const cell = voronoi.cellPolygon(i);
     if (!cell) continue;
     p.beginShape();
     for (const [cx, cy] of cell) p.vertex(cx, cy);
     p.endShape(p.CLOSE);
    }
   }

   /* — Cell mode without fill but with edges — */
   if (displayMode === 'cells' && !showEdges) {
    // already drawn above with the showEdges condition when mode=cells
    // (we always draw edges in cells mode)
   }

   /* — Points (dots) — */
   if (displayMode === 'points' || displayMode === 'cells') {
    p.noStroke();
    p.fill(clrFg);
    for (let i = 0; i < numPoints; i++) {
     const b = brightness(pts[i*2], pts[i*2+1]);
     // Dot radius inversely proportional to brightness (darker = bigger dot)
     const r = p.map(b, 0, 255, 3.5, 0.5);
     p.circle(pts[i*2], pts[i*2+1], r);
    }
   }

   /* — Extra edges toggle (when not already drawn in cells mode) — */
   if (showEdges && displayMode === 'points') {
    // already handled above
   }
  }

  /* ── Helpers ──────────────────────────────────────────────── */
  function toggleRelax() {
   isRelaxing = !isRelaxing;
  }

  function refreshTheme() {
   const cv = LabUtils.getCSSVar;
   clrBg   = cv('--clr-bg')    || '#0d0d0d';
   clrFg   = cv('--clr-fg')    || '#f0f0f0';
   clrBorder = cv('--clr-border')  || '#333333';
   clrAccent1 = cv('--clr-accent-1') || '#c4b0f5';
   clrFgMuted = cv('--clr-fg-muted') || '#888888';
  }

  /* ── Panel ────────────────────────────────────────────────── */
  function buildPanel() {
   const container = document.getElementById('sketch-container');
   const panel = LabUtils.createPanel(container, 'Controls');

   panel.addSlider('Points', 500, 5000, numPoints, 100, (v) => {
    numPoints = v;
    scatterPoints();
   });

   panel.addSlider('Steps / frame', 1, 10, stepsPerFrame, 1, (v) => {
    stepsPerFrame = v;
   });

   panel.addSelect('Display', ['points', 'cells', 'filled'], displayMode, (v) => {
    displayMode = v;
   });

   panel.addToggle('Show edges', showEdges, (v) => {
    showEdges = v;
   });

   panel.addSlider('Lerp', 0.1, 1.0, lerpAmt, 0.1, (v) => {
    lerpAmt = v;
   });

   panel.addSeparator();

   panel.addButtons([
    {
     label: isRelaxing ? 'Pause ⏸' : 'Play ',
     id: 'btn-playpause',
     onClick: function (btn) {
      toggleRelax();
      btn.textContent = isRelaxing ? 'Pause ⏸' : 'Play ';
     }
    },
    {
     label: 'Reset ↺',
     onClick: () => resetPoints()
    }
   ]);

   panel.addSeparator();

   panel.addButtons([
    {
     label: 'Save PNG',
     onClick: () => LabUtils.exportPNG(p.elt || document.querySelector('#sketch-container canvas'), 'voronoi')
    },
    {
     label: 'Fullscreen',
     onClick: () => LabUtils.initFullscreen(container)
    }
   ]);

   panel.addHint('Space: play/pause · R: reset · F: fullscreen · S: save');
  }

  /* ── Help overlay ─────────────────────────────────────────── */
  function buildHelp() {
   const container = document.getElementById('sketch-container');
   LabUtils.createHelp(container, [
    '**Voronoi Stippling**',
    'Points are biased toward dark pixels in the image.',
    'Lloyd relaxation moves each point toward the weighted centroid of its Voronoi cell.',
    '',
    '**Keys:** Space – play/pause · R – reset · F – fullscreen · S – save PNG',
   ].join('\n'));
  }

 }, document.getElementById('sketch-container'));

}());

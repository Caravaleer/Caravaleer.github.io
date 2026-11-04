/**
 * sand.js — Falling-Sand Cellular Automaton
 *
 * Algorithm:
 *  The canvas is divided into a grid of W×H cells (cell size = CELL_SIZE px).
 *  Each cell stores a hue value in a Uint16Array:
 *   0    → empty
 *   1–359  → sand (warm hues 20–60)
 *   400–580 → water (blue hues 180–220, stored as hue+400 to avoid 0)
 *   1000  → stone (static, never moves)
 *
 *  Two pre-allocated Uint16Array buffers are swapped each step (no GC pressure).
 *
 *  Physics step (bottom-up scan):
 *   For each non-empty, non-stone cell:
 *    Sand → try fall down, then fall diag-left/right
 *    Water → try fall down, then fall diag-left/right, then slide left/right
 *
 * Uses window.LabUtils.
 */
(function () {
 'use strict';

 /* ─── Constants ─────────────────────────────────────────────────── */
 const CONTAINER_ID = 'sketch-container';
 const CELL_SIZE  = 4;    // pixels per grid cell

 // Cell-value sentinels
 const EMPTY = 0;
 const STONE = 1000;

 // Hue ranges stored directly (1–359 for sand/water)
 // Sand: hue in [20, 60]
 // Water: hue in [180, 220] — stored as hue + 400 (so 580–620) to keep 1–359 free
 //  → decode: if val >= 500 && val < 1000 → water, hue = val - 400
 //       if val >= 1  && val < 500  → sand, hue = val
 const SAND_HUE_MIN = 20;
 const SAND_HUE_MAX = 60;
 const WATER_OFFSET = 400;
 const WATER_HUE_MIN = 180;
 const WATER_HUE_MAX = 220;

 /* ─── Grid state ─────────────────────────────────────────────────── */
 let cols = 0, rows = 0, cellCount = 0;
 let bufA, bufB;     // Uint16Array[cellCount] — double-buffered
 let stoneGrid;      // Uint8Array[cellCount] — boolean stone layer
 let cur, nxt;      // aliases to bufA / bufB that swap each step

 /* ─── Canvas ─────────────────────────────────────────────────────── */
 let canvas, ctx, W, H;

 /* ─── Interaction ────────────────────────────────────────────────── */
 let isPainting = false; // left button / touch
 let isErasing = false; // right button / two-touch
 let lastPx = -1, lastPy = -1; // last painted grid cell

 /* ─── Settings ───────────────────────────────────────────────────── */
 const cfg = {
  brushSize : 3,     // radius in grid cells
  material : 'sand',  // 'sand' | 'water' | 'stone'
  gravity  : true,
 };

 /* ─── Timing ─────────────────────────────────────────────────────── */
 let paused = false;
 let rafId = null;

 /* ─── Hue cycling ────────────────────────────────────────────────── */
 let sandHueCursor = SAND_HUE_MIN;
 let waterHueCursor = WATER_HUE_MIN;

 /* ─── Grid helpers ───────────────────────────────────────────────── */
 function idx(c, r)  { return r * cols + c; }
 function valid(c, r) { return c >= 0 && c < cols && r >= 0 && r < rows; }

 function isEmpty(c, r) {
  if (!valid(c, r)) return false;
  return cur[idx(c, r)] === EMPTY && !stoneGrid[idx(c, r)];
 }

 function isSolid(c, r) {
  // Stone or out-of-bounds counts as solid for water spreading
  if (!valid(c, r)) return true;
  return stoneGrid[idx(c, r)] > 0;
 }

 /* ─── Grid allocation ────────────────────────────────────────────── */
 function allocGrid(c, r) {
  cols = c;
  rows = r;
  cellCount = c * r;
  bufA   = new Uint16Array(cellCount);
  bufB   = new Uint16Array(cellCount);
  stoneGrid = new Uint8Array(cellCount);
  cur = bufA;
  nxt = bufB;
 }

 function clearGrid() {
  if (bufA) bufA.fill(0);
  if (bufB) bufB.fill(0);
  if (stoneGrid) stoneGrid.fill(0);
 }

 /* ─── Paint brush ────────────────────────────────────────────────── */
 function paintAt(px, py, erase) {
  // px, py are canvas pixels
  const gc = Math.floor(px / CELL_SIZE);
  const gr = Math.floor(py / CELL_SIZE);
  const r = cfg.brushSize;

  for (let dr = -r; dr <= r; dr++) {
   for (let dc = -r; dc <= r; dc++) {
    if (dc*dc + dr*dr > r*r + r) continue; // rough circle
    const cc = gc + dc;
    const cr = gr + dr;
    if (!valid(cc, cr)) continue;
    const i = idx(cc, cr);

    if (erase) {
     cur[i]    = EMPTY;
     stoneGrid[i] = 0;
     continue;
    }

    if (cfg.material === 'stone') {
     cur[i]    = EMPTY;
     stoneGrid[i] = 1;
    } else if (cfg.material === 'sand') {
     if (stoneGrid[i]) continue;
     // Vary hue slightly per cell for a natural look
     const h = SAND_HUE_MIN + Math.floor(Math.random() * (SAND_HUE_MAX - SAND_HUE_MIN + 1));
     cur[i] = h || 1; // ensure non-zero
    } else if (cfg.material === 'water') {
     if (stoneGrid[i]) continue;
     const h = WATER_HUE_MIN + Math.floor(Math.random() * (WATER_HUE_MAX - WATER_HUE_MIN + 1));
     cur[i] = h + WATER_OFFSET;
    }
   }
  }
 }

 /* ─── Physics step ───────────────────────────────────────────────── */
 function step() {
  // Copy stone layer into nxt as zeroes (nxt will hold moved particles)
  nxt.fill(0);

  if (!cfg.gravity) {
   // No gravity: just copy state as-is (particles freeze)
   cur.set(nxt);
   return;
  }

  // Scan bottom-up so falling is processed in natural order
  for (let r = rows - 1; r >= 0; r--) {
   // Alternate scan direction each row to avoid directional bias
   const leftToRight = (r % 2 === 0);
   const cStart = leftToRight ? 0 : cols - 1;
   const cEnd  = leftToRight ? cols : -1;
   const cStep = leftToRight ? 1 : -1;

   for (let c = cStart; c !== cEnd; c += cStep) {
    const i = idx(c, r);
    const v = cur[i];

    // Skip empty cells and stones (stone layer is separate)
    if (v === EMPTY || stoneGrid[i]) continue;
    // Skip cells already moved this frame
    if (nxt[i] !== EMPTY) continue;

    const isWater = (v >= WATER_OFFSET && v < STONE);

    // Helper to try placing particle at (tc, tr)
    const tryMove = (tc, tr) => {
     if (!valid(tc, tr)) return false;
     const ti = idx(tc, tr);
     if (stoneGrid[ti]) return false;   // blocked by stone
     if (nxt[ti] !== EMPTY) return false; // already occupied in nxt
     if (cur[ti] !== EMPTY && nxt[ti] === EMPTY) {
      // Might displace — only if that cell hasn't moved yet
      // Simple rule: only move into truly empty cur cells or cells that have already moved
     }
     return cur[ti] === EMPTY;
    };

    let moved = false;

    // 1. Try straight down
    if (tryMove(c, r + 1)) {
     nxt[idx(c, r + 1)] = v;
     moved = true;
    }

    // 2. Try diagonal (randomly pick left/right first to avoid bias)
    if (!moved) {
     const goLeft = Math.random() < 0.5;
     const d1 = goLeft ? -1 : 1;
     const d2 = -d1;
     if (tryMove(c + d1, r + 1)) {
      nxt[idx(c + d1, r + 1)] = v;
      moved = true;
     } else if (tryMove(c + d2, r + 1)) {
      nxt[idx(c + d2, r + 1)] = v;
      moved = true;
     }
    }

    // 3. Water-only: slide horizontally
    if (!moved && isWater) {
     const goLeft = Math.random() < 0.5;
     const d1 = goLeft ? -1 : 1;
     const d2 = -d1;
     if (tryMove(c + d1, r)) {
      nxt[idx(c + d1, r)] = v;
      moved = true;
     } else if (tryMove(c + d2, r)) {
      nxt[idx(c + d2, r)] = v;
      moved = true;
     }
    }

    // Stay put
    if (!moved) {
     nxt[i] = v;
    }
   }
  }

  // Swap buffers
  const tmp = cur;
  cur = nxt;
  nxt = tmp;
 }

 /* ─── Render ─────────────────────────────────────────────────────── */
 function render() {
  const bgColor = LabUtils.getThemeColors().bg;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  for (let r = 0; r < rows; r++) {
   for (let c = 0; c < cols; c++) {
    const i = idx(c, r);
    const v = cur[i];
    const isStone = stoneGrid[i] > 0;

    if (!isStone && v === EMPTY) continue;

    let color;
    if (isStone) {
     color = '#888888';
    } else if (v >= WATER_OFFSET && v < STONE) {
     // Water — blue hues with slight saturation/lightness variance
     const h = v - WATER_OFFSET;
     const l = 50 + Math.sin(c * 0.3 + r * 0.2) * 8; // subtle shimmer
     color = `hsl(${h},70%,${l.toFixed(0)}%)`;
    } else if (v >= 1 && v < WATER_OFFSET) {
     // Sand — warm hues
     const h = v;
     const s = 65 + Math.sin(r * 0.5) * 10;
     const l = 55 + Math.sin(c * 0.4) * 8;
     color = `hsl(${h},${s.toFixed(0)}%,${l.toFixed(0)}%)`;
    } else {
     continue;
    }

    ctx.fillStyle = color;
    ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
   }
  }
 }

 /* ─── Main loop ──────────────────────────────────────────────────── */
 function loop() {
  if (!paused) {
   step();
   render();
  }
  rafId = requestAnimationFrame(loop);
 }

 /* ─── Canvas & resize ────────────────────────────────────────────── */
 function setupCanvas() {
  const container = document.getElementById(CONTAINER_ID);
  ({ canvas, ctx } = LabUtils.createCanvas(container));
  onResize();
  window.addEventListener('resize', onResize);
 }

 function onResize() {
  W = canvas.width = canvas.offsetWidth || window.innerWidth;
  H = canvas.height = canvas.offsetHeight || (window.innerHeight - 48);
  const newCols = Math.floor(W / CELL_SIZE);
  const newRows = Math.floor(H / CELL_SIZE);
  allocGrid(newCols, newRows);
 }

 /* ─── Pointer events ─────────────────────────────────────────────── */
 function setupPointer() {
  const container = document.getElementById(CONTAINER_ID);

  function getCanvasPos(e) {
   const rect = canvas.getBoundingClientRect();
   return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePaint(e, force) {
   if (!isPainting && !isErasing && !force) return;
   const { x, y } = getCanvasPos(e);
   paintAt(x, y, isErasing);
  }

  container.addEventListener('pointerdown', e => {
   e.preventDefault();
   if (e.button === 2 || (e.pointerType === 'touch' && e.isPrimary === false)) {
    isErasing = true;
   } else {
    isPainting = true;
   }
   const { x, y } = getCanvasPos(e);
   paintAt(x, y, isErasing);
   container.setPointerCapture(e.pointerId);
  });

  container.addEventListener('pointermove', e => {
   e.preventDefault();
   if (!isPainting && !isErasing) return;
   const { x, y } = getCanvasPos(e);
   paintAt(x, y, isErasing);
  });

  container.addEventListener('pointerup', e => {
   e.preventDefault();
   isPainting = false;
   isErasing = false;
  });

  container.addEventListener('pointercancel', () => {
   isPainting = false;
   isErasing = false;
  });

  // Suppress context menu on right-click
  container.addEventListener('contextmenu', e => e.preventDefault());
 }

 /* ─── Panel ──────────────────────────────────────────────────────── */
 function buildPanel() {
  const panel = LabUtils.createPanel('Controls');

  panel.addSlider('Brush', 1, 8, cfg.brushSize, 1, v => {
   cfg.brushSize = v;
  });

  panel.addSelect('Material', ['sand', 'water', 'stone'], cfg.material, v => {
   cfg.material = v;
  });

  panel.addToggle('Gravity', cfg.gravity, v => {
   cfg.gravity = v;
  });

  panel.addSeparator();

  panel.addButtons([
   {
    label: paused ? ' Play' : '⏸ Pause',
    id: 'btn-playpause',
    onClick: (btn) => {
     paused = !paused;
     btn.textContent = paused ? ' Play' : '⏸ Pause';
    }
   },
   {
    label: '↺ Clear',
    onClick: () => clearGrid()
   },
  ]);

  LabUtils.createFullscreenBtn(document.getElementById(CONTAINER_ID));

  panel.addButtons([
   {
    label: 'Save PNG',
    onClick: () => LabUtils.exportPNG(canvas, 'sand-simulation')
   }
  ]);

  panel.addSeparator();
  panel.addHint('Left-drag to paint. Right-drag to erase.');
 }

 /* ─── Help ───────────────────────────────────────────────────────── */
 function buildHelp() {
  LabUtils.createHelp([
   ['Drag', 'Paint particles'],
   ['Right', 'Erase particles'],
   ['Space', 'Play / Pause'],
   ['R',   'Clear grid'],
   ['F',   'Fullscreen'],
   ['S',   'Save PNG'],
  ]);
 }

 /* ─── Keys ───────────────────────────────────────────────────────── */
 function buildKeys() {
  LabUtils.bindKeys({
   ' ' : () => {
    paused = !paused;
    const btn = document.getElementById('btn-playpause');
    if (btn) btn.textContent = paused ? ' Play' : '⏸ Pause';
   },
   'r' : clearGrid,
   'R' : clearGrid,
   'f' : () => LabUtils.initFullscreen(document.getElementById(CONTAINER_ID)),
   'F' : () => LabUtils.initFullscreen(document.getElementById(CONTAINER_ID)),
   's' : () => LabUtils.exportPNG(canvas, 'sand-simulation'),
   'S' : () => LabUtils.exportPNG(canvas, 'sand-simulation'),
  });
 }

 /* ─── Reduced motion ─────────────────────────────────────────────── */
 function checkReducedMotion() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
   paused = true;
   const btn = document.getElementById('btn-playpause');
   if (btn) btn.textContent = ' Play';
  }
 }

 /* ─── Init ───────────────────────────────────────────────────────── */
 function init() {
  setupCanvas();
  setupPointer();
  buildPanel();
  buildHelp();
  buildKeys();
  checkReducedMotion();

  LabUtils.initVisibilityPause(
   () => { paused = true; },
   () => { paused = false; }
  );

  rafId = requestAnimationFrame(loop);
 }

 if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
 } else {
  init();
 }
}());

/**
 * draw.js — AI Drawing with ml5 SketchRNN
 *
 * Algorithm:
 *  1. User draws on the canvas with the mouse/touch.
 *  2. When the mouse is released, the drawn path (simplified via RDP)
 *   is passed to ml5's SketchRNN model.
 *  3. The model generates strokes that continue the drawing in the
 *   style of the trained category (cat, face, yoga, etc.).
 *
 * Controls (LabUtils panel):
 *  - Brush size (1–8px, default 3)
 *  - Stroke color: dark | accent | auto
 *  - Temperature (0.2–1.0, default 0.65)
 *  - Model: cat | face | yoga
 *  - Play/Pause AI continuation
 *  - Buttons: Clear (R), Undo (Ctrl+Z), Save PNG (S), Fullscreen (F)
 *
 * Notes:
 *  - ml5.sketchRNN is loaded in preload().
 *  - Loading overlay (#model-loading-overlay) is hidden on model ready.
 *  - Play/Pause only controls AI generation; user can always draw.
 *  - Start with AI paused if reducedMotion.
 */

(function () {
 'use strict';

 /* ── Overlay helpers ─────────────────────────────────────────── */
 const overlay   = document.getElementById('model-loading-overlay');
 const loadSubtext = document.getElementById('load-subtext');

 function showOverlay(msg) {
  if (!overlay) return;
  if (loadSubtext && msg) loadSubtext.textContent = msg;
  overlay.classList.remove('hidden');
 }

 function hideOverlay() {
  if (!overlay) return;
  overlay.classList.add('hidden');
  // Remove from DOM after transition so it doesn't block interaction
  setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 500);
 }

 function showError(msg) {
  if (!overlay) return;
  overlay.classList.remove('hidden');
  const spinner = overlay.querySelector('.loading-spinner');
  if (spinner) spinner.style.display = 'none';
  const label = overlay.querySelector('.load-label');
  if (label) label.textContent = 'Model failed to load';
  if (loadSubtext) loadSubtext.textContent = msg || 'Check console for details.';
 }

 /* ─────────────────────────────────────────────────────────────── */
 new p5(function (p) {

  /* ── State ──────────────────────────────────────────────────── */
  let sketchRNN  = null;   // ml5 model instance
  let modelReady  = false;
  let currentModel = 'cat';

  let brushSize  = 3;
  let strokeColorMode = 'auto'; // 'dark' | 'accent' | 'auto'
  let temperature = 0.65;
  let aiEnabled  = false;  // Play/Pause AI continuation

  let isDrawing  = false;  // user currently drawing
  let userStrokes = [];    // array of stroke arrays [{x,y}]
  let currentStroke = [];   // points in progress
  let aiStrokes  = [];    // array of AI-generated stroke arrays
  let currentAiStroke = [];  // points in progress from AI
  let isGenerating = false;  // AI currently generating

  let reducedMotion = false;

  // Theme colours
  let clrBg, clrFg, clrAccent1, clrFgMuted, clrAccentText;

  /* ── p5 Lifecycle ───────────────────────────────────────────── */
  p.preload = function () {
   showOverlay('Fetching SketchRNN weights…');
   try {
    sketchRNN = ml5.sketchRNN(currentModel, onModelReady);
   } catch (e) {
    console.error('ml5 sketchRNN load error:', e);
    showError(String(e));
   }
  };

  p.setup = function () {
   reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

   const container = document.getElementById('sketch-container');
   const cnv = LabUtils.createCanvas(p, container);
   cnv.elt.setAttribute('aria-label', 'AI drawing canvas — draw with mouse or touch');

   refreshTheme();
   p.background(clrBg);

   // Start AI paused under reduced motion
   aiEnabled = !reducedMotion;

   buildPanel();
   buildHelp();
   LabUtils.createFullscreenBtn(container);
   LabUtils.bindKeys(p, {
    'r': clearCanvas,
    'R': clearCanvas,
    'f': () => LabUtils.initFullscreen(container),
    'F': () => LabUtils.initFullscreen(container),
    's': () => LabUtils.exportPNG(cnv, 'ai-drawing'),
    'S': () => LabUtils.exportPNG(cnv, 'ai-drawing'),
    ' ': toggleAI,
   });
   // Ctrl+Z undo
   document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
     e.preventDefault();
     undoLastStroke();
    }
   });

   LabUtils.syncTheme(() => {
    refreshTheme();
    redrawAll();
   });
   LabUtils.initVisibilityPause(p);
   p.noLoop(); // only draw on events / AI step
  };

  /* ── Mouse drawing ──────────────────────────────────────────── */
  p.mousePressed = function () {
   if (isOutsideCanvas()) return;
   if (isGenerating) stopGeneration();
   isDrawing = true;
   currentStroke = [{ x: p.mouseX, y: p.mouseY }];
   return false;
  };

  p.mouseDragged = function () {
   if (!isDrawing) return;
   currentStroke.push({ x: p.mouseX, y: p.mouseY });
   // Draw incrementally
   p.stroke(getCurrentStrokeColor());
   p.strokeWeight(brushSize);
   p.noFill();
   const len = currentStroke.length;
   if (len >= 2) {
    const a = currentStroke[len - 2];
    const b = currentStroke[len - 1];
    p.line(a.x, a.y, b.x, b.y);
   }
   return false;
  };

  p.mouseReleased = function () {
   if (!isDrawing) return;
   isDrawing = false;
   if (currentStroke.length > 1) {
    userStrokes.push(currentStroke.slice());
    if (aiEnabled && modelReady) triggerAI(currentStroke);
   }
   currentStroke = [];
   return false;
  };

  /* ── Touch drawing ──────────────────────────────────────────── */
  p.touchStarted = function () {
   if (p.touches.length === 0) return;
   if (isGenerating) stopGeneration();
   isDrawing = true;
   const t = p.touches[0];
   currentStroke = [{ x: t.x, y: t.y }];
   return false;
  };

  p.touchMoved = function () {
   if (!isDrawing || p.touches.length === 0) return;
   const t = p.touches[0];
   currentStroke.push({ x: t.x, y: t.y });
   p.stroke(getCurrentStrokeColor());
   p.strokeWeight(brushSize);
   p.noFill();
   const len = currentStroke.length;
   if (len >= 2) {
    const a = currentStroke[len - 2];
    const b = currentStroke[len - 1];
    p.line(a.x, a.y, b.x, b.y);
   }
   return false;
  };

  p.touchEnded = function () {
   if (!isDrawing) return;
   isDrawing = false;
   if (currentStroke.length > 1) {
    userStrokes.push(currentStroke.slice());
    if (aiEnabled && modelReady) triggerAI(currentStroke);
   }
   currentStroke = [];
   return false;
  };

  p.windowResized = function () {
   const container = document.getElementById('sketch-container');
   LabUtils.createCanvas(p, container);
   redrawAll();
  };

  /* ── Model ready callback ───────────────────────────────────── */
  function onModelReady() {
   modelReady = true;
   hideOverlay();
   console.log('[draw.js] SketchRNN model ready:', currentModel);
  }

  /* ── AI generation ──────────────────────────────────────────── */
  function triggerAI(stroke) {
   if (!modelReady || !aiEnabled || isGenerating) return;

   // Simplify the user stroke with RDP if available
   let path = stroke;
   if (typeof rdpSimplify === 'function' && path.length > 4) {
    path = rdpSimplify(path, 2.0);
   }

   if (path.length < 2) return;

   // Convert path to stroke-5 format for SketchRNN seed
   // ml5 SketchRNN expects an array of {x, y, pen} objects or stroke5 arrays
   // We'll use the last point of user's stroke as the AI seed position
   const seedPoint = path[path.length - 1];
   currentAiStroke = [seedPoint];
   isGenerating = true;

   // Reset model and seed with the user stroke
   try {
    // ml5 0.12 API: sketchRNN.reset() then generate
    if (typeof sketchRNN.reset === 'function') sketchRNN.reset();

    // Seed with the drawn path converted to stroke deltas
    if (typeof sketchRNN.generate === 'function') {
     generateNextStroke(seedPoint);
    }
   } catch (e) {
    console.warn('[draw.js] AI generation error:', e);
    isGenerating = false;
   }
  }

  function generateNextStroke(lastPt) {
   if (!isGenerating || !modelReady) return;

   try {
    sketchRNN.generate({ temperature }, function (err, result) {
     if (err || !result) {
      console.warn('[draw.js] Generate error:', err);
      isGenerating = false;
      return;
     }

     // result: { dx, dy, pen } where pen is 'down'|'up'|'end'
     const nx = lastPt.x + (result.dx || 0);
     const ny = lastPt.y + (result.dy || 0);
     const pen = result.pen;

     if (pen === 'end') {
      // Model finished this stroke sequence
      if (currentAiStroke.length > 1) {
       aiStrokes.push(currentAiStroke.slice());
      }
      currentAiStroke = [];
      isGenerating = false;
      return;
     }

     if (pen === 'down') {
      // Draw segment
      const prev = currentAiStroke[currentAiStroke.length - 1] || lastPt;
      drawAiSegment(prev, { x: nx, y: ny });
      currentAiStroke.push({ x: nx, y: ny });
     } else {
      // pen === 'up': lift pen (new segment starts)
      if (currentAiStroke.length > 1) {
       aiStrokes.push(currentAiStroke.slice());
      }
      currentAiStroke = [{ x: nx, y: ny }];
     }

     // Continue generation (up to ~100 steps per trigger)
     if (currentAiStroke.length < 200 && aiStrokes.reduce((s, arr) => s + arr.length, 0) < 500) {
      generateNextStroke({ x: nx, y: ny });
     } else {
      if (currentAiStroke.length > 1) aiStrokes.push(currentAiStroke.slice());
      currentAiStroke = [];
      isGenerating = false;
     }
    });
   } catch (e) {
    console.warn('[draw.js] sketchRNN.generate threw:', e);
    isGenerating = false;
   }
  }

  function stopGeneration() {
   isGenerating = false;
   if (currentAiStroke.length > 1) {
    aiStrokes.push(currentAiStroke.slice());
    currentAiStroke = [];
   }
  }

  function drawAiSegment(a, b) {
   // AI strokes draw in accent color to visually distinguish from user strokes
   p.stroke(clrAccent1);
   p.strokeWeight(brushSize * 0.85);
   p.noFill();
   p.line(a.x, a.y, b.x, b.y);
  }

  /* ── Canvas helpers ─────────────────────────────────────────── */
  function clearCanvas() {
   stopGeneration();
   userStrokes = [];
   aiStrokes  = [];
   currentStroke = [];
   currentAiStroke = [];
   p.background(clrBg);
  }

  function undoLastStroke() {
   // Remove the last user or AI segment group
   if (aiStrokes.length > 0) {
    aiStrokes.pop();
   } else if (userStrokes.length > 0) {
    userStrokes.pop();
   }
   redrawAll();
  }

  function redrawAll() {
   p.background(clrBg);
   // Redraw user strokes
   p.strokeWeight(brushSize);
   p.noFill();
   for (const stroke of userStrokes) {
    p.stroke(getCurrentStrokeColor());
    p.beginShape();
    for (const pt of stroke) p.curveVertex(pt.x, pt.y);
    p.endShape();
   }
   // Redraw AI strokes
   p.stroke(clrAccent1);
   p.strokeWeight(brushSize * 0.85);
   for (const stroke of aiStrokes) {
    p.beginShape();
    for (const pt of stroke) p.curveVertex(pt.x, pt.y);
    p.endShape();
   }
  }

  function getCurrentStrokeColor() {
   if (strokeColorMode === 'dark')  return '#111111';
   if (strokeColorMode === 'accent') return clrAccent1;
   // 'auto': dark in light theme, light in dark theme
   const theme = document.documentElement.dataset.theme || 'dark';
   return theme === 'light' ? '#111111' : '#f0f0f0';
  }

  function isOutsideCanvas() {
   return p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height;
  }

  /* ── Model switching ────────────────────────────────────────── */
  function loadModel(modelName) {
   currentModel = modelName;
   modelReady  = false;
   isGenerating = false;
   showOverlay(`Loading "${modelName}" model…`);
   clearCanvas();
   try {
    sketchRNN = ml5.sketchRNN(currentModel, onModelReady);
   } catch (e) {
    console.error('[draw.js] model reload error:', e);
    showError(String(e));
   }
  }

  /* ── AI toggle ──────────────────────────────────────────────── */
  function toggleAI() {
   aiEnabled = !aiEnabled;
  }

  /* ── Theme ──────────────────────────────────────────────────── */
  function refreshTheme() {
   const cv = LabUtils.getCSSVar;
   clrBg     = cv('--clr-bg')       || '#0d0d0d';
   clrFg     = cv('--clr-fg')       || '#f0f0f0';
   clrAccent1  = cv('--clr-accent-1')    || '#c4b0f5';
   clrFgMuted  = cv('--clr-fg-muted')    || '#888888';
   clrAccentText = cv('--clr-accent-1-text') || '#4f28b8';
  }

  /* ── Panel ──────────────────────────────────────────────────── */
  function buildPanel() {
   const container = document.getElementById('sketch-container');
   const panel = LabUtils.createPanel(container, 'Controls');

   panel.addSlider('Brush size', 1, 8, brushSize, 1, (v) => {
    brushSize = v;
   });

   panel.addSelect('Stroke color', ['auto', 'dark', 'accent'], strokeColorMode, (v) => {
    strokeColorMode = v;
   });

   panel.addSlider('Temperature', 0.2, 1.0, temperature, 0.05, (v) => {
    temperature = v;
   });

   panel.addSelect('Model', ['cat', 'face', 'yoga'], currentModel, (v) => {
    loadModel(v);
   });

   panel.addSeparator();

   panel.addButtons([
    {
     label: aiEnabled ? 'AI Pause ⏸' : 'AI Play ',
     id: 'btn-ai-playpause',
     onClick: function (btn) {
      toggleAI();
      btn.textContent = aiEnabled ? 'AI Pause ⏸' : 'AI Play ';
     }
    },
    {
     label: 'Clear ↺',
     onClick: () => clearCanvas()
    }
   ]);

   panel.addButtons([
    {
     label: 'Undo ↩',
     onClick: () => undoLastStroke()
    },
    {
     label: 'Save PNG',
     onClick: () => LabUtils.exportPNG(document.querySelector('#sketch-container canvas'), 'ai-drawing')
    }
   ]);

   panel.addSeparator();

   panel.addButtons([
    {
     label: 'Fullscreen',
     onClick: () => LabUtils.initFullscreen(container)
    }
   ]);

   panel.addHint(
    'Draw with mouse/touch · AI continues your stroke\n' +
    'Space: AI on/off · R: clear · Ctrl+Z: undo · F: fullscreen · S: save'
   );
  }

  /* ── Help overlay ───────────────────────────────────────────── */
  function buildHelp() {
   const container = document.getElementById('sketch-container');
   LabUtils.createHelp(container, [
    '**AI Drawing — SketchRNN**',
    'Draw on the canvas. When you release the mouse, the AI continues your stroke in a cat-like style.',
    'Lavender strokes are AI-generated; white/dark strokes are yours.',
    '',
    '**Keys:** Space – AI on/off · R – clear · Ctrl+Z – undo · F – fullscreen · S – save PNG',
   ].join('\n'));
  }

 }, document.getElementById('sketch-container'));

}());

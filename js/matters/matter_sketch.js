/**
 * matter_sketch.js — Matter.js Physics Sandbox
 *
 * Algorithm:
 *  Uses Matter.js for rigid-body physics. Click/tap to spawn bodies
 *  (box, circle, triangle) that fall, bounce, and collide. Static
 *  ground + walls keep bodies in bounds.
 *
 * Controls (LabUtils panel):
 *  - Gravity slider (0–3, default 1)
 *  - Spawn shape: box | circle | triangle
 *  - Body size slider (10–60px, default 25)
 *  - Restitution slider (0–1, default 0.6)
 *  - Friction slider (0–1, default 0.1)
 *  - Reset, Play/Pause, Fullscreen (F), Save PNG (S)
 *
 * Note: Does NOT depend on box.js.
 */

(function () {
 'use strict';

 /* ─── Matter.js aliases ──────────────────────────────────────── */
 const { Engine, Render, Runner, Bodies, Body, Composite, Events, Mouse, MouseConstraint } = Matter;

 new p5(function (p) {

  /* ── Engine & world ─────────────────────────────────────────── */
  let engine;
  let world;
  let ground, wallL, wallR, ceiling;

  /* ── State ──────────────────────────────────────────────────── */
  let spawnShape  = 'box';
  let bodySize   = 25;
  let restitution = 0.6;
  let friction   = 0.1;
  let gravityY   = 1;
  let isPaused   = false;
  let reducedMotion = false;

  // Theme colours
  let clrBg, clrFg, clrFgMuted, clrAccent1, clrAccent2, clrAccent3, clrBorder;

  // Accent colours cycle for variety
  const ACCENT_CYCLE = ['clrAccent1', 'clrAccent2', 'clrAccent3'];
  let accentIdx = 0;

  /* ── Wall thickness ─────────────────────────────────────────── */
  const WALL = 50;

  /* ── p5 Lifecycle ───────────────────────────────────────────── */
  p.setup = function () {
   reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

   const container = document.getElementById('sketch-container');
   LabUtils.createCanvas(p, container);

   refreshTheme();
   initEngine();

   isPaused = reducedMotion;

   buildPanel();
   buildHelp();
   LabUtils.createFullscreenBtn(container);
   LabUtils.bindKeys(p, {
    ' ': togglePause,
    'r': clearBodies,
    'R': clearBodies,
    'f': () => LabUtils.initFullscreen(container),
    'F': () => LabUtils.initFullscreen(container),
    's': () => LabUtils.exportPNG(p.elt || document.querySelector('#sketch-container canvas'), 'matter'),
    'S': () => LabUtils.exportPNG(p.elt || document.querySelector('#sketch-container canvas'), 'matter'),
   });

   LabUtils.syncTheme(refreshTheme);
   LabUtils.initVisibilityPause(p);
   p.frameRate(60);
  };

  p.draw = function () {
   p.background(clrBg);

   if (!isPaused) {
    engine.timing.timeScale = 1;
    Engine.update(engine, 1000 / 60);
   } else {
    engine.timing.timeScale = 0;
   }

   drawBodies();
  };

  p.windowResized = function () {
   const container = document.getElementById('sketch-container');
   LabUtils.createCanvas(p, container);
   rebuildWalls();
  };

  /* ── Spawn on click ─────────────────────────────────────────── */
  p.mousePressed = function () {
   // Ignore clicks on UI overlays
   if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;
   spawnBody(p.mouseX, p.mouseY);
   return false; // prevent default
  };

  p.touchStarted = function () {
   if (p.touches.length === 0) return;
   const t = p.touches[0];
   spawnBody(t.x, t.y);
   return false;
  };

  /* ── Engine setup ───────────────────────────────────────────── */
  function initEngine() {
   engine = Engine.create();
   world = engine.world;
   engine.gravity.y = gravityY;

   buildWalls();
  }

  function buildWalls() {
   const W = p.width;
   const H = p.height;
   // Static boundaries: ground, left wall, right wall, ceiling
   ground = Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 2, WALL, { isStatic: true, label: 'ground', restitution: 0.3, friction: 0.5 });
   wallL  = Bodies.rectangle(-WALL / 2, H / 2, WALL, H * 2, { isStatic: true, label: 'wallL',  restitution: 0.3 });
   wallR  = Bodies.rectangle(W + WALL / 2, H / 2, WALL, H * 2, { isStatic: true, label: 'wallR',  restitution: 0.3 });
   ceiling = Bodies.rectangle(W / 2, -WALL / 2, W + WALL * 2, WALL, { isStatic: true, label: 'ceiling', restitution: 0.3 });
   Composite.add(world, [ground, wallL, wallR, ceiling]);
  }

  function rebuildWalls() {
   Composite.remove(world, ground);
   Composite.remove(world, wallL);
   Composite.remove(world, wallR);
   Composite.remove(world, ceiling);
   buildWalls();
  }

  /* ── Body spawning ──────────────────────────────────────────── */
  function spawnBody(x, y) {
   const opts = {
    restitution,
    friction,
    frictionAir: 0.01,
    label: 'dynamic',
    // Attach accent colour as custom property for rendering
    render: { fillStyle: nextAccent() },
   };

   let body;
   const s = bodySize;

   if (spawnShape === 'circle') {
    body = Bodies.circle(x, y, s / 2, opts);
   } else if (spawnShape === 'triangle') {
    body = Bodies.polygon(x, y, 3, s * 0.65, opts);
   } else {
    // box
    body = Bodies.rectangle(x, y, s, s, opts);
   }

   // Slight random initial velocity for more dynamic feel
   Body.setVelocity(body, {
    x: p.random(-3, 3),
    y: p.random(-2, 2)
   });

   Composite.add(world, body);
  }

  function nextAccent() {
   const accents = [clrAccent1, clrAccent2, clrAccent3];
   const c = accents[accentIdx % accents.length];
   accentIdx++;
   return c;
  }

  /* ── Clear dynamic bodies ───────────────────────────────────── */
  function clearBodies() {
   const bodies = Composite.allBodies(world);
   for (const b of bodies) {
    if (!b.isStatic) Composite.remove(world, b);
   }
  }

  /* ── Drawing ────────────────────────────────────────────────── */
  function drawBodies() {
   const bodies = Composite.allBodies(world);

   for (const body of bodies) {
    const verts = body.vertices;
    p.beginShape();

    if (body.isStatic) {
     // Ground / walls: subtle muted fill
     p.fill(clrFgMuted + '33'); // 20% opacity
     p.stroke(clrFgMuted);
     p.strokeWeight(1);
    } else {
     // Dynamic bodies: accent colour
     const fillCol = body.render && body.render.fillStyle ? body.render.fillStyle : clrAccent1;
     p.fill(fillCol + 'cc'); // 80% opacity
     p.stroke(fillCol);
     p.strokeWeight(1.5);
    }

    for (const v of verts) p.vertex(v.x, v.y);
    p.endShape(p.CLOSE);
   }
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function togglePause() {
   isPaused = !isPaused;
  }

  function refreshTheme() {
   const cv = LabUtils.getCSSVar;
   clrBg   = cv('--clr-bg')    || '#0d0d0d';
   clrFg   = cv('--clr-fg')    || '#f0f0f0';
   clrFgMuted = cv('--clr-fg-muted') || '#888888';
   clrAccent1 = cv('--clr-accent-1') || '#c4b0f5';
   clrAccent2 = cv('--clr-accent-2') || '#f47aaa';
   clrAccent3 = cv('--clr-accent-3') || '#6eb8f5';
   clrBorder = cv('--clr-border')  || '#333333';
  }

  /* ── Panel ──────────────────────────────────────────────────── */
  function buildPanel() {
   const container = document.getElementById('sketch-container');
   const panel = LabUtils.createPanel(container, 'Controls');

   panel.addSlider('Gravity', 0, 3, gravityY, 0.1, (v) => {
    gravityY = v;
    engine.gravity.y = v;
   });

   panel.addSelect('Shape', ['box', 'circle', 'triangle'], spawnShape, (v) => {
    spawnShape = v;
   });

   panel.addSlider('Size (px)', 10, 60, bodySize, 1, (v) => {
    bodySize = v;
   });

   panel.addSlider('Bounciness', 0, 1, restitution, 0.05, (v) => {
    restitution = v;
   });

   panel.addSlider('Friction', 0, 1, friction, 0.05, (v) => {
    friction = v;
   });

   panel.addSeparator();

   panel.addButtons([
    {
     label: isPaused ? 'Play ' : 'Pause ⏸',
     id: 'btn-playpause',
     onClick: function (btn) {
      togglePause();
      btn.textContent = isPaused ? 'Play ' : 'Pause ⏸';
     }
    },
    {
     label: 'Reset ↺',
     onClick: () => clearBodies()
    }
   ]);

   panel.addSeparator();

   panel.addButtons([
    {
     label: 'Save PNG',
     onClick: () => LabUtils.exportPNG(p.elt || document.querySelector('#sketch-container canvas'), 'matter')
    },
    {
     label: 'Fullscreen',
     onClick: () => LabUtils.initFullscreen(container)
    }
   ]);

   panel.addHint('Click / tap canvas to spawn · Space: pause · R: reset · F: fullscreen · S: save');
  }

  /* ── Help overlay ───────────────────────────────────────────── */
  function buildHelp() {
   const container = document.getElementById('sketch-container');
   LabUtils.createHelp(container, [
    '**Matter.js Physics**',
    'Click or tap anywhere on the canvas to spawn a body.',
    'Bodies fall under gravity and collide with walls and each other.',
    '',
    '**Keys:** Space – play/pause · R – clear bodies · F – fullscreen · S – save PNG',
   ].join('\n'));
  }

 }, document.getElementById('sketch-container'));

}());

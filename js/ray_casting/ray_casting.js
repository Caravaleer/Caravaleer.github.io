/**
 * Ray Casting — Lab Experiment
 * Consolidated p5 instance-mode sketch.
 * Classes: Boundary, Ray, Particle — all inlined here.
 * Uses window.LabUtils for panel, theme sync, and helpers.
 */
(function () {
  'use strict';

  var container = document.getElementById('sketch-container');

  new p5(function (p) {

    /* ─── State ─────────────────────────────────────────── */
    var walls      = [];
    var particle   = null;
    var paused     = false;

    /* ─── Controls (populated by panel) ─────────────────── */
    var cfg = {
      rayCount  : 180,
      wallCount : 5,
      colorMode : 'white',   // 'white' | 'accent' | 'heat'
      opacity   : 60,
    };

    /* ─── Boundary class ─────────────────────────────────── */
    /**
     * A straight wall segment from (x1,y1) to (x2,y2).
     */
    function Boundary(x1, y1, x2, y2) {
      this.a = p.createVector(x1, y1);
      this.b = p.createVector(x2, y2);
    }

    Boundary.prototype.show = function (col) {
      p.stroke(col);
      p.strokeWeight(2);
      p.line(this.a.x, this.a.y, this.b.x, this.b.y);
    };

    /* ─── Ray class ──────────────────────────────────────── */
    /**
     * A single ray from origin in direction `angle` (radians).
     */
    function Ray(pos, angle) {
      this.pos = pos;
      this.dir = p5.Vector.fromAngle(angle);
    }

    /**
     * Find the closest intersection of this ray with a Boundary.
     * Returns the intersection point (p5.Vector) or null.
     */
    Ray.prototype.cast = function (wall) {
      var x1 = wall.a.x, y1 = wall.a.y;
      var x2 = wall.b.x, y2 = wall.b.y;
      var x3 = this.pos.x, y3 = this.pos.y;
      var x4 = this.pos.x + this.dir.x;
      var y4 = this.pos.y + this.dir.y;

      var den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (den === 0) return null;

      var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
      var u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

      if (t > 0 && t < 1 && u > 0) {
        return p.createVector(
          x1 + t * (x2 - x1),
          y1 + t * (y2 - y1)
        );
      }
      return null;
    };

    /* ─── Particle class ─────────────────────────────────── */
    /**
     * The light source that emits rays.
     */
    function Particle(x, y) {
      this.pos  = p.createVector(x, y);
      this.rays = [];
      this._buildRays();
    }

    Particle.prototype._buildRays = function () {
      this.rays = [];
      var step = 360 / cfg.rayCount;
      for (var a = 0; a < 360; a += step) {
        this.rays.push(new Ray(this.pos, p.radians(a)));
      }
    };

    Particle.prototype.update = function (x, y) {
      this.pos.set(x, y);
      // Keep ray origins in sync
      for (var i = 0; i < this.rays.length; i++) {
        this.rays[i].pos = this.pos;
      }
    };

    Particle.prototype.rebuildRays = function () {
      this._buildRays();
    };

    /**
     * Look at all walls and draw each ray to its closest hit.
     * @param {number} maxDist  — canvas diagonal, used for heat mapping
     */
    Particle.prototype.show = function (maxDist) {
      var accent1 = LabUtils.getCSSVar('--clr-accent-1') || '#c4b0f5';
      var alpha   = p.map(cfg.opacity, 0, 100, 0, 255);

      for (var i = 0; i < this.rays.length; i++) {
        var ray     = this.rays[i];
        var closest = null;
        var record  = Infinity;

        // Find nearest wall hit
        for (var j = 0; j < walls.length; j++) {
          var pt = ray.cast(walls[j]);
          if (pt) {
            var d = p5.Vector.dist(this.pos, pt);
            if (d < record) {
              record  = d;
              closest = pt;
            }
          }
        }

        if (!closest) continue;

        // Choose colour based on mode
        var col;
        if (cfg.colorMode === 'white') {
          col = p.color(255, 255, 255, alpha);
        } else if (cfg.colorMode === 'accent') {
          var c = p.color(accent1);
          c.setAlpha(alpha);
          col = c;
        } else {
          // heat: close = bright/warm, far = cool/dim
          var t = 1 - p.constrain(record / (maxDist * 0.5), 0, 1);
          // interpolate accent1 (lavender) → white at close range
          var r = p.map(t, 0, 1, 80,  255);
          var g = p.map(t, 0, 1, 50,  220);
          var b = p.map(t, 0, 1, 180, 255);
          col = p.color(r, g, b, alpha * t + 20);
        }

        p.stroke(col);
        p.strokeWeight(1);
        p.line(this.pos.x, this.pos.y, closest.x, closest.y);
      }
    };

    /* ─── Wall generation ────────────────────────────────── */
    function generateWalls() {
      walls = [];
      var w = p.width, h = p.height;

      // Always add screen-border walls so rays are always bounded
      walls.push(new Boundary(0,     0,     w, 0    ));
      walls.push(new Boundary(w,     0,     w, h    ));
      walls.push(new Boundary(w,     h,     0, h    ));
      walls.push(new Boundary(0,     h,     0, 0    ));

      // Random interior walls
      for (var i = 0; i < cfg.wallCount; i++) {
        var x1 = p.random(w * 0.05, w * 0.95);
        var y1 = p.random(h * 0.05, h * 0.95);
        var x2 = p.random(w * 0.05, w * 0.95);
        var y2 = p.random(h * 0.05, h * 0.95);
        walls.push(new Boundary(x1, y1, x2, y2));
      }
    }

    /* ─── Panel setup ────────────────────────────────────── */
    function setupPanel() {
      var panel = LabUtils.createPanel({ title: 'Ray Casting' });

      panel.addSlider('Rays', 10, 360, cfg.rayCount, 1, function (v) {
        cfg.rayCount = v;
        particle.rebuildRays();
      });

      panel.addSlider('Walls', 3, 20, cfg.wallCount, 1, function (v) {
        cfg.wallCount = v;
        generateWalls();
      });

      panel.addSelect('Color', [
        { value: 'white',  label: 'White'    },
        { value: 'accent', label: 'Accent'   },
        { value: 'heat',   label: 'Heat map' },
      ], cfg.colorMode, function (v) {
        cfg.colorMode = v;
      });

      panel.addSlider('Opacity', 10, 100, cfg.opacity, 1, function (v) {
        cfg.opacity = v;
      });

      panel.addSeparator();

      panel.addButtons([
        {
          label   : 'Reset walls (R)',
          onClick : function () { generateWalls(); }
        }
      ]);

      panel.addHint('Move mouse / touch to aim the light source.');

      LabUtils.createFullscreenBtn(container);
      LabUtils.createHelp([
        { key: 'Space', desc: 'Play / Pause' },
        { key: 'R',     desc: 'Reset walls'  },
        { key: 'F',     desc: 'Fullscreen'   },
        { key: 'S',     desc: 'Save PNG'     },
      ]);
    }

    /* ─── p5 lifecycle ───────────────────────────────────── */
    p.setup = function () {
      var cnv = LabUtils.createCanvas(p, container);
      cnv.style('display', 'block');

      p.noFill();

      // Reduced-motion: start paused
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        paused = true;
      }

      generateWalls();
      particle = new Particle(p.width / 2, p.height / 2);

      setupPanel();
      LabUtils.syncTheme(p);
      LabUtils.initVisibilityPause(function () { return paused; }, function (v) { paused = v; });

      LabUtils.bindKeys({
        ' ': function () { paused = !paused; },
        'r': function () { generateWalls(); },
        'R': function () { generateWalls(); },
        'f': function () { LabUtils.initFullscreen(container); },
        'F': function () { LabUtils.initFullscreen(container); },
        's': function () { LabUtils.exportPNG(p, 'ray_casting'); },
        'S': function () { LabUtils.exportPNG(p, 'ray_casting'); },
      });
    };

    p.windowResized = function () {
      p.resizeCanvas(container.clientWidth, container.clientHeight);
      generateWalls();
    };

    p.draw = function () {
      if (paused) return;

      var bgColor = LabUtils.getCSSVar('--clr-bg') || '#0f0f13';
      p.background(bgColor);

      // Draw walls
      var fgColor = LabUtils.getCSSVar('--clr-fg') || '#e8e4f0';
      var wallCol = p.color(fgColor);
      wallCol.setAlpha(180);
      for (var i = 0; i < walls.length; i++) {
        walls[i].show(wallCol);
      }

      // Draw rays
      var diag = p.sqrt(p.width * p.width + p.height * p.height);
      particle.show(diag);

      // Draw particle dot
      p.noStroke();
      var accent = LabUtils.getCSSVar('--clr-accent-2') || '#f47aaa';
      p.fill(accent);
      p.circle(particle.pos.x, particle.pos.y, 8);
    };

    /* ─── Pointer tracking ───────────────────────────────── */
    function moveParticle() {
      particle.update(p.mouseX, p.mouseY);
    }

    p.mouseMoved  = moveParticle;
    p.touchMoved  = function () { moveParticle(); return false; }; // prevent scroll

  }, container);

}());

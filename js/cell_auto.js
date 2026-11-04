/**
 * Cellular Automaton — Lab Experiment
 * 1D Elementary Cellular Automaton (Wolfram rules 0–255).
 * p5 instance mode, uses window.LabUtils for panel/theme/helpers.
 *
 * Layout:
 *   - Canvas fills viewport width; height = window height − 48px topbar.
 *   - Each generation is one row of squares (cellSize px tall & wide).
 *   - Wraps around horizontally (toroidal) by default.
 *   - When all rows are filled the canvas is cleared and we restart from row 0.
 */
(function () {
  'use strict';

  var container = document.getElementById('sketch-container');

  new p5(function (p) {

    /* ─── Configuration (driven by panel) ───────────────── */
    var cfg = {
      rule      : 182,
      cellSize  : 4,
      speed     : 1,      // generations per frame
      wrap      : true,
      colorMode : 'accent', // 'binary' | 'accent' | 'gradient'
    };

    /* ─── State ──────────────────────────────────────────── */
    var cols        = 0;
    var rows        = 0;
    var generation  = 0;    // current row index being written
    var cells       = [];   // current generation (1D array, length = cols)
    var paused      = false;
    var ruleSet     = [];   // 8-bit lookup for the selected rule

    /* ─── Rule table ─────────────────────────────────────── */
    /**
     * Build an 8-entry lookup array from the rule integer (0–255).
     * Index is the 3-bit neighbourhood value (left·center·right),
     * value is the next state (0 or 1).
     */
    function buildRuleSet(ruleNum) {
      ruleSet = [];
      for (var i = 0; i < 8; i++) {
        ruleSet[i] = (ruleNum >> i) & 1;
      }
    }

    /* ─── Cell grid helpers ──────────────────────────────── */
    function recalcDimensions() {
      cols = Math.floor(p.width  / cfg.cellSize);
      rows = Math.floor(p.height / cfg.cellSize);
    }

    /** Reset to a single live centre cell. */
    function resetCenter() {
      cells = new Array(cols).fill(0);
      cells[Math.floor(cols / 2)] = 1;
      generation = 0;
      p.background(LabUtils.getCSSVar('--clr-bg') || '#0f0f13');
    }

    /** Reset to a random starting row. */
    function resetRandom() {
      cells = [];
      for (var i = 0; i < cols; i++) {
        cells.push(Math.random() < 0.5 ? 1 : 0);
      }
      generation = 0;
      p.background(LabUtils.getCSSVar('--clr-bg') || '#0f0f13');
    }

    /* ─── Colour helpers ─────────────────────────────────── */
    /**
     * Return a p5.Color for an active cell given the current colorMode
     * and the generation index (for gradient mode).
     */
    function activeCellColor(gen) {
      var totalRows = rows || 1;

      if (cfg.colorMode === 'binary') {
        return p.color(LabUtils.getCSSVar('--clr-fg') || '#e8e4f0');
      }

      if (cfg.colorMode === 'accent') {
        return p.color(LabUtils.getCSSVar('--clr-accent-1') || '#c4b0f5');
      }

      // gradient: hue sweeps 0→300 as generation goes 0→totalRows
      var hue = p.map(gen, 0, totalRows, 0, 300);
      p.colorMode(p.HSB, 360, 100, 100, 255);
      var col = p.color(hue, 80, 95, 230);
      p.colorMode(p.RGB, 255, 255, 255, 255);
      return col;
    }

    function bgColor() {
      return LabUtils.getCSSVar('--clr-bg') || '#0f0f13';
    }

    /* ─── Generation step ────────────────────────────────── */
    /**
     * Compute and draw the next `cfg.speed` generations.
     */
    function stepGenerations() {
      for (var s = 0; s < cfg.speed; s++) {
        // If we've filled the canvas, restart
        if (generation >= rows) {
          resetCenter();
        }

        drawRow(cells, generation);
        cells = computeNext(cells);
        generation++;
      }
    }

    /**
     * Compute the next generation from `current` using the ruleSet.
     */
    function computeNext(current) {
      var next = new Array(cols).fill(0);
      var n = current.length;
      for (var i = 0; i < n; i++) {
        var left   = cfg.wrap ? current[(i - 1 + n) % n] : (i > 0     ? current[i - 1] : 0);
        var centre = current[i];
        var right  = cfg.wrap ? current[(i + 1)     % n] : (i < n - 1 ? current[i + 1] : 0);
        var index  = (left << 2) | (centre << 1) | right;
        next[i] = ruleSet[index];
      }
      return next;
    }

    /**
     * Draw a single generation row to the canvas.
     */
    function drawRow(row, genIndex) {
      var cs   = cfg.cellSize;
      var y    = genIndex * cs;
      var dead = p.color(bgColor());
      var live = activeCellColor(genIndex);

      p.noStroke();
      for (var i = 0; i < row.length; i++) {
        p.fill(row[i] === 1 ? live : dead);
        p.rect(i * cs, y, cs, cs);
      }
    }

    /* ─── Panel ──────────────────────────────────────────── */
    function setupPanel() {
      var panel = LabUtils.createPanel({ title: 'Cellular Automaton' });

      panel.addSlider('Rule', 0, 255, cfg.rule, 1, function (v) {
        cfg.rule = v;
        buildRuleSet(v);
        resetCenter();
      });

      panel.addSlider('Cell size', 2, 8, cfg.cellSize, 1, function (v) {
        cfg.cellSize = v;
        recalcDimensions();
        resetCenter();
      });

      panel.addSlider('Speed', 1, 30, cfg.speed, 1, function (v) {
        cfg.speed = v;
      });

      panel.addToggle('Wrap edges', cfg.wrap, function (v) {
        cfg.wrap = v;
      });

      panel.addSelect('Color', [
        { value: 'binary',   label: 'Binary (B/W)'  },
        { value: 'accent',   label: 'Accent'         },
        { value: 'gradient', label: 'Gradient'       },
      ], cfg.colorMode, function (v) {
        cfg.colorMode = v;
        // Redraw from scratch so colors apply immediately
        resetCenter();
      });

      panel.addSeparator();

      panel.addButtons([
        {
          label   : 'Reset (R)',
          onClick : function () { resetCenter(); }
        }
      ]);

      panel.addHint('Rule 110 is Turing complete. Try 30, 90, 110, 182.');

      LabUtils.createFullscreenBtn(container);
      LabUtils.createHelp([
        { key: 'Space', desc: 'Play / Pause'          },
        { key: 'R',     desc: 'Reset (centre seed)'   },
        { key: 'F',     desc: 'Fullscreen'             },
        { key: 'S',     desc: 'Save PNG'               },
      ]);
    }

    /* ─── p5 lifecycle ───────────────────────────────────── */
    p.setup = function () {
      var cnv = LabUtils.createCanvas(p, container);
      cnv.style('display', 'block');

      p.colorMode(p.RGB, 255, 255, 255, 255);

      buildRuleSet(cfg.rule);
      recalcDimensions();

      // Reduced-motion: start paused
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        paused = true;
      }

      resetCenter();
      setupPanel();
      LabUtils.syncTheme(p);
      LabUtils.initVisibilityPause(
        function ()  { return paused; },
        function (v) { paused = v; }
      );

      LabUtils.bindKeys({
        ' ': function () { paused = !paused; },
        'r': function () { resetCenter(); },
        'R': function () { resetCenter(); },
        'f': function () { LabUtils.initFullscreen(container); },
        'F': function () { LabUtils.initFullscreen(container); },
        's': function () { LabUtils.exportPNG(p, 'cell_auto'); },
        'S': function () { LabUtils.exportPNG(p, 'cell_auto'); },
      });
    };

    p.windowResized = function () {
      p.resizeCanvas(container.clientWidth, container.clientHeight);
      recalcDimensions();
      resetCenter();
    };

    p.draw = function () {
      if (paused) return;
      stepGenerations();
    };

  }, container);

}());

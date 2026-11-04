/**
 * lab-utils.js — Shared utilities for all Lab experiments
 *
 * Exposed as window.LabUtils for compatibility with both vanilla JS and
 * p5.js (plain script) experiments.
 *
 * API notes:
 *  - createCanvas(containerOrP5, containerIfP5) — works for both vanilla and p5
 *  - createPanel(containerOrOpts, titleOrUndefined) — flexible first arg
 *  - createHelp(containerOrShortcuts, shortcutsIfContainer) — flexible
 *  - createFullscreenBtn(container) — optional container
 *  - bindKeys(p5OrMap, mapIfP5) — works with p5 or plain document
 *  - syncTheme(callbackOrP5) — fires callback on theme change
 *  - initVisibilityPause(p5OrHide, show) — p5 or callback style
 */

(function (global) {
  'use strict';

  // ── Theme helpers ────────────────────────────────────────────
  function getCSSVar(name, fallback) {
    if (fallback === undefined) fallback = '';
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim() || fallback;
  }

  function getThemeColors() {
    return {
      bg:           getCSSVar('--clr-bg',              '#0a0a0a'),
      surface:      getCSSVar('--clr-surface',          '#111111'),
      surface2:     getCSSVar('--clr-surface-2',        '#1a1a1a'),
      fg:           getCSSVar('--clr-fg',              '#f0ede6'),
      fgMuted:      getCSSVar('--clr-fg-muted',        '#888880'),
      accent:       getCSSVar('--clr-accent-1',        '#c4b0f5'),
      accentStrong: getCSSVar('--clr-accent-1-strong', '#9b7ee8'),
      accentText:   getCSSVar('--clr-accent-1-text',   '#6240c8'),
      accent2:      getCSSVar('--clr-accent-2',        '#f47aaa'),
      accent3:      getCSSVar('--clr-accent-3',        '#6eb8f5'),
      border:       getCSSVar('--clr-border',          '#2a2a2a'),
    };
  }

  // ── Canvas setup ─────────────────────────────────────────────
  /**
   * createCanvas(container)             — vanilla JS (returns {canvas,ctx,getSize,resize})
   * createCanvas(p5Instance, container) — p5.js (calls p.createCanvas, returns p5 element)
   *
   * For p5 experiments: p5's own canvas is created inside the container element.
   * Returns the p5 canvas element (p.elt) so you can pass it to exportPNG etc.
   */
  var MAX_DPR = 2;

  function createCanvas(first, second) {
    // Detect p5 instance mode: first arg has createCanvas method
    if (first && typeof first.createCanvas === 'function') {
      return _createP5Canvas(first, second);
    }
    return _createVanillaCanvas(first);
  }

  function _createP5Canvas(p, container) {
    var w = container.clientWidth  || window.innerWidth;
    var h = container.clientHeight || (window.innerHeight - 48);
    var cnv = p.createCanvas(w, h);
    // Move p5's canvas into the container element
    container.appendChild(cnv.elt);
    cnv.elt.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';

    // Handle resize via p.windowResized (caller should implement that)
    // but we also wire a window resize fallback
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var nw = container.clientWidth  || window.innerWidth;
        var nh = container.clientHeight || (window.innerHeight - 48);
        p.resizeCanvas(nw, nh);
      }, 100);
    });

    return cnv;
  }

  function _createVanillaCanvas(container) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);

    var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    var w = 0, h = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      w = container.clientWidth;
      h = container.clientHeight;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: w, h: h, dpr: dpr };
    }

    var ctx = canvas.getContext('2d');
    resize();

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 100);
    });
    window.addEventListener('orientationchange', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });

    return {
      canvas:  canvas,
      ctx:     ctx,
      getSize: function () { return { w: w, h: h, dpr: dpr }; },
      resize:  resize,
    };
  }

  // ── Fullscreen ────────────────────────────────────────────────
  var FS_ICON_ENTER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  var FS_ICON_EXIT  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>';

  function initFullscreen(btn, target) {
    // Allow passing just a container element as target (use documentElement as fallback)
    if (!btn) return;
    target = target || document.documentElement;
    if (!document.fullscreenEnabled) { btn.style.display = 'none'; return; }

    btn.innerHTML = FS_ICON_ENTER;
    btn.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        target.requestFullscreen().catch(function () {});
      } else {
        document.exitFullscreen().catch(function () {});
      }
    });

    document.addEventListener('fullscreenchange', function () {
      var isFS = !!document.fullscreenElement;
      btn.setAttribute('aria-label', isFS ? 'Exit fullscreen' : 'Enter fullscreen');
      btn.title = isFS ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)';
      btn.innerHTML = isFS ? FS_ICON_EXIT : FS_ICON_ENTER;
    });
  }

  // ── Pointer input ─────────────────────────────────────────────
  function initPointer(el) {
    var ptr = { x: 0, y: 0, down: false, id: null };

    function update(e) {
      var r = el.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
    }

    el.addEventListener('pointerdown', function (e) {
      el.setPointerCapture(e.pointerId);
      ptr.down = true;
      ptr.id = e.pointerId;
      update(e);
      e.preventDefault();
    }, { passive: false });

    el.addEventListener('pointermove', function (e) {
      update(e);
      if (ptr.down) e.preventDefault();
    }, { passive: false });

    el.addEventListener('pointerup',     function () { ptr.down = false; ptr.id = null; });
    el.addEventListener('pointercancel', function () { ptr.down = false; ptr.id = null; });
    el.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    el.addEventListener('touchmove',  function (e) { e.preventDefault(); }, { passive: false });

    return ptr;
  }

  // ── Visibility pausing ────────────────────────────────────────
  /**
   * initVisibilityPause(onHide, onShow) — callback style
   * initVisibilityPause(p5Instance)     — p5 style: calls p.noLoop()/p.loop()
   */
  function initVisibilityPause(onHideOrP5, onShow) {
    if (onHideOrP5 && typeof onHideOrP5.noLoop === 'function') {
      // p5 instance
      var p = onHideOrP5;
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) p.noLoop();
        else                 p.loop();
      });
    } else {
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) onHideOrP5();
        else if (onShow)     onShow();
      });
    }
  }

  // ── PNG export ────────────────────────────────────────────────
  /**
   * exportPNG(canvas, filename) — vanilla canvas or p5 canvas element
   */
  function exportPNG(canvasOrElt, filename) {
    filename = filename || 'lab-export.png';
    // support p5 element (has .elt) or raw canvas
    var el = (canvasOrElt && canvasOrElt.elt) ? canvasOrElt.elt : canvasOrElt;
    if (!el || typeof el.toDataURL !== 'function') {
      // fallback: grab first canvas in sketch-container
      el = document.querySelector('#sketch-container canvas');
    }
    if (!el) return;
    var link = document.createElement('a');
    link.download = (filename.endsWith('.png') ? filename : filename + '.png');
    link.href = el.toDataURL('image/png');
    link.click();
  }

  // ── Delta time ────────────────────────────────────────────────
  function createDeltaTimer() {
    var last = performance.now();
    return {
      tick: function () {
        var now = performance.now();
        var dt  = Math.min((now - last) / 1000, 0.05);
        last = now;
        return dt;
      },
      reset: function () { last = performance.now(); }
    };
  }

  // ── UI Panel builder ──────────────────────────────────────────
  /**
   * createPanel(opts)              — opts = { title }
   * createPanel({ title: ... })   — same
   * createPanel(container, title) — legacy signature used by some experiments
   */
  function createPanel(firstArg, secondArg) {
    var title = 'Controls';

    if (typeof firstArg === 'string') {
      title = firstArg;
    } else if (firstArg && typeof firstArg === 'object') {
      if (firstArg.title) {
        // opts object: { title }
        title = firstArg.title;
      } else if (firstArg.nodeType) {
        // DOM element passed as first arg, title is second
        title = secondArg || 'Controls';
      }
    }
    if (typeof secondArg === 'string') title = secondArg;

    // Hamburger toggle button (top-right area)
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'lab-panel-toggle';
    toggleBtn.setAttribute('aria-label', 'Toggle controls');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
    document.body.appendChild(toggleBtn);

    var panel = document.createElement('aside');
    panel.className = 'lab-panel';
    panel.setAttribute('aria-label', 'Experiment controls');

    var heading = document.createElement('h3');
    heading.textContent = title;
    panel.appendChild(heading);

    document.body.appendChild(panel);

    toggleBtn.addEventListener('click', function () {
      var open = panel.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', String(open));
    });

    function addSlider(opts) {
      var format = opts.format || function (v) { return v; };
      var wrap = document.createElement('div');
      wrap.className = 'lab-control';

      var lbl = document.createElement('label');
      var valSpan = document.createElement('span');
      valSpan.textContent = format(opts.value);
      lbl.textContent = opts.label + '\u00a0';
      lbl.appendChild(valSpan);

      var input = document.createElement('input');
      input.type  = 'range';
      input.min   = opts.min;
      input.max   = opts.max;
      input.step  = opts.step !== undefined ? opts.step : 1;
      input.value = opts.value;
      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        valSpan.textContent = format(v);
        opts.onChange(v);
      });

      wrap.appendChild(lbl);
      wrap.appendChild(input);
      panel.appendChild(wrap);
      return { input: input, valSpan: valSpan };
    }

    function addSelect(opts) {
      var wrap = document.createElement('div');
      wrap.className = 'lab-control';

      var lbl = document.createElement('label');
      lbl.textContent = opts.label;
      wrap.appendChild(lbl);

      var sel = document.createElement('select');
      opts.options.forEach(function (pair) {
        var opt = document.createElement('option');
        opt.value = pair[0];
        opt.textContent = pair[1];
        if (pair[0] === opts.value) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () { opts.onChange(sel.value); });
      wrap.appendChild(sel);
      panel.appendChild(wrap);
      return sel;
    }

    function addToggle(opts) {
      var wrap = document.createElement('div');
      wrap.className = 'lab-control lab-control--toggle';

      var lbl = document.createElement('label');
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !!opts.checked;
      chk.addEventListener('change', function () { opts.onChange(chk.checked); });
      lbl.appendChild(chk);
      lbl.appendChild(document.createTextNode('\u00a0' + opts.label));
      wrap.appendChild(lbl);
      panel.appendChild(wrap);
      return chk;
    }

    function addButtons(buttons) {
      var row = document.createElement('div');
      row.className = 'lab-control-row';
      buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.className = 'lab-btn';
        if (b.id) btn.id = b.id;
        btn.innerHTML = b.icon ? b.icon + ' ' + b.label : b.label;
        btn.addEventListener('click', b.onClick);
        row.appendChild(btn);
      });
      panel.appendChild(row);
      return row;
    }

    function addHint(text) {
      var hint = document.createElement('p');
      hint.className = 'lab-hint';
      hint.textContent = text;
      panel.appendChild(hint);
      return hint;
    }

    function addSeparator() {
      var sep = document.createElement('hr');
      sep.style.cssText = 'border:none;border-top:1px solid var(--clr-border);margin:0.25rem 0';
      panel.appendChild(sep);
    }

    return {
      panel:        panel,
      toggleBtn:    toggleBtn,
      addSlider:    addSlider,
      addSelect:    addSelect,
      addToggle:    addToggle,
      addButtons:   addButtons,
      addHint:      addHint,
      addSeparator: addSeparator,
    };
  }

  // ── Help popover ──────────────────────────────────────────────
  /**
   * createHelp(shortcuts)              — shortcuts: [[key, desc], ...]
   * createHelp(container, shortcuts)   — legacy signature
   */
  function createHelp(firstArg, secondArg) {
    var shortcuts = [];
    if (Array.isArray(firstArg)) {
      shortcuts = firstArg;
    } else if (firstArg && firstArg.nodeType && Array.isArray(secondArg)) {
      shortcuts = secondArg;
    }

    var btn = document.createElement('button');
    btn.className = 'lab-help-btn';
    btn.setAttribute('aria-label', 'Keyboard shortcuts');
    btn.textContent = '?';

    var pop = document.createElement('div');
    pop.className = 'lab-help-popover';
    pop.setAttribute('role', 'tooltip');

    var titleEl = document.createElement('strong');
    titleEl.textContent = 'Keyboard shortcuts';
    pop.appendChild(titleEl);

    shortcuts.forEach(function (pair) {
      var p = document.createElement('p');
      p.innerHTML = '<kbd style="background:var(--clr-surface-2);border:1px solid var(--clr-border);border-radius:3px;padding:0 4px;font-size:0.65rem">' + pair[0] + '</kbd>\u00a0' + pair[1];
      pop.appendChild(p);
    });

    document.body.appendChild(btn);
    document.body.appendChild(pop);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      pop.classList.toggle('open');
    });
    document.addEventListener('click', function () { pop.classList.remove('open'); });

    return { btn: btn, pop: pop };
  }

  // ── Fullscreen button ─────────────────────────────────────────
  /**
   * createFullscreenBtn(container) — optional container to target for fullscreen
   */
  function createFullscreenBtn(container) {
    var target = container || document.documentElement;

    var btn = document.createElement('button');
    btn.className = 'lab-btn lab-fullscreen-btn';
    btn.setAttribute('aria-label', 'Enter fullscreen');
    btn.title = 'Enter fullscreen (F)';
    btn.innerHTML = FS_ICON_ENTER;

    var wrap = document.createElement('div');
    wrap.className = 'lab-fullscreen';
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    if (!document.fullscreenEnabled) { btn.style.display = 'none'; return btn; }

    btn.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        (target.requestFullscreen ? target : document.documentElement).requestFullscreen().catch(function () {});
      } else {
        document.exitFullscreen().catch(function () {});
      }
    });

    document.addEventListener('fullscreenchange', function () {
      var isFS = !!document.fullscreenElement;
      btn.setAttribute('aria-label', isFS ? 'Exit fullscreen' : 'Enter fullscreen');
      btn.title = isFS ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)';
      btn.innerHTML = isFS ? FS_ICON_EXIT : FS_ICON_ENTER;
    });

    return btn;
  }

  // ── Keyboard binder ──────────────────────────────────────────
  /**
   * bindKeys(map)           — { 'Space': fn, 'KeyR': fn, ... } on document
   * bindKeys(p5, map)       — attaches via p.keyPressed for p5 experiments
   */
  function bindKeys(firstArg, secondArg) {
    var map;
    var p5 = null;

    if (firstArg && typeof firstArg.keyPressed !== 'undefined' && secondArg) {
      // p5 mode — but p.keyPressed is a function slot, not event
      // We'll use document keydown for consistency (works in both)
      map = secondArg;
    } else {
      map = firstArg;
    }

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var fn = map[e.code] || map[e.key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    });
  }

  // ── Theme sync ───────────────────────────────────────────────
  /**
   * syncTheme(callback) — calls callback() when theme changes
   * syncTheme(p5)       — calls p.redraw() when theme changes
   *
   * Also syncs theme from localStorage on call.
   */
  function syncTheme(callbackOrP5) {
    // Sync initial theme
    var t = localStorage.getItem('theme') || 'dark';
    document.documentElement.dataset.theme = t;

    // Watch for toggle events (dispatched by main site's theme toggle)
    document.addEventListener('themechange', function () {
      if (callbackOrP5 && typeof callbackOrP5 === 'function') {
        callbackOrP5();
      } else if (callbackOrP5 && typeof callbackOrP5.redraw === 'function') {
        callbackOrP5.redraw();
      }
    });

    // Also watch data-theme attribute mutation
    var observer = new MutationObserver(function () {
      if (callbackOrP5 && typeof callbackOrP5 === 'function') {
        callbackOrP5();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  // ── Expose globally ──────────────────────────────────────────
  global.LabUtils = {
    getCSSVar:          getCSSVar,
    getThemeColors:     getThemeColors,
    createCanvas:       createCanvas,
    initFullscreen:     initFullscreen,
    initPointer:        initPointer,
    initVisibilityPause: initVisibilityPause,
    exportPNG:          exportPNG,
    createDeltaTimer:   createDeltaTimer,
    createPanel:        createPanel,
    createHelp:         createHelp,
    createFullscreenBtn: createFullscreenBtn,
    bindKeys:           bindKeys,
    syncTheme:          syncTheme,
  };

}(window));

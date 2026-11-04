/**
 * lab-utils.js — Shared utilities for all Lab experiments
 *
 * Exposed as window.LabUtils (and window.Lab alias) for compatibility
 * with both vanilla JS and p5.js (plain script) experiments.
 *
 * Designed to be highly defensive and backward-compatible with both:
 *  - Single options object calls: addSlider({ label, min, max, value, step, onChange })
 *  - Positional argument calls: addSlider(label, min, max, value, step, onChange)
 *  - Flexible select option formats: ['a','b'] or [['val','text']] or [{value, label}] or { val: text }
 */

(function (global) {
  'use strict';

  // ── Safe execution wrapper ────────────────────────────────────
  function safe(fn, label) {
    try {
      return fn();
    } catch (err) {
      console.warn('[Lab.safe caught error in ' + (label || 'anonymous') + ']:', err);
      return null;
    }
  }

  // ── Theme helpers ────────────────────────────────────────────
  function getCSSVar(name, fallback) {
    if (fallback === undefined) fallback = '';
    try {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(name).trim() || fallback;
    } catch (e) {
      return fallback;
    }
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
  var MAX_DPR = 2;

  function createCanvas(first, second) {
    if (first && typeof first.createCanvas === 'function') {
      return _createP5Canvas(first, second);
    }
    return _createVanillaCanvas(first);
  }

  function _createP5Canvas(p, container) {
    if (!container) container = document.getElementById('sketch-container') || document.body;
    var w = container.clientWidth  || window.innerWidth;
    var h = container.clientHeight || (window.innerHeight - 48);
    var cnv = p.createCanvas(w, h);
    if (cnv && cnv.elt && container) {
      container.appendChild(cnv.elt);
      cnv.elt.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!container) return;
        var nw = container.clientWidth  || window.innerWidth;
        var nh = container.clientHeight || (window.innerHeight - 48);
        try { p.resizeCanvas(nw, nh); } catch (e) {}
      }, 100);
    });

    return cnv;
  }

  function _createVanillaCanvas(container) {
    if (!container) container = document.getElementById('sketch-container') || document.body;
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;';
    container.appendChild(canvas);

    var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    var w = 0, h = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      w = container.clientWidth  || window.innerWidth;
      h = container.clientHeight || window.innerHeight;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  // ── Fullscreen Icons ──────────────────────────────────────────
  var FS_ICON_ENTER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  var FS_ICON_EXIT  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>';

  function initFullscreen(btnOrTarget, optionalTarget) {
    var btn = null;
    var target = document.documentElement;

    if (btnOrTarget && btnOrTarget.tagName === 'BUTTON') {
      btn = btnOrTarget;
      target = optionalTarget || document.documentElement;
    } else if (btnOrTarget && btnOrTarget.nodeType) {
      target = btnOrTarget;
    }

    if (!document.fullscreenEnabled) {
      if (btn) btn.style.display = 'none';
      return;
    }

    if (btn) {
      btn.innerHTML = FS_ICON_ENTER;
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
    } else {
      // Direct call toggle
      if (!document.fullscreenElement) {
        (target.requestFullscreen ? target : document.documentElement).requestFullscreen().catch(function () {});
      } else {
        document.exitFullscreen().catch(function () {});
      }
    }
  }

  // ── Pointer input ─────────────────────────────────────────────
  function initPointer(el) {
    var ptr = { x: 0, y: 0, down: false, id: null };
    if (!el) return ptr;

    function update(e) {
      var r = el.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
    }

    el.addEventListener('pointerdown', function (e) {
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
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
  function initVisibilityPause(onHideOrP5, onShow) {
    if (onHideOrP5 && typeof onHideOrP5.noLoop === 'function') {
      var p = onHideOrP5;
      document.addEventListener('visibilitychange', function () {
        try {
          if (document.hidden) p.noLoop();
          else                 p.loop();
        } catch (e) {}
      });
    } else {
      document.addEventListener('visibilitychange', function () {
        try {
          if (document.hidden && typeof onHideOrP5 === 'function') onHideOrP5();
          else if (!document.hidden && typeof onShow === 'function') onShow();
        } catch (e) {}
      });
    }
  }

  // ── PNG export ────────────────────────────────────────────────
  function exportPNG(canvasOrElt, filename) {
    filename = filename || 'lab-export.png';
    var el = (canvasOrElt && canvasOrElt.elt) ? canvasOrElt.elt : canvasOrElt;
    if (!el || typeof el.toDataURL !== 'function') {
      el = document.querySelector('#sketch-container canvas') || document.querySelector('canvas');
    }
    if (!el || typeof el.toDataURL !== 'function') {
      console.warn('[LabUtils.exportPNG]: No valid canvas found.');
      return;
    }
    try {
      var link = document.createElement('a');
      link.download = (filename.endsWith('.png') ? filename : filename + '.png');
      link.href = el.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.warn('[LabUtils.exportPNG] Failed:', err);
    }
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
   * Helper: Normalize select options into an array of [value, text] pairs.
   * Accepts:
   *  - [['val', 'Text'], ...]
   *  - ['val1', 'val2', ...]
   *  - [{ value: 'val1', label: 'Text1' }, ...]
   *  - { 'val1': 'Text1', 'val2': 'Text2' }
   */
  function normalizeOptions(raw) {
    var pairs = [];
    if (!raw) return pairs;

    if (Array.isArray(raw)) {
      raw.forEach(function (item) {
        if (Array.isArray(item)) {
          pairs.push([String(item[0]), String(item[1] !== undefined ? item[1] : item[0])]);
        } else if (item && typeof item === 'object') {
          var val = item.value !== undefined ? item.value : (item.id !== undefined ? item.id : item.key);
          var lbl = item.label !== undefined ? item.label : (item.text !== undefined ? item.text : val);
          pairs.push([String(val), String(lbl)]);
        } else {
          // Primitive string / number
          pairs.push([String(item), String(item)]);
        }
      });
    } else if (typeof raw === 'object') {
      Object.keys(raw).forEach(function (k) {
        pairs.push([String(k), String(raw[k])]);
      });
    }
    return pairs;
  }

  /**
   * Creates the collapsible control panel.
   * Supports:
   *   createPanel('Controls')
   *   createPanel({ title: 'Controls' })
   *   createPanel(container, 'Controls')
   */
  function createPanel(firstArg, secondArg) {
    var title = 'Controls';

    if (typeof firstArg === 'string') {
      title = firstArg;
    } else if (firstArg && typeof firstArg === 'object') {
      if (firstArg.title) {
        title = firstArg.title;
      } else if (firstArg.nodeType) {
        title = secondArg || 'Controls';
      }
    }
    if (typeof secondArg === 'string') title = secondArg;

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

    /**
     * addSlider:
     * Accepts:
     *   addSlider({ label, min, max, value, step, onChange, format })
     *   addSlider(label, min, max, value, step, onChange, format)
     */
    function addSlider() {
      var opts = {};
      if (arguments.length === 1 && typeof arguments[0] === 'object') {
        opts = arguments[0];
      } else {
        opts = {
          label:    arguments[0],
          min:      arguments[1],
          max:      arguments[2],
          value:    arguments[3],
          step:     arguments[4],
          onChange: arguments[5],
          format:   arguments[6]
        };
      }

      var label = opts.label || '';
      var min   = opts.min !== undefined ? opts.min : 0;
      var max   = opts.max !== undefined ? opts.max : 100;
      var val   = opts.value !== undefined ? opts.value : min;
      var step  = opts.step !== undefined ? opts.step : 1;
      var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
      var format = typeof opts.format === 'function' ? opts.format : function (v) { return v; };

      var wrap = document.createElement('div');
      wrap.className = 'lab-control';

      var lbl = document.createElement('label');
      var valSpan = document.createElement('span');
      valSpan.textContent = format(val);
      lbl.textContent = label + '\u00a0';
      lbl.appendChild(valSpan);

      var input = document.createElement('input');
      input.type  = 'range';
      input.min   = min;
      input.max   = max;
      input.step  = step;
      input.value = val;
      input.addEventListener('input', function () {
        var v = parseFloat(input.value);
        valSpan.textContent = format(v);
        onChange(v);
      });

      wrap.appendChild(lbl);
      wrap.appendChild(input);
      panel.appendChild(wrap);
      return { input: input, valSpan: valSpan };
    }

    /**
     * addSelect:
     * Accepts:
     *   addSelect({ label, options, value, onChange })
     *   addSelect(label, options, value, onChange)
     */
    function addSelect() {
      var opts = {};
      if (arguments.length === 1 && typeof arguments[0] === 'object' && !Array.isArray(arguments[0])) {
        opts = arguments[0];
      } else {
        opts = {
          label:    arguments[0],
          options:  arguments[1],
          value:    arguments[2],
          onChange: arguments[3]
        };
      }

      var label = opts.label || '';
      var pairs = normalizeOptions(opts.options);
      var currentVal = opts.value !== undefined ? String(opts.value) : (pairs.length > 0 ? pairs[0][0] : '');
      var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};

      var wrap = document.createElement('div');
      wrap.className = 'lab-control';

      if (label) {
        var lbl = document.createElement('label');
        lbl.textContent = label;
        wrap.appendChild(lbl);
      }

      var sel = document.createElement('select');
      pairs.forEach(function (pair) {
        var opt = document.createElement('option');
        opt.value = pair[0];
        opt.textContent = pair[1];
        if (pair[0] === currentVal) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () {
        onChange(sel.value);
      });

      wrap.appendChild(sel);
      panel.appendChild(wrap);
      return sel;
    }

    /**
     * addToggle:
     * Accepts:
     *   addToggle({ label, checked, onChange })
     *   addToggle(label, checked, onChange)
     */
    function addToggle() {
      var opts = {};
      if (arguments.length === 1 && typeof arguments[0] === 'object') {
        opts = arguments[0];
      } else {
        opts = {
          label:    arguments[0],
          checked:  arguments[1],
          onChange: arguments[2]
        };
      }

      var label = opts.label || '';
      var checked = !!opts.checked;
      var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};

      var wrap = document.createElement('div');
      wrap.className = 'lab-control lab-control--toggle';

      var lbl = document.createElement('label');
      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = checked;
      chk.addEventListener('change', function () {
        onChange(chk.checked);
      });

      lbl.appendChild(chk);
      lbl.appendChild(document.createTextNode('\u00a0' + label));
      wrap.appendChild(lbl);
      panel.appendChild(wrap);
      return chk;
    }

    /**
     * addButtons:
     * Accepts: array of button specs [{ label, icon, onClick, id }]
     */
    function addButtons(buttons) {
      if (!Array.isArray(buttons)) return null;
      var row = document.createElement('div');
      row.className = 'lab-control-row';
      buttons.forEach(function (b) {
        if (!b) return;
        var btn = document.createElement('button');
        btn.className = 'lab-btn';
        if (b.id) btn.id = b.id;
        btn.innerHTML = b.icon ? b.icon + ' ' + (b.label || '') : (b.label || '');
        if (typeof b.onClick === 'function') {
          btn.addEventListener('click', b.onClick);
        }
        row.appendChild(btn);
      });
      panel.appendChild(row);
      return row;
    }

    function addHint(text) {
      var hint = document.createElement('p');
      hint.className = 'lab-hint';
      hint.textContent = text || '';
      panel.appendChild(hint);
      return hint;
    }

    function addSeparator() {
      var sep = document.createElement('hr');
      sep.style.cssText = 'border:none;border-top:1px solid var(--clr-border);margin:0.25rem 0';
      panel.appendChild(sep);
      return sep;
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
  function createHelp(firstArg, secondArg) {
    var shortcuts = [];
    if (Array.isArray(firstArg)) {
      shortcuts = firstArg;
    } else if (firstArg && firstArg.nodeType && Array.isArray(secondArg)) {
      shortcuts = secondArg;
    } else if (Array.isArray(secondArg)) {
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
      if (!Array.isArray(pair) || pair.length < 2) return;
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
  function bindKeys(firstArg, secondArg) {
    var map = (firstArg && typeof firstArg === 'object' && !secondArg) ? firstArg : (secondArg || {});

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var fn = map[e.code] || map[e.key];
      if (typeof fn === 'function') {
        e.preventDefault();
        fn(e);
      }
    });
  }

  // ── Theme sync ───────────────────────────────────────────────
  function syncTheme(callbackOrP5) {
    var t = localStorage.getItem('theme') || 'dark';
    document.documentElement.dataset.theme = t;

    function notify() {
      try {
        if (typeof callbackOrP5 === 'function') {
          callbackOrP5();
        } else if (callbackOrP5 && typeof callbackOrP5.redraw === 'function') {
          callbackOrP5.redraw();
        }
      } catch (err) {
        console.warn('[LabUtils.syncTheme notify error]:', err);
      }
    }

    document.addEventListener('themechange', notify);

    var observer = new MutationObserver(notify);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  // ── Expose globally ──────────────────────────────────────────
  var LabUtils = {
    safe:               safe,
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

  global.LabUtils = LabUtils;
  global.Lab      = LabUtils; // convenient alias

}(window));

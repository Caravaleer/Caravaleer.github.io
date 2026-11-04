/* ============================================================
   MAIN — Entry point (ES module)
   ============================================================ */
import { initCursor }   from './modules/cursor.js';
import { initScroll, initCountUp } from './modules/scroll.js';
import { initNav, initTheme, initMagnetic } from './modules/nav.js';
import { initProjects } from './modules/projects.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  initCursor();
  initScroll();
  initCountUp();
  initProjects();
  initMagnetic();
  initTicker();
  initPageTransition();
});

/* ── Duplicate ticker track for seamless loop ─────────────── */
function initTicker() {
  const track = document.querySelector('.ticker-track');
  if (!track) return;
  const clone = track.cloneNode(true);
  track.parentElement.appendChild(clone);
}

/* ── Page transition on internal links ───────────────────── */
function initPageTransition() {
  const overlay = document.getElementById('page-transition');
  if (!overlay) return;

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    // Only internal .html links
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
    if (!href.endsWith('.html') && !href.endsWith('/')) return;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.style.transition = 'transform 0.4s cubic-bezier(0.76,0,0.24,1)';
      overlay.style.transformOrigin = 'bottom';
      overlay.style.transform = 'scaleY(1)';
      setTimeout(() => { window.location.href = href; }, 420);
    });
  });

  // Animate out on load
  overlay.style.transformOrigin = 'top';
  overlay.style.transform = 'scaleY(1)';
  overlay.style.transition = 'none';
  requestAnimationFrame(() => {
    overlay.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s';
    overlay.style.transform = 'scaleY(0)';
  });
}

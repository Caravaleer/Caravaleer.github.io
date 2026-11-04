/* ============================================================
   CURSOR — Custom contextual cursor
   ============================================================ */
export function initCursor() {
  // Respect touch / reduced-motion
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cursor = document.getElementById('cursor');
  const dot    = document.getElementById('cursor-dot');
  if (!cursor || !dot) return;

  document.documentElement.classList.add('cursor-active');

  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;
  let raf;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Dot follows instantly
    dot.style.left = mouseX + 'px';
    dot.style.top  = mouseY + 'px';
  });

  // Cursor ring lerps toward mouse (smooth follow)
  function animate() {
    cursorX += (mouseX - cursorX) * 0.12;
    cursorY += (mouseY - cursorY) * 0.12;
    cursor.style.left = cursorX + 'px';
    cursor.style.top  = cursorY + 'px';
    raf = requestAnimationFrame(animate);
  }
  animate();

  // Context labels
  const labelEl = cursor.querySelector('#cursor-label');

  function setLabel(text) {
    if (!labelEl) return;
    if (text) {
      cursor.classList.add('has-label');
      labelEl.textContent = text;
    } else {
      cursor.classList.remove('has-label');
    }
  }

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-cursor]');
    if (target) {
      setLabel(target.dataset.cursor);
    } else if (e.target.closest('a, button')) {
      setLabel('');
      cursor.style.transform = 'translate(-50%,-50%) scale(1.5)';
    } else {
      setLabel('');
      cursor.style.transform = 'translate(-50%,-50%) scale(1)';
    }
  });

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
    dot.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
    dot.style.opacity = '1';
  });

  document.addEventListener('mousedown', () => { cursor.style.transform = 'translate(-50%,-50%) scale(0.8)'; });
  document.addEventListener('mouseup',   () => { cursor.style.transform = 'translate(-50%,-50%) scale(1)'; });
}


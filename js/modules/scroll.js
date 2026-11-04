/* ============================================================
   SCROLL — Reveal on scroll, progress bar, smooth scroll
   ============================================================ */
export function initScroll() {
  // Scroll progress bar
  const bar = document.getElementById('scroll-progress');
  if (bar) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      const total    = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${scrolled / total})`;
    }, { passive: true });
  }

  // Nav shrink on scroll
  const nav = document.querySelector('.site-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  // Intersection observer for .reveal elements
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length === 0) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  revealEls.forEach(el => io.observe(el));
}

/* Count-up animation for stat numbers */
export function initCountUp() {
  const statEls = document.querySelectorAll('[data-count]');
  if (!statEls.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el      = entry.target;
      const target  = parseFloat(el.dataset.count);
      const decimals= el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
      const dur     = 1800;
      const start   = performance.now();

      let textNode = null;
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) { textNode = node; break; }
      }
      if (!textNode) {
        textNode = document.createTextNode('');
        el.insertBefore(textNode, el.firstChild);
      }

      function step(now) {
        const progress = Math.min((now - start) / dur, 1);
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const val  = target * ease;
        textNode.textContent = val.toFixed(decimals);
        if (progress < 1) requestAnimationFrame(step);
        else textNode.textContent = target.toFixed(decimals);
      }
      requestAnimationFrame(step);
      io.unobserve(el);
    });
  }, { threshold: 0.5 });

  statEls.forEach(el => io.observe(el));
}

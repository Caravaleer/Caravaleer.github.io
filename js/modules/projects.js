/* ============================================================
   PROJECTS — Filter by category, modal detail view
   ============================================================ */
export function initProjects() {
  // ── Filter buttons ──
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards      = document.querySelectorAll('.project-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      cards.forEach(card => {
        const tags = card.dataset.tags || '';
        if (filter === 'all' || tags.includes(filter)) {
          card.removeAttribute('data-hidden');
          // Animate in
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          setTimeout(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = '';
          }, 10);
        } else {
          card.setAttribute('data-hidden', 'true');
        }
      });
    });
  });

  // ── Modal ──
  const backdrop = document.getElementById('project-modal-backdrop');
  const modal    = document.getElementById('project-modal');
  if (!backdrop || !modal) return;

  const closeBtn = modal.querySelector('.modal-close');

  cards.forEach(card => {
    card.addEventListener('click', () => openModal(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openModal(card);
    });
  });

  function openModal(card) {
    // Populate modal content
    const title    = card.querySelector('.project-card-title')?.textContent || '';
    const desc     = card.querySelector('.project-card-desc')?.textContent || '';
    const problem  = card.dataset.problem || '';
    const approach = card.dataset.approach || '';
    const stack    = card.dataset.stack || '';
    const github   = card.dataset.github || '';
    const live     = card.dataset.live || '';
    const status   = card.dataset.status || '';

    modal.querySelector('#modal-title').textContent = title;
    modal.querySelector('#modal-desc').textContent  = desc;

    const problemEl  = modal.querySelector('#modal-problem');
    const approachEl = modal.querySelector('#modal-approach');
    const stackEl    = modal.querySelector('#modal-stack');
    const linksEl    = modal.querySelector('#modal-links');
    const statusEl   = modal.querySelector('#modal-status');

    if (problemEl)  problemEl.textContent  = problem;
    if (approachEl) approachEl.textContent = approach;
    if (stackEl)    stackEl.textContent    = stack;
    if (statusEl)   statusEl.textContent   = status || '';

    if (linksEl) {
      linksEl.innerHTML = '';
      if (github) {
        linksEl.innerHTML += `<a href="${github}" target="_blank" rel="noopener" class="btn btn-outline">↗ GitHub</a>`;
      }
      if (live) {
        linksEl.innerHTML += `<a href="${live}" target="_blank" rel="noopener" class="btn btn-primary">↗ Live Demo</a>`;
      }
    }

    backdrop.classList.add('open');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn?.focus();
  }

  function closeModal() {
    backdrop.classList.remove('open');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  backdrop.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  // Focus trap inside modal
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = modal.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
}


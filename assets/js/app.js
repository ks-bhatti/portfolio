/* Site behavior is dependency-free. Three.js and all scene settings live in scene.js. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const themeToggle = document.querySelector('.theme-toggle');
  function updateTheme() {
    const dark = root.dataset.theme === 'dark';
    themeToggle?.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    themeToggle?.setAttribute('title', `Switch to ${dark ? 'light' : 'dark'} theme`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111b18' : '#f7f8f2');
    window.dispatchEvent(new CustomEvent('portfolio:theme', { detail: { theme: root.dataset.theme } }));
  }
  updateTheme();
  themeToggle?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('portfolio-theme', root.dataset.theme); } catch { /* Storage can be disabled. */ }
    updateTheme();
  });

  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  const closeMenu = () => {
    if (!menuButton || !mobileNav) return;
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
  };
  menuButton?.addEventListener('click', () => {
    const opening = menuButton.getAttribute('aria-expanded') !== 'true';
    mobileNav.hidden = !opening;
    menuButton.setAttribute('aria-expanded', String(opening));
    menuButton.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
  });
  mobileNav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') { closeMenu(); menuButton.focus(); }
  });
  window.matchMedia('(min-width: 651px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  // Only enhance offscreen sections, so a failed script cannot hide initial content.
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
    }), { threshold: 0.06, rootMargin: '0px 0px 20px 0px' });
    document.querySelectorAll('.reveal').forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add('reveal-pending');
      revealObserver.observe(element);
    });
    reducedMotion.addEventListener('change', event => {
      if (event.matches) { document.querySelectorAll('.reveal-pending').forEach(el => el.classList.add('is-visible')); revealObserver.disconnect(); }
    });
  }
  if ('IntersectionObserver' in window) {
    const activeObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) document.querySelectorAll('.desktop-nav a').forEach(link => {
        const active = link.getAttribute('href') === `#${entry.target.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    }), { rootMargin: '-15% 0px -65% 0px' });
    document.querySelectorAll('main section[id]').forEach(section => activeObserver.observe(section));
  }

  // Small pointer-only tilt. Touch scrolling and reduced motion remain native.
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (!finePointer.matches || reducedMotion.matches || event.pointerType === 'touch') return;
      const box = card.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - .5;
      const y = (event.clientY - box.top) / box.height - .5;
      card.style.transform = `perspective(1200px) rotateX(${-y * 3}deg) rotateY(${x * 3}deg)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    card.addEventListener('focusout', () => { card.style.transform = ''; });
  });

  // The CV request link becomes a download automatically when the real file exists.
  // Directory inspection is avoided. A successful PDF content-type check is required.
  async function checkCV() {
    try {
      const response = await fetch('assets/cv.pdf', { method: 'HEAD', cache: 'no-cache' });
      if (!response.ok || !response.headers.get('content-type')?.includes('pdf')) return;
      const link = document.querySelector('.cv-link');
      if (!link) return;
      link.href = 'assets/cv.pdf';
      link.setAttribute('download', 'M-Kamran-Saleem-CV.pdf');
      link.querySelector('span').textContent = 'Download CV';
      document.querySelector('#cv-note').textContent = 'Download M. Kamran Saleem’s CV as a PDF.';
    } catch { /* The contact option remains available offline. */ }
  }
  // Set this flag when adding assets/cv.pdf to avoid requesting a missing file.
  const CV_AVAILABLE = false;
  if (CV_AVAILABLE) checkCV();
  const year = document.querySelector('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  const projects = {
    bis: { title: 'BIS Connect', type: 'LIVE PRODUCT / SAAS', description: 'A multi-tenant SaaS billing platform for internet service providers, independently built and shipped.', points: ['Live with 250+ paying subscribers.', 'Three role-based Flutter apps backed by Laravel and PostgreSQL.', 'MikroTik API integration for ISP operations.', 'Multi-gateway payments through JazzCash, EasyPaisa, and Raast P2M.', 'Incorporated as BIS Connect (SMC-Private) Limited with SECP in August 2026.'], tags: ['Flutter', 'Laravel', 'PostgreSQL', 'MikroTik API', 'Payment gateways'], url: 'https://ks-bhatti.github.io/bis-connect-web/' },
    virtuo: { title: 'VirtuoMate', type: 'FINAL YEAR PROJECT / AI', description: 'An AI career coaching platform built as my final year project at the University of Central Punjab.', points: ['11 modules for AI-assisted career coaching.', 'Voice sessions using speech-to-text and text-to-speech.', 'Node.js with Gemini API, GPT-4, and Firebase.', 'All 18 of 18 test cases passed.', 'A grades in both final year project phases.'], tags: ['Node.js', 'Gemini API', 'GPT-4', 'Firebase', 'STT / TTS'] },
    metro: { title: 'MetroGo', type: 'MOBILE / CITY NAVIGATION', description: 'A city metro navigation app built with Flutter and Firebase.', points: ['Route finder to support metro travel.', 'QR ticketing in the mobile app.', 'Real-time updates for the journey.'], tags: ['Flutter', 'Firebase', 'QR ticketing'] },
    commerce: { title: 'E-Commerce Platform', type: 'FREELANCE / FULL-STACK', description: 'A full-stack e-commerce platform built as a freelance project.', points: ['Inventory management for product operations.', 'Multiple payment gateway integrations.', 'An end-to-end full-stack implementation.'], tags: ['Full-stack development', 'Inventory management', 'Payment gateways'] },
    cloud: { title: 'Cloud Cost Anomaly Detection', type: 'RESEARCH / MACHINE LEARNING', description: 'An IEEE-format research article exploring machine learning for unusual cloud spending.', points: ['Python implementation using LSTM and Autoencoder models.', '91% precision in anomaly detection.', 'Research written in IEEE format.'], tags: ['Python', 'LSTM', 'Autoencoder', 'Research'] },
    medialert: { title: 'MediAlert', type: 'SERVERLESS / HEALTHCARE', description: 'A serverless healthcare alerting project built on AWS.', points: ['AWS Lambda for serverless execution.', 'API Gateway for application endpoints.', 'DynamoDB for storage and Cognito for user access.'], tags: ['AWS Lambda', 'API Gateway', 'DynamoDB', 'Cognito'] }
  };
  const dialog = document.querySelector('#project-dialog');
  let dialogOpener;
  document.querySelectorAll('[data-open-project]').forEach(button => button.addEventListener('click', () => {
    const project = projects[button.dataset.openProject];
    if (!dialog || !project) return;
    dialogOpener = button;
    document.querySelector('#dialog-title').textContent = project.title;
    document.querySelector('#dialog-type').textContent = project.type;
    document.querySelector('#dialog-description').textContent = project.description;
    document.querySelector('#dialog-points').replaceChildren(...project.points.map(point => { const li = document.createElement('li'); li.textContent = point; return li; }));
    document.querySelector('#dialog-tags').replaceChildren(...project.tags.map(tag => { const span = document.createElement('span'); span.textContent = tag; return span; }));
    const actions = document.querySelector('#dialog-actions');
    actions.replaceChildren();
    if (project.url) {
      const live = document.createElement('a'); live.href = project.url; live.target = '_blank'; live.rel = 'noopener noreferrer'; live.className = 'button'; live.textContent = 'Visit live project ↗'; actions.append(live);
    }
    const contact = document.createElement('a'); contact.href = `mailto:kamransaleem384@gmail.com?subject=${encodeURIComponent(`Tell me about ${project.title}`)}`; contact.className = project.url ? 'text-link' : 'button'; contact.textContent = 'Ask about this project ↗'; actions.append(contact);
    dialog.showModal(); document.body.classList.add('dialog-open');
  }));
  dialog?.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
  dialog?.addEventListener('close', () => { document.body.classList.remove('dialog-open'); dialogOpener?.focus(); });
})();

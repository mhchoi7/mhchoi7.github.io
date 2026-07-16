document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('.nav-toggle');
  const links = nav ? Array.from(nav.querySelectorAll('a[href^="#"]')) : [];
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);

  const setNavOpen = (open) => {
    if (!nav || !toggle) return;
    nav.dataset.open = open ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', String(open));
  };

  const closeIfMobile = () => {
    if (window.matchMedia('(max-width: 720px)').matches) {
      setNavOpen(false);
    }
  };

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      setNavOpen(nav.dataset.open !== 'true');
    });
  }

  nav?.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.setAttribute('tabindex', '-1');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
    history.replaceState(null, '', link.getAttribute('href'));
    closeIfMobile();
  });

  document.addEventListener('click', (event) => {
    if (!nav || !toggle) return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    closeIfMobile();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setNavOpen(false);
  });

  const markActive = () => {
    if (!sections.length) return;
    const offset = window.innerHeight * 0.33;
    let activeId = sections[0].id;

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= offset) activeId = section.id;
    });

    links.forEach((link) => {
      const active = link.getAttribute('href') === `#${activeId}`;
      link.classList.toggle('is-active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
  };

  if (window.SnakeGame) {
    const game = new window.SnakeGame({
      canvas: document.querySelector('#snake-canvas'),
      scoreEl: document.querySelector('[data-score]'),
      highScoreEl: document.querySelector('[data-high-score]'),
      statusEl: document.querySelector('[data-game-status]'),
      actionButtons: Array.from(document.querySelectorAll('[data-action]')),
      directionButtons: Array.from(document.querySelectorAll('[data-direction]')),
    });

    game.mount();
    window.__snakeGame = game;
  }

  if (window.DodgerGame) {
    const game = new window.DodgerGame({
      canvas: document.querySelector('#dodger-canvas'),
      scoreEl: document.querySelector('[data-dodger-score]'),
      highScoreEl: document.querySelector('[data-dodger-high-score]'),
      statusEl: document.querySelector('[data-dodger-status]'),
      actionButtons: Array.from(document.querySelectorAll('[data-dodger-action]')),
      directionButtons: Array.from(document.querySelectorAll('[data-dodger-direction]')),
    });

    game.mount();
    window.__dodgerGame = game;
  }

  markActive();
  window.addEventListener('scroll', markActive, { passive: true });
  window.addEventListener('resize', markActive);
});

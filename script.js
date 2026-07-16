document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  nav.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: false });
  });
});

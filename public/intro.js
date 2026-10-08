/* Zion Clothing | abertura independente da loja.
   Exibida a cada carregamento completo, com opção PULAR. */
(() => {
  const overlay = document.getElementById('zionIntro');
  if (!overlay) return;
  const prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    overlay.remove();
    return;
  }

  let finished = false;
  const timers = [];
  const onEscape = event => { if (event.key === 'Escape') finish(); };

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(window.clearTimeout);
    document.removeEventListener('keydown', onEscape);
    overlay.classList.add('is-exiting');
    document.body.classList.remove('zion-intro-lock');
    window.setTimeout(() => overlay.remove(), 850);
  }

  overlay.hidden = false;
  document.body.classList.add('zion-intro-lock');
  document.getElementById('skipZionIntro')?.addEventListener('click', finish, { once: true });
  document.addEventListener('keydown', onEscape);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => overlay.classList.add('is-typing'));
  });
  timers.push(window.setTimeout(() => overlay.classList.add('is-forming'), 3550));
  timers.push(window.setTimeout(() => overlay.classList.add('is-wordmark'), 4450));
  timers.push(window.setTimeout(finish, 6200));
})();

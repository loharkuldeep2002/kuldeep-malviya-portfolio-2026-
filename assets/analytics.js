(() => {
  'use strict';

  const path = `${location.pathname || '/'}`.slice(0, 180);
  function send(event) {
    fetch('/api/analytics/event', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, path })
    }).catch(() => {});
  }

  send(/^\/project\/[a-z0-9-]+$/.test(path) ? 'project_view' : 'page_view');

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href === '#contact' || href === '/#contact' || href === '/contact' || href.startsWith('mailto:')) send('cta_click');
  }, true);

  document.getElementById('contactForm')?.addEventListener('submit', (event) => {
    const valid = [
      document.getElementById('name')?.value.trim(),
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById('email')?.value.trim() || ''),
      document.getElementById('service')?.value,
      document.getElementById('budget')?.value,
      (document.getElementById('message')?.value.trim().length || 0) > 3
    ].every(Boolean);
    if (valid) send('contact_intent');
  }, true);
})();

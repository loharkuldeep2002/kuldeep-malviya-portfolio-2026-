/* Shared artwork viewer. Images retain their natural aspect ratio. */
(() => {
  'use strict';
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  function carousel(project) {
    const items = [{ url: project.cover, alt: project.coverAlt || project.title }, ...(project.gallery || [])]
      .filter((item, index, list) => item.url && list.findIndex(other => other.url === item.url) === index);
    const host = make('section', 'art-carousel');
    host.setAttribute('aria-label', project.title + ' images');
    const stage = make('figure', 'art-stage');
    const image = make('img');
    const caption = make('figcaption', 'art-count');
    image.decoding = 'async';
    stage.append(image);
    const controls = make('div', 'art-controls');
    const previous = make('button', '', '←');
    const next = make('button', '', '→');
    previous.type = next.type = 'button';
    previous.setAttribute('aria-label', 'Previous image');
    next.setAttribute('aria-label', 'Next image');
    caption.setAttribute('aria-live', 'polite');
    controls.append(previous, caption, next);
    controls.hidden = items.length < 2;
    let current = 0;
    const show = delta => {
      if (!items.length) return;
      current = (current + delta + items.length) % items.length;
      image.src = items[current].url.startsWith('assets/') ? '/' + items[current].url : items[current].url;
      image.alt = items[current].alt || project.title + ' — image ' + (current + 1);
      caption.textContent = `${current + 1} / ${items.length}`;
    };
    previous.addEventListener('click', () => show(-1));
    next.addEventListener('click', () => show(1));
    host.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); show(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    host.tabIndex = 0;
    let touchX;
    image.addEventListener('touchstart', event => { touchX = event.changedTouches[0].clientX; }, { passive: true });
    image.addEventListener('touchend', event => {
      const dx = event.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 60) show(dx < 0 ? 1 : -1);
    }, { passive: true });
    image.addEventListener('error', () => {
      image.alt = 'Image unavailable — ' + project.title;
    });
    host.append(stage, controls);
    show(0);
    return host;
  }
  window.KMArtwork = { carousel };

  let dialog, opener;
  const cache = new Map();
  document.addEventListener('click', async event => {
    if (location.protocol === 'file:') return;
    const link = event.target.closest('#work a[data-project-slug]');
    if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!dialog) {
      dialog = make('dialog', 'art-dialog');
      dialog.setAttribute('aria-labelledby', 'artTitle');
      document.body.append(dialog);
      dialog.addEventListener('keydown', event => {
        if (event.defaultPrevented || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        const controls = dialog.querySelector('.art-controls');
        if (!controls || controls.hidden) return;
        event.preventDefault();
        controls.querySelector(event.key === 'ArrowLeft' ? 'button:first-child' : 'button:last-child').click();
      });
      dialog.addEventListener('close', () => {
        document.body.classList.remove('art-open');
        opener?.focus({ preventScroll: true });
      });
      dialog.addEventListener('click', e => { if (e.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close();
      } });
    }
    opener = link;
    const head = make('header', 'art-dialog-head');
    const title = make('h2', '', 'Loading project…'); title.id = 'artTitle';
    const close = make('button', 'art-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close project');
    close.addEventListener('click', () => dialog.close());
    head.append(title, close); dialog.replaceChildren(head);
    dialog.showModal(); document.body.classList.add('art-open');
    dialog.scrollTop = 0;
    const slug = link.dataset.projectSlug;
    try {
      let project = cache.get(slug);
      if (!project) {
        const response = await fetch('/api/projects/' + encodeURIComponent(slug));
        if (!response.ok) throw new Error('Project unavailable');
        project = (await response.json()).project; cache.set(slug, project);
      }
      if (!dialog.open || opener !== link) return;
      title.textContent = project.title;
      const details = make('div', 'art-description');
      details.append(make('p', '', project.shortDescription));
      const full = make('a', 'btn btn-primary', 'View full case study ↗'); full.href = link.href;
      details.append(full);
      dialog.append(carousel(project), details);
    } catch {
      title.textContent = 'Preview unavailable';
      const full = make('a', 'btn btn-primary', 'Open case study ↗'); full.href = link.href;
      dialog.append(full);
    }
  });
})();

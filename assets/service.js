/* ==========================================================================
   Service detail page — published service content + related projects.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.getElementById('serviceDetail');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const FALLBACK_IMAGE =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B171B"/><stop offset="1" stop-color="#162A2C"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><g fill="none" stroke="#C9FF20" stroke-opacity=".3"><rect x="60" y="60" width="1080" height="780"/></g><text x="600" y="480" text-anchor="middle" font-family="Manrope, Arial" font-size="64" font-weight="800" fill="#F4F7F3" opacity=".85">KM</text></svg>`
    );

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    });
    children.filter(Boolean).forEach((child) => node.append(child.nodeType ? child : document.createTextNode(String(child))));
    return node;
  }

  function img(src, alt) {
    const image = el('img', { src: src || FALLBACK_IMAGE, alt: alt || '', loading: 'lazy', decoding: 'async' });
    image.addEventListener('error', () => { image.src = FALLBACK_IMAGE; }, { once: true });
    return image;
  }

  function setMeta(service) {
    document.title = service.seoTitle || `${service.name} — Kuldeep Malviya`;
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = el('meta', { name: 'description' });
      document.head.append(desc);
    }
    desc.setAttribute('content', service.seoDescription || service.summary || '');
  }

  function render(data) {
    const service = data.service;
    document.body.dataset.pageLoading = 'false';
    setMeta(service);
    root.textContent = '';

    if (data.preview) {
      root.append(
        el('div', { class: 'preview-banner' },
          el('span', { text: 'Draft preview — only visible to signed-in admins' }),
          el('a', { href: '/admin', text: 'Back to dashboard ↗' })
        )
      );
    }

    const hero = el(
      'section',
      { class: 'service-hero' },
      el(
        'div',
        {},
        el('div', { class: 'case-meta mono' },
          el('span', { text: 'Service' }),
          el('span', { class: 'dot', 'aria-hidden': 'true' }),
          el('span', { text: service.priceLabel })
        ),
        el('h1', { text: service.name }),
        el('p', { class: 'case-lede', text: service.summary })
      ),
      el('figure', { class: 'service-cover' }, img(service.cover, service.coverAlt))
    );

    const left = el(
      'div',
      {},
      el('span', { class: 'service-price' }, service.priceLabel),
      el('h2', { text: 'About this service' }),
      el('p', { text: service.description }),
      service.idealFor ? el('h2', { text: 'Ideal for', style: 'margin-top:28px' }) : null,
      service.idealFor ? el('p', { text: service.idealFor }) : null,
      el(
        'div',
        { class: 'service-cta-row' },
        el('a', { class: 'btn btn-primary', href: ['/#contact', '#contact'].includes(service.ctaHref) ? '/contact' : (service.ctaHref || '/contact') }, service.ctaLabel || 'Start a project', el('span', { class: 'arr', 'aria-hidden': 'true', text: '↗' })),
        el('a', { class: 'btn btn-ghost', href: '/#work' }, 'See selected work', el('span', { class: 'arr', 'aria-hidden': 'true', text: '→' }))
      )
    );

    const right = el('div');
    if (service.included && service.included.length) {
      right.append(
        el('h2', { text: 'What is included' }),
        el('ul', { class: 'case-list' }, ...service.included.map((item) => el('li', { text: item })))
      );
    }
    if (service.process && service.process.length) {
      right.append(
        el('h2', { text: 'Process', style: 'margin-top:30px' }),
        el(
          'ol',
          { class: 'process-mini' },
          ...service.process.map((step, index) =>
            el('li', {},
              el('span', { class: 'num', text: String(index + 1).padStart(2, '0') }),
              el('div', {}, el('h3', { text: step.title }), step.description ? el('p', { text: step.description }) : null)
            )
          )
        )
      );
    }

    root.append(hero, el('div', { class: 'service-detail' }, left, right));

    if (data.relatedProjects && data.relatedProjects.length) {
      root.append(
        el('section', { 'aria-label': 'Relevant projects' },
          el('h2', { text: 'Relevant work', style: 'margin-bottom:20px' }),
          el(
            'div',
            { class: 'related-work' },
            ...data.relatedProjects.map((project) =>
              el('a', { class: 'related-card', href: `/project/${project.slug}` },
                img(project.cover, project.coverAlt),
                el('div', { class: 'related-body' },
                  el('h3', { text: project.title }),
                  el('p', { text: `${project.category || ''}${project.year ? ` · ${project.year}` : ''}` })
                )
              )
            )
          )
        )
      );
    }
  }

  function renderMissing(message) {
    root.textContent = '';
    root.append(
      el('div', { class: 'state-box' },
        el('h1', { text: 'Service not found' }),
        el('p', { text: message || 'This service is unavailable or has not been published.' }),
        el('a', { class: 'btn btn-primary', href: '/services' }, 'View services', el('span', { class: 'arr', 'aria-hidden': 'true', text: '↗' }))
      )
    );
  }

  async function init() {
    document.body.dataset.pageLoading = 'true';
    const parts = location.pathname.split('/').filter(Boolean);
    const slug = parts[0] === 'services' ? parts[1] : new URLSearchParams(location.search).get('slug');
    if (!slug) {
      renderMissing('No service was specified.');
      return;
    }
    try {
      const preview = new URLSearchParams(location.search).get('preview') === '1' ? '?preview=1' : '';
      const response = await fetch(`/api/services/${encodeURIComponent(slug)}${preview}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        renderMissing(payload.error);
        return;
      }
      render(await response.json());
    } catch (err) {
      renderMissing('The service could not be loaded. Please try again.');
    }
  }

  init();
})();

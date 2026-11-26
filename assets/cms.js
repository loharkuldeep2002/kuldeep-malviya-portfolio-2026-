/* ==========================================================================
   Public site content loader.
   - Static HTML stays as the no-JS fallback.
   - Published content from /api/site replaces editable copy, projects,
     services and navigation.
   ========================================================================== */
(() => {
  'use strict';

  const FALLBACK_IMAGE =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B171B"/><stop offset="1" stop-color="#162A2C"/></linearGradient></defs><rect width="1400" height="1000" fill="url(#g)"/><g fill="none" stroke="#C9FF20" stroke-opacity=".28"><rect x="70" y="70" width="1260" height="860"/><path d="M70 250h1260M70 760h1260"/></g><text x="700" y="540" text-anchor="middle" font-family="Manrope, Arial" font-size="72" font-weight="800" fill="#F4F7F3" opacity=".85">KM</text></svg>`
    );

  const ARROW =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12 12 4M5.5 4H12v6.5" /></svg>';

  const SERVICE_ICONS = [
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="m11 2.5 8.5 5v10L11 22l-8.5-4.5v-10L11 2.5Z" /><path d="M2.5 7.5 11 12.4l8.5-4.9M11 12.4V22" /></svg>',
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="3.8" width="18" height="14.4" rx="2" /><path d="M2 8.2h18M5 6h.01M7.4 6h.01" stroke-linecap="round" /></svg>',
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="11" cy="11" r="8.6" /><path d="m15.2 6.8-2.4 6-6 2.4 2.4-6 6-2.4Z" stroke-linejoin="round" /></svg>',
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="m11 2.2 7.5 4.2v7.2L11 17.8 2.5 13.6V6.4L11 2.2Z" /><path d="M2.5 6.4 10 10.6l7.5-4.2M10 10.6v7.2" /></svg>',
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="11" cy="11" r="8.6" /><path d="M11 6.4v9.2M6.4 11h9.2" stroke-linecap="round" /></svg>',
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 4h16v14H3z" /><path d="M3 8h16M7 12h8M7 15h5" stroke-linecap="round" /></svg>'
  ];

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else node.setAttribute(key, value);
    });
    children.filter(Boolean).forEach((child) => node.append(child.nodeType ? child : document.createTextNode(String(child))));
    return node;
  }

  function image(src, alt) {
    const img = el('img', { src: src || FALLBACK_IMAGE, alt: alt || '', loading: 'lazy', decoding: 'async' });
    img.addEventListener('error', () => { img.src = FALLBACK_IMAGE; }, { once: true });
    return img;
  }

  function bindText(key, value) {
    if (value === undefined || value === null) return;
    document.querySelectorAll(`[data-bind="${key}"]`).forEach((node) => {
      node.textContent = String(value);
    });
  }

  function applyContent(content) {
    if (!content) return;
    const hero = content.hero || {};
    bindText('hero.eyebrow', hero.eyebrow);
    bindText('hero.titleLead', hero.titleLead);
    bindText('hero.titleBreak', hero.titleBreak);
    bindText('hero.titleAccent', hero.titleAccent);
    bindText('hero.lede', hero.lede);
    bindText('hero.primaryCtaLabel', hero.primaryCtaLabel);
    bindText('hero.secondaryCtaLabel', hero.secondaryCtaLabel);
    document.querySelectorAll('.hero-actions').forEach((group) => {
      const links = group.querySelectorAll('a');
      if (links[0] && hero.primaryCtaHref) links[0].setAttribute('href', hero.primaryCtaHref);
      if (links[1] && hero.secondaryCtaHref) links[1].setAttribute('href', hero.secondaryCtaHref);
    });

    const statsHost = document.querySelector('.hero-stats');
    if (statsHost && Array.isArray(hero.stats) && hero.stats.length) {
      statsHost.textContent = '';
      hero.stats.forEach((stat) => {
        const strong = el('strong', { text: stat.value });
        const match = /^(.*[0-9])(\+)$/.exec(stat.value || '');
        if (match) {
          strong.textContent = match[1];
          strong.append(el('em', { text: '+' }));
        }
        statsHost.append(el('div', { class: 'stat' }, el('dt', {}, strong), el('dd', { text: stat.label })));
      });
    }

    const about = content.about || {};
    bindText('about.label', about.label);
    bindText('about.titleLead', about.titleLead);
    bindText('about.titleAccent', about.titleAccent);
    bindText('about.lede', about.lede);
    bindText('about.quote', about.quote);
    bindText('about.signature', about.signature);
    bindText('about.note', about.note);
    const infoValues = document.querySelectorAll('.about-info .info-row');
    if (infoValues[0]) infoValues[0].lastElementChild.textContent = about.based || '';
    if (infoValues[1]) infoValues[1].lastElementChild.textContent = about.focus || '';
    if (infoValues[2]) {
      const cell = infoValues[2].lastElementChild;
      cell.textContent = '';
      cell.append(el('i', { class: 'dot', 'aria-hidden': 'true' }), document.createTextNode(` ${about.status || ''}`));
    }

    const contact = content.contact || {};
    const contactHeading = document.querySelector('.contact-info h2');
    if (contactHeading && contact.heading) contactHeading.textContent = contact.heading;
    const contactCopy = document.querySelector('.contact-info > p');
    if (contactCopy && contact.copy) contactCopy.textContent = contact.copy;
    const contactLines = document.querySelectorAll('.contact-details .contact-line');
    if (contactLines[0]) {
      const link = contactLines[0].querySelector('a');
      if (link && contact.email) {
        link.textContent = contact.email;
        link.href = `mailto:${contact.email}`;
      }
    }
    if (contactLines[1] && contact.location) contactLines[1].lastElementChild.textContent = contact.location;
    if (contactLines[2] && contact.responseTime) contactLines[2].lastElementChild.textContent = contact.responseTime;
    document.querySelectorAll('.contact-meta').forEach((node) => {
      if (contact.availability) {
        node.textContent = '';
        node.append(el('span', { class: 'dot', 'aria-hidden': 'true' }), document.createTextNode(` ${contact.availability}`));
      }
    });
    const contactNote = document.querySelector('#contact .section-head .section-note');
    if (contactNote && contact.note) contactNote.textContent = contact.note;

    const badge = document.querySelector('.avail-badge span:last-child');
    if (badge && content.availabilityBadge) badge.textContent = content.availabilityBadge;

    const footer = content.footer || {};
    const footerDesc = document.querySelector('.footer-brand > p');
    if (footerDesc && footer.description) footerDesc.textContent = footer.description;
    const footerLoc = document.querySelector('.footer-loc');
    if (footerLoc && footer.location) footerLoc.textContent = footer.location;
    const statement = document.querySelector('.footer-statement p');
    if (statement && (footer.statementLead || footer.statementAccent)) {
      statement.textContent = `${footer.statementLead || ''} `;
      statement.append(el('span', { class: 'lime', text: footer.statementAccent || '' }));
    }
    const statementNote = document.querySelector('.footer-statement > span');
    if (statementNote && footer.statementNote) statementNote.textContent = footer.statementNote;
    const footerBottom = document.querySelectorAll('.footer-bottom > span');
    if (footerBottom[0] && footer.copyright) footerBottom[0].textContent = footer.copyright;
    if (footerBottom[1] && footer.builtNote) footerBottom[1].textContent = footer.builtNote;
  }

  function applySeo(seo) {
    if (!seo) return;
    if (seo.title) document.title = seo.title;
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = el('meta', { name: 'description' });
      document.head.append(desc);
    }
    if (seo.description) desc.setAttribute('content', seo.description);
    if (seo.noindex) {
      let robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = el('meta', { name: 'robots' });
        document.head.append(robots);
      }
      robots.setAttribute('content', 'noindex, nofollow');
    }
    if (seo.shareImage) {
      let og = document.querySelector('meta[property="og:image"]');
      if (!og) {
        og = el('meta', { property: 'og:image' });
        document.head.append(og);
      }
      og.setAttribute('content', new URL(seo.shareImage, location.origin).href);
    }
  }

  function renderNav(nav) {
    if (!nav) return;
    const primary = document.querySelector('.site-nav');
    if (primary && Array.isArray(nav.primary)) {
      primary.textContent = '';
      nav.primary.forEach((link) => primary.append(el('a', { href: link.href, text: link.label })));
    }
    const mobile = document.querySelector('.mobile-menu nav');
    if (mobile && Array.isArray(nav.primary)) {
      mobile.textContent = '';
      nav.primary.forEach((link, index) => {
        mobile.append(
          el('a', { class: 'menu-link', href: link.href }, document.createTextNode(link.label + ' '), el('span', { text: String(index + 1).padStart(2, '0') }))
        );
      });
    }
    const footerColumns = document.querySelector('.footer-top');
    if (footerColumns && Array.isArray(nav.footer)) {
      footerColumns.querySelectorAll('.footer-col').forEach((col) => col.remove());
      nav.footer.forEach((column) => {
        const list = el('ul');
        (column.links || []).forEach((link) => {
          const external = /^https?:/i.test(link.href);
          list.append(
            el('li', {},
              el('a', {
                href: link.href,
                ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})
              }, link.label, external ? el('span', { 'aria-hidden': 'true', text: ' ↗' }) : null)
            )
          );
        });
        footerColumns.append(el('div', { class: 'footer-col' }, el('h3', { text: column.title }), list));
      });
    }
  }

  function projectCard(project) {
    return el('a', { class: 'project', href: '/project/' + project.slug,
      'data-project-slug': project.slug, 'aria-label': 'Open ' + project.title + ' project', 'data-reveal': ''
    }, el('div', { class: 'project-media' }, image(project.cover, project.coverAlt || project.title)));
  }

  function renderProjects(projects) {
    if (!Array.isArray(projects)) return;
    const section = document.getElementById('work');
    if (!section) return;
    const grid = section.querySelector('.work-grid');
    const total = projects.length;
    if (grid) {
      grid.textContent = '';
      projects.forEach((project, index) => grid.append(projectCard(project, index, total)));
    }
    const note = section.querySelector('.work-note');
    if (note) note.hidden = false;
    dispatchUpdate(section);
  }

  function serviceCard(service, index) {
    const icon = SERVICE_ICONS[index % SERVICE_ICONS.length];
    const foot = el(
      'div',
      { class: 'service-foot' },
      el('span', { text: (service.included || []).slice(0, 3).join(' · ') }),
      el('a', { class: 'service-more', href: `/services/${service.slug}` }, 'Details', el('span', { 'aria-hidden': 'true', text: '↗' }))
    );
    return el(
      'article',
      { class: 'service-card', 'data-reveal': '', 'data-service-slug': service.slug },
      el('div', { class: 'service-top' },
        el('span', { class: 'service-icon', 'aria-hidden': 'true', html: icon }),
        el('span', { class: 'service-num mono', text: String(index + 1).padStart(2, '0') })
      ),
      el('h3', { text: service.name }),
      el('p', { text: service.summary }),
      foot
    );
  }

  function renderServices(services) {
    if (!Array.isArray(services)) return;
    const grid = document.querySelector('.services-grid');
    if (!grid) return;
    grid.textContent = '';
    services.forEach((service, index) => grid.append(serviceCard(service, index)));
    dispatchUpdate(grid.closest('section') || grid);
  }

  function dispatchUpdate(root) {
    window.dispatchEvent(new CustomEvent('km:cms-updated', { detail: { root } }));
  }

  async function init() {
    if (location.protocol === 'file:') return;
    let data;
    try {
      const response = await fetch('/api/site', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      data = await response.json();
    } catch (err) {
      return; // Static fallback remains intact
    }
    if (!data) return;
    applyContent(data.content);
    if (location.pathname === '/' || location.pathname === '/index.html') applySeo(data.seo);
    const destination = href => ({ '#services': '/services', '/#services': '/services', '#contact': '/contact', '/#contact': '/contact' }[href] || href);
    if (data.nav) {
      (data.nav.primary || []).forEach(link => link.href = destination(link.href));
      (data.nav.footer || []).forEach(column => (column.links || []).forEach(link => link.href = destination(link.href)));
    }
    renderNav(data.nav);
    document.querySelectorAll('a[href]').forEach(link => link.setAttribute('href', destination(link.getAttribute('href'))));
    const serviceSelect = document.getElementById('service');
    if (serviceSelect) {
      serviceSelect.replaceChildren(el('option', { value: '', disabled: 'disabled', selected: 'selected', text: 'Select a service' }));
      (data.services || []).forEach(service => serviceSelect.append(el('option', { text: service.name })));
      serviceSelect.append(el('option', { text: 'Something else' }));
    }
    renderProjects(data.projects);
    renderServices(data.services);
    document.documentElement.dataset.cms = 'ready';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

/* ==========================================================================
   Case study page — fetches published project, renders detail + approved
   reviews, and submits new reviews to the server (pending moderation).
   ========================================================================== */
(() => {
  'use strict';

  const root = document.getElementById('caseStudy');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const FALLBACK_IMAGE =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B171B"/><stop offset="1" stop-color="#162A2C"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><g fill="none" stroke="#C9FF20" stroke-opacity=".35"><rect x="60" y="60" width="1080" height="680"/><path d="M60 200h1080M60 600h1080"/></g><text x="600" y="420" text-anchor="middle" font-family="Manrope, Arial" font-size="64" font-weight="800" fill="#F4F7F3" opacity=".85">KM</text></svg>`
    );

  const STAR =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9L12 2.6Z"/></svg>';

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    });
    children.filter(Boolean).forEach((child) => {
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function img(src, alt, className) {
    const image = el('img', { src: src || FALLBACK_IMAGE, alt: alt || '', class: className || '', loading: 'lazy', decoding: 'async' });
    image.addEventListener('error', () => {
      image.src = FALLBACK_IMAGE;
    }, { once: true });
    return image;
  }

  function stars(rating, label) {
    const wrap = el('span', { class: 'stars', role: 'img', 'aria-label': `${rating} out of 5 stars` });
    for (let i = 1; i <= 5; i += 1) {
      const star = el('span');
      star.innerHTML = STAR;
      star.firstChild.classList.toggle('star-empty', i > rating);
      if (label) star.setAttribute('aria-hidden', 'true');
      wrap.append(star);
    }
    return wrap;
  }

  function setMeta(project) {
    document.title = project.seoTitle || `${project.title} — Kuldeep Malviya`;
    let desc = document.querySelector('meta[name="description"]');
    if (!desc) {
      desc = el('meta', { name: 'description' });
      document.head.append(desc);
    }
    desc.setAttribute('content', project.seoDescription || project.shortDescription || '');
    const canonical = el('link', { rel: 'canonical', href: location.origin + location.pathname });
    document.head.append(canonical);
  }

  function section(title, ...content) {
    return el('div', { class: 'case-block' }, el('h2', { text: title }), ...content);
  }

  function renderReviews(container, data) {
    const reviews = data.reviews || [];
    const rating = data.rating || { average: 0, count: 0 };
    const project = data.project;

    const summary = el(
      'div',
      {},
      el('h2', { text: 'Client feedback' }),
      el(
        'div',
        { class: 'rating-summary' },
        rating.count
          ? el(
              'div',
              {},
              el('div', { class: 'rating-score', text: String(rating.average) }),
              el('div', { class: 'mono', text: `${rating.count} approved review${rating.count === 1 ? '' : 's'}` })
            )
          : null,
        rating.count ? stars(Math.round(rating.average)) : null
      ),
      reviews.length
        ? el(
            'div',
            { class: 'review-list' },
            ...reviews.map((review) =>
              el(
                'article',
                { class: 'review-card' },
                el(
                  'header',
                  {},
                  el('span', { class: 'review-name', text: review.displayName }),
                  stars(review.rating)
                ),
                el('p', { class: 'review-text', text: review.text }),
                el('span', { class: 'review-project', text: `${review.projectTitle} · ${new Date(review.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}` })
              )
            )
          )
        : el('p', { class: 'reviews-empty', text: 'No approved client feedback yet. If you worked on this project, you can share feedback below — reviews are published after moderation.' })
    );

    const form = buildReviewForm(project);
    container.append(el('section', { class: 'reviews', id: 'feedback' }, summary, form));
  }

  function buildReviewForm(project) {
    const status = el('div', { class: 'form-status', role: 'status', 'aria-live': 'polite', hidden: 'hidden' });
    const ratingFieldset = el('fieldset', { class: 'rating-input' }, el('legend', { text: 'Your rating' }));
    for (let i = 1; i <= 5; i += 1) {
      const input = el('input', { type: 'radio', name: 'rating', value: String(i), id: `rating-${i}`, required: 'required', 'aria-label': `${i} star${i === 1 ? '' : 's'}` });
      const label = el('label', { for: `rating-${i}`, title: `${i} star${i === 1 ? '' : 's'}` });
      const svg = el('span');
      svg.innerHTML = STAR;
      label.append(input, svg);
      input.addEventListener('change', () => {
        ratingFieldset.querySelectorAll('label').forEach((l, index) => l.classList.toggle('is-on', index < i));
      });
      ratingFieldset.append(label);
    }

    const nameInput = el('input', {
      type: 'text',
      id: 'reviewName',
      name: 'displayName',
      maxlength: '40',
      required: 'required',
      autocomplete: 'nickname',
      placeholder: 'Public display name (no email or phone)'
    });
    const textInput = el('textarea', {
      id: 'reviewText',
      name: 'text',
      rows: '4',
      maxlength: '1200',
      minlength: '10',
      required: 'required',
      placeholder: 'What was it like working on this project?'
    });
    const consent = el('input', { type: 'checkbox', id: 'reviewConsent', required: 'required' });
    const honeypot = el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', class: 'hp-field', 'aria-hidden': 'true' });
    const submit = el('button', { class: 'btn btn-primary', type: 'submit' }, 'Submit feedback', el('span', { class: 'arr', 'aria-hidden': 'true', text: '↗' }));

    const form = el(
      'form',
      { class: 'review-form', novalidate: 'novalidate', 'aria-labelledby': 'reviewFormTitle' },
      el('h2', { id: 'reviewFormTitle', text: 'Share your feedback' }),
      el('p', { text: 'Your review is private until it is approved. Only the display name you choose, your rating and your review are shown publicly.' }),
      ratingFieldset,
      el('div', { class: 'field' }, el('label', { for: 'reviewName', text: 'Display name' }), nameInput),
      el('div', { class: 'field' }, el('label', { for: 'reviewText', text: 'Your review' }), textInput),
      el('label', { class: 'review-consent' }, consent, el('span', { text: 'I agree that this review and my display name may be published on this website after moderation.' })),
      el('p', { class: 'mono', text: `Project: ${project.title}` }),
      honeypot,
      submit,
      status
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.hidden = true;
      status.removeAttribute('data-state');
      const rating = form.querySelector('input[name="rating"]:checked');
      const name = nameInput.value.trim();
      const text = textInput.value.trim();

      if (!rating || name.length < 2 || text.length < 10 || !consent.checked) {
        status.hidden = false;
        status.dataset.state = 'error';
        status.textContent = !rating
          ? 'Please choose a star rating.'
          : name.length < 2
            ? 'Please enter a display name of at least 2 characters.'
            : text.length < 10
              ? 'Please write at least 10 characters.'
              : 'Please confirm that your review may be displayed publicly.';
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Sending…';
      try {
        const response = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: name,
            rating: Number(rating.value),
            text,
            consent: consent.checked,
            projectSlug: project.slug,
            website: honeypot.value
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Your review could not be submitted.');
        status.hidden = false;
        status.dataset.state = 'success';
        status.textContent = payload.message || 'Thanks — your review is awaiting approval.';
        form.reset();
        ratingFieldset.querySelectorAll('label').forEach((l) => l.classList.remove('is-on'));
      } catch (err) {
        status.hidden = false;
        status.dataset.state = 'error';
        status.textContent = err.message || 'Your review could not be submitted. Please try again.';
      } finally {
        submit.disabled = false;
        submit.textContent = 'Submit feedback';
      }
    });

    return form;
  }

  function render(data) {
    const project = data.project;
    document.body.dataset.pageLoading = 'false';
    setMeta(project);
    root.textContent = '';

    if (data.preview) {
      root.append(
        el(
          'div',
          { class: 'preview-banner' },
          el('span', { text: 'Draft preview — only visible to signed-in admins' }),
          el('a', { href: '/admin', text: 'Back to dashboard ↗' })
        )
      );
    }

    const facts = [];
    if (project.client) facts.push(el('div', {}, el('dt', { text: 'Client' }), el('dd', { text: project.client })));
    if (project.category) facts.push(el('div', {}, el('dt', { text: 'Discipline' }), el('dd', { text: project.category })));
    if (project.year) facts.push(el('div', {}, el('dt', { text: 'Year' }), el('dd', { text: project.year })));
    (project.facts || []).forEach((fact) =>
      facts.push(el('div', {}, el('dt', { text: fact.label }), el('dd', { text: fact.value })))
    );

    const hero = el(
      'section',
      { class: 'case-hero' },
      el(
        'div',
        {},
        el(
          'div',
          { class: 'case-meta mono' },
          el('span', { text: `Case study · ${project.category || 'Selected work'}` }),
          el('span', { class: 'dot', 'aria-hidden': 'true' }),
          el('span', { text: project.year || '' })
        ),
        el('h1', {}, project.title, project.subtitle ? el('span', { class: 'case-sub', text: project.subtitle }) : null),
        project.shortDescription ? el('p', { class: 'case-lede', text: project.shortDescription }) : null
      ),
      facts.length ? el('aside', { class: 'case-hero-side' }, el('dl', { class: 'case-facts' }, ...facts)) : el('div')
    );

    const cover = el('div', { class: 'case-cover' }, window.KMArtwork.carousel(project));

    const side = el('div', { class: 'case-side' });
    if (project.services && project.services.length) {
      side.append(
        section(
          'Relevant services',
          el(
            'div',
            { class: 'case-services' },
            ...project.services.map((service) => el('a', { class: 'case-chip', href: `/services/${service.slug}` }, service.name, el('span', { 'aria-hidden': 'true', text: '↗' })))
          )
        )
      );
    }
    if (project.deliverables && project.deliverables.length) {
      side.append(
        section('Deliverables', el('ul', { class: 'case-list' }, ...project.deliverables.map((item) => el('li', { text: item }))))
      );
    }
    if (project.tags && project.tags.length) {
      side.append(section('Tags', el('div', { class: 'case-services' }, ...project.tags.map((tag) => el('span', { class: 'case-chip', text: tag })))));
    }

    const copy = el('div', { class: 'case-copy' });
    if (project.challenge) copy.append(el('h2', { text: 'The challenge' }), el('p', { text: project.challenge }));
    if (project.approach) copy.append(el('h2', { text: 'Approach & process' }), el('p', { text: project.approach }));
    if (project.outcome) {
      copy.append(el('div', { class: 'case-outcome' }, el('h2', { text: 'Outcome' }), el('p', { text: project.outcome })));
    }

    root.append(hero, cover, el('div', { class: 'case-body' }, side, copy));

    const reviewHost = el('div');
    root.append(reviewHost);
    renderReviews(reviewHost, data);
  }

  function renderMissing(message) {
    root.textContent = '';
    root.append(
      el(
        'div',
        { class: 'state-box' },
        el('h1', { text: 'Project not found' }),
        el('p', { text: message || 'This case study is unavailable or has not been published.' }),
        el('a', { class: 'btn btn-primary', href: '/#work' }, 'View selected work', el('span', { class: 'arr', 'aria-hidden': 'true', text: '↗' }))
      )
    );
  }

  async function init() {
    document.body.dataset.pageLoading = 'true';
    const parts = location.pathname.split('/').filter(Boolean);
    const slug = parts[0] === 'project' ? parts[1] : new URLSearchParams(location.search).get('slug');
    if (!slug) {
      renderMissing('No project was specified.');
      return;
    }
    try {
      const preview = new URLSearchParams(location.search).get('preview') === '1' ? '?preview=1' : '';
      const response = await fetch(`/api/projects/${encodeURIComponent(slug)}${preview}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        renderMissing(payload.error);
        return;
      }
      const data = await response.json();
      render(data);
    } catch (err) {
      renderMissing('The case study could not be loaded. Please try again.');
    }
  }

  init();
})();

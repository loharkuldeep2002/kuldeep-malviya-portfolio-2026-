/* ==========================================================================
   KULDEEP MALVIYA — 2026 CYBER LIME & GRAPHITE PORTFOLIO ENGINE
   - 3D interactive perspective tilt on portrait & cards
   - IntersectionObserver scroll reveal system
   - Motion toggle (On/Off) with state persistence
   - Interactive project dialog modal
   - Mobile menu toggle
   - Capabilities & process step interaction
   - Contact form instant validation
   ========================================================================== */
(() => {
  'use strict';

  // 1. MOTION ENGINE & REDUCED MOTION PREFERENCE
  const motionToggle = document.getElementById('motionToggle');
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  let motionActive = !mqReduce.matches;

  try {
    const saved = localStorage.getItem('km-motion-state');
    if (saved === 'off') motionActive = false;
  } catch (e) {}

  function applyMotion(on) {
    motionActive = on;
    if (motionToggle) {
      motionToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      const lbl = motionToggle.querySelector('.motion-label');
      if (lbl) lbl.textContent = on ? 'Motion' : 'Motion: Off';
    }
    document.documentElement.setAttribute('data-motion', on ? 'on' : 'off');
  }

  applyMotion(motionActive);

  if (motionToggle) {
    motionToggle.addEventListener('click', () => {
      applyMotion(!motionActive);
      if (!motionActive) {
        resetParallax();
        if (introActive) finishIntro();
      }
      queueScroll();
      try { localStorage.setItem('km-motion-state', motionActive ? 'on' : 'off'); } catch (e) {}
    });
  }

  // 3. 3D PERSPECTIVE TILT ON PORTRAIT & CARDS
  const canTilt = window.matchMedia('(pointer: fine)').matches;
  function attachTilt(card) {
    if (!card || card.dataset.kmTilt === '1') return;
    card.dataset.kmTilt = '1';
    card.addEventListener('mousemove', (e) => {
      if (!motionActive) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const maxDeg = 10;
      const rx = -((y - cy) / cy) * maxDeg;
      const ry = ((x - cx) / cx) * maxDeg;

      card.classList.add('is-tilting');
      card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    });

    card.addEventListener('mouseleave', () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }
  if (canTilt) document.querySelectorAll('[data-tilt]').forEach(attachTilt);

  // 4. SCROLL STATE — header, progress rail, subtle parallax (one rAF loop)
  const header = document.getElementById('siteHeader');
  const progressBar = document.getElementById('scrollProgressBar');
  const parallaxElements = Array.from(document.querySelectorAll('[data-parallax]'));
  let scrollQueued = false;

  function resetParallax() {
    parallaxElements.forEach((el) => {
      el.style.setProperty('--py', '0px');
      el.style.setProperty('--parallax-y', '0px');
    });
  }

  function renderScrollState() {
    scrollQueued = false;
    const y = window.scrollY;

    if (header) header.classList.toggle('is-scrolled', y > 40);

    if (progressBar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      progressBar.style.transform = `scaleX(${p.toFixed(4)})`;
    }

    if (!motionActive || mqReduce.matches || !finePointer) return;

    const vh = window.innerHeight;
    parallaxElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > vh + 120) return;
      const factor = parseFloat(el.getAttribute('data-parallax')) || 0;
      const center = rect.top + rect.height / 2 - vh / 2;
      const shift = Math.max(-10, Math.min(10, -center * factor));
      el.style.setProperty('--py', `${shift.toFixed(2)}px`);
      el.style.setProperty('--parallax-y', `${shift.toFixed(2)}px`);
    });
  }

  function queueScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(renderScrollState);
  }

  window.addEventListener('scroll', queueScroll, { passive: true });
  window.addEventListener('resize', queueScroll, { passive: true });
  renderScrollState();

  mqReduce.addEventListener?.('change', (e) => {
    if (e.matches) {
      resetParallax();
      if (introActive) finishIntro();
    } else if (motionActive) {
      queueScroll();
    }
  });

  // 5. SCROLL REVEAL — one-way per page session (scroll up never resets content)
  const revealElements = Array.from(document.querySelectorAll('[data-reveal]'));
  const heroRevealElements = revealElements.filter((el) => el.closest('.hero'));

  let introSeen = false;
  try {
    introSeen = sessionStorage.getItem('km-intro-seen') === '1';
  } catch (e) {
    introSeen = false;
  }

  const canPlayIntro =
    !introSeen && !mqReduce.matches && motionActive && !isTouch && finePointer &&
    window.innerWidth > 768 && window.scrollY <= 80 && 'IntersectionObserver' in window;

  function markIntroSeen() {
    try { sessionStorage.setItem('km-intro-seen', '1'); } catch (e) {}
  }

  let revealObserver = null;

  if ('IntersectionObserver' in window && !mqReduce.matches) {
    // Hide + animate only once JS is running, so content stays readable without JS
    document.documentElement.classList.add('has-reveal');

    revealElements.forEach((el) => {
      const parent = el.closest('[data-stagger]');
      if (!parent) return;
      const siblings = Array.from(parent.querySelectorAll('[data-reveal]'));
      const sibIndex = siblings.indexOf(el);
      if (sibIndex > 0) {
        el.style.setProperty('--delay', `${Math.min(sibIndex * 55, 330)}ms`);
      }
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
        scheduleSectionCursor(entry.target);
      });
    }, { rootMargin: '-5% 0px -8% 0px', threshold: 0.05 });
    revealObserver = observer;

    revealElements.forEach((el) => {
      if (canPlayIntro && heroRevealElements.indexOf(el) !== -1) return;
      observer.observe(el);
    });
  } else {
    revealElements.forEach((el) => el.classList.add('is-in'));
  }

  // CMS-rendered cards join the one-way reveal + tilt system
  window.addEventListener('km:cms-updated', (event) => {
    const host = (event.detail && event.detail.root) || document;
    host.querySelectorAll('[data-reveal]').forEach((el) => {
      if (el.classList.contains('is-in')) return;
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add('is-in');
    });
    if (canTilt) host.querySelectorAll('[data-tilt]').forEach(attachTilt);
  });

  if (canPlayIntro) {
    if (document.hidden) {
      // A backgrounded tab gets the intro when the visitor actually sees it
      const startWhenVisible = () => {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', startWhenVisible);
        setTimeout(startIntro, 0);
      };
      document.addEventListener('visibilitychange', startWhenVisible);
    } else {
      setTimeout(startIntro, 0);
    }
  }

  // 6. DESIGN-BUILD INTRO + DECORATIVE COLLABORATOR CURSORS
  // Decorative only: no fake user identities, no interaction, pointer-events none.
  let motionLayer = null;
  let introActive = false;
  let introFinished = false;
  let introTimers = [];
  let skipButton = null;
  let activeGhostCursors = 0;
  const cursorSectionsShown = new Set();

  const SECTION_CURSOR_CONFIG = {
    work: [
      { selector: '.project-featured', label: 'Feature', variant: 'lime', delay: 350 },
      { selector: '.work-grid .project:first-child', label: 'Inspect', variant: 'white', delay: 750 }
    ],
    capabilities: [
      { selector: '.cap-list .cap-card:first-child', label: 'Inspect', variant: 'white', delay: 400 }
    ],
    process: [
      { selector: '.process-step.is-active', label: 'Align', variant: 'lime', delay: 400 }
    ],
    services: [
      { selector: '.services-grid .service-card:first-child', label: 'Scope', variant: 'white', delay: 350 },
      { selector: '.services-grid .service-card:nth-child(2)', label: 'Deliver', variant: 'black', delay: 750 }
    ],
    about: [
      { selector: '.about-frame', label: 'Frame', variant: 'lime', delay: 400 }
    ],
    experience: [
      { selector: '.timeline .exp-item:first-child', label: 'Timeline', variant: 'white', delay: 400 }
    ],
    toolkit: [
      { selector: '.tools-grid .tool:first-child', label: 'Stack', variant: 'white', delay: 350 },
      { selector: '.tools-grid .tool:nth-child(4)', label: 'Select', variant: 'lime', delay: 700 }
    ],
    education: [
      { selector: '.edu-glass-bar', label: 'Review', variant: 'white', delay: 400 }
    ],
    contact: [
      { selector: '.contact-panel', label: 'Connect', variant: 'lime', delay: 400 }
    ]
  };

  const CURSOR_PATH = 'M2.5 1.5 2.5 20.5 7.8 15.6 11.3 22.6 14.8 21 11.4 14 18.4 14Z';

  function ensureMotionLayer() {
    if (motionLayer && motionLayer.isConnected) {
      motionLayer.style.height = `${document.documentElement.scrollHeight}px`;
      return motionLayer;
    }
    motionLayer = document.createElement('div');
    motionLayer.className = 'km-layer';
    motionLayer.setAttribute('aria-hidden', 'true');
    motionLayer.style.height = `${document.documentElement.scrollHeight}px`;
    document.body.appendChild(motionLayer);
    return motionLayer;
  }

  window.addEventListener('resize', () => {
    if (motionLayer) motionLayer.style.height = `${document.documentElement.scrollHeight}px`;
  }, { passive: true });

  function pageRect(el) {
    const r = el.getBoundingClientRect();
    return {
      left: r.left + window.scrollX,
      top: r.top + window.scrollY,
      width: r.width,
      height: r.height,
      right: r.left + window.scrollX + r.width,
      bottom: r.top + window.scrollY + r.height
    };
  }

  function createGhostCursor(label, variant) {
    const cursor = document.createElement('div');
    cursor.className = `km-cursor km-cursor--${variant || 'white'}`;
    cursor.innerHTML =
      `<svg viewBox="0 0 21 24" aria-hidden="true" focusable="false"><path d="${CURSOR_PATH}" /></svg>` +
      (label ? `<span class="km-cursor-tag">${label}</span>` : '');
    return cursor;
  }

  function positionCursor(cursor, x, y, animate) {
    const move = () => {
      cursor.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    };
    if (!animate) {
      cursor.style.transition = 'none';
      move();
      void cursor.offsetWidth;
      cursor.style.transition = '';
    } else {
      move();
    }
  }

  function createSelectFrame(rect, variant) {
    const frame = document.createElement('span');
    frame.className = `km-select km-select--${variant || 'lime'}`;
    frame.style.left = `${Math.round(rect.left)}px`;
    frame.style.top = `${Math.round(rect.top)}px`;
    frame.style.width = `${Math.round(rect.width)}px`;
    frame.style.height = `${Math.round(rect.height)}px`;
    return frame;
  }

  function revealHeroNow() {
    heroRevealElements.forEach((el, i) => {
      el.style.setProperty('--delay', `${Math.min(i * 55, 330)}ms`);
      el.classList.add('is-in');
    });
  }

  function onIntroKeydown(e) {
    if (e.key === 'Escape' && introActive) finishIntro();
  }

  function cleanupMotionLayer() {
    setTimeout(() => {
      if (motionLayer && !motionLayer.querySelector('.km-cursor, .km-select, .km-guide')) {
        motionLayer.remove();
        motionLayer = null;
      }
    }, 500);
  }

  function finishIntro() {
    if (!introActive) {
      if (!introFinished) {
        introFinished = true;
        revealHeroNow();
        markIntroSeen();
      }
      return;
    }

    introActive = false;
    introFinished = true;
    introTimers.forEach((id) => clearTimeout(id));
    introTimers = [];
    revealHeroNow();
    markIntroSeen();
    document.removeEventListener('keydown', onIntroKeydown);
    document.documentElement.classList.remove('km-intro-running');
    if (skipButton) { skipButton.remove(); skipButton = null; }
    if (motionLayer) {
      motionLayer.querySelectorAll('.km-intro-el').forEach((el) => el.remove());
    }
    cleanupMotionLayer();
  }

  function startIntro() {
    if (introActive || introFinished) return;
    if (document.hidden) return;
    if (mqReduce.matches || !motionActive || isTouch || window.innerWidth <= 768 || window.scrollY > 80) {
      finishIntro();
      return;
    }

    const hero = document.querySelector('.hero');
    const shell = hero && hero.querySelector('.shell');
    const title = hero && hero.querySelector('.hero-title');
    const portrait = hero && hero.querySelector('.portrait-card');
    const actions = hero && hero.querySelector('.hero-actions');
    const stats = hero && hero.querySelector('.hero-stats');
    if (!hero || !shell || !title || !portrait || !actions) { finishIntro(); return; }

    introActive = true;
    document.documentElement.classList.add('km-intro-running');
    const layer = ensureMotionLayer();

    const s = pageRect(shell);
    const t = pageRect(title);
    const p = pageRect(portrait);
    const a = pageRect(actions);
    const h = pageRect(hero);
    const st = stats ? pageRect(stats) : null;

    const introEls = [];
    const at = (ms, fn) => introTimers.push(setTimeout(fn, ms));

    function guide(className, props) {
      const g = document.createElement('span');
      g.className = `km-guide ${className} km-intro-el`;
      Object.assign(g.style, props);
      layer.appendChild(g);
      introEls.push(g);
      return g;
    }

    const vTop = h.top + Math.min(90, h.height * .12);
    const vHeight = Math.min(h.height - 120, 760);
    const guides = [
      guide('km-guide--v', { left: `${Math.round(s.left)}px`, top: `${Math.round(vTop)}px`, height: `${Math.round(vHeight)}px` }),
      guide('km-guide--v', { left: `${Math.round(s.right - 1)}px`, top: `${Math.round(vTop)}px`, height: `${Math.round(vHeight)}px` }),
      guide('km-guide--h', { left: `${Math.round(s.left)}px`, top: `${Math.round(t.top - 24)}px`, width: `${Math.round(s.width)}px` })
    ];

    const markA = guide('km-mark', { left: `${Math.round(s.left - 4)}px`, top: `${Math.round(t.top - 28)}px` });
    const markB = guide('km-mark', { left: `${Math.round(s.right - 4)}px`, top: `${Math.round(a.top + 8)}px` });

    const titleFrame = createSelectFrame(
      { left: t.left - 12, top: t.top - 12, width: t.width + 24, height: t.height + 24 }, 'lime'
    );
    titleFrame.classList.add('km-intro-el');
    layer.appendChild(titleFrame);

    const portraitFrame = createSelectFrame(
      { left: p.left - 9, top: p.top - 9, width: p.width + 18, height: p.height + 18 }, 'white'
    );
    portraitFrame.classList.add('km-intro-el');
    layer.appendChild(portraitFrame);

    const alignMark = document.createElement('span');
    alignMark.className = 'km-mark km-mark--wide km-intro-el';
    alignMark.style.left = `${Math.round(a.left)}px`;
    alignMark.style.top = `${Math.round(st ? st.top + 4 : a.bottom + 26)}px`;
    layer.appendChild(alignMark);

    // 4 Minimal Collaborator Cursors:
    // 1. cType (White) - reveals headline text selection frame
    // 2. cFrame (Lime) - places/frames the portrait
    // 3. cCTA (Black body / white stroke) - aligns CTA actions
    // 4. cAlign (White) - aligns metrics/stats
    const cType = createGhostCursor('Type', 'white');
    const cFrame = createGhostCursor('Frame', 'lime');
    const cCTA = createGhostCursor('Action', 'black');
    const cAlign = createGhostCursor('Align', 'white');

    [cType, cFrame, cCTA, cAlign].forEach((c) => {
      c.classList.add('km-intro-el');
      layer.appendChild(c);
    });

    const viewW = document.documentElement.clientWidth;
    positionCursor(cType, Math.max(16, s.left - 50), t.top + 60, false);
    positionCursor(cFrame, Math.min(viewW - 80, p.right + 45), Math.max(24, p.top - 35), false);
    positionCursor(cCTA, Math.max(16, s.left - 20), a.top + 70, false);
    positionCursor(cAlign, Math.min(viewW - 90, s.right - 40), (st ? st.top : a.bottom) + 60, false);

    skipButton = document.createElement('button');
    skipButton.type = 'button';
    skipButton.className = 'km-skip';
    skipButton.innerHTML = 'Skip intro <kbd aria-hidden="true">Esc</kbd>';
    skipButton.addEventListener('click', finishIntro);
    document.body.appendChild(skipButton);
    document.addEventListener('keydown', onIntroKeydown);

    const enter = (el) => {
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-on')));
    };

    at(60, () => guides.forEach((g) => g.classList.add('is-on')));
    at(90, () => { markA.classList.add('is-on'); markB.classList.add('is-on'); });

    // Cursor 1: Headline text-selection
    at(220, () => {
      enter(cType);
      requestAnimationFrame(() =>
        positionCursor(cType, t.left + 24, t.top + t.height * 0.45, true)
      );
    });
    at(480, () => titleFrame.classList.add('is-on'));

    // Cursor 2: Portrait framing
    at(440, () => {
      enter(cFrame);
      requestAnimationFrame(() =>
        positionCursor(cFrame, p.left + p.width * 0.72, p.top + 48, true)
      );
    });
    at(720, () => portraitFrame.classList.add('is-on'));

    // Cursor 3: Action alignment
    at(640, () => {
      enter(cCTA);
      requestAnimationFrame(() =>
        positionCursor(cCTA, a.left + a.width * 0.38, a.top + 18, true)
      );
    });

    // Cursor 4: Metrics / Stats alignment
    at(760, () => {
      enter(cAlign);
      requestAnimationFrame(() =>
        positionCursor(cAlign, st ? st.left + 50 : a.left + 20, (st ? st.top : a.bottom) + 16, true)
      );
    });
    at(960, () => alignMark.classList.add('is-on'));

    // Content reveals live
    at(1080, revealHeroNow);

    // Cursors & frames smoothly fade out
    at(1850, () => {
      [titleFrame, portraitFrame, alignMark, cType, cFrame, cCTA, cAlign].forEach((el) => el.classList.remove('is-on'));
    });
    at(2100, () => guides.forEach((g) => g.classList.remove('is-on')));
    at(2250, () => {
      markA.classList.remove('is-on');
      markB.classList.remove('is-on');
    });
    at(2380, finishIntro);

    // Any deliberate scroll immediately hands full control back to the visitor
    window.addEventListener('scroll', () => {
      if (introActive && window.scrollY > 50) finishIntro();
    }, { passive: true });
  }

  function scheduleSectionCursor(target) {
    const section = target.closest('section[id]');
    if (!section || !SECTION_CURSOR_CONFIG[section.id]) return;
    if (cursorSectionsShown.has(section.id)) return;
    cursorSectionsShown.add(section.id);
    setTimeout(() => showSectionCursors(section), 500);
  }

  function showSectionCursors(section) {
    if (introActive || !motionActive || mqReduce.matches || isTouch || !finePointer) return;
    if (window.innerWidth <= 768 || document.hidden) return;

    const items = SECTION_CURSOR_CONFIG[section.id];
    if (!Array.isArray(items)) return;

    items.forEach((cfg) => {
      setTimeout(() => {
        if (activeGhostCursors >= 3 || document.hidden || !motionActive) return;
        const target = section.querySelector(cfg.selector);
        if (!target) return;

        const r = target.getBoundingClientRect();
        if (r.bottom < 50 || r.top > window.innerHeight - 50) return;

        const layer = ensureMotionLayer();
        const pr = pageRect(target);
        const variant = cfg.variant || 'white';
        const cursor = createGhostCursor(cfg.label, variant);
        const frame = createSelectFrame(pr, variant === 'lime' ? 'lime' : 'white');
        frame.classList.add('km-select--sect');
        cursor.classList.add('km-ghost-sect');
        frame.classList.add('km-ghost-sect');
        layer.appendChild(frame);
        layer.appendChild(cursor);

        const viewW = document.documentElement.clientWidth;
        const startX = Math.min(viewW - 76, pr.right + 36);
        const startY = Math.max(20, pr.top + 20);
        const endX = Math.min(viewW - 76, pr.right - 24);
        const endY = pr.top + Math.min(44, pr.height * 0.25);

        positionCursor(cursor, startX, startY + 16, false);
        activeGhostCursors++;

        requestAnimationFrame(() => requestAnimationFrame(() => {
          cursor.classList.add('is-on');
          frame.classList.add('is-on');
          positionCursor(cursor, endX, endY, true);
        }));

        setTimeout(() => {
          cursor.classList.remove('is-on');
          frame.classList.remove('is-on');
          setTimeout(() => {
            cursor.remove();
            frame.remove();
            activeGhostCursors = Math.max(0, activeGhostCursors - 1);
            cleanupMotionLayer();
          }, 380);
        }, 1450);
      }, cfg.delay || 0);
    });
  }

  document.documentElement.classList.toggle('is-page-hidden', document.hidden);
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('is-page-hidden', document.hidden);
    if (document.hidden && introActive) finishIntro();
  });

  // Pause orbital ambience once the hero leaves the viewport
  const heroStage = document.querySelector('.hero');
  if (heroStage && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      heroStage.classList.toggle('is-offscreen', !entry.isIntersecting);
    }, { rootMargin: '80px 0px' }).observe(heroStage);
  }

  // 6. MOBILE MENU
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  if (menuToggle && mobileMenu) {
    function toggleMenu(open) {
      const isOpen = open !== undefined ? open : mobileMenu.getAttribute('data-open') !== 'true';
      mobileMenu.setAttribute('data-open', isOpen ? 'true' : 'false');
      mobileMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    menuToggle.addEventListener('click', () => toggleMenu());

    mobileMenu.addEventListener('click', (e) => {
      if (e.target.closest('a.menu-link')) toggleMenu(false);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.getAttribute('data-open') === 'true') {
        toggleMenu(false);
      }
    });
  }

  // 7. CAPABILITIES ACCORDION
  const capCards = Array.from(document.querySelectorAll('.cap-card'));
  capCards.forEach((card) => {
    const toggle = () => {
      const willOpen = !card.classList.contains('is-open');
      capCards.forEach((c) => {
        c.classList.remove('is-open');
        c.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        card.classList.add('is-open');
        card.setAttribute('aria-expanded', 'true');
      }
    };

    card.addEventListener('click', toggle);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  // 8. PROCESS STEPS TRACK INTERACTION
  const processSteps = document.querySelectorAll('.process-step');
  processSteps.forEach((step) => {
    step.addEventListener('click', () => {
      processSteps.forEach((s) => s.classList.remove('is-active'));
      step.classList.add('is-active');
    });
  });

  // 10. CONTACT FORM CLIENT-SIDE VALIDATION
  const form = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');
  const sendAnother = document.getElementById('sendAnother');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let hasError = false;

      const fields = [
        { id: 'name', errId: 'nameError', check: (v) => v.trim().length > 0 },
        { id: 'email', errId: 'emailError', check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
        { id: 'service', errId: 'serviceError', check: (v) => v !== '' && v !== null },
        { id: 'budget', errId: 'budgetError', check: (v) => v !== '' && v !== null },
        { id: 'message', errId: 'messageError', check: (v) => v.trim().length > 3 }
      ];

      fields.forEach((f) => {
        const input = document.getElementById(f.id);
        const err = document.getElementById(f.errId);
        if (!input) return;
        const isValid = f.check(input.value);
        if (!isValid) {
          hasError = true;
          input.classList.add('has-error');
          if (err) err.style.display = 'block';
        } else {
          input.classList.remove('has-error');
          if (err) err.style.display = 'none';
        }
      });

      if (!hasError) {
        const nameVal = document.getElementById('name').value.trim();
        const recipient = document.querySelector('.contact-details a[href^="mailto:"]');
        if (!recipient) return;
        const service = document.getElementById('service').value;
        const body = 'Name: ' + nameVal + '\nEmail: ' + document.getElementById('email').value.trim() + '\nService: ' + service + '\nBudget: ' + document.getElementById('budget').value + '\n\n' + document.getElementById('message').value.trim();
        window.location.href = recipient.getAttribute('href').split('?')[0] + '?subject=' + encodeURIComponent('Project enquiry — ' + service) + '&body=' + encodeURIComponent(body);
        const successName = document.getElementById('successName');
        if (successName) successName.textContent = nameVal || 'friend';
        form.style.display = 'none';
        if (formSuccess) formSuccess.style.display = 'block';
      }
    });

    if (sendAnother) {
      sendAnother.addEventListener('click', () => {
        form.reset();
        form.style.display = 'block';
        if (formSuccess) formSuccess.style.display = 'none';
      });
    }
  }

  // 11. SMOOTH ANCHOR LINK NAVIGATION
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      if (targetId === '#top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // 12. DYNAMIC YEAR
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  console.log('Kuldeep Malviya Portfolio Engine Initialized Successfully.');
})();

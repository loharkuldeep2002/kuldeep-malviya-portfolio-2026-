/* ==========================================================================
   Private admin dashboard
   - first-run setup (password + authenticator TOTP verification)
   - sign in with password + TOTP
   - projects, services, reviews, media, content, navigation, SEO, account
   All content actions are validated and authorised on the server.
   ========================================================================== */
(() => {
  'use strict';
  const isLoginPage = document.body.dataset.adminPage === 'login';
  const LOGIN_URL = '/admin/login';
  const DASHBOARD_URL = '/admin/dashboard';

  const authView = document.getElementById('authView');
  const authContent = document.getElementById('authContent');
  const booting = document.getElementById('booting');
  const dashView = document.getElementById('dashView');
  const dashNav = document.getElementById('dashNav');
  const dashTitle = document.getElementById('dashTitle');
  const dashKicker = document.getElementById('dashKicker');
  const dashContent = document.getElementById('dashContent');
  const dashEmail = document.getElementById('dashEmail');
  const toastEl = document.getElementById('toast');
  const logoutBtn = document.getElementById('logoutBtn');

  const state = {
    data: null,
    tab: 'overview',
    projectId: null,
    serviceId: null,
    reviewFilter: 'pending',
    reviewEditId: null,
    mfaChallenge: null
  };
  let notificationPollStarted = false;

  const TABS = [
    { id: 'overview', label: 'Overview', kicker: 'Dashboard' },
    { id: 'projects', label: 'Projects', kicker: 'Case studies' },
    { id: 'services', label: 'Services', kicker: 'Offer' },
    { id: 'reviews', label: 'Reviews', kicker: 'Moderation' },
    { id: 'comments', label: 'Image comments', kicker: 'Moderation' },
    { id: 'media', label: 'Media', kicker: 'Library' },
    { id: 'content', label: 'Website content', kicker: 'Copy' },
    { id: 'navigation', label: 'Navigation & footer', kicker: 'Structure' },
    { id: 'seo', label: 'SEO & settings', kicker: 'Search' },
    { id: 'account', label: 'Account & security', kicker: 'Access' },
    { id: 'activity', label: 'Activity', kicker: 'History' }
  ];

  try {
    const lastTab = localStorage.getItem('km-admin-tab');
    if (TABS.some(tab => tab.id === lastTab)) state.tab = lastTab;
  } catch {}

  /* ------------------------------- helpers -------------------------------- */

  function h(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'hidden') node[key] = Boolean(value);
      else node.setAttribute(key, value);
    });
    children.filter((child) => child !== null && child !== undefined && child !== false).forEach((child) => {
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    let payload = {};
    try {
      payload = await res.json();
    } catch (err) {
      payload = {};
    }
    if (!res.ok) {
      if (res.status === 401 && !isLoginPage) location.replace(LOGIN_URL);
      const error = new Error(payload.error || 'Request failed.');
      error.status = res.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('The file could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadMediaFile(file, alt) {
    try {
      const upload = await api('/api/admin/media/upload-url', {
        method: 'POST',
        body: JSON.stringify({ mimeType: file.type, size: file.size })
      });
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': upload.mime,
          'x-goog-meta-firebasestoragedownloadtokens': upload.downloadToken
        },
        body: file
      });
      if (!response.ok) throw new Error('The file could not be uploaded to Firebase Storage.');
      return await api('/api/admin/media/complete', {
        method: 'POST',
        body: JSON.stringify({
          id: upload.id,
          path: upload.path,
          downloadToken: upload.downloadToken,
          mime: upload.mime,
          size: upload.size,
          filename: file.name,
          alt
        })
      });
    } catch (error) {
      const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
      if (!isLocal || error.status !== 503 || !file.type.startsWith('image/')) throw error;
      if (file.size > 5 * 1024 * 1024) throw new Error('Local fallback supports images up to 5 MB. Configure Firebase Storage for larger files.');
      return await api('/api/admin/media', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, dataUrl: await readFileAsDataUrl(file), alt })
      });
    }
  }

  let toastTimer = null;
  function toast(message, isError) {
    toastEl.textContent = message;
    toastEl.dataset.state = isError ? 'error' : 'ok';
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4200);
  }

  function input(name, value, attrs = {}) {
    return h('input', { class: 'a-input', name, type: 'text', value: value == null ? '' : String(value), ...attrs });
  }

  function textarea(name, value, attrs = {}) {
    return h('textarea', { class: 'a-textarea', name, rows: attrs.rows || 4, ...attrs, ...(attrs.placeholder ? { placeholder: attrs.placeholder } : {}) }, value == null ? '' : String(value));
  }

  function select(name, value, options) {
    const node = h('select', { class: 'a-select', name });
    options.forEach((option) => {
      const opt = h('option', { value: option.value, selected: option.value === value }, option.label);
      node.append(opt);
    });
    return node;
  }

  function field(labelText, control, hint, required) {
    return h('div', { class: 'a-field' },
      h('label', {}, document.createTextNode(required ? `${labelText} *` : labelText), control),
      hint ? h('small', { text: hint }) : null
    );
  }

  function lines(value) {
    return String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  function pairs(value) {
    return lines(value)
      .map((line) => {
        const idx = line.indexOf('|');
        return idx === -1
          ? { value: line, label: '' }
          : { value: line.slice(0, idx).trim(), label: line.slice(idx + 1).trim() };
      })
      .filter((pair) => pair.value || pair.label);
  }

  function galleryLines(value) {
    return lines(value).map((line) => {
      const idx = line.indexOf('|');
      return idx === -1 ? { url: line, alt: '' } : { url: line.slice(0, idx).trim(), alt: line.slice(idx + 1).trim() };
    }).filter((item) => item.url);
  }

  function chip(text, variant) {
    return h('span', { class: `chip ${variant || ''}`, text });
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function mediaOptions() {
    return (state.data.media || [])
      .filter((item) => item.kind !== 'video' && !String(item.mime || '').startsWith('video/'))
      .map((item) => ({ value: item.url, label: item.alt || item.filename }));
  }

  function mediaPicker(targetInput) {
    const options = mediaOptions();
    if (!options.length) return null;
    const picker = select('mediaPick', '', [{ value: '', label: 'Choose from media library…' }, ...options]);
    picker.addEventListener('change', () => {
      if (picker.value) targetInput.value = picker.value;
    });
    return picker;
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  /* -------------------------------- auth ---------------------------------- */

  function showAuth(node) {
    if (!isLoginPage) {
      location.replace(LOGIN_URL);
      return;
    }
    booting.hidden = true;
    authView.hidden = false;
    authContent.textContent = '';
    authContent.append(node);
  }

  function authHead(title, subtitle, step) {
    return h('div', {},
      step ? h('div', { class: 'auth-steps' },
        h('span', { class: `auth-step${step >= 1 ? ' is-on' : ''}`, text: '01 Account' }),
        h('span', { class: `auth-step${step >= 2 ? ' is-on' : ''}`, text: '02 Authenticator' })
      ) : null,
      h('h1', { text: title }),
      h('p', { class: 'auth-sub', text: subtitle })
    );
  }

  function showLogin(errorMessage) {
    const email = input('email', '', { type: 'email', autocomplete: 'username', placeholder: 'you@studio.com', required: 'required' });
    const password = input('password', '', { type: 'password', autocomplete: 'current-password', placeholder: 'Password', required: 'required' });
    const remember = input('rememberDevice', '', { type: 'checkbox', checked: true });
    const message = h('p', { class: 'auth-note', 'aria-live': 'polite', text: errorMessage || '' });
    const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Continue', h('span', { class: 'arr', 'aria-hidden': 'true', text: '→' }));

    const form = h('form', { class: 'a-form', novalidate: 'novalidate' },
      authHead('Sign in', 'Administrator access only. Credentials are verified on the server.' , 1),
      field('Email', email, null, true),
      field('Password', password, null, true),
      h('label', { class: 'remember-device' }, remember, h('span', { text: 'Keep me signed in on this browser for 30 days' })),
      h('p', { class: 'auth-note', text: 'After verification, reopening the browser takes you straight to your dashboard. Uncheck on a shared computer.' }),
      message,
      submit
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      submit.disabled = true;
      try {
        const result = await api('/api/admin/login', {
          method: 'POST',
          body: JSON.stringify({ email: email.value.trim(), password: password.value, rememberDevice: remember.checked })
        });
        if (result.mfaRequired) {
          state.mfaChallenge = result.challenge;
          showMfa();
        } else {
          await enterDashboard();
        }
      } catch (err) {
        message.textContent = err.message;
      } finally {
        submit.disabled = false;
      }
    });

    showAuth(form);
    email.focus();
  }

  function showMfa() {
    const code = input('code', '', {
      inputmode: 'numeric',
      autocomplete: 'one-time-code',
      maxlength: '6',
      placeholder: '6-digit code',
      required: 'required'
    });
    const message = h('p', { class: 'auth-note', 'aria-live': 'polite', text: '' });
    const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Verify & sign in');
    const back = h('button', { class: 'a-btn', type: 'button', text: 'Back' }, );
    back.addEventListener('click', () => {
      state.mfaChallenge = null;
      showLogin();
    });

    const form = h('form', { class: 'a-form' },
      authHead('Authenticator code', 'Verify this sign-in once using the current 6-digit code from your authenticator app.', 2),
      field('Code', code, 'Codes are verified server-side and expire after 30 seconds.', true),
      message,
      h('div', { class: 'a-actions' }, submit, back)
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      submit.disabled = true;
      try {
        await api('/api/admin/login/mfa', {
          method: 'POST',
          body: JSON.stringify({ challenge: state.mfaChallenge, code: code.value.trim() })
        });
        state.mfaChallenge = null;
        await enterDashboard();
      } catch (err) {
        message.textContent = err.message;
      } finally {
        submit.disabled = false;
      }
    });

    showAuth(form);
    code.focus();
  }

  async function showSetup() {
    const email = input('email', '', { type: 'email', autocomplete: 'email', placeholder: 'you@studio.com', required: 'required' });
    const bootstrapToken = input('bootstrap-token', '', { type: 'password', autocomplete: 'off', placeholder: 'One-time token from server .env', required: 'required' });
    const message = h('p', { class: 'auth-note', 'aria-live': 'polite', text: '' });
    const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Start secure setup');

    const form = h('form', { class: 'a-form' },
      authHead('First-time setup', 'Create the single administrator account for this site. You will need an authenticator app (Google Authenticator, 1Password, Authy…).', 1),
      field('Admin email', email, null, true),
      field('One-time setup token', bootstrapToken, 'Use ADMIN_BOOTSTRAP_TOKEN from the private server .env file.', true),
      message,
      submit
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      submit.disabled = true;
      try {
        const result = await api('/api/admin/bootstrap/start', {
          method: 'POST',
          headers: { 'x-admin-bootstrap-token': bootstrapToken.value.trim() },
          body: JSON.stringify({ email: email.value.trim() })
        });
        showSetupVerify(result, bootstrapToken);
      } catch (err) {
        message.textContent = err.message;
      } finally {
        submit.disabled = false;
      }
    });

    showAuth(form);
    email.focus();
  }

  function showSetupVerify(result, bootstrapToken) {
    const secretBox = h('div', { class: 'secret-box', text: result.secret });
    const copyBtn = h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Copy secret' });
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(result.secret);
        toast('Secret copied.');
      } catch (err) {
        toast('Copy failed — select the text manually.', true);
      }
    });

    const code = input('code', '', { inputmode: 'numeric', maxlength: '6', placeholder: '6-digit code', required: 'required' });
    const password = input('password', '', { type: 'password', autocomplete: 'new-password', placeholder: 'At least 12 characters', required: 'required' });
    const confirm = input('confirm', '', { type: 'password', autocomplete: 'new-password', placeholder: 'Repeat password', required: 'required' });
    const message = h('p', { class: 'auth-note', 'aria-live': 'polite', text: '' });
    const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create account');

    const form = h('form', { class: 'a-form' },
      authHead('Connect your authenticator', 'Scan the QR code with your authenticator app, then enter its current 6-digit code below.', 2),
      window.createAuthenticatorQr(result.otpauthUri),
      h('p', { class: 'auth-note', text: 'Or set up manually: choose “Enter a setup key” in your authenticator app and paste this key:' }),
      secretBox,
      h('div', { class: 'a-actions' }, copyBtn, h('a', { class: 'a-btn a-btn-sm', href: result.otpauthUri }, 'Open in authenticator app')),
      field('Authenticator code', code, 'Required before the account is created.', true),
      field('Password', password, 'At least 12 characters with upper case, lower case and a number.', true),
      field('Confirm password', confirm, null, true),
      message,
      submit
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      if (password.value !== confirm.value) {
        message.textContent = 'Passwords do not match.';
        return;
      }
      submit.disabled = true;
      try {
        await api('/api/admin/bootstrap/complete', {
          method: 'POST',
          headers: { 'x-admin-bootstrap-token': bootstrapToken.value.trim() },
          body: JSON.stringify({ email: result.email, password: password.value, code: code.value.trim() })
        });
        bootstrapToken.value = '';
        toast('Administrator created.');
        await enterDashboard();
      } catch (err) {
        message.textContent = err.message;
      } finally {
        submit.disabled = false;
      }
    });

    showAuth(form);
    code.focus();
  }

  /* ------------------------------ dashboard ------------------------------- */

  async function enterDashboard() {
    if (isLoginPage) {
      location.replace(DASHBOARD_URL);
      return;
    }
    try {
      await loadData();
      booting.hidden = true;
      dashView.hidden = false;
      startNotificationPolling();
    } catch (err) {
      if (err.status === 401) {
        location.replace(LOGIN_URL);
      } else {
        booting.hidden = true;
        dashView.hidden = false;
        dashContent.replaceChildren(h('section', { class: 'a-card', role: 'alert' },
          h('h2', { text: 'Dashboard could not load' }),
          h('p', { text: err.message || 'Please try again.' }),
          h('button', { class: 'a-btn', type: 'button', text: 'Try again', onclick: () => location.reload() })
        ));
      }
    }
  }

  async function loadData() {
    const data = await api('/api/admin/session');
    state.data = data;
    if (dashEmail) dashEmail.textContent = data.admin.email;
    renderNav();
    renderTab();
  }

  function startNotificationPolling() {
    if (notificationPollStarted) return;
    notificationPollStarted = true;
    window.setInterval(async () => {
      if (document.hidden || !state.data) return;
      try {
        const latest = await api('/api/admin/session');
        const prev = state.data.counts || {};
        const next = latest.counts || {};
        const newReviews = Math.max(0, (next.pendingReviews || 0) - (prev.pendingReviews || 0));
        const newComments = Math.max(0, (next.pendingComments || 0) - (prev.pendingComments || 0));
        state.data = latest;
        renderNav();
        if (newReviews || newComments) {
          const notices = [];
          if (newReviews) notices.push(`${newReviews} new review${newReviews === 1 ? '' : 's'}`);
          if (newComments) notices.push(`${newComments} new image comment${newComments === 1 ? '' : 's'}`);
          toast(`${notices.join(' and ')} awaiting moderation.`);
        }
      } catch {}
    }, 30000);
  }

  function renderNav() {
    dashNav.textContent = '';
    TABS.forEach((tab) => {
      const btn = h('button', { type: 'button', 'aria-current': state.tab === tab.id ? 'true' : 'false' }, tab.label);
      if (tab.id === 'reviews' && state.data && state.data.counts.pendingReviews) {
        btn.append(h('span', { class: 'nav-count', text: String(state.data.counts.pendingReviews) }));
      }
      if (tab.id === 'comments' && state.data && state.data.counts.pendingComments) {
        btn.append(h('span', { class: 'nav-count', text: String(state.data.counts.pendingComments) }));
      }
      btn.addEventListener('click', () => {
        state.tab = tab.id;
        state.projectId = null;
        state.serviceId = null;
        state.reviewEditId = null;
        renderNav();
        renderTab();
      });
      dashNav.append(btn);
    });
  }

  function renderTab() {
    const tab = TABS.find((item) => item.id === state.tab) || TABS[0];
    try { localStorage.setItem('km-admin-tab', tab.id); } catch {}
    dashTitle.textContent = tab.label;
    dashKicker.textContent = tab.kicker;
    dashContent.textContent = '';
    const map = {
      overview: renderOverview,
      projects: renderProjects,
      services: renderServices,
      reviews: renderReviews,
      comments: renderComments,
      media: renderMedia,
      content: renderContent,
      navigation: renderNavigation,
      seo: renderSeo,
      account: renderAccount,
      activity: renderActivity
    };
    (map[tab.id] || renderOverview)();
  }

  /* ------------------------------- overview ------------------------------- */

  function renderOverview() {
    const { counts, reviews, activity } = state.data;
    dashContent.append(
      h('div', { class: 'a-grid cols-4' },
        metric(counts.publishedProjects, 'Published projects'),
        metric(counts.publishedServices, 'Published services'),
        metric(counts.pendingReviews, 'Pending reviews'),
        metric(counts.media, 'Media items')
      )
    );

    const pending = reviews.filter((review) => review.status === 'pending').slice(0, 3);
    dashContent.append(
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' },
          h('div', {}, h('h2', { text: 'Reviews awaiting moderation' }), h('p', { text: 'Only approved reviews appear on the public site.' })),
          h('button', { class: 'a-btn', type: 'button', text: 'Open reviews' , onclick: () => { state.tab = 'reviews'; renderNav(); renderTab(); } })
        ),
        pending.length
          ? h('div', { class: 'a-list' }, ...pending.map(reviewRowCompact))
          : h('p', { class: 'a-empty', text: 'No pending reviews.' })
      )
    );

    dashContent.append(
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Recent activity' }))),
        activity.length
          ? h('div', { class: 'a-table-wrap' },
              h('table', { class: 'a-table' },
                h('thead', {}, h('tr', {}, h('th', { text: 'When' }), h('th', { text: 'Action' }), h('th', { text: 'Item' }), h('th', { text: 'By' }))),
                h('tbody', {}, ...activity.slice(0, 6).map((entry) =>
                  h('tr', {},
                    h('td', { text: formatDate(entry.at) }),
                    h('td', {}, h('strong', { text: entry.action })),
                    h('td', { text: entry.entity + (entry.meta ? ` · ${entry.meta}` : '') }),
                    h('td', { text: entry.actor })
                  )
                ))
              )
            )
          : h('p', { class: 'a-empty', text: 'No activity recorded yet.' })
      )
    );
  }

  function metric(value, label) {
    return h('div', { class: 'metric' }, h('strong', { text: String(value) }), h('span', { text: label }));
  }

  function reviewRowCompact(review) {
    return h('div', { class: 'a-row' },
      h('div', { class: 'a-row-main' },
        h('div', { class: 'a-row-title', text: `${review.displayName} — ${review.rating}/5` }),
        h('div', { class: 'a-row-meta', text: review.projectTitle })
      ),
      h('div', { class: 'a-row-actions' },
        h('button', { class: 'a-btn a-btn-sm primary', type: 'button', text: 'Approve', onclick: () => setReviewStatus(review.id, 'approved') }),
        h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Reject', onclick: () => setReviewStatus(review.id, 'rejected') })
      )
    );
  }

  /* ------------------------------- projects ------------------------------- */

  function renderProjects() {
    const projects = state.data.projects;
    const editing = state.projectId ? projects.find((p) => p.id === state.projectId) : null;

    dashContent.append(
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' },
          h('div', {}, h('h2', { text: 'Case studies' }), h('p', { text: 'Order controls the public grid. Archived projects stay in the database.' })),
          h('button', { class: 'a-btn primary', type: 'button', text: '+ New project', onclick: () => { state.projectId = 'new'; renderTab(); } })
        ),
        h('div', { class: 'a-list' }, ...projects.map((project) => projectRow(project)))
      )
    );

    if (editing || state.projectId === 'new') {
      dashContent.append(projectEditor(editing));
    }
  }

  function projectRow(project) {
    return h('div', { class: `a-row${state.projectId === project.id ? ' is-selected' : ''}` },
      project.cover ? h('img', { class: 'a-thumb', src: project.cover, alt: '' }) : null,
      h('div', { class: 'a-row-main' },
        h('div', { class: 'a-row-title', text: project.title }),
        h('div', { class: 'a-row-meta' },
          `${project.year || '—'} · ${project.category || '—'} · /${project.slug}`,
          project.archived ? ' · archived' : ''
        )
      ),
      chip(project.archived ? 'archived' : project.status, project.archived ? 'archived' : project.status),
      h('div', { class: 'a-row-actions' },
        h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Edit', onclick: () => { state.projectId = project.id; renderTab(); } }),
        h('a', { class: 'a-btn a-btn-sm', href: `/project/${project.slug}?preview=1`, target: '_blank', rel: 'noopener', text: 'Preview ↗' }),
        project.archived
          ? h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Restore', onclick: () => restoreProject(project) })
          : h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Archive', onclick: () => archiveProject(project) }),
        h('button', { class: 'a-btn a-btn-sm danger', type: 'button', text: 'Delete', onclick: () => deleteProject(project) })
      )
    );
  }

  function projectEditor(project) {
    const isNew = !project;
    const v = (key, fallback) => (project && project[key] !== undefined && project[key] !== null ? project[key] : fallback);

    const title = input('title', v('title', ''), { required: 'required' });
    const slug = input('slug', v('slug', ''), { placeholder: 'auto-from-title' });
    const subtitle = input('subtitle', v('subtitle', ''));
    const client = input('client', v('client', ''));
    const category = input('category', v('category', ''));
    const year = input('year', v('year', ''));
    const order = input('order', v('order', 99), { type: 'number', min: '0', max: '999' });
    const status = select('status', v('status', 'draft'), [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }]);
    const shortDescription = textarea('shortDescription', v('shortDescription', ''), { rows: 2 });
    const challenge = textarea('challenge', v('challenge', ''), { rows: 4 });
    const approach = textarea('approach', v('approach', ''), { rows: 4 });
    const outcome = textarea('outcome', v('outcome', ''), { rows: 2 });
    const deliverables = textarea('deliverables', (v('deliverables', []) || []).join('\n'), { rows: 4, placeholder: 'One per line' });
    const tags = textarea('tags', (v('tags', []) || []).join('\n'), { rows: 2, placeholder: 'One per line' });
    const facts = textarea('facts', (v('facts', []) || []).map((f) => `${f.value} | ${f.label}`).join('\n'), { rows: 3, placeholder: 'Value | Label' });
    const services = input('services', (v('services', []) || []).join(', '), { placeholder: 'identity-systems, digital-design' });
    const cover = input('cover', v('cover', ''));
    const coverAlt = input('coverAlt', v('coverAlt', ''));
    const gallery = textarea('gallery', (v('gallery', []) || []).map((g) => `${g.url} | ${g.alt || ''}`).join('\n'), { rows: 3, placeholder: '/uploads/image.jpg | Alt text' });
    const seoTitle = input('seoTitle', v('seoTitle', ''));
    const seoDescription = textarea('seoDescription', v('seoDescription', ''), { rows: 2 });
    const message = h('p', { class: 'auth-note', 'aria-live': 'polite', text: '' });
    const picker = mediaPicker(cover);

    const form = h('form', { class: 'a-form' },
      h('div', { class: 'a-card-head' }, h('h2', { text: isNew ? 'New project' : `Edit — ${project.title}` })),
      h('div', { class: 'row' }, field('Title', title, null, true), field('Slug', slug, 'Lowercase letters, numbers, hyphens.')),
      h('div', { class: 'row' }, field('Subtitle', subtitle), field('Client / display label', client)),
      h('div', { class: 'row' }, field('Category', category), field('Year', year), field('Order', order), field('Status', status)),
      field('Short description', shortDescription, 'Shown on the work grid.'),
      field('Challenge', challenge),
      field('Approach & process', approach),
      field('Outcome', outcome, 'Only add verified outcomes. Leave empty to hide the section.'),
      h('div', { class: 'row' }, field('Deliverables', deliverables, 'One per line.'), field('Tags', tags, 'One per line.')),
      field('Facts', facts, 'One per line as “Value | Label”. Shown in the project sidebar and featured card.'),
      field('Services', services, 'Comma-separated service slugs.'),
      h('div', { class: 'row' }, field('Cover image URL', cover, null), picker ? field('Media library', picker) : null),
      field('Cover alt text', coverAlt, 'Describe the image for screen readers.'),
      field('Gallery', gallery, 'One per line as “URL | alt text”.'),
      h('div', { class: 'row' }, field('SEO title', seoTitle), field('SEO description', seoDescription)),
      message,
      h('div', { class: 'a-actions' },
        h('button', { class: 'a-btn primary', type: 'submit', text: isNew ? 'Create project' : 'Save changes' }),
        h('button', {
          class: 'a-btn',
          type: 'button',
          text: 'Cancel',
          onclick: () => { state.projectId = null; renderTab(); }
        })
      ),
      h('small', { text: 'Saved changes appear on the public site immediately when the project is published.' })
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      const payload = {
        title: title.value,
        slug: slug.value,
        subtitle: subtitle.value,
        client: client.value,
        category: category.value,
        year: year.value,
        order: Number(order.value),
        status: status.value,
        shortDescription: shortDescription.value,
        challenge: challenge.value,
        approach: approach.value,
        outcome: outcome.value,
        deliverables: lines(deliverables.value),
        tags: lines(tags.value),
        facts: pairs(facts.value),
        services: services.value.split(',').map((s) => s.trim()).filter(Boolean),
        cover: cover.value,
        coverAlt: coverAlt.value,
        gallery: galleryLines(gallery.value),
        seoTitle: seoTitle.value,
        seoDescription: seoDescription.value,
        archived: project ? project.archived : false
      };
      try {
        if (isNew) {
          await api('/api/admin/projects', { method: 'POST', body: JSON.stringify(payload) });
          toast('Project created.');
        } else {
          await api(`/api/admin/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(payload) });
          toast('Project saved.');
        }
        state.projectId = null;
        await loadData();
        state.tab = 'projects';
        renderNav();
        renderTab();
      } catch (err) {
        message.textContent = err.message;
      }
    });

    return h('section', { class: 'a-card' }, form);
  }

  async function archiveProject(project) {
    if (!confirmAction(`Archive “${project.title}”? It will disappear from the public site but stay in the database.`)) return;
    try {
      await api(`/api/admin/projects/${project.id}`, { method: 'DELETE' });
      toast('Project archived.');
      await loadData();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function restoreProject(project) {
    try {
      const { archived, ...rest } = project;
      await api(`/api/admin/projects/${project.id}`, { method: 'PUT', body: JSON.stringify({ ...rest, archived: false }) });
      toast('Project restored.');
      await loadData();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function deleteProject(project) {
    if (!confirmAction(`Permanently delete “${project.title}”? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/projects/${project.id}?permanent=1`, { method: 'DELETE' });
      toast('Project deleted permanently.');
      state.projectId = null;
      await loadData();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ------------------------------- services ------------------------------- */

  function renderServices() {
    const services = state.data.services;
    const editing = state.serviceId ? services.find((s) => s.id === state.serviceId) : null;

    dashContent.append(
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' },
          h('div', {}, h('h2', { text: 'Services' }), h('p', { text: 'Published services appear on the homepage and at /services/<slug>.' })),
          h('button', { class: 'a-btn primary', type: 'button', text: '+ New service', onclick: () => { state.serviceId = 'new'; renderTab(); } })
        ),
        h('div', { class: 'a-list' }, ...services.map((service) => serviceRow(service)))
      )
    );

    if (editing || state.serviceId === 'new') dashContent.append(serviceEditor(editing));
  }

  function serviceRow(service) {
    return h('div', { class: `a-row${state.serviceId === service.id ? ' is-selected' : ''}` },
      h('div', { class: 'a-row-main' },
        h('div', { class: 'a-row-title', text: service.name }),
        h('div', { class: 'a-row-meta', text: `${service.priceLabel || ''} · /${service.slug}${service.archived ? ' · archived' : ''}` })
      ),
      chip(service.archived ? 'archived' : service.status, service.archived ? 'archived' : service.status),
      h('div', { class: 'a-row-actions' },
        h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Edit', onclick: () => { state.serviceId = service.id; renderTab(); } }),
        h('a', { class: 'a-btn a-btn-sm', href: `/services/${service.slug}?preview=1`, target: '_blank', rel: 'noopener', text: 'Preview ↗' }),
        service.archived
          ? h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Restore', onclick: () => restoreService(service) })
          : h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Archive', onclick: () => archiveService(service) }),
        h('button', { class: 'a-btn a-btn-sm danger', type: 'button', text: 'Delete', onclick: () => deleteService(service) })
      )
    );
  }

  function serviceEditor(service) {
    const isNew = !service;
    const v = (key, fallback) => (service && service[key] !== undefined && service[key] !== null ? service[key] : fallback);

    const name = input('name', v('name', ''), { required: 'required' });
    const slug = input('slug', v('slug', ''));
    const summary = textarea('summary', v('summary', ''), { rows: 2 });
    const description = textarea('description', v('description', ''), { rows: 5 });
    const included = textarea('included', (v('included', []) || []).join('\n'), { rows: 4, placeholder: 'One per line' });
    const idealFor = textarea('idealFor', v('idealFor', ''), { rows: 2 });
    const process = textarea('process', (v('process', []) || []).map((step) => `${step.title} | ${step.description || ''}`).join('\n'), { rows: 4, placeholder: 'Step title | Description' });
    const relatedProjects = input('relatedProjects', (v('relatedProjects', []) || []).join(', '), { placeholder: 'noire, terrax-pumps' });
    const cover = input('cover', v('cover', ''));
    const coverAlt = input('coverAlt', v('coverAlt', ''));
    const priceLabel = input('priceLabel', v('priceLabel', 'Request a quote'));
    const ctaLabel = input('ctaLabel', v('ctaLabel', 'Start a project'));
    const ctaHref = input('ctaHref', v('ctaHref', '/#contact'));
    const seoTitle = input('seoTitle', v('seoTitle', ''));
    const seoDescription = textarea('seoDescription', v('seoDescription', ''), { rows: 2 });
    const order = input('order', v('order', 99), { type: 'number', min: '0', max: '999' });
    const status = select('status', v('status', 'draft'), [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }]);
    const message = h('p', { class: 'auth-note', 'aria-live': 'polite', text: '' });
    const picker = mediaPicker(cover);

    const form = h('form', { class: 'a-form' },
      h('div', { class: 'a-card-head' }, h('h2', { text: isNew ? 'New service' : `Edit — ${service.name}` })),
      h('div', { class: 'row' }, field('Service name', name, null, true), field('Slug', slug)),
      field('Short summary', summary),
      field('Full description', description),
      h('div', { class: 'row' }, field('What is included', included, 'One per line.'), field('Ideal client / project', idealFor)),
      field('Process steps', process, 'One per line as “Title | Description”.'),
      field('Related projects', relatedProjects, 'Comma-separated project slugs.'),
      h('div', { class: 'row' }, field('Cover image URL', cover), picker ? field('Media library', picker) : null),
      field('Cover alt text', coverAlt),
      h('div', { class: 'row' },
        field('Price label', priceLabel, 'Use “Request a quote” rather than inventing a price.'),
        field('CTA label', ctaLabel),
        field('CTA link', ctaHref)
      ),
      h('div', { class: 'row' }, field('SEO title', seoTitle), field('SEO description', seoDescription)),
      h('div', { class: 'row' }, field('Order', order), field('Status', status)),
      message,
      h('div', { class: 'a-actions' },
        h('button', { class: 'a-btn primary', type: 'submit', text: isNew ? 'Create service' : 'Save changes' }),
        h('button', { class: 'a-btn', type: 'button', text: 'Cancel', onclick: () => { state.serviceId = null; renderTab(); } })
      )
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      const payload = {
        name: name.value,
        slug: slug.value,
        summary: summary.value,
        description: description.value,
        included: lines(included.value),
        idealFor: idealFor.value,
        process: lines(process.value).map((line) => {
          const idx = line.indexOf('|');
          return idx === -1 ? { title: line, description: '' } : { title: line.slice(0, idx).trim(), description: line.slice(idx + 1).trim() };
        }),
        relatedProjects: relatedProjects.value.split(',').map((s) => s.trim()).filter(Boolean),
        cover: cover.value,
        coverAlt: coverAlt.value,
        priceLabel: priceLabel.value,
        ctaLabel: ctaLabel.value,
        ctaHref: ctaHref.value,
        seoTitle: seoTitle.value,
        seoDescription: seoDescription.value,
        order: Number(order.value),
        status: status.value,
        archived: service ? service.archived : false
      };
      try {
        if (isNew) {
          await api('/api/admin/services', { method: 'POST', body: JSON.stringify(payload) });
          toast('Service created.');
        } else {
          await api(`/api/admin/services/${service.id}`, { method: 'PUT', body: JSON.stringify(payload) });
          toast('Service saved.');
        }
        state.serviceId = null;
        await loadData();
        state.tab = 'services';
        renderNav();
        renderTab();
      } catch (err) {
        message.textContent = err.message;
      }
    });

    return h('section', { class: 'a-card' }, form);
  }

  async function archiveService(service) {
    if (!confirmAction(`Archive “${service.name}”?`)) return;
    try {
      await api(`/api/admin/services/${service.id}`, { method: 'DELETE' });
      toast('Service archived.');
      await loadData();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function restoreService(service) {
    try {
      const { archived, ...rest } = service;
      await api(`/api/admin/services/${service.id}`, { method: 'PUT', body: JSON.stringify({ ...rest, archived: false }) });
      toast('Service restored.');
      await loadData();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function deleteService(service) {
    if (!confirmAction(`Permanently delete “${service.name}”? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/services/${service.id}?permanent=1`, { method: 'DELETE' });
      toast('Service deleted permanently.');
      state.serviceId = null;
      await loadData();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* -------------------------------- reviews ------------------------------- */

  function renderReviews() {
    const reviews = state.data.reviews;
    const filters = ['pending', 'approved', 'rejected', 'hidden', 'all'];
    const filterRow = h('div', { class: 'filter-row', role: 'group', 'aria-label': 'Filter reviews' });
    filters.forEach((filter) => {
      filterRow.append(
        h('button', {
          type: 'button',
          'aria-pressed': state.reviewFilter === filter ? 'true' : 'false',
          text: filter,
          onclick: () => {
            state.reviewFilter = filter;
            state.reviewEditId = null;
            renderTab();
          }
        })
      );
    });

    const visible = reviews.filter((review) => state.reviewFilter === 'all' || review.status === state.reviewFilter);

    dashContent.append(
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' },
          h('div', {}, h('h2', { text: 'Client reviews' }), h('p', { text: 'Approved reviews only appear publicly, with the display name — never email or private details.' }))
        ),
        filterRow,
        visible.length
          ? h('div', { class: 'a-list' }, ...visible.map(reviewAdminCard))
          : h('p', { class: 'a-empty', text: 'No reviews in this state.' })
      )
    );
  }

  function reviewAdminCard(review) {
    const editing = state.reviewEditId === review.id;
    const card = h('div', { class: 'review-admin' });

    if (editing) {
      const name = input('displayName', review.displayName);
      const rating = select('rating', review.rating, [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} star${n === 1 ? '' : 's'}` })));
      const text = textarea('text', review.text, { rows: 3 });
      const message = h('p', { class: 'auth-note', text: '' });
      const form = h('form', { class: 'a-form' },
        h('div', { class: 'row' }, field('Display name', name), field('Rating', rating)),
        field('Review text', text),
        message,
        h('div', { class: 'a-actions' },
          h('button', { class: 'a-btn primary', type: 'submit', text: 'Save review' }),
          h('button', { class: 'a-btn', type: 'button', text: 'Cancel', onclick: () => { state.reviewEditId = null; renderTab(); } })
        )
      );
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          await api(`/api/admin/reviews/${review.id}`, {
            method: 'PUT',
            body: JSON.stringify({ displayName: name.value, rating: Number(rating.value), text: text.value })
          });
          state.reviewEditId = null;
          toast('Review updated.');
          await loadData();
          renderTab();
        } catch (err) {
          message.textContent = err.message;
        }
      });
      card.append(form);
      return card;
    }

    card.append(
      h('div', { class: 'review-admin-head' },
        h('div', {}, h('strong', { text: review.displayName }), ' ', chip(review.status, review.status)),
        h('span', { class: 'review-admin-meta', text: `${review.rating}/5 · ${formatDate(review.createdAt)}` })
      ),
      h('p', { class: 'review-admin-text', text: review.text }),
      h('div', { class: 'review-admin-meta', text: `Project: ${review.projectTitle} · public display consent: ${review.consent ? 'yes' : 'no'}` }),
      h('div', { class: 'a-actions' },
        review.status !== 'approved' ? h('button', { class: 'a-btn a-btn-sm primary', type: 'button', text: 'Approve', onclick: () => setReviewStatus(review.id, 'approved') }) : null,
        review.status !== 'rejected' ? h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Reject', onclick: () => setReviewStatus(review.id, 'rejected') }) : null,
        review.status !== 'hidden' ? h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Hide', onclick: () => setReviewStatus(review.id, 'hidden') }) : null,
        h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Edit', onclick: () => { state.reviewEditId = review.id; renderTab(); } }),
        h('button', { class: 'a-btn a-btn-sm danger', type: 'button', text: 'Delete', onclick: () => deleteReview(review) })
      )
    );
    return card;
  }

  async function setReviewStatus(id, status) {
    try {
      await api(`/api/admin/reviews/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
      toast(`Review ${status}.`);
      await loadData();
      renderTab();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function deleteReview(review) {
    if (!confirmAction(`Delete the review by ${review.displayName}? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/reviews/${review.id}`, { method: 'DELETE' });
      toast('Review deleted.');
      await loadData();
      renderTab();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function renderComments() {
    const comments = state.data.comments || [];
    const filters = ['pending', 'approved', 'rejected', 'hidden', 'all'];
    const filterRow = h('div', { class: 'filter-row', role: 'group', 'aria-label': 'Filter image comments' });
    filters.forEach((filter) => filterRow.append(h('button', {
      type: 'button', 'aria-pressed': state.reviewFilter === filter ? 'true' : 'false', text: filter,
      onclick: () => { state.reviewFilter = filter; renderTab(); }
    })));
    const visible = comments.filter((comment) => state.reviewFilter === 'all' || comment.status === state.reviewFilter);
    dashContent.append(h('section', { class: 'a-card' },
      h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Project image comments' }), h('p', { text: 'Only approved comments appear publicly. Each comment is tied to an image in a published project.' }))),
      filterRow,
      visible.length ? h('div', { class: 'a-list' }, ...visible.map(commentAdminCard)) : h('p', { class: 'a-empty', text: 'No comments in this state.' })
    ));
  }

  function commentAdminCard(comment) {
    const card = h('article', { class: 'review-admin' });
    const image = h('img', { src: comment.mediaUrl, alt: '', loading: 'lazy', class: 'comment-admin-image' });
    card.append(
      h('div', { class: 'review-admin-head' }, h('div', {}, h('strong', { text: comment.displayName }), ' ', chip(comment.status, comment.status)), h('span', { class: 'review-admin-meta', text: formatDate(comment.createdAt) })),
      h('div', { class: 'comment-admin-body' }, image, h('p', { class: 'review-admin-text', text: comment.text })),
      h('div', { class: 'review-admin-meta', text: `Project: ${comment.projectTitle} · image: ${comment.mediaUrl}` }),
      field('Public reply', textarea('reply', comment.reply || '', { rows: 2, maxlength: '1000', placeholder: 'Optional reply shown with the approved comment' }), 'Shown publicly with the comment after approval.'),
      h('div', { class: 'a-actions' },
        h('button', { class: 'a-btn a-btn-sm', type: 'button', text: comment.reply ? 'Save reply' : 'Add reply', onclick: () => saveCommentReply(comment.id, card.querySelector('[name="reply"]').value) }),
        comment.status !== 'approved' ? h('button', { class: 'a-btn a-btn-sm primary', type: 'button', text: 'Approve', onclick: () => setCommentStatus(comment.id, 'approved') }) : null,
        comment.status !== 'rejected' ? h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Reject', onclick: () => setCommentStatus(comment.id, 'rejected') }) : null,
        comment.status !== 'hidden' ? h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Hide', onclick: () => setCommentStatus(comment.id, 'hidden') }) : null,
        h('button', { class: 'a-btn a-btn-sm danger', type: 'button', text: 'Delete', onclick: () => deleteComment(comment) })
      )
    );
    return card;
  }

  async function setCommentStatus(id, status) {
    try {
      await api(`/api/admin/comments/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
      toast(`Image comment ${status}.`);
      await loadData(); renderTab();
    } catch (err) { toast(err.message, true); }
  }

  async function saveCommentReply(id, reply) {
    try {
      await api(`/api/admin/comments/${id}`, { method: 'PUT', body: JSON.stringify({ reply }) });
      toast('Public reply saved.');
      await loadData(); renderTab();
    } catch (err) { toast(err.message, true); }
  }

  async function deleteComment(comment) {
    if (!confirmAction(`Permanently delete the image comment by ${comment.displayName}?`)) return;
    try {
      await api(`/api/admin/comments/${comment.id}`, { method: 'DELETE' });
      toast('Image comment deleted.');
      await loadData(); renderTab();
    } catch (err) { toast(err.message, true); }
  }

  /* --------------------------------- media -------------------------------- */

  function renderMedia() {
    const fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime', multiple: true, class: 'a-input' });
    const altInput = input('alt', '', { placeholder: 'Describe the image' });
    const message = h('p', { class: 'auth-note', text: 'Images up to 20 MB and videos up to 100 MB. Firebase Storage is used when configured.' });
    const uploadBtn = h('button', { class: 'a-btn primary', type: 'button', text: 'Upload media' });

    uploadBtn.addEventListener('click', async () => {
      const files = Array.from(fileInput.files || []);
      if (!files.length) {
        toast('Choose one or more images or videos first.', true);
        return;
      }
      if (files.some((file) => file.size > (file.type.startsWith('video/') ? 100 : 20) * 1024 * 1024)) {
        toast('Images must be 20 MB or smaller and videos must be 100 MB or smaller.', true);
        return;
      }
      uploadBtn.disabled = true;
      let uploadedCount = 0;
      try {
        for (const file of files) {
          message.textContent = `Uploading ${file.name} (${uploadedCount + 1} of ${files.length})…`;
          await uploadMediaFile(file, altInput.value);
          uploadedCount += 1;
        }
        toast(`${uploadedCount} media file${uploadedCount === 1 ? '' : 's'} uploaded.`);
        fileInput.value = '';
        await loadData();
        renderTab();
      } catch (err) {
        if (uploadedCount) {
          message.textContent = `${uploadedCount} file${uploadedCount === 1 ? '' : 's'} uploaded; the next file failed: ${err.message}`;
          await loadData();
          renderTab();
        } else {
          toast(err.message, true);
        }
      } finally {
        uploadBtn.disabled = false;
      }
    });

    dashContent.append(
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Media library' }), h('p', { text: 'Browse and reuse uploaded images and videos across projects and services.' }))),
        h('div', { class: 'a-form' },
          h('div', { class: 'row' }, field('Image or video files', fileInput), field('Alt text', altInput)),
          message,
          h('div', { class: 'a-actions' }, uploadBtn)
        )
      )
    );

    const grid = h('div', { class: 'media-grid' });
    if (!state.data.media.length) {
      grid.append(h('p', { class: 'a-empty', text: 'No uploaded media yet.' }));
    } else {
      state.data.media.forEach((item) => grid.append(mediaCard(item)));
    }
    dashContent.append(h('section', { class: 'a-card' }, h('div', { class: 'a-card-head' }, h('h2', { text: `Library (${state.data.media.length})` })), grid));
  }

  function mediaCard(item) {
    const alt = input('alt', item.alt || '', { placeholder: 'Alt text' });
    const playback = item.playback || { autoplay: false, loop: false, muted: true, controls: true, playbackRate: 1 };
    const replaceInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime', hidden: true });
    const actions = h('div', { class: 'media-item-actions' },
      h('button', {
        class: 'a-btn a-btn-sm',
        type: 'button',
        text: 'Copy URL',
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(new URL(item.url, location.origin).href);
            toast('Media URL copied. Paste it into a project gallery to use this media.');
          } catch (err) {
            toast('Could not copy this URL. Open the media in a new tab and copy it there.', true);
          }
        }
      }),
      h('button', {
        class: 'a-btn a-btn-sm',
        type: 'button',
        text: 'Save alt',
        onclick: async () => {
          try {
            await api(`/api/admin/media/${item.id}`, { method: 'PUT', body: JSON.stringify({ alt: alt.value }) });
            toast('Alt text saved.');
            await loadData();
            renderTab();
          } catch (err) {
            toast(err.message, true);
          }
        }
      }),
      h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Replace', onclick: () => replaceInput.click() }),
      replaceInput,
      h('button', {
        class: 'a-btn a-btn-sm danger',
        type: 'button',
        text: 'Delete',
        onclick: async () => {
          if (!confirmAction(`Delete “${item.filename}”? It will be removed from the library and from any project that uses it.`)) return;
          try {
            await api(`/api/admin/media/${item.id}`, { method: 'DELETE' });
            toast('Image deleted.');
            await loadData();
            renderTab();
          } catch (err) {
            const refs = err.payload && err.payload.references;
            toast(refs && refs.length
              ? `Still used by ${refs.map((ref) => `${ref.type} “${ref.slug}”${ref.field ? ` (${ref.field})` : ''}`).join(', ')}. Replace it first.`
              : err.message, true);
          }
        }
      })
    );

    replaceInput.addEventListener('change', async () => {
      const file = replaceInput.files && replaceInput.files[0];
      if (!file) return;
      if (!confirmAction('Replace this media everywhere it is used? The old file will be removed.')) return;
      if (file.size > (file.type.startsWith('video/') ? 100 : 20) * 1024 * 1024) {
        toast('Images must be 20 MB or smaller and videos must be 100 MB or smaller.', true);
        return;
      }
      try {
        const uploaded = await uploadMediaFile(file, alt.value);
        await api(`/api/admin/media/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify({ replacementMediaId: uploaded.media.id, alt: alt.value })
        });
        toast('Media replaced.');
        await loadData();
        renderTab();
      } catch (err) {
        toast(err.message, true);
      }
    });

    const isVideo = item.kind === 'video' || String(item.mime || '').startsWith('video/');
    const playbackControls = isVideo
      ? h('div', { class: 'media-playback' },
          h('label', {}, h('input', { type: 'checkbox', checked: playback.autoplay, dataset: { playback: 'autoplay' } }), ' Autoplay'),
          h('label', {}, h('input', { type: 'checkbox', checked: playback.loop, dataset: { playback: 'loop' } }), ' Loop'),
          h('label', {}, h('input', { type: 'checkbox', checked: playback.muted, dataset: { playback: 'muted' } }), ' Muted'),
          h('label', {}, h('input', { type: 'checkbox', checked: playback.controls !== false, dataset: { playback: 'controls' } }), ' Controls'),
          field('Playback speed', select('playbackRate', playback.playbackRate || 1, [0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => ({ value: rate, label: `${rate}×` })))),
          h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Save playback', onclick: async () => {
            const settings = {};
            ['autoplay', 'loop', 'muted', 'controls'].forEach(key => { settings[key] = card.querySelector(`[data-playback="${key}"]`).checked; });
            settings.playbackRate = Number(card.querySelector('[name="playbackRate"]').value);
            try {
              await api(`/api/admin/media/${item.id}`, { method: 'PUT', body: JSON.stringify({ playback: settings }) });
              toast('Playback settings saved.');
              await loadData();
              renderTab();
            } catch (err) { toast(err.message, true); }
          } })
        )
      : null;
    const card = h('div', { class: 'media-item' },
      isVideo
        ? h('video', { src: item.url, controls: 'controls', preload: 'metadata', playsinline: 'playsinline', 'aria-label': item.filename })
        : h('img', { src: item.url, alt: item.alt || '' }),
      h('div', { class: 'media-item-body' },
        alt,
        h('div', { class: 'media-meta', text: `${item.filename} · ${Math.round(item.size / 1024)} KB` }),
        playbackControls,
        actions
      )
    );
    return card;
  }

  /* ------------------------------- content -------------------------------- */

  function renderContent() {
    const content = state.data.content;
    const hero = content.hero;
    const about = content.about;
    const contact = content.contact;
    const footer = content.footer;

    const fields = {
      eyebrow: input('eyebrow', hero.eyebrow),
      titleLead: input('titleLead', hero.titleLead),
      titleBreak: input('titleBreak', hero.titleBreak),
      titleAccent: input('titleAccent', hero.titleAccent),
      lede: textarea('lede', hero.lede, { rows: 3 }),
      primaryCtaLabel: input('primaryCtaLabel', hero.primaryCtaLabel),
      primaryCtaHref: input('primaryCtaHref', hero.primaryCtaHref),
      secondaryCtaLabel: input('secondaryCtaLabel', hero.secondaryCtaLabel),
      secondaryCtaHref: input('secondaryCtaHref', hero.secondaryCtaHref),
      stats: textarea('stats', hero.stats.map((s) => `${s.value} | ${s.label}`).join('\n'), { rows: 3, placeholder: '45+ | Projects delivered' }),
      aboutLabel: input('aboutLabel', about.label),
      aboutTitleLead: input('aboutTitleLead', about.titleLead),
      aboutTitleAccent: input('aboutTitleAccent', about.titleAccent),
      aboutLede: textarea('aboutLede', about.lede, { rows: 4 }),
      aboutQuote: textarea('aboutQuote', about.quote, { rows: 2 }),
      aboutSignature: input('aboutSignature', about.signature),
      aboutNote: input('aboutNote', about.note),
      aboutBased: input('aboutBased', about.based),
      aboutFocus: input('aboutFocus', about.focus),
      aboutStatus: input('aboutStatus', about.status),
      contactHeading: input('contactHeading', contact.heading),
      contactCopy: textarea('contactCopy', contact.copy, { rows: 2 }),
      contactEmail: input('contactEmail', contact.email, { type: 'email' }),
      contactLocation: input('contactLocation', contact.location),
      contactResponse: input('contactResponse', contact.responseTime),
      contactAvailability: input('contactAvailability', contact.availability),
      contactNote: input('contactNote', contact.note),
      availabilityBadge: input('availabilityBadge', content.availabilityBadge),
      footerDescription: textarea('footerDescription', footer.description, { rows: 2 }),
      footerLocation: input('footerLocation', footer.location),
      footerStatementLead: input('footerStatementLead', footer.statementLead),
      footerStatementAccent: input('footerStatementAccent', footer.statementAccent),
      footerStatementNote: input('footerStatementNote', footer.statementNote),
      footerCopyright: input('footerCopyright', footer.copyright),
      footerBuiltNote: input('footerBuiltNote', footer.builtNote)
    };
    const message = h('p', { class: 'auth-note', 'aria-live': 'polite', text: '' });

    const form = h('form', { class: 'a-form' },
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('h2', { text: 'Hero' })),
        h('div', { class: 'row' }, field('Eyebrow', fields.eyebrow), field('Availability badge', fields.availabilityBadge)),
        h('div', { class: 'row' }, field('Headline line 1', fields.titleLead), field('Line 2 (small word)', fields.titleBreak), field('Accent word', fields.titleAccent)),
        field('Supporting copy', fields.lede),
        h('div', { class: 'row' }, field('Primary CTA label', fields.primaryCtaLabel), field('Primary CTA link', fields.primaryCtaHref)),
        h('div', { class: 'row' }, field('Secondary CTA label', fields.secondaryCtaLabel), field('Secondary CTA link', fields.secondaryCtaHref)),
        field('Hero stats', fields.stats, 'One per line as “Value | Label”. Up to four.')
      ),
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('h2', { text: 'About' })),
        h('div', { class: 'row' }, field('Section label', fields.aboutLabel), field('Title lead', fields.aboutTitleLead), field('Title accent', fields.aboutTitleAccent)),
        field('Biography', fields.aboutLede),
        field('Pull quote', fields.aboutQuote),
        h('div', { class: 'row' }, field('Signature', fields.aboutSignature), field('Signature note', fields.aboutNote)),
        h('div', { class: 'row' }, field('Based in', fields.aboutBased), field('Focus', fields.aboutFocus), field('Status', fields.aboutStatus))
      ),
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('h2', { text: 'Contact' })),
        h('div', { class: 'row' }, field('Heading', fields.contactHeading), field('Copy', fields.contactCopy)),
        h('div', { class: 'row' }, field('Email', fields.contactEmail), field('Location', fields.contactLocation)),
        h('div', { class: 'row' }, field('Response time', fields.contactResponse), field('Availability line', fields.contactAvailability), field('Booking note', fields.contactNote))
      ),
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('h2', { text: 'Footer' })),
        field('Footer description', fields.footerDescription),
        h('div', { class: 'row' }, field('Location line', fields.footerLocation), field('Statement lead', fields.footerStatementLead), field('Statement accent', fields.footerStatementAccent)),
        h('div', { class: 'row' }, field('Statement note', fields.footerStatementNote), field('Copyright', fields.footerCopyright), field('Built note', fields.footerBuiltNote))
      ),
      message,
      h('div', { class: 'a-actions' }, h('button', { class: 'a-btn primary', type: 'submit', text: 'Save content' }))
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      try {
        await api('/api/admin/content', {
          method: 'PUT',
          body: JSON.stringify({
            content: {
              hero: {
                eyebrow: fields.eyebrow.value,
                titleLead: fields.titleLead.value,
                titleBreak: fields.titleBreak.value,
                titleAccent: fields.titleAccent.value,
                lede: fields.lede.value,
                primaryCtaLabel: fields.primaryCtaLabel.value,
                primaryCtaHref: fields.primaryCtaHref.value,
                secondaryCtaLabel: fields.secondaryCtaLabel.value,
                secondaryCtaHref: fields.secondaryCtaHref.value,
                stats: pairs(fields.stats.value)
              },
              about: {
                label: fields.aboutLabel.value,
                titleLead: fields.aboutTitleLead.value,
                titleAccent: fields.aboutTitleAccent.value,
                lede: fields.aboutLede.value,
                quote: fields.aboutQuote.value,
                signature: fields.aboutSignature.value,
                note: fields.aboutNote.value,
                based: fields.aboutBased.value,
                focus: fields.aboutFocus.value,
                status: fields.aboutStatus.value
              },
              contact: {
                heading: fields.contactHeading.value,
                copy: fields.contactCopy.value,
                email: fields.contactEmail.value,
                location: fields.contactLocation.value,
                responseTime: fields.contactResponse.value,
                availability: fields.contactAvailability.value,
                note: fields.contactNote.value
              },
              footer: {
                description: fields.footerDescription.value,
                location: fields.footerLocation.value,
                statementLead: fields.footerStatementLead.value,
                statementAccent: fields.footerStatementAccent.value,
                statementNote: fields.footerStatementNote.value,
                copyright: fields.footerCopyright.value,
                builtNote: fields.footerBuiltNote.value
              },
              availabilityBadge: fields.availabilityBadge.value
            }
          })
        });
        toast('Website content saved.');
        await loadData();
        renderTab();
      } catch (err) {
        message.textContent = err.message;
      }
    });

    dashContent.append(form);
  }

  /* ----------------------------- navigation ------------------------------- */

  function renderNavigation() {
    const nav = state.data.nav;
    const primary = textarea('primary', nav.primary.map((link) => `${link.label} | ${link.href}`).join('\n'), { rows: 5 });
    const footerCols = textarea(
      'footerCols',
      nav.footer
        .map((column) => [`## ${column.title}`, ...column.links.map((link) => `${link.label} | ${link.href}`)].join('\n'))
        .join('\n\n'),
      { rows: 12 }
    );
    const message = h('p', { class: 'auth-note', 'aria-live': 'polite', text: '' });

    const form = h('form', { class: 'a-form' },
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Primary navigation' }), h('p', { text: 'Used by the desktop nav and the mobile menu.' }))),
        field('Links', primary, 'One per line as “Label | /link”.')
      ),
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Footer columns' }), h('p', { text: 'Start each column with “## Title”, then one link per line.' }))),
        field('Columns', footerCols, 'Example: ## Navigate followed by Work | /#work')
      ),
      message,
      h('div', { class: 'a-actions' }, h('button', { class: 'a-btn primary', type: 'submit', text: 'Save navigation' }))
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      const primaryLinks = lines(primary.value).map((line) => {
        const idx = line.indexOf('|');
        return idx === -1 ? { label: line, href: '#' } : { label: line.slice(0, idx).trim(), href: line.slice(idx + 1).trim() };
      });
      const columns = [];
      let current = null;
      String(footerCols.value).split(/\r?\n/).forEach((raw) => {
        const line = raw.trim();
        if (!line) return;
        if (line.startsWith('##')) {
          current = { title: line.replace(/^##\s*/, '').trim(), links: [] };
          columns.push(current);
          return;
        }
        if (!current) {
          current = { title: 'Links', links: [] };
          columns.push(current);
        }
        const idx = line.indexOf('|');
        current.links.push(idx === -1 ? { label: line, href: '#' } : { label: line.slice(0, idx).trim(), href: line.slice(idx + 1).trim() });
      });

      try {
        await api('/api/admin/content', {
          method: 'PUT',
          body: JSON.stringify({ nav: { primary: primaryLinks, footer: columns } })
        });
        toast('Navigation saved.');
        await loadData();
        renderTab();
      } catch (err) {
        message.textContent = err.message;
      }
    });

    dashContent.append(form);
  }

  /* --------------------------------- seo ---------------------------------- */

  function renderSeo() {
    const seo = state.data.seo;
    const title = input('title', seo.title);
    const description = textarea('description', seo.description, { rows: 3 });
    const shareImage = input('shareImage', seo.shareImage);
    const canonicalBase = input('canonicalBase', seo.canonicalBase || '', { placeholder: 'https://your-domain.com' });
    const noindex = h('input', { type: 'checkbox', checked: seo.noindex });
    const message = h('p', { class: 'auth-note', 'aria-live': 'polite', text: '' });
    const picker = mediaPicker(shareImage);

    const form = h('form', { class: 'a-form' },
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Site metadata' }), h('p', { text: 'Used for the homepage title, description and social share image.' }))),
        field('Site title', title, 'Up to 60 characters is ideal.', true),
        field('Meta description', description, 'Up to 160 characters is ideal.'),
        h('div', { class: 'row' }, field('Share image URL', shareImage), picker ? field('Media library', picker) : null),
        field('Canonical site URL', canonicalBase, 'Optional. Used for sitemap links when the site is deployed.'),
        h('label', { class: 'a-check' }, noindex, h('span', { text: 'Ask search engines not to index this site (adds noindex and blocks robots.txt).' })),
        message,
        h('div', { class: 'a-actions' }, h('button', { class: 'a-btn primary', type: 'submit', text: 'Save settings' }))
      )
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      try {
        await api('/api/admin/content', {
          method: 'PUT',
          body: JSON.stringify({
            seo: {
              title: title.value,
              description: description.value,
              shareImage: shareImage.value,
              canonicalBase: canonicalBase.value,
              noindex: noindex.checked
            }
          })
        });
        toast('SEO settings saved.');
        await loadData();
        renderTab();
      } catch (err) {
        message.textContent = err.message;
      }
    });

    dashContent.append(form);
  }

  /* -------------------------------- account -------------------------------- */

  function renderAccount() {
    const admin = state.data.admin;
    const current = input('currentPassword', '', { type: 'password', autocomplete: 'current-password' });
    const next = input('newPassword', '', { type: 'password', autocomplete: 'new-password' });
    const confirm = input('confirmPassword', '', { type: 'password', autocomplete: 'new-password' });
    const pwMessage = h('p', { class: 'auth-note', 'aria-live': 'polite', text: '' });

    const pwForm = h('form', { class: 'a-form' },
      field('Current password', current, null, true),
      h('div', { class: 'row' }, field('New password', next, 'At least 12 characters with upper case, lower case and a number.', true), field('Confirm new password', confirm, null, true)),
      pwMessage,
      h('div', { class: 'a-actions' }, h('button', { class: 'a-btn primary', type: 'submit', text: 'Update password' }))
    );

    pwForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      pwMessage.textContent = '';
      if (next.value !== confirm.value) {
        pwMessage.textContent = 'Passwords do not match.';
        return;
      }
      try {
        await api('/api/admin/account/password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword: current.value, newPassword: next.value })
        });
        pwForm.reset();
        toast('Password updated. Other sessions were signed out.');
        await loadData();
        renderTab();
      } catch (err) {
        pwMessage.textContent = err.message;
      }
    });

    const mfaHost = h('div', {});
    const resetMfa = h('button', { class: 'a-btn', type: 'button', text: 'Reset authenticator' });
    resetMfa.addEventListener('click', async () => {
      if (!confirmAction('Reset the authenticator? You will need to add the new secret before your next sign-in.')) return;
      const currentPassword = window.prompt('Enter your current password to reset MFA.');
      if (currentPassword === null) return;
      try {
        const result = await api('/api/admin/account/mfa/start', { method: 'POST', body: JSON.stringify({ currentPassword }) });
        mfaHost.textContent = '';
        const code = input('code', '', { inputmode: 'numeric', maxlength: '6', placeholder: '6-digit code' });
        const msg = h('p', { class: 'auth-note', text: '' });
        mfaHost.append(
          window.createAuthenticatorQr(result.otpauthUri),
          h('p', { class: 'auth-note', text: 'Scan the QR code, or enter the setup key below manually. Then confirm with the current code:' }),
          h('div', { class: 'secret-box', text: result.secret }),
          h('div', { class: 'a-actions' },
            h('a', { class: 'a-btn a-btn-sm', href: result.otpauthUri, text: 'Open in app' }),
            h('button', {
              class: 'a-btn a-btn-sm',
              type: 'button',
              text: 'Copy',
              onclick: async () => {
                try {
                  await navigator.clipboard.writeText(result.secret);
                  toast('Secret copied.');
                } catch (err) {
                  toast('Copy failed — select the text manually.', true);
                }
              }
            })
          ),
          field('Authenticator code', code),
          msg,
          h('button', {
            class: 'a-btn primary',
            type: 'button',
            text: 'Confirm new authenticator',
            onclick: async () => {
              const confirmPassword = window.prompt('Confirm your current password to finish the MFA reset.');
              if (confirmPassword === null) return;
              try {
                await api('/api/admin/account/mfa/confirm', { method: 'POST', body: JSON.stringify({ code: code.value.trim(), currentPassword: confirmPassword }) });
                toast('Authenticator updated. Other sessions were signed out.');
                await loadData();
                renderTab();
              } catch (err) {
                msg.textContent = err.message;
              }
            }
          })
        );
      } catch (err) {
        toast(err.message, true);
      }
    });

    const sessionsTable = h('div', { class: 'a-table-wrap' },
      h('table', { class: 'a-table' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Session' }), h('th', { text: 'Started' }), h('th', { text: 'Last seen' }), h('th', { text: 'IP' }), h('th', { text: '' }))),
        h('tbody', {}, ...state.data.sessions.map((session) =>
          h('tr', {},
            h('td', {}, h('strong', { text: session.current ? 'This device' : 'Signed in' }), h('div', { class: 'media-meta', text: session.userAgent || '' })),
            h('td', { text: formatDate(session.createdAt) }),
            h('td', { text: formatDate(session.lastSeenAt) }),
            h('td', { text: session.ip || '—' }),
            h('td', {}, session.current
              ? null
              : h('button', { class: 'a-btn a-btn-sm', type: 'button', text: 'Revoke', onclick: () => revokeSession(session.id) })
            )
          )
        ))
      )
    );

    dashContent.append(
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Account' }), h('p', { text: admin.email }))),
        h('p', { class: 'auth-note', text: `Two-factor authentication: ${admin.mfaEnabled ? 'enabled (authenticator app)' : 'disabled'}. Last sign-in: ${formatDate(admin.lastLoginAt)}.` })
      ),
      h('section', { class: 'a-card' }, h('div', { class: 'a-card-head' }, h('h2', { text: 'Change password' })), pwForm),
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Authenticator app' }), h('p', { text: 'Codes are verified on the server. The secret is never exposed by the public API.' }))),
        h('div', { class: 'a-actions' }, resetMfa),
        mfaHost
      ),
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Active sessions' }), h('p', { text: 'Sessions expire after 8 hours. Revoke any device you do not recognise.' }))),
        sessionsTable
      )
    );
  }

  async function revokeSession(id) {
    if (!confirmAction('Revoke this session?')) return;
    try {
      await api(`/api/admin/sessions/${id}/revoke`, { method: 'POST', body: '{}' });
      toast('Session revoked.');
      await loadData();
      renderTab();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* -------------------------------- activity ------------------------------- */

  function renderActivity() {
    const activity = state.data.activity;
    dashContent.append(
      h('section', { class: 'a-card' },
        h('div', { class: 'a-card-head' }, h('div', {}, h('h2', { text: 'Activity history' }), h('p', { text: 'The most recent 100 admin and content events.' }))),
        activity.length
          ? h('div', { class: 'a-table-wrap' },
              h('table', { class: 'a-table' },
                h('thead', {}, h('tr', {}, h('th', { text: 'When' }), h('th', { text: 'Action' }), h('th', { text: 'Item' }), h('th', { text: 'By' }))),
                h('tbody', {}, ...activity.map((entry) =>
                  h('tr', {},
                    h('td', { text: formatDate(entry.at) }),
                    h('td', {}, h('strong', { text: entry.action })),
                    h('td', { text: `${entry.entity}${entry.meta ? ` · ${entry.meta}` : ''}` }),
                    h('td', { text: entry.actor })
                  )
                ))
              )
            )
          : h('p', { class: 'a-empty', text: 'No activity recorded yet.' })
      )
    );
  }

  /* --------------------------------- boot --------------------------------- */

  logoutBtn?.addEventListener('click', async () => {
    try {
      await api('/api/admin/logout', { method: 'POST', body: '{}' });
      location.replace(LOGIN_URL);
    } catch (err) {
      toast('Could not sign out. Please try again.', true);
    }
  });

  async function boot() {
    if (!isLoginPage) {
      await enterDashboard();
      return;
    }
    try {
      await api('/api/admin/session');
      location.replace(DASHBOARD_URL);
      return;
    } catch (err) {
      if (err.status !== 401) {
        // fall through to sign-in; server errors are shown after submit
      }
    }
    try {
      const status = await api('/api/admin/status');
      if (status.hasAdmin) showLogin();
      else showSetup();
    } catch (err) {
      showLogin('The server could not be reached. Make sure it is running.');
    }
  }

  boot();
})();

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbModule = require('./db');
const auth = require('./auth');
const totp = require('./totp');

const ROOT = dbModule.ROOT;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const MAX_JSON = 1024 * 1024; // 1 MB for regular JSON
const MAX_UPLOAD_JSON = 8 * 1024 * 1024; // base64 payload for images
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* -------------------------------- helpers -------------------------------- */

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || null;
  }
}

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, 'Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req, limit = MAX_JSON) {
  const raw = await readBody(req, limit);
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  return parsed;
}

function str(value, max = 500) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim()
    .slice(0, max);
}

function strArray(value, maxItems = 30, maxLen = 300) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => str(v, maxLen)).filter(Boolean).slice(0, maxItems);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(db, collection, slug, ignoreId) {
  const base = slug || 'item';
  let candidate = base;
  let n = 2;
  while (db[collection].some((item) => item.slug === candidate && item.id !== ignoreId)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

function safeUrl(value, { allowMail = true } = {}) {
  const url = str(value, 500);
  if (!url) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('#')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (allowMail && /^mailto:[^\s]+$/i.test(url)) return url;
  return '';
}

function publicReview(review) {
  return {
    id: review.id,
    displayName: review.displayName,
    rating: review.rating,
    text: review.text,
    createdAt: review.createdAt,
    projectSlug: review.projectSlug,
    projectTitle: review.projectTitle
  };
}

function approvedReviews(projectSlug) {
  return dbModule
    .load()
    .reviews.filter((r) => r.status === 'approved' && r.projectSlug === projectSlug)
    .sort((a, b) => new Date(b.approvedAt || b.createdAt) - new Date(a.approvedAt || a.createdAt))
    .map(publicReview);
}

function ratingSummary(reviews) {
  if (!reviews.length) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { average: Math.round((total / reviews.length) * 10) / 10, count: reviews.length };
}

function publicProject(project, services) {
  return {
    slug: project.slug,
    title: project.title,
    subtitle: project.subtitle,
    client: project.client,
    category: project.category,
    year: project.year,
    shortDescription: project.shortDescription,
    challenge: project.challenge,
    approach: project.approach,
    deliverables: project.deliverables || [],
    outcome: project.outcome || '',
    tags: project.tags || [],
    cover: project.cover || '',
    coverAlt: project.coverAlt || project.title,
    gallery: project.gallery || [],
    facts: project.facts || [],
    services: (project.services || [])
      .map((slug) => services.find((s) => s.slug === slug && s.status === 'published'))
      .filter(Boolean)
      .map((s) => ({ slug: s.slug, name: s.name, summary: s.summary })),
    seoTitle: project.seoTitle || project.title,
    seoDescription: project.seoDescription || project.shortDescription || '',
    updatedAt: project.updatedAt
  };
}

function publicService(service) {
  return {
    slug: service.slug,
    name: service.name,
    summary: service.summary,
    description: service.description,
    included: service.included || [],
    idealFor: service.idealFor,
    process: service.process || [],
    relatedProjects: service.relatedProjects || [],
    cover: service.cover || '',
    coverAlt: service.coverAlt || service.name,
    priceLabel: service.priceLabel || 'Request a quote',
    ctaLabel: service.ctaLabel || 'Start a project',
    ctaHref: service.ctaHref || '/#contact',
    seoTitle: service.seoTitle || service.name,
    seoDescription: service.seoDescription || service.summary || ''
  };
}

function sortByOrder(list) {
  return list.slice().sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title || a.name).localeCompare(String(b.title || b.name)));
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function requireBootstrapToken(req) {
  const expected = String(process.env.ADMIN_BOOTSTRAP_TOKEN || '');
  const supplied = String(req.headers['x-admin-bootstrap-token'] || '');
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (!expected || !supplied || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpError(403, 'First-time setup is disabled or the setup token is incorrect.');
  }
}

function ipHash(req) {
  const db = dbModule.load();
  if (!db.settings.ipSalt) {
    db.settings.ipSalt = crypto.randomBytes(16).toString('hex');
    dbModule.save();
  }
  return crypto.createHash('sha256').update(db.settings.ipSalt + clientIp(req)).digest('hex').slice(0, 32);
}

function audit(actor, action, entity, entityId, meta) {
  dbModule.logActivity(actor, action, entity, entityId, meta);
}

/* --------------------------- normalisers --------------------------------- */

function normalizeProject(input, existing) {
  const db = dbModule.load();
  const title = str(input.title, 120);
  if (!title) throw new HttpError(422, 'Project title is required.');
  let slug = slugify(input.slug || title);
  if (!slug || !SLUG_RE.test(slug)) throw new HttpError(422, 'Project slug must use lowercase letters, numbers and hyphens.');
  slug = uniqueSlug(db, 'projects', slug, existing && existing.id);

  const facts = Array.isArray(input.facts)
    ? input.facts
        .map((f) => ({ value: str(f && f.value, 20), label: str(f && f.label, 60) }))
        .filter((f) => f.value || f.label)
        .slice(0, 6)
    : [];

  const gallery = Array.isArray(input.gallery)
    ? input.gallery
        .map((item) => {
          if (typeof item === 'string') {
            const url = safeUrl(item, { allowMail: false });
            return url ? { url, alt: '' } : null;
          }
          const url = safeUrl(item && item.url, { allowMail: false });
          return url ? { url, alt: str(item.alt, 200) } : null;
        })
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const status = input.status === 'draft' ? 'draft' : 'published';
  const order = Number.isFinite(Number(input.order)) ? Number(input.order) : (existing && existing.order) || 99;

  return {
    slug,
    title,
    subtitle: str(input.subtitle, 140),
    client: str(input.client, 120),
    category: str(input.category, 80),
    year: str(input.year, 12),
    shortDescription: str(input.shortDescription, 300),
    challenge: str(input.challenge, 4000),
    approach: str(input.approach, 4000),
    deliverables: strArray(input.deliverables, 20, 200),
    outcome: str(input.outcome, 2000),
    tags: strArray(input.tags, 10, 40),
    cover: safeUrl(input.cover, { allowMail: false }),
    coverAlt: str(input.coverAlt, 200),
    gallery,
    services: Array.isArray(input.services)
      ? input.services.map((s) => slugify(s)).filter(Boolean).slice(0, 8)
      : [],
    facts,
    seoTitle: str(input.seoTitle, 120),
    seoDescription: str(input.seoDescription, 300),
    status,
    order: Math.max(0, Math.min(999, Math.round(order))),
    archived: input.archived === true
  };
}

function normalizeService(input, existing) {
  const db = dbModule.load();
  const name = str(input.name, 120);
  if (!name) throw new HttpError(422, 'Service name is required.');
  let slug = slugify(input.slug || name);
  if (!slug || !SLUG_RE.test(slug)) throw new HttpError(422, 'Service slug must use lowercase letters, numbers and hyphens.');
  slug = uniqueSlug(db, 'services', slug, existing && existing.id);

  const process = Array.isArray(input.process)
    ? input.process
        .map((step) => ({
          title: str(step && step.title, 120),
          description: str(step && step.description, 500)
        }))
        .filter((step) => step.title)
        .slice(0, 12)
    : [];

  const status = input.status === 'draft' ? 'draft' : 'published';
  const priceLabel = str(input.priceLabel, 60) || 'Request a quote';

  return {
    slug,
    name,
    summary: str(input.summary, 300),
    description: str(input.description, 6000),
    included: strArray(input.included, 20, 200),
    idealFor: str(input.idealFor, 400),
    process,
    relatedProjects: Array.isArray(input.relatedProjects)
      ? input.relatedProjects.map((p) => slugify(p)).filter(Boolean).slice(0, 12)
      : [],
    cover: safeUrl(input.cover, { allowMail: false }),
    coverAlt: str(input.coverAlt, 200),
    priceLabel,
    ctaLabel: str(input.ctaLabel, 60) || 'Start a project',
    ctaHref: safeUrl(input.ctaHref) || '/#contact',
    seoTitle: str(input.seoTitle, 120),
    seoDescription: str(input.seoDescription, 300),
    status,
    order: Number.isFinite(Number(input.order)) ? Math.max(0, Math.min(999, Number(input.order))) : (existing && existing.order) || 99,
    archived: input.archived === true
  };
}

function normalizeContent(input) {
  const current = dbModule.load().content;
  const hero = { ...current.hero, ...(input.hero || {}) };
  const about = { ...current.about, ...(input.about || {}) };
  const contact = { ...current.contact, ...(input.contact || {}) };
  const footer = { ...current.footer, ...(input.footer || {}) };

  const text = (v, max) => str(v, max);
  const next = {
    hero: {
      eyebrow: text(hero.eyebrow, 80),
      titleLead: text(hero.titleLead, 60),
      titleBreak: text(hero.titleBreak, 30),
      titleAccent: text(hero.titleAccent, 40),
      lede: text(hero.lede, 300),
      primaryCtaLabel: text(hero.primaryCtaLabel, 40),
      primaryCtaHref: safeUrl(hero.primaryCtaHref) || '/#work',
      secondaryCtaLabel: text(hero.secondaryCtaLabel, 40),
      secondaryCtaHref: safeUrl(hero.secondaryCtaHref) || '/#contact',
      stats: Array.isArray(hero.stats)
        ? hero.stats
            .map((s) => ({ value: str(s && s.value, 20), label: str(s && s.label, 60) }))
            .filter((s) => s.value || s.label)
            .slice(0, 4)
        : current.hero.stats
    },
    about: {
      label: text(about.label, 40),
      titleLead: text(about.titleLead, 80),
      titleAccent: text(about.titleAccent, 40),
      lede: text(about.lede, 2000),
      quote: text(about.quote, 400),
      signature: text(about.signature, 60),
      note: text(about.note, 80),
      based: text(about.based, 80),
      focus: text(about.focus, 80),
      status: text(about.status, 40)
    },
    contact: {
      heading: text(contact.heading, 100),
      copy: text(contact.copy, 300),
      email: text(contact.email, 120),
      location: text(contact.location, 80),
      responseTime: text(contact.responseTime, 60),
      availability: text(contact.availability, 80),
      note: text(contact.note, 80)
    },
    footer: {
      description: text(footer.description, 300),
      location: text(footer.location, 80),
      statementLead: text(footer.statementLead, 40),
      statementAccent: text(footer.statementAccent, 40),
      statementNote: text(footer.statementNote, 80),
      copyright: text(footer.copyright, 120),
      builtNote: text(footer.builtNote, 100)
    },
    availabilityBadge: text(input.availabilityBadge !== undefined ? input.availabilityBadge : current.availabilityBadge, 60)
  };
  return next;
}

function normalizeNav(input) {
  const current = dbModule.load().nav;
  const links = (value, max) =>
    Array.isArray(value)
      ? value
          .map((link) => ({ label: str(link && link.label, 40), href: safeUrl(link && link.href) }))
          .filter((link) => link.label)
          .slice(0, max)
      : [];
  return {
    primary: input.primary ? links(input.primary, 8) : current.primary,
    footer: Array.isArray(input.footer)
      ? input.footer
          .map((column) => ({ title: str(column && column.title, 40), links: links(column && column.links, 10) }))
          .filter((column) => column.title)
          .slice(0, 5)
      : current.footer
  };
}

function normalizeSeo(input) {
  const current = dbModule.load().seo;
  return {
    title: str(input.title !== undefined ? input.title : current.title, 160),
    description: str(input.description !== undefined ? input.description : current.description, 300),
    shareImage: safeUrl(input.shareImage !== undefined ? input.shareImage : current.shareImage, { allowMail: false }),
    canonicalBase: safeUrl(input.canonicalBase !== undefined ? input.canonicalBase : current.canonicalBase),
    noindex: input.noindex === true
  };
}

/* ------------------------------ public API ------------------------------- */

function sitePayload() {
  const db = dbModule.load();
  const services = sortByOrder(db.services.filter((s) => s.status === 'published' && !s.archived));
  const projects = sortByOrder(db.projects.filter((p) => p.status === 'published' && !p.archived));
  return {
    content: db.content,
    nav: db.nav,
    seo: db.seo,
    services: services.map((s) => ({
      ...publicService(s),
      projectCount: (s.relatedProjects || []).filter((slug) => projects.some((p) => p.slug === slug)).length
    })),
    projects: projects.map((p) => publicProject(p, services))
  };
}

function projectPayload(req, slug) {
  const db = dbModule.load();
  const project = db.projects.find((p) => p.slug === slug);
  if (!project) throw new HttpError(404, 'Project not found.');
  const isPreview = String(req.query.preview || '') === '1';
  if (isPreview) {
    if (!auth.getSession(req)) throw new HttpError(401, 'Preview requires an admin session.');
  } else if (project.status !== 'published' || project.archived) {
    throw new HttpError(404, 'Project not found.');
  }
  const services = sortByOrder(db.services.filter((s) => s.status === 'published' && !s.archived));
  const reviews = approvedReviews(project.slug);
  return {
    project: publicProject(project, services),
    reviews,
    rating: ratingSummary(reviews),
    preview: isPreview && (project.status !== 'published' || project.archived)
  };
}

function servicePayload(req, slug) {
  const db = dbModule.load();
  const service = db.services.find((s) => s.slug === slug);
  if (!service) throw new HttpError(404, 'Service not found.');
  const isPreview = String(req.query.preview || '') === '1';
  if (isPreview) {
    if (!auth.getSession(req)) throw new HttpError(401, 'Preview requires an admin session.');
  } else if (service.status !== 'published' || service.archived) {
    throw new HttpError(404, 'Service not found.');
  }
  const projects = sortByOrder(db.projects.filter((p) => p.status === 'published' && !p.archived));
  return {
    service: publicService(service),
    relatedProjects: (service.relatedProjects || [])
      .map((s) => projects.find((p) => p.slug === s))
      .filter(Boolean)
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        category: p.category,
        year: p.year,
        cover: p.cover,
        coverAlt: p.coverAlt
      })),
    preview: isPreview && (service.status !== 'published' || service.archived)
  };
}

function submitReview(req, body) {
  const db = dbModule.load();
  const honeypot = str(body.website, 100);
  if (honeypot) throw new HttpError(400, 'Review could not be submitted.');

  const displayName = str(body.displayName, 40);
  const text = str(body.text, 1200);
  const rating = Math.round(Number(body.rating));
  const projectSlug = slugify(body.projectSlug);
  const consent = body.consent === true;

  if (displayName.length < 2) throw new HttpError(422, 'Please enter a display name of at least 2 characters.');
  if (/@[^\s@]+\.[^\s@]{2,}/.test(displayName) || /https?:\/\//i.test(displayName)) {
    throw new HttpError(422, 'Display names cannot contain email addresses or links.');
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new HttpError(422, 'Please choose a rating from 1 to 5.');
  if (text.length < 10) throw new HttpError(422, 'Please write at least 10 characters.');
  if (!consent) throw new HttpError(422, 'Please confirm that your review may be displayed publicly.');

  const project = db.projects.find((p) => p.slug === projectSlug && p.status === 'published' && !p.archived);
  if (!project) throw new HttpError(422, 'Please choose the project this review belongs to.');

  const hash = ipHash(req);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = db.reviews.filter((r) => r.ipHash === hash && new Date(r.createdAt).getTime() > dayAgo);
  if (recent.length >= 5) throw new HttpError(429, 'You have submitted several reviews today. Please try again later.');
  if (recent.some((r) => r.text.toLowerCase() === text.toLowerCase())) {
    throw new HttpError(429, 'This review has already been submitted.');
  }

  const review = {
    id: dbModule.uid('rev_'),
    projectSlug: project.slug,
    projectTitle: project.title,
    displayName,
    rating,
    text,
    consent: true,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: null,
    moderatedAt: null,
    moderatedBy: null,
    ipHash: hash,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200)
  };
  db.reviews.unshift(review);
  audit('visitor', 'review.submitted', 'review', review.id, project.slug);
  return { ok: true, message: 'Thanks — your review is awaiting approval.', id: review.id };
}

/* ------------------------------- admin API ------------------------------- */

function requireAdminOrThrow(req) {
  const found = auth.requireAdmin(req);
  if (!found) throw new HttpError(401, 'Sign in required.');
  return found;
}

function adminSnapshot(found) {
  const db = dbModule.load();
  auth.pruneExpired(db);
  const projects = sortByOrder(db.projects);
  const services = sortByOrder(db.services);
  return {
    admin: {
      id: found.admin.id,
      email: found.admin.email,
      mfaEnabled: found.admin.mfaEnabled,
      lastLoginAt: found.admin.lastLoginAt,
      createdAt: found.admin.createdAt
    },
    sessionId: found.session.id,
    projects,
    services,
    reviews: db.reviews.map((r) => ({
      id: r.id,
      projectSlug: r.projectSlug,
      projectTitle: r.projectTitle,
      displayName: r.displayName,
      rating: r.rating,
      text: r.text,
      consent: r.consent,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      moderatedAt: r.moderatedAt
    })),
    media: db.media,
    content: db.content,
    nav: db.nav,
    seo: db.seo,
    activity: db.activity.slice(0, 100),
    sessions: db.sessions
      .filter((s) => s.adminId === found.admin.id)
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        ip: s.ip,
        userAgent: s.userAgent,
        current: s.id === found.session.id
      })),
    counts: {
      projects: projects.filter((p) => !p.archived).length,
      publishedProjects: projects.filter((p) => p.status === 'published' && !p.archived).length,
      services: services.filter((s) => !s.archived).length,
      publishedServices: services.filter((s) => s.status === 'published' && !s.archived).length,
      pendingReviews: db.reviews.filter((r) => r.status === 'pending').length,
      approvedReviews: db.reviews.filter((r) => r.status === 'approved').length,
      media: db.media.length
    }
  };
}

function upsertProject(req, body, id) {
  const db = dbModule.load();
  const existing = id ? db.projects.find((p) => p.id === id) : null;
  if (id && !existing) throw new HttpError(404, 'Project not found.');
  const data = normalizeProject(body, existing);
  if (existing) {
    Object.assign(existing, data, { updatedAt: new Date().toISOString() });
    audit(req.adminEmail, 'project.updated', 'project', existing.id, existing.slug);
    return existing;
  }
  const created = {
    id: dbModule.uid('prj_'),
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.projects.push(created);
  audit(req.adminEmail, 'project.created', 'project', created.id, created.slug);
  return created;
}

function upsertService(req, body, id) {
  const db = dbModule.load();
  const existing = id ? db.services.find((s) => s.id === id) : null;
  if (id && !existing) throw new HttpError(404, 'Service not found.');
  const data = normalizeService(body, existing);
  if (existing) {
    Object.assign(existing, data, { updatedAt: new Date().toISOString() });
    audit(req.adminEmail, 'service.updated', 'service', existing.id, existing.slug);
    return existing;
  }
  const created = {
    id: dbModule.uid('srv_'),
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.services.push(created);
  audit(req.adminEmail, 'service.created', 'service', created.id, created.slug);
  return created;
}

function imageMeta(buffer) {
  if (buffer.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Images must be 5 MB or smaller.');
  if (buffer.length < 12) throw new HttpError(422, 'The uploaded file is not a valid image.');
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' };
  }
  const gifHead = buffer.slice(0, 6).toString('ascii');
  if (gifHead === 'GIF87a' || gifHead === 'GIF89a') return { ext: 'gif', mime: 'image/gif' };
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  throw new HttpError(422, 'Only JPEG, PNG, GIF or WebP images are allowed.');
}

function decodeUpload(body) {
  let base64 = str(body.dataUrl, 12 * 1024 * 1024);
  if (!base64) throw new HttpError(422, 'Please choose an image to upload.');
  const match = /^data:([a-z0-9/+.-]+);base64,(.+)$/i.exec(base64);
  if (match) {
    base64 = match[2];
  }
  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (err) {
    throw new HttpError(422, 'The image data could not be read.');
  }
  const meta = imageMeta(buffer);
  return { buffer, ...meta };
}

function writeUpload(buffer, ext) {
  if (process.env.VERCEL) {
    throw new HttpError(503, 'Image uploads are unavailable on this deployment until persistent file storage is configured.');
  }
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return { filename, url: `/uploads/${filename}` };
}

function mediaReferences(url) {
  const db = dbModule.load();
  const refs = [];
  db.projects.forEach((p) => {
    if (p.cover === url) refs.push({ type: 'project', slug: p.slug, field: 'cover' });
    (p.gallery || []).forEach((img, i) => {
      if (img.url === url) refs.push({ type: 'project', slug: p.slug, field: `gallery[${i}]` });
    });
  });
  db.services.forEach((s) => {
    if (s.cover === url) refs.push({ type: 'service', slug: s.slug, field: 'cover' });
  });
  if (db.seo.shareImage === url) refs.push({ type: 'seo', slug: 'site', field: 'shareImage' });
  return refs;
}

function replaceUrlEverywhere(oldUrl, newUrl) {
  const db = dbModule.load();
  db.projects.forEach((p) => {
    if (p.cover === oldUrl) p.cover = newUrl;
    (p.gallery || []).forEach((img) => {
      if (img.url === oldUrl) img.url = newUrl;
    });
  });
  db.services.forEach((s) => {
    if (s.cover === oldUrl) s.cover = newUrl;
  });
  if (db.seo.shareImage === oldUrl) db.seo.shareImage = newUrl;
}

function deleteUploadFile(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  fs.promises.unlink(file).catch(() => {});
}

async function handleAdminApi(req, res, url) {
  const p = url.pathname;

  /* --- public admin endpoints (bootstrap) --- */
  if (p === '/api/admin/status' && req.method === 'GET') {
    const db = dbModule.load();
    return sendJson(res, 200, { hasAdmin: db.admins.length > 0 });
  }

  if (p === '/api/admin/bootstrap/start' && req.method === 'POST') {
    requireBootstrapToken(req);
    const db = dbModule.load();
    if (db.admins.length) throw new HttpError(409, 'An administrator already exists.');
    const body = await readJson(req);
    const email = str(body.email, 160).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(422, 'Enter a valid email address.');
    const secret = totp.generateSecret();
    db.settings.bootstrap = {
      email,
      secret,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString()
    };
    await dbModule.save();
    return sendJson(res, 200, {
      email,
      secret,
      otpauthUri: totp.otpauthUri({ secret, email }),
      issuer: 'Kuldeep Malviya Portfolio'
    });
  }

  if (p === '/api/admin/bootstrap/complete' && req.method === 'POST') {
    requireBootstrapToken(req);
    const db = dbModule.load();
    if (db.admins.length) throw new HttpError(409, 'An administrator already exists.');
    const body = await readJson(req);
    const pending = db.settings.bootstrap;
    if (!pending || new Date(pending.expiresAt).getTime() < Date.now()) {
      throw new HttpError(400, 'Setup expired. Start the setup again.');
    }
    if (str(body.email, 160).toLowerCase() !== pending.email) throw new HttpError(400, 'Email does not match the setup request.');
    const problems = auth.passwordProblems(body.password);
    if (problems.length) throw new HttpError(422, `Password needs ${problems.join(', ')}.`);
    if (!totp.verifyTotp(pending.secret, body.code)) throw new HttpError(422, 'That authenticator code is not valid.');
    const admin = {
      id: dbModule.uid('adm_'),
      email: pending.email,
      role: 'owner',
      passwordHash: auth.hashPassword(body.password),
      totpSecret: pending.secret,
      mfaEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      pendingTotpSecret: null
    };
    db.admins.push(admin);
    delete db.settings.bootstrap;
    audit(admin.email, 'admin.bootstrap', 'admin', admin.id);
    const { raw, session } = auth.createSession(req, admin, body.rememberDevice !== false);
    await dbModule.save();
    auth.setSessionCookie(req, res, raw, new Date(session.expiresAt).getTime() - Date.now());
    return sendJson(res, 201, { ok: true, admin: { email: admin.email, mfaEnabled: true } });
  }

  /* --- login --- */
  if (p === '/api/admin/login' && req.method === 'POST') {
    const db = dbModule.load();
    auth.pruneExpired(db);
    const body = await readJson(req);
    const email = str(body.email, 160).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const key = auth.attemptKey(email, clientIp(req));
    const lock = auth.lockState(key);
    if (lock.locked) {
      throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(lock.remaining / 60)} minute(s).`);
    }
    const admin = db.admins.find((a) => a.email.toLowerCase() === email);
    const ok = admin ? auth.verifyPassword(password, admin.passwordHash) : false;
    if (!ok) {
      auth.recordFailure(key);
      await dbModule.save();
      throw new HttpError(401, 'Email or password is incorrect.');
    }
    auth.clearFailures(key);
    if (admin.mfaEnabled) {
      const raw = auth.token();
      db.mfaChallenges.push({
        id: dbModule.uid('mfa_'),
        adminId: admin.id,
        tokenHash: auth.sha256(raw),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + auth.MFA_TTL_MS).toISOString(),
        attempts: 0,
        rememberDevice: body.rememberDevice !== false,
        used: false
      });
      await dbModule.save();
      return sendJson(res, 200, { mfaRequired: true, challenge: raw });
    }
    const { raw, session } = auth.createSession(req, admin, body.rememberDevice !== false);
    admin.lastLoginAt = new Date().toISOString();
    audit(admin.email, 'admin.login', 'admin', admin.id);
    await dbModule.save();
    auth.setSessionCookie(req, res, raw, new Date(session.expiresAt).getTime() - Date.now());
    return sendJson(res, 200, { ok: true, admin: { email: admin.email, mfaEnabled: false } });
  }

  if (p === '/api/admin/login/mfa' && req.method === 'POST') {
    const db = dbModule.load();
    const body = await readJson(req);
    const challengeToken = str(body.challenge, 200);
    const hash = auth.sha256(challengeToken);
    const challenge = db.mfaChallenges.find((c) => c.tokenHash === hash && !c.used);
    if (!challenge || new Date(challenge.expiresAt).getTime() < Date.now()) {
      throw new HttpError(401, 'This sign-in attempt expired. Start again.');
    }
    const admin = db.admins.find((a) => a.id === challenge.adminId);
    if (!admin) throw new HttpError(401, 'This sign-in attempt expired. Start again.');
    if (challenge.attempts >= 5) {
      challenge.used = true;
      await dbModule.save();
      throw new HttpError(429, 'Too many codes entered. Start again.');
    }
    if (!totp.verifyTotp(admin.totpSecret, body.code)) {
      challenge.attempts += 1;
      await dbModule.save();
      throw new HttpError(401, 'That authenticator code is not valid.');
    }
    challenge.used = true;
    const { raw, session } = auth.createSession(req, admin, challenge.rememberDevice !== false);
    admin.lastLoginAt = new Date().toISOString();
    audit(admin.email, 'admin.login', 'admin', admin.id, 'mfa');
    await dbModule.save();
    auth.setSessionCookie(req, res, raw, new Date(session.expiresAt).getTime() - Date.now());
    return sendJson(res, 200, { ok: true, admin: { email: admin.email, mfaEnabled: true } });
  }

  /* --- everything below requires a session --- */
  const found = requireAdminOrThrow(req);
  req.adminEmail = found.admin.email;

  if (p === '/api/admin/session' && req.method === 'GET') {
    await auth.rememberLegacySession(req, res, found);
    return sendJson(res, 200, adminSnapshot(found));
  }

  if (p === '/api/admin/logout' && req.method === 'POST') {
    auth.revokeSession(found.session.id);
    audit(found.admin.email, 'admin.logout', 'admin', found.admin.id);
    await dbModule.save();
    auth.clearSessionCookie(req, res);
    return sendJson(res, 200, { ok: true });
  }

  /* --- projects --- */
  if (p === '/api/admin/projects' && req.method === 'POST') {
    const body = await readJson(req);
    const created = upsertProject(req, body, null);
    await dbModule.save();
    return sendJson(res, 201, { project: created });
  }
  const projectMatch = /^\/api\/admin\/projects\/([^/]+)$/.exec(p);
  if (projectMatch) {
    const id = projectMatch[1];
    const db = dbModule.load();
    const project = db.projects.find((x) => x.id === id);
    if (!project) throw new HttpError(404, 'Project not found.');
    if (req.method === 'PUT') {
      const body = await readJson(req);
      const updated = upsertProject(req, body, id);
      await dbModule.save();
      return sendJson(res, 200, { project: updated });
    }
    if (req.method === 'DELETE') {
      const permanent = String(url.query.permanent || '') === '1';
      if (permanent) {
        db.projects = db.projects.filter((x) => x.id !== id);
        audit(found.admin.email, 'project.deleted', 'project', id, project.slug);
      } else {
        project.archived = true;
        project.updatedAt = new Date().toISOString();
        audit(found.admin.email, 'project.archived', 'project', id, project.slug);
      }
      await dbModule.save();
      return sendJson(res, 200, { ok: true, permanent });
    }
    if (req.method === 'GET') return sendJson(res, 200, { project });
  }

  /* --- services --- */
  if (p === '/api/admin/services' && req.method === 'POST') {
    const body = await readJson(req);
    const created = upsertService(req, body, null);
    await dbModule.save();
    return sendJson(res, 201, { service: created });
  }
  const serviceMatch = /^\/api\/admin\/services\/([^/]+)$/.exec(p);
  if (serviceMatch) {
    const id = serviceMatch[1];
    const db = dbModule.load();
    const service = db.services.find((x) => x.id === id);
    if (!service) throw new HttpError(404, 'Service not found.');
    if (req.method === 'PUT') {
      const body = await readJson(req);
      const updated = upsertService(req, body, id);
      await dbModule.save();
      return sendJson(res, 200, { service: updated });
    }
    if (req.method === 'DELETE') {
      const permanent = String(url.query.permanent || '') === '1';
      if (permanent) {
        db.services = db.services.filter((x) => x.id !== id);
        audit(found.admin.email, 'service.deleted', 'service', id, service.slug);
      } else {
        service.archived = true;
        service.updatedAt = new Date().toISOString();
        audit(found.admin.email, 'service.archived', 'service', id, service.slug);
      }
      await dbModule.save();
      return sendJson(res, 200, { ok: true, permanent });
    }
    if (req.method === 'GET') return sendJson(res, 200, { service });
  }

  /* --- reviews --- */
  const reviewStatusMatch = /^\/api\/admin\/reviews\/([^/]+)\/status$/.exec(p);
  if (reviewStatusMatch && req.method === 'POST') {
    const db = dbModule.load();
    const review = db.reviews.find((r) => r.id === reviewStatusMatch[1]);
    if (!review) throw new HttpError(404, 'Review not found.');
    const body = await readJson(req);
    const status = ['pending', 'approved', 'rejected', 'hidden'].includes(body.status) ? body.status : null;
    if (!status) throw new HttpError(422, 'Unknown review status.');
    review.status = status;
    review.updatedAt = new Date().toISOString();
    review.moderatedAt = review.updatedAt;
    review.moderatedBy = found.admin.email;
    if (status === 'approved') review.approvedAt = review.updatedAt;
    audit(found.admin.email, `review.${status}`, 'review', review.id, review.projectSlug);
    await dbModule.save();
    return sendJson(res, 200, { review });
  }
  const reviewMatch = /^\/api\/admin\/reviews\/([^/]+)$/.exec(p);
  if (reviewMatch) {
    const db = dbModule.load();
    const review = db.reviews.find((r) => r.id === reviewMatch[1]);
    if (!review) throw new HttpError(404, 'Review not found.');
    if (req.method === 'PUT') {
      const body = await readJson(req);
      if (body.displayName !== undefined) {
        const name = str(body.displayName, 40);
        if (name.length < 2) throw new HttpError(422, 'Display name must be at least 2 characters.');
        if (/@[^\s@]+\.[^\s@]{2,}/.test(name)) throw new HttpError(422, 'Display names cannot contain email addresses.');
        review.displayName = name;
      }
      if (body.text !== undefined) {
        const text = str(body.text, 1200);
        if (text.length < 10) throw new HttpError(422, 'Review text must be at least 10 characters.');
        review.text = text;
      }
      if (body.rating !== undefined) {
        const rating = Math.round(Number(body.rating));
        if (!(rating >= 1 && rating <= 5)) throw new HttpError(422, 'Rating must be 1 to 5.');
        review.rating = rating;
      }
      review.updatedAt = new Date().toISOString();
      review.editedBy = found.admin.email;
      audit(found.admin.email, 'review.edited', 'review', review.id, review.projectSlug);
      await dbModule.save();
      return sendJson(res, 200, { review });
    }
    if (req.method === 'DELETE') {
      db.reviews = db.reviews.filter((r) => r.id !== review.id);
      audit(found.admin.email, 'review.deleted', 'review', review.id, review.projectSlug);
      await dbModule.save();
      return sendJson(res, 200, { ok: true });
    }
  }

  /* --- content / nav / seo --- */
  if (p === '/api/admin/content' && req.method === 'PUT') {
    const db = dbModule.load();
    const body = await readJson(req);
    db.content = normalizeContent(body.content || body);
    if (body.nav) db.nav = normalizeNav(body.nav);
    if (body.seo) db.seo = normalizeSeo(body.seo);
    audit(found.admin.email, 'content.updated', 'site', 'site');
    await dbModule.save();
    return sendJson(res, 200, { content: db.content, nav: db.nav, seo: db.seo });
  }

  /* --- media --- */
  if (p === '/api/admin/media' && req.method === 'POST') {
    const db = dbModule.load();
    const body = await readJson(req, MAX_UPLOAD_JSON);
    const { buffer, ext, mime } = decodeUpload(body);
    const { filename, url } = writeUpload(buffer, ext);
    const item = {
      id: dbModule.uid('med_'),
      filename,
      url,
      mime,
      size: buffer.length,
      alt: str(body.alt, 200),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.media.unshift(item);
    audit(found.admin.email, 'media.uploaded', 'media', item.id, filename);
    await dbModule.save();
    return sendJson(res, 201, { media: item });
  }
  const mediaMatch = /^\/api\/admin\/media\/([^/]+)$/.exec(p);
  if (mediaMatch) {
    const db = dbModule.load();
    const item = db.media.find((m) => m.id === mediaMatch[1]);
    if (!item) throw new HttpError(404, 'Media item not found.');
    if (req.method === 'PUT') {
      const body = await readJson(req, MAX_UPLOAD_JSON);
      if (body.alt !== undefined) item.alt = str(body.alt, 200);
      if (body.dataUrl) {
        const { buffer, ext, mime } = decodeUpload(body);
        const oldUrl = item.url;
        const { filename, url } = writeUpload(buffer, ext);
        item.filename = filename;
        item.url = url;
        item.mime = mime;
        item.size = buffer.length;
        replaceUrlEverywhere(oldUrl, url);
        deleteUploadFile(oldUrl);
      }
      item.updatedAt = new Date().toISOString();
      audit(found.admin.email, 'media.updated', 'media', item.id, item.filename);
      await dbModule.save();
      return sendJson(res, 200, { media: item });
    }
    if (req.method === 'DELETE') {
      const refs = mediaReferences(item.url);
      const force = String(url.query.force || '') === '1';
      if (refs.length && !force) {
        throw new HttpError(409, 'This image is still in use. Replace it or remove those references first.', { references: refs });
      }
      db.media = db.media.filter((m) => m.id !== item.id);
      deleteUploadFile(item.url);
      audit(found.admin.email, 'media.deleted', 'media', item.id, item.filename);
      await dbModule.save();
      return sendJson(res, 200, { ok: true });
    }
  }

  /* --- account security --- */
  if (p === '/api/admin/account/password' && req.method === 'POST') {
    const db = dbModule.load();
    const body = await readJson(req);
    if (!auth.verifyPassword(String(body.currentPassword || ''), found.admin.passwordHash)) {
      throw new HttpError(401, 'Current password is incorrect.');
    }
    const problems = auth.passwordProblems(body.newPassword);
    if (problems.length) throw new HttpError(422, `Password needs ${problems.join(', ')}.`);
    if (body.newPassword === body.currentPassword) throw new HttpError(422, 'Choose a password you have not used before.');
    found.admin.passwordHash = auth.hashPassword(body.newPassword);
    found.admin.updatedAt = new Date().toISOString();
    db.sessions = db.sessions.filter((s) => s.adminId !== found.admin.id || s.id === found.session.id);
    audit(found.admin.email, 'account.password_changed', 'admin', found.admin.id);
    await dbModule.save();
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/api/admin/account/mfa/start' && req.method === 'POST') {
    const db = dbModule.load();
    const secret = totp.generateSecret();
    found.admin.pendingTotpSecret = secret;
    await dbModule.save();
    return sendJson(res, 200, {
      secret,
      otpauthUri: totp.otpauthUri({ secret, email: found.admin.email })
    });
  }

  if (p === '/api/admin/account/mfa/confirm' && req.method === 'POST') {
    const db = dbModule.load();
    const body = await readJson(req);
    if (!found.admin.pendingTotpSecret) throw new HttpError(400, 'Start the authenticator reset first.');
    if (!totp.verifyTotp(found.admin.pendingTotpSecret, body.code)) {
      throw new HttpError(422, 'That authenticator code is not valid.');
    }
    found.admin.totpSecret = found.admin.pendingTotpSecret;
    found.admin.pendingTotpSecret = null;
    found.admin.mfaEnabled = true;
    found.admin.updatedAt = new Date().toISOString();
    db.sessions = db.sessions.filter((s) => s.adminId !== found.admin.id || s.id === found.session.id);
    audit(found.admin.email, 'account.mfa_rotated', 'admin', found.admin.id);
    await dbModule.save();
    return sendJson(res, 200, { ok: true });
  }

  const sessionMatch = /^\/api\/admin\/sessions\/([^/]+)\/revoke$/.exec(p);
  if (sessionMatch && req.method === 'POST') {
    const db = dbModule.load();
    const target = db.sessions.find((s) => s.id === sessionMatch[1]);
    if (!target || target.adminId !== found.admin.id) throw new HttpError(404, 'Session not found.');
    if (target.id === found.session.id) throw new HttpError(400, 'Use sign out to end the current session.');
    auth.revokeSession(target.id);
    audit(found.admin.email, 'account.session_revoked', 'admin', found.admin.id, target.id);
    await dbModule.save();
    return sendJson(res, 200, { ok: true });
  }

  throw new HttpError(404, 'Unknown admin endpoint.');
}

/* ------------------------------- dispatcher ------------------------------ */

async function handleApi(req, res, url) {
  try {
    req.query = url.query || {};
    if (url.pathname.startsWith('/api/admin/')) {
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
        throw new HttpError(405, 'Method not allowed.');
      }
      if (req.method !== 'GET' && !auth.isSameOrigin(req)) {
        throw new HttpError(403, 'Cross-origin requests are not allowed.');
      }
      return await handleAdminApi(req, res, url);
    }

    if (url.pathname === '/api/site' && req.method === 'GET') {
      return sendJson(res, 200, sitePayload());
    }

    const projectMatch = /^\/api\/projects\/([a-z0-9-]+)$/.exec(url.pathname);
    if (projectMatch && req.method === 'GET') {
      return sendJson(res, 200, projectPayload(req, projectMatch[1]));
    }

    const serviceMatch = /^\/api\/services\/([a-z0-9-]+)$/.exec(url.pathname);
    if (serviceMatch && req.method === 'GET') {
      return sendJson(res, 200, servicePayload(req, serviceMatch[1]));
    }

    if (url.pathname === '/api/reviews' && req.method === 'POST') {
      if (!auth.isSameOrigin(req)) throw new HttpError(403, 'Cross-origin requests are not allowed.');
      const body = await readJson(req, 32 * 1024);
      const result = submitReview(req, body);
      await dbModule.save();
      return sendJson(res, 201, result);
    }

    throw new HttpError(404, 'API endpoint not found.');
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[api]', err);
    if (res.headersSent) return;
    sendJson(res, status, {
      error: status >= 500 ? 'Something went wrong on the server.' : err.message,
      ...(err.extra || {})
    });
  }
}

module.exports = { handleApi, HttpError, UPLOAD_DIR, MAX_UPLOAD_JSON };


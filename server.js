'use strict';

/**
 * Kuldeep Malviya — portfolio server
 * Zero-dependency Node HTTP server:
 *  - serves the static portfolio
 *  - renders case-study / service routes
 *  - public API (published content only)
 *  - private admin API (password + TOTP MFA, server-side sessions)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const { handleApi, UPLOAD_DIR } = require('./server/api');
const dbModule = require('./server/db');
const auth = require('./server/auth');

const ROOT = __dirname;

/* ------------------------------- env file -------------------------------- */
require('./server/config').loadEnvFile();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://firebasestorage.googleapis.com",
    "media-src 'self' blob: https://firebasestorage.googleapis.com",
    "connect-src 'self' https://storage.googleapis.com https://*.storage.googleapis.com",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'"
  ].join('; ')
};

/* ------------------------------- utilities -------------------------------- */

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function sendFile(res, filePath, { cache = 'no-cache', status = 200 } = {}) {
  fs.readFile(filePath, (err, buffer) => {
    if (err) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const ext = path.extname(filePath).toLowerCase();
    send(res, status, buffer, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cache
    });
  });
}

function safeJoin(base, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const resolved = path.resolve(base, '.' + decoded);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function siteOrigin(req) {
  const configured = (process.env.SITE_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  return `http://${req.headers.host || `localhost:${PORT}`}`;
}

/* --------------------------------- server --------------------------------- */

async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const parsed = { pathname: parsedUrl.pathname, query: Object.fromEntries(parsedUrl.searchParams) };
  let pathname = parsed.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  try {
    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, parsed);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    // Login and dashboard are separate documents, guarded by the server session.
    if (pathname === '/admin' || pathname === '/admin/index.html') {
      return send(res, 303, '', {
        Location: auth.getSession(req) ? '/admin/dashboard' : '/admin/login',
        'Cache-Control': 'no-store'
      });
    }
    if (pathname === '/admin/login') {
      if (auth.getSession(req)) return send(res, 303, '', { Location: '/admin/dashboard', 'Cache-Control': 'no-store' });
      return sendFile(res, path.join(ROOT, 'admin-login.html'), { cache: 'no-store' });
    }
    if (pathname === '/admin/dashboard') {
      if (!auth.getSession(req)) return send(res, 303, '', { Location: '/admin/login', 'Cache-Control': 'no-store' });
      return sendFile(res, path.join(ROOT, 'admin.html'), { cache: 'no-store' });
    }

    // Case-study routes
    const projectMatch = /^\/project\/([a-z0-9-]+)$/.exec(pathname);
    if (projectMatch) {
      return sendFile(res, path.join(ROOT, 'project.html'));
    }

    if (pathname === '/services' || pathname === '/contact' || pathname === '/reviews') {
      return sendFile(res, path.join(ROOT, pathname.slice(1) + '.html'));
    }

    // Service routes
    const serviceMatch = /^\/services\/([a-z0-9-]+)$/.exec(pathname);
    if (serviceMatch) {
      return sendFile(res, path.join(ROOT, 'service.html'));
    }

    if (pathname === '/robots.txt') {
      const db = dbModule.load();
      const body = db.seo.noindex
        ? 'User-agent: *\nDisallow: /\n'
        : `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${siteOrigin(req)}/sitemap.xml\n`;
      return send(res, 200, body, { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    if (pathname === '/sitemap.xml') {
      const db = dbModule.load();
      const origin = siteOrigin(req);
      const publishedProjects = db.projects.filter((p) => p.status === 'published' && !p.archived);
      const publishedServices = db.services.filter((s) => s.status === 'published' && !s.archived);
      const urls = [
        `${origin}/`, `${origin}/services`, `${origin}/contact`, `${origin}/reviews`,
        ...publishedProjects.map((p) => `${origin}/project/${p.slug}`),
        ...publishedServices.map((s) => `${origin}/services/${s.slug}`)
      ];
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${xmlEscape(u)}</loc></url>`)
        .join('\n')}\n</urlset>\n`;
      return send(res, 200, body, { 'Content-Type': 'application/xml; charset=utf-8' });
    }

    if (pathname === '/' || pathname === '/index.html') {
      return sendFile(res, path.join(ROOT, 'index.html'));
    }

    if (pathname === '/project.html') {
      return sendFile(res, path.join(ROOT, 'project.html'));
    }

    if (pathname === '/service.html') {
      return sendFile(res, path.join(ROOT, 'service.html'));
    }

    // Uploaded media
    if (pathname.startsWith('/uploads/')) {
      const file = safeJoin(UPLOAD_DIR, pathname.slice('/uploads'.length));
      if (!file || !/\.(jpg|jpeg|png|webp|gif)$/i.test(file)) {
        return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      return sendFile(res, file, { cache: 'public, max-age=86400' });
    }

    // Static assets
    if (pathname.startsWith('/assets/')) {
      const file = safeJoin(path.join(ROOT, 'assets'), pathname.slice('/assets'.length));
      if (!file) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return sendFile(res, file, { cache: 'public, max-age=600' });
    }

    if (pathname === '/favicon.ico') {
      return send(res, 204, '');
    }

    // Root-level static files (resume etc. outside /assets are not exposed)
    return send(res, 404, '<!doctype html><meta charset="utf-8"><title>Not found</title><p>Page not found. <a href="/">Back to portfolio</a></p>', {
      'Content-Type': 'text/html; charset=utf-8'
    });
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) {
      send(res, 500, 'Server error', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
  }
}

let initialization;
function initializeOnce() {
  if (!initialization) initialization = dbModule.initialize();
  return initialization;
}

function canServePublicStaticFallback(req) {
  if (!['GET', 'HEAD'].includes(req.method)) return false;
  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname || '/'; }
  catch { return false; }
  return !pathname.startsWith('/api/') && !pathname.startsWith('/admin') && !['/robots.txt', '/sitemap.xml'].includes(pathname);
}

async function handleIncoming(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname || '/';
  const stateful = pathname.startsWith('/api/') || pathname.startsWith('/admin') || ['/robots.txt', '/sitemap.xml'].includes(pathname);
  const result = dbModule.usesRemoteStore() && stateful
    ? dbModule.withRequest(() => handleRequest(req, res)) : handleRequest(req, res);
  await Promise.resolve(result).catch(error => {
    console.error('[datastore]', error.message);
    if (!res.headersSent) send(res, error.status || 503, JSON.stringify({ error: 'Database unavailable. Please try again.' }), { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    else if (!res.writableEnded) res.end();
  });
}

// Vercel treats this file as the production Node.js function entry point.
// Initialize Firestore once per warm function instance. The deployment bundle
// is read-only, so only local development prepares the uploads directory.
async function vercelHandler(req, res) {
  try {
    await initializeOnce();
    return handleIncoming(req, res);
  } catch (error) {
    console.error('Website startup failed: ' + error.message);
    // Keep existing static portfolio pages available if a preview or a
    // datastore outage prevents CMS initialization. Stateful APIs, admin,
    // robots and sitemap still fail closed instead of using ephemeral data.
    if (canServePublicStaticFallback(req)) return handleIncoming(req, res);
    if (!res.headersSent) {
      send(res, error.status || 503, JSON.stringify({ error: 'Website is temporarily unavailable.' }), {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
    }
  }
}

module.exports = vercelHandler;
module.exports.canServePublicStaticFallback = canServePublicStaticFallback;

// Initialise (creates data/db.json with seeded content on first run)
async function start() {
  const db = await initializeOnce();
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const server = http.createServer(handleIncoming);
  server.listen(PORT, HOST, () => {
    console.log('Kuldeep Malviya portfolio running at http://' + HOST + ':' + PORT);
    console.log('Datastore: ' + (dbModule.usesFirestore() ? 'Cloud Firestore' : 'local JSON'));
    console.log('Admin: http://' + HOST + ':' + PORT + '/admin ' + (db.admins.length ? '(admin configured)' : '(first-run setup required)'));
  });
  return server;
}

if (require.main === module) {
  start().then(server => {
    process.on('SIGINT', () => {
      console.log('\nShutting down…');
      server.close(() => process.exit(0));
    });
    process.on('SIGTERM', () => {
      server.close(() => process.exit(0));
    });
  }).catch(error => {
    console.error('Website startup failed: ' + error.message);
    process.exitCode = 1;
  });
}


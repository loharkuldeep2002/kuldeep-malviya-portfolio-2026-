'use strict';

const crypto = require('crypto');
const dbModule = require('./db');

const SESSION_COOKIE = 'km_admin';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days per browser
const MFA_TTL_MS = 5 * 60 * 1000;
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p)
    });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (err) {
    return false;
  }
}

function passwordProblems(password) {
  const problems = [];
  if (typeof password !== 'string' || password.length < 12) problems.push('at least 12 characters');
  if (!/[a-z]/.test(password || '')) problems.push('a lowercase letter');
  if (!/[A-Z]/.test(password || '')) problems.push('an uppercase letter');
  if (!/[0-9]/.test(password || '')) problems.push('a number');
  if (password && password.length > 200) problems.push('at most 200 characters');
  return problems;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function token() {
  return crypto.randomBytes(32).toString('base64url');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    if (!key) return;
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch (err) {
      out[key] = part.slice(idx + 1).trim();
    }
  });
  return out;
}

function isSecureRequest(req) {
  if (req.socket && req.socket.encrypted) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return proto === 'https' || process.env.COOKIE_SECURE === '1';
}

function setSessionCookie(req, res, rawToken, maxAgeMs) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req, res) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (isSecureRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function pruneExpired(db) {
  const now = Date.now();
  db.sessions = db.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  db.mfaChallenges = db.mfaChallenges.filter((c) => new Date(c.expiresAt).getTime() > now && !c.used);
  db.attempts = db.attempts.filter((a) => now - new Date(a.firstAt).getTime() < WINDOW_MS * 4);
}

function createSession(req, admin, rememberDevice = true) {
  const db = dbModule.load();
  pruneExpired(db);
  const raw = token();
  const session = {
    id: dbModule.uid('ses_'),
    adminId: admin.id,
    tokenHash: sha256(raw),
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (rememberDevice ? REMEMBER_TTL_MS : SESSION_TTL_MS)).toISOString(),
    rememberDevice: Boolean(rememberDevice),
    ip: req.socket ? req.socket.remoteAddress || '' : '',
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200)
  };
  db.sessions.push(session);
  return { raw, session };
}

// Upgrade only a still-valid session issued before the remember-device feature.
// Expired or revoked sessions are never restored.
async function rememberLegacySession(req, res, found) {
  if (found.session.rememberDevice !== undefined) return;
  found.session.rememberDevice = true;
  found.session.expiresAt = new Date(Date.now() + REMEMBER_TTL_MS).toISOString();
  await dbModule.save();
  setSessionCookie(req, res, parseCookies(req)[SESSION_COOKIE], REMEMBER_TTL_MS);
}

function getSession(req) {
  const db = dbModule.load();
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const hash = sha256(raw);
  const session = db.sessions.find((s) => s.tokenHash === hash);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    db.sessions = db.sessions.filter((s) => s.id !== session.id);
    dbModule.save();
    return null;
  }
  const admin = db.admins.find((a) => a.id === session.adminId);
  if (!admin) return null;
  return { session, admin };
}

function revokeSession(id) {
  const db = dbModule.load();
  const before = db.sessions.length;
  db.sessions = db.sessions.filter((s) => s.id !== id);
  return db.sessions.length !== before;
}

function requireAdmin(req) {
  const found = getSession(req);
  if (!found) return null;
  found.session.lastSeenAt = new Date().toISOString();
  return found;
}

/* ----------------------------- Rate limiting ----------------------------- */

function attemptKey(email, ip) {
  return `login:${String(email || '').toLowerCase()}|${ip || ''}`;
}

function lockState(key) {
  const db = dbModule.load();
  const entry = db.attempts.find((a) => a.key === key);
  if (!entry) return { locked: false, remaining: 0 };
  if (entry.lockedUntil && new Date(entry.lockedUntil).getTime() > Date.now()) {
    return { locked: true, remaining: Math.ceil((new Date(entry.lockedUntil).getTime() - Date.now()) / 1000) };
  }
  return { locked: false, remaining: 0 };
}

function recordFailure(key) {
  const db = dbModule.load();
  let entry = db.attempts.find((a) => a.key === key);
  if (!entry) {
    entry = { key, count: 0, firstAt: new Date().toISOString(), lockedUntil: null };
    db.attempts.push(entry);
  }
  entry.count += 1;
  if (entry.count >= LOCK_AFTER) {
    entry.lockedUntil = new Date(Date.now() + LOCK_MS).toISOString();
    entry.count = 0;
    entry.firstAt = new Date().toISOString();
  }
  return entry;
}

function clearFailures(key) {
  const db = dbModule.load();
  db.attempts = db.attempts.filter((a) => a.key !== key);
}

/* ------------------------- Same-origin (CSRF) guard ------------------------ */

function isSameOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  if (!host) return false;
  const allowed = [`http://${host}`, `https://${host}`];
  if (origin) return allowed.includes(origin);
  if (referer) return allowed.some((base) => referer.startsWith(base + '/') || referer === base);
  // No Origin/Referer: browsers always send one for cross-site form posts.
  return true;
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  REMEMBER_TTL_MS,
  MFA_TTL_MS,
  hashPassword,
  verifyPassword,
  passwordProblems,
  token,
  sha256,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  createSession,
  rememberLegacySession,
  getSession,
  requireAdmin,
  revokeSession,
  pruneExpired,
  attemptKey,
  lockState,
  recordFailure,
  clearFailures,
  isSameOrigin
};

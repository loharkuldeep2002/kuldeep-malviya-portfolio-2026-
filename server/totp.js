'use strict';

/**
 * Minimal RFC 6238 TOTP + RFC 4226 HOTP implementation (no dependencies).
 * Used to verify authenticator-app codes on the server only.
 */

const crypto = require('crypto');

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = B32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  let high = Math.floor(counter / 0x100000000);
  let low = counter >>> 0;
  buf.writeUInt32BE(high >>> 0, 0);
  buf.writeUInt32BE(low >>> 0, 4);
  const digest = crypto.createHmac('sha1', secretBuffer).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

function otpauthUri({ secret, email, issuer = 'Kuldeep Malviya Portfolio' }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Verify a 6-digit code with a +/- 1 step window to tolerate clock drift.
 * Comparison is constant time.
 */
function verifyTotp(secret, code, window = 1) {
  const normalized = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const secretBuffer = base32Decode(secret);
  if (secretBuffer.length < 10) return false;
  const counter = Math.floor(Date.now() / 30000);
  let ok = false;
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = hotp(secretBuffer, counter + offset);
    const a = Buffer.from(expected);
    const b = Buffer.from(normalized);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) ok = true;
  }
  return ok;
}

module.exports = { generateSecret, otpauthUri, verifyTotp };

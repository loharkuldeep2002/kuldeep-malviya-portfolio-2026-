'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateUpload } = require('./storage');

test('media validator accepts supported image and video MIME types', () => {
  assert.equal(validateUpload({ mimeType: 'image/webp', size: 1024 }).kind, 'image');
  assert.equal(validateUpload({ mimeType: 'video/mp4', size: 1024 }).kind, 'video');
});

test('media validator rejects SVG and unknown formats', () => {
  assert.throws(() => validateUpload({ mimeType: 'image/svg+xml', size: 1024 }), { status: 422 });
  assert.throws(() => validateUpload({ mimeType: 'application/octet-stream', size: 1024 }), { status: 422 });
});

test('media validator enforces configured image and video size limits', () => {
  assert.throws(() => validateUpload({ mimeType: 'image/jpeg', size: 20 * 1024 * 1024 + 1 }), { status: 413 });
  assert.throws(() => validateUpload({ mimeType: 'video/mp4', size: 100 * 1024 * 1024 + 1 }), { status: 413 });
});

test('media validator rejects empty and non-finite sizes', () => {
  assert.throws(() => validateUpload({ mimeType: 'image/png', size: 0 }), { status: 422 });
  assert.throws(() => validateUpload({ mimeType: 'image/png', size: Number.NaN }), { status: 422 });
});

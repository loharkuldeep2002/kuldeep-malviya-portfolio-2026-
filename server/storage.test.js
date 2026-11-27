'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('./storage');
const { validateUpload } = storage;

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

test('media storage readiness requires Firestore and a valid bucket name', () => {
  const originalStore = process.env.DATA_STORE;
  const originalBucket = process.env.FIREBASE_STORAGE_BUCKET;
  try {
    process.env.DATA_STORE = 'firestore';
    delete process.env.FIREBASE_STORAGE_BUCKET;
    assert.equal(storage.isConfigured(), false);
    process.env.FIREBASE_STORAGE_BUCKET = 'portfolio-media-bucket';
    assert.equal(storage.isConfigured(), true);
    process.env.DATA_STORE = 'json';
    assert.equal(storage.isConfigured(), false);
    process.env.DATA_STORE = 'firestore';
    process.env.FIREBASE_STORAGE_BUCKET = 'invalid bucket name';
    assert.equal(storage.isConfigured(), false);
  } finally {
    if (originalStore === undefined) delete process.env.DATA_STORE;
    else process.env.DATA_STORE = originalStore;
    if (originalBucket === undefined) delete process.env.FIREBASE_STORAGE_BUCKET;
    else process.env.FIREBASE_STORAGE_BUCKET = originalBucket;
  }
});

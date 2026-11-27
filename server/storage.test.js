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

test('upload URL is scoped to one path, MIME type, size, and short expiry', async () => {
  const calls = {};
  const issued = { delegationToken: 'delegation', clientSigningToken: 'signing', validUntil: Date.now() + 300000 };
  const sdk = {
    token: 'test-token',
    list: async (options) => {
      calls.list = options;
      return { blobs: [], hasMore: false };
    },
    issueSignedToken: async (options) => {
      calls.issue = options;
      return issued;
    },
    presignUrl: async (signedToken, options) => {
      calls.presign = { signedToken, options };
      return { presignedUrl: 'https://signed-upload.example/one-time' };
    }
  };
  const upload = await storage.createUpload({ adminId: 'admin_1', mimeType: 'image/png', size: 1024, sdk });

  assert.equal(upload.uploadUrl, 'https://signed-upload.example/one-time');
  assert.match(upload.path, /^portfolio-media-v2\/admin_1\/[0-9a-f-]{36}\.png$/i);
  assert.equal(calls.issue.pathname, upload.path);
  assert.deepEqual(calls.issue.operations, ['put']);
  assert.deepEqual(calls.issue.allowedContentTypes, ['image/png']);
  assert.equal(calls.issue.maximumSizeInBytes, 1024);
  assert.equal(calls.issue.token, 'test-token');
  assert.equal(calls.presign.signedToken, issued);
  assert.equal(calls.presign.options.pathname, upload.path);
  assert.equal(calls.presign.options.operation, 'put');
  assert.equal(calls.presign.options.access, 'public');
  assert.equal(calls.presign.options.allowOverwrite, false);
  assert.equal(calls.presign.options.token, undefined);
});

test('upload completion verifies object metadata and removes mismatched uploads', async () => {
  const upload = { id: '4d22ad10-f96e-4d1d-8793-a3efc876f821', path: 'portfolio-media-v2/admin_1/4d22ad10-f96e-4d1d-8793-a3efc876f821.png' };
  let deleted;
  const sdk = {
    token: 'test-token',
    head: async () => ({ size: 1024, contentType: 'image/png', url: 'https://media.example/image.png' }),
    del: async (path, options) => { deleted = { path, options }; }
  };
  const verified = await storage.verifyUpload({ adminId: 'admin_1', ...upload, mime: 'image/png', size: 1024, sdk });
  assert.equal(verified.url, 'https://media.example/image.png');
  assert.equal(verified.kind, 'image');

  await assert.rejects(storage.verifyUpload({
    adminId: 'admin_1', ...upload, mime: 'image/png', size: 2048,
    sdk: { ...sdk, head: async () => ({ size: 1024, contentType: 'image/png', url: 'https://media.example/image.png' }) }
  }), { status: 422 });
  assert.deepEqual(deleted, { path: upload.path, options: { token: 'test-token' } });
});

test('media storage tokens stay isolated between production, Preview, and local development', () => {
  const names = ['VERCEL', 'VERCEL_ENV', 'BLOB_READ_WRITE_TOKEN', 'BLOB_PREVIEW_READ_WRITE_TOKEN', 'BLOB_LOCAL_DEVELOPMENT'];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.VERCEL = '1';
    process.env.VERCEL_ENV = 'production';
    process.env.BLOB_READ_WRITE_TOKEN = 'production-token';
    delete process.env.BLOB_PREVIEW_READ_WRITE_TOKEN;
    assert.equal(storage.isConfigured(), true);

    process.env.VERCEL_ENV = 'preview';
    assert.equal(storage.isConfigured(), false);
    process.env.BLOB_PREVIEW_READ_WRITE_TOKEN = 'preview-token';
    assert.equal(storage.isConfigured(), true);

    process.env.VERCEL = '0';
    process.env.BLOB_LOCAL_DEVELOPMENT = 'true';
    assert.equal(storage.isConfigured(), true);
    process.env.BLOB_LOCAL_DEVELOPMENT = 'false';
    assert.equal(storage.isConfigured(), false);
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

'use strict';

const crypto = require('crypto');

const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif']
]);
const VIDEO_TYPES = new Map([
  ['video/mp4', 'mp4'], ['video/webm', 'webm'], ['video/quicktime', 'mov']
]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_BLOB_STORE_BYTES = 900 * 1024 * 1024;
const UPLOAD_TTL_MS = 5 * 60 * 1000;
const STORAGE_PREFIX = 'portfolio-media-v2/';

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getBlobToken() {
  if (process.env.VERCEL === '1') {
    if (process.env.VERCEL_ENV === 'production') return String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    if (process.env.VERCEL_ENV === 'preview') return String(process.env.BLOB_PREVIEW_READ_WRITE_TOKEN || '').trim();
    return '';
  }
  if (process.env.BLOB_LOCAL_DEVELOPMENT === 'true') return String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  return '';
}

function blobSdk() {
  const token = getBlobToken();
  if (!token) {
    throw httpError(503, 'Vercel Blob is not configured for this deployment.');
  }
  return { ...require('@vercel/blob'), token };
}

function isConfigured() {
  return Boolean(getBlobToken());
}

function validateUpload({ mimeType, size }) {
  const mime = String(mimeType || '').toLowerCase();
  const byteLength = Number(size);
  const ext = IMAGE_TYPES.get(mime) || VIDEO_TYPES.get(mime);
  if (!ext) {
    throw httpError(422, 'Choose a JPEG, PNG, WebP, GIF, MP4, WebM or MOV file.');
  }
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
    throw httpError(422, 'The selected file is empty or has an invalid size.');
  }
  const maxBytes = IMAGE_TYPES.has(mime) ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (byteLength > maxBytes) {
    throw httpError(413, IMAGE_TYPES.has(mime) ? 'Images must be 20 MB or smaller.' : 'Videos must be 100 MB or smaller.');
  }
  return { mime, ext, size: byteLength, kind: IMAGE_TYPES.has(mime) ? 'image' : 'video' };
}

async function getCurrentUsageBytes(list) {
  let size = 0;
  let cursor;
  do {
    const page = await list({ prefix: STORAGE_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const blob of page.blobs || []) size += Number(blob.size) || 0;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return size;
}

async function createUpload({ adminId, mimeType, size, sdk: injectedSdk }) {
  const validated = validateUpload({ mimeType, size });
  if (!/^[A-Za-z0-9_-]+$/.test(String(adminId || ''))) {
    throw httpError(422, 'The administrator reference is invalid.');
  }
  const { issueSignedToken, presignUrl, list, token } = injectedSdk || blobSdk();
  const currentBytes = await getCurrentUsageBytes((options) => list({ ...options, token }));
  if (currentBytes + validated.size > MAX_BLOB_STORE_BYTES) {
    throw httpError(413, 'The free media storage limit is nearly full. Delete unused media or review Vercel Blob usage before uploading more.');
  }
  const id = crypto.randomUUID();
  const path = `${STORAGE_PREFIX}${adminId}/${id}.${validated.ext}`;
  const expiresAt = Date.now() + UPLOAD_TTL_MS;
  const signedToken = await issueSignedToken({
    pathname: path,
    operations: ['put'],
    allowedContentTypes: [validated.mime],
    maximumSizeInBytes: validated.size,
    validUntil: expiresAt,
    token
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: 'put',
    pathname: path,
    access: 'public',
    allowedContentTypes: [validated.mime],
    maximumSizeInBytes: validated.size,
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil: expiresAt
  });
  return { id, path, uploadUrl: presignedUrl, mime: validated.mime, size: validated.size, kind: validated.kind, expiresAt };
}

async function verifyUpload({ adminId, path, id, mime, size, sdk: injectedSdk }) {
  const validated = validateUpload({ mimeType: mime, size });
  const expectedPath = `${STORAGE_PREFIX}${adminId}/${id}.${validated.ext}`;
  if (!/^[A-Za-z0-9_-]+$/.test(String(adminId || '')) || path !== expectedPath || !/^[0-9a-f-]{36}$/i.test(String(id || ''))) {
    throw httpError(422, 'The uploaded media reference is invalid.');
  }
  const { head, del, token } = injectedSdk || blobSdk();
  let metadata;
  try {
    metadata = await head(path, { token });
  } catch {
    throw httpError(422, 'The uploaded file could not be found. Please upload it again.');
  }
  if (Number(metadata.size) !== validated.size || String(metadata.contentType || '').toLowerCase() !== validated.mime) {
    await del(path, { token }).catch(() => {});
    throw httpError(422, 'Uploaded file verification failed. Please upload it again.');
  }
  return { path, url: metadata.url, size: Number(metadata.size), mime: String(metadata.contentType).toLowerCase(), kind: validated.kind };
}

async function deleteObject(path) {
  // Firebase media paths from older backups are intentionally left untouched.
  if (!path || !String(path).startsWith(STORAGE_PREFIX)) return;
  const { del, token } = blobSdk();
  await del(path, { token });
}

module.exports = {
  createUpload, verifyUpload, deleteObject, validateUpload, isConfigured,
  IMAGE_TYPES, VIDEO_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MAX_BLOB_STORE_BYTES, STORAGE_PREFIX
};

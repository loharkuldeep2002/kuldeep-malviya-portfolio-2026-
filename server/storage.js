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
const UPLOAD_TTL_MS = 5 * 60 * 1000;

function getBucket() {
  const bucketName = String(process.env.FIREBASE_STORAGE_BUCKET || '').trim();
  if (!bucketName || /[\\/\s]/.test(bucketName)) {
    const error = new Error('Firebase media storage is not configured. Set FIREBASE_STORAGE_BUCKET.');
    error.status = 503;
    throw error;
  }
  const { getApps } = require('firebase-admin/app');
  const { getStorage } = require('firebase-admin/storage');
  const app = getApps().find((candidate) => candidate.name === 'portfolio-datastore');
  if (!app) {
    const error = new Error('Firebase must be initialized before media storage is used.');
    error.status = 503;
    throw error;
  }
  return getStorage(app).bucket(bucketName);
}

function isConfigured() {
  const bucketName = String(process.env.FIREBASE_STORAGE_BUCKET || '').trim();
  return process.env.DATA_STORE === 'firestore' && Boolean(bucketName) && !/[\\/\s]/.test(bucketName);
}

function validateUpload({ mimeType, size }) {
  const mime = String(mimeType || '').toLowerCase();
  const byteLength = Number(size);
  const ext = IMAGE_TYPES.get(mime) || VIDEO_TYPES.get(mime);
  if (!ext) {
    const error = new Error('Choose a JPEG, PNG, WebP, GIF, MP4, WebM or MOV file.');
    error.status = 422;
    throw error;
  }
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
    const error = new Error('The selected file is empty or has an invalid size.');
    error.status = 422;
    throw error;
  }
  const maxBytes = IMAGE_TYPES.has(mime) ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (byteLength > maxBytes) {
    const error = new Error(IMAGE_TYPES.has(mime) ? 'Images must be 20 MB or smaller.' : 'Videos must be 100 MB or smaller.');
    error.status = 413;
    throw error;
  }
  return { mime, ext, size: byteLength, kind: IMAGE_TYPES.has(mime) ? 'image' : 'video' };
}

async function createUpload({ adminId, mimeType, size }) {
  const validated = validateUpload({ mimeType, size });
  const id = crypto.randomUUID();
  const path = `portfolio-media/${adminId}/${id}.${validated.ext}`;
  const downloadToken = crypto.randomUUID();
  const file = getBucket().file(path);
  const expiresAt = Date.now() + UPLOAD_TTL_MS;
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: expiresAt,
    contentType: validated.mime,
    extensionHeaders: { 'x-goog-meta-firebasestoragedownloadtokens': downloadToken }
  });
  return { id, path, uploadUrl, downloadToken, mime: validated.mime, size: validated.size, kind: validated.kind, expiresAt };
}

async function verifyUpload({ adminId, path, id, downloadToken, mime, size }) {
  const validated = validateUpload({ mimeType: mime, size });
  if (!/^[A-Za-z0-9_-]+$/.test(adminId) || path !== `portfolio-media/${adminId}/${id}.${validated.ext}` || !/^[0-9a-f-]{36}$/i.test(id)) {
    const error = new Error('The uploaded media reference is invalid.');
    error.status = 422;
    throw error;
  }
  const bucket = getBucket();
  const file = bucket.file(path);
  const [metadata] = await file.getMetadata();
  const actualSize = Number(metadata.size);
  const actualType = String(metadata.contentType || '').toLowerCase();
  const actualToken = metadata.metadata && (
    metadata.metadata.firebaseStorageDownloadTokens || metadata.metadata.firebasestoragedownloadtokens
  );
  if (actualSize !== validated.size || actualType !== validated.mime || actualToken !== downloadToken) {
    await file.delete({ ignoreNotFound: true }).catch(() => {});
    const error = new Error('Uploaded file verification failed. Please upload it again.');
    error.status = 422;
    throw error;
  }
  const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(downloadToken)}`;
  return { path, url, size: actualSize, mime: actualType, kind: validated.kind };
}

async function deleteObject(path) {
  if (!path || !path.startsWith('portfolio-media/')) return;
  await getBucket().file(path).delete({ ignoreNotFound: true });
}

module.exports = { createUpload, verifyUpload, deleteObject, validateUpload, isConfigured, IMAGE_TYPES, VIDEO_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES };

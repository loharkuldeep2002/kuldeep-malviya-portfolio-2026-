'use strict';

const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');

const COLLECTIONS = {
  projects: 'projects', services: 'services', reviews: 'reviews', comments: 'comments', media: 'media',
  admins: 'admin_users', sessions: 'sessions', mfaChallenges: 'mfa_challenges',
  attempts: 'login_attempts', activity: 'activity_logs'
};
const ALL_COLLECTIONS = [...Object.values(COLLECTIONS), 'site_content', 'site_settings', '_system'];
const META_PATH = '_system/datastore';
const clone = value => JSON.parse(JSON.stringify(value));
function problem(message, status = 503) { const error = new Error(message); error.status = status; return error; }

function serialize(data) {
  const docs = new Map();
  const put = (key, value) => {
    const clean = clone(value);
    if (Buffer.byteLength(JSON.stringify(clean)) > 950 * 1024) throw problem(`Database record too large: ${key}`, 422);
    if (docs.has(key)) throw problem('Duplicate database record ID.', 422);
    docs.set(key, clean);
  };
  for (const [group, collection] of Object.entries(COLLECTIONS)) {
    for (const item of data[group] || []) {
      const id = group === 'attempts'
        ? crypto.createHash('sha256').update(String(item.key)).digest('hex') : item.id;
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) throw problem(`Invalid record ID in ${group}`, 422);
      put(`${collection}/${id}`, item);
    }
  }
  for (const key of ['hero', 'about', 'contact', 'footer']) {
    put(`site_content/${key}`, data.content?.[key] || {});
  }
  put('site_content/branding', { availabilityBadge: data.content?.availabilityBadge || '' });
  put('site_settings/navigation', data.nav || {});
  put('site_settings/seo', data.seo || {});
  put('_system/private_settings', data.settings || {});
  return docs;
}

function deserialize(docs, meta) {
  const data = { version: meta.schemaVersion, createdAt: meta.createdAt, content: {} };
  for (const [group, collection] of Object.entries(COLLECTIONS)) {
    data[group] = [...docs].filter(([key]) => key.startsWith(collection + '/')).map(([, value]) => clone(value));
  }
  data.activity.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  for (const key of ['hero', 'about', 'contact', 'footer']) data.content[key] = clone(docs.get(`site_content/${key}`) || {});
  data.content.availabilityBadge = docs.get('site_content/branding')?.availabilityBadge || '';
  data.nav = clone(docs.get('site_settings/navigation') || {});
  data.seo = clone(docs.get('site_settings/seo') || {});
  data.settings = clone(docs.get('_system/private_settings') || {});
  return data;
}

function connect() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || !/^[a-z][a-z0-9-]+$/.test(projectId)) throw problem('Set FIREBASE_PROJECT_ID before connecting to Firestore.');
  const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const name = 'portfolio-datastore';
  let credential = applicationDefault();
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw problem('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
    if (serviceAccount.project_id !== projectId) {
      throw problem('The Firebase service account project does not match FIREBASE_PROJECT_ID.');
    }
    credential = cert(serviceAccount);
  }
  const app = getApps().find(app => app.name === name) || initializeApp({ credential, projectId }, name);
  return new FirestoreStore(getFirestore(app));
}

class FirestoreStore {
  constructor(db) { this.db = db; this.revision = null; this.baseline = new Map(); }

  async readDocuments(transaction) {
    const snapshots = await Promise.all(ALL_COLLECTIONS.map(name => transaction.get(this.db.collection(name))));
    const docs = new Map();
    snapshots.forEach(snapshot => snapshot.docs.forEach(doc => {
      if (doc.ref.path !== META_PATH) docs.set(doc.ref.path, doc.data());
    }));
    return docs;
  }

  async load() {
    const result = await this.db.runTransaction(async transaction => {
      const metaDoc = await transaction.get(this.db.doc(META_PATH));
      if (!metaDoc.exists) throw problem('Firestore has not been migrated yet. Run the migration before enabling DATA_STORE=firestore.');
      const meta = metaDoc.data();
      if (meta.schemaVersion !== 1) throw problem('Unsupported Firestore schema version.');
      return { meta, docs: await this.readDocuments(transaction) };
    });
    this.revision = result.meta.revision;
    this.baseline = result.docs;
    return deserialize(result.docs, result.meta);
  }

  async refreshNeeded() {
    if (this.revision === null) return true;
    const doc = await this.db.doc(META_PATH).get();
    if (!doc.exists) throw problem('Firestore datastore metadata is missing.');
    return doc.data().revision !== this.revision;
  }

  async save(data) {
    const next = serialize(data);
    const sets = [...next].filter(([key, value]) => !isDeepStrictEqual(value, this.baseline.get(key)));
    // Manage only paths represented by the adapter; never erase unrelated data.
    const managed = serialize(deserialize(this.baseline, { schemaVersion: data.version, createdAt: data.createdAt }));
    const deletes = [...managed.keys()].filter(key => this.baseline.has(key) && !next.has(key));
    if (!sets.length && !deletes.length) return;
    validateCommitSize(sets, deletes);
    const expected = this.revision;
    try {
      await this.db.runTransaction(async transaction => {
        const metaDoc = await transaction.get(this.db.doc(META_PATH));
        if (!metaDoc.exists || metaDoc.data().revision !== expected) {
          throw problem('Content changed in another server session. Refresh and try again.', 409);
        }
        sets.forEach(([key, value]) => transaction.set(this.db.doc(key), value));
        deletes.forEach(key => transaction.delete(this.db.doc(key)));
        transaction.update(this.db.doc(META_PATH), { revision: expected + 1, updatedAt: new Date().toISOString() });
      });
      this.baseline = next;
      this.revision = expected + 1;
    } catch (error) {
      this.revision = null;
      throw error;
    }
  }

  async migrate(data) {
    const docs = serialize(data);
    validateCommitSize([...docs], []);
    await this.db.runTransaction(async transaction => {
      const meta = await transaction.get(this.db.doc(META_PATH));
      if (meta.exists) throw problem('This Firestore database is already initialized. Migration will not overwrite it.', 409);
      const existing = await this.readDocuments(transaction);
      for (const [key, value] of existing) {
        if (!docs.has(key) || !isDeepStrictEqual(docs.get(key), value)) {
          throw problem('Firestore contains different data. Migration stopped without overwriting existing records.', 409);
        }
      }
      docs.forEach((value, key) => transaction.set(this.db.doc(key), value));
      transaction.create(this.db.doc(META_PATH), {
        schemaVersion: data.version, createdAt: data.createdAt,
        revision: 1, migratedAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    });
    return docs.size;
  }
}

function validateCommitSize(sets, deletes) {
  if (sets.length + deletes.length > 400) throw problem('This operation needs a staged migration: more than 400 document changes.', 422);
  if (Buffer.byteLength(JSON.stringify(sets)) > 8 * 1024 * 1024) throw problem('Database operation exceeds the safe transaction size.', 422);
}

module.exports = { connect, FirestoreStore, serialize, deserialize, COLLECTIONS, META_PATH };

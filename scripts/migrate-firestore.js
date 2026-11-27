'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('../server/config').loadEnvFile();
const { connect, serialize } = require('../server/firestore-store');
const { resolveProject } = require('./migration-target');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'data', 'db.json');
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => args[args.indexOf(name) + 1];

async function main() {
  const modes = ['--dry-run', '--check', '--apply'].filter(flag);
  if (modes.length !== 1) throw new Error('Choose exactly one mode: --dry-run, --check or --apply.');
  const project = resolveProject({
    explicitProject: flag('--project') ? value('--project') : undefined,
    environmentProject: process.env.FIREBASE_PROJECT_ID,
    staging: flag('--staging')
  });
  process.env.FIREBASE_PROJECT_ID = project;
  if (flag('--check')) {
    const store = connect();
    const meta = await store.db.doc('_system/datastore').get();
    console.log('Firestore access verified for ' + project + '. Migrated: ' + meta.exists + '.');
    return;
  }
  const bytes = fs.readFileSync(source);
  const sourceData = JSON.parse(bytes);
  if (sourceData.version !== 1) throw new Error('Unexpected local database version.');

  // Migrate only portfolio content. Never copy local password hashes, TOTP
  // secrets, sessions, login attempts, or admin activity into a new cloud DB.
  // The existing local JSON file and its protected backup remain untouched.
  const data = {
    ...sourceData,
    admins: [],
    sessions: [],
    mfaChallenges: [],
    attempts: [],
    activity: [],
    reviews: [],
    settings: { siteUrl: String(sourceData.settings?.siteUrl || '') }
  };
  const docs = serialize(data);
  const counts = {};
  for (const key of docs.keys()) counts[key.split('/')[0]] = (counts[key.split('/')[0]] || 0) + 1;
  console.log('Target: ' + project + ' / (default)');
  console.log('Records: ' + JSON.stringify(counts));
  console.log('Private admin credentials, MFA secrets, sessions, login attempts, reviews and activity are excluded.');
  console.log('A new admin must be created through the one-time server bootstrap after import.');
  if (flag('--dry-run')) {
    console.log('Dry run complete. No cloud changes or credentials used.');
    return;
  }
  if (process.env.DATA_STORE === 'firestore') throw new Error('Migration reads local JSON. Keep DATA_STORE=json until verification completes.');
  const store = connect();
  const backupDir = path.join(root, 'data', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, 'before-firestore-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(backup, bytes, { flag: 'wx', mode: 0o600 });
  if (!fs.readFileSync(source).equals(bytes)) throw new Error('Local data changed. Stop the running website and retry migration.');
  const count = await store.migrate(data);
  const verified = await store.load();
  const exported = serialize(verified);
  if (exported.size !== docs.size || [...docs].some(([key, value]) => !require('util').isDeepStrictEqual(value, exported.get(key)))) {
    throw new Error('Cloud verification failed. Keep the site in local JSON mode; a local backup exists.');
  }
  const receipt = {
    projectId: project, databaseId: '(default)', migratedAt: new Date().toISOString(),
    count, counts, sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'), verified: true
  };
  fs.writeFileSync(path.join(root, 'data', 'firestore-migration-receipt.json'), JSON.stringify(receipt, null, 2));
  console.log('Migration verified: ' + count + ' records. Local backup preserved.');
  console.log('You may now set DATA_STORE=firestore and restart the website.');
}
main().catch(error => {
  console.error('Migration not completed: ' + error.message);
  process.exitCode = 1;
});

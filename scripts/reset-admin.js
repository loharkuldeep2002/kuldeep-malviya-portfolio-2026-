'use strict';

/**
 * Local recovery tool (no email service required).
 *
 *   node scripts/reset-admin.js --email you@example.com
 *
 * Prompts for a new password (hidden) and revokes every admin session.
 * Use --reset-mfa to also issue a new authenticator secret.
 */

const readline = require('readline');
require('../server/config').loadEnvFile();
const dbModule = require('../server/db');
const auth = require('../server/auth');
const totp = require('../server/totp');

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      const s = char.toString();
      if (s === '\n' || s === '\r' || s === '\u0004') return;
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(question + '*'.repeat(rl.line.length));
    };
    rl.question(question, (answer) => {
      process.stdin.removeListener('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    process.stdin.on('data', onData);
  });
}

async function main() {
  await dbModule.initialize();
  return dbModule.usesFirestore() ? dbModule.withRequest(recoverAdmin) : recoverAdmin();
}

async function recoverAdmin() {
  const db = dbModule.load();
  if (!db.admins.length) {
    console.error('No administrator exists yet. Open /admin to run first-time setup.');
    process.exit(1);
  }
  const email = (arg('email') || '').toLowerCase();
  if (!email) {
    console.log('Administrators:');
    db.admins.forEach((a) => console.log(` - ${a.email}`));
    console.log('\nRun: node scripts/reset-admin.js --email <address> [--reset-mfa]');
    process.exit(1);
  }
  const admin = db.admins.find((a) => a.email.toLowerCase() === email);
  if (!admin) {
    console.error('No administrator with that email.');
    process.exit(1);
  }

  const password = await askHidden('New password (min 12 chars, upper/lower/number): ');
  const confirm = await askHidden('Confirm new password: ');
  if (password !== confirm) {
    console.error('Passwords did not match. Nothing changed.');
    process.exit(1);
  }
  const problems = auth.passwordProblems(password);
  if (problems.length) {
    console.error(`Password needs ${problems.join(', ')}. Nothing changed.`);
    process.exit(1);
  }

  admin.passwordHash = auth.hashPassword(password);
  admin.updatedAt = new Date().toISOString();
  db.sessions = db.sessions.filter((s) => s.adminId !== admin.id);
  dbModule.logActivity(admin.email, 'account.password_reset_cli', 'admin', admin.id);

  if (process.argv.includes('--reset-mfa')) {
    const secret = totp.generateSecret();
    admin.totpSecret = secret;
    admin.mfaEnabled = true;
    console.log('\nNew authenticator secret (add it manually in your app):');
    console.log(`  ${secret}`);
    console.log(`  ${totp.otpauthUri({ secret, email: admin.email })}`);
    dbModule.logActivity(admin.email, 'account.mfa_reset_cli', 'admin', admin.id);
  }

  await dbModule.save();
  console.log(`\nPassword updated for ${admin.email}. All sessions were revoked.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

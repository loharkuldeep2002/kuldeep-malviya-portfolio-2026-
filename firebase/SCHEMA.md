# Kuldeep Malviya Portfolio — Firestore structure

Project ID: `kuldeep-malviya-portfolio`.
Database target: `(default)`, Standard edition, `asia-south1` (Mumbai).

## Verified setup status — 24 November 2026

- Created the Firebase project on the Spark plan; no billing upgrade.
- Created the `(default)` Firestore Standard database in `asia-south1`.
- Selected production mode and verified the console rule `allow read, write: if false`.
- Created and re-opened `site_content/branding` with `availabilityBadge: "Available for projects"`.
- Prepared public-content documents locally; the remaining records have not
  been imported into Firestore. Composite indexes are defined locally, not deployed.
- The current website still uses its existing local database. Connecting its
  server requires authenticated Google server access; no service-account key or
  new IAM grant was created as part of this setup.
- The standard migration preview now excludes local admin credentials, MFA
  secrets, sessions, login attempts, reviews and activity history. A fresh
  website admin is created through the existing one-time bootstrap flow.

This is the target structure for connecting the existing Node API to Firestore.
The current website continues to use `data/db.json` until that backend connection
and its authentication are configured and tested. Adding Firebase configuration
files does not migrate the website or upload any local data.

| Collection | Document ID | Contents |
| --- | --- | --- |
| projects | Existing project ID | Existing case study fields, slug, cover, gallery, service slugs, SEO, status, archived, order, timestamps |
| services | Existing service ID | Name, slug, summary, description, included, process, related projects, cover, CTA, SEO, status, archived, order |
| reviews | Existing review ID | Project association, public display name, rating, text, consent, moderation status, timestamps |
| site_content | hero, about, contact, footer, branding | Section copy and supported page settings |
| site_settings | navigation, seo | Navigation destinations and site metadata |
| media | Existing media ID | File URL, alt text, file type, byte size, usage references, timestamps; no binary images in documents |
| activity_logs | Event ID | Server-generated administrator activity |
| admin_users | Administrator ID | Private account record; backend access only |
| sessions | Session ID | Hashed token and expiry; backend access only |
| mfa_challenges | Challenge ID | Hashed challenge, expiry, attempts; backend access only |
| login_attempts | Hashed key | Temporary rate-limit/lockout state; backend access only |

Use separate documents per record, preserving the IDs and relationships from the
current site. Do not store the entire database in a single Firestore document.
Empty collections need no placeholder records: Firestore creates them when the
first real record is written.

## Access model

The existing website has its own password + TOTP + HTTP-only session system.
The Firebase Authentication user created in the console is not currently wired
to this website login. Keep all direct browser Firestore access denied. The Node
server verifies its own admin sessions and applies public/published/approved
filtering before returning data.
Google's server SDK uses IAM, so browser rules do not restrict server credentials.
Do not enable test-mode public writes or put a server credential in browser code.

No real account passwords, TOTP secrets, sessions, private reviews or activity
records are included in the content seed export or default migration. The local
JSON data remains the source and backup.

## Content preparation

`node scripts/export-firestore-content.js` exports the existing published projects,
published services and public website settings to the ignored file
`data/firestore-content-seed.json`. It does not connect to Google or upload data.
Review that file before importing it with an authenticated server tool.

The included rules and indexes can be deployed after signing in to Firebase CLI:

```text
firebase deploy --only firestore --project kuldeep-malviya-portfolio
```

This deploys rules/indexes only; it is not a content import or backend migration.
Image uploads require a separate storage configuration; no billing upgrade is
part of this database setup.

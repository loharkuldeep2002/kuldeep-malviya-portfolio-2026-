# Firebase Firestore setup — Kuldeep Malviya Portfolio

This project uses Cloud Firestore through the Node.js Firebase Admin SDK. The browser talks only to the portfolio's Node API; it must never connect to Firestore using server credentials.

## Current project setup

- Firebase project ID: `kuldeep-malviya-portfolio`
- Database: `(default)`, Firestore Standard, expected region `asia-south1` (Mumbai)
- Node dependency: `firebase-admin` is already installed
- Data model and deny-by-default rules: `firebase/SCHEMA.md`, `firebase/firestore.rules`
- Keep `DATA_STORE=json` until the migration is verified. The local JSON file remains the migration source and backup.

The website currently has a **Node.js server**. Its admin login uses the website's existing password + authenticator setup; the Firebase Authentication user created in the console is not connected to this code. Firestore stores the website data, while the trusted Node server accesses it with Firebase Admin SDK credentials.

Project notes say the default Firestore database was created on the Spark plan. Confirm it in Firebase Console before creating anything. A Spark project has only one database eligible for the Firestore free quota; do not create a second database if `(default)` already exists.

## 1. Confirm Firestore in Firebase Console

Open the Firebase project `kuldeep-malviya-portfolio`, then go to **Databases & Storage → Firestore Database**. Confirm the `(default)` database exists, uses Standard edition, and has deny-by-default rules. If it already exists, skip database creation. If it does not exist, create one Standard `(default)` database in `asia-south1` and choose **Production mode**.

Firestore Spark no-cost quotas currently include 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB/month outbound transfer. Quotas can change; check Firebase's pricing page before launch. On Spark, exceeding a no-cost quota can make that service unavailable until the quota resets.

## 2. Set the project ID locally

Copy `.env.example` to `.env` if needed, then set:

```dotenv
DATA_STORE=json
FIREBASE_PROJECT_ID=kuldeep-malviya-portfolio
```

Do not put Firebase service credentials in `assets/`, HTML, browser JavaScript, or a public repository.

## 3. Sign in for local server access

The Firestore adapter uses Google Application Default Credentials (ADC). Install the Google Cloud CLI if it is not installed, open PowerShell, and sign in with a Google account that has access to this Firebase project:

```powershell
gcloud auth application-default login
```

The project already includes `firebase-admin`; no additional database package is needed. For deployments on Google Cloud, use the platform's attached identity where available. If deploying elsewhere, configure server credentials in that host's secret manager; never put a service-account key in browser assets.

## 4. Check access and preview the migration

From the project folder, run:

```powershell
npm run firebase:check
npm run firebase:preview
```

`firebase:check` makes a read-only access check. `firebase:preview` reads local `data/db.json` only and does not connect to or write to Firestore. Review its record counts and confirm the target project ID before continuing.

The migration now excludes local admin credentials, authenticator secrets, sessions, login attempts, reviews, activity history, and bootstrap settings. It preserves the local JSON file. After import, create a fresh website admin through the existing one-time bootstrap flow; this does not use the Firebase Authentication user created in the console.

## 5. Import once, after review

Stop the website server first. When the database is confirmed to be the intended empty portfolio database, run:

```powershell
npm run firebase:apply
```

The script refuses to overwrite a Firestore database with different existing records. It creates a local backup under `data/backups/`, writes the content records, then reads them back and verifies the migration. Continue only if the output says `Migration verified`.

## 6. Switch the website to Firestore

After successful verification, edit `.env`:

```dotenv
DATA_STORE=firestore
FIREBASE_PROJECT_ID=kuldeep-malviya-portfolio
```

Then start the server:

```powershell
npm start
```

The server should report `Datastore: Cloud Firestore`. If startup fails, stop and restore `DATA_STORE=json`; the local JSON and migration backup are preserved.

On first startup after the import, the admin login page should show **First-time setup** because private admin records were intentionally not migrated. Use the one-time `ADMIN_BOOTSTRAP_TOKEN` from the private environment, create a new website admin, then remove the token from the environment. Do not reuse a password that has been shared in chat.

## Security and remaining setup

Firestore rules deny browser reads and writes. The trusted Node server uses Firebase Admin SDK and validates the portfolio admin session before CMS operations. Never switch the rules to public/test access. For a server outside Google Cloud, configure `FIREBASE_SERVICE_ACCOUNT_JSON` as a protected environment secret; never put it in browser assets, `.env.example`, or GitHub.

The media library uses server-issued, five-minute Vercel Blob upload URLs. Connect a Vercel Blob store to the project; Vercel injects `BLOB_READ_WRITE_TOKEN` into selected environments. Production uses that token only when `VERCEL_ENV=production`. Preview requires a separate store token named `BLOB_PREVIEW_READ_WRITE_TOKEN`; never point Preview at the production store. Local uploads remain disabled unless `BLOB_LOCAL_DEVELOPMENT=true` is explicitly set. Uploads accept JPEG/PNG/WebP/GIF up to 20 MB and MP4/WebM/MOV up to 100 MB, and the application stops accepting new uploads near 900 MB to leave headroom under the free allowance. The store is public because portfolio images and videos must render on public pages; anyone with a media URL can view that file. Firebase Storage is not used by this upload flow, so no bucket setup or CORS configuration is needed. Firebase database setup does not deploy the Node website; the host must run this Node server and provide the Firestore identity securely. The current `firebase.json` configures Firestore and Storage rules, not Hosting. Firebase Storage currently requires the Blaze billing plan, so do not enable it under the strict $0 requirement. Vercel Hobby is eligible only for personal, non-commercial projects. Check the service's actual use against Vercel's terms and current Blob limits before operating the public site; this setup does not guarantee unlimited free usage.

## Optional aggregate analytics

Analytics are disabled by default. To enable collection, set `ANALYTICS_ENABLED=true` in the hosting platform's private environment and redeploy only after reviewing the data policy and expected Firestore writes. The dashboard reports aggregate page views, project views, CTA clicks, and validated contact-form intent; it does not count unique visitors or save form fields, email addresses, or raw IP addresses. The server applies a best-effort per-process event limit and retains daily aggregates for 90 days. Because event counts are saved to the configured datastore, each accepted event causes a datastore write; keep this disabled unless that write volume is acceptable.

## Content revisions and backups

Recent project, service, and site-content edits keep bounded snapshots in the settings record (up to 40 revisions, subject to a 700 KiB cap). Revision restore requires the current admin password and explicit `RESTORE` confirmation. A revision cannot bring back an entity that was permanently deleted. Download a JSON backup before a major change. Backups include content and media metadata/references, but not the underlying image/video files, admin accounts, MFA secrets, sessions, or credentials. Restore replaces project/service/review/comment/media metadata and site content/navigation/SEO; admin/security records remain untouched. Verify the referenced media files still exist in Vercel Blob before publishing.

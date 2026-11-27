KULDEEP MALVIYA PORTFOLIO — GIT UPLOAD PACKAGE

This is a clean source package prepared from the confirmed portfolio folder. It contains the website code and the public assets needed to run the site. The original project folder was not changed.

WHAT IS INCLUDED
- Website pages: homepage, projects, services, contact, and admin pages.
- Server code and server-side Firebase Admin / Firestore adapter.
- CSS, browser scripts, project artwork, portraits, resume, and admin UI assets.
- Firestore rules, indexes, Firebase project alias, setup docs, package.json, and package-lock.json.
- A Vercel Node server entrypoint (`server.ts`) and `.gitignore` configured to keep local data and secrets out of Git.

WHAT IS INTENTIONALLY NOT INCLUDED
- `.env` or any credentials, passwords, MFA values, or service-account key.
- `data/` (local JSON data and backups); Firestore is the active data source.
- Existing `uploads/` files (may contain private/untracked media and need durable storage planning).
- `node_modules/`, archives, references, and local scratch folders.
- The separate master prompt / progress log; it is project guidance, not website runtime content.

IMPORTANT
This folder is prepared for source control and a Vercel Preview deployment workflow. It is not marked production-ready yet. Read `VERCEL_DEPLOYMENT_GUIDE.txt` before deploying. Admin media now uses signed direct uploads to Vercel Blob; connect a separate store for each environment. Preview needs its own `BLOB_PREVIEW_READ_WRITE_TOKEN`, and local uploads are disabled unless explicitly opted in. Public media URLs are visible to anyone who has the link. The admin uses a 900 MB application safety cap; review current Vercel Blob plan limits and usage before launch.

Do not drag the original `.env`, `data/`, or `uploads/` into this package. Do not paste secret values into chat.

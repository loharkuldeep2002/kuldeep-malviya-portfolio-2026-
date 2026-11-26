# Portfolio + private CMS — setup and handoff

The site is still the original dark/lime portfolio, now served by a small
zero-dependency Node server with a private admin CMS.

## Run it

```bash
node server.js
```

- Site: <http://127.0.0.1:3000/>
- Admin: <http://127.0.0.1:3000/admin>

`/admin` is the entry point: signed-out visitors go to `/admin/login`, and
signed-in visitors go to `/admin/dashboard`. These are separate HTML pages.
The server checks the session before serving the dashboard. After successful
setup or password + MFA sign-in, the login page navigates to the dashboard;
signing out returns to the login page. Admin pages are served with `no-store`.

No `npm install` is needed: the server uses only Node's standard library.
Requires Node 20+ (tested on Node 22). Data is stored in `data/db.json`, uploads
in `uploads/`.

## First-time admin setup (secure bootstrap)

1. Before first launch, create a long random `ADMIN_BOOTSTRAP_TOKEN` in the private `.env` file.
2. Open `/admin`. With no administrator configured, the setup screen appears.
3. Enter the admin email and setup token, then start setup.
4. Scan the displayed QR code with an authenticator app (Google Authenticator,
   Microsoft Authenticator, 1Password, Authy, …). Alternatively, choose
   **Enter a setup key** and paste the generated secret, or use the
   `otpauth://` link. The QR is generated locally in the browser with a bundled
   QR encoder; the enrollment URI is never sent to an external QR service.
5. Enter the current 6-digit code, choose a password (12+ characters with upper
   case, lower case and a number) and create the account.

The account is only created after the server verifies the one-time setup token
and a valid TOTP code. Remove `ADMIN_BOOTSTRAP_TOKEN` from the server environment
after the first administrator is created. There is no default password and no
client-side-only login.

## Sign in

Password first, then the authenticator code. Both are verified on the server.
Sessions are HTTP-only cookies (`SameSite=Strict`), stored hashed server-side.
**Keep me signed in** is enabled by default and remembers this browser for 30 days,
including after closing and reopening it. Unchecking it uses an 8-hour session.
Each new browser/device requires its own password and authenticator verification.
The 5-minute limit applies only to an unfinished MFA challenge, not a signed-in session.
Signing out or revoking a session ends access immediately. Clearing cookies or using
private browsing requires another sign-in. A still-valid session created before this
feature is upgraded on its next dashboard request; expired sessions are not restored.
The dashboard remembers the last section selected in each browser.
Sessions can be revoked from **Account & security**. Five failed
password attempts lock that email/IP pair for 15 minutes.

## Password / authenticator recovery

No email provider is configured, so password reset and email OTP are not
offered. Recovery is a local, filesystem-owner-only operation:

```bash
node scripts/reset-admin.js --email you@example.com
# add --reset-mfa to also issue a new authenticator secret
```

This revokes all sessions. Anyone who can run that command already has write
access to `data/db.json`, so keep the server and data directory private.

## What the admin can manage

- **Overview** — counts, pending reviews, recent activity.
- **Projects** — every case-study field, gallery, related services, SEO,
  draft/published, ordering, archive, permanent delete, draft preview.
- **Services** — full details, included items, ideal client, process steps,
  related projects, cover image, CTA, quote label, SEO, ordering, status.
- **Reviews** — approve, reject, hide, edit display name/text/rating, delete.
- **Media** — upload (JPEG/PNG/WebP/GIF, max 5 MB), alt text, replace everywhere
  it is used, delete (blocked while still referenced).
- **Website content** — hero copy, stats, CTAs, about, contact details, footer.
- **Navigation & footer** — primary nav and footer columns/links.
- **SEO & settings** — site title, description, share image, canonical URL,
  noindex.
- **Account & security** — password change, authenticator reset, active
  sessions.

Public pages read only published content:

- `/` — homepage (editable copy and grids)
- `/project/<slug>` — case study + approved reviews + review form
- `/services/<slug>` — service detail
- `/sitemap.xml`, `/robots.txt`

Draft preview: open `/project/<slug>?preview=1` or
`/services/<slug>?preview=1` while signed in.

## Reviews

Reviews are stored with a status of `pending`. Only `approved` reviews are
returned by the public API, and the aggregate rating is calculated from those
approved reviews only. The form requires a display name, rating, review text and
public-display consent; email addresses are not collected or shown. Input is
trimmed and stripped of control characters, HTML is never rendered as markup,
and there is a basic per-IP submission limit (5 per 24 hours) plus duplicate
text rejection. Moderation happens in the dashboard.

## Storage and schema

`server/db.js` contains the versioned schema/migrations and seeds the seven
existing projects and six services from the current portfolio content. It
creates `data/db.json` on first run (atomic writes via temp file + rename).

Groups: `admins`, `sessions`, `mfaChallenges`, `attempts`, `projects`,
`services`, `reviews`, `media`, `content`, `nav`, `seo`, `activity`,
`settings`.

Uploaded media is written to `uploads/` and served from `/uploads/...`.
`SITE_URL` (see `.env.example`) is only used for sitemap/canonical links.

## Security notes

- Password hashes: scrypt with a random per-user salt.
- MFA: RFC 6238 TOTP verified server-side, ±1 step drift, 6 digits.
- MFA challenge tokens are single-use, hashed at rest, expire in 5 minutes and
  allow 5 attempts.
- Every `/api/admin/*` action is authorised from the server session, not the UI.
- Mutating requests require a same-origin `Origin`/`Referer`.
- Content Security Policy blocks third-party scripts; only Google Fonts is
  allowed for styles/fonts.
- `data/db.json` and `uploads/` must stay out of version control and public
  static hosting; the server is the only thing that should read them.
- The admin password, TOTP secret and session tokens are never sent to the
  browser except the current session cookie (HTTP-only).

## Deployment notes

The server is a plain Node HTTP server. Put it behind an HTTPS reverse proxy
(e.g. Nginx/Caddy) and set `SITE_URL` and `COOKIE_SECURE=1` (or send
`X-Forwarded-Proto: https`). Persist the `data/` and `uploads/` directories
between deploys. Static-only hosts (Netlify/GitHub Pages) cannot run the admin
API or review moderation.

## Remaining assets / limitations

- No transactional email provider is connected, so email OTP and
  self-service password reset are intentionally absent.
- Project outcome fields are empty by default because no verified outcome data
  was provided; the admin can add them.
- Capabilities, process, toolkit and education sections remain fixed page
  structure (not free-form CMS fields), by design.

# 🚀 Kuldeep Malviya — Portfolio Website (2026 Edition)

For the Firebase Firestore connection and safe local-data import steps, see [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md).

## Gallery and pages — 24 November 2026

- Selected Work is now an image-only gallery with natural image proportions. Clicking opens an accessible artwork dialog with a link to the full case study.
- Add additional images through Admin → Projects → Gallery. The viewer uses the cover plus gallery images, with previous/next controls, keyboard arrows and swipe. Controls stay hidden for a single image.
- Dedicated pages: `/services` and `/contact`. Header/footer navigation links to these pages.
- Contact uses **Prepare email**: it validates the fields and opens the visitor's email app with a draft. The visitor must send that draft; server email delivery is not configured.
- Launch with `start_preview.bat` or `node server.js`, then open `http://127.0.0.1:3000`. The site routes and CMS require the server.
- Previous versions of the main edited files are in `archive/2026-11-24-gallery-before/`.

Welcome to the official portfolio codebase for **Kuldeep Malviya** (Independent Graphic Designer & Digital Creative).
Designed with a cinematic **Obsidian Black & Cyber Lime / Emerald Glassmorphism** aesthetic, inspired by Swiss Grid typography, interactive 3D motion, and fine technical drafting lines.

---

## 📂 Project Structure & File Guide (Kon Si File Kaam Ki Hai)

Aapke folder ko cleanly categorize aur organize kar diya gaya hai taaki koi bhi confusion na rahe:

### ⭐ 1. Core Live Website Files (Ye Sabse Main / Kaam Ki Files Hain)
Inhi files se aapki live website chal rahi hai:

| File / Folder Path | Type | Purpose |
| :--- | :--- | :--- |
| **`index.html`** | HTML5 | **Main Website** — Poora single-page portfolio (Hero + 9 synchronized sections + modal dialog). |
| **`assets/style.css`** | CSS3 | **Main Stylesheet** — Obsidian dark theme, frosted glass cards, Swiss grid frame, glowing 3D sphere, responsive layouts. |
| **`assets/app.js`** | JavaScript | **Interactive Engine** — Mouse cursor glow follower, 3D perspective tilt on hover, scroll animations, sticky navigation, project modal dialog, contact validation. |
| **`assets/portrait-white.png`** | Asset (PNG) | **Kuldeep's Real Cutout** — Transparent cutout portrait in clean white crewneck t-shirt with textured quiff & beard (Hero & About section me use ho raha hai). |
| **`assets/resume.pdf`** | Document (PDF) | **Kuldeep's Official Resume** — Linked in the portfolio for clients to download. |
| **`assets/projects/`** | Image Folder | **Case Study Images** — Sabhi 7 active case studies ke high-res images (`noire.jpg`, `mo-zone.jpg`, `terrax.jpg`, `organic-food.jpg`, `vlare.jpg`, `creative-journal.jpg`, `aurix.jpg`). |
| **`start_preview.bat`** | Batch File | **1-Click Preview** — Double-click karte hi default browser me aapki live site open ho jati hai. |
| **`start_server.bat`** | Batch File | **1-Click Web Server** — Local development web server start karta hai (`http://localhost:3000`). |

---

### 🎨 2. `references/` Folder (Aapke Design & Photo References)
Ye folder aapke original reference photos aur visual mockups ko safe rakhne ke liye hai:

- `01-Textured-Quiff-with-High-Fade 01.png` — Hairstyle & grooming reference
- `Clean white-crewneck portrait-2.png` — Alternate white crewneck portrait photo
- `Distinctive by design_ premium portfolio.png` — Visual moodboard & design reference
- `Portrait in a black crewneck-1.png` & `Portrait cutout...png` — Original high-res source cutouts

---

### 🗄️ 3. `archive/` Folder (Purani / Extra Files — Live Site Me Inki Zaroorat Nahi Hai)
Ye purane drafts aur backup files hain jinhe delete nahi kiya gaya hai taaki safe rahein, lekin ye live website par use nahi hoti:

- **`archive/old-site/`**:
  - `site_fresh.html` — Pichla gold/olive theme ka HTML export.
  - `saved_app.js` — Purana script backup.
  - `portfolio_data.json` — Purana JSON data backup.
- **`archive/old-assets/`**:
  - `build.css` & `build.js` — Experimental build files jo layout ko glitch kar rahi thi (ab disabled/archived).
  - `luxury.css` — Purana draft stylesheet (iske sabhi essential styles `assets/style.css` me merge ho chuke hain).
  - `kuldeep-portrait.jpg` — Beige background wali photo.
  - Purani cover images & website thumbnails.
- **`archive/screenshots/`**:
  - Browser QA testing aur verification ke dauraan li gayi test screenshots.

---

## 🖥️ How To Run & Test (Kaise Chalayein)

### Option 1: Direct 1-Click Launch (Recommended)
1. Apne folder me **`start_preview.bat`** par double click karein.
2. Aapka default browser (Chrome, Edge, etc.) turant **`index.html`** open kar dega.

### Option 2: Local Web Server + Admin CMS (recommended)
1. **`start_server.bat`** par double click karein, ya terminal me `node server.js` chalayein.
2. Server start hoga: `http://127.0.0.1:3000`
3. Website: `http://127.0.0.1:3000` — Admin dashboard: `http://127.0.0.1:3000/admin`
4. Server band karne ke liye console me `Ctrl + C` dabayein.

Pehli baar admin setup karna hoga (password + authenticator app). Poori setup aur security details **`SETUP.md`** me hain. Isme kisi npm install ki zaroorat nahi hai — sirf Node.js chahiye.

CMS se hero/about/contact/footer copy, projects, services, reviews, media, navigation aur SEO manage hota hai. Case studies `/project/<slug>` par aur services `/services/<slug>` par milti hain.

---

## 🌐 Deploying to the Web (Hosting)
The site now needs a Node.js process because the admin dashboard, media uploads and review moderation run on the server. A static-only host (Netlify Drop, GitHub Pages) will serve the pages but cannot run `/admin` or accept reviews.

Use Node.js 20 or newer. Set `ADMIN_BOOTSTRAP_TOKEN` before first-admin setup and remove it after the administrator is created.

- Run `node server.js` on a Node 20+ host (Render, Railway, Fly.io, a VPS, etc.).
- Put it behind HTTPS and set `SITE_URL` + `COOKIE_SECURE=1` (see `.env.example`).
- Persist the `data/` and `uploads/` directories between deploys.
- Follow **`SETUP.md`** for the secure first-admin bootstrap, authenticator MFA and recovery steps.

Never commit `.env`, `data/db.json` or `uploads/` — they contain the password hash, TOTP secret, sessions and private review records.

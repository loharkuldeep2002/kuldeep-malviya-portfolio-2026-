# 🎯 MASTER PROMPT: KULDEEP MALVIYA PORTFOLIO WEBSITE (2026 EDITION)

---

## 📌 Prompt Overview
Use this Master Prompt whenever you need to recreate, rebuild, redesign, or expand the official interactive portfolio website for **Kuldeep Malviya**. This prompt incorporates all finalized design directions, typography standards, visual references, asset requirements, and technical constraints.

---

```markdown
# MISSION
Build a world-class, cinematic, interactive graphic design portfolio website for "Kuldeep Malviya", an independent graphic designer and digital creative based in Indore, India. The website must feel like a high-end Swiss-inspired creative studio with dark obsidian surfaces, glassmorphism, fine technical drafting lines, 3D tilt interactions, and an ultra-restrained 2-color orbital motion system.

---

## 1. BRAND IDENTITY & CORE POSITIONING

- **Designer Name**: Kuldeep Malviya
- **Monogram / Brand Mark**: KM
- **Role / Positioning**: Independent Graphic Designer & Digital Creative creating identities, digital experiences, and visual systems.
- **Location**: Indore, India · 22.7196° N / 75.8577° E
- **Main Tagline / Headline**: 
  "Distinctive by design."
  *(Crucial: Highlight ONLY the word "design." in glowing Acid Lime `#C9FF20` with a trailing period).*
- **Supporting Narrative**: 
  "Graphic designer creating identities, digital experiences and visual systems."
- **Primary CTAs**:
  - Primary: "Explore selected work ↗" (Anchor: `#work`)
  - Secondary: "Let's talk →" (Anchor: `#contact`)
- **Key Statistics**:
  - `45+` Projects delivered
  - `5+` Years of experience
  - `900+` Design assets created

---

## 2. COLOR PALETTE & STRICT 2-COLOR MOTION RULE

### Core Color System
```css
--background: #071014;           /* Deep midnight obsidian */
--background-secondary: #0B171B; /* Technical dark slate */
--surface: rgba(22, 42, 44, 0.62); /* Frosted dark glass surface */
--surface-hover: rgba(31, 59, 57, 0.80);
--text: #F4F7F3;                 /* Crisp off-white */
--muted: #A5B1AD;                /* Technical muted gray */
--border: rgba(207, 235, 223, 0.22); /* Technical grid hairline */

/* STRICT 2-COLOR ACCENT RULE FOR BACKGROUND LINES & MOTION: */
--lime: #C9FF20;                 /* Primary Accent 1: Luminous Acid Lime */
--white-soft: #F4F7F3;           /* Primary Accent 2: Crisp White / Light Gray */
```

### ⚠️ STRICT RESTRICTION: NO MULTI-COLORS
- **DO NOT** use cyan (`#72F1ED`), blue, violet, or multi-colored gradients on the background lines or orbital curves.
- The rotating curves, orbital rings, and glowing nodes behind the hero portrait MUST strictly use ONLY 2 colors:
  1. **Color 1**: Luminous Acid-Lime (`#C9FF20`)
  2. **Color 2**: White / Light Gray (`#FFFFFF` / `rgba(244, 247, 243, 0.25)`)

---

## 3. TYPOGRAPHY SYSTEM

- **Headings & Display**: Modern geometric grotesk (e.g. `Manrope`, `Inter`, `Satoshi`)
  - Tight letter spacing (`-0.04em` to `-0.05em`)
  - Confident weights: 700 or 800
  - Spacious, editorial line-height
- **Technical Accents & Labels**: Technical monospace (e.g. `DM Mono` or `Space Mono`)
  - Uppercase with wide letter spacing (`0.14em` to `0.24em`)
  - Small font sizes (`8px` to `11px`) for coordinate tags, rulers, and metadata

---

## 4. HERO SECTION COMPOSITION (EXACT 1-TO-1 MATCH TO REFERENCE)

The Hero Section must follow the open widescreen cinematic layout matching reference `media_1795251925209_a3664592.jpg`:

1. **Top Header (`#siteHeader`)**:
   - Left: Rounded lime badge `KM` + `Kuldeep Malviya PORTFOLIO`
   - Center Navigation: `Work`, `Services`, `About`, `Contact`
   - Right: `#motionToggle` button (`● Motion`) + `● Available for projects` pill badge with green status dot.
2. **Meta Bar**:
   - Left: `● 01 — INTRODUCTION` with glowing `#C9FF20` dot
   - Right: `INDORE, INDIA · 22.7196° N / 75.8577° E`
   - Full-width subtle horizontal divider line underneath.
3. **Left Measurement Rail**:
   - Thin vertical drafting line with tick marks: `- 1180`, `860`, `520`, `180`.
4. **Left Column (Typography & Actions)**:
   - Pill badge: `● Graphic Design Portfolio`
   - Headline: `Distinctive`<br>`by `<span class="lime">`design.`</span>
   - Paragraph: `Graphic designer creating identities, digital experiences and visual systems.`
   - Two CTA buttons:
     - Solid Acid-Lime button: `Explore selected work ↗` (`background: #C9FF20; color: #071014; border-radius: 100px;`)
     - Ghost dark pill: `Let's talk →` (`border: 1px solid rgba(207, 235, 223, 0.25); border-radius: 100px;`)
   - 3 Stats Row: `45+` Projects delivered | `5+` Years of experience | `900+` Design assets created.
5. **Right Column (Hero Visual Stage)**:
   - **Portrait Card**:
     - Translucent glassmorphic card (`aspect-ratio: 4 / 5`, `border-radius: 26px`, `backdrop-filter: blur(16px)`).
     - 4 technical corner reticles in Acid Lime: `┌ ┐ └ ┘` (`#C9FF20`).
     - Inside: Transparent cutout of Kuldeep Malviya in a **clean white crewneck t-shirt** (`assets/portrait-white.png`) with natural hair (textured quiff & beard), ~50px headroom, and clean alpha margins.
     - Floating badge on the card: `● Kuldeep Malviya / GRAPHIC DESIGNER`.
     - Sub-caption below the card: `FIG. 01 — PORTRAIT` on left, `EST. 2019` on right.
   - **Orbital Curve System (2 Colors Only)**:
     - Behind the card: Soft `#C9FF20` lime aura glow (`.portrait-aura`).
     - Orbit 1 (`.orbit-1`): Rotating solid arc in `#C9FF20` with one glowing `#C9FF20` node.
     - Orbit 2 (`.orbit-2`): Reverse-rotating dashed arc in White / Light Gray (`rgba(244, 247, 243, 0.22)`) with one pure white (`#FFFFFF`) glowing node.
   - *(Note: Floating decorative cursor arrow is completely removed per client directive).*

---

## 5. FULL 9-SECTION STRUCTURE

1. **01 — Selected Work (`#work`)**:
   - Featured Case Study: **Noiré — 3D Product Visualization** (Cinematic fragrance bottle in black glass with live interactive view, tags, and stats).
   - 6 Commercial Projects Grid:
     1. *MO Zone Naturals* — Brand Identity & Organic Packaging
     2. *TERRAX Pumps* — Industrial Web Platform & Layout System
     3. *Organic Food* — Fresh Produce E-commerce Store
     4. *VLAIRE Fashion* — High-Fashion Editorial Lookbook & Brand
     5. *The Creative Journal* — Editorial Publication Layout System
     6. *Aurix Headphones* — 3D Audio Hardware Visualization & Lighting
   - Interactive Project Modal Dialog (`#projectDialog`): Click any project to open full image preview, details, tags, and external link.
2. **02 — Capabilities (`#capabilities`)**:
   - 5 interactive accordion items: *Brand Identity & Systems*, *Digital & Web Experiences*, *Packaging & Print Production*, *3D Visualization & Motion*, *Art Direction & Creative Strategy*.
3. **03 — Design Process (`#process`)**:
   - 5-step numbered strategic pipeline: `01 Discover & Audit` → `02 Strategy & Positioning` → `03 Design & Exploration` (highlighted in glowing `#C9FF20`) → `04 Refinement & Systems` → `05 Delivery & Handover`.
4. **04 — Services (`#services`)**:
   - 4 glassmorphic service cards with deliverables: *Identity Systems*, *Digital Design*, *Creative Direction*, *Packaging & Print*.
5. **05 — About (`#about`)**:
   - Split layout: White crewneck portrait on the left, personal design philosophy on the right, signature, and direct download link for `assets/resume.pdf`.
6. **06 — Work Journey / Experience (`#experience`)**:
   - Chronological timeline (2019 – Present): *Lead Brand Designer*, *Senior Graphic Designer*, *Digital Designer*, *Junior Visual Designer*.
7. **07 — Creative Toolkit (`#toolkit`)**:
   - 10 tool badges categorized into Brand, UI/UX, and 3D: *Figma*, *Adobe Illustrator*, *Adobe Photoshop*, *After Effects*, *Blender*, *Cinema 4D*, *InDesign*, *Lightroom*, *Principle*, *Spline*.
8. **08 — Education & Background (`#education`)**:
   - Academic milestones:
     - **Master of Computer Applications (MCA)** — 2021 to 2023
     - **Bachelor of Computer Applications (BCA)** — 2018 to 2021
9. **09 — Contact & Consultation (`#contact`)**:
   - Glassmorphic contact form with client-side validation (Name, Email, Service select, Budget range, Message).
   - Direct email: `kuldeep@malviya.design`
   - Location: Indore, India · 22.7196° N / 75.8577° E.
   - Ambient lime aura glow.

---

## 6. TECHNICAL ARCHITECTURE & PERFORMANCE RULES

- **Zero Build Dependencies**: Pure standard **HTML5**, **CSS3**, and **Vanilla JavaScript** (ES6+). No npm, Node.js build, bundler, or framework required. Works instantly by double-clicking `index.html`.
- **Responsive System**: Fluid 12-column CSS Grid desktop down to 1-column mobile stack (< 720px). Zero horizontal scroll or overflow.
- **Accessibility & Motion Control**:
  - Includes `#motionToggle` button allowing users to toggle ambient animations on/off.
  - Respects `@media (prefers-reduced-motion: reduce)`.
  - Proper ARIA landmarks, `skip-link`, and alt text on all images.
- **File System Organization**:
  ```
  📁 Root/
  ├── index.html            (Single production HTML document)
  ├── README.md             (Complete user guide and documentation)
  ├── MASTER_PROMPT.md      (This master specification document)
  ├── start_preview.bat     (1-click browser preview launcher)
  ├── start_server.bat      (1-click local Python web server)
  ├── 📁 assets/
  │   ├── style.css         (Single production stylesheet)
  │   ├── app.js            (Interactive scripts: tilt, modal, validation)
  │   ├── portrait-white.png (2.18 MB transparent cutout in white crewneck)
  │   ├── resume.pdf        (Official PDF resume)
  │   └── 📁 projects/      (All 7 project preview images)
  ├── 📁 references/        (Source photos & moodboard mockups)
  └── 📁 archive/           (Safely preserved legacy drafts)
  ```
```

'use strict';

/**
 * Dependency-free JSON datastore with versioned migrations.
 * Data lives in data/db.json and is written atomically.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const SCHEMA_VERSION = 1;

function uid(prefix = '') {
  return `${prefix}${crypto.randomUUID()}`;
}

const PROJECT_SEED = [
  {
    slug: 'noire',
    title: 'Noiré',
    subtitle: '3D Product Visualization',
    client: 'Noiré',
    category: '3D Visualization',
    year: '2026',
    shortDescription: 'A cinematic product world for a premium fragrance brand.',
    challenge:
      'A fragrance launch needed imagery that felt considered and premium without relying on photography. The bottle had to read as the hero across campaign crops and packaging placements.',
    approach:
      'The bottle was rendered in obsidian fluted glass perched on hand-chiselled slate plinths, surrounded by atmospheric mist and restrained lime lighting reflections. Camera angles and lighting were built as a repeatable set rather than one-off frames.',
    deliverables: ['12 camera angles', '4K render output', 'Lighting and material study'],
    outcome: '',
    tags: ['Fragrance', 'Art direction', '3D render'],
    cover: 'assets/projects/noire.jpg',
    coverAlt: 'Noiré fragrance bottle rendered in black glass on a dark stone plinth',
    gallery: [],
    services: ['3d-visualization'],
    facts: [
      { value: '12', label: 'Camera angles' },
      { value: '4K', label: 'Render output' },
      { value: '6 wk', label: 'Concept to delivery' }
    ],
    seoTitle: 'Noiré — 3D Product Visualization | Kuldeep Malviya',
    seoDescription: 'Cinematic 3D product visualization and art direction for the Noiré fragrance launch.',
    status: 'published',
    order: 1,
    archived: false
  },
  {
    slug: 'mo-zone-naturals',
    title: 'MO Zone Naturals',
    subtitle: 'Brand Identity',
    client: 'MO Zone Naturals',
    category: 'Brand Identity',
    year: '2025',
    shortDescription: 'A natural, trustworthy identity system for a daily essentials brand.',
    challenge:
      'A daily essentials brand needed to look trustworthy on shelf and consistent across packaging, retail and digital touchpoints.',
    approach:
      'Built an identity around organic geometry, a calm typographic hierarchy and a packaging suite that scales from sachets to cartons without losing recognition.',
    deliverables: ['Logo and mark system', 'Typography and colour system', 'Packaging suite', 'Brand guidelines'],
    outcome: '',
    tags: ['Identity', 'Packaging', 'Guidelines'],
    cover: 'assets/projects/mo-zone.jpg',
    coverAlt: 'MO Zone Naturals brand identity — packaging and visual system',
    gallery: [],
    services: ['identity-systems', 'packaging-print'],
    facts: [],
    seoTitle: 'MO Zone Naturals — Brand Identity | Kuldeep Malviya',
    seoDescription: 'Identity system and packaging design for MO Zone Naturals daily essentials.',
    status: 'published',
    order: 2,
    archived: false
  },
  {
    slug: 'terrax-pumps',
    title: 'TERRAX Pumps',
    subtitle: 'Industrial Web Platform & Layout System',
    client: 'TERRAX Pumps',
    category: 'Web Platform',
    year: '2025',
    shortDescription: 'A confident industrial web presence built around product clarity.',
    challenge:
      'A wide industrial pump catalogue had to stay readable and easy to navigate for dealers and technical buyers.',
    approach:
      'Designed a product-led layout system with clear technical specifications, consistent comparison patterns and a dealer lookup flow, then handed off a documented responsive component set.',
    deliverables: ['Responsive page system', 'Product and spec templates', 'Dealer lookup flow', 'Design handoff documentation'],
    outcome: '',
    tags: ['Web', 'Industrial', 'Layout system'],
    cover: 'assets/projects/terrax.jpg',
    coverAlt: 'TERRAX Pumps industrial web platform and technical layout system',
    gallery: [],
    services: ['digital-design'],
    facts: [],
    seoTitle: 'TERRAX Pumps — Industrial Web Platform | Kuldeep Malviya',
    seoDescription: 'Industrial web platform and responsive layout system for TERRAX Pumps.',
    status: 'published',
    order: 3,
    archived: false
  },
  {
    slug: 'organic-food',
    title: 'Organic Food',
    subtitle: 'Fresh Produce E-commerce Store',
    client: 'Organic Food',
    category: 'E-commerce',
    year: '2024',
    shortDescription: 'A product-led commerce experience for an organics manufacturer.',
    challenge:
      'Direct-to-consumer ordering had to feel simple on mobile while making produce quality and nutrition information easy to trust.',
    approach:
      'Structured the storefront around product photography, short nutrition summaries and a short checkout path, with a mobile-first layout that keeps categories scannable.',
    deliverables: ['Storefront UI', 'Product templates', 'Mobile checkout flow'],
    outcome: '',
    tags: ['Ecommerce', 'UI', 'Storefront'],
    cover: 'assets/projects/organic-food.jpg',
    coverAlt: 'Organic Food fresh produce e-commerce store homepage',
    gallery: [],
    services: ['digital-design'],
    facts: [],
    seoTitle: 'Organic Food — E-commerce Store | Kuldeep Malviya',
    seoDescription: 'Product-led e-commerce storefront design for an organics manufacturer.',
    status: 'published',
    order: 4,
    archived: false
  },
  {
    slug: 'vlare-fashion',
    title: 'VLAIRE Fashion',
    subtitle: 'High-Fashion Editorial Lookbook & Brand',
    client: 'VLAIRE',
    category: 'Editorial & Brand',
    year: '2024',
    shortDescription: 'A magazine-led storefront where imagery leads the narrative.',
    challenge:
      'A fashion label needed a digital presence that behaved like an editorial spread rather than a standard catalogue.',
    approach:
      'Built an image-first layout with generous pacing, oversized type and restrained navigation so lookbook imagery carries the story while shopping stays reachable.',
    deliverables: ['Editorial layout system', 'Lookbook templates', 'Brand art direction'],
    outcome: '',
    tags: ['Fashion', 'Editorial', 'Brand'],
    cover: 'assets/projects/vlare.jpg',
    coverAlt: 'VLAIRE Fashion high-fashion editorial lookbook and brand system',
    gallery: [],
    services: ['creative-direction', 'graphic-design'],
    facts: [],
    seoTitle: 'VLAIRE Fashion — Editorial Lookbook & Brand | Kuldeep Malviya',
    seoDescription: 'High-fashion editorial lookbook and brand art direction for VLAIRE.',
    status: 'published',
    order: 5,
    archived: false
  },
  {
    slug: 'creative-journal',
    title: 'The Creative Journal',
    subtitle: 'Editorial Publication Layout System',
    client: 'The Creative Journal',
    category: 'Publication',
    year: '2024',
    shortDescription: 'A flexible editorial framework for stories, collections and launches.',
    challenge:
      'A publication needed one layout framework flexible enough for long-form essays, interviews and visual galleries.',
    approach:
      'Defined a modular grid, a small set of article templates and consistent typographic rules so editors can assemble issues without breaking the visual language.',
    deliverables: ['Modular grid', 'Article templates', 'Typographic system'],
    outcome: '',
    tags: ['Editorial', 'Design system', 'Publication'],
    cover: 'assets/projects/creative-journal.jpg',
    coverAlt: 'The Creative Journal editorial design system and article layout',
    gallery: [],
    services: ['graphic-design', 'creative-direction'],
    facts: [],
    seoTitle: 'The Creative Journal — Editorial Layout System | Kuldeep Malviya',
    seoDescription: 'Editorial publication layout system and typographic framework for The Creative Journal.',
    status: 'published',
    order: 6,
    archived: false
  },
  {
    slug: 'aurix-headphones',
    title: 'Aurix Headphones',
    subtitle: '3D Audio Hardware Visualization & Lighting',
    client: 'Aurix',
    category: '3D Visualization',
    year: '2026',
    shortDescription: 'Material, light and form studies for a personal audio product.',
    challenge:
      'An audio hardware concept needed visuals that communicated material quality before a physical prototype existed.',
    approach:
      'Explored acoustic form, tactile memory-foam ear cushions and anodised aluminium earcups through material and lighting studies, rendering each surface so it reads clearly at product-shot scale.',
    deliverables: ['Material and lighting study', 'Product renders', 'Form exploration'],
    outcome: '',
    tags: ['3D', 'Product render', 'Lighting'],
    cover: 'assets/projects/aurix.jpg',
    coverAlt: 'Aurix Headphones 3D audio hardware visualization and lighting study',
    gallery: [],
    services: ['3d-visualization'],
    facts: [],
    seoTitle: 'Aurix Headphones — 3D Product Visualization | Kuldeep Malviya',
    seoDescription: '3D audio hardware visualization, material and lighting study for Aurix headphones.',
    status: 'published',
    order: 7,
    archived: false
  }
];

const SERVICE_SEED = [
  {
    slug: 'identity-systems',
    name: 'Identity Systems',
    summary: 'Logos, typography, colour and guidelines built as one scalable system.',
    description:
      'Brand identity work that starts with positioning and ends with a system your team can actually use. Marks, type scales, colour, layout rules and asset libraries are designed together so every touchpoint feels like the same brand.',
    included: ['Logo and mark system', 'Typography and colour system', 'Brand guidelines', 'Asset library and templates'],
    idealFor: 'Founders and teams launching or repositioning a brand that needs to scale across print and digital.',
    process: [
      { title: 'Discover & audit', description: 'Understand the business, audience and existing visual equity.' },
      { title: 'Strategy & positioning', description: 'Define the direction and the story the identity has to carry.' },
      { title: 'Design & exploration', description: 'Explore marks, type and colour as a connected system.' },
      { title: 'Refinement & systems', description: 'Test the system across real touchpoints and document the rules.' },
      { title: 'Delivery & handover', description: 'Deliver files, guidelines and a clean handoff.' }
    ],
    relatedProjects: ['mo-zone-naturals'],
    cover: 'assets/projects/mo-zone.jpg',
    coverAlt: 'MO Zone Naturals identity and packaging system',
    priceLabel: 'Request a quote',
    ctaLabel: 'Start a project',
    ctaHref: '/#contact',
    seoTitle: 'Brand Identity Systems — Kuldeep Malviya',
    seoDescription: 'Identity design, logo systems, typography, colour and brand guidelines by Kuldeep Malviya.',
    status: 'published',
    order: 1,
    archived: false
  },
  {
    slug: 'digital-design',
    name: 'Digital Design',
    summary: 'Websites, product interfaces and responsive design systems.',
    description:
      'Web and interface design built around clarity: structure first, then visual language, then responsive behaviour. Deliverables are documented so development handoff stays predictable.',
    included: ['UX structure and flows', 'UI design', 'Responsive page systems', 'Design-to-development handoff'],
    idealFor: 'Businesses that need a clearer website, product interface or a reusable responsive system.',
    process: [
      { title: 'Audit & structure', description: 'Map content, journeys and the pages that matter most.' },
      { title: 'Wireframe direction', description: 'Settle hierarchy and layout before visual detail.' },
      { title: 'Interface design', description: 'Design the visual system and key screens.' },
      { title: 'Responsive build-out', description: 'Define tablet and mobile behaviour for every component.' },
      { title: 'Handoff', description: 'Deliver components, states and documentation.' }
    ],
    relatedProjects: ['terrax-pumps', 'organic-food'],
    cover: 'assets/projects/terrax.jpg',
    coverAlt: 'TERRAX Pumps industrial web platform layout',
    priceLabel: 'Request a quote',
    ctaLabel: 'Start a project',
    ctaHref: '/#contact',
    seoTitle: 'Web & UI/UX Design — Kuldeep Malviya',
    seoDescription: 'Responsive website and interface design, UX structure and design systems by Kuldeep Malviya.',
    status: 'published',
    order: 2,
    archived: false
  },
  {
    slug: 'packaging-print',
    name: 'Packaging & Print',
    summary: 'Dielines, label systems and production-ready artwork.',
    description:
      'Packaging and print design prepared properly for production: correct dielines, print-ready artwork, material notes and clear specifications so what ships matches what was designed.',
    included: ['Packaging design', 'Dielines', 'Label systems', 'Pre-press and print specification'],
    idealFor: 'Consumer brands moving from concept to shelf, or teams preparing a print run.',
    process: [
      { title: 'Brief & constraints', description: 'Understand format, material and production limits.' },
      { title: 'Structure', description: 'Define the dieline, hierarchy and information layout.' },
      { title: 'Artwork', description: 'Design the final visual treatment across variants.' },
      { title: 'Pre-press', description: 'Prepare print-ready files and specifications.' },
      { title: 'Production support', description: 'Review proofs and answer printer queries.' }
    ],
    relatedProjects: ['mo-zone-naturals'],
    cover: 'assets/projects/mo-zone.jpg',
    coverAlt: 'MO Zone Naturals packaging and label system',
    priceLabel: 'Request a quote',
    ctaLabel: 'Start a project',
    ctaHref: '/#contact',
    seoTitle: 'Packaging & Print Design — Kuldeep Malviya',
    seoDescription: 'Packaging design, dielines, label systems and print-ready artwork by Kuldeep Malviya.',
    status: 'published',
    order: 3,
    archived: false
  },
  {
    slug: '3d-visualization',
    name: '3D Product Visualization',
    summary: 'Product worlds, material studies and lighting built for campaigns.',
    description:
      '3D visualisation for products that need to look real before they exist. Models, materials, lighting and camera sets are built as a repeatable scene so campaign imagery stays consistent.',
    included: ['3D modelling', 'Lighting and materials', 'Product renders', 'Camera and scene sets'],
    idealFor: 'Product brands that need campaign or catalogue imagery without a full photo production.',
    process: [
      { title: 'Reference & direction', description: 'Agree the look, materials and shot list.' },
      { title: 'Blockout', description: 'Model and frame the product before surfacing.' },
      { title: 'Materials & light', description: 'Build surfaces and lighting that read correctly.' },
      { title: 'Review renders', description: 'Refine against the agreed shot list.' },
      { title: 'Final delivery', description: 'Deliver final renders at agreed resolutions.' }
    ],
    relatedProjects: ['noire', 'aurix-headphones'],
    cover: 'assets/projects/noire.jpg',
    coverAlt: 'Noiré fragrance bottle 3D render with dark lighting',
    priceLabel: 'Request a quote',
    ctaLabel: 'Start a project',
    ctaHref: '/#contact',
    seoTitle: '3D Product Visualization — Kuldeep Malviya',
    seoDescription: '3D product visualisation, materials, lighting and render direction by Kuldeep Malviya.',
    status: 'published',
    order: 4,
    archived: false
  },
  {
    slug: 'creative-direction',
    name: 'Creative Direction',
    summary: 'One clear visual language across campaign, brand and product.',
    description:
      'Creative direction that keeps a project coherent: concept, references, art direction and a defined visual language that everyone can work from.',
    included: ['Concept development', 'Campaign direction', 'Visual language', 'Creative strategy'],
    idealFor: 'Projects with multiple contributors that need a single, consistent visual point of view.',
    process: [
      { title: 'Immersion', description: 'Understand the brand, market and ambition.' },
      { title: 'Concept', description: 'Define the central idea and references.' },
      { title: 'Direction', description: 'Set art direction for imagery, type and layout.' },
      { title: 'Guiding production', description: 'Direct execution so the idea survives delivery.' },
      { title: 'Final review', description: 'Check consistency across every output.' }
    ],
    relatedProjects: ['vlare-fashion', 'creative-journal'],
    cover: 'assets/projects/vlare.jpg',
    coverAlt: 'VLAIRE Fashion editorial art direction',
    priceLabel: 'Request a quote',
    ctaLabel: 'Start a project',
    ctaHref: '/#contact',
    seoTitle: 'Creative Direction — Kuldeep Malviya',
    seoDescription: 'Creative direction, art direction and visual language for brands and campaigns.',
    status: 'published',
    order: 5,
    archived: false
  },
  {
    slug: 'graphic-design',
    name: 'Graphic & Editorial Design',
    summary: 'Layout systems, publications and day-to-day brand design.',
    description:
      'Graphic design for publications, editorial layouts and brand collateral. The focus is a reusable layout system rather than one-off artwork, so future issues and pages stay consistent.',
    included: ['Editorial layout systems', 'Publication templates', 'Brand collateral', 'Typography direction'],
    idealFor: 'Publishers, studios and brands producing recurring editorial or marketing material.',
    process: [
      { title: 'Content audit', description: 'Review the content types the system must support.' },
      { title: 'Grid & type', description: 'Set the grid, hierarchy and typographic rules.' },
      { title: 'Templates', description: 'Build the pages and article patterns.' },
      { title: 'Production check', description: 'Test with real content and edge cases.' },
      { title: 'Handover', description: 'Deliver templates and usage notes.' }
    ],
    relatedProjects: ['creative-journal', 'vlare-fashion'],
    cover: 'assets/projects/creative-journal.jpg',
    coverAlt: 'The Creative Journal editorial layout system',
    priceLabel: 'Request a quote',
    ctaLabel: 'Start a project',
    ctaHref: '/#contact',
    seoTitle: 'Graphic & Editorial Design — Kuldeep Malviya',
    seoDescription: 'Editorial layout systems, publication design and graphic design by Kuldeep Malviya.',
    status: 'published',
    order: 6,
    archived: false
  }
];

function defaultContent() {
  return {
    hero: {
      eyebrow: 'Graphic Design Portfolio',
      titleLead: 'Distinctive',
      titleBreak: 'by',
      titleAccent: 'design.',
      lede: 'Graphic designer creating identities, digital experiences and visual systems.',
      primaryCtaLabel: 'Explore selected work',
      primaryCtaHref: '/#work',
      secondaryCtaLabel: "Let's talk",
      secondaryCtaHref: '/#contact',
      stats: [
        { value: '45+', label: 'Projects delivered' },
        { value: '5+', label: 'Years of experience' },
        { value: '900+', label: 'Design assets created' }
      ]
    },
    about: {
      label: 'About',
      titleLead: 'The person behind the',
      titleAccent: 'pixels.',
      lede:
        "I'm Kuldeep Malviya, a graphic designer who helps brands look sharp, feel consistent and communicate clearly. I work across brand identity, web design and 3D visualization, turning ideas into thoughtful, high-quality visual experiences.",
      quote:
        'Good design is quiet until it matters. I build systems that stay coherent long after the launch.',
      signature: 'Kuldeep Malviya',
      note: 'Graphic designer · Indore',
      based: 'Indore, India',
      focus: 'Identity & digital',
      status: 'Available'
    },
    contact: {
      heading: 'Have a project in mind?',
      copy: "Tell me what you're building, where it needs to go and what would make it successful.",
      email: 'kuldeep@malviya.design',
      location: 'Indore, India',
      responseTime: 'Within 48 hours',
      availability: 'Available for new projects',
      note: 'Currently booking Q1 — 2026'
    },
    footer: {
      description: 'Independent graphic designer creating identities, digital experiences and visual systems.',
      location: 'Indore, India · 22.7196° N',
      statementLead: 'Distinctive by',
      statementAccent: 'design.',
      statementNote: 'Graphic design · Digital · 3D',
      copyright: '© 2026 Kuldeep Malviya — All rights reserved',
      builtNote: 'Designed & built in Indore, IN'
    },
    availabilityBadge: 'Available for projects'
  };
}

function defaultNav() {
  return {
    primary: [
      { label: 'Work', href: '/#work' },
      { label: 'Services', href: '/#services' },
      { label: 'Client reviews', href: '/reviews' },
      { label: 'About', href: '/#about' },
      { label: 'Contact', href: '/#contact' }
    ],
    footer: [
      {
        title: 'Navigate',
        links: [
          { label: 'Work', href: '/#work' },
          { label: 'Capabilities', href: '/#capabilities' },
          { label: 'Services', href: '/#services' },
          { label: 'Client reviews', href: '/reviews' },
          { label: 'About', href: '/#about' },
          { label: 'Contact', href: '/#contact' }
        ]
      },
      {
        title: 'Elsewhere',
        links: [
          { label: 'Instagram', href: 'https://www.instagram.com/' },
          { label: 'Behance', href: 'https://www.behance.net/' },
          { label: 'LinkedIn', href: 'https://www.linkedin.com/' }
        ]
      },
      {
        title: 'Contact',
        links: [
          { label: 'kuldeep@malviya.design', href: 'mailto:kuldeep@malviya.design' },
          { label: 'Start a project', href: '/#contact' },
          { label: 'Résumé / PDF', href: '/assets/resume.pdf' }
        ]
      }
    ]
  };
}

function defaultSeo() {
  return {
    title: 'Kuldeep Malviya — Graphic Designer · Distinctive by design.',
    description:
      'Kuldeep Malviya is an independent graphic designer creating identities, digital experiences and visual systems. Distinctive by design.',
    shareImage: 'assets/projects/noire.jpg',
    canonicalBase: '',
    noindex: false
  };
}

function createDefaultDb() {
  return {
    version: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    admins: [],
    sessions: [],
    mfaChallenges: [],
    attempts: [],
    projects: PROJECT_SEED.map((p) => ({
      id: uid('prj_'),
      ...p,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })),
    services: SERVICE_SEED.map((s) => ({
      id: uid('srv_'),
      ...s,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })),
    reviews: [],
    comments: [],
    media: [],
    content: defaultContent(),
    nav: defaultNav(),
    seo: defaultSeo(),
    activity: [],
    settings: { siteUrl: '' }
  };
}

/** Migrations run in order; each upgrades to its `to` version. */
const MIGRATIONS = [
  {
    to: 1,
    up(db) {
      db.admins = db.admins || [];
      db.sessions = db.sessions || [];
      db.mfaChallenges = db.mfaChallenges || [];
      db.attempts = db.attempts || [];
      db.projects = db.projects || PROJECT_SEED;
      db.services = db.services || SERVICE_SEED;
      db.reviews = db.reviews || [];
      db.comments = db.comments || [];
      db.media = db.media || [];
      db.content = db.content || defaultContent();
      db.nav = db.nav || defaultNav();
      db.seo = db.seo || defaultSeo();
      db.activity = db.activity || [];
      db.settings = db.settings || { siteUrl: '' };
      return db;
    }
  }
];

let cache = null;
let writeChain = Promise.resolve();
let requestChain = Promise.resolve();
let remoteStore = null;

function usesFirestore() { return process.env.DATA_STORE === 'firestore'; }
function usesRemoteStore() { return usesFirestore(); }

async function initialize() {
  const mode = process.env.DATA_STORE || 'json';
  if (!['json', 'firestore'].includes(mode)) throw new Error('DATA_STORE must be json or firestore.');
  if (mode === 'json') return load();
  remoteStore = require('./firestore-store').connect();
  cache = await remoteStore.load();
  return cache;
}

// Serialize stateful requests because the existing CMS works with an in-memory
// snapshot. A revision check refreshes it when another server has committed.
function withRequest(task) {
  const run = requestChain.then(async () => {
    if (!remoteStore) throw new Error('Remote datastore is not initialized.');
    await writeChain.catch(() => {});
    if (!cache || await remoteStore.refreshNeeded()) cache = await remoteStore.load();
    try { return await task(); }
    finally { await writeChain; }
  });
  requestChain = run.catch(() => {});
  return run;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  if (cache) return cache;
  if (usesRemoteStore()) throw new Error('Initialize the remote datastore before reading it.');
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    cache = createDefaultDb();
    persistSync();
    return cache;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    throw new Error(`data/db.json is not valid JSON: ${err.message}`);
  }
  let db = raw;
  const startVersion = db.version || 0;
  for (const migration of MIGRATIONS) {
    if ((db.version || 0) < migration.to) {
      db = migration.up(db);
      db.version = migration.to;
    }
  }
  if ((db.version || 0) < SCHEMA_VERSION) db.version = SCHEMA_VERSION;
  if (startVersion !== db.version) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
  cache = db;
  return cache;
}

function persistSync() {
  ensureDir();
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/** Atomic async save; calls are serialised so writes never interleave. */
function save() {
  if (usesRemoteStore()) {
    if (!remoteStore || !cache) return Promise.reject(new Error('Remote datastore is not initialized.'));
    const snapshot = JSON.parse(JSON.stringify(cache));
    const commit = () => remoteStore.save(snapshot);
    writeChain = writeChain.then(commit, commit);
    return writeChain;
  }
  writeChain = writeChain.then(
    () =>
      new Promise((resolve, reject) => {
        ensureDir();
        const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFile(tmp, JSON.stringify(cache, null, 2), (err) => {
          if (err) return reject(err);
          fs.rename(tmp, DB_FILE, (renameErr) => (renameErr ? reject(renameErr) : resolve()));
        });
      })
  );
  return writeChain;
}

function logActivity(actor, action, entity, entityId, meta = '') {
  const db = load();
  db.activity.unshift({
    id: uid('log_'),
    at: new Date().toISOString(),
    actor: actor || 'system',
    action,
    entity,
    entityId: entityId || '',
    meta: typeof meta === 'string' ? meta : JSON.stringify(meta)
  });
  db.activity = db.activity.slice(0, 300);
}

module.exports = {
  ROOT,
  DATA_DIR,
  DB_FILE,
  SCHEMA_VERSION,
  load,
  save,
  initialize,
  usesFirestore,
  usesRemoteStore,
  withRequest,
  uid,
  logActivity,
  createDefaultDb,
  defaultContent,
  defaultNav,
  defaultSeo,
  PROJECT_SEED,
  SERVICE_SEED
};

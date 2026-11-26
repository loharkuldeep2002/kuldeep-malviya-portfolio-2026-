'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const input = path.join(root, 'data', 'db.json');
const output = path.join(root, 'data', 'firestore-content-seed.json');
const db = JSON.parse(fs.readFileSync(input, 'utf8'));
const projectFields = ['id','slug','title','subtitle','client','category','year','shortDescription','challenge','approach','deliverables','outcome','cover','coverAlt','gallery','services','tags','facts','seoTitle','seoDescription','status','archived','order','createdAt','updatedAt'];
const serviceFields = ['id','slug','name','summary','description','included','idealFor','process','relatedProjects','cover','coverAlt','priceLabel','ctaLabel','ctaHref','seoTitle','seoDescription','status','archived','order','createdAt','updatedAt'];
const pick = (record, fields) => Object.fromEntries(fields.filter(key => record[key] !== undefined).map(key => [key, record[key]]));
const documents = [];
for (const [collection, fields] of [['projects', projectFields], ['services', serviceFields]]) {
  for (const record of db[collection] || []) {
    if (record.status !== 'published' || record.archived) continue;
    if (typeof record.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(record.id)) throw new Error('Invalid content record ID');
    documents.push({ path: `${collection}/${record.id}`, data: pick(record, fields) });
  }
}
for (const section of ['hero','about','contact','footer']) {
  if (db.content?.[section]) documents.push({ path: `site_content/${section}`, data: db.content[section] });
}
documents.push({ path: 'site_content/branding', data: { availabilityBadge: db.content?.availabilityBadge || '' } });
if (db.nav) documents.push({ path: 'site_settings/navigation', data: db.nav });
if (db.seo) documents.push({ path: 'site_settings/seo', data: db.seo });
const manifest = { projectId: 'kuldeep-malviya-portfolio', schemaVersion: 1, generatedAt: new Date().toISOString(), documents };
fs.writeFileSync(output, JSON.stringify(manifest, null, 2));
console.log(`Prepared ${documents.length} public content documents in data/firestore-content-seed.json. Nothing uploaded.`);

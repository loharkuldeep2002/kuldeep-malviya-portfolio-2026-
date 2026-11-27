'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyticsSummary, sanitizeBackup } = require('./api');

test('analytics summary aggregates daily counts and ranks project views', () => {
  const today = new Date().toISOString().slice(0, 10);
  const result = analyticsSummary({ analytics: {
    [today]: { pageViews: 13, projectViews: 4, contactIntents: 2, ctaClicks: 5, projects: { alpha: 3, beta: 1 } }
  } }, [{ slug: 'alpha', title: 'Alpha project' }, { slug: 'beta', title: 'Beta project' }]);

  assert.deepEqual(result, {
    pageViews: 13,
    projectViews: 4,
    contactIntents: 2,
    ctaClicks: 5,
    topProjects: [{ slug: 'alpha', title: 'Alpha project', views: 3 }, { slug: 'beta', title: 'Beta project', views: 1 }]
  });
});

test('backup sanitizer accepts a valid empty content backup without restoring security records', () => {
  const clean = sanitizeBackup({
    format: 'km-portfolio-content-backup', version: 1,
    projects: [], services: [], reviews: [], comments: [], media: [], content: {}, nav: {}, seo: {}
  });

  assert.deepEqual(clean.projects, []);
  assert.deepEqual(clean.services, []);
  assert.deepEqual(clean.reviews, []);
  assert.deepEqual(clean.comments, []);
  assert.deepEqual(clean.media, []);
  assert.ok(clean.content.hero);
});

test('backup sanitizer rejects duplicate review and comment IDs', () => {
  const base = {
    format: 'km-portfolio-content-backup', version: 1,
    projects: [], services: [], reviews: [], comments: [], media: [], content: {}, nav: {}, seo: {}
  };
  assert.throws(() => sanitizeBackup({ ...base, reviews: [{ id: 'dup' }, { id: 'dup' }] }), { status: 422 });
  assert.throws(() => sanitizeBackup({ ...base, comments: [{ id: 'dup' }, { id: 'dup' }] }), { status: 422 });
});

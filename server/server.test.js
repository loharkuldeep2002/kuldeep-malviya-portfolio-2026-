'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canServePublicStaticFallback } = require('../server');

test('static fallback allows public GET and HEAD routes only', () => {
  assert.equal(canServePublicStaticFallback({ method: 'GET', url: '/' }), true);
  assert.equal(canServePublicStaticFallback({ method: 'GET', url: '/project/example' }), true);
  assert.equal(canServePublicStaticFallback({ method: 'HEAD', url: '/assets/style.css' }), true);
  assert.equal(canServePublicStaticFallback({ method: 'POST', url: '/' }), false);
});

test('static fallback never bypasses API, admin, robots or sitemap data checks', () => {
  for (const url of ['/api/site', '/api/analytics/event', '/admin/login', '/admin/dashboard', '/robots.txt', '/sitemap.xml']) {
    assert.equal(canServePublicStaticFallback({ method: 'GET', url }), false, url);
  }
});

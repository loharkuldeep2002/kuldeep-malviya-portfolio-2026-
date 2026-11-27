'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveProject, PRODUCTION_PROJECT_ID } = require('./migration-target');

test('migration target defaults remain restricted to production project ID', () => {
  assert.equal(resolveProject({ environmentProject: PRODUCTION_PROJECT_ID }), PRODUCTION_PROJECT_ID);
  assert.throws(() => resolveProject({ explicitProject: 'kuldeep-portfolio-stage-2026' }), /require --staging/);
  assert.throws(() => resolveProject({ explicitProject: 'bad project', staging: true }), /valid Firebase project ID/);
});

test('staging migration requires an explicit non-production Firebase project ID', () => {
  assert.equal(resolveProject({ explicitProject: 'kuldeep-portfolio-stg-2026', staging: true }), 'kuldeep-portfolio-stg-2026');
  assert.throws(() => resolveProject({ environmentProject: 'kuldeep-portfolio-stg-2026', staging: true }), /explicit --project/);
  assert.throws(() => resolveProject({ explicitProject: PRODUCTION_PROJECT_ID, staging: true }), /cannot target the production/);
});

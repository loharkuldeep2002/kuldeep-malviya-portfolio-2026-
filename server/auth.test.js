'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const auth = require('./auth');

function request(headers = {}) {
  return { headers: { host: 'portfolio.example', ...headers } };
}

test('same-origin guard accepts the matching Origin', () => {
  assert.equal(auth.isSameOrigin(request({ origin: 'https://portfolio.example' })), true);
});

test('same-origin guard accepts a matching Referer when Origin is absent', () => {
  assert.equal(auth.isSameOrigin(request({ referer: 'https://portfolio.example/admin/dashboard' })), true);
});

test('same-origin guard rejects cross-site and malformed origins', () => {
  assert.equal(auth.isSameOrigin(request({ origin: 'https://attacker.example' })), false);
  assert.equal(auth.isSameOrigin(request({ origin: 'https://portfolio.example.attacker.example' })), false);
  assert.equal(auth.isSameOrigin(request({ origin: 'null' })), false);
});

test('same-origin guard fails closed when browser origin metadata is missing', () => {
  assert.equal(auth.isSameOrigin(request()), false);
  assert.equal(auth.isSameOrigin({ headers: { origin: 'https://portfolio.example' } }), false);
});

test('same-origin guard rejects credentials and paths in Origin headers', () => {
  assert.equal(auth.isSameOrigin(request({ origin: 'https://user@portfolio.example' })), false);
  assert.equal(auth.isSameOrigin(request({ origin: 'https://portfolio.example/other' })), false);
});

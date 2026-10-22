'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

test('greet says hello', () => {
  assert.equal(core.greet('  Ann '), 'Hello, Ann!');
});

test('greet needs a name', () => {
  assert.throws(() => core.greet('   '), /Type your name/);
});

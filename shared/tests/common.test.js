'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const OT = require('../common.js');

test('formatBytes', () => {
  assert.equal(OT.formatBytes(0), '0 B');
  assert.equal(OT.formatBytes(512), '512 B');
  assert.equal(OT.formatBytes(1536), '1.5 KB');
  assert.equal(OT.formatBytes(10 * 1024 * 1024), '10 MB');
  assert.equal(OT.formatBytes(-5), '0 B');
  assert.equal(OT.formatBytes(NaN), '0 B');
});

test('escapeHtml', () => {
  assert.equal(OT.escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('baseName / extension', () => {
  assert.equal(OT.baseName('report.final.pdf'), 'report.final');
  assert.equal(OT.baseName('noext'), 'noext');
  assert.equal(OT.baseName('.hidden'), '.hidden');
  assert.equal(OT.extension('A.PDF'), 'pdf');
  assert.equal(OT.extension('noext'), '');
});

test('safeFileName removes illegal characters', () => {
  assert.equal(OT.safeFileName('a/b:c*d?.pdf'), 'a_b_c_d_.pdf');
  assert.equal(OT.safeFileName('   '), 'file');
  assert.equal(OT.safeFileName('...', 'x'), 'x');
  assert.equal(OT.safeFileName('..hidden'), 'hidden');
});

test('clamp', () => {
  assert.equal(OT.clamp(5, 0, 3), 3);
  assert.equal(OT.clamp(-1, 0, 3), 0);
  assert.equal(OT.clamp(2, 0, 3), 2);
});

test('debounce only fires once after silence', async () => {
  let calls = 0;
  const fn = OT.debounce(() => calls++, 20);
  fn();
  fn();
  fn();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(calls, 1);
});

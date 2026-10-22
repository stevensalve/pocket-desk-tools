'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const pw = require('../js/core.js');

// Deterministic rng: a simple LCG so tests are reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return (n) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return Math.floor((s / 4294967296) * n);
  };
}
const real = pw.makeCryptoRng((buf) => nodeCrypto.getRandomValues(buf));

test('makeCryptoRng: range checks and rejection of biased values', () => {
  assert.throws(() => real(0), RangeError);
  assert.throws(() => real(1.5), RangeError);
  assert.equal(real(1), 0);
  for (let i = 0; i < 200; i++) assert.ok(real(6) >= 0 && real(6) < 6);
  // n = 3 -> limit is 4294967295; a draw of 4294967295 must be rejected, then 7 used (7 % 3 = 1).
  const draws = [4294967295, 7];
  const r = pw.makeCryptoRng((buf) => (buf[0] = draws.shift()));
  assert.equal(r(3), 1);
  assert.equal(draws.length, 0);
});

test('makeCryptoRng is roughly uniform', () => {
  const counts = new Array(10).fill(0);
  for (let i = 0; i < 20000; i++) counts[real(10)]++;
  counts.forEach((c) => assert.ok(c > 1700 && c < 2300, 'bucket ' + c));
});

test('password: length, groups guaranteed, determinism', () => {
  const p = pw.password({ length: 20, symbols: true }, seeded(1));
  assert.equal(p.length, 20);
  assert.match(p, /[a-z]/);
  assert.match(p, /[A-Z]/);
  assert.match(p, /[0-9]/);
  assert.match(p, /[^A-Za-z0-9]/);
  assert.equal(pw.password({ length: 12 }, seeded(5)), pw.password({ length: 12 }, seeded(5)));
  assert.notEqual(pw.password({ length: 12 }, seeded(5)), pw.password({ length: 12 }, seeded(6)));
});

test('password: every group is present even at minimum length', () => {
  for (let seed = 1; seed < 50; seed++) {
    const p = pw.password({ length: 4, symbols: true }, seeded(seed));
    assert.match(p, /[a-z]/);
    assert.match(p, /[A-Z]/);
    assert.match(p, /\d/);
    assert.match(p, /[^A-Za-z0-9]/);
  }
});

test('password: ambiguous characters are excluded on request', () => {
  for (let seed = 1; seed < 40; seed++) {
    const p = pw.password({ length: 64, symbols: true, noAmbiguous: true }, seeded(seed));
    assert.doesNotMatch(p, /[Il1O0o|`'"]/);
  }
});

test('password: custom symbol set replaces the default', () => {
  const p = pw.password({ length: 40, lower: false, upper: false, digits: false, symbols: true, custom: '#$' }, seeded(2));
  assert.match(p, /^[#$]{40}$/);
});

test('password: validation', () => {
  assert.throws(() => pw.password({ lower: false, upper: false, digits: false }, seeded(1)), /at least one kind/);
  assert.throws(() => pw.password({ length: 2, symbols: true }, seeded(1)), /at least 4/);
  assert.throws(() => pw.password({ length: 1000 }, seeded(1)), /at most 256/);
});

test('alphabetSize and entropy', () => {
  assert.equal(pw.alphabetSize({ lower: true, upper: true, digits: true }), 62);
  assert.equal(pw.alphabetSize({ lower: true, upper: false, digits: false }), 26);
  assert.equal(pw.alphabetSize({ lower: false, upper: false, digits: true, noAmbiguous: true }), 8);
  assert.ok(Math.abs(pw.entropyBits(62, 16) - 95.27) < 0.01);
  assert.equal(pw.entropyBits(1, 10), 0);
});

test('strength labels', () => {
  assert.equal(pw.strength(20).label, 'Weak');
  assert.equal(pw.strength(45).label, 'Fair');
  assert.equal(pw.strength(70).label, 'Good');
  assert.equal(pw.strength(95).label, 'Strong');
  assert.equal(pw.strength(130).label, 'Excellent');
});

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

test('passphrase: word count, separator, capitalise, entropy', () => {
  const r = pw.passphrase(WORDS, { words: 4, separator: ' ', capitalise: true }, seeded(3));
  const parts = r.text.split(' ');
  assert.equal(parts.length, 4);
  parts.forEach((w) => assert.ok(WORDS.map((x) => x[0].toUpperCase() + x.slice(1)).includes(w)));
  assert.equal(r.bits, 12);
  const n = pw.passphrase(WORDS, { words: 3, number: true }, seeded(4));
  assert.match(n.text, /\d/);
  assert.ok(n.bits > 9);
});

test('passphrase: validation', () => {
  assert.throws(() => pw.passphrase([], {}, seeded(1)), /word list/);
  assert.throws(() => pw.passphrase(WORDS, { words: 1 }, seeded(1)), /between 2 and 16/);
});

test('the bundled wordlist has 1296 unique lowercase words', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../js/wordlist.js'), 'utf8');
  const words = new Function('self', src + '; return self.PwWords;')({});
  assert.equal(words.length, 1296);
  assert.equal(new Set(words).size, 1296);
  words.forEach((w) => assert.match(w, /^[a-z-]+$/));
  assert.ok(Math.abs(Math.log2(1296) - 10.34) < 0.01);
});

test('pin, hexToken, urlToken, shortId', () => {
  assert.match(pw.pin(6, seeded(1)), /^\d{6}$/);
  assert.throws(() => pw.pin(3, seeded(1)));
  assert.match(pw.hexToken(16, seeded(1)), /^[0-9a-f]{32}$/);
  assert.match(pw.urlToken(16, seeded(1)), /^[A-Za-z0-9_-]{22}$/);
  assert.throws(() => pw.hexToken(0, seeded(1)));
  assert.match(pw.shortId(2, 4, seeded(1)), /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.throws(() => pw.shortId(0, 4, seeded(1)));
});

test('uuidV4 has correct version and variant bits', () => {
  for (let i = 0; i < 100; i++) assert.match(pw.uuidV4(real), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(new Set(Array.from({ length: 500 }, () => pw.uuidV4(real))).size, 500);
});

test('uuidV7 embeds the timestamp and sorts by time', () => {
  const t = Date.parse('2026-10-22T12:00:00Z');
  const a = pw.uuidV7(t, real);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const hexTs = a.replace(/-/g, '').slice(0, 12);
  assert.equal(parseInt(hexTs, 16), t);
  assert.ok(pw.uuidV7(t + 5000, real) > a);
  assert.throws(() => pw.uuidV7(-1, real));
});

test('crackTime wording', () => {
  assert.equal(pw.crackTime(20), 'instantly');
  assert.match(pw.crackTime(60), /year|day|hour/);
  assert.equal(pw.crackTime(200), 'more than a billion years');
});

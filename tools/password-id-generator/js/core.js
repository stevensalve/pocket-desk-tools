/**
 * Password & ID Generator - core logic (pure; the random source is injected).
 *
 * `rng(n)` must return an integer uniformly in [0, n). The browser UI builds it from
 * crypto.getRandomValues using rejection sampling (see `makeCryptoRng`), which avoids
 * the small bias you get from `value % n`. Tests pass a deterministic rng instead.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PwCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SETS = {
    lower: 'abcdefghijklmnopqrstuvwxyz',
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.?/',
  };
  const AMBIGUOUS = 'Il1O0o|`\'"';

  /** Uniform integer in [0, n) from a function that fills a Uint32Array with random values. */
  function makeCryptoRng(getRandomValues) {
    return function rng(n) {
      if (!Number.isInteger(n) || n < 1 || n > 4294967296) throw new RangeError('rng range must be 1..2^32');
      const limit = Math.floor(4294967296 / n) * n; // values >= limit would be biased, so redraw
      const buf = new Uint32Array(1);
      for (;;) {
        getRandomValues(buf);
        if (buf[0] < limit) return buf[0] % n;
      }
    };
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rng(i + 1);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function buildAlphabet(opts) {
    const groups = [];
    ['lower', 'upper', 'digits', 'symbols'].forEach((k) => {
      if (!opts[k]) return;
      let chars = SETS[k];
      if (opts.noAmbiguous)
        chars = chars
          .split('')
          .filter((c) => AMBIGUOUS.indexOf(c) === -1)
          .join('');
      if (chars) groups.push(chars);
    });
    return groups;
  }

  /**
   * Random password. opts: { length, lower, upper, digits, symbols, noAmbiguous, custom }.
   * Guarantees at least one character from every chosen group, then shuffles.
   * `custom` (a string) replaces the symbol set when provided.
   */
  function password(opts, rng) {
    const o = Object.assign({ length: 16, lower: true, upper: true, digits: true, symbols: false, noAmbiguous: false }, opts);
    const groups =
      o.custom && o.symbols ? buildAlphabet(Object.assign({}, o, { symbols: false })).concat([dedupe(o.custom)]) : buildAlphabet(o);
    if (!groups.length) throw new Error('Choose at least one kind of character.');
    if (!Number.isInteger(o.length) || o.length < groups.length)
      throw new Error('Length must be at least ' + groups.length + ' for these options.');
    if (o.length > 256) throw new Error('Length can be at most 256.');
    const all = groups.join('');
    const out = groups.map((g) => g[rng(g.length)]);
    while (out.length < o.length) out.push(all[rng(all.length)]);
    return shuffle(out, rng).join('');
  }
  const dedupe = (s) => Array.from(new Set(String(s).split(''))).join('');

  /** Alphabet size actually used by a password config (for entropy). */
  function alphabetSize(opts) {
    const o = Object.assign({ lower: true, upper: true, digits: true, symbols: false }, opts);
    const groups =
      o.custom && o.symbols ? buildAlphabet(Object.assign({}, o, { symbols: false })).concat([dedupe(o.custom)]) : buildAlphabet(o);
    return new Set(groups.join('').split('')).size;
  }

  /** Bits of entropy for `length` independent picks from `size` symbols. */
  function entropyBits(size, length) {
    return size > 1 && length > 0 ? Math.log2(size) * length : 0;
  }

  /** Plain-language label for a number of bits. */
  function strength(bits) {
    if (bits < 40) return { label: 'Weak', level: 0 };
    if (bits < 60) return { label: 'Fair', level: 1 };
    if (bits < 80) return { label: 'Good', level: 2 };
    if (bits < 110) return { label: 'Strong', level: 3 };
    return { label: 'Excellent', level: 4 };
  }

  /**
   * Passphrase of random words. opts: { words (3-12), separator, capitalise, number }.
   * Returns { text, bits }. Each word adds log2(list size) bits (about 10.3 for the 1296-word list).
   */
  function passphrase(words, opts, rng) {
    const o = Object.assign({ words: 5, separator: '-', capitalise: false, number: false }, opts);
    if (!Array.isArray(words) || words.length < 2) throw new Error('A word list is required.');
    if (!Number.isInteger(o.words) || o.words < 2 || o.words > 16) throw new Error('Use between 2 and 16 words.');
    const picked = [];
    for (let i = 0; i < o.words; i++) {
      let w = words[rng(words.length)];
      if (o.capitalise) w = w.charAt(0).toUpperCase() + w.slice(1);
      picked.push(w);
    }
    let bits = Math.log2(words.length) * o.words;
    if (o.number) {
      const at = rng(picked.length);
      picked[at] += String(rng(10));
      bits += Math.log2(picked.length * 10);
    }
    return { text: picked.join(o.separator), bits: bits };
  }

  /** Numeric PIN (digits only). */
  function pin(length, rng) {
    if (!Number.isInteger(length) || length < 4 || length > 32) throw new Error('PIN length must be 4 to 32 digits.');
    let s = '';
    for (let i = 0; i < length; i++) s += rng(10);
    return s;
  }

  const HEX = '0123456789abcdef';
  function hexToken(bytes, rng) {
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > 128) throw new Error('Token size must be 1 to 128 bytes.');
    let s = '';
    for (let i = 0; i < bytes * 2; i++) s += HEX[rng(16)];
    return s;
  }

  const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  /** URL-safe token with `bytes * 8` bits of entropy rounded up to whole characters. */
  function urlToken(bytes, rng) {
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > 128) throw new Error('Token size must be 1 to 128 bytes.');
    const chars = Math.ceil((bytes * 8) / 6);
    let s = '';
    for (let i = 0; i < chars; i++) s += B64URL[rng(64)];
    return s;
  }

  /** UUID version 4 (random). */
  function uuidV4(rng) {
    const b = [];
    for (let i = 0; i < 16; i++) b.push(rng(256));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    return fmtUuid(b);
  }

  /** UUID version 7 (time-ordered): 48-bit millisecond timestamp + random bits. `nowMs` is injected. */
  function uuidV7(nowMs, rng) {
    if (!Number.isInteger(nowMs) || nowMs < 0 || nowMs > 0xffffffffffff) throw new Error('Timestamp out of range.');
    const b = [];
    let t = nowMs;
    const ts = [];
    for (let i = 0; i < 6; i++) {
      ts.unshift(t % 256);
      t = Math.floor(t / 256);
    }
    b.push.apply(b, ts);
    for (let i = 0; i < 10; i++) b.push(rng(256));
    b[6] = (b[6] & 0x0f) | 0x70;
    b[8] = (b[8] & 0x3f) | 0x80;
    return fmtUuid(b);
  }

  function fmtUuid(b) {
    const h = b.map((x) => (x < 16 ? '0' : '') + x.toString(16)).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /** Short readable ID like "K7MQ-4XPD" (no 0/O/1/I). `groups` x `size` characters. */
  function shortId(groups, size, rng) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    if (!Number.isInteger(groups) || groups < 1 || groups > 8 || !Number.isInteger(size) || size < 2 || size > 8)
      throw new Error('Use 1-8 groups of 2-8 characters.');
    const parts = [];
    for (let g = 0; g < groups; g++) {
      let p = '';
      for (let i = 0; i < size; i++) p += A[rng(A.length)];
      parts.push(p);
    }
    return parts.join('-');
  }

  /** Rough time-to-crack text for an offline attacker making 10 billion guesses per second. */
  function crackTime(bits) {
    const seconds = Math.pow(2, bits - 1) / 1e10; // on average half the space is searched
    if (seconds < 1) return 'instantly';
    const units = [
      ['year', 31557600],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
      ['second', 1],
    ];
    if (seconds > 31557600 * 1e9) return 'more than a billion years';
    for (const [name, size] of units) {
      if (seconds >= size) {
        const n = Math.floor(seconds / size);
        return 'about ' + n.toLocaleString('en-US') + ' ' + name + (n === 1 ? '' : 's');
      }
    }
    return 'instantly';
  }

  return {
    SETS: SETS,
    makeCryptoRng: makeCryptoRng,
    password: password,
    alphabetSize: alphabetSize,
    entropyBits: entropyBits,
    strength: strength,
    passphrase: passphrase,
    pin: pin,
    hexToken: hexToken,
    urlToken: urlToken,
    uuidV4: uuidV4,
    uuidV7: uuidV7,
    shortId: shortId,
    crackTime: crackTime,
  };
});

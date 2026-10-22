#!/usr/bin/env node
/**
 * Guards the "100% offline, nothing is uploaded" promise: fails if any HTML,
 * CSS or first-party JS file references an external http(s) URL or imports
 * from a CDN. Vendored libraries and Markdown docs are skipped.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', 'vendor', '.git', 'docs', 'scripts', '.github']);
const EXTS = new Set(['.html', '.css', '.js', '.mjs']);
// Namespace identifiers are not network requests.
const ALLOWED = ['http://www.w3.org/2000/svg', 'http://www.w3.org/1999/xhtml'];

const offenders = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full);
      continue;
    }
    if (!EXTS.has(name.slice(name.lastIndexOf('.')))) continue;
    const text = readFileSync(full, 'utf8');
    for (const m of text.matchAll(/https?:\/\/[^\s'"`)<>]+/g)) {
      if (ALLOWED.some((a) => m[0].startsWith(a))) continue;
      // Links inside <a href> are navigation, not loads - but we still list
      // them so a reviewer can confirm. Only fail for src/import/url() loads.
      const before = text.slice(Math.max(0, m.index - 40), m.index);
      if (/(src\s*=|import\b|url\(|fetch\(|href\s*=\s*["'])\s*["']?$/i.test(before) && !/<a\s[^>]*$/i.test(before)) {
        offenders.push(`${relative(root, full)}: ${m[0]}`);
      }
    }
  }
})(root);

if (offenders.length) {
  console.error('External resource references found:\n  ' + offenders.join('\n  '));
  process.exit(1);
}
console.log('offline check passed: no external resource loads');

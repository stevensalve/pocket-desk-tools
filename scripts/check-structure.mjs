#!/usr/bin/env node
/**
 * Enforces the repository's conventions so every tool stays consistent:
 * required files, README sections, security/accessibility basics in each
 * index.html, working script/link references, and presence in the launcher.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (msg) => errors.push(msg);
const read = (p) => readFileSync(join(root, p), 'utf8');

const ROOT_FILES = [
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'CHANGELOG.md',
  '.editorconfig',
  '.gitignore',
  '.nojekyll',
  'index.html',
  'package.json',
  'eslint.config.mjs',
  '.github/workflows/ci.yml',
  '.github/workflows/pages.yml',
  'docs/ARCHITECTURE.md',
  'docs/HOSTING.md',
  'docs/ADDING-A-TOOL.md',
  'shared/theme.css',
  'shared/common.js',
];
const TOOL_FILES = [
  'index.html',
  'README.md',
  'LICENSE',
  'css/theme.css',
  'css/app.css',
  'js/common.js',
  'js/core.js',
  'js/app.js',
  'tests/core.test.js',
];
const README_SECTIONS = [
  '## What it does',
  '## Quick start',
  '## Features',
  '## How it works',
  '## Privacy and security',
  '## Limitations',
  '## Development',
  '## License',
];

ROOT_FILES.forEach((f) => existsSync(join(root, f)) || fail(`missing root file: ${f}`));

const launcher = existsSync(join(root, 'site/tools-data.js')) ? read('site/tools-data.js') : '';
const listed = new Set([...launcher.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]));

const tools = readdirSync(join(root, 'tools')).filter((d) => statSync(join(root, 'tools', d)).isDirectory());
if (tools.length === 0) fail('no tools found in tools/');

for (const tool of tools) {
  const base = `tools/${tool}`;
  TOOL_FILES.forEach((f) => existsSync(join(root, base, f)) || fail(`${base}: missing ${f}`));
  if (!listed.has(tool)) fail(`${base}: not listed in site/tools-data.js`);
  if (existsSync(join(root, base, 'vendor')) && !existsSync(join(root, base, 'vendor/README.md')))
    fail(`${base}: vendor/ has no README.md`);
  if (!existsSync(join(root, base, 'index.html'))) continue;

  const html = read(`${base}/index.html`);
  if (!/<html[^>]*\blang="/.test(html)) fail(`${base}/index.html: <html> needs a lang attribute`);
  if (!/<meta[^>]+name="viewport"/.test(html)) fail(`${base}/index.html: missing viewport meta`);
  if (!/<meta[^>]+name="description"/.test(html)) fail(`${base}/index.html: missing description meta`);
  if (!/<title>[^<]+<\/title>/.test(html)) fail(`${base}/index.html: missing <title>`);
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html);
  if (!csp) fail(`${base}/index.html: missing Content-Security-Policy meta`);
  else {
    if (/unsafe-eval|unsafe-inline/.test(csp[1])) fail(`${base}/index.html: CSP must not allow unsafe-eval/unsafe-inline`);
    if (!/default-src 'none'/.test(csp[1])) fail(`${base}/index.html: CSP should start from default-src 'none'`);
  }
  if (/\sstyle="/.test(html) || /<style[\s>]/.test(html))
    fail(`${base}/index.html: inline styles are blocked by the CSP - use css/app.css`);
  if (/\son[a-z]+="/.test(html)) fail(`${base}/index.html: inline event handlers are blocked by the CSP`);

  const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|\.\.\/)/.test(u));
  refs.forEach((u) => existsSync(join(root, base, u)) || fail(`${base}/index.html: referenced file not found: ${u}`));
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const order = ['js/common.js', 'js/core.js', 'js/app.js'].map((s) => scripts.indexOf(s));
  if (order.some((i) => i < 0) || order[0] > order[1] || order[1] > order[2])
    fail(`${base}/index.html: load js/common.js, js/core.js, js/app.js in that order`);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) fail(`${base}/index.html: duplicate ids: ${[...new Set(dup)].join(', ')}`);

  if (existsSync(join(root, base, 'README.md'))) {
    const readme = read(`${base}/README.md`);
    README_SECTIONS.forEach((h) => readme.includes(h) || fail(`${base}/README.md: missing section "${h}"`));
  }
}
listed.forEach((id) => tools.includes(id) || fail(`site/tools-data.js lists "${id}" but tools/${id} does not exist`));

// Every relative link in every Markdown file must point at something that exists.
(function checkMarkdownLinks(dir) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', '_site'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      checkMarkdownLinks(full);
      continue;
    }
    if (!name.endsWith('.md')) continue;
    const text = readFileSync(full, 'utf8').replace(/```[\s\S]*?```/g, ''); // ignore code samples
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1].split('#')[0];
      if (!target || /^(https?:|mailto:|<)/.test(target)) continue;
      if (!existsSync(join(dir, target))) fail(`${full.slice(root.length + 1)}: broken link -> ${m[1]}`);
    }
  }
})(root);

if (errors.length) {
  console.error('Structure check failed:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
console.log(`structure check passed (${tools.length} tools)`);

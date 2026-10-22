#!/usr/bin/env node
/**
 * Builds the deployable static website into ./_site (used by the GitHub Pages
 * workflow). Only what visitors need is copied - no tests, docs or scripts.
 * There is no bundling or transpiling: the site is the source, as-is.
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyDir } from './lib/copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const item of ['index.html', 'LICENSE', 'shared/theme.css', 'site']) {
  const from = join(root, item);
  const to = join(out, item);
  if (statSync(from).isDirectory()) copyDir(from, to);
  else {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}
// Skip every tests/ folder: visitors do not need them.
copyDir(join(root, 'tools'), join(out, 'tools'), (src) => !relative(root, src).split(sep).includes('tests'));
writeFileSync(join(out, '.nojekyll'), '');

if (!existsSync(join(out, 'tools', 'pdf-toolkit', 'index.html'))) throw new Error('build failed: tools were not copied');
console.log('site built in _site/');

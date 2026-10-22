#!/usr/bin/env node
/**
 * Every tool folder is self-contained (so it can be copied or split into its
 * own repository). Shared code therefore lives once in `shared/` and is copied
 * into each tool by this script.
 *
 *   npm run sync         copy shared files into every tool
 *   npm run check:sync   fail if any copy is out of date (used in CI)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const FILES = [
  { from: 'shared/theme.css', to: 'css/theme.css' },
  { from: 'shared/common.js', to: 'js/common.js' },
];

const banner = (src) => `/* AUTO-SYNCED from ${src} by scripts/sync-shared.mjs - edit the original, not this copy. */\n`;

const tools = readdirSync(join(root, 'tools'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let stale = 0;
for (const tool of tools) {
  for (const f of FILES) {
    const expected = banner(f.from) + readFileSync(join(root, f.from), 'utf8');
    const target = join(root, 'tools', tool, f.to);
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (current === expected) continue;
    if (check) {
      console.error(`out of date: tools/${tool}/${f.to}`);
      stale++;
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, expected);
      console.log(`synced tools/${tool}/${f.to}`);
    }
  }
}
if (stale) {
  console.error(`\n${stale} file(s) out of date. Run: npm run sync`);
  process.exit(1);
}
if (check) console.log('shared files are in sync');

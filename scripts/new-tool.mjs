#!/usr/bin/env node
/**
 * Scaffolds a new tool from templates/tool.
 *   npm run new-tool -- my-tool "My Tool" "One-line description."
 * Then: edit the files, add tests, run `npm run verify`.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { copyDir } from './lib/copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, title, tagline] = process.argv.slice(2);

if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || !title) {
  console.error('Usage: npm run new-tool -- <kebab-case-id> "<Title>" "<One-line description>"');
  process.exit(1);
}
const dest = join(root, 'tools', id);
if (existsSync(dest)) {
  console.error(`tools/${id} already exists.`);
  process.exit(1);
}

copyDir(join(root, 'templates/tool'), dest);
const camel = id.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
const globalName = camel.charAt(0).toUpperCase() + camel.slice(1) + 'Core';

(function fill(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      fill(full);
      continue;
    }
    const text = readFileSync(full, 'utf8')
      .replaceAll('{{id}}', id)
      .replaceAll('{{title}}', title)
      .replaceAll('{{tagline}}', tagline || 'Describe what this tool does.')
      .replaceAll('{{Global}}', globalName);
    writeFileSync(full, text);
  }
})(dest);

// Register the tool on the launcher page.
const dataFile = join(root, 'site/tools-data.js');
const entry = `  { id: '${id}', title: '${title.replace(/'/g, "\\'")}', tagline: '${(tagline || 'Describe what this tool does.').replace(/'/g, "\\'")}', replaces: 'something online', tags: ['new'] },\n`;
writeFileSync(dataFile, readFileSync(dataFile, 'utf8').replace(/\];\s*$/, entry + '];\n'));

spawnSync(process.execPath, [join(root, 'scripts/sync-shared.mjs')], { stdio: 'inherit' });
console.log(
  `\nCreated tools/${id}. Next:\n  1. Edit tools/${id}/js/core.js (logic) and js/app.js (UI)\n  2. Replace the placeholder text in tools/${id}/README.md\n  3. Update "replaces" and "tags" in site/tools-data.js\n  4. npm run verify`,
);

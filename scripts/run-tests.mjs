#!/usr/bin/env node
/** Finds every *.test.js under shared/ and tools/ and runs them with `node --test`. */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'vendor' || name === 'templates') continue; // templates hold {{placeholders}}
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.test.js')) files.push(full);
  }
})(root);

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);

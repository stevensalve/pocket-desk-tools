import js from '@eslint/js';
import globals from 'globals';

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Names that browser pages get from <script> tags: the bundled libraries plus
 * each tool's own namespaces. The tool namespaces are discovered from the
 * `root.Name = factory(...)` line in every tools/*/ js; /*.js, so adding a tool
 * needs no change here.
 */
const toolGlobals = [];
for (const tool of readdirSync(join(root, 'tools'))) {
  const jsDir = join(root, 'tools', tool, 'js');
  if (!existsSync(jsDir)) continue;
  for (const file of readdirSync(jsDir)) {
    const text = readFileSync(join(jsDir, file), 'utf8');
    for (const m of text.matchAll(/root\.([A-Za-z]\w*)\s*=\s*factory/g)) toolGlobals.push(m[1]);
  }
}
const pageGlobals = Object.fromEntries(
  ['OT', 'PDFLib', 'XLSX', 'pdfjsLib', 'JsBarcode', 'qrcode', ...toolGlobals].map((name) => [name, 'readonly']),
);

export default [
  { ignores: ['node_modules/', '_site/', '**/vendor/', 'templates/'] },
  js.configs.recommended,
  {
    // Browser code (classic scripts, not modules).
    files: ['tools/**/js/*.js', 'shared/common.js', 'site/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.commonjs, ...pageGlobals, TOOLS: 'readonly' },
    },
    rules: { 'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none' }], eqeqeq: ['error', 'always', { null: 'ignore' }] },
  },
  {
    // Unit tests (CommonJS on Node).
    files: ['**/tests/*.js', 'shared/tests/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    // Build and maintenance scripts (ES modules on Node).
    files: ['scripts/*.mjs', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } },
  },
];

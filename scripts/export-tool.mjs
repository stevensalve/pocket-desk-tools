#!/usr/bin/env node
/**
 * Exports one tool as a standalone repository folder (own package.json, CI,
 * GitHub Pages workflow and license), ready for `git init`.
 *   npm run export-tool -- pdf-toolkit ../pdf-toolkit-repo
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyDir } from './lib/copy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, destArg] = process.argv.slice(2);
if (!id || !destArg || !existsSync(join(root, 'tools', id))) {
  console.error('Usage: npm run export-tool -- <tool-id> <destination-folder>');
  process.exit(1);
}
const dest = resolve(destArg);
if (existsSync(dest) && existsSync(join(dest, 'index.html'))) {
  console.error('Destination already contains a project. Choose an empty folder.');
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
copyDir(join(root, 'tools', id), dest);
mkdirSync(join(dest, 'scripts'), { recursive: true });
['run-tests.mjs', 'serve.mjs'].forEach((f) => copyFileSync(join(root, 'scripts', f), join(dest, 'scripts', f)));
['.editorconfig', '.gitignore', '.gitattributes', '.prettierrc.json', '.nvmrc'].forEach((f) => copyFileSync(join(root, f), join(dest, f)));

// Test-time dependencies: the libraries the tool bundles in vendor/.
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const html = readFileSync(join(dest, 'index.html'), 'utf8') + readFileSync(join(dest, 'js/core.js'), 'utf8');
const wanted = { 'pdf-lib': /pdf-lib/, xlsx: /xlsx/, pdfjs: /pdfjs/ };
const devDependencies = {};
if (wanted['pdf-lib'].test(html)) devDependencies['pdf-lib'] = rootPkg.devDependencies['pdf-lib'];
if (wanted.xlsx.test(html)) devDependencies.xlsx = rootPkg.devDependencies.xlsx;

writeFileSync(
  join(dest, 'package.json'),
  JSON.stringify(
    {
      name: id,
      version: '1.0.0',
      private: true,
      license: 'MIT',
      scripts: { test: 'node scripts/run-tests.mjs', serve: 'node scripts/serve.mjs' },
      engines: { node: '>=22' },
      devDependencies,
    },
    null,
    2,
  ) + '\n',
);

mkdirSync(join(dest, '.github/workflows'), { recursive: true });
writeFileSync(
  join(dest, '.github/workflows/ci.yml'),
  `name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install
      - run: npm test
`,
);
writeFileSync(
  join(dest, '.github/workflows/pages.yml'),
  `name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - name: Assemble site (everything except tests and tooling)
        run: |
          mkdir _site
          cp -r index.html css js vendor _site/ 2>/dev/null || true
          touch _site/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v4
`,
);

// The "All tools" footer link points into the monorepo; remove it for standalone use.
const indexPath = join(dest, 'index.html');
writeFileSync(indexPath, readFileSync(indexPath, 'utf8').replace(/<a href="\.\.\/\.\.\/index\.html">All tools<\/a> - /, ''));

console.log(`Exported tools/${id} to ${dest}\nNext: cd there, npm install, npm test, git init.`);

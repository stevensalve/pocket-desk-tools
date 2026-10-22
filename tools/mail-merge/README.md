# Mail Merge

> One personalised letter or message for every row of a spreadsheet.

Part of [Pocket Desk Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Write a letter once, drop in a spreadsheet of names and details, and get a personalised PDF for every row. Use it for thank-you letters, certificates, invoices, welcome notes or e-mails. Nothing is uploaded, so it is safe for contact lists.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/mail-merge/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- mail-merge ../mail-merge-repo`.

## Features

- Reads Excel (`.xlsx`, `.xls`) and CSV/TSV; pick the sheet.
- Placeholders: `{{Column}}`, a fallback `{{Column|fallback}}`, plus `{{today}}` and `{{row}}`. Matching ignores case and extra spaces.
- Preview any record, with warnings for placeholders that match no column and for empty cells.
- Three outputs: one PDF (a page per person), a ZIP of separate PDFs with names built from columns, or an e-mail-ready CSV (To, Subject, Body) for a mail-merge in your mail program.
- Long lines wrap and long letters flow onto extra pages.

## How it works

`js/core.js` exports `MergeCore`: `buildRecords`, `fieldsIn`, `unknownFields`, `render`, `fileNames`, `emailCsv`, `makeZip`, `wrapLine`, `sanitizeForFont` and `buildPdf`. They are pure functions, so the whole merge can be tested without a browser. `app.js` only reads the file with SheetJS, shows the preview and triggers downloads.

| File                 | Purpose                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                                           |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                                           |
| `css/app.css`        | Styles for this tool only                                                                                            |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here                  |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                                            |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                                      |
| `vendor/`            | Bundled third-party code: SheetJS Community Edition 0.20.3 (Apache-2.0), pdf-lib 1.17.1 (MIT) and fflate 0.8.3 (MIT) |
| `tests/core.test.js` | Unit tests for the logic                                                                                             |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.

## Limitations

- PDF letters use the standard PDF fonts: English and Western European letters only. Other characters print as `?`.
- The tool creates PDFs and CSV files. It does not send e-mail or print envelopes.
- Limit of 2,000 records per run to keep the browser responsive.
- Plain text only: no bold, images or letterheads inside the letter body.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/mail-merge/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node:

```js
const core = require('./js/core.js');
const { records } = core.buildRecords([
  ['Name', 'City'],
  ['Ann', 'Pune'],
]);
core.render('Dear {{name}} from {{City|your town}}', records[0]).text; // 'Dear Ann from Pune'
```

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). SheetJS Community Edition 0.20.3 (Apache-2.0), pdf-lib (MIT), fflate (MIT).

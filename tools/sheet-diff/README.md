# Spreadsheet Diff

> See exactly what changed between two versions of a spreadsheet.

Part of [Pocket Desk Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Pick an old and a new file (Excel or CSV) and see which rows were added, removed or changed, with the old value crossed out beside the new one. Choose an ID column so rows are matched even when someone re-sorted the sheet, and download a cell-level change report.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/sheet-diff/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- sheet-diff ../sheet-diff-repo`.

## Features

- Reads `.xlsx`, `.xls`, `.csv`, `.tsv`; pick the sheet for each file.
- Matches columns by header name (ignoring case), so reordered columns are not changes; columns found on one side only are listed.
- ID-column matching (suggested automatically) or simple row-by-row comparison; duplicate IDs are paired in order.
- Ignore case and spaces, treat `1,000` and `1000.00` as equal, and optionally ignore small number differences.
- Highlighted result table, a "show only differences" switch, and a CSV change report that is safe to open in Excel.

## How it works

`js/core.js` exports `DiffCore`: `toRecords`, `sameValue`, `suggestKey`, `diffTables`, `toCsv` and `summaryText`. It never touches SheetJS; the UI converts a sheet to rows and core does the comparing, so every rule is covered by tests. Row numbers in the report are the real spreadsheet row numbers.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `vendor/`            | Bundled third-party code: SheetJS Community Edition 0.20.3 (Apache-2.0)                             |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.

## Limitations

- Compares one sheet against one sheet; formulas are compared by their displayed value.
- Up to 50,000 rows per file; the on-screen table shows the first 1,000 rows (the CSV has all differences).
- Cannot detect a moved row without an ID column, or a renamed column.
- Cell formatting (colours, fonts) is not compared.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/sheet-diff/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). SheetJS Community Edition 0.20.3 (Apache-2.0).

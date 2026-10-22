# Calendar & Planner Maker

> Printable monthly, yearly and weekly planner PDFs with your own holidays marked.

Part of [Pocket Desk Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Make a wall or desk calendar in seconds: one page per month, a whole year on one page, or weekly planner pages with ruled lines and a notes box. Add public holidays, birthdays or office closures, and choose paper size and week start.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/calendar-planner/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- calendar-planner ../calendar-planner-repo`.

## Features

- Layouts: monthly pages (1-12 months from any month), year on one page, weekly pages (up to 60).
- A4, US Letter or A3; landscape or portrait; weeks start Monday or Sunday; ISO week numbers.
- Your own dates: `2026-12-25 Christmas`, `01-01 New Year` (every year) and ranges like `2026-08-10..2026-08-14 Office closed`.
- Month and weekday names in several Latin-script languages (English, German, French, Spanish, Italian, Portuguese, Dutch).
- Live preview of the first month and a clear message for any line it could not read.

## How it works

`js/core.js` exports `CalCore`: `monthMatrix`, `isoWeek`, `parseHolidays`, `names`, `buildPdf` and `fileName`. Dates are calendar days in UTC, so a calendar looks identical everywhere. `buildPdf` receives `PDFLib` as an argument so Node tests can build real PDFs.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `vendor/`            | Bundled third-party code: pdf-lib 1.17.1 (MIT)                                                      |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.

## Limitations

- PDF fonts are Latin only; other scripts print as `?`.
- Does not know public holidays by itself; add the ones you need.
- Weekly pages show holiday names from your list only.
- One calendar per download; no edit-after-save (change settings and download again).

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/calendar-planner/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). pdf-lib (MIT).

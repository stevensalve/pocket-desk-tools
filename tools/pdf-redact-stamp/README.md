# PDF Redact & Stamp

> Permanently black out text in a PDF, add a watermark, and number the pages.

Part of [Pocket Desk Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Remove sensitive details (names, salaries, ID numbers) from a PDF before you share it. Unlike drawing a black rectangle, this tool **really removes** the covered content: redacted pages are re-created as pictures with the boxes painted in, so the hidden text cannot be copied or found. It can also add a diagonal watermark such as CONFIDENTIAL and page numbers.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/pdf-redact-stamp/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- pdf-redact-stamp ../pdf-redact-stamp-repo`.

## Features

- Draw redaction boxes with the mouse, or use **Find text** (with e-mail and phone-number shortcuts, regular expressions, match-case and whole-word options) to add boxes automatically.
- Mark a whole page, clear a page, or clear everything. Each box has an ✕ to remove it.
- Pages without boxes are copied unchanged, so text stays searchable on those pages.
- Optional watermark (text, size, opacity, angle, page range) and page numbers (position, format such as `Page 1 of 7`).
- Quality choice for redacted pages (smaller file or sharper image). Document information (title, author) is cleared.

## How it works

`js/core.js` exports `RedactCore`. Geometry works in **display points**: origin top-left, as you see the page, with rotation already applied; `displayToUser` converts to PDF coordinates. `findTextBoxes` turns pdf.js text runs into boxes, `redact` rasterises affected pages and drops their original content, and `stamp` adds watermark and numbers with pdf-lib. `app.js` renders pages with pdf.js and handles drawing.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `vendor/`            | Bundled third-party code: pdf-lib 1.17.1 (MIT) and pdf.js (`pdfjs-dist`) 3.11.174 (Apache-2.0)      |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.
- pdf.js is pinned to 3.11.174 and run with `isEvalSupported: false` and a Content-Security-Policy that has no `eval`. This avoids the code-execution issue (GHSA-wgrm-67xf-hhpq) that affects older pdf.js versions. See [SECURITY.md](../../SECURITY.md).

## Limitations

- Redacted pages become images: they are no longer searchable and the file grows. Use the quality setting to balance size and clarity.
- Scanned PDFs have no text to search; draw boxes by hand.
- Always open the saved file and check it before sharing; automatic text finding depends on how the PDF stores its text.
- Password-protected PDFs must be unlocked first.
- Redaction removes page content, not things like attachments inside the PDF; very unusual files may need a dedicated tool.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/pdf-redact-stamp/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). pdf-lib (MIT), pdf.js 3.11.174 (Apache-2.0).

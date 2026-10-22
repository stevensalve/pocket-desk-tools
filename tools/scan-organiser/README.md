# Scan Organiser

> Tidy phone photos of paperwork into a clean PDF or a ZIP of renamed images.

Part of [Pocket Desk Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Photograph documents on a phone, drop the photos here, and get a neat PDF: crop away the desk, straighten, brighten faded pages, make text pages crisp black-and-white, put the pages in order, and save. Nothing is uploaded.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/scan-organiser/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- scan-organiser ../scan-organiser-repo`.

## Features

- JPG, PNG and WebP input; up to 60 pages.
- Per page: rotate left/right, auto-crop, move earlier/later, remove, and choose a look (original, brighter and clearer, greyscale, black and white).
- Apply a look or auto-crop to every page at once.
- Save as a PDF (A4, US Letter or same size as the image, portrait or landscape chosen per page) or a ZIP of JPEGs named with a pattern such as `scan-{n}` or `Invoice {date} {n}`.
- Image size choice (1600, 2400 or 3200 px) to balance clarity and file size.

## How it works

`js/core.js` exports `ScanCore`. All image functions work on plain `{ data, width, height }` objects (the same shape as the browser's `ImageData`), so grayscale, auto-contrast, Otsu thresholding, auto-crop bounds, rotation and downscaling are unit-tested in Node. `buildPdf` and `makeZip` take pdf-lib and fflate as arguments.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `vendor/`            | Bundled third-party code: pdf-lib 1.17.1 (MIT) and fflate 0.8.3 (MIT)                               |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.

## Limitations

- Auto-crop looks for the page against the border colour; busy backgrounds can fool it, so check each preview.
- No perspective correction (straightening a tilted photo) and no OCR/searchable text.
- Very large photos are reduced to 3200 px on the longest side when loaded.
- Output pages are JPEG.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/scan-organiser/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). pdf-lib (MIT), fflate (MIT).

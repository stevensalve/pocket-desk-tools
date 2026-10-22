# Architecture

This document explains _why_ the project is built the way it is. Read it before making structural changes.

## Goals (in priority order)

1. **Privacy** - user files never leave the device.
2. **Offline and portable** - download a folder, double-click `index.html`, it works. No install, no server, no internet.
3. **Approachable** - a junior engineer can read any tool in an afternoon; a non-technical person can use it in a minute.
4. **Maintainable** - small, tested logic; boring technology; few dependencies.

## Decisions

### Plain HTML, CSS and JavaScript - no framework, no build step

A framework or bundler would mean `npm install` and a build before anyone could use a tool, and a dependency tree to maintain. The tools are small enough that the DOM API is sufficient. The source files _are_ the product, which also makes the code easy to read in a browser's developer tools.

### Classic `<script>` files, not ES modules

Browsers refuse to load `<script type="module">` (and `import`) from `file://` URLs because of CORS rules. Since "double-click `index.html`" is a headline feature, we use classic scripts. Each file wraps itself in a function and exposes one global namespace (`OT`, `PdfCore`, ...). The same files are loaded in Node by tests via a small UMD wrapper:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(/* deps */);
  else root.MyCore = factory(/* globals */);
})(typeof self !== 'undefined' ? self : this, function () {
  /* ... */ return { api };
});
```

### Three layers per tool

```text
index.html  ->  js/app.js  ->  js/core.js
 (page)         (UI wiring)     (pure logic, unit-tested)
```

- `core.js` never touches `document`, `window` or storage. This is what makes it testable in Node and reusable elsewhere.
- `app.js` is intentionally thin: read inputs, call core, render results or the error message.
- Dependencies flow one way: UI depends on core, never the reverse.

Some tools split further where it pays off: Document Generator has `pdf.js` (layout) separate from `core.js` (maths), and Sheet Cleaner keeps SheetJS out of `core.js` entirely (it only touches files in `app.js`).

### Immutable data and plain objects

Core functions return new objects instead of editing their arguments. That makes Undo (Sheet Cleaner), state persistence (Focus Desk) and testing trivial. Data is plain objects/arrays so it can be serialised as JSON.

### Self-contained tool folders + a `shared/` source of truth

Each tool must work when its folder is copied alone, so each has its own `css/theme.css` and `js/common.js`. To avoid editing ten copies, the originals live in `shared/` and `npm run sync` copies them in (with a "do not edit" banner). `npm run check:sync` fails CI if a copy is stale. A small amount of duplication (for example `wrapLine` in two tools) is accepted rather than introducing a second shared layer.

### Vendored libraries instead of a CDN

`scripts/vendor.mjs` copies exact, pinned builds from `node_modules` into each tool's `vendor/` along with license files and a generated `vendor/README.md` listing versions. No CDN means the tools work offline and no third party can change the code under us.

| Library          | Used by                                                                       | Why                                                                                         |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| pdf-lib          | PDF Toolkit, Image Tools, File Converter, Document Generator, PDF Fill & Sign | Create and edit PDFs in pure JavaScript                                                     |
| SheetJS (CE)     | Sheet Cleaner, File Converter                                                 | Read/write Excel and CSV                                                                    |
| PDF.js 3.11.174  | PDF Fill & Sign                                                               | Draw PDF pages (3.x is the last line with a classic-script build that works from `file://`) |
| qrcode-generator | QR & Barcode Maker                                                            | QR matrix (we render the SVG ourselves)                                                     |
| JsBarcode        | QR & Barcode Maker                                                            | Barcode drawing                                                                             |

### Content-Security-Policy on every page

Each `index.html` carries a CSP `<meta>` tag starting from `default-src 'none'` and allowing only what is needed (`script-src 'self'`, `style-src 'self'`, `img-src 'self' data: blob:`, `connect-src 'none'`). Consequences developers must respect: no inline `<script>`/`<style>`, no `style="..."` or `onclick="..."` attributes in markup (setting `element.style.x = ...` from JavaScript is allowed), no `eval`. `npm run check:structure` enforces this.

### Downloads and files

Users open files with `<input type="file">` or drag and drop, read them with `FileReader`, and receive results via a temporary `blob:` URL link (`OT.downloadBlob`). There is no server component and no File System Access API dependency.

### Storage

Only Focus Desk and Document Generator persist data, in `localStorage`, always inside `try/catch` (storage can be disabled), always validated on load, and always with an explicit export/import for backups.

### Accessibility

Semantic HTML, labelled controls, a visible focus ring, `role="status"` regions for results and errors, ARIA tab pattern with arrow-key support (`OT.bindTabs`), light/dark via `prefers-color-scheme`, no colour-only signals.

## Testing strategy

| Level      | What                                                                                  | How                                                                        |
| ---------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Unit       | Everything in `core.js` and `shared/`                                                 | `node:test`, run by `npm test` in CI                                       |
| Static     | Style, obvious bugs, formatting                                                       | ESLint, Prettier                                                           |
| Repository | Offline guarantee, CSP present, required files, README sections, shared files in sync | `scripts/check-*.mjs`                                                      |
| Manual UI  | Layout, interaction, console errors                                                   | Open `index.html` from disk and via `npm run serve`, in Chrome and Firefox |

The core/UI split is what keeps the first row cheap: nearly all behaviour is exercised without a browser.

## Browser support

Current Chrome, Edge, Firefox and Safari 16.4+. Features used: `createImageBitmap`, `canvas.toBlob`, regex lookbehind, `Intl.NumberFormat`, pointer events, `Array.prototype.flatMap`.

## Trade-offs we accepted

- No live preview of typed PDF form values (would require re-rendering through PDF.js form layers).
- Standard PDF fonts only (Latin script); embedding Unicode fonts would add megabytes to every tool.
- Everything is held in memory, so extremely large files are limited by the browser.

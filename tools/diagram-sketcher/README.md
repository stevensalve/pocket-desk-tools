# Diagram Sketcher

> Draw flowcharts and org charts in your browser, or build one from an indented outline.

Part of [Pocket Desk Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Make a clear diagram without an account: add boxes, drag them, connect them with arrows, label things, and export a picture. Or type an indented list and get a tidy top-down tree (ideal for org charts).

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/diagram-sketcher/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- diagram-sketcher ../diagram-sketcher-repo`.

## Features

- Four shapes (box, rounded, oval, diamond) and seven colours; labels on arrows; multi-line text.
- Drag to move with optional snap-to-grid; connect mode to draw arrows; Delete key; undo.
- Outline to tree: indent with spaces or tabs, bullets allowed; several top lines are grouped under a root.
- Export SVG (sharp at any size) or PNG; save to a `.json` file and open it again later.
- Keyboard-friendly toolbar and text editing; screen-reader labels on boxes.

## How it works

`js/core.js` exports `DiagramCore`. A diagram is plain data (nodes and edges); every function returns a new diagram. It includes `layoutTree`, arrow-to-border geometry for each shape, `toSvg` (all text escaped), and `serialize` / `parse` with validation. The page draws with SVG elements built through the DOM, never from strings, so labels cannot inject markup.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- The tool has no third-party dependencies at all.

## Limitations

- Straight arrows only (no routing around boxes); arrows are drawn between box centres on the border.
- Layout is top-down trees only; flowcharts are arranged by hand.
- PNG export is rendered by your browser, so fonts follow your system.
- No multi-select, groups or images.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/diagram-sketcher/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.

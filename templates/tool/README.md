# {{title}}

> {{tagline}}

## What it does

Describe, in two or three plain sentences, the problem this tool solves and who it is for. Write for someone who has never opened a terminal.

## Quick start

1. Download this folder (or the whole repository as a ZIP) and unzip it.
2. Double-click `index.html` to open it in your browser. It works with no internet.

Developers: from the repository root run `npm run serve`, then open <http://localhost:8080/tools/{{id}}/>.

## Features

- Feature one
- Feature two

## How it works

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and the Content-Security-Policy |
| `css/theme.css` | Shared look and feel (synced from `shared/`, do not edit) |
| `css/app.css` | Styles for this tool only |
| `js/common.js` | Shared helpers (synced from `shared/`, do not edit) |
| `js/core.js` | The logic - pure functions, unit-tested |
| `js/app.js` | Connects the page to the logic |
| `tests/core.test.js` | Unit tests (`npm test` at the repository root) |

## Privacy and security

Everything runs in your browser. No file or text is sent anywhere, and the page's Content-Security-Policy blocks network requests.

## Limitations

- List what the tool cannot do yet, honestly.

## Development

```bash
npm install     # once, at the repository root
npm test        # runs every tool's unit tests
npm run verify  # tests + lint + formatting + repository checks
```

## License

MIT - see [LICENSE](LICENSE).

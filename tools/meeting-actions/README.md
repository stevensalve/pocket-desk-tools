# Meeting Actions

> Paste meeting notes and get the to-do list, decisions and open questions.

Part of [Pocket Desk Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Turn messy notes into a clear list of who does what by when. It recognises common ways people write actions, works out dates like "by Friday", and lets you copy the result as Markdown or an e-mail, or download a CSV and a calendar file. It uses simple, visible rules, not AI, so nothing is invented and nothing leaves your device.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/meeting-actions/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- meeting-actions ../meeting-actions-repo`.

## Features

- Finds actions from `Action:` / `TODO:` / `Follow-up:` lines, checkboxes (`[ ]`, `[x]`), bullets under headings such as _Actions_ or _Next steps_, and sentences like `Sam will call the vendor` (marked as a lower-confidence guess).
- Owners from `@name`, `owner: Name`, a trailing `(Name)`, `Name: task`, or `I will ...` (using your name).
- Dates: `today`, `tomorrow`, `EOW`, `EOM`, `in 2 weeks`, `Friday`, `next Friday`, `25 Oct`, `2026-11-30`, and numeric dates (day-first or month-first, your choice).
- Decisions (`Decision:`, `We agreed ...`) and questions (`Q:`) go to their own lists.
- Every row is editable before you share. Exports: Markdown, e-mail text, CSV (Excel-friendly) and `.ics` all-day calendar events.

## How it works

`js/core.js` exports `ActionsCore`: `parseNotes`, `parseDatePhrase`, `formatDate`, `toMarkdown`, `toEmail`, `toCsv` and `toIcs`. The reference date is always passed in (never read from the clock), so tests are repeatable. Each action records why it was picked (`reason`) and a `confidence` so the UI can show which rows deserve a second look.

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

- Understands English wording only.
- It is a rule-based reader: unusual phrasing may be missed, and sentences like `Dana will ...` can be wrong. Check the list before sending it.
- Names are recognised when capitalised (or listed as attendees).
- Calendar export uses all-day events; there are no times or reminders.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/meeting-actions/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node:

```js
const core = require('./js/core.js');
const r = core.parseNotes('ACTION: @priya send budget by Friday', { today: '2026-10-22' });
r.actions[0]; // { text: 'Send budget', owner: 'priya', due: '2026-10-23', ... }
```

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.

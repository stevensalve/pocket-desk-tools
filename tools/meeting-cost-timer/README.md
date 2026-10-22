# Meeting Cost Timer

> See what a meeting costs as it runs.

Part of [Pocket Desk Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Enter who is attending and an hourly rate for each group, press Start, and watch the cost climb. It is a friendly nudge to keep meetings short and purposeful. It also shows what a repeating meeting costs over a year, and keeps a private log of finished meetings.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/meeting-cost-timer/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- meeting-cost-timer ../meeting-cost-timer-repo`.

## Features

- Groups of attendees with their own hourly rates (use averages if you prefer).
- Live cost, elapsed time, and cost per second/minute; pause and resume.
- Annual cost for daily, weekly, every-two-weeks, monthly or quarterly meetings.
- A meeting log kept **only in your browser** (`localStorage`), with a CSV download.
- Works with any currency symbol; no conversion is done.

## How it works

`js/core.js` exports `CostCore`. Elapsed time is computed from timestamps (`now - start - paused time`) instead of counting ticks, so the display stays correct if the tab is throttled or the laptop sleeps. Money and time formatting, annual cost and log validation are all pure functions with tests.

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
- The saved log lives in `localStorage` on this device only. Use **Clear log** to delete it. If your browser blocks storage the tool still works for the current visit.

## Limitations

- The cost is only an estimate based on the rates you type; rates are not saved, only finished-meeting totals are.
- A year is counted as 250 working days for daily meetings and 52 weeks for weekly ones.
- The log keeps the latest 200 meetings.
- Does not detect meeting start automatically or connect to a calendar.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/meeting-cost-timer/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.

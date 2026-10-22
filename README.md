# Pocket Desk Tools

**Ten small, private desk tools that run in your browser and keep working with no internet.**
Mail-merge letters, redact PDFs, turn meeting notes into to-dos, plan meetings across time zones, make passwords, print calendars, tidy scans, compare spreadsheets, sketch diagrams and see what a meeting costs - without uploading a single file to someone else's server.

- **Private** - everything runs on your own computer. Nothing is uploaded, tracked or stored remotely.
- **Offline** - download once, use forever. No installation, no account, no subscription.
- **Simple** - plain HTML, CSS and JavaScript. No framework, no build step, nothing to break.
- **Open** - MIT licensed. Copy a tool, change it, share it.

> New here and not a developer? Jump to [Use it without any technical knowledge](#use-it-without-any-technical-knowledge).

## The ten tools

Each tool lives in its own self-contained folder under [`tools/`](tools/) with its own README, license and tests. Any folder can be copied, hosted or published on its own.

| #   | Tool                                                    | What it does                                                                     | Replaces                          |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| 1   | [Mail Merge](tools/mail-merge/)                         | A personalised PDF or e-mail text for every spreadsheet row                      | paid mail-merge add-ons           |
| 2   | [PDF Redact & Stamp](tools/pdf-redact-stamp/)           | Permanently black out text, add watermarks and page numbers                      | online redaction sites            |
| 3   | [Meeting Actions](tools/meeting-actions/)               | Meeting notes to action items, owners, due dates, decisions, calendar file       | AI note-takers that upload notes  |
| 4   | [Timezone Planner](tools/timezone-planner/)             | Find a meeting time that suits every city; copy a local-times invitation         | world-clock websites              |
| 5   | [Password & ID Generator](tools/password-id-generator/) | Passwords, passphrases, PINs, UUIDs and tokens from secure randomness            | online password generators        |
| 6   | [Calendar & Planner Maker](tools/calendar-planner/)     | Printable monthly, yearly and weekly planner PDFs with your holidays             | calendar template sites           |
| 7   | [Scan Organiser](tools/scan-organiser/)                 | Phone photos to a tidy PDF: crop, rotate, clean up, reorder                      | phone scanner apps                |
| 8   | [Spreadsheet Diff](tools/sheet-diff/)                   | See what changed between two Excel/CSV files                                     | manual eyeballing, paid diff apps |
| 9   | [Diagram Sketcher](tools/diagram-sketcher/)             | Flowcharts and org charts; build a tree from an indented outline; SVG/PNG export | account-based diagram tools       |
| 10  | [Meeting Cost Timer](tools/meeting-cost-timer/)         | Live cost of a meeting, yearly cost of a recurring one, private log              | meeting-cost websites             |

The launcher page ([`index.html`](index.html)) lists all ten with a search box.

## Use it without any technical knowledge

1. On the GitHub page, click the green **Code** button, then **Download ZIP**.
2. Unzip the file anywhere (Desktop, Documents, a USB stick).
3. Open the unzipped folder and double-click **`index.html`**. Choose a tool.

That's all. You can disconnect from the internet and everything still works. Want just one tool? Copy only its folder from `tools/` and double-click that folder's `index.html`.

Works in current versions of Chrome, Edge, Firefox and Safari (16.4 or newer).

## For developers

Requirements: [Node.js](https://nodejs.org) 22 or newer (only for tests and tooling - the tools themselves need no Node).

```bash
git clone <this-repository-url>
cd pocket-desk-tools
npm install          # dev tooling only: tests, lint, formatter, library copies
npm run serve        # http://localhost:8080  (or just open index.html)
npm test             # unit tests for every tool
npm run verify       # everything CI runs: sync check, structure check, offline check, lint, format, tests
```

Useful commands:

| Command                                                | Purpose                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `npm run serve`                                        | Local static server (zero dependencies)                         |
| `npm test`                                             | Run all unit tests (Node's built-in test runner)                |
| `npm run lint` / `npm run format`                      | ESLint / Prettier                                               |
| `npm run sync`                                         | Copy `shared/` files into each tool (`check:sync` verifies)     |
| `npm run vendor`                                       | Refresh bundled third-party libraries from `node_modules`       |
| `npm run check:offline`                                | Fail if any page loads something from the internet              |
| `npm run check:structure`                              | Enforce conventions (required files, README sections, CSP, ...) |
| `npm run build`                                        | Assemble the deployable site in `_site/`                        |
| `npm run new-tool -- my-tool "My Tool" "What it does"` | Scaffold an eleventh tool                                       |
| `npm run export-tool -- mail-merge ../mail-merge-repo` | Turn one tool into its own repository                           |

### Repository layout

```text
.
├── index.html               Launcher page (search + links to all tools)
├── tools/
│   └── <tool>/              One self-contained folder per tool
│       ├── index.html       Page + Content-Security-Policy
│       ├── css/             theme.css (synced) + app.css (tool-specific)
│       ├── js/              common.js (synced) + core.js (logic) + app.js (UI)
│       ├── vendor/          Bundled third-party libraries + README with versions
│       ├── tests/           Unit tests (node:test)
│       ├── README.md        User and developer documentation
│       └── LICENSE
├── shared/                  Single source for theme.css and common.js (+ tests)
├── site/                    Launcher page code and tool catalogue
├── templates/tool/          Starter files used by `npm run new-tool`
├── scripts/                 Zero-dependency Node scripts (sync, vendor, checks, build)
├── docs/                    Architecture, hosting, adding a tool, splitting a tool
└── .github/                 CI, GitHub Pages deploy, issue and PR templates, Dependabot
```

### How the code is organised (the short version)

Every tool follows the same three-layer pattern, so once you have read one you can read all ten:

1. **`core.js` - the logic.** Pure functions with no access to the page, so they run in Node and are unit-tested. They throw plain-language `Error`s for bad input.
2. **`app.js` - the user interface.** Reads the form, calls `core.js`, shows results and errors. Builds the page with `textContent` / DOM APIs (never `innerHTML` with user data).
3. **`index.html` + CSS** - semantic, accessible markup with a strict Content-Security-Policy.

Scripts are classic `<script>` files (not ES modules) on purpose: browsers block module loading from `file://`, and double-click-to-open is a core feature. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reasoning.

## Hosting

Because there is no build step, hosting is just "serve these files".

- **GitHub Pages** (included): in your repository go to _Settings -> Pages -> Build and deployment -> Source: GitHub Actions_. The workflow in `.github/workflows/pages.yml` publishes the site on every push to `main`.
- **Any static host** (Netlify, Cloudflare Pages, an intranet web server, a shared network drive): upload the output of `npm run build` (the `_site/` folder) or the repository itself.

Details and tips (including hosting inside a company network): [docs/HOSTING.md](docs/HOSTING.md).

## Privacy and security by design

- Every page has a Content-Security-Policy that blocks network requests (`connect-src 'none'`), inline scripts and `eval`. `npm run check:offline` and `npm run check:structure` guard this in CI.
- Third-party libraries are copied into each tool's `vendor/` folder (no CDN), with versions and licenses recorded.
- No analytics, cookies, fonts or images are loaded from anywhere.
- Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome at every level - fixing a typo, adding a test, improving accessibility, or building a new tool. Start with [CONTRIBUTING.md](CONTRIBUTING.md); [docs/IDEAS.md](docs/IDEAS.md) lists beginner-friendly and intermediate tasks. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE). Bundled third-party libraries keep their own licenses (listed in each tool's `vendor/README.md`): pdf-lib (MIT), fflate (MIT), SheetJS Community Edition (Apache-2.0) and PDF.js (Apache-2.0). The passphrase word list in Password & ID Generator is the EFF Short Wordlist #1, licensed CC BY 3.0 US (attribution in that tool's README and data file).

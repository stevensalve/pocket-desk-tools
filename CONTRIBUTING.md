# Contributing

Thank you for helping! This project is deliberately small and approachable. You do not need to be an expert to contribute, and every kind of contribution counts: code, tests, documentation, accessibility fixes, translations of tool text, bug reports and ideas.

## Ground rules

1. **Stay offline and private.** Tools must never send user data anywhere, and pages must not load scripts, styles, fonts or images from the internet. Third-party libraries are copied into `tools/<tool>/vendor/` (see `scripts/vendor.mjs`).
2. **No build step.** Source files are what the browser runs. No bundlers, transpilers or frameworks.
3. **Keep each tool self-contained.** A tool folder must work when copied elsewhere. Shared code lives in `shared/` and is copied into each tool by `npm run sync`.
4. **Be kind.** Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

```bash
git clone <your-fork-url>
cd offline-office-toolkit
npm install
npm run verify      # should pass before you change anything
npm run serve       # preview at http://localhost:8080
```

You need Node.js 22+. Tools themselves run in the browser; Node is only for tests and scripts.

## Workflow

1. Open (or find) an issue describing the change. For anything non-trivial, say you are working on it to avoid duplicate effort.
2. Create a branch: `git checkout -b fix/pdf-toolkit-range-message`.
3. Make your change in small, focused commits.
4. Add or update tests, run `npm run verify`.
5. Open a pull request using the template. A maintainer will review; please be patient and open to feedback.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`.

```text
feat(sheet-cleaner): add "remove columns by name" action
fix(pdf-fill-sign): keep signature inside page when zoomed
docs(readme): explain hosting on an intranet
test(office-calculators): cover leap-day date differences
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`, `ci`. The scope is a tool folder name or an area (`shared`, `scripts`, `docs`).

## Coding standards

### Structure of a tool

| Layer  | File          | Rules                                                                                                                                                                              |
| ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logic  | `js/core.js`  | Pure functions. **No** `document`, `window`, `localStorage`. Throw `Error` with a plain-language message for bad input. Export via the UMD wrapper so Node tests can `require` it. |
| UI     | `js/app.js`   | Wires the page to `core.js`. Use `textContent`/`el()`; never put user data into `innerHTML`. Show errors in the `role="status"` element.                                           |
| Page   | `index.html`  | Semantic HTML, `lang`, viewport and description meta, a strict CSP, no inline `style`/`on*` attributes, unique ids, labels for every input.                                        |
| Styles | `css/app.css` | Use the CSS variables from `theme.css`. Never hard-code colours that break dark mode.                                                                                              |

Start a new tool with `npm run new-tool` - it creates the right structure.

### JavaScript style

- Classic scripts in a function wrapper (`'use strict'`), `const`/`let`, arrow functions, template literals are fine. No ES module syntax in files loaded by the browser.
- Functions do one thing, have a short doc comment saying _what_ and any non-obvious _why_, and validate their input.
- Prefer returning new objects over mutating arguments (this makes undo and testing easy).
- Prettier and ESLint decide formatting and obvious errors: `npm run format` and `npm run lint`.

### Accessibility checklist (every UI change)

- Everything works with the keyboard alone; focus is visible.
- Every input has a `<label>`; buttons that only show an icon have an `aria-label`.
- Results and errors are announced (`role="status"` / `aria-live`).
- Colour is never the only signal (for example the diff uses `+`/`-` as well).
- Text contrast meets WCAG AA in both light and dark themes; the page works at 200% zoom.

### Security checklist

- No `eval`, `new Function`, `innerHTML` with user data, or `document.write`.
- Treat every opened file (PDF, spreadsheet, JSON backup) as untrusted. Validate, clamp and drop unknown fields.
- Do not add network calls, analytics, or remote assets. `npm run check:offline` must pass.
- Adding a vendored library? Add it to `scripts/vendor.mjs`, pin the exact version in `package.json`, keep its license file, and note it in the tool's README.

## Tests

- Unit tests live in `tools/<tool>/tests/` and use Node's built-in runner (`node:test` and `node:assert/strict`) - no extra test framework.
- Test the behaviour, including edge cases and error messages. Build tiny inputs in memory (for example generate a PDF with pdf-lib) instead of committing binary fixtures.
- Fixing a bug? Write the failing test first.
- UI changes: open the page from disk (`file://`) _and_ via `npm run serve`, in a Chromium-based browser and in Firefox, and check the browser console for errors.

## Adding or changing shared code

Edit `shared/theme.css` or `shared/common.js`, then run `npm run sync`. CI fails if the copies in `tools/` are stale. Shared functions need tests in `shared/tests/`.

## Updating a vendored library

```bash
npm install pdf-lib@<new-version> --save-exact --save-dev
npm run vendor
npm run verify
```

Review the diff, run each affected tool by hand, and mention the upgrade in `CHANGELOG.md`.

## Releasing (maintainers)

1. Update `CHANGELOG.md` (move _Unreleased_ entries under a new version heading).
2. Bump `version` in `package.json`.
3. Merge to `main` - GitHub Pages deploys automatically.
4. Tag the release: `git tag v1.1.0 && git push --tags`.

## Questions

Open a discussion or an issue. There are no silly questions.

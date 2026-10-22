# Adding a new tool

This walkthrough takes you from an idea to a merged pull request. Budget about an hour for a small tool.

## 1. Pick a good idea

A good tool:

- solves one task that non-technical people currently do on a website that asks them to upload files,
- needs no server (everything computable in the browser),
- has logic you can describe as "input in, result out", which means it is easy to test.

[IDEAS.md](IDEAS.md) has a backlog. Open an issue first so nobody duplicates your work.

## 2. Scaffold

```bash
npm run new-tool -- word-cloud "Word Cloud" "Turn any text into a word-frequency list."
```

This creates `tools/word-cloud/` from `templates/tool/`, adds the tool to the launcher catalogue (`site/tools-data.js`) and copies the shared files in.

## 3. Write the logic first (`js/core.js`)

Design the functions on paper: names, inputs, outputs, error cases. Then write the tests _before or alongside_ the code:

```js
test('countWords ignores case', () => {
  assert.deepEqual(core.countWords('The the THE'), [{ word: 'the', count: 3 }]);
});
```

Run just your tool's tests while you work:

```bash
node --test tools/word-cloud/tests/core.test.js
```

Rules: no `document`/`window`; throw `Error('plain language message')` for invalid input; do not mutate arguments.

## 4. Build the page (`index.html`, `js/app.js`, `css/app.css`)

- Reuse the classes from `theme.css`: `card`, `grid`, `row`, `stack`, `tabs`, `dropzone`, `status`, `table-wrap`, `badge`.
- Use the helpers from `js/common.js` (`OT`): `bindDropzone`, `bindTabs`, `setStatus`, `downloadBlob`, `readArrayBuffer`, `readText`, `copyText`, `el`, `formatBytes`, ...
- Every input needs a `<label>`; show results/errors in an element with `role="status"`.
- Do not use inline `style`, inline scripts or `on*=` attributes - the CSP blocks them.
- Need a library? Add it to `scripts/vendor.mjs` (and `package.json`, pinned) rather than linking a CDN.

Try it from disk (double-click `tools/word-cloud/index.html`) _and_ with `npm run serve`.

## 5. Document it

Fill in `tools/word-cloud/README.md`. Every tool README has the same sections (the structure check enforces them): _What it does, Quick start, Features, How it works, Privacy and security, Limitations, Development, License_. Be honest in **Limitations**.

Update `replaces` and `tags` for your tool in `site/tools-data.js`, and add a row to the table in the root `README.md`.

## 6. Check everything

```bash
npm run format      # tidy
npm run verify      # sync + structure + offline + lint + format check + tests
```

## 7. Open the pull request

Use the PR template. Include a short screen recording or screenshot of the tool, and mention which browsers you tried. Thank you!

## Definition of done

- [ ] Logic in `core.js` with tests, including error cases
- [ ] Works from `file://` and from `npm run serve`; no console errors
- [ ] Keyboard-usable, labelled, readable in dark mode
- [ ] README complete, listed in launcher and root README
- [ ] `npm run verify` passes

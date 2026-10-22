# Publishing one tool as its own repository

Every folder in `tools/` is self-contained, so any of them can live in a repository of its own (for example if a team only wants the PDF tools).

```bash
npm run export-tool -- pdf-toolkit ../pdf-toolkit-repo
cd ../pdf-toolkit-repo
npm install        # installs the test-time dependency (pdf-lib)
npm test           # runs the tool's unit tests
git init && git add . && git commit -m "feat: initial import from offline-office-toolkit"
```

What the export contains:

- the tool folder at the repository root (`index.html`, `css/`, `js/`, `vendor/`, `tests/`, `README.md`, `LICENSE`),
- a `package.json` with only the dependencies the tests need,
- `scripts/run-tests.mjs` and `scripts/serve.mjs`,
- `.editorconfig`, `.gitignore`, `.prettierrc.json`,
- GitHub Actions for tests and GitHub Pages.

After exporting:

1. Replace relative links that point into the monorepo (for example `../../README.md` in the tool README) with your own.
2. Enable Pages (_Settings -> Pages -> Source: GitHub Actions_) to publish `index.html` at the repository's site URL.

If you want to keep the Git history of the folder instead, use `git subtree split --prefix=tools/pdf-toolkit -b pdf-toolkit-only` and push that branch to a new repository.

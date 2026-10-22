# Password & ID Generator

> Strong passwords, passphrases, PINs, tokens and unique IDs from your browser's secure random generator.

Part of [Pocket Desk Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Create a password, an easy-to-remember passphrase, a PIN, or an ID in one click. Randomness comes from your browser's cryptographic generator (`crypto.getRandomValues`), nothing is stored, and nothing is sent anywhere.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/password-id-generator/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- password-id-generator ../password-id-generator-repo`.

## Features

- Passwords of 8-64 characters with chosen character sets, and an option to avoid look-alike characters (`l 1 I O 0`). At least one character from each chosen set is guaranteed.
- Passphrases from the EFF short word list (1,296 words, about 10.3 bits per word), with separator, capitalisation and optional digit.
- PINs (4-12 digits), UUID v4, time-sorted UUID v7, short readable IDs like `K7MQ-4XPD`, hex tokens and URL-safe tokens.
- Strength label with the estimated bits of entropy and a plain-language "time to crack" for a very fast offline attacker.
- Generate up to 25 at once; copy all or download as text.

## How it works

`js/core.js` exports `PwCore`. Every generator takes a random function `rng(n)` that returns a whole number from 0 to n-1. `makeCryptoRng` builds it from `crypto.getRandomValues` using **rejection sampling**, so there is no modulo bias; tests inject a seeded `rng` and also check the real one for uniformity. `js/wordlist.js` holds the EFF word list.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/wordlist.js`     | The EFF short word list (data only, CC BY 3.0 US)                                                   |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- The tool has no third-party dependencies at all.

## Limitations

- Strength numbers are estimates for random choices only; a password you invent yourself is not covered.
- No password-manager features: copy the result into one, because the tool never stores it.
- The "time to crack" line assumes 10 billion guesses per second; real attackers and defences vary.
- The word list is English.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/password-id-generator/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). Word list: EFF Short Wordlist #1, (c) Electronic Frontier Foundation, licensed [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/). The numbers were removed and the words wrapped into a script. Source: <https://www.eff.org/dice>.

# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Use GitHub's private vulnerability reporting: on the repository page choose _Security -> Report a vulnerability_. Include the tool name, what you did, what you expected and what happened, and (if possible) a small file that reproduces it. We aim to acknowledge reports within a few days and to publish a fix and credit you (if you wish) once it is released.

## Supported versions

Only the latest release on the `main` branch is supported.

## Threat model in one paragraph

These tools process files that users open on their own computer. The main risks are (1) a malicious file exploiting a parser, (2) a bug leaking data over the network, and (3) tampered third-party code. The design answers each: parsers are well-known open-source libraries pinned to exact versions and bundled in `vendor/`; every page ships a Content-Security-Policy with `connect-src 'none'` plus `script-src 'self'` (no inline scripts, no `eval`) and CI fails if a page references an external resource; and libraries are never loaded from a CDN.

## Notes for specific components

- **PDF.js (PDF Fill & Sign)** is pinned to 3.11.174 and always opened with `isEvalSupported: false`; the page's CSP forbids `eval` as well. This mitigates CVE-2024-4367, the font-handling code-execution issue that affects PDF.js 4.1.392 and earlier (fixed upstream in 4.2.67). Upgrading to a fixed release would require moving to its ES-module build, which browsers do not allow from `file://`, so the pin plus mitigations is deliberate. It is reviewed whenever dependencies are updated.
- **SheetJS** is taken from the vendor's own distribution (`cdn.sheetjs.com`, version 0.20.3) because the copy on npm is outdated and known to be vulnerable.
- **Focus Desk and Document Generator** store data in `localStorage`. Imported backups and drafts are validated and sanitised before use, and user text is only ever written with `textContent`.

## Known `npm audit` findings

`npm audit` currently reports two groups of findings. Both are understood and accepted:

1. **`pdfjs-dist` <= 4.1.392 (GHSA-wgrm-67xf-hhpq)** - the PDF.js issue described above. It is mitigated in the product by `isEvalSupported: false` and a CSP without `unsafe-eval`; the pinned version is kept for the `file://` reasons given there.
2. **`tar`, `@mapbox/node-pre-gyp`, `canvas`** - pulled in only as _optional native dependencies of `pdfjs-dist` for Node-side rendering_. They are never bundled or shipped (only the two PDF.js files in `vendor/` are), and nothing in this repository runs them. They exist only in a developer's `node_modules`.

Re-check both whenever dependencies are updated.

## What is out of scope

- Attacks that require the attacker to already control the user's browser or operating system.
- A signature image added with PDF Fill & Sign is not a certified digital signature; that is documented behaviour, not a vulnerability.

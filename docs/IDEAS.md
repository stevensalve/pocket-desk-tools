# Ideas and good first tasks

Pick something, open an issue to say so, and follow [CONTRIBUTING.md](../CONTRIBUTING.md). Difficulty guide: **J** = suitable for a junior engineer, **M** = mid-level.

## Improvements to existing tools

| Tool               | Task                                                                    | Level |
| ------------------ | ----------------------------------------------------------------------- | ----- |
| PDF Toolkit        | Page thumbnails in the Extract/Delete tabs (render with PDF.js)         | M     |
| PDF Toolkit        | Add "Add page numbers" and "Add watermark text" tabs using pdf-lib      | J     |
| Image Tools        | Manual crop box with draggable handles                                  | M     |
| Image Tools        | "Strip metadata only" mode (re-encode losslessly where possible)        | M     |
| Sheet Cleaner      | Column picker for "remove duplicates by several columns"                | J     |
| Sheet Cleaner      | Keep number formats when exporting (detect date/number columns)         | M     |
| File Converter     | Read/write Markdown tables                                              | J     |
| File Converter     | Embed an open-licence Unicode font so text-to-PDF supports more scripts | M     |
| QR & Barcode Maker | Batch mode: one QR per row of a pasted list, as a printable sheet       | M     |
| Text Toolkit       | Word-level highlighting inside changed diff lines                       | M     |
| Text Toolkit       | Slugify, remove accents, and "sort by length" line tools                | J     |
| Office Calculators | Add a salary/tax-slab calculator with editable slabs                    | M     |
| Office Calculators | EMI with part-prepayment                                                | M     |
| Document Generator | Quotation / purchase-order document types                               | J     |
| Document Generator | Several tax rates per document with a tax summary table                 | M     |
| PDF Fill & Sign    | Show typed form-field values in the preview                             | M     |
| PDF Fill & Sign    | Undo/redo for placed items                                              | J     |
| Focus Desk         | Recurring tasks                                                         | M     |
| Focus Desk         | Persist the running timer across reloads                                | J     |
| All                | Translate tool text (an `i18n` helper in `shared/`)                     | M     |
| All                | Playwright smoke tests for each page in CI                              | M     |

## New tool candidates

| Idea                           | What it does                                                              | Level |
| ------------------------------ | ------------------------------------------------------------------------- | ----- |
| Meeting Notes to Actions       | Paste notes, extract lines starting with "TODO"/"Action" into a checklist | J     |
| Timezone Planner               | Compare working hours across cities (uses `Intl`, no data download)       | J     |
| Mail Merge                     | CSV + template text -> one file per row, or a combined PDF                | M     |
| Password & ID Generator        | Strong random passwords and UUIDs with the Web Crypto API                 | J     |
| Date & Calendar Maker          | Printable monthly/yearly calendars as PDF                                 | M     |
| Receipt Scanner Organiser      | Rename/rotate/crop scanned receipts, export as one PDF                    | M     |
| Diff for Spreadsheets          | Visual cell-by-cell diff of two Excel files                               | M     |
| Org Chart / Flowchart Sketcher | Drag-and-drop boxes and arrows, export SVG/PNG                            | M     |
| Redact PDF                     | Black-out rectangles that truly remove text (rasterise the page)          | M     |
| Meeting Cost Timer             | Live cost of a meeting from attendee count and hourly rates               | J     |

## Repository and quality

- Add a screenshot gallery to the root README (J).
- Add an accessibility audit script with axe-core run from Playwright in CI (M).
- Add a Content-Security-Policy `report` mode test that fails on any violation during the smoke tests (M).

# Ideas and good first tasks

Pick something, open an issue to say so, and follow [CONTRIBUTING.md](../CONTRIBUTING.md). Difficulty guide: **J** = suitable for a junior engineer, **M** = mid-level.

## Improvements to existing tools

| Tool                     | Task                                                                     | Level |
| ------------------------ | ------------------------------------------------------------------------ | ----- |
| Mail Merge               | Save and load a template (JSON) so a letter can be reused                | J     |
| Mail Merge               | Simple formatting in the letter body (bold, headings)                    | M     |
| PDF Redact & Stamp       | Undo/redo for redaction boxes                                            | J     |
| PDF Redact & Stamp       | Remove metadata and attachments from the saved file as well              | M     |
| Meeting Actions          | Support another language's date words (an `i18n` table for months/days)  | M     |
| Meeting Actions          | Highlight the matched words in the notes box                             | M     |
| Timezone Planner         | Per-city working days (for example Sunday-Thursday weeks)                | M     |
| Timezone Planner         | Shareable link that stores the cities in the URL hash                    | J     |
| Password & ID Generator  | Add a second, longer word list and a list picker                         | J     |
| Password & ID Generator  | "Check my password" mode that estimates entropy of a typed password      | M     |
| Calendar & Planner Maker | A starter set of public holidays per country as a downloadable text file | J     |
| Calendar & Planner Maker | Habit-tracker and dotted-grid planner layouts                            | M     |
| Scan Organiser           | Perspective correction (drag four corners)                               | M     |
| Scan Organiser           | Optional OCR to produce a searchable PDF                                 | M     |
| Spreadsheet Diff         | Choose columns to ignore                                                 | J     |
| Spreadsheet Diff         | Export the highlighted comparison as an Excel file                       | M     |
| Diagram Sketcher         | Multi-select and move several boxes                                      | M     |
| Diagram Sketcher         | Elbow (right-angle) connectors                                           | M     |
| Meeting Cost Timer       | Choose a rate by role from a saved list                                  | J     |
| Meeting Cost Timer       | A full-screen "big display" mode for projecting in a meeting room        | J     |
| All                      | Translate tool text (an `i18n` helper in `shared/`)                      | M     |
| All                      | Playwright smoke tests for each page in CI                               | M     |

## New tool candidates

The ten tools in this repository came from an earlier list of ideas. Fresh candidates for an eleventh tool:

| Idea                          | What it does                                                           | Level |
| ----------------------------- | ---------------------------------------------------------------------- | ----- |
| Regex Tester                  | Try a pattern against sample text with highlighted matches             | J     |
| Cron Explainer                | Translate a cron schedule into plain words and show the next runs      | J     |
| Random Picker & Team Splitter | Pick a name, draw a winner, split a list into balanced teams           | J     |
| Image Metadata Viewer         | Show and strip EXIF data (location, camera) from photos                | M     |
| Gantt Chart Maker             | Tasks and dates to a printable timeline (SVG/PDF)                      | M     |
| Resume / CV Builder           | Fill a form, get a clean one-page PDF                                  | M     |
| SOP / Checklist Builder       | Turn steps into a printable checklist or a runbook page                | J     |
| Markdown to PDF               | Render Markdown to a styled PDF without a server                       | M     |
| JSON / YAML Formatter         | Validate, pretty-print and convert between JSON and YAML               | J     |
| Reconciliation Helper         | Match two lists of amounts (bank vs ledger) and show what is left over | M     |

## Repository and quality

- Add a screenshot gallery to the root README (J).
- Add an accessibility audit script with axe-core run from Playwright in CI (M).
- Add a Content-Security-Policy `report` mode test that fails on any violation during the smoke tests (M).

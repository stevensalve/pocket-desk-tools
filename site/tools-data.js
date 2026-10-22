/**
 * The catalogue shown on the launcher page (index.html).
 * Keep in sync with the folders in /tools - `npm run check:structure` fails if
 * a tool is missing here. It is a .js file (not .json) so the launcher also
 * works when opened straight from disk, where browsers block fetch().
 */
window.TOOLS = [
  {
    id: 'mail-merge',
    title: 'Mail Merge',
    tagline: 'Turn a spreadsheet and a template into one personalised letter per row, as PDFs or a ZIP.',
    replaces: 'Word mail merge, paid merge sites',
    tags: ['csv', 'excel', 'pdf', 'letters'],
  },
  {
    id: 'pdf-redact-stamp',
    title: 'PDF Redact & Stamp',
    tagline: 'Permanently black out sensitive areas, add watermarks and page numbers.',
    replaces: 'upload-based redaction and watermark sites',
    tags: ['pdf', 'privacy', 'watermark'],
  },
  {
    id: 'meeting-actions',
    title: 'Meeting Actions',
    tagline: 'Paste messy notes and get action items, owners, due dates, decisions and questions.',
    replaces: 'copy-pasting notes into a tracker',
    tags: ['meetings', 'text', 'productivity'],
  },
  {
    id: 'timezone-planner',
    title: 'Timezone Planner',
    tagline: 'Compare working hours across cities and find the overlap for a meeting.',
    replaces: 'world-clock and meeting-planner sites',
    tags: ['time', 'meetings'],
  },
  {
    id: 'password-id-generator',
    title: 'Password & ID Generator',
    tagline: 'Strong passwords, passphrases, PINs, tokens and UUIDs made with your browser’s secure random numbers.',
    replaces: 'online password generators',
    tags: ['security', 'passwords', 'uuid'],
  },
  {
    id: 'calendar-planner',
    title: 'Calendar Planner',
    tagline: 'Printable monthly and yearly calendars and weekly planners as PDF.',
    replaces: 'printable-calendar sites',
    tags: ['calendar', 'pdf', 'planner'],
  },
  {
    id: 'scan-organiser',
    title: 'Scan Organiser',
    tagline: 'Turn phone photos of documents into a tidy scanned PDF: rotate, crop, clean up, reorder.',
    replaces: 'scanner apps and upload-based scan sites',
    tags: ['scan', 'images', 'pdf'],
  },
  {
    id: 'sheet-diff',
    title: 'Sheet Diff',
    tagline: 'See exactly which cells changed between two Excel or CSV files.',
    replaces: 'Excel compare add-ins',
    tags: ['excel', 'csv', 'compare'],
  },
  {
    id: 'diagram-sketcher',
    title: 'Diagram Sketcher',
    tagline: 'Draw flowcharts and org charts, or turn an indented outline into a chart; export SVG or PNG.',
    replaces: 'diagram sites that need an account',
    tags: ['diagram', 'flowchart', 'org chart'],
  },
  {
    id: 'meeting-cost-timer',
    title: 'Meeting Cost Timer',
    tagline: 'Watch what a meeting costs in real time and what a recurring one costs per year.',
    replaces: 'curiosity and spreadsheets',
    tags: ['meetings', 'finance'],
  },
];

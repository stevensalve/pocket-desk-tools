/**
 * The catalogue shown on the launcher page (index.html).
 * Keep in sync with the folders in /tools - `npm run check:structure` fails if
 * a tool is missing here. It is a .js file (not .json) so the launcher also
 * works when opened straight from disk, where browsers block fetch().
 */
window.TOOLS = [
  {
    id: 'pdf-toolkit',
    title: 'PDF Toolkit',
    tagline: 'Merge, split, rotate, extract and delete PDF pages.',
    replaces: 'iLovePDF, Smallpdf',
    tags: ['pdf', 'documents'],
  },
  {
    id: 'image-tools',
    title: 'Image Tools',
    tagline: 'Compress, resize, crop and convert photos, or turn them into a PDF.',
    replaces: 'TinyPNG, Squoosh, image-to-PDF sites',
    tags: ['images', 'pdf'],
  },
  {
    id: 'sheet-cleaner',
    title: 'Sheet Cleaner',
    tagline: 'Clean Excel/CSV data, remove duplicates, compare two sheets, VLOOKUP.',
    replaces: 'manual Excel clean-up',
    tags: ['excel', 'csv', 'data'],
  },
  {
    id: 'file-converter',
    title: 'File Converter',
    tagline: 'Convert between CSV, Excel and JSON, or turn text into a PDF.',
    replaces: 'online CSV/JSON converters',
    tags: ['csv', 'excel', 'json', 'pdf'],
  },
  {
    id: 'qr-barcode-maker',
    title: 'QR & Barcode Maker',
    tagline: 'QR codes for links, Wi-Fi, contacts, e-mail and SMS, plus EAN and Code 128 barcodes.',
    replaces: 'QR generator sites with trackers',
    tags: ['qr', 'barcode'],
  },
  {
    id: 'text-toolkit',
    title: 'Text Toolkit',
    tagline: 'Change case, count words, clean lists, find and replace, compare texts.',
    replaces: 'word counters, diff sites',
    tags: ['text'],
  },
  {
    id: 'office-calculators',
    title: 'Office Calculators',
    tagline: 'Percentage, loan EMI, GST/VAT, dates, units, interest and margin.',
    replaces: 'assorted calculator sites',
    tags: ['calculator', 'finance'],
  },
  {
    id: 'doc-generator',
    title: 'Document Generator',
    tagline: 'Invoices, receipts and letters as clean PDFs.',
    replaces: 'invoice generator sites',
    tags: ['pdf', 'invoice', 'documents'],
  },
  {
    id: 'pdf-fill-sign',
    title: 'PDF Fill & Sign',
    tagline: 'Fill forms, type on any PDF, tick boxes and add your signature.',
    replaces: 'DocuSign-style free tiers',
    tags: ['pdf', 'signature', 'forms'],
  },
  {
    id: 'focus-desk',
    title: 'Focus Desk',
    tagline: 'To-do list, Kanban board, focus timer and notes - saved only in your browser.',
    replaces: 'to-do and Pomodoro web apps',
    tags: ['productivity'],
  },
];

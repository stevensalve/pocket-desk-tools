/**
 * Mail Merge - core logic (no DOM, no SheetJS; unit-testable in Node).
 *
 * Vocabulary
 *  - "record":   one spreadsheet row as an object, e.g. { Name: 'Ann', City: 'Pune' }
 *  - "template": text containing placeholders such as {{Name}} or {{City|your city}}
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('pdf-lib'));
  } else {
    root.MergeCore = factory(root.PDFLib);
  }
})(typeof self !== 'undefined' ? self : this, function (PDFLib) {
  'use strict';

  // ---------------------------------------------------------- Records

  /**
   * Turn spreadsheet rows (array of arrays, first row = headers) into records.
   * Blank headers become "Column N"; duplicates get " (2)", " (3)"...
   * Rows that are completely empty are dropped.
   */
  function buildRecords(rows) {
    if (!rows || rows.length === 0) return { headers: [], records: [] };
    const seen = new Map();
    const headers = rows[0].map(function (h, i) {
      let name = String(h == null ? '' : h).trim() || 'Column ' + (i + 1);
      const key = name.toLowerCase();
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      return n ? name + ' (' + (n + 1) + ')' : name;
    });
    const records = rows
      .slice(1)
      .filter((r) => r.some((c) => String(c == null ? '' : c).trim() !== ''))
      .map(function (r) {
        const rec = {};
        headers.forEach((h, i) => (rec[h] = r[i] == null ? '' : String(r[i])));
        return rec;
      });
    return { headers: headers, records: records };
  }

  /** Normalise a column name for matching: "  First   NAME " -> "first name". */
  const norm = (s) => String(s).trim().replace(/\s+/g, ' ').toLowerCase();

  // --------------------------------------------------------- Templates

  const PLACEHOLDER = /\{\{\s*([^{}|]+?)\s*(?:\|([^{}]*))?\}\}/g;

  /** Names of all fields used in a template, in order of first use. */
  function fieldsIn(template) {
    const names = [];
    for (const m of String(template).matchAll(PLACEHOLDER)) if (!names.some((n) => norm(n) === norm(m[1]))) names.push(m[1].trim());
    return names;
  }

  /**
   * Fill a template for one record.
   *  {{Name}}         the value of column "Name" (case and extra spaces ignored)
   *  {{Name|there}}   the value, or "there" when the cell is empty
   *  {{today}}        today's date (from options.today)
   *  {{row}}          the record number, starting at 1
   * Unknown columns are left in place and listed in `missing`; fields that
   * resolved to nothing are listed in `empty`.
   */
  function render(template, record, options) {
    const o = options || {};
    const lookup = new Map(Object.keys(record).map((k) => [norm(k), record[k]]));
    const missing = [];
    const empty = [];
    const text = String(template).replace(PLACEHOLDER, function (whole, name, fallback) {
      const key = norm(name);
      let value;
      if (key === 'today') value = o.today || '';
      else if (key === 'row') value = String(o.row || '');
      else if (lookup.has(key)) value = lookup.get(key);
      else {
        if (!missing.includes(name.trim())) missing.push(name.trim());
        return whole;
      }
      if (String(value).trim() === '') {
        if (fallback !== undefined) return fallback;
        if (!empty.includes(name.trim())) empty.push(name.trim());
        return '';
      }
      return String(value);
    });
    return { text: text, missing: missing, empty: empty };
  }

  /** Check a template against the available columns; returns unknown field names. */
  function unknownFields(template, headers) {
    const known = new Set(headers.map(norm).concat(['today', 'row']));
    return fieldsIn(template).filter((f) => !known.has(norm(f)));
  }

  // ------------------------------------------------------------ Files

  /** A safe, unique file name for each record (extension not included). */
  function fileNames(records, pattern, options) {
    const used = new Set();
    const o = options || {};
    return records.map(function (rec, i) {
      let base = render(pattern || 'letter-{{row}}', rec, {
        row: String(i + 1).padStart(String(records.length).length, '0'),
        today: o.today,
      }).text;
      base =
        base
          .split('')
          .map((c) => (c.charCodeAt(0) < 32 ? '_' : c))
          .join('')
          .replace(/[\\/:*?"<>|]/g, '_')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/^\.+/, '')
          .slice(0, 80) || 'letter-' + (i + 1);
      let name = base;
      let n = 2;
      while (used.has(name.toLowerCase())) name = base + '-' + n++;
      used.add(name.toLowerCase());
      return name;
    });
  }

  /** CSV text for pasting into an e-mail tool: To, Subject, Body. */
  function emailCsv(items) {
    const cell = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [['To', 'Subject', 'Body'].map(cell).join(',')];
    items.forEach((it) => lines.push([it.to, it.subject, it.body].map(cell).join(',')));
    return '﻿' + lines.join('\r\n');
  }

  /** Zip { "name.pdf": Uint8Array } using an injected fflate (browser global or require). */
  function makeZip(fflate, files) {
    const input = {};
    Object.keys(files).forEach((name) => (input[name] = files[name]));
    return fflate.zipSync(input, { level: 6 });
  }

  // -------------------------------------------------------------- PDF

  const PAGE = { a4: [595.28, 841.89], letter: [612, 792] };
  const FONTS = { helvetica: 'Helvetica', times: 'TimesRoman', courier: 'Courier' };

  /** Replace characters a standard PDF font cannot draw. */
  function sanitizeForFont(font, text) {
    const supported = new Set(font.getCharacterSet());
    const swaps = { '₹': 'Rs.', '…': '...', ' ': ' ', '\t': '    ' };
    let out = '';
    for (const ch of String(text)) {
      if (ch === '\n') out += ch;
      else if (swaps[ch] !== undefined) out += swaps[ch];
      else if (supported.has(ch.codePointAt(0))) out += ch;
      else out += '?';
    }
    return out;
  }

  /** Word-wrap one line; `measure(str)` returns the drawn width. */
  function wrapLine(line, maxWidth, measure) {
    if (line === '') return [''];
    const lines = [];
    let current = '';
    for (const word of line.split(/(?<=\s)/)) {
      if (measure((current + word).trimEnd()) <= maxWidth) {
        current += word;
        continue;
      }
      if (current) lines.push(current.trimEnd());
      current = '';
      let rest = word;
      while (measure(rest.trimEnd()) > maxWidth && rest.length > 1) {
        let n = rest.length - 1;
        while (n > 1 && measure(rest.slice(0, n)) > maxWidth) n--;
        lines.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      current = rest;
    }
    lines.push(current.trimEnd());
    return lines;
  }

  /**
   * Draw several letters into one PDF document; every letter starts on a new
   * page and continues onto more pages when long.
   * opts: { font, fontSize, pageSize, margin }
   */
  async function buildPdf(texts, opts) {
    const o = Object.assign({ font: 'helvetica', fontSize: 11, pageSize: 'a4', margin: 64 }, opts);
    if (!texts || texts.length === 0) throw new Error('There is nothing to print.');
    if (!(o.fontSize >= 7 && o.fontSize <= 24)) throw new Error('Font size must be between 7 and 24.');
    const doc = await PDFLib.PDFDocument.create();
    const font = await doc.embedFont(PDFLib.StandardFonts[FONTS[o.font] || 'Helvetica']);
    const [w, h] = PAGE[o.pageSize] || PAGE.a4;
    const maxWidth = w - 2 * o.margin;
    const lineHeight = o.fontSize * 1.4;
    const measure = (s) => font.widthOfTextAtSize(s, o.fontSize);
    for (const text of texts) {
      const lines = sanitizeForFont(font, String(text).replace(/\r\n?/g, '\n'))
        .split('\n')
        .flatMap((l) => wrapLine(l, maxWidth, measure));
      let page = doc.addPage([w, h]);
      let y = h - o.margin - o.fontSize;
      for (const line of lines) {
        if (y < o.margin) {
          page = doc.addPage([w, h]);
          y = h - o.margin - o.fontSize;
        }
        if (line) page.drawText(line, { x: o.margin, y: y, size: o.fontSize, font: font });
        y -= lineHeight;
      }
    }
    return doc.save();
  }

  return {
    buildRecords: buildRecords,
    fieldsIn: fieldsIn,
    unknownFields: unknownFields,
    render: render,
    fileNames: fileNames,
    emailCsv: emailCsv,
    makeZip: makeZip,
    sanitizeForFont: sanitizeForFont,
    wrapLine: wrapLine,
    buildPdf: buildPdf,
  };
});

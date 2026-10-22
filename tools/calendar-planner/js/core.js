/**
 * Calendar & Planner Maker - core logic (pure; pdf-lib is passed in so Node tests can use it).
 *
 * Dates are handled as calendar days in UTC (no time zones involved), so a calendar for
 * "October 2026" is identical wherever you open it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CalCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;
  const pad2 = (n) => String(n).padStart(2, '0');
  const isoOf = (y, m0, d) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);

  /** Names of months and weekdays for a locale ("en", "de", "fr", ...). Weekdays are Sunday-first. */
  function names(locale) {
    const loc = locale || 'en';
    const mf = new Intl.DateTimeFormat(loc, { month: 'long', timeZone: 'UTC' });
    const wf = new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' });
    const months = [];
    for (let m = 0; m < 12; m++) months.push(mf.format(new Date(Date.UTC(2026, m, 15))));
    const weekdays = [];
    for (let d = 0; d < 7; d++) weekdays.push(wf.format(new Date(Date.UTC(2026, 0, 4 + d)))); // 4 Jan 2026 is a Sunday
    return { months: months, weekdays: weekdays };
  }

  /** Weekday names starting from `weekStart` (0 = Sunday, 1 = Monday). */
  function orderedWeekdays(locale, weekStart) {
    const w = names(locale).weekdays;
    return Array.from({ length: 7 }, (_, i) => w[(weekStart + i) % 7]);
  }

  /** ISO 8601 week number and week-year for a date. */
  function isoWeek(y, m0, d) {
    const t = new Date(Date.UTC(y, m0, d));
    const dayNum = (t.getUTCDay() + 6) % 7; // Monday = 0
    t.setUTCDate(t.getUTCDate() - dayNum + 3); // the Thursday of this week
    const weekYear = t.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
    const week = 1 + Math.round(((t - firstThursday) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return { week: week, year: weekYear };
  }

  function daysInMonth(y, m0) {
    return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  }

  /**
   * Month grid: array of weeks, each 7 cells { day, month0, year, iso, inMonth, weekday, week }.
   * Always 4-6 weeks (only as many as needed).
   */
  function monthMatrix(y, m0, weekStart) {
    const ws = weekStart === 0 ? 0 : 1;
    const first = new Date(Date.UTC(y, m0, 1));
    const lead = (first.getUTCDay() - ws + 7) % 7;
    const total = Math.ceil((lead + daysInMonth(y, m0)) / 7) * 7;
    const weeks = [];
    for (let i = 0; i < total; i++) {
      const dt = new Date(Date.UTC(y, m0, 1 - lead + i));
      const cell = {
        day: dt.getUTCDate(),
        month0: dt.getUTCMonth(),
        year: dt.getUTCFullYear(),
        iso: dt.toISOString().slice(0, 10),
        inMonth: dt.getUTCMonth() === m0,
        weekday: dt.getUTCDay(),
        week: isoWeek(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()).week,
      };
      if (i % 7 === 0) weeks.push([]);
      weeks[weeks.length - 1].push(cell);
    }
    return weeks;
  }

  /**
   * Parse holiday/event lines. Accepted per line:
   *   2026-12-25 Christmas Day      (one specific date)
   *   12-25 Christmas Day           (every year)
   *   2026-12-24..2026-12-26 Office closed   (a range; also works with MM-DD..MM-DD)
   * Returns { map: { "2026-12-25": "Christmas Day", ... }, errors: ["line 3: ..."] } for the given year.
   */
  function parseHolidays(text, year) {
    const map = {};
    const errors = [];
    String(text || '')
      .split(/\r?\n/)
      .forEach(function (raw, i) {
        const line = raw.trim();
        if (!line || line[0] === '#') return;
        const m = /^((?:\d{4}-)?\d{2}-\d{2})(?:\.\.((?:\d{4}-)?\d{2}-\d{2}))?\s+(.+)$/.exec(line);
        if (!m) return errors.push('line ' + (i + 1) + ': use "2026-12-25 Name" or "12-25 Name"');
        const resolve = (s) => {
          const parts = s.split('-').map(Number);
          const [yy, mm, dd] = parts.length === 3 ? parts : [year, parts[0], parts[1]];
          const dt = new Date(Date.UTC(yy, mm - 1, dd));
          return dt.getUTCFullYear() === yy && dt.getUTCMonth() === mm - 1 && dt.getUTCDate() === dd
            ? { t: dt.getTime(), yearly: parts.length === 2 }
            : null;
        };
        const a = resolve(m[1]);
        const b = m[2] ? resolve(m[2]) : a;
        if (!a || !b) return errors.push('line ' + (i + 1) + ': that date does not exist');
        if (b.t < a.t) return errors.push('line ' + (i + 1) + ': the range ends before it starts');
        if ((b.t - a.t) / DAY > 366) return errors.push('line ' + (i + 1) + ': ranges can be at most one year');
        const label = m[3].trim();
        for (let t = a.t; t <= b.t; t += DAY) {
          const iso = new Date(t).toISOString().slice(0, 10);
          if (iso.slice(0, 4) === String(year)) map[iso] = label;
        }
      });
    return { map: map, errors: errors };
  }

  /** Replace characters the standard PDF fonts cannot draw (anything outside Latin-1 range) with "?". */
  function sanitize(s) {
    return String(s).replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, '?');
  }

  const SIZES = { a4: [595.28, 841.89], letter: [612, 792], a3: [841.89, 1190.55] };

  /**
   * Make a PDF. opts:
   *   kind: "month" (one page per month, from `month` for `months` months) | "year" (one-page year) | "week" (weekly planner pages)
   *   year, month (0-11), months (1-12, default 1 for "month"),
   *   weekStart (0|1), locale, pageSize ("a4"|"letter"|"a3"), landscape (bool), title (string),
   *   weekNumbers (bool), holidays (text), lines (bool; ruled lines on week pages), startIso/weeks for "week"
   */
  async function buildPdf(PDFLib, opts) {
    const o = Object.assign(
      {
        kind: 'month',
        month: 0,
        months: 1,
        weekStart: 1,
        locale: 'en',
        pageSize: 'a4',
        landscape: true,
        title: '',
        weekNumbers: true,
        holidays: '',
        weeks: 12,
      },
      opts,
    );
    if (!Number.isInteger(o.year) || o.year < 1900 || o.year > 2200) throw new Error('Year must be between 1900 and 2200.');
    if (!SIZES[o.pageSize]) throw new Error('Unknown page size.');
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    doc.setTitle(sanitize(o.title || 'Planner ' + o.year));
    doc.setCreator('Pocket Desk Tools');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const base = SIZES[o.pageSize];
    const W = o.landscape ? base[1] : base[0];
    const H = o.landscape ? base[0] : base[1];
    const nm = names(o.locale);
    const wdays = orderedWeekdays(o.locale, o.weekStart);
    const hol = parseHolidays(o.holidays, o.year);
    const grey = rgb(0.45, 0.45, 0.45);
    const line = rgb(0.75, 0.75, 0.78);
    const tint = rgb(0.94, 0.94, 0.96);
    const accent = rgb(0.15, 0.39, 0.92);
    const text = (page, s, x, y, size, f, color) =>
      page.drawText(sanitize(s), { x: x, y: y, size: size, font: f || font, color: color || rgb(0.1, 0.1, 0.12) });
    const fit = (s, f, size, max) => {
      let t = sanitize(s);
      while (t.length > 1 && f.widthOfTextAtSize(t, size) > max) t = t.slice(0, -1);
      return t;
    };

    function monthPage(y, m0) {
      const page = doc.addPage([W, H]);
      const margin = 36;
      const head = o.title ? sanitize(o.title) : '';
      text(page, nm.months[m0] + ' ' + y, margin, H - margin - 22, 26, bold);
      if (head) text(page, head, W - margin - bold.widthOfTextAtSize(head, 12), H - margin - 16, 12, font, grey);
      const weeks = monthMatrix(y, m0, o.weekStart);
      const top = H - margin - 52;
      const wnW = o.weekNumbers ? 22 : 0;
      const gridW = W - 2 * margin - wnW;
      const colW = gridW / 7;
      const headH = 18;
      const rowH = (top - headH - margin) / weeks.length;
      wdays.forEach((n, i) => text(page, n, margin + wnW + i * colW + 4, top - 13, 9, bold, grey));
      weeks.forEach(function (w, r) {
        const yTop = top - headH - r * rowH;
        if (o.weekNumbers) text(page, String(w[0].week), margin + 4, yTop - 12, 8, font, grey);
        w.forEach(function (c, i) {
          const x = margin + wnW + i * colW;
          const isWeekend = c.weekday === 0 || c.weekday === 6;
          if (c.inMonth && isWeekend) page.drawRectangle({ x: x, y: yTop - rowH, width: colW, height: rowH, color: tint });
          page.drawRectangle({ x: x, y: yTop - rowH, width: colW, height: rowH, borderColor: line, borderWidth: 0.6 });
          if (!c.inMonth) return;
          text(page, String(c.day), x + 5, yTop - 15, 12, bold);
          const label = hol.map[c.iso];
          if (label) text(page, fit(label, font, 7.5, colW - 10), x + 5, yTop - 27, 7.5, font, accent);
        });
      });
      return page;
    }

    function yearPage() {
      const page = doc.addPage([W, H]);
      const margin = 30;
      text(page, String(o.year), margin, H - margin - 20, 24, bold);
      if (o.title) text(page, o.title, W - margin - bold.widthOfTextAtSize(sanitize(o.title), 12), H - margin - 14, 12, font, grey);
      const cols = o.landscape ? 4 : 3;
      const rows = 12 / cols;
      const gap = 14;
      const top = H - margin - 40;
      const cw = (W - 2 * margin - gap * (cols - 1)) / cols;
      const ch = (top - margin - gap * (rows - 1)) / rows;
      for (let m = 0; m < 12; m++) {
        const x0 = margin + (m % cols) * (cw + gap);
        const y0 = top - Math.floor(m / cols) * (ch + gap);
        text(page, nm.months[m], x0, y0 - 12, 11, bold, accent);
        const cell = cw / 7;
        wdays.forEach((n, i) => text(page, n.slice(0, 2), x0 + i * cell + 2, y0 - 26, 6.5, font, grey));
        const weeks = monthMatrix(o.year, m, o.weekStart);
        const rowH = Math.min(12, (ch - 34) / 6);
        weeks.forEach((w, r) =>
          w.forEach((c, i) => {
            if (!c.inMonth) return;
            const hl = hol.map[c.iso];
            const x = x0 + i * cell;
            const y = y0 - 38 - r * rowH;
            if (hl) page.drawRectangle({ x: x, y: y - 2, width: cell - 1, height: rowH - 1, color: rgb(0.86, 0.91, 1) });
            text(
              page,
              String(c.day),
              x + 2,
              y,
              7.5,
              c.weekday === 0 || c.weekday === 6 ? bold : font,
              c.weekday === 0 || c.weekday === 6 ? grey : undefined,
            );
          }),
        );
      }
      const list = Object.keys(hol.map).sort();
      if (list.length) {
        const s =
          'Marked: ' +
          list
            .slice(0, 8)
            .map((k) => k.slice(5) + ' ' + hol.map[k])
            .join('; ') +
          (list.length > 8 ? '; ...' : '');
        text(page, fit(s, font, 7, W - 2 * margin), margin, margin - 14, 7, font, grey);
      }
    }

    function weekPages() {
      const start = o.startIso ? Date.parse(o.startIso + 'T00:00:00Z') : Date.UTC(o.year, 0, 1);
      if (!Number.isFinite(start)) throw new Error('Start date must look like 2026-10-19.');
      const dow = new Date(start).getUTCDay();
      const monday = start - ((dow - o.weekStart + 7) % 7) * DAY;
      const count = Math.max(1, Math.min(60, o.weeks));
      for (let w = 0; w < count; w++) {
        const page = doc.addPage([W, H]);
        const margin = 36;
        const first = new Date(monday + w * 7 * DAY);
        const last = new Date(monday + (w * 7 + 6) * DAY);
        const wk = isoWeek(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()).week;
        const fmt = (d) => d.getUTCDate() + ' ' + nm.months[d.getUTCMonth()].slice(0, 3);
        text(page, fmt(first) + ' - ' + fmt(last) + ' ' + last.getUTCFullYear(), margin, H - margin - 20, 20, bold);
        text(page, 'Week ' + wk + (o.title ? '  |  ' + o.title : ''), margin, H - margin - 38, 10, font, grey);
        const top = H - margin - 52;
        const cols = o.landscape ? 4 : 2;
        const rowsN = Math.ceil(8 / cols); // 7 days + one notes box
        const gw = (W - 2 * margin) / cols;
        const gh = (top - margin) / rowsN;
        for (let i = 0; i < 8; i++) {
          const x = margin + (i % cols) * gw;
          const yTop = top - Math.floor(i / cols) * gh;
          page.drawRectangle({ x: x, y: yTop - gh, width: gw, height: gh, borderColor: line, borderWidth: 0.6 });
          if (i === 7) {
            text(page, 'Notes', x + 6, yTop - 14, 10, bold, grey);
            continue;
          }
          const d = new Date(monday + (w * 7 + i) * DAY);
          const iso = d.toISOString().slice(0, 10);
          const holLabel = parseHolidays(o.holidays, d.getUTCFullYear()).map[iso];
          text(page, nm.weekdays[d.getUTCDay()] + ' ' + d.getUTCDate(), x + 6, yTop - 14, 10, bold);
          if (holLabel) text(page, fit(holLabel, font, 7.5, gw - 12), x + 6, yTop - 25, 7.5, font, accent);
          if (o.lines)
            for (let l = 0; l < 6; l++) {
              const ly = yTop - 40 - l * ((gh - 48) / 6);
              if (ly > yTop - gh + 6)
                page.drawLine({ start: { x: x + 6, y: ly }, end: { x: x + gw - 6, y: ly }, thickness: 0.4, color: line });
            }
        }
      }
    }

    if (o.kind === 'year') yearPage();
    else if (o.kind === 'week') weekPages();
    else {
      const n = Math.max(1, Math.min(12, o.months));
      for (let i = 0; i < n; i++) monthPage(o.year + Math.floor((o.month + i) / 12), (o.month + i) % 12);
    }
    return doc.save();
  }

  function fileName(opts) {
    const o = opts;
    const kind =
      o.kind === 'year'
        ? 'year-' + o.year
        : o.kind === 'week'
          ? 'weekly-' + (o.startIso || o.year)
          : 'calendar-' + o.year + (o.months === 12 ? '' : '-' + pad2(o.month + 1));
    return 'planner-' + kind + '.pdf';
  }

  return {
    names: names,
    orderedWeekdays: orderedWeekdays,
    isoWeek: isoWeek,
    daysInMonth: daysInMonth,
    monthMatrix: monthMatrix,
    parseHolidays: parseHolidays,
    sanitize: sanitize,
    buildPdf: buildPdf,
    fileName: fileName,
    isoOf: isoOf,
  };
});

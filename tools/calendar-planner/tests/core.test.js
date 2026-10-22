'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PDFLib = require('pdf-lib');
const cal = require('../js/core.js');

test('names: English and another locale', () => {
  const en = cal.names('en');
  assert.equal(en.months[0], 'January');
  assert.equal(en.months[11], 'December');
  assert.equal(en.weekdays[0], 'Sun');
  assert.equal(cal.names('de').months[2], 'März');
  assert.deepEqual(cal.orderedWeekdays('en', 1), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.equal(cal.orderedWeekdays('en', 0)[0], 'Sun');
});

test('isoWeek: known dates and year boundaries', () => {
  assert.deepEqual(cal.isoWeek(2026, 0, 1), { week: 1, year: 2026 }); // Thu
  assert.deepEqual(cal.isoWeek(2026, 9, 22), { week: 43, year: 2026 });
  assert.deepEqual(cal.isoWeek(2021, 0, 3), { week: 53, year: 2020 }); // Sunday belongs to the previous year's last week
  assert.deepEqual(cal.isoWeek(2024, 11, 30), { week: 1, year: 2025 });
  assert.deepEqual(cal.isoWeek(2020, 11, 31), { week: 53, year: 2020 });
});

test('daysInMonth incl. leap years', () => {
  assert.equal(cal.daysInMonth(2024, 1), 29);
  assert.equal(cal.daysInMonth(2026, 1), 28);
  assert.equal(cal.daysInMonth(1900, 1), 28);
  assert.equal(cal.daysInMonth(2000, 1), 29);
  assert.equal(cal.daysInMonth(2026, 9), 31);
});

test('monthMatrix: October 2026 starts on Thursday', () => {
  const mon = cal.monthMatrix(2026, 9, 1);
  assert.equal(mon.length, 5);
  assert.ok(mon.every((w) => w.length === 7));
  assert.equal(mon[0][0].iso, '2026-09-28');
  assert.equal(mon[0][0].inMonth, false);
  assert.equal(mon[0][3].iso, '2026-10-01');
  assert.equal(mon[0][3].inMonth, true);
  assert.equal(mon[4][6].iso, '2026-11-01');
  const sun = cal.monthMatrix(2026, 9, 0);
  assert.equal(sun[0][0].iso, '2026-09-27');
  assert.equal(sun[0][4].iso, '2026-10-01');
  assert.equal(sun[0][0].weekday, 0);
  assert.equal(mon[0][3].week, 40);
});

test('monthMatrix: Feb 2027 fits exactly 4 weeks (Mon start); a 6-week month exists', () => {
  assert.equal(cal.monthMatrix(2027, 1, 1).length, 4);
  assert.equal(cal.monthMatrix(2026, 7, 1).length, 6, 'August 2026 starts on Saturday');
});

test('monthMatrix: every day of the month appears exactly once as inMonth', () => {
  for (let m = 0; m < 12; m++) {
    const days = cal
      .monthMatrix(2028, m, 1)
      .flat()
      .filter((c) => c.inMonth)
      .map((c) => c.day);
    assert.deepEqual(
      days,
      Array.from({ length: cal.daysInMonth(2028, m) }, (_, i) => i + 1),
    );
  }
});

test('parseHolidays: dates, yearly, ranges, errors, other years ignored', () => {
  const text = [
    '# comment',
    '2026-12-25 Christmas',
    '01-01 New Year',
    '2026-08-10..2026-08-12 Office closed',
    '2025-05-05 Last year only',
    'garbage',
    '02-30 Nope',
    '2026-03-05..2026-03-01 Backwards',
  ].join('\n');
  const r = cal.parseHolidays(text, 2026);
  assert.equal(r.map['2026-12-25'], 'Christmas');
  assert.equal(r.map['2026-01-01'], 'New Year');
  assert.equal(r.map['2026-08-11'], 'Office closed');
  assert.equal(r.map['2025-05-05'], undefined);
  assert.equal(r.errors.length, 3);
  assert.match(r.errors[0], /line 6/);
  assert.match(r.errors[1], /does not exist/);
  assert.match(r.errors[2], /ends before/);
  assert.equal(cal.parseHolidays('01-01 New Year', 2030).map['2030-01-01'], 'New Year');
});

test('sanitize replaces characters outside Latin-1', () => {
  assert.equal(cal.sanitize('Café ☃ 日本'), 'Café ? ??');
});

async function pages(bytes) {
  const d = await PDFLib.PDFDocument.load(bytes);
  return d.getPageCount();
}

test('buildPdf: month, multi-month, year, week', async () => {
  const month = await cal.buildPdf(PDFLib, { kind: 'month', year: 2026, month: 9, holidays: '10-31 Halloween' });
  assert.equal(String.fromCharCode(...month.slice(0, 5)), '%PDF-');
  assert.equal(await pages(month), 1);
  assert.equal(await pages(await cal.buildPdf(PDFLib, { kind: 'month', year: 2026, month: 10, months: 4 })), 4, 'rolls into next year');
  assert.equal(await pages(await cal.buildPdf(PDFLib, { kind: 'year', year: 2026, landscape: false, title: 'Team 2026' })), 1);
  assert.equal(await pages(await cal.buildPdf(PDFLib, { kind: 'week', year: 2026, startIso: '2026-10-22', weeks: 5, lines: true })), 5);
});

test('buildPdf: page size and orientation', async () => {
  const d = await PDFLib.PDFDocument.load(await cal.buildPdf(PDFLib, { year: 2026, pageSize: 'letter', landscape: true }));
  const { width, height } = d.getPage(0).getSize();
  assert.equal(Math.round(width), 792);
  assert.equal(Math.round(height), 612);
});

test('buildPdf: validation and non-Latin text does not crash', async () => {
  await assert.rejects(() => cal.buildPdf(PDFLib, { year: 1800 }), /Year must be/);
  await assert.rejects(() => cal.buildPdf(PDFLib, { year: 2026, pageSize: 'x' }), /page size/);
  await assert.rejects(() => cal.buildPdf(PDFLib, { year: 2026, kind: 'week', startIso: 'nope' }), /Start date/);
  const bytes = await cal.buildPdf(PDFLib, { year: 2026, title: '日本', holidays: '01-01 ☃ snow' });
  assert.ok(bytes.length > 500);
});

test('fileName', () => {
  assert.equal(cal.fileName({ kind: 'year', year: 2026 }), 'planner-year-2026.pdf');
  assert.equal(cal.fileName({ kind: 'month', year: 2026, month: 9, months: 1 }), 'planner-calendar-2026-10.pdf');
  assert.equal(cal.fileName({ kind: 'month', year: 2026, month: 0, months: 12 }), 'planner-calendar-2026.pdf');
  assert.equal(cal.fileName({ kind: 'week', year: 2026, startIso: '2026-10-19' }), 'planner-weekly-2026-10-19.pdf');
});

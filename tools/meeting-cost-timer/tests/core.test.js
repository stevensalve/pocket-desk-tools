'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../js/core.js');

test('parseAmount accepts plain numbers and commas only', () => {
  assert.equal(c.parseAmount('85'), 85);
  assert.equal(c.parseAmount(' 1,250.50 '), 1250.5);
  assert.equal(c.parseAmount('0'), 0);
  ['', 'abc', '-5', '1e3', '12.', '$5', null, undefined, '99999999'].forEach((x) => assert.equal(c.parseAmount(x), null, String(x)));
});

test('hourlyCost and headcount ignore bad rows', () => {
  const groups = [
    { count: 3, rate: 80 },
    { count: 1, rate: 150 },
    { count: 0, rate: 999 },
    { count: -2, rate: 50 },
    { count: 2, rate: -1 },
    { count: 'x', rate: 10 },
    { count: 2.9, rate: 10 },
  ];
  assert.equal(c.hourlyCost(groups), 3 * 80 + 150 + 2 * 10);
  assert.equal(c.headcount(groups), 3 + 1 + 2 + 2 + 0);
  assert.equal(c.hourlyCost(null), 0);
});

test('costFor scales with time and never goes negative', () => {
  assert.equal(c.costFor(120, 3600000), 120);
  assert.equal(c.costFor(120, 1800000), 60);
  assert.equal(c.costFor(120, -5), 0);
});

test('timer: start, pause, resume, elapsed from timestamps', () => {
  let s = c.idle();
  assert.equal(c.elapsed(s, 5000), 0);
  assert.equal(c.isRunning(s), false);
  s = c.start(1000);
  assert.equal(c.isRunning(s), true);
  assert.equal(c.elapsed(s, 4000), 3000);
  s = c.pause(s, 4000);
  assert.equal(c.isRunning(s), false);
  assert.equal(c.elapsed(s, 99999), 3000, 'paused: frozen');
  assert.equal(c.pause(s, 8000).pausedAt, 4000, 'pausing twice changes nothing');
  s = c.resume(s, 10000);
  assert.equal(s.pausedTotal, 6000);
  assert.equal(c.elapsed(s, 12000), 5000, '3s before pause + 2s after');
  assert.equal(c.resume(s, 13000), s, 'resume when running is a no-op');
  assert.deepEqual(c.pause(c.idle(), 5), c.idle(), 'pause before start is a no-op');
});

test('elapsed survives a long gap between ticks (sleep/throttle)', () => {
  const s = c.start(0);
  assert.equal(c.elapsed(s, 2 * 3600000), 7200000);
});

test('formatDuration', () => {
  assert.equal(c.formatDuration(0), '0:00');
  assert.equal(c.formatDuration(125000), '2:05');
  assert.equal(c.formatDuration(3725000), '1:02:05');
  assert.equal(c.formatDuration(-10), '0:00');
  assert.equal(c.formatDuration(999), '0:00');
});

test('formatMoney', () => {
  assert.equal(c.formatMoney(12.345, '$'), '$12.35');
  assert.equal(c.formatMoney(1234.5, '€'), '€1,235');
  assert.equal(c.formatMoney(0), '0.00');
  assert.equal(c.formatMoney(-4, '$'), '$0.00');
});

test('annualCost for each frequency and unknown frequency', () => {
  assert.equal(c.annualCost(100, 60, 'weekly'), 5200);
  assert.equal(c.annualCost(100, 30, 'daily'), 100 * 0.5 * 250);
  assert.equal(c.annualCost(100, 60, 'once'), 100);
  assert.equal(c.annualCost(100, 60, 'monthly'), 1200);
  assert.equal(c.annualCost(100, 60, 'biweekly'), 2600);
  assert.equal(c.annualCost(100, 60, 'quarterly'), 400);
  assert.throws(() => c.annualCost(1, 1, 'hourly'), /Unknown frequency/);
});

test('perspective wording', () => {
  assert.equal(c.perspective(5200, 100), 'That is about 7 person-days of time per year, at the average rate.');
  assert.match(c.perspective(300, 100), /3 person-hours/);
  assert.match(c.perspective(100, 100), /1 person-hour of/);
  assert.equal(c.perspective(5, 100), '');
  assert.equal(c.perspective(500, 0), '');
});

test('log entries are validated; loadLog never throws', () => {
  const e = c.makeLogEntry({ title: '  Weekly sync  ', date: '2026-10-22', ms: 1800000.4, cost: 123.456, people: 4.9, symbol: '$' });
  assert.deepEqual(e, { title: 'Weekly sync', date: '2026-10-22', ms: 1800000, cost: 123.46, people: 4, symbol: '$' });
  assert.equal(c.makeLogEntry({ ms: 0, cost: 0 }).title, 'Meeting');
  assert.throws(() => c.makeLogEntry({ ms: -1, cost: 0 }), /Invalid/);
  assert.throws(() => c.makeLogEntry({ ms: 1, cost: NaN }), /Invalid/);
  assert.deepEqual(c.loadLog('garbage'), []);
  assert.deepEqual(c.loadLog('{"a":1}'), []);
  const mixed = c.loadLog(JSON.stringify([{ title: 'ok', ms: 1, cost: 1 }, { ms: 'x' }, null]));
  assert.equal(mixed.length, 1);
  assert.equal(c.loadLog(JSON.stringify(Array.from({ length: 500 }, () => ({ ms: 1, cost: 1 })))).length, 200);
});

test('logCsv: header, BOM, quoting, formula safety', () => {
  const csv = c.logCsv([
    c.makeLogEntry({ title: '=HYPERLINK("x")', date: '2026-10-22', ms: 600000, cost: 50, people: 3, symbol: '$' }),
    c.makeLogEntry({ title: 'A, B', ms: 60000, cost: 1, people: 1 }),
  ]);
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'Title,Date,Minutes,People,Cost,Currency');
  assert.equal(lines[1], '"\'=HYPERLINK(""x"")",2026-10-22,10.0,3,50.00,$');
  assert.equal(lines[2], '"A, B",,1.0,1,1.00,');
});

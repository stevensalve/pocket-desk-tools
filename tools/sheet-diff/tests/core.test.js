'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../js/core.js');

const A = d.toRecords([
  ['ID', 'Name', 'Amount'],
  ['1', 'Ann', '10'],
  ['2', 'Bob', '20'],
  ['3', 'Cy', '30'],
]);
const B = d.toRecords([
  ['ID', 'Name', 'Amount'],
  ['1', 'Ann', '10'],
  ['2', 'Bobby', '20'],
  ['4', 'Di', '40'],
]);

test('toRecords: headers, blank/duplicate headers, row numbers, empty rows', () => {
  const t = d.toRecords([['a', '', 'A'], [1, 2, 3], ['', '', ''], [4]]);
  assert.deepEqual(t.headers, ['a', 'Column 2', 'A (2)']);
  assert.equal(t.records.length, 2);
  assert.equal(t.records[0].__row, 2);
  assert.equal(t.records[1].__row, 4, 'row numbers count skipped blank rows');
  assert.equal(t.records[0].a, '1');
  assert.equal(t.records[1]['Column 2'], '');
  assert.deepEqual(d.toRecords([]), { headers: [], records: [] });
});

test('sameValue: trim, whitespace, case, numbers, tolerance', () => {
  assert.equal(d.sameValue(' a  b ', 'a b'), true);
  assert.equal(d.sameValue('A', 'a'), false);
  assert.equal(d.sameValue('A', 'a', { ignoreCase: true }), true);
  assert.equal(d.sameValue('1,000', '1000'), true);
  assert.equal(d.sameValue('1.50', '1.5'), true);
  assert.equal(d.sameValue('10.001', '10', { tolerance: 0.01 }), true);
  assert.equal(d.sameValue('10.1', '10', { tolerance: 0.01 }), false);
  assert.equal(d.sameValue('007', '7'), true, 'numbers compare numerically');
  assert.equal(d.sameValue(null, ''), true);
  assert.equal(d.sameValue(' x', 'x', { trim: false }), false);
});

test('suggestKey picks the first all-unique column', () => {
  assert.equal(d.suggestKey(A), 'ID');
  assert.equal(
    d.suggestKey(
      d.toRecords([
        ['x', 'y'],
        ['1', 'a'],
        ['1', 'b'],
      ]),
    ),
    'y',
  );
  assert.equal(d.suggestKey(d.toRecords([['x'], ['1'], ['1']])), '');
  assert.equal(
    d.suggestKey(
      d.toRecords([
        ['x', 'y'],
        ['1', 'a'],
        ['', 'a'],
      ]),
    ),
    '',
  );
});

test('diff by key: changed, added, removed, same', () => {
  const r = d.diffTables(A, B, { key: 'ID' });
  assert.deepEqual(r.summary, { same: 1, changed: 1, added: 1, removed: 1, cells: 1 });
  const byKey = Object.fromEntries(r.rows.map((x) => [x.key, x]));
  assert.equal(byKey['1'].status, 'same');
  assert.equal(byKey['2'].status, 'changed');
  assert.deepEqual(byKey['2'].changed, ['Name']);
  assert.equal(byKey['3'].status, 'removed');
  assert.equal(byKey['4'].status, 'added');
  assert.equal(byKey['2'].rowA, 3);
  assert.equal(byKey['4'].rowB, 4);
});

test('diff by key is not fooled by reordered rows or columns', () => {
  const B2 = d.toRecords([
    ['Amount', 'ID', 'Name'],
    ['30', '3', 'Cy'],
    ['20', '2', 'Bob'],
    ['10', '1', 'Ann'],
  ]);
  const r = d.diffTables(A, B2, { key: 'ID' });
  assert.deepEqual(r.summary, { same: 3, changed: 0, added: 0, removed: 0, cells: 0 });
  assert.match(d.summaryText(r.summary), /match/);
});

test('column headers match case-insensitively and extra columns are reported', () => {
  const X = d.toRecords([
    ['id', 'NAME', 'Note'],
    ['1', 'Ann', 'hi'],
  ]);
  const Y = d.toRecords([
    ['ID', 'Name', 'Extra'],
    ['1', 'Ann', 'yo'],
  ]);
  const r = d.diffTables(X, Y, { key: 'id' });
  assert.deepEqual(r.onlyInA, ['Note']);
  assert.deepEqual(r.onlyInB, ['Extra']);
  assert.deepEqual(r.columns, ['id', 'NAME', 'Note', 'Extra']);
  assert.equal(r.summary.same, 1, 'unshared columns are not counted as cell changes');
});

test('row-by-row mode (no key)', () => {
  const r = d.diffTables(A, B, {});
  assert.deepEqual(
    r.rows.map((x) => x.status),
    ['same', 'changed', 'changed'],
  );
  assert.deepEqual(r.rows[2].changed, ['ID', 'Name', 'Amount']);
  const longer = d.toRecords([
    ['ID', 'Name', 'Amount'],
    ['1', 'Ann', '10'],
  ]);
  const r2 = d.diffTables(A, longer, {});
  assert.deepEqual(
    r2.rows.map((x) => x.status),
    ['same', 'removed', 'removed'],
  );
  assert.deepEqual(
    d.diffTables(longer, A, {}).rows.map((x) => x.status),
    ['same', 'added', 'added'],
  );
});

test('duplicate keys are paired in order', () => {
  const P = d.toRecords([
    ['k', 'v'],
    ['a', '1'],
    ['a', '2'],
  ]);
  const Q = d.toRecords([
    ['k', 'v'],
    ['a', '1'],
    ['a', '3'],
    ['a', '4'],
  ]);
  const r = d.diffTables(P, Q, { key: 'k' });
  assert.deepEqual(
    r.rows.map((x) => x.status),
    ['same', 'changed', 'added'],
  );
});

test('ignoreCase and tolerance flow through the diff', () => {
  const P = d.toRecords([
    ['k', 'v', 'n'],
    ['A', 'Hello', '1.000'],
  ]);
  const Q = d.toRecords([
    ['k', 'v', 'n'],
    ['a', 'hello', '1.004'],
  ]);
  assert.equal(d.diffTables(P, Q, { key: 'k' }).summary.added, 1, 'case-sensitive key differs');
  const r = d.diffTables(P, Q, { key: 'k', ignoreCase: true, tolerance: 0.01 });
  assert.deepEqual(r.summary, { same: 1, changed: 0, added: 0, removed: 0, cells: 0 });
});

test('multi-column key', () => {
  const P = d.toRecords([
    ['a', 'b', 'v'],
    ['1', 'x', 'p'],
    ['1', 'y', 'q'],
  ]);
  const Q = d.toRecords([
    ['a', 'b', 'v'],
    ['1', 'y', 'q'],
    ['1', 'x', 'CHANGED'],
  ]);
  const r = d.diffTables(P, Q, { key: ['a', 'b'] });
  assert.deepEqual(
    r.rows.map((x) => x.status),
    ['changed', 'same'],
  );
  assert.equal(r.rows[0].key, '1 / x');
});

test('a missing key column is a clear error', () => {
  assert.throws(() => d.diffTables(A, B, { key: 'Nope' }), /must exist in both files/);
});

test('toCsv: one line per difference, BOM, quoting, formula safety', () => {
  const r = d.diffTables(A, B, { key: 'ID' });
  const csv = d.toCsv(r);
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'Status,Key,Row in A,Row in B,Column,Value in A,Value in B');
  assert.equal(lines.length, 4);
  assert.ok(lines.includes('changed,2,3,3,Name,Bob,Bobby'));
  assert.ok(lines.includes('removed,3,4,,,,'));
  const P = d.toRecords([
    ['k', 'v'],
    ['1', '=1+1'],
  ]);
  const Q = d.toRecords([
    ['k', 'v'],
    ['1', 'a,"b"'],
  ]);
  const c2 = d.toCsv(d.diffTables(P, Q, { key: 'k' }));
  assert.match(c2, /'=1\+1,"a,""b"""/);
});

test('summaryText wording', () => {
  assert.equal(d.summaryText({ same: 5, changed: 1, added: 0, removed: 2, cells: 1 }), '1 row changed (1 cell), 2 removed; 5 unchanged.');
  assert.equal(d.summaryText({ same: 2, changed: 3, added: 1, removed: 0, cells: 7 }), '3 rows changed (7 cells), 1 added; 2 unchanged.');
});

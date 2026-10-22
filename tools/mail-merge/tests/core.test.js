'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fflate = require('fflate');
const { PDFDocument } = require('pdf-lib');
const core = require('../js/core.js');

test('buildRecords: headers made unique, empty rows dropped, values as text', () => {
  const r = core.buildRecords([['Name', '', 'name'], ['Ann', 5, 'x'], ['', '', ''], ['Bob']]);
  assert.deepEqual(r.headers, ['Name', 'Column 2', 'name (2)']);
  assert.deepEqual(r.records, [
    { Name: 'Ann', 'Column 2': '5', 'name (2)': 'x' },
    { Name: 'Bob', 'Column 2': '', 'name (2)': '' },
  ]);
  assert.deepEqual(core.buildRecords([]), { headers: [], records: [] });
});

test('fieldsIn lists unique fields in order, ignoring spaces and case', () => {
  assert.deepEqual(core.fieldsIn('Hi {{ Name }}, {{name}} from {{City|here}} {{Name}}'), ['Name', 'City']);
  assert.deepEqual(core.fieldsIn('no fields {single} braces'), []);
});

test('render: simple fill, case and spacing insensitive', () => {
  const r = core.render('Dear {{ first   NAME }}, welcome to {{City}}.', { 'First Name': 'Ann', city: 'Pune' });
  assert.equal(r.text, 'Dear Ann, welcome to Pune.');
  assert.deepEqual([r.missing, r.empty], [[], []]);
});

test('render: fallback only when the cell is empty', () => {
  assert.equal(core.render('Hi {{Name|there}}!', { Name: '' }).text, 'Hi there!');
  assert.equal(core.render('Hi {{Name|there}}!', { Name: '  ' }).text, 'Hi there!');
  assert.equal(core.render('Hi {{Name|there}}!', { Name: 'Ann' }).text, 'Hi Ann!');
  assert.equal(core.render('Hi {{Name| }}!', { Name: '' }).text, 'Hi  !', 'a space fallback is kept');
});

test('render: reports unknown and empty fields instead of hiding them', () => {
  const r = core.render('{{Name}} {{Nmae}} {{Nmae}} {{City}}', { Name: 'Ann', City: '' });
  assert.equal(r.text, 'Ann {{Nmae}} {{Nmae}} ');
  assert.deepEqual(r.missing, ['Nmae']);
  assert.deepEqual(r.empty, ['City']);
});

test('render: built-ins {{today}} and {{row}}', () => {
  assert.equal(core.render('{{today}} / #{{row}}', {}, { today: '22 Oct 2026', row: 3 }).text, '22 Oct 2026 / #3');
});

test('render: values containing braces or $ are inserted literally', () => {
  assert.equal(core.render('{{A}}', { A: '$& {{B}} $1' }).text, '$& {{B}} $1');
});

test('unknownFields flags typos against the real columns', () => {
  assert.deepEqual(core.unknownFields('{{Name}} {{Emial}} {{today}}', ['Name', 'Email']), ['Emial']);
});

test('fileNames: safe, unique, zero-padded default', () => {
  const recs = [{ Name: 'Ann/Lee' }, { Name: 'Ann/Lee' }, { Name: '' }];
  assert.deepEqual(core.fileNames(recs, '{{Name}}'), ['Ann_Lee', 'Ann_Lee-2', 'letter-3']);
  assert.deepEqual(core.fileNames([{}, {}], ''), ['letter-1', 'letter-2']);
  assert.deepEqual(core.fileNames(new Array(12).fill({}), 'x-{{row}}').slice(0, 2), ['x-01', 'x-02']);
});

test('emailCsv quotes properly and starts with a BOM', () => {
  const csv = core.emailCsv([{ to: 'a@b.co', subject: 'Hi, "you"', body: 'line1\nline2' }]);
  assert.equal(csv, '﻿To,Subject,Body\r\na@b.co,"Hi, ""you""","line1\nline2"');
});

test('makeZip round-trips file contents', () => {
  const zip = core.makeZip(fflate, { 'a.txt': fflate.strToU8('hello'), 'b.txt': fflate.strToU8('world') });
  const back = fflate.unzipSync(zip);
  assert.equal(fflate.strFromU8(back['a.txt']), 'hello');
  assert.deepEqual(Object.keys(back).sort(), ['a.txt', 'b.txt']);
});

test('buildPdf: every letter starts a new page; long letters continue', async () => {
  const short = await PDFDocument.load(await core.buildPdf(['one', 'two', 'three']));
  assert.equal(short.getPageCount(), 3);
  const long = await PDFDocument.load(await core.buildPdf(['para '.repeat(900), 'short']));
  assert.ok(long.getPageCount() >= 3);
});

test('buildPdf validates and copes with unsupported characters', async () => {
  await assert.rejects(() => core.buildPdf([]), /nothing to print/);
  await assert.rejects(() => core.buildPdf(['x'], { fontSize: 3 }), /between 7 and 24/);
  const doc = await PDFDocument.load(await core.buildPdf(['Price ₹500 中'], { pageSize: 'letter', font: 'times' }));
  assert.equal(Math.round(doc.getPage(0).getWidth()), 612);
});

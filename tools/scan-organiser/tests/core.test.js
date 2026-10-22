'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PDFLib = require('pdf-lib');
const fflate = require('fflate');
const sc = require('../js/core.js');

const px = (img, x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
function set(img, x, y, rgb) {
  const i = (y * img.width + x) * 4;
  img.data[i] = rgb[0];
  img.data[i + 1] = rgb[1];
  img.data[i + 2] = rgb[2];
}

test('grayscale uses perceptual weights and keeps alpha', () => {
  const img = sc.makeImage(2, 1, [0, 0, 0]);
  set(img, 0, 0, [255, 0, 0]);
  set(img, 1, 0, [0, 255, 0]);
  const g = sc.grayscale(img);
  assert.deepEqual(px(g, 0, 0), [76, 76, 76, 255]);
  assert.deepEqual(px(g, 1, 0), [150, 150, 150, 255]);
  assert.deepEqual(px(img, 0, 0), [255, 0, 0, 255], 'input is not modified');
});

test('autoContrast stretches a dull image to the full range', () => {
  const img = sc.makeImage(10, 1, [100, 100, 100]);
  for (let x = 0; x < 10; x++) set(img, x, 0, [100 + x * 5, 100 + x * 5, 100 + x * 5]);
  const out = sc.autoContrast(img, 0);
  assert.equal(px(out, 0, 0)[0], 0);
  assert.equal(px(out, 9, 0)[0], 255);
  assert.ok(px(out, 5, 0)[0] > 100 && px(out, 5, 0)[0] < 160);
  assert.throws(() => sc.autoContrast(img, 0.7), /between 0 and 0.5/);
});

test('autoContrast leaves a flat image alone', () => {
  const img = sc.makeImage(4, 4, [90, 90, 90]);
  assert.deepEqual(px(sc.autoContrast(img), 0, 0), [90, 90, 90, 255]);
});

test('otsuThreshold separates two clusters', () => {
  const hist = new Array(256).fill(0);
  hist[40] = 500;
  hist[200] = 500;
  const t = sc.otsuThreshold(hist);
  assert.ok(t >= 40 && t < 200, 'threshold ' + t);
  assert.equal(sc.otsuThreshold(new Array(256).fill(0)), 128);
});

test('blackAndWhite turns text-on-paper into pure black and white', () => {
  const img = sc.makeImage(4, 1, [230, 230, 220]);
  set(img, 1, 0, [30, 30, 40]);
  const out = sc.blackAndWhite(img);
  assert.deepEqual(px(out, 0, 0), [255, 255, 255, 255]);
  assert.deepEqual(px(out, 1, 0), [0, 0, 0, 255]);
  assert.deepEqual(px(sc.blackAndWhite(img, 250), 0, 0), [0, 0, 0, 255], 'explicit threshold');
});

test('adjust: brightness and contrast move values the right way', () => {
  const img = sc.makeImage(1, 1, [100, 100, 100]);
  assert.ok(px(sc.adjust(img, 20, 0), 0, 0)[0] > 100);
  assert.ok(px(sc.adjust(img, -20, 0), 0, 0)[0] < 100);
  assert.ok(px(sc.adjust(img, 0, 50), 0, 0)[0] < 100, 'contrast pushes darks darker');
  assert.deepEqual(px(sc.adjust(img, 0, 0), 0, 0), [100, 100, 100, 255]);
});

test('contentBounds finds a page on a dark desk', () => {
  const img = sc.makeImage(100, 80, [20, 20, 20]);
  for (let y = 20; y < 60; y++) for (let x = 30; x < 80; x++) set(img, x, y, [240, 240, 240]);
  const b = sc.contentBounds(img, 40, 0);
  assert.deepEqual(b, { x: 30, y: 20, width: 50, height: 40 });
  const padded = sc.contentBounds(img, 40, 5);
  assert.deepEqual(padded, { x: 25, y: 15, width: 60, height: 50 });
});

test('contentBounds: blank image returns everything; padding is clamped', () => {
  assert.deepEqual(sc.contentBounds(sc.makeImage(10, 8, [255, 255, 255])), { x: 0, y: 0, width: 10, height: 8 });
  const img = sc.makeImage(10, 10, [0, 0, 0]);
  set(img, 0, 0, [255, 255, 255]);
  assert.deepEqual(sc.contentBounds(img, 40, 50).x, 0);
});

test('crop copies the right pixels and validates', () => {
  const img = sc.makeImage(4, 3, [0, 0, 0]);
  set(img, 2, 1, [9, 8, 7]);
  const c = sc.crop(img, { x: 1, y: 1, width: 3, height: 2 });
  assert.equal(c.width, 3);
  assert.equal(c.height, 2);
  assert.deepEqual(px(c, 1, 0), [9, 8, 7, 255]);
  assert.equal(sc.crop(img, { x: 2, y: 2, width: 99, height: 99 }).width, 2, 'clamped to the image');
  assert.throws(() => sc.crop(img, { x: 10, y: 0, width: 2, height: 2 }), /empty/);
});

test('rotate: 90, 180, 270, negative and 360', () => {
  const img = sc.makeImage(3, 2, [0, 0, 0]);
  set(img, 0, 0, [1, 0, 0]); // top-left marker
  const cw = sc.rotate(img, 1);
  assert.equal(cw.width, 2);
  assert.equal(cw.height, 3);
  assert.deepEqual(px(cw, 1, 0).slice(0, 3), [1, 0, 0], 'top-left goes to top-right');
  const half = sc.rotate(img, 2);
  assert.deepEqual(px(half, 2, 1).slice(0, 3), [1, 0, 0]);
  const ccw = sc.rotate(img, -1);
  assert.deepEqual(px(ccw, 0, 2).slice(0, 3), [1, 0, 0], 'top-left goes to bottom-left');
  assert.deepEqual(sc.rotate(img, 3).data, ccw.data);
  assert.deepEqual(sc.rotate(sc.rotate(img, 1), 3).data, img.data);
  assert.deepEqual(sc.rotate(img, 4).data, img.data);
});

test('downscale keeps aspect ratio, never enlarges, averages colours', () => {
  const img = sc.makeImage(100, 50, [10, 20, 30]);
  const d = sc.downscale(img, 20);
  assert.equal(d.width, 20);
  assert.equal(d.height, 10);
  assert.deepEqual(px(d, 3, 3), [10, 20, 30, 255]);
  assert.equal(sc.downscale(img, 500).width, 100);
  const checker = sc.makeImage(2, 2, [0, 0, 0]);
  set(checker, 0, 0, [200, 200, 200]);
  assert.equal(px(sc.downscale(checker, 1), 0, 0)[0], 50);
});

test('applyFilter: names and default', () => {
  const img = sc.makeImage(4, 1, [200, 150, 100]);
  set(img, 0, 0, [20, 20, 20]);
  const bw = sc.applyFilter(img, 'bw');
  bw.data.forEach((v, i) => i % 4 !== 3 && assert.ok(v === 0 || v === 255));
  const g = sc.applyFilter(img, 'gray');
  assert.equal(px(g, 1, 0)[0], px(g, 1, 0)[1]);
  assert.deepEqual(sc.applyFilter(img, 'none').data, img.data);
});

test('move reorders without mutating', () => {
  const a = ['a', 'b', 'c', 'd'];
  assert.deepEqual(sc.move(a, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(sc.move(a, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(sc.move(a, 9, 0), a);
  assert.deepEqual(a, ['a', 'b', 'c', 'd']);
});

test('pageNames pads numbers, replaces tokens and unsafe characters', () => {
  assert.deepEqual(sc.pageNames('scan-{n}', 3, 'jpg'), ['scan-1.jpg', 'scan-2.jpg', 'scan-3.jpg']);
  assert.equal(sc.pageNames('p{n}', 12, 'png')[0], 'p01.png');
  assert.equal(sc.pageNames('Invoice {date}/{n}', 1, 'jpg', '2026-10-22')[0], 'Invoice 2026-10-22_1.jpg');
  assert.equal(sc.pageNames('  ', 1, 'jpg')[0], 'scan-1.jpg');
});

// A tiny valid PNG (1x1 red) for PDF tests.
const PNG = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'),
);

test('buildPdf: fit, A4 orientation per page, validation', async () => {
  const pages = [
    { bytes: PNG, type: 'png', width: 200, height: 300 },
    { bytes: PNG, type: 'png', width: 400, height: 200 },
  ];
  const fit = await PDFLib.PDFDocument.load(await sc.buildPdf(PDFLib, pages, { pageSize: 'fit' }));
  assert.equal(fit.getPageCount(), 2);
  assert.deepEqual(fit.getPage(0).getSize(), { width: 200, height: 300 });
  const a4 = await PDFLib.PDFDocument.load(await sc.buildPdf(PDFLib, pages, { pageSize: 'a4' }));
  const s0 = a4.getPage(0).getSize();
  const s1 = a4.getPage(1).getSize();
  assert.ok(s0.height > s0.width, 'portrait image -> portrait page');
  assert.ok(s1.width > s1.height, 'landscape image -> landscape page');
  await assert.rejects(() => sc.buildPdf(PDFLib, [], {}), /at least one page/);
  await assert.rejects(() => sc.buildPdf(PDFLib, pages, { pageSize: 'huge' }), /Unknown page size/);
});

test('makeZip round-trips file contents', () => {
  const zip = sc.makeZip(fflate, [
    { name: 'a.jpg', bytes: Uint8Array.from([1, 2, 3]) },
    { name: 'b.jpg', bytes: Uint8Array.from([4, 5]) },
  ]);
  const back = fflate.unzipSync(zip);
  assert.deepEqual(Object.keys(back).sort(), ['a.jpg', 'b.jpg']);
  assert.deepEqual(Array.from(back['a.jpg']), [1, 2, 3]);
});

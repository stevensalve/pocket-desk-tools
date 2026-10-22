'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, PDFName, degrees } = require('pdf-lib');
const core = require('../js/core.js');

const PNG_1X1 = new Uint8Array(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
);
const info = (rotation) => ({ x0: 0, y0: 0, width: 600, height: 800, rotation });

test('parsePages: sorted, unique, open ranges, errors', () => {
  assert.deepEqual(core.parsePages('all', 3), [0, 1, 2]);
  assert.deepEqual(core.parsePages('3, 1-2, 2', 5), [0, 1, 2]);
  assert.deepEqual(core.parsePages('4-', 6), [3, 4, 5]);
  assert.throws(() => core.parsePages('9', 3), /out of range/);
  assert.throws(() => core.parsePages('x', 3), /Cannot understand/);
});

test('rectangles: normalize, clamp, outward pixel rounding, cleaning', () => {
  assert.deepEqual(core.normalizeRect({ x: 50, y: 40 }, { x: 10, y: 90 }), { x: 10, y: 40, w: 40, h: 50 });
  assert.deepEqual(core.clampRect({ x: -10, y: 790, w: 50, h: 50 }, 600, 800), { x: 0, y: 790, w: 40, h: 10 });
  const px = core.toPixels({ x: 10.2, y: 20.7, w: 30.1, h: 5.5 }, 2);
  assert.ok(px.x <= 20.4 && px.x + px.w >= 2 * 40.3, 'covers the full width');
  assert.ok(px.y <= 41.4 && px.y + px.h >= 2 * 26.2, 'covers the full height');
  const cleaned = core.cleanRects([
    { x: 1, y: 1, w: 1, h: 1 },
    { x: 5, y: 5, w: 20, h: 10 },
    { x: 5, y: 5, w: 20, h: 10 },
  ]);
  assert.equal(cleaned.length, 1);
});

test('findTextBoxes: slices a run by character position', () => {
  const run = { str: 'Call 555-1234 now', box: { x: 100, y: 200, w: 170, h: 12 }, axis: 'x', reverse: false };
  const [b] = core.findTextBoxes([run], '555-1234', { pad: 0 });
  assert.ok(Math.abs(b.x - (100 + 170 * (5 / 17))) < 1e-9);
  assert.ok(Math.abs(b.w - 170 * (8 / 17)) < 1e-9);
  assert.equal(b.h, 12);
});

test('findTextBoxes: whole run, padding, case, regex, vertical and reversed text', () => {
  const run = { str: 'Secret', box: { x: 10, y: 10, w: 60, h: 10 }, axis: 'x', reverse: false };
  assert.deepEqual(core.findTextBoxes([run], 'secret', { whole: true, pad: 2 })[0], { x: 8, y: 8, w: 64, h: 14 });
  assert.equal(core.findTextBoxes([run], 'secret', { matchCase: true }).length, 0);
  assert.equal(core.findTextBoxes([{ str: 'a1 b22', box: run.box, axis: 'x' }], '\\d+', { regex: true }).length, 2);
  const vertical = { str: 'ABCD', box: { x: 10, y: 100, w: 12, h: 40 }, axis: 'y', reverse: false };
  const [v] = core.findTextBoxes([vertical], 'CD', { pad: 0 });
  assert.deepEqual([v.x, v.y, v.w, v.h], [10, 120, 12, 20]);
  const rev = { str: 'ABCD', box: { x: 0, y: 0, w: 40, h: 10 }, axis: 'x', reverse: true };
  assert.equal(core.findTextBoxes([rev], 'AB', { pad: 0 })[0].x, 20, 'reversed text starts from the right');
  assert.throws(() => core.findTextBoxes([run], ''), /Type the text/);
  assert.throws(() => core.findTextBoxes([run], '(', { regex: true }), /not valid/);
});

test('displayToUser matches the Fill & Sign convention for all rotations', () => {
  assert.deepEqual(core.displayToUser(0, 0, info(0)), { x: 0, y: 800 });
  assert.deepEqual(core.displayToUser(0, 0, info(90)), { x: 0, y: 0 });
  assert.deepEqual(core.displayToUser(0, 0, info(180)), { x: 600, y: 0 });
  assert.deepEqual(core.displayToUser(0, 0, info(270)), { x: 600, y: 800 });
});

test('planWatermark: unrotated text is centred; rotation is added to the page rotation', () => {
  const p = core.planWatermark(info(0), 200, 40, 0);
  assert.equal(p.x, 200); // (600 - 200) / 2
  assert.equal(p.y, 400 - 14); // centre minus half the cap height
  assert.equal(p.rotate, 0);
  assert.equal(core.planWatermark(info(90), 200, 40, 45).rotate, 135);
});

test('planWatermark: the centre of the rotated text stays at the page centre', () => {
  for (const angle of [0, 30, 45, 90, -45]) {
    const w = 240;
    const size = 50;
    const p = core.planWatermark(info(0), w, size, angle);
    const th = (angle * Math.PI) / 180;
    const h = size * 0.7;
    const cx = p.x + (w / 2) * Math.cos(th) - (h / 2) * Math.sin(th);
    const cy = p.y + (w / 2) * Math.sin(th) + (h / 2) * Math.cos(th);
    assert.ok(Math.abs(cx - 300) < 1e-9 && Math.abs(cy - 400) < 1e-9, 'angle ' + angle);
  }
});

test('planPageNumber positions', () => {
  const bc = core.planPageNumber(info(0), 60, 10, 'bottom-center', 30);
  assert.equal(bc.x, 270);
  assert.equal(bc.y, 31.5); // baseline sits 0.85 * size below the top of a 10pt line placed 30pt from the bottom edge
  const tl = core.planPageNumber(info(0), 60, 10, 'top-left', 30);
  assert.equal(tl.x, 30);
  assert.ok(tl.y > 700, 'top of the page is high in PDF coordinates');
  const br = core.planPageNumber(info(0), 60, 10, 'bottom-right', 30);
  assert.equal(br.x, 510);
});

test('formatLabel', () => {
  assert.equal(core.formatLabel('Page {n} of {total}', 3, 12), 'Page 3 of 12');
  assert.equal(core.formatLabel('{n}', 7, 9), '7');
});

async function samplePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of ['SECRET page one', 'public page two', 'public page three'])
    doc.addPage([300, 400]).drawText(text, { x: 20, y: 300, size: 14, font });
  doc.setTitle('Confidential plan');
  doc.setAuthor('A. Person');
  return doc.save();
}

/** Number of fonts a page can use (0 means no selectable text can be drawn). */
const fontCount = (page) => {
  const res = page.node.Resources();
  const dict = res && res.lookup(PDFName.of('Font'));
  return dict ? dict.keys().length : 0;
};

test('redact: boxed pages become pictures (text gone); other pages stay as they were', async () => {
  const out = await PDFDocument.load(
    await core.redact(await samplePdf(), { 0: [{ x: 10, y: 10, w: 50, h: 20 }] }, async () => ({
      bytes: PNG_1X1,
      mime: 'image/png',
      widthPt: 300,
      heightPt: 400,
    })),
  );
  assert.equal(out.getPageCount(), 3);
  assert.equal(fontCount(out.getPage(0)), 0, 'redacted page has no fonts, so no selectable text');
  assert.equal(fontCount(out.getPage(1)), 1, 'untouched page still has its text');
  assert.equal(Math.round(out.getPage(0).getWidth()), 300);
  assert.equal(out.getTitle(), undefined, 'document properties are not carried over');
});

test('redact: requires at least one box and a readable PDF', async () => {
  await assert.rejects(async () => core.redact(await samplePdf(), {}, async () => ({})), /at least one box/);
  await assert.rejects(
    () => core.redact(new Uint8Array([1, 2, 3]), { 0: [{ x: 0, y: 0, w: 5, h: 5 }] }, async () => ({})),
    /could not be read/,
  );
});

test('stamp: watermark + page numbers keep the page count, honour page selection', async () => {
  const out = await core.stamp(await samplePdf(), {
    watermark: { text: 'DRAFT', size: 80, opacity: 0.2, angle: 45, color: 'red', pages: '1-2' },
    numbers: { format: 'Page {n} of {total}', position: 'bottom-center', size: 10, start: 1, pages: 'all' },
  });
  assert.equal((await PDFDocument.load(out)).getPageCount(), 3);
});

test('stamp: rotated pages and corner positions do not throw', async () => {
  const doc = await PDFDocument.create();
  for (const r of [0, 90, 180, 270]) doc.addPage([300, 400]).setRotation(degrees(r));
  for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center']) {
    await core.stamp(await doc.save(), { watermark: { text: 'COPY' }, numbers: { position } });
  }
});

test('stamp: validation, odd characters, and clearing document properties', async () => {
  await assert.rejects(async () => core.stamp(await samplePdf(), { watermark: { text: 'x', size: 2 } }), /between 8 and 300/);
  const cleared = await PDFDocument.load(await core.stamp(await samplePdf(), { watermark: { text: 'Café 中 ₹' }, clearInfo: true }));
  assert.ok(!cleared.getTitle());
  assert.ok(!cleared.getAuthor());
  const kept = await PDFDocument.load(await core.stamp(await samplePdf(), { numbers: {} }));
  assert.equal(kept.getTitle(), 'Confidential plan');
});

test('outputName', () => {
  assert.equal(core.outputName('Plan.PDF', 'redacted'), 'Plan-redacted.pdf');
});

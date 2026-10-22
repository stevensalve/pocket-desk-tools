/* Scan Organiser - user interface. Pixel work, ordering and file building live in core.js. */
(function () {
  'use strict';

  const { setStatus, bindDropzone, downloadBlob, el } = OT;
  const $ = (id) => document.getElementById(id);
  const WORK_MAX = 3200; // sources are kept at most this large to bound memory
  const THUMB = 360;
  const MAX_PAGES = 60;

  /** @type {{name:string, src:{data,width,height}, turns:number, filter:string, crop:boolean}[]} */
  let pages = [];

  async function decode(file) {
    const bitmap = await createImageBitmap(file);
    const k = Math.min(1, WORK_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * k));
    const h = Math.max(1, Math.round(bitmap.height * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; // transparent PNGs become white paper
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (bitmap.close) bitmap.close();
    const id = ctx.getImageData(0, 0, w, h);
    return { data: id.data, width: id.width, height: id.height };
  }

  /** Run a page through crop -> rotate -> filter at a given maximum size. */
  function process(page, maxSide) {
    let img = ScanCore.downscale(page.src, maxSide);
    if (page.crop) img = ScanCore.crop(img, ScanCore.contentBounds(img, 40, Math.round(Math.max(img.width, img.height) * 0.01)));
    img = ScanCore.rotate(img, page.turns);
    return ScanCore.applyFilter(img, page.filter);
  }

  function toCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    return c;
  }

  function render() {
    const list = $('pages');
    list.textContent = '';
    pages.forEach(function (page, i) {
      const canvas = toCanvas(process(page, THUMB));
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Page ' + (i + 1) + ': ' + page.name);
      const btn = (label, title, fn, disabled) => {
        const b = el('button', { type: 'button', text: label, title: title, 'aria-label': title + ' (page ' + (i + 1) + ')' });
        b.disabled = !!disabled;
        b.addEventListener('click', fn);
        return b;
      };
      const filter = el(
        'select',
        { 'aria-label': 'Look for page ' + (i + 1) },
        [
          ['none', 'Original colours'],
          ['contrast', 'Brighter and clearer'],
          ['gray', 'Greyscale'],
          ['bw', 'Black and white'],
        ].map(([v, t]) => el('option', { value: v, text: t })),
      );
      filter.value = page.filter;
      filter.addEventListener('change', () => ((page.filter = filter.value), render()));
      list.appendChild(
        el('li', {}, [
          canvas,
          el('div', { class: 'name', text: i + 1 + '. ' + page.name }),
          el('div', { class: 'tools' }, [
            btn('←', 'Move earlier', () => ((pages = ScanCore.move(pages, i, i - 1)), render()), i === 0),
            btn('→', 'Move later', () => ((pages = ScanCore.move(pages, i, i + 1)), render()), i === pages.length - 1),
            btn('↻', 'Rotate right', () => ((page.turns = (page.turns + 1) % 4), render())),
            btn('↺', 'Rotate left', () => ((page.turns = (page.turns + 3) % 4), render())),
            btn(page.crop ? 'Uncrop' : 'Crop', 'Auto-crop', () => ((page.crop = !page.crop), render())),
            btn('Remove', 'Remove page', () => (pages.splice(i, 1), render())),
          ]),
          filter,
        ]),
      );
    });
    $('pages-hint').textContent = pages.length ? pages.length + ' page(s). Order here is the order in the PDF.' : 'No pages yet.';
    $('out-pdf').disabled = !pages.length;
    $('out-zip').disabled = !pages.length;
  }

  bindDropzone($('drop'), $('file-input'), async function (files) {
    let ok = 0;
    for (const f of files) {
      if (pages.length >= MAX_PAGES) {
        setStatus($('add-status'), 'Limit of ' + MAX_PAGES + ' pages reached.', 'warn');
        break;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) continue;
      try {
        setStatus($('add-status'), 'Reading ' + f.name + '...');
        pages.push({ name: f.name, src: await decode(f), turns: 0, filter: 'contrast', crop: false });
        ok++;
      } catch (e) {
        setStatus($('add-status'), 'Could not read ' + f.name + '.', 'error');
      }
    }
    if (ok) setStatus($('add-status'), ok + ' photo(s) added.', 'ok');
    render();
  });

  $('all-filter').addEventListener('change', () => {
    if ($('all-filter').value) pages.forEach((p) => (p.filter = $('all-filter').value));
    render();
  });
  $('all-crop').addEventListener('change', () => {
    pages.forEach((p) => (p.crop = $('all-crop').checked));
    render();
  });

  const toBytes = (canvas, type, q) =>
    new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? b.arrayBuffer().then((a) => res(new Uint8Array(a))) : rej(new Error('Could not encode image'))), type, q),
    );

  async function encodeAll() {
    const max = parseInt($('quality').value, 10);
    const out = [];
    for (const p of pages) {
      const img = process(p, max);
      out.push({ bytes: await toBytes(toCanvas(img), 'image/jpeg', 0.85), type: 'jpg', width: img.width, height: img.height });
    }
    return out;
  }

  function busy(on) {
    $('out-pdf').disabled = on || !pages.length;
    $('out-zip').disabled = on || !pages.length;
  }

  $('out-pdf').addEventListener('click', async () => {
    busy(true);
    setStatus($('out-status'), 'Building PDF...');
    try {
      const enc = await encodeAll();
      const bytes = await ScanCore.buildPdf(PDFLib, enc, { pageSize: $('page').value });
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'scans.pdf');
      setStatus($('out-status'), 'Done - ' + OT.formatBytes(bytes.length) + '.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
    busy(false);
  });

  $('out-zip').addEventListener('click', async () => {
    busy(true);
    setStatus($('out-status'), 'Building ZIP...');
    try {
      const enc = await encodeAll();
      const date = new Date().toISOString().slice(0, 10);
      const names = ScanCore.pageNames($('pattern').value, enc.length, 'jpg', date);
      const zip = ScanCore.makeZip(
        fflate,
        enc.map((e, i) => ({ name: names[i], bytes: e.bytes })),
      );
      downloadBlob(new Blob([zip], { type: 'application/zip' }), 'scans.zip');
      setStatus($('out-status'), 'Done - ' + OT.formatBytes(zip.length) + '.', 'ok');
    } catch (e) {
      setStatus($('out-status'), e.message, 'error');
    }
    busy(false);
  });

  render();
})();

/* PDF Redact & Stamp - user interface. Redaction and stamping logic lives in core.js. */
(function () {
  'use strict';

  const { setStatus, bindDropzone, readArrayBuffer, downloadBlob, formatBytes, el } = OT;
  const $ = (id) => document.getElementById(id);

  // PDF.js draws the pages. When opened from disk (file://) browsers refuse Web Workers,
  // so PDF.js automatically runs its worker inside the page instead.
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  const state = { bytes: null, name: '', doc: null, infos: [], pageNo: 1, zoom: 1.25, redactions: {}, renderTask: null };

  // -------------------------------------------------------------- Loading
  bindDropzone($('drop'), $('file-input'), async function (files) {
    const file = files[0];
    try {
      setStatus($('status'), 'Opening ' + file.name + '...');
      const bytes = new Uint8Array(await readArrayBuffer(file));
      const infos = await RedactCore.inspect(bytes); // also rejects damaged or password-protected files
      if (state.doc) state.doc.destroy();
      // PDF.js takes ownership of the buffer it is given, so hand it a copy.
      const doc = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
      Object.assign(state, { bytes: bytes, name: file.name, doc: doc, infos: infos, pageNo: 1, redactions: {} });
      $('editor').hidden = false;
      await renderPage();
      updateSummary();
      setStatus($('status'), file.name + ' - ' + infos.length + ' page(s). Ready.', 'ok');
    } catch (err) {
      setStatus(
        $('status'),
        err && err.message && !/Invalid PDF|Missing PDF/i.test(err.message) ? err.message : 'Could not open that PDF.',
        'error',
      );
    }
  });

  // ------------------------------------------------------------ Rendering
  async function renderPage() {
    if (state.renderTask) state.renderTask.cancel();
    const page = await state.doc.getPage(state.pageNo);
    const viewport = page.getViewport({ scale: state.zoom });
    const canvas = $('page-canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    $('page-stack').style.width = viewport.width + 'px';
    $('page-stack').style.height = viewport.height + 'px';
    $('page-label').textContent = 'Page ' + state.pageNo + ' of ' + state.infos.length;
    $('prev').disabled = state.pageNo <= 1;
    $('next').disabled = state.pageNo >= state.infos.length;
    renderBoxes();
    try {
      state.renderTask = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      });
      await state.renderTask.promise;
    } catch (err) {
      if (!err || err.name !== 'RenderingCancelledException') setStatus($('status'), 'Could not draw this page.', 'error');
    }
  }

  $('prev').addEventListener('click', () => go(-1));
  $('next').addEventListener('click', () => go(1));
  function go(delta) {
    const n = state.pageNo + delta;
    if (n < 1 || n > state.infos.length) return;
    state.pageNo = n;
    renderPage();
  }
  $('zoom').addEventListener('change', function () {
    state.zoom = Number($('zoom').value);
    renderPage();
  });

  // ------------------------------------------------------------ Box drawing
  const pageSize = (i) => RedactCore.displaySize(state.infos[i]);
  const boxesOn = (i) => state.redactions[i] || (state.redactions[i] = []);

  function renderBoxes() {
    const overlay = $('overlay');
    overlay.textContent = '';
    (state.redactions[state.pageNo - 1] || []).forEach(function (r, idx) {
      const node = el('div', { class: 'box' });
      node.style.left = r.x * state.zoom + 'px';
      node.style.top = r.y * state.zoom + 'px';
      node.style.width = r.w * state.zoom + 'px';
      node.style.height = r.h * state.zoom + 'px';
      node.appendChild(
        el('button', {
          type: 'button',
          'aria-label': 'Remove this box',
          text: '✕',
          onclick: function (e) {
            e.stopPropagation();
            boxesOn(state.pageNo - 1).splice(idx, 1);
            renderBoxes();
            updateSummary();
          },
        }),
      );
      node.addEventListener('pointerdown', (e) => e.stopPropagation());
      overlay.appendChild(node);
    });
  }

  $('overlay').addEventListener('pointerdown', function (e) {
    if (e.target !== $('overlay')) return;
    e.preventDefault();
    const overlay = $('overlay');
    const rect = overlay.getBoundingClientRect();
    const toPoint = (ev) => ({ x: (ev.clientX - rect.left) / state.zoom, y: (ev.clientY - rect.top) / state.zoom });
    const start = toPoint(e);
    const draft = el('div', { class: 'box draft' });
    overlay.appendChild(draft);
    overlay.setPointerCapture(e.pointerId);
    const place = (ev) => {
      const r = RedactCore.normalizeRect(start, toPoint(ev));
      draft.style.left = r.x * state.zoom + 'px';
      draft.style.top = r.y * state.zoom + 'px';
      draft.style.width = r.w * state.zoom + 'px';
      draft.style.height = r.h * state.zoom + 'px';
      return r;
    };
    const onMove = (ev) => place(ev);
    const onUp = function (ev) {
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointercancel', onUp);
      const size = pageSize(state.pageNo - 1);
      const r = RedactCore.clampRect(place(ev), size.width, size.height);
      draft.remove();
      const kept = RedactCore.cleanRects([r]);
      if (kept.length) boxesOn(state.pageNo - 1).push(kept[0]);
      renderBoxes();
      updateSummary();
    };
    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onUp);
  });

  $('whole').addEventListener('click', function () {
    const s = pageSize(state.pageNo - 1);
    state.redactions[state.pageNo - 1] = [{ x: 0, y: 0, w: s.width, h: s.height }];
    renderBoxes();
    updateSummary();
  });
  $('clear-page').addEventListener('click', function () {
    delete state.redactions[state.pageNo - 1];
    renderBoxes();
    updateSummary();
  });
  $('clear-all').addEventListener('click', function () {
    if (!Object.keys(state.redactions).length || !window.confirm('Remove every box on every page?')) return;
    state.redactions = {};
    renderBoxes();
    updateSummary();
  });

  function totals() {
    const pages = Object.keys(state.redactions).filter((k) => state.redactions[k].length);
    return { pages: pages.length, boxes: pages.reduce((n, k) => n + state.redactions[k].length, 0) };
  }
  function updateSummary() {
    const t = totals();
    setStatus(
      $('summary'),
      t.boxes
        ? t.boxes + ' box(es) on ' + t.pages + ' page(s) will be permanently removed. Those pages become pictures.'
        : 'No boxes yet - nothing will be removed.',
      t.boxes ? 'warn' : '',
    );
  }

  // ----------------------------------------------------------- Find text
  /** Text runs of one page with their on-screen boxes (display points). */
  async function runsOf(pageIndex) {
    const page = await state.doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    return content.items
      .filter((it) => it.str && it.str.trim())
      .map(function (it) {
        const t = pdfjsLib.Util.transform(viewport.transform, it.transform);
        const dirLen = Math.hypot(t[0], t[1]) || 1;
        const w = it.width * viewport.scale;
        const up = [t[2], t[3]];
        const p0 = [t[4] - 0.25 * up[0], t[5] - 0.25 * up[1]]; // include descenders
        const along = [(t[0] / dirLen) * w, (t[1] / dirLen) * w];
        const upFull = [up[0] * 1.25, up[1] * 1.25];
        const xs = [p0[0], p0[0] + along[0], p0[0] + along[0] + upFull[0], p0[0] + upFull[0]];
        const ys = [p0[1], p0[1] + along[1], p0[1] + along[1] + upFull[1], p0[1] + upFull[1]];
        const horizontal = Math.abs(t[0]) >= Math.abs(t[1]);
        return {
          str: it.str,
          box: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
          axis: horizontal ? 'x' : 'y',
          reverse: horizontal ? t[0] < 0 : t[1] < 0,
        };
      });
  }

  async function findAndBox(query, opts) {
    const pages = RedactCore.parsePages($('find-pages').value, state.infos.length);
    let added = 0;
    const touched = new Set();
    for (const i of pages) {
      const size = pageSize(i);
      const found = RedactCore.findTextBoxes(await runsOf(i), query, opts).map((b) => RedactCore.clampRect(b, size.width, size.height));
      const fresh = RedactCore.cleanRects(boxesOn(i).concat(found));
      added += fresh.length - boxesOn(i).length;
      if (fresh.length !== boxesOn(i).length) touched.add(i);
      state.redactions[i] = fresh;
    }
    renderBoxes();
    updateSummary();
    return { added: added, pages: touched.size };
  }

  function guarded(fn) {
    return async function () {
      try {
        setStatus($('find-status'), 'Searching...');
        const r = await fn();
        setStatus(
          $('find-status'),
          r.added
            ? 'Added ' + r.added + ' box(es) on ' + r.pages + ' page(s). Please review them.'
            : 'Nothing found. (Scanned pages have no searchable text.)',
          r.added ? 'ok' : 'warn',
        );
      } catch (err) {
        setStatus($('find-status'), err.message, 'error');
      }
    };
  }

  $('find-run').addEventListener(
    'click',
    guarded(() =>
      findAndBox($('find-text').value, {
        regex: $('find-regex').checked,
        matchCase: $('find-case').checked,
        whole: $('find-whole').checked,
        pad: 2,
      }),
    ),
  );
  $('find-email').addEventListener(
    'click',
    guarded(() => findAndBox('[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', { regex: true, whole: false, pad: 3 })),
  );
  $('find-phone').addEventListener(
    'click',
    guarded(() => findAndBox('(?:\\+?\\d[\\d\\s().-]{7,}\\d)', { regex: true, whole: false, pad: 3 })),
  );

  // --------------------------------------------------------------- Saving
  $('wm-opacity').addEventListener('input', () => ($('wm-opacity-out').textContent = $('wm-opacity').value));

  /** Render a page with its black boxes painted in, as an image (PDF.js + canvas). */
  async function rasterize(pageIndex, boxes) {
    const [scaleText, kind] = $('quality').value.split('|');
    const scale = Number(scaleText);
    const page = await state.doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    ctx.fillStyle = '#000';
    boxes.forEach(function (b) {
      const p = RedactCore.toPixels(b, scale);
      ctx.fillRect(p.x, p.y, p.w, p.h);
    });
    const mime = kind === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.9));
    const bytes = new Uint8Array(await readArrayBuffer(blob));
    canvas.width = canvas.height = 0; // release memory
    return { bytes: bytes, mime: mime, widthPt: viewport.width / scale, heightPt: viewport.height / scale };
  }

  $('save').addEventListener('click', async function () {
    const button = $('save');
    try {
      button.disabled = true;
      setStatus($('save-status'), 'Working... (redacted pages are rendered as pictures, which can take a moment)');
      let bytes = state.bytes;
      const t = totals();
      if (t.boxes) bytes = await RedactCore.redact(bytes, state.redactions, rasterize);
      const wm = $('wm-on').checked
        ? {
            text: $('wm-text').value,
            size: $('wm-size').value,
            opacity: Number($('wm-opacity').value) / 100,
            angle: $('wm-angle').value,
            color: $('wm-color').value,
            pages: $('wm-pages').value,
          }
        : null;
      const numbers = $('pn-on').checked
        ? {
            format: $('pn-format').value,
            position: $('pn-pos').value,
            size: $('pn-size').value,
            start: $('pn-start').value,
            pages: $('pn-pages').value,
          }
        : null;
      const clear = $('clear-info').checked;
      if (wm || numbers || clear) bytes = await RedactCore.stamp(bytes, { watermark: wm, numbers: numbers, clearInfo: clear });
      if (bytes === state.bytes) throw new Error('Nothing to do yet: draw a box, or switch on a watermark or page numbers.');
      const suffix = t.boxes ? 'redacted' : 'stamped';
      downloadBlob(bytes, RedactCore.outputName(state.name, suffix), 'application/pdf');
      setStatus($('save-status'), 'Saved ' + RedactCore.outputName(state.name, suffix) + ' (' + formatBytes(bytes.length) + ').', 'ok');
    } catch (err) {
      setStatus($('save-status'), err.message, 'error');
    } finally {
      button.disabled = false;
    }
  });
})();

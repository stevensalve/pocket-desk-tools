/* Mail Merge - user interface. Merging, naming and PDF layout live in core.js. */
(function () {
  'use strict';

  const { setStatus, bindDropzone, readArrayBuffer, downloadBlob, baseName, formatBytes, el } = OT;
  const $ = (id) => document.getElementById(id);
  const MAX_RECORDS = 2000;

  const state = { workbook: null, fileName: '', headers: [], records: [], index: 0 };
  const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // --------------------------------------------------------------- Loading
  function loadSheet() {
    const aoa = XLSX.utils.sheet_to_json(state.workbook.Sheets[$('sheet').value], { header: 1, defval: '', raw: false, blankrows: false });
    const data = MergeCore.buildRecords(aoa);
    state.headers = data.headers;
    state.records = data.records;
    state.index = 0;
    $('data-info').textContent = state.fileName + ' - ' + data.records.length + ' record(s), ' + data.headers.length + ' column(s)';
    renderDataPreview();
    renderChips();
    renderEmailColumns();
    refresh();
    if (data.records.length > MAX_RECORDS)
      setStatus($('data-status'), 'Only the first ' + MAX_RECORDS + ' records will be merged.', 'warn');
  }

  bindDropzone($('drop'), $('file-input'), async function (files) {
    const file = files[0];
    try {
      setStatus($('data-status'), 'Reading ' + file.name + '...');
      state.workbook = XLSX.read(await readArrayBuffer(file), { type: 'array' });
      state.fileName = file.name;
      $('sheet').textContent = '';
      state.workbook.SheetNames.forEach((n) => $('sheet').appendChild(el('option', { value: n, text: n })));
      $('sheet-row').hidden = false;
      loadSheet();
      setStatus($('data-status'), formatBytes(file.size) + ' loaded.', 'ok');
    } catch (err) {
      setStatus($('data-status'), 'Could not open that file. Is it a valid Excel or CSV file?', 'error');
    }
  });
  $('sheet').addEventListener('change', loadSheet);

  function renderDataPreview() {
    const box = $('data-preview');
    box.hidden = state.records.length === 0;
    box.textContent = '';
    if (!state.records.length) return;
    const head = el(
      'tr',
      {},
      state.headers.map((h) => el('th', { scope: 'col', text: h })),
    );
    const rows = state.records.slice(0, 5).map((r) =>
      el(
        'tr',
        {},
        state.headers.map((h) => el('td', { text: r[h] })),
      ),
    );
    box.appendChild(el('table', {}, [el('thead', {}, [head]), el('tbody', {}, rows)]));
  }

  function renderChips() {
    const box = $('chips');
    box.textContent = '';
    state.headers.forEach((h) =>
      box.appendChild(
        el('button', {
          type: 'button',
          text: h,
          title: 'Insert {{' + h + '}} into the message',
          onclick: function () {
            const t = $('template');
            const at = t.selectionStart == null ? t.value.length : t.selectionStart;
            t.setRangeText('{{' + h + '}}', at, t.selectionEnd == null ? at : t.selectionEnd, 'end');
            t.focus();
            refresh();
          },
        }),
      ),
    );
  }

  function renderEmailColumns() {
    const sel = $('email-col');
    sel.textContent = '';
    sel.appendChild(el('option', { value: '', text: '(none)' }));
    state.headers.forEach((h) => sel.appendChild(el('option', { value: h, text: h })));
    const guess = state.headers.find((h) => /e-?mail/i.test(h));
    if (guess) sel.value = guess;
  }

  // --------------------------------------------------------------- Preview
  const active = () => state.records.slice(0, MAX_RECORDS);

  function mergeOne(record, i) {
    return MergeCore.render($('template').value, record, { today: today(), row: i + 1 });
  }

  function refresh() {
    const recs = active();
    const has = recs.length > 0;
    ['out-pdf', 'out-zip', 'out-csv'].forEach((id) => ($(id).disabled = !has));
    $('prev').disabled = !has || state.index === 0;
    $('next').disabled = !has || state.index >= recs.length - 1;
    if (!has) {
      $('rec-label').textContent = 'No records yet';
      $('preview').textContent = '';
      return setStatus($('check-status'), 'Open a spreadsheet to see the merged message.', '');
    }
    state.index = Math.min(state.index, recs.length - 1);
    const r = mergeOne(recs[state.index], state.index);
    $('rec-label').textContent = 'Record ' + (state.index + 1) + ' of ' + recs.length;
    $('preview').textContent = r.text;
    const unknown = MergeCore.unknownFields($('template').value + ' ' + $('subject').value, state.headers);
    if (unknown.length)
      setStatus(
        $('check-status'),
        'No column is called: ' + unknown.join(', ') + '. Check the spelling against your spreadsheet headings.',
        'error',
      );
    else if (r.empty.length) setStatus($('check-status'), 'This record has nothing in: ' + r.empty.join(', ') + '.', 'warn');
    else setStatus($('check-status'), 'Looks good.', 'ok');
  }

  ['template', 'subject'].forEach((id) => $(id).addEventListener('input', refresh));
  $('prev').addEventListener('click', () => (state.index--, refresh()));
  $('next').addEventListener('click', () => (state.index++, refresh()));

  // ---------------------------------------------------------------- Output
  function guard(fn) {
    return async function () {
      try {
        const unknown = MergeCore.unknownFields($('template').value + ' ' + $('subject').value, state.headers);
        if (unknown.length) throw new Error('No column is called: ' + unknown.join(', ') + '.');
        setStatus($('out-status'), 'Working...');
        await fn();
      } catch (err) {
        setStatus($('out-status'), err.message, 'error');
      }
    };
  }

  const pdfOptions = () => ({ font: $('font').value, fontSize: Number($('size').value), pageSize: $('page').value });
  const texts = () => active().map((r, i) => mergeOne(r, i).text);

  $('out-pdf').addEventListener(
    'click',
    guard(async function () {
      const bytes = await MergeCore.buildPdf(texts(), pdfOptions());
      downloadBlob(bytes, baseName(state.fileName) + '-merged.pdf', 'application/pdf');
      setStatus($('out-status'), 'Saved a PDF with ' + active().length + ' letter(s) (' + formatBytes(bytes.length) + ').', 'ok');
    }),
  );

  $('out-zip').addEventListener(
    'click',
    guard(async function () {
      const recs = active();
      const names = MergeCore.fileNames(recs, $('pattern').value, { today: today() });
      const all = texts();
      const files = {};
      for (let i = 0; i < recs.length; i++) files[names[i] + '.pdf'] = await MergeCore.buildPdf([all[i]], pdfOptions());
      const zip = MergeCore.makeZip(fflate, files);
      downloadBlob(zip, baseName(state.fileName) + '-letters.zip', 'application/zip');
      setStatus($('out-status'), 'Saved a ZIP with ' + recs.length + ' PDF file(s) (' + formatBytes(zip.length) + ').', 'ok');
    }),
  );

  $('out-csv').addEventListener(
    'click',
    guard(async function () {
      const col = $('email-col').value;
      const items = active().map((r, i) => ({
        to: col ? r[col] : '',
        subject: MergeCore.render($('subject').value, r, { today: today(), row: i + 1 }).text,
        body: mergeOne(r, i).text,
      }));
      downloadBlob(new Blob([MergeCore.emailCsv(items)], { type: 'text/csv;charset=utf-8' }), baseName(state.fileName) + '-emails.csv');
      setStatus($('out-status'), 'Saved ' + items.length + ' message(s) as CSV (To, Subject, Body).', 'ok');
    }),
  );

  refresh();
})();

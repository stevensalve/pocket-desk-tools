/* Spreadsheet Diff - user interface. Matching and comparing live in core.js. */
(function () {
  'use strict';

  const { setStatus, bindDropzone, readArrayBuffer, downloadBlob, debounce, el } = OT;
  const $ = (id) => document.getElementById(id);
  const MAX_ROWS = 50000;
  const SHOW_LIMIT = 1000;

  const side = { a: { wb: null, table: null }, b: { wb: null, table: null } };
  let lastResult = null;

  function loadSheet(s) {
    const aoa = XLSX.utils.sheet_to_json(side[s].wb.Sheets[$('sheet-' + s).value], { header: 1, defval: '', raw: false, blankrows: false });
    side[s].table = DiffCore.toRecords(aoa);
    $('info-' + s).textContent = side[s].table.records.length + ' row(s), ' + side[s].table.headers.length + ' column(s)';
  }

  function bind(s) {
    bindDropzone($('drop-' + s), $('file-' + s), async function (files) {
      try {
        const f = files[0];
        side[s].wb = XLSX.read(await readArrayBuffer(f), { type: 'array' });
        const sel = $('sheet-' + s);
        sel.textContent = '';
        side[s].wb.SheetNames.forEach((n) => sel.appendChild(el('option', { value: n, text: n })));
        sel.disabled = false;
        loadSheet(s);
        $('info-' + s).textContent = f.name + ': ' + $('info-' + s).textContent;
        setStatus($('load-status'), '');
        refreshKeys();
        compare();
      } catch (e) {
        setStatus($('load-status'), 'Could not open that file. Is it a valid Excel or CSV file?', 'error');
      }
    });
    $('sheet-' + s).addEventListener('change', () => {
      loadSheet(s);
      refreshKeys();
      compare();
    });
  }
  bind('a');
  bind('b');

  function refreshKeys() {
    const sel = $('key');
    const prev = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    const a = side.a.table;
    const b = side.b.table;
    if (!a || !b) return;
    const bl = new Set(b.headers.map((h) => h.toLowerCase()));
    a.headers.filter((h) => bl.has(h.toLowerCase())).forEach((h) => sel.appendChild(el('option', { value: h, text: h })));
    const guess = DiffCore.suggestKey(a);
    sel.value = prev && Array.from(sel.options).some((o) => o.value === prev) ? prev : bl.has(guess.toLowerCase()) ? guess : '';
  }

  function compare() {
    const { a, b } = { a: side.a.table, b: side.b.table };
    const table = $('result');
    $('r-head').textContent = '';
    $('r-body').textContent = '';
    table.hidden = true;
    $('dl').disabled = true;
    $('cols-note').textContent = '';
    if (!a || !b) return;
    if (a.records.length > MAX_ROWS || b.records.length > MAX_ROWS)
      return setStatus($('summary'), 'Files over ' + MAX_ROWS + ' rows are not supported in the browser.', 'error');
    let res;
    try {
      res = DiffCore.diffTables(a, b, { key: $('key').value, ignoreCase: $('icase').checked, tolerance: parseFloat($('tol').value) || 0 });
    } catch (err) {
      return setStatus($('summary'), err.message, 'error');
    }
    lastResult = res;
    const clean = !res.summary.changed && !res.summary.added && !res.summary.removed;
    setStatus($('summary'), DiffCore.summaryText(res.summary), clean ? 'ok' : 'warn');
    const notes = [];
    if (res.onlyInA.length) notes.push('Columns only in A (not compared): ' + res.onlyInA.join(', ') + '.');
    if (res.onlyInB.length) notes.push('Columns only in B (not compared): ' + res.onlyInB.join(', ') + '.');
    $('cols-note').textContent = notes.join(' ');

    $('r-head').appendChild(
      el('tr', {}, [el('th', { scope: 'col', text: 'Rows (A / B)' })].concat(res.columns.map((c) => el('th', { scope: 'col', text: c })))),
    );
    const rows = res.rows.filter((r) => !$('only').checked || r.status !== 'same');
    rows.slice(0, SHOW_LIMIT).forEach(function (r) {
      const tr = el('tr', { class: r.status === 'added' || r.status === 'removed' ? r.status : '' });
      tr.appendChild(el('td', { class: 'rn', text: (r.rowA || '-') + ' / ' + (r.rowB || '-') }));
      res.columns.forEach(function (c) {
        const td = el('td');
        if (r.status === 'changed' && r.changed.indexOf(c) !== -1) {
          td.className = 'chg';
          td.appendChild(el('span', { class: 'old', text: r.a[c] }));
          td.appendChild(el('span', { class: 'new', text: r.b[c] }));
        } else {
          td.textContent = (r.a || r.b)[c] === undefined ? '' : (r.status === 'added' ? r.b : r.a || r.b)[c];
        }
        tr.appendChild(td);
      });
      $('r-body').appendChild(tr);
    });
    if (rows.length > SHOW_LIMIT)
      $('cols-note').textContent +=
        ' Showing the first ' + SHOW_LIMIT + ' of ' + rows.length + ' rows; the CSV report has all differences.';
    table.hidden = rows.length === 0;
    $('dl').disabled = clean;
  }

  const again = debounce(compare, 200);
  $('key').addEventListener('change', compare);
  $('icase').addEventListener('change', compare);
  $('only').addEventListener('change', compare);
  $('tol').addEventListener('input', again);
  $('dl').addEventListener('click', () => downloadBlob(DiffCore.toCsv(lastResult), 'sheet-differences.csv', 'text/csv;charset=utf-8'));
})();

/* Calendar & Planner Maker - user interface. Layout and PDF drawing live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, debounce, el } = OT;
  const $ = (id) => document.getElementById(id);
  const now = new Date();

  function options() {
    const kind = $('kind').value;
    return {
      kind: kind,
      year: parseInt($('year').value, 10),
      month: parseInt($('month').value, 10),
      months: Math.max(1, Math.min(12, parseInt($('months').value, 10) || 1)),
      startIso: $('start').value || undefined,
      weeks: parseInt($('weeks').value, 10) || 12,
      weekStart: parseInt($('wstart').value, 10),
      locale: $('locale').value,
      pageSize: $('size').value,
      landscape: $('orient').value === '1',
      title: $('title').value.trim(),
      weekNumbers: $('wn').checked,
      lines: $('lines').checked,
      holidays: $('holidays').value,
    };
  }

  function layoutFields() {
    const k = $('kind').value;
    $('f-month').hidden = k === 'year' || k === 'week';
    $('f-months').hidden = k !== 'month';
    $('f-start').hidden = k !== 'week';
    $('f-weeks').hidden = k !== 'week';
  }

  function preview() {
    const o = options();
    const box = $('preview');
    box.textContent = '';
    const hol = CalCore.parseHolidays(o.holidays, o.year);
    setStatus(
      $('hol-status'),
      hol.errors.length
        ? hol.errors.join(' | ')
        : Object.keys(hol.map).length
          ? Object.keys(hol.map).length + ' day(s) marked in ' + o.year + '.'
          : '',
      hol.errors.length ? 'warn' : 'ok',
    );
    if (!(o.year >= 1900 && o.year <= 2200))
      return box.appendChild(el('p', { class: 'hint', text: 'Enter a year between 1900 and 2200.' }));
    const m0 = o.kind === 'month' ? o.month : o.kind === 'week' ? (o.startIso ? new Date(o.startIso + 'T00:00:00Z').getUTCMonth() : 0) : 0;
    const nm = CalCore.names(o.locale);
    box.appendChild(
      el('h3', {
        text:
          o.kind === 'year' ? 'Preview: January ' + o.year + ' (the PDF shows all 12 months)' : 'Preview: ' + nm.months[m0] + ' ' + o.year,
      }),
    );
    const head = el(
      'tr',
      {},
      CalCore.orderedWeekdays(o.locale, o.weekStart).map((n) => el('th', { scope: 'col', text: n })),
    );
    const body = CalCore.monthMatrix(o.year, m0, o.weekStart).map((w) =>
      el(
        'tr',
        {},
        w.map((c) => {
          const label = c.inMonth ? hol.map[c.iso] : '';
          const cell = el('td', {
            class:
              (c.inMonth ? '' : 'out') + (label ? ' hol' : '') + (c.inMonth && (c.weekday === 0 || c.weekday === 6) && !label ? ' wk' : ''),
            text: String(c.day),
          });
          if (label) cell.appendChild(el('span', { class: 'hn', text: label }));
          return cell;
        }),
      ),
    );
    box.appendChild(el('table', { class: 'cal' }, [el('thead', {}, [head]), el('tbody', {}, body)]));
  }

  $('make').addEventListener('click', async function () {
    const o = options();
    $('make').disabled = true;
    setStatus($('out-status'), 'Making your PDF...');
    try {
      const bytes = await CalCore.buildPdf(PDFLib, o);
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), CalCore.fileName(o));
      setStatus($('out-status'), 'Done - check your downloads folder.', 'ok');
    } catch (err) {
      setStatus($('out-status'), err.message, 'error');
    } finally {
      $('make').disabled = false;
    }
  });

  const names = CalCore.names('en').months;
  names.forEach((n, i) => $('month').appendChild(el('option', { value: String(i), text: n })));
  $('year').value = now.getFullYear();
  $('month').value = String(now.getMonth());
  layoutFields();
  const again = debounce(preview, 150);
  document.querySelectorAll('input, select, textarea').forEach((x) => {
    x.addEventListener('input', again);
    x.addEventListener('change', () => (layoutFields(), preview()));
  });
  preview();
})();

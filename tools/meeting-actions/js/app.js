/* Meeting Actions - user interface. All parsing and formatting live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, copyText, debounce, el } = OT;
  const $ = (id) => document.getElementById(id);

  const SAMPLE = [
    'Weekly project sync',
    '',
    'Discussion',
    '- Reviewed the Q4 launch plan',
    '',
    'Decisions',
    '- Launch moves to 12 November',
    '',
    'Actions',
    '- Priya: update the roadmap by Friday',
    '- @marcus to confirm the venue tomorrow ASAP',
    '[ ] Send meeting notes to the team',
    'Dana will call the vendor on Monday.',
    '',
    'Open questions',
    '- Who approves the extra budget?',
  ].join('\n');

  /** Today as YYYY-MM-DD in local time (not UTC, so late evenings are not "tomorrow"). */
  function localToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  const state = { result: { actions: [], decisions: [], questions: [] } };

  function options() {
    return {
      today: $('today').value || localToday(),
      me: $('me').value.trim() || undefined,
      attendees: $('people')
        .value.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      dayFirst: $('dayfirst').value === '1',
    };
  }

  function analyse() {
    state.result = ActionsCore.parseNotes($('notes').value, options());
    render();
  }

  function fillList(id, items) {
    const ul = $(id);
    ul.textContent = '';
    if (!items.length) ul.appendChild(el('li', { text: 'None found.', class: 'hint' }));
    items.forEach((x) => ul.appendChild(el('li', { text: x.text })));
  }

  function render() {
    const r = state.result;
    const body = $('actions-body');
    body.textContent = '';
    r.actions.forEach(function (a, i) {
      const done = el('input', { type: 'checkbox', 'aria-label': 'Done' });
      done.checked = a.done;
      done.addEventListener('change', () => (a.done = done.checked));
      const text = el('input', { type: 'text', value: a.text, 'aria-label': 'Action text' });
      text.addEventListener('input', () => (a.text = text.value));
      const owner = el('input', { type: 'text', value: a.owner, 'aria-label': 'Owner' });
      owner.addEventListener('input', () => (a.owner = owner.value));
      const due = el('input', { type: 'date', value: a.due, 'aria-label': 'Due date' });
      due.addEventListener('input', () => (a.due = due.value));
      const urgent = el('input', { type: 'checkbox', 'aria-label': 'Urgent' });
      urgent.checked = a.priority === 'high';
      urgent.addEventListener('change', () => (a.priority = urgent.checked ? 'high' : ''));
      const why = el('span', {
        class: 'why' + (a.confidence === 'low' ? ' guess' : ''),
        text: a.confidence === 'low' ? 'guess' : a.reason,
      });
      body.appendChild(
        el('tr', { 'data-row': String(i) }, [
          el('td', {}, [done]),
          el('td', {}, [text]),
          el('td', {}, [owner]),
          el('td', {}, [due]),
          el('td', {}, [urgent]),
          el('td', {}, [why]),
        ]),
      );
    });
    $('actions-table').hidden = r.actions.length === 0;
    fillList('decisions', r.decisions);
    fillList('questions', r.questions);

    const total = r.actions.length + r.decisions.length + r.questions.length;
    setStatus(
      $('summary'),
      total
        ? r.actions.length + ' action(s), ' + r.decisions.length + ' decision(s), ' + r.questions.length + ' question(s).'
        : $('notes').value.trim()
          ? 'Nothing found. Try starting lines with "Action:" or adding an Actions heading.'
          : 'Paste notes above to begin.',
      total ? 'ok' : '',
    );
    ['copy-md', 'copy-email', 'dl-csv'].forEach((id) => ($(id).disabled = total === 0));
    $('dl-ics').disabled = !r.actions.some((a) => a.due && !a.done);
  }

  function stamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  }

  const title = () => $('title').value.trim();
  const share = (n) => setStatus($('share-status'), n, 'ok');

  $('copy-md').addEventListener('click', async () => {
    await copyText(ActionsCore.toMarkdown(state.result, title()));
    share('Markdown copied.');
  });
  $('copy-email').addEventListener('click', async () => {
    await copyText(ActionsCore.toEmail(state.result, title()));
    share('E-mail text copied.');
  });
  $('dl-csv').addEventListener('click', () => {
    downloadBlob(ActionsCore.toCsv(state.result), 'meeting-actions.csv', 'text/csv;charset=utf-8');
    share('CSV downloaded.');
  });
  $('dl-ics').addEventListener('click', () => {
    downloadBlob(ActionsCore.toIcs(state.result.actions, stamp()), 'meeting-actions.ics', 'text/calendar;charset=utf-8');
    share('Calendar file downloaded. Open it to add the due dates to your calendar.');
  });
  $('sample').addEventListener('click', () => {
    $('notes').value = SAMPLE;
    $('title').value = 'Weekly project sync';
    analyse();
  });

  const again = debounce(analyse, 200);
  ['notes', 'me', 'people'].forEach((id) => $(id).addEventListener('input', again));
  ['today', 'dayfirst'].forEach((id) => $(id).addEventListener('change', analyse));

  $('today').value = localToday();
  analyse();
})();

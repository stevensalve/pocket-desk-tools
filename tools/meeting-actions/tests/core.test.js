'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

const TODAY = '2026-10-22'; // a Thursday
const d = (phrase, opts) => core.parseDatePhrase(phrase, TODAY, opts);

test('parseDatePhrase: relative words', () => {
  assert.equal(d('today'), '2026-10-22');
  assert.equal(d('tomorrow'), '2026-10-23');
  assert.equal(d('day after tomorrow'), '2026-10-24');
  assert.equal(d('EOD'), '2026-10-22');
  assert.equal(d('EOM'), '2026-10-31');
  assert.equal(d('end of the month'), '2026-10-31');
  assert.equal(d('next week'), '2026-10-26'); // the coming Monday
  assert.equal(d('in 3 days'), '2026-10-25');
  assert.equal(d('in 2 weeks'), '2026-11-05');
  assert.equal(d('in 2 months'), '2026-12-22');
});

test('parseDatePhrase: end of week handles weekends', () => {
  assert.equal(d('EOW'), '2026-10-23');
  assert.equal(core.parseDatePhrase('eow', '2026-10-24'), '2026-10-30'); // Saturday -> next Friday
  assert.equal(core.parseDatePhrase('eow', '2026-10-25'), '2026-10-30'); // Sunday -> next Friday
  assert.equal(core.parseDatePhrase('eow', '2026-10-23'), '2026-10-23'); // Friday -> today
});

test('parseDatePhrase: weekdays (bare, this, next)', () => {
  assert.equal(d('Friday'), '2026-10-23');
  assert.equal(d('Monday'), '2026-10-26');
  assert.equal(d('Thursday'), '2026-10-29', 'a bare weekday that is today means next week');
  assert.equal(d('this Friday'), '2026-10-23');
  assert.equal(d('this Monday'), '2026-10-19');
  assert.equal(d('next Friday'), '2026-10-30');
  assert.equal(d('next mon'), '2026-10-26');
  assert.equal(d('wed'), '2026-10-28');
});

test('parseDatePhrase: written dates, with and without year', () => {
  assert.equal(d('25 Oct'), '2026-10-25');
  assert.equal(d('25th October 2026'), '2026-10-25');
  assert.equal(d('Oct 25'), '2026-10-25');
  assert.equal(d('October 5th, 2027'), '2027-10-05');
  assert.equal(d('5 Oct'), '2027-10-05', 'a date already past this year means next year');
  assert.equal(d('2026-11-01'), '2026-11-01');
  assert.equal(d('31 Feb'), null);
  assert.equal(d('2026-02-30'), null);
});

test('parseDatePhrase: numeric dates follow the day-first setting', () => {
  assert.equal(d('5/11/2026'), '2026-11-05');
  assert.equal(d('5/11/2026', { dayFirst: false }), '2026-05-11');
  assert.equal(d('25/10'), '2026-10-25');
  assert.equal(d('10/25/2026'), '2026-10-25', 'a month above 12 swaps automatically');
  assert.equal(d('5.11.26'), '2026-11-05');
  assert.equal(d('banana'), null);
});

test('formatDate / parse requirements', () => {
  assert.equal(core.formatDate('2026-10-23'), 'Fri 23 Oct 2026');
  assert.throws(() => core.parseNotes('x'), /reference date/);
  assert.throws(() => core.parseNotes('x', { today: '22/10/2026' }), /2026-10-22/);
});

const parse = (text, extra) => core.parseNotes(text, Object.assign({ today: TODAY }, extra));

test('keywords, checkboxes and bullets are picked up', () => {
  const r = parse(
    [
      '- ACTION: Send the budget to finance by Friday',
      '[ ] Book the venue',
      '[x] Order snacks',
      'TODO: renew licence due 2026-11-30',
      'Just a normal sentence.',
    ].join('\n'),
  );
  assert.equal(r.actions.length, 4);
  assert.deepEqual(
    r.actions.map((a) => a.reason),
    ['keyword', 'checkbox', 'checkbox', 'keyword'],
  );
  assert.equal(r.actions[0].text, 'Send the budget to finance');
  assert.equal(r.actions[0].due, '2026-10-23');
  assert.equal(r.actions[2].done, true);
  assert.equal(r.actions[3].due, '2026-11-30');
  assert.equal(r.actions[3].text, 'Renew licence');
});

test('owners: @mentions, owner: wording, trailing (Name)', () => {
  const r = parse(
    [
      'ACTION: @priya to draft the proposal by tomorrow',
      'ACTION: Update the roadmap owner: Marcus',
      'ACTION: Fix the login bug (Dana)',
    ].join('\n'),
  );
  assert.deepEqual(
    r.actions.map((a) => a.owner),
    ['priya', 'Marcus', 'Dana'],
  );
  assert.equal(r.actions[0].text, 'Draft the proposal');
  assert.equal(r.actions[0].due, '2026-10-23');
  assert.equal(r.actions[1].text, 'Update the roadmap');
  assert.equal(r.actions[2].text, 'Fix the login bug');
});

test('"Name will ..." wording is detected but marked low confidence', () => {
  const r = parse(
    [
      'Sam will call the vendor on Monday.',
      'Alex and Jo should review the contract by 30 Oct',
      'We will think about it.',
      'I will send the minutes tomorrow',
    ].join('\n'),
    { me: 'Jordan' },
  );
  assert.equal(r.actions.length, 3, '"We will" is not a person');
  assert.deepEqual(
    r.actions.map((a) => a.owner),
    ['Sam', 'Alex, Jo', 'Jordan'],
  );
  assert.deepEqual(
    r.actions.map((a) => a.confidence),
    ['low', 'low', 'low'],
  );
  assert.equal(r.actions[0].text, 'Call the vendor');
  assert.equal(r.actions[0].due, '2026-10-26');
  assert.equal(r.actions[1].due, '2026-10-30');
});

test('known attendee names help detection (including lower-case first names)', () => {
  const r = parse('Priyanka to confirm the budget', { attendees: ['Priyanka'] });
  assert.equal(r.actions[0].owner, 'Priyanka');
});

test('sections: bullets under "Actions" are actions; "Name: task" gives an owner', () => {
  const notes = [
    '## Discussion',
    '- We reviewed Q3',
    '',
    'Actions:',
    '- Dana: prepare slides by Wed',
    '- Chase invoices ASAP',
    '',
    'Decisions',
    '- Launch moves to November',
    '',
    'Open questions',
    '- Who owns the rollout?',
  ].join('\n');
  const r = parse(notes);
  assert.equal(r.actions.length, 2);
  assert.equal(r.actions[0].owner, 'Dana');
  assert.equal(r.actions[0].text, 'Prepare slides');
  assert.equal(r.actions[0].due, '2026-10-28');
  assert.equal(r.actions[1].priority, 'high');
  assert.equal(r.actions[1].text, 'Chase invoices');
  assert.deepEqual(
    r.decisions.map((x) => x.text),
    ['Launch moves to November'],
  );
  assert.deepEqual(
    r.questions.map((x) => x.text),
    ['Who owns the rollout?'],
  );
});

test('decisions and questions by keyword', () => {
  const r = parse(
    ['Decision: use the new vendor', 'We agreed to cap spend at 5k', 'Q: what about legal review?', 'Agreed - weekly check-ins'].join('\n'),
  );
  assert.deepEqual(
    r.decisions.map((x) => x.text),
    ['Use the new vendor', 'Cap spend at 5k', 'Weekly check-ins'],
  );
  assert.deepEqual(
    r.questions.map((x) => x.text),
    ['What about legal review?'],
  );
  assert.equal(r.actions.length, 0);
});

test('empty and noisy input never throws', () => {
  assert.deepEqual(parse(''), { actions: [], decisions: [], questions: [] });
  assert.deepEqual(parse(null), { actions: [], decisions: [], questions: [] });
  assert.equal(parse('ACTION:').actions.length, 0);
  assert.equal(parse('ACTION: by Friday').actions.length, 0, 'a due date alone is not a task');
});

test('"may" the verb is not confused with the month', () => {
  assert.equal(parse('ACTION: Finance may approve it').actions[0].due, '');
  assert.equal(parse('ACTION: Finance approval by May 5').actions[0].due, '2027-05-05');
});

test('toMarkdown / toEmail / toCsv', () => {
  const r = parse(['Decision: go ahead', 'ACTION: @Ana to book room by Friday urgent', 'Q: budget?'].join('\n'));
  const md = core.toMarkdown(r, 'Kickoff');
  assert.match(md, /^# Kickoff/);
  assert.match(md, /- \[ \] \*\*Ana\*\*: Book room \(due Fri 23 Oct 2026\)/);
  assert.match(md, /## Decisions\n- Go ahead/);
  const email = core.toEmail(r, 'the kickoff');
  assert.match(email, /ACTION ITEMS\n {2}1\. Ana - Book room \(by Fri 23 Oct 2026\) \[urgent\]/);
  const csv = core.toCsv(r);
  assert.ok(csv.startsWith('\ufeffType,Owner,Item,Due,Priority,Done\r\n'));
  assert.match(csv, /Action,Ana,Book room,2026-10-23,high,no/);
});

test('toIcs: all-day events for open, dated actions only; escapes and folds', () => {
  const ics = core.toIcs(
    [
      { text: 'Send report, final; v2', owner: 'Ana', due: '2026-10-23', priority: 'high', done: false },
      { text: 'Done already', owner: '', due: '2026-10-24', priority: '', done: true },
      { text: 'No date', owner: '', due: '', priority: '', done: false },
    ],
    '20261022T090000Z',
  );
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(ics, /DTSTART;VALUE=DATE:20261023\r\nDTEND;VALUE=DATE:20261024/);
  assert.match(ics, /SUMMARY:Ana: Send report\\, final\\; v2/);
  assert.match(ics, /PRIORITY:1/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  const long = core.toIcs([{ text: 'x'.repeat(200), owner: '', due: '2026-10-23', priority: '', done: false }], '20261022T090000Z');
  assert.ok(
    long.split('\r\n').every((l) => l.length <= 75),
    'lines folded at 75 characters',
  );
});

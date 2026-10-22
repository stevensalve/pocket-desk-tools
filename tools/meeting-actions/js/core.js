/**
 * Meeting Actions - core logic (pure functions, no DOM; unit-testable in Node).
 *
 * Reads free-form meeting notes and pulls out:
 *   - action items (with owner, due date and priority when they can be found)
 *   - decisions
 *   - open questions
 * It uses plain, explainable rules (keywords, checkboxes, headings, "Name will..."),
 * not AI. Every item records WHY it was picked (`reason`) so people can check it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ActionsCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;
  const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ------------------------------------------------------------ Dates

  const utc = (y, m0, d) => Date.UTC(y, m0, d);
  const iso = (t) => new Date(t).toISOString().slice(0, 10);

  function parseIso(text) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''));
    if (!m) throw new Error('Dates must look like 2026-10-22.');
    const t = utc(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(t);
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3])
      throw new Error('That date does not exist.');
    return t;
  }

  /** Real calendar date -> timestamp, or null when impossible (e.g. 31 Feb). */
  function realDate(y, m0, d) {
    const t = utc(y, m0, d);
    const x = new Date(t);
    return x.getUTCFullYear() === y && x.getUTCMonth() === m0 && x.getUTCDate() === d ? t : null;
  }

  const WD = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
  const MON =
    '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const DATE_ALT = [
    '\\d{4}-\\d{2}-\\d{2}',
    '\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MON + '(?:,?\\s+\\d{4})?',
    MON + '\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?',
    '\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?',
    '\\d{1,2}\\.\\d{1,2}\\.\\d{2,4}',
    'today|tonight|tomorrow|day after tomorrow|eod|eow|eom|end of (?:the )?(?:day|week|month)|next week|in \\d+ (?:days?|weeks?|months?)',
    '(?:this |next )?' + WD,
  ].join('|');

  const WD_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const MON_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  /**
   * Turn a phrase into "YYYY-MM-DD" relative to `todayIso`, or null if it is not a date.
   * opts.dayFirst (default true): read 5/11/2026 as 5 November.
   * A bare weekday means its next occurrence AFTER today; "next Friday" means the
   * Friday of next week; "this Friday" the Friday of the current Monday-Sunday week.
   */
  function parseDatePhrase(phrase, todayIso, opts) {
    const dayFirst = !opts || opts.dayFirst !== false;
    const today = parseIso(todayIso);
    const t = String(phrase).trim().toLowerCase().replace(/\s+/g, ' ');
    const T = new Date(today);
    const y = T.getUTCFullYear();
    let m;

    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) {
      const r = realDate(+m[1], +m[2] - 1, +m[3]);
      return r === null ? null : iso(r);
    }
    if (t === 'today' || t === 'tonight' || t === 'eod' || t === 'end of day' || t === 'end of the day') return iso(today);
    if (t === 'tomorrow') return iso(today + DAY);
    if (t === 'day after tomorrow') return iso(today + 2 * DAY);
    if (t === 'eow' || /^end of (the )?week$/.test(t)) {
      const wd = T.getUTCDay();
      const toFri = wd === 6 ? 6 : wd === 0 ? 5 : 5 - wd; // Sat/Sun -> the coming Friday
      return iso(today + toFri * DAY);
    }
    if (t === 'eom' || /^end of (the )?month$/.test(t)) return iso(utc(y, T.getUTCMonth() + 1, 0));
    if (t === 'next week') return iso(today + ((8 - T.getUTCDay()) % 7 || 7) * DAY);
    if ((m = /^in (\d+) (day|week|month)s?$/.exec(t))) {
      const n = +m[1];
      if (m[2] === 'month') {
        const target = utc(y, T.getUTCMonth() + n, 1);
        const last = new Date(utc(new Date(target).getUTCFullYear(), new Date(target).getUTCMonth() + 1, 0)).getUTCDate();
        return iso(utc(new Date(target).getUTCFullYear(), new Date(target).getUTCMonth(), Math.min(T.getUTCDate(), last)));
      }
      return iso(today + n * (m[2] === 'week' ? 7 : 1) * DAY);
    }
    if ((m = new RegExp('^(this |next )?(' + WD + ')$').exec(t))) {
      const target = WD_INDEX[m[2].slice(0, 3)];
      const wd = T.getUTCDay();
      const mondayThisWeek = today - ((wd + 6) % 7) * DAY; // Monday of the current week
      const offsetFromMonday = (target + 6) % 7;
      if (m[1] === 'this ') return iso(mondayThisWeek + offsetFromMonday * DAY);
      if (m[1] === 'next ') return iso(mondayThisWeek + (7 + offsetFromMonday) * DAY);
      return iso(today + ((target - wd + 7) % 7 || 7) * DAY);
    }

    // Dates with an explicit day and month. Without a year, use the next occurrence.
    const withYear = (month0, day, yearText) => {
      if (yearText) {
        const yr = yearText.length === 2 ? 2000 + +yearText : +yearText;
        const r = realDate(yr, month0, day);
        return r === null ? null : iso(r);
      }
      let r = realDate(y, month0, day);
      if (r !== null && r < today) r = realDate(y + 1, month0, day);
      return r === null ? null : iso(r);
    };
    if ((m = new RegExp('^(\\d{1,2})(?:st|nd|rd|th)? (?:of )?(' + MON + ')(?:,? (\\d{4}))?$').exec(t)))
      return withYear(MON_INDEX[m[2].slice(0, 3)], +m[1], m[3]);
    if ((m = new RegExp('^(' + MON + ') (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?$').exec(t)))
      return withYear(MON_INDEX[m[1].slice(0, 3)], +m[2], m[3]);
    if ((m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(t))) {
      let day = +m[1];
      let month = +m[2];
      if (!dayFirst || month > 12) [day, month] = [month, day];
      if (month < 1 || month > 12) return null;
      return withYear(month - 1, day, m[3]);
    }
    return null;
  }

  /** "2026-10-23" -> "Fri 23 Oct 2026" */
  function formatDate(isoDate) {
    const d = new Date(parseIso(isoDate));
    return (
      DAY_NAMES[d.getUTCDay()].slice(0, 3) +
      ' ' +
      d.getUTCDate() +
      ' ' +
      MONTH_NAMES[d.getUTCMonth()].slice(0, 3) +
      ' ' +
      d.getUTCFullYear()
    );
  }

  // ----------------------------------------------------------- Parsing

  const NOT_NAMES = new Set([
    'We',
    'I',
    'They',
    'It',
    'He',
    'She',
    'You',
    'This',
    'That',
    'There',
    'Everyone',
    'Someone',
    'Anyone',
    'Team',
    'The',
    'Action',
    'Todo',
    'Decision',
    'Note',
    'Notes',
    'Question',
    'Next',
    'Follow',
  ]);
  const SECTION_RE =
    /^\s*(?:#{1,6}\s*)?(actions?(?: items?| points?)?|to-?dos?|next steps?|follow[- ]?ups?|decisions?|decided|agreements?|(?:open )?questions?|parking lot|attendees?|agenda|notes?|discussion|summary)\s*:?\s*$/i;
  const BULLET_RE = /^\s*(?:[-*\u2022\u2013]|\d+[.)])\s+/;
  const CHECKBOX_RE = /^\s*(?:[-*\u2022]\s*)?(?:\[( |x|X)\]|(\u2610)|(\u2611|\u2705))\s*/;
  const ACTION_KEYWORD_RE = /^(?:action(?: item| point)?s?|ai|todo|to-do|to do|follow[- ]?up|next step)\s*[:\-\u2013]\s*/i;
  const DECISION_RE =
    /^(?:decision|decided|agreed|agreement|resolved|resolution)\s*[:\-\u2013]\s*|^we (?:decided|agreed)(?: to| that)?\s+/i;
  const QUESTION_RE = /^(?:q|question|open question|unanswered)\s*[:\-\u2013]\s*/i;
  const DUE_RE = new RegExp('\\b(?:by|due(?: on| by)?|before|until|on|deadline:?)\\s+(' + DATE_ALT + ')\\b', 'i');
  const LOOSE_DATE_RE = new RegExp('\\b(\\d{4}-\\d{2}-\\d{2}|today|tomorrow|tonight|eod|eow|day after tomorrow|next week)\\b', 'i');
  const PRIORITY_RE = /\b(?:urgent(?:ly)?|asap|high priority|critical|p1)\b|!{2,}/i;

  const tidy = (s) =>
    s
      .replace(/\s+/g, ' ')
      .replace(/\(\s*\)/g, '')
      .replace(/^[\s,;:\-\u2013.]+|[\s,;:\-\u2013.(]+$/g, '')
      .trim();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  /**
   * Find an owner in a line; returns { owner, rest, implicit } where `rest` is the
   * line without the owner wording and `implicit` is true for the weaker
   * "Name will ..." wording (shown to the user as a lower-confidence guess).
   */
  function extractOwner(line, opts) {
    const o = opts || {};
    let text = line;
    const owners = [];
    let implicit = false;

    text = text.replace(/(^|\s)@([A-Za-z][\w.-]*)/g, function (m, pre, name) {
      owners.push(name.replace(/\.$/, ''));
      return pre;
    });
    if (owners.length) text = text.replace(/^\s*(?:to|will|should|please|can you)\s+/i, '');
    text = text.replace(/\b(?:owner|assigned to|assignee)\s*:?\s*([A-Z][\w'-]*(?: [A-Z][\w'-]*)?)/i, function (m, name) {
      owners.push(name);
      return '';
    });
    text = text.replace(/\(([A-Z][a-z][\w'-]*(?: [A-Z][a-z][\w'-]*)?)\)\s*[.!]?\s*$/, function (m, name) {
      if (NOT_NAMES.has(name)) return m;
      owners.push(name);
      return '';
    });

    if (!owners.length) {
      const known = (o.attendees || []).map((a) => a.trim()).filter(Boolean);
      const knownAlt = known.length ? '|' + known.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : '';
      const lead = new RegExp(
        "^((?:[A-Z][a-z][\\w'-]*(?: [A-Z][a-z][\\w'-]*)?" +
          knownAlt +
          ")(?:(?:,| and|,? and) (?:[A-Z][a-z][\\w'-]*" +
          knownAlt +
          '))*)\\s+(?:will|to|should|needs to|must|can you|please|is going to|is to)\\s+',
      );
      const m = lead.exec(text);
      if (m) {
        const names = m[1].split(/,\s*|\s+and\s+/).filter((n) => n && !NOT_NAMES.has(n));
        if (names.length) {
          owners.push(...names);
          text = text.slice(m[0].length);
          implicit = true;
        }
      }
      if (!owners.length) {
        const me = /^I(?:'ll| will| am going to|'m going to)\s+/.exec(text);
        if (me) {
          owners.push(o.me || 'Me');
          text = text.slice(me[0].length);
          implicit = true;
        }
      }
    }
    return { owner: owners.join(', '), rest: text, implicit: implicit };
  }

  /** Find a due date; returns { due, rest } with the date wording removed from `rest`. */
  function extractDue(line, todayIso, opts) {
    let m = DUE_RE.exec(line);
    let useLoose = false;
    if (!m) {
      m = LOOSE_DATE_RE.exec(line);
      useLoose = true;
    }
    if (!m) return { due: '', rest: line };
    const due = parseDatePhrase(m[1], todayIso, opts);
    if (!due) return { due: '', rest: line };
    const removed = useLoose ? line.replace(m[0], '') : line.replace(m[0], '');
    return { due: due, rest: removed };
  }

  /**
   * Read the notes. opts: { today: "YYYY-MM-DD" (required), dayFirst, attendees: [names], me: "Your name" }
   * Returns { actions, decisions, questions }. Items:
   *   action:   { text, owner, due, priority: "high"|"", done, reason, confidence: "high"|"low", line }
   *   decision/question: { text, line }
   */
  function parseNotes(notes, opts) {
    const o = opts || {};
    if (!o.today) throw new Error('A reference date is needed to understand "Friday" or "tomorrow".');
    parseIso(o.today);
    const actions = [];
    const decisions = [];
    const questions = [];
    let section = 'other';

    String(notes == null ? '' : notes)
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .forEach(function (rawLine, idx) {
        const lineNo = idx + 1;
        if (!rawLine.trim()) return;

        const heading = SECTION_RE.exec(rawLine);
        if (heading) {
          const h = heading[1].toLowerCase();
          section = /^(action|to-?do|next step|follow)/.test(h)
            ? 'actions'
            : /^(decision|decided|agreement)/.test(h)
              ? 'decisions'
              : /question|parking/.test(h)
                ? 'questions'
                : 'other';
          return;
        }

        let line = rawLine.trim();
        let reason = '';
        let done = false;

        const box = CHECKBOX_RE.exec(line);
        if (box) {
          done = !!(box[1] && box[1].toLowerCase() === 'x') || !!box[3];
          line = line.slice(box[0].length);
          reason = 'checkbox';
        } else {
          line = line.replace(BULLET_RE, '');
        }

        if (!reason && ACTION_KEYWORD_RE.test(line)) {
          line = line.replace(ACTION_KEYWORD_RE, '');
          reason = 'keyword';
        }
        if (!reason) {
          if (DECISION_RE.test(line)) {
            decisions.push({ text: cap(tidy(line.replace(DECISION_RE, ''))), line: lineNo });
            return;
          }
          if (QUESTION_RE.test(line)) {
            questions.push({ text: cap(tidy(line.replace(QUESTION_RE, ''))), line: lineNo });
            return;
          }
          if (section === 'decisions') {
            decisions.push({ text: cap(tidy(line)), line: lineNo });
            return;
          }
          if (section === 'questions') {
            questions.push({ text: cap(tidy(line)), line: lineNo });
            return;
          }
          if (section === 'actions') reason = 'section';
        }

        const ownerInfo = extractOwner(line, o);
        if (!reason && !ownerInfo.implicit) return; // a plain sentence - not an action
        if (!reason) reason = 'owner-wording';
        // "Name: do something" inside an Actions section
        let owner = ownerInfo.owner;
        let rest = ownerInfo.rest;
        if (!owner && reason === 'section') {
          const colon = /^([A-Z][a-z][\w'-]*(?: [A-Z][a-z][\w'-]*)?)\s*:\s+/.exec(rest);
          if (colon && !NOT_NAMES.has(colon[1])) {
            owner = colon[1];
            rest = rest.slice(colon[0].length);
          }
        }
        const dueInfo = extractDue(rest, o.today, o);
        const priority = PRIORITY_RE.test(rest) ? 'high' : '';
        const text = cap(tidy(dueInfo.rest.replace(PRIORITY_RE, '')));
        if (!text) return;
        actions.push({
          text: text,
          owner: owner,
          due: dueInfo.due,
          priority: priority,
          done: done,
          reason: reason,
          confidence: reason === 'owner-wording' ? 'low' : 'high',
          line: lineNo,
        });
      });

    return { actions: actions, decisions: decisions, questions: questions };
  }

  // ---------------------------------------------------------- Output

  const dueText = (a) => (a.due ? formatDate(a.due) : '');

  /** Markdown for pasting into chat, wikis and task tools. */
  function toMarkdown(result, title) {
    const out = [];
    if (title) out.push('# ' + title, '');
    if (result.actions.length) {
      out.push('## Action items');
      result.actions.forEach((a) =>
        out.push(
          '- [' +
            (a.done ? 'x' : ' ') +
            '] ' +
            (a.owner ? '**' + a.owner + '**: ' : '') +
            a.text +
            (a.due ? ' (due ' + dueText(a) + ')' : '') +
            (a.priority ? ' \u2757' : ''),
        ),
      );
      out.push('');
    }
    if (result.decisions.length) {
      out.push('## Decisions');
      result.decisions.forEach((d) => out.push('- ' + d.text));
      out.push('');
    }
    if (result.questions.length) {
      out.push('## Open questions');
      result.questions.forEach((q) => out.push('- ' + q.text));
      out.push('');
    }
    return out.join('\n').trimEnd() + '\n';
  }

  /** Plain text for the body of a follow-up e-mail. */
  function toEmail(result, title) {
    const out = ['Hi all,', '', 'Here is a summary' + (title ? ' of ' + title : '') + '.', ''];
    if (result.decisions.length) {
      out.push('DECISIONS');
      result.decisions.forEach((d) => out.push('  * ' + d.text));
      out.push('');
    }
    if (result.actions.length) {
      out.push('ACTION ITEMS');
      result.actions.forEach((a, i) =>
        out.push(
          '  ' +
            (i + 1) +
            '. ' +
            (a.owner ? a.owner + ' - ' : '') +
            a.text +
            (a.due ? ' (by ' + dueText(a) + ')' : '') +
            (a.priority ? ' [urgent]' : ''),
        ),
      );
      out.push('');
    }
    if (result.questions.length) {
      out.push('OPEN QUESTIONS');
      result.questions.forEach((q) => out.push('  ? ' + q.text));
      out.push('');
    }
    out.push('Please reply if anything is missing or wrong.', '', 'Thanks');
    return out.join('\n');
  }

  /** CSV with a BOM so Excel shows accents correctly. */
  function toCsv(result) {
    const cell = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = [['Type', 'Owner', 'Item', 'Due', 'Priority', 'Done']];
    result.actions.forEach((a) => rows.push(['Action', a.owner, a.text, a.due, a.priority, a.done ? 'yes' : 'no']));
    result.decisions.forEach((d) => rows.push(['Decision', '', d.text, '', '', '']));
    result.questions.forEach((q) => rows.push(['Question', '', q.text, '', '', '']));
    return '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  }

  const icsEscape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  /** Fold long lines at 75 characters as the calendar format requires. */
  const fold = (line) => (line.length <= 75 ? line : line.slice(0, 75) + '\r\n' + fold(' ' + line.slice(75)));

  /**
   * Calendar file (.ics) with an all-day event for each action that has a due date.
   * `stamp` is the creation time as "YYYYMMDDTHHMMSSZ" (passed in so tests are deterministic).
   */
  function toIcs(actions, stamp) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pocket Desk Tools//Meeting Actions//EN', 'CALSCALE:GREGORIAN'];
    actions
      .filter((a) => a.due && !a.done)
      .forEach(function (a, i) {
        const start = a.due.replace(/-/g, '');
        const end = iso(parseIso(a.due) + DAY).replace(/-/g, '');
        lines.push(
          'BEGIN:VEVENT',
          'UID:action-' + start + '-' + (i + 1) + '@pocket-desk-tools.local',
          'DTSTAMP:' + stamp,
          'DTSTART;VALUE=DATE:' + start,
          'DTEND;VALUE=DATE:' + end,
          'SUMMARY:' + icsEscape((a.owner ? a.owner + ': ' : '') + a.text),
        );
        if (a.priority) lines.push('PRIORITY:1');
        lines.push('END:VEVENT');
      });
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  return {
    parseDatePhrase: parseDatePhrase,
    formatDate: formatDate,
    parseNotes: parseNotes,
    toMarkdown: toMarkdown,
    toEmail: toEmail,
    toCsv: toCsv,
    toIcs: toIcs,
  };
});

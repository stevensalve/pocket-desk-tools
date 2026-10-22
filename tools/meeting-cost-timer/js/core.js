/**
 * Meeting Cost Timer - core logic (pure; time is always passed in).
 *
 * The running cost is computed from timestamps (now - start), never from counting ticks,
 * so it stays correct when the tab is throttled or the laptop sleeps.
 * Rates are "per hour, per person" in whatever currency the user picks; nothing is converted.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CostCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOUR = 3600000;

  /** Parse a money/rate field: "85", "1,250.50", " 40 " -> number; anything else -> null. */
  function parseAmount(text) {
    const t = String(text == null ? '' : text)
      .trim()
      .replace(/,/g, '');
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) && n <= 1e7 ? n : null;
  }

  /**
   * Total cost per hour for a list of groups: [{ count, rate }]
   * (e.g. 3 people at 80/h and 1 at 150/h). Invalid or negative entries are ignored.
   */
  function hourlyCost(groups) {
    return (groups || []).reduce((sum, g) => {
      const c = Number(g.count);
      const r = Number(g.rate);
      return Number.isFinite(c) && Number.isFinite(r) && c > 0 && r >= 0 ? sum + Math.floor(c) * r : sum;
    }, 0);
  }

  const headcount = (groups) => (groups || []).reduce((n, g) => (Number(g.count) > 0 ? n + Math.floor(Number(g.count)) : n), 0);

  /** Cost of a meeting of `ms` milliseconds at `perHour` per hour. */
  function costFor(perHour, ms) {
    return perHour * (Math.max(0, ms) / HOUR);
  }

  /**
   * Timer state from timestamps. state: { startedAt, pausedAt, pausedTotal } (ms; null when not set).
   * Returns elapsed milliseconds at `now`.
   */
  function elapsed(state, now) {
    if (!state || state.startedAt == null) return 0;
    const end = state.pausedAt != null ? state.pausedAt : now;
    return Math.max(0, end - state.startedAt - (state.pausedTotal || 0));
  }

  const idle = () => ({ startedAt: null, pausedAt: null, pausedTotal: 0 });
  function start(now) {
    return { startedAt: now, pausedAt: null, pausedTotal: 0 };
  }
  function pause(state, now) {
    return state.startedAt == null || state.pausedAt != null ? state : Object.assign({}, state, { pausedAt: now });
  }
  function resume(state, now) {
    return state.pausedAt == null
      ? state
      : Object.assign({}, state, { pausedAt: null, pausedTotal: (state.pausedTotal || 0) + (now - state.pausedAt) });
  }
  const isRunning = (s) => s.startedAt != null && s.pausedAt == null;

  /** 3725000 -> "1:02:05"; under an hour -> "2:05". */
  function formatDuration(ms) {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
  }

  /** Money text with the currency symbol and thousands separators. Uses 2 decimals under 1000, else none. */
  function formatMoney(amount, symbol) {
    const a = Math.max(0, amount);
    const digits = a < 1000 ? 2 : 0;
    const s = a.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return (symbol || '') + s;
  }

  /**
   * What a recurring meeting costs over a year. frequency: "daily" (250 working days), "weekly" (52),
   * "biweekly" (26), "monthly" (12), "quarterly" (4), "once" (1).
   */
  const PER_YEAR = { once: 1, daily: 250, weekly: 52, biweekly: 26, monthly: 12, quarterly: 4 };
  function annualCost(perHour, minutes, frequency) {
    const n = PER_YEAR[frequency];
    if (n === undefined) throw new Error('Unknown frequency: ' + frequency);
    return costFor(perHour, minutes * 60000) * n;
  }

  /** Friendly "what could this buy" line based on the money amount (kept simple and unit-free). */
  function perspective(annual, perHour) {
    if (!(perHour > 0)) return '';
    const hours = annual / perHour;
    if (hours < 1) return '';
    const days = hours / 8;
    return (
      'That is about ' +
      (days >= 1
        ? Math.round(days) + ' person-day' + (Math.round(days) === 1 ? '' : 's')
        : Math.round(hours) + ' person-hour' + (Math.round(hours) === 1 ? '' : 's')) +
      ' of time per year, at the average rate.'
    );
  }

  /** Meeting log entry -> plain object (validated, trimmed). */
  function makeLogEntry(input) {
    const title =
      String(input.title || '')
        .trim()
        .slice(0, 80) || 'Meeting';
    const ms = Number(input.ms);
    const cost = Number(input.cost);
    if (!Number.isFinite(ms) || ms < 0 || !Number.isFinite(cost) || cost < 0) throw new Error('Invalid log entry.');
    return {
      title: title,
      date: String(input.date || ''),
      ms: Math.round(ms),
      cost: Math.round(cost * 100) / 100,
      people: Math.max(0, Math.floor(Number(input.people) || 0)),
      symbol: String(input.symbol || '').slice(0, 4),
    };
  }

  /** Validate a saved log read back from storage. Anything unexpected is dropped, never thrown. */
  function loadLog(text) {
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) return [];
      const out = [];
      arr.slice(0, 200).forEach((e) => {
        try {
          out.push(makeLogEntry(e));
        } catch (err) {
          /* skip a damaged entry */
        }
      });
      return out;
    } catch (e) {
      return [];
    }
  }

  function logCsv(log) {
    const cell = (v) => {
      const s = String(v);
      const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
      return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
    };
    const rows = [['Title', 'Date', 'Minutes', 'People', 'Cost', 'Currency']];
    log.forEach((e) => rows.push([e.title, e.date, (e.ms / 60000).toFixed(1), e.people, e.cost.toFixed(2), e.symbol]));
    return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  }

  return {
    parseAmount: parseAmount,
    hourlyCost: hourlyCost,
    headcount: headcount,
    costFor: costFor,
    elapsed: elapsed,
    idle: idle,
    start: start,
    pause: pause,
    resume: resume,
    isRunning: isRunning,
    formatDuration: formatDuration,
    formatMoney: formatMoney,
    annualCost: annualCost,
    perspective: perspective,
    makeLogEntry: makeLogEntry,
    loadLog: loadLog,
    logCsv: logCsv,
  };
});

/**
 * Spreadsheet Diff - core logic (pure; SheetJS is only used by the UI to read files).
 *
 * A table is an array of rows (arrays); row 0 holds the column headers.
 * Columns are matched by header name, not position, so reordered columns are not "changes".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DiffCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const str = (v) => (v === null || v === undefined ? '' : String(v));

  /** Header row + records. Blank header cells become "Column N"; duplicate headers get " (2)", " (3)". */
  function toRecords(aoa) {
    const numbered = (aoa || [])
      .map((r, i) => ({ r: r, n: i + 1 }))
      .filter((x) => Array.isArray(x.r) && x.r.some((c) => str(c).trim() !== ''));
    if (!numbered.length) return { headers: [], records: [] };
    const rows = numbered.map((x) => x.r);
    const seen = {};
    const headers = rows[0].map((h, i) => {
      let name = str(h).trim() || 'Column ' + (i + 1);
      const k = name.toLowerCase();
      seen[k] = (seen[k] || 0) + 1;
      if (seen[k] > 1) name += ' (' + seen[k] + ')';
      return name;
    });
    const records = numbered.slice(1).map((x) => {
      const r = x.r;
      const rec = { __row: x.n }; // the row number as shown in the spreadsheet (blank rows still count)
      headers.forEach((h, i) => (rec[h] = str(r[i])));
      return rec;
    });
    return { headers: headers, records: records };
  }

  const NUM_RE = /^[+-]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$|^[+-]?\.\d+$/;
  function asNumber(s) {
    const t = str(s).trim();
    return NUM_RE.test(t) ? Number(t.replace(/,/g, '')) : null;
  }

  /** Are two cell values "the same" under the options? opts: { trim, ignoreCase, tolerance }. */
  function sameValue(a, b, opts) {
    const o = opts || {};
    let x = str(a);
    let y = str(b);
    if (o.trim !== false) {
      x = x.trim().replace(/\s+/g, ' ');
      y = y.trim().replace(/\s+/g, ' ');
    }
    if (o.ignoreCase) {
      x = x.toLowerCase();
      y = y.toLowerCase();
    }
    if (x === y) return true;
    const nx = asNumber(x);
    const ny = asNumber(y);
    if (nx !== null && ny !== null) return Math.abs(nx - ny) <= (o.tolerance || 0);
    return false;
  }

  /** Key text for matching rows: values of the key columns, normalised the same way as comparison. */
  function keyOf(rec, keyCols, o) {
    return keyCols
      .map((k) => {
        let v = str(rec[k]);
        if (o.trim !== false) v = v.trim().replace(/\s+/g, ' ');
        if (o.ignoreCase) v = v.toLowerCase();
        return v;
      })
      .join('\u0001');
  }

  /** First column whose values are all present and unique - a good default key (or "" if none). */
  function suggestKey(table) {
    for (const h of table.headers) {
      const vals = table.records.map((r) => r[h].trim());
      if (vals.length && vals.every((v) => v !== '') && new Set(vals).size === vals.length) return h;
    }
    return '';
  }

  /**
   * Compare two tables (from toRecords).
   * opts: { key: string | string[] | "" (empty = compare row by row), ignoreCase, trim (default true), tolerance }
   * Returns {
   *   columns: [...],                 // A's headers, then headers only in B
   *   onlyInA: [...], onlyInB: [...], // column names present on one side only
   *   rows: [{ status: "same"|"changed"|"added"|"removed", key, rowA, rowB, a, b, changed: [column names] }],
   *   summary: { same, changed, added, removed, cells }
   * }
   */
  function diffTables(ta, tb, opts) {
    const o = Object.assign({ trim: true, ignoreCase: false, tolerance: 0, key: '' }, opts);
    const lowerB = new Map(tb.headers.map((h) => [h.toLowerCase(), h]));
    const lowerA = new Map(ta.headers.map((h) => [h.toLowerCase(), h]));
    const colMap = new Map(); // A header -> B header
    ta.headers.forEach((h) => {
      if (lowerB.has(h.toLowerCase())) colMap.set(h, lowerB.get(h.toLowerCase()));
    });
    const onlyInA = ta.headers.filter((h) => !colMap.has(h));
    const onlyInB = tb.headers.filter((h) => !lowerA.has(h.toLowerCase()));
    const columns = ta.headers.concat(onlyInB);
    const shared = Array.from(colMap.keys());

    const keyList = (Array.isArray(o.key) ? o.key : o.key ? [o.key] : []).filter(Boolean);
    keyList.forEach((k) => {
      if (!colMap.has(k)) throw new Error('The key column "' + k + '" must exist in both files.');
    });

    // View B's record using A's header names.
    const viewB = (rec) => {
      const v = { __row: rec.__row };
      colMap.forEach((bName, aName) => (v[aName] = rec[bName]));
      onlyInB.forEach((h) => (v[h] = rec[h]));
      return v;
    };
    const bRecs = tb.records.map(viewB);
    const aRecs = ta.records.map((r) => r);

    const pairs = []; // { a, b }
    if (keyList.length) {
      const bBuckets = new Map();
      bRecs.forEach((r) => {
        const k = keyOf(r, keyList, o);
        if (!bBuckets.has(k)) bBuckets.set(k, []);
        bBuckets.get(k).push(r);
      });
      aRecs.forEach((r) => {
        const bucket = bBuckets.get(keyOf(r, keyList, o));
        pairs.push({ a: r, b: bucket && bucket.length ? bucket.shift() : null });
      });
      bRecs.forEach((r) => {
        const bucket = bBuckets.get(keyOf(r, keyList, o));
        if (bucket && bucket.indexOf(r) !== -1) {
          bucket.splice(bucket.indexOf(r), 1);
          pairs.push({ a: null, b: r });
        }
      });
    } else {
      const n = Math.max(aRecs.length, bRecs.length);
      for (let i = 0; i < n; i++) pairs.push({ a: aRecs[i] || null, b: bRecs[i] || null });
    }

    const summary = { same: 0, changed: 0, added: 0, removed: 0, cells: 0 };
    const rows = pairs.map(function (p) {
      let status;
      let changed = [];
      if (!p.b) status = 'removed';
      else if (!p.a) status = 'added';
      else {
        changed = shared.filter((h) => !sameValue(p.a[h], p.b[h], o));
        status = changed.length ? 'changed' : 'same';
        summary.cells += changed.length;
      }
      summary[status]++;
      const src = p.a || p.b;
      return {
        status: status,
        key: keyList.length ? keyList.map((k) => str(src[k])).join(' / ') : '',
        rowA: p.a ? p.a.__row : null,
        rowB: p.b ? p.b.__row : null,
        a: p.a,
        b: p.b,
        changed: changed,
      };
    });

    return { columns: columns, onlyInA: onlyInA, onlyInB: onlyInB, rows: rows, summary: summary };
  }

  const cell = (v) => {
    const s = str(v);
    // Neutralise spreadsheet formula injection when the report is opened in Excel.
    const safe = /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?$/.test(s) ? "'" + s : s;
    return /[",\r\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
  };

  /** Cell-level change report as CSV (BOM for Excel): one line per difference. */
  function toCsv(result) {
    const lines = [['Status', 'Key', 'Row in A', 'Row in B', 'Column', 'Value in A', 'Value in B']];
    result.rows.forEach((r) => {
      if (r.status === 'same') return;
      if (r.status === 'changed') r.changed.forEach((c) => lines.push([r.status, r.key, r.rowA, r.rowB, c, r.a[c], r.b[c]]));
      else lines.push([r.status, r.key, r.rowA, r.rowB, '', '', '']);
    });
    return '﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n');
  }

  /** Short plain-language summary line. */
  function summaryText(s) {
    if (!s.changed && !s.added && !s.removed) return 'The two sheets match: no differences found.';
    const parts = [];
    if (s.changed)
      parts.push(s.changed + ' row' + (s.changed === 1 ? '' : 's') + ' changed (' + s.cells + ' cell' + (s.cells === 1 ? '' : 's') + ')');
    if (s.added) parts.push(s.added + ' added');
    if (s.removed) parts.push(s.removed + ' removed');
    return parts.join(', ') + '; ' + s.same + ' unchanged.';
  }

  return {
    toRecords: toRecords,
    sameValue: sameValue,
    suggestKey: suggestKey,
    diffTables: diffTables,
    toCsv: toCsv,
    summaryText: summaryText,
  };
});

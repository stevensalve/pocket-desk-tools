/**
 * Timezone Planner - core logic (pure functions; unit-testable in Node).
 *
 * Uses the browser's built-in Intl database for offsets, so daylight-saving
 * changes are handled correctly for any date, with no network and no library.
 * "Wall time" means the clock reading in a zone, e.g. 2026-10-22 09:00 in Tokyo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TzCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MIN = 60000;
  const HOUR = 3600000;

  /** A starter list of popular cities -> IANA zone names. Users can also type any IANA name. */
  const CITIES = [
    ['Auckland', 'Pacific/Auckland'],
    ['Sydney', 'Australia/Sydney'],
    ['Melbourne', 'Australia/Melbourne'],
    ['Perth', 'Australia/Perth'],
    ['Tokyo', 'Asia/Tokyo'],
    ['Seoul', 'Asia/Seoul'],
    ['Beijing', 'Asia/Shanghai'],
    ['Hong Kong', 'Asia/Hong_Kong'],
    ['Singapore', 'Asia/Singapore'],
    ['Manila', 'Asia/Manila'],
    ['Jakarta', 'Asia/Jakarta'],
    ['Bangkok', 'Asia/Bangkok'],
    ['Dhaka', 'Asia/Dhaka'],
    ['Kolkata / Mumbai', 'Asia/Kolkata'],
    ['Karachi', 'Asia/Karachi'],
    ['Dubai', 'Asia/Dubai'],
    ['Tehran', 'Asia/Tehran'],
    ['Riyadh', 'Asia/Riyadh'],
    ['Moscow', 'Europe/Moscow'],
    ['Istanbul', 'Europe/Istanbul'],
    ['Cairo', 'Africa/Cairo'],
    ['Nairobi', 'Africa/Nairobi'],
    ['Johannesburg', 'Africa/Johannesburg'],
    ['Lagos', 'Africa/Lagos'],
    ['Athens', 'Europe/Athens'],
    ['Berlin', 'Europe/Berlin'],
    ['Paris', 'Europe/Paris'],
    ['Madrid', 'Europe/Madrid'],
    ['Rome', 'Europe/Rome'],
    ['Amsterdam', 'Europe/Amsterdam'],
    ['Stockholm', 'Europe/Stockholm'],
    ['London', 'Europe/London'],
    ['Dublin', 'Europe/Dublin'],
    ['Lisbon', 'Europe/Lisbon'],
    ['Reykjavik', 'Atlantic/Reykjavik'],
    ['Sao Paulo', 'America/Sao_Paulo'],
    ['Buenos Aires', 'America/Argentina/Buenos_Aires'],
    ['Bogota', 'America/Bogota'],
    ['New York', 'America/New_York'],
    ['Toronto', 'America/Toronto'],
    ['Chicago', 'America/Chicago'],
    ['Mexico City', 'America/Mexico_City'],
    ['Denver', 'America/Denver'],
    ['Phoenix', 'America/Phoenix'],
    ['Los Angeles', 'America/Los_Angeles'],
    ['Vancouver', 'America/Vancouver'],
    ['Anchorage', 'America/Anchorage'],
    ['Honolulu', 'Pacific/Honolulu'],
    ['UTC', 'UTC'],
  ].map((c) => ({ city: c[0], zone: c[1] }));

  function isValidZone(zone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone });
      return typeof zone === 'string' && zone.length > 0;
    } catch (e) {
      return false;
    }
  }

  const formatterCache = {};
  function partsFormatter(zone) {
    if (!formatterCache[zone]) {
      formatterCache[zone] = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    return formatterCache[zone];
  }

  /** Clock reading of an instant in a zone -> { year, month, day, hour, minute, second, weekday (0=Sun) }. */
  function wallParts(ms, zone) {
    if (!isValidZone(zone)) throw new Error('Unknown time zone: ' + zone);
    const o = {};
    partsFormatter(zone)
      .formatToParts(new Date(ms))
      .forEach((p) => {
        if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10);
      });
    const asUtc = Date.UTC(o.year, o.month - 1, o.day);
    return {
      year: o.year,
      month: o.month,
      day: o.day,
      hour: o.hour % 24,
      minute: o.minute,
      second: o.second,
      weekday: new Date(asUtc).getUTCDay(),
    };
  }

  /** Offset from UTC in minutes at an instant (Tokyo = 540, New York in summer = -240). */
  function offsetMinutes(ms, zone) {
    const w = wallParts(ms, zone);
    const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
    return Math.round((asIfUtc - Math.floor(ms / 1000) * 1000) / MIN);
  }

  /**
   * Convert a wall time in a zone to an instant (ms since epoch).
   * Daylight-saving edge cases:
   *   - a time that does not exist (spring forward gap) is moved forward by the gap;
   *   - a time that happens twice (autumn fall back) uses the first occurrence.
   */
  function zonedToInstant(y, mo, d, h, mi, zone) {
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    // Try offsets valid around the guess; pick the one that round-trips.
    const candidates = [];
    [-1, 0, 1].forEach((k) => {
      const off = offsetMinutes(guess + k * 12 * HOUR, zone);
      const t = guess - off * MIN;
      if (candidates.indexOf(t) === -1) candidates.push(t);
    });
    const valid = candidates.filter((t) => {
      const w = wallParts(t, zone);
      return w.year === y && w.month === mo && w.day === d && w.hour === h && w.minute === mi;
    });
    if (valid.length) return Math.min.apply(null, valid);
    // Gap: interpret with the offset from just BEFORE the transition.
    const before = Math.min.apply(
      null,
      candidates.map((t) => t),
    );
    const offBefore = offsetMinutes(before - HOUR, zone);
    return guess - offBefore * MIN;
  }

  /** "UTC+5:30" style label. */
  function offsetLabel(minutes) {
    const sign = minutes < 0 ? '-' : '+';
    const a = Math.abs(minutes);
    const h = Math.floor(a / 60);
    const m = a % 60;
    return 'UTC' + sign + h + (m ? ':' + String(m).padStart(2, '0') : '');
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /**
   * Describe an instant in a zone.
   * Returns { date: "2026-10-22", time: "09:00", time12: "9:00 AM", weekday: "Thu", offset: 540, label: "UTC+9",
   *           dayShift: -1|0|1 relative to the `baseZone` calendar day (when baseZone is given) }
   */
  function describe(ms, zone, baseZone) {
    const w = wallParts(ms, zone);
    const off = offsetMinutes(ms, zone);
    const out = {
      date: w.year + '-' + pad2(w.month) + '-' + pad2(w.day),
      time: pad2(w.hour) + ':' + pad2(w.minute),
      time12: (w.hour % 12 || 12) + ':' + pad2(w.minute) + ' ' + (w.hour < 12 ? 'AM' : 'PM'),
      weekday: DAYS[w.weekday],
      pretty: DAYS[w.weekday] + ' ' + w.day + ' ' + MONTHS[w.month - 1],
      offset: off,
      label: offsetLabel(off),
      dayShift: 0,
    };
    if (baseZone) {
      const b = wallParts(ms, baseZone);
      out.dayShift = Math.round((Date.UTC(w.year, w.month - 1, w.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86400000);
    }
    return out;
  }

  /** "HH:MM" -> minutes after midnight (throws on bad input). */
  function parseClock(text) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(text).trim());
    if (!m || +m[1] > 24 || +m[2] > 59 || (+m[1] === 24 && +m[2] !== 0)) throw new Error('Times must look like 09:30.');
    return +m[1] * 60 + +m[2];
  }

  /**
   * Find the start times (in `baseZone`, on `dateIso`) that suit everyone.
   * zones: [{ zone, start: "09:00", end: "17:00" }]   (working hours in each zone's own clock)
   * Scans in `step` minutes (default 30). A slot works when the whole meeting
   * [start, start+duration] is inside every zone's working hours on the same local day.
   * Returns { slots: [{ startMs, endMs }], windows: [{ startMs, endMs }] } where windows merge adjacent slots.
   */
  function findOverlap(dateIso, baseZone, zones, durationMin, opts) {
    const step = (opts && opts.step) || 30;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
    if (!m) throw new Error('Date must look like 2026-10-22.');
    if (!zones.length) return { slots: [], windows: [] };
    if (!(durationMin > 0)) throw new Error('The meeting length must be more than zero minutes.');
    const dayStart = zonedToInstant(+m[1], +m[2], +m[3], 0, 0, baseZone);
    const dayEnd = zonedToInstant(+m[1], +m[2], +m[3] + 1, 0, 0, baseZone);
    const rules = zones.map((z) => ({ zone: z.zone, start: parseClock(z.start), end: parseClock(z.end), days: z.days }));
    const slots = [];
    for (let t = dayStart; t < dayEnd; t += step * MIN) {
      const end = t + durationMin * MIN;
      const ok = rules.every((r) => {
        if (r.end <= r.start) return false;
        const a = wallParts(t, r.zone);
        const b = wallParts(end, r.zone);
        if (a.year !== b.year || a.month !== b.month || a.day !== b.day) {
          // ending exactly at midnight is OK when working hours run to 24:00
          if (!(
            r.end === 1440 &&
            b.hour === 0 &&
            b.minute === 0 &&
            Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day) === 86400000
          ))
            return false;
          return a.hour * 60 + a.minute >= r.start;
        }
        if (r.days && r.days.indexOf(a.weekday) === -1) return false;
        const s = a.hour * 60 + a.minute;
        return s >= r.start && s + durationMin <= r.end;
      });
      if (ok) slots.push({ startMs: t, endMs: end });
    }
    const windows = [];
    slots.forEach((s) => {
      const last = windows[windows.length - 1];
      if (last && s.startMs <= last.endMs - durationMin * MIN + step * MIN) last.endMs = s.endMs;
      else windows.push({ startMs: s.startMs, endMs: s.endMs });
    });
    return { slots: slots, windows: windows };
  }

  /** Quality of a time for a zone given its working hours: "work" | "edge" (within 1h of the edges) | "off". */
  function workQuality(ms, zone, startMin, endMin) {
    const w = wallParts(ms, zone);
    const t = w.hour * 60 + w.minute;
    if (t >= startMin && t < endMin) return 'work';
    if (t >= startMin - 60 && t < endMin + 60) return 'edge';
    return 'off';
  }

  /** Plain-text invitation snippet showing the meeting in every zone. */
  function meetingText(startMs, durationMin, zones, title) {
    const endMs = startMs + durationMin * MIN;
    const base = zones[0] && zones[0].zone;
    const lines = [];
    if (title) lines.push(title);
    zones.forEach((z) => {
      const a = describe(startMs, z.zone, base);
      const b = describe(endMs, z.zone, base);
      lines.push(
        (z.name || z.zone) +
          ': ' +
          a.pretty +
          ', ' +
          a.time +
          '-' +
          b.time +
          ' (' +
          a.label +
          ')' +
          (b.date !== a.date ? ' [ends ' + b.pretty + ']' : ''),
      );
    });
    return lines.join('\n');
  }

  /** UTC timestamp for calendar links/files: "20261022T090000Z". */
  function icsStamp(ms) {
    return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  }

  /** A calendar file for the meeting. `nowMs` is passed in so output is deterministic. */
  function meetingIcs(startMs, durationMin, title, description, nowMs) {
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    return (
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Pocket Desk Tools//Timezone Planner//EN',
        'BEGIN:VEVENT',
        'UID:meeting-' + icsStamp(startMs) + '@pocket-desk-tools.local',
        'DTSTAMP:' + icsStamp(nowMs),
        'DTSTART:' + icsStamp(startMs),
        'DTEND:' + icsStamp(startMs + durationMin * MIN),
        'SUMMARY:' + esc(title || 'Meeting'),
        'DESCRIPTION:' + esc(description || ''),
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n') + '\r\n'
    );
  }

  return {
    CITIES: CITIES,
    isValidZone: isValidZone,
    wallParts: wallParts,
    offsetMinutes: offsetMinutes,
    zonedToInstant: zonedToInstant,
    offsetLabel: offsetLabel,
    describe: describe,
    parseClock: parseClock,
    findOverlap: findOverlap,
    workQuality: workQuality,
    meetingText: meetingText,
    icsStamp: icsStamp,
    meetingIcs: meetingIcs,
  };
});

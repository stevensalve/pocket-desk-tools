/**
 * PDF Redact & Stamp - core logic (no DOM; unit-testable in Node).
 *
 * TRUE redaction: drawing a black box over text in a PDF does not remove the
 * text underneath - anyone can select and copy it. To really remove it, every
 * page that has a redaction box is turned into a PICTURE (with the black boxes
 * painted in) and the original text and vector data of that page are dropped.
 * Pages without boxes are copied untouched.
 *
 * Coordinates: "display points" - origin top-left of the page as the user sees
 * it (rotation applied), 1 point = 1/72 inch. A page's `info` is
 * { x0, y0, width, height, rotation } (visible box in PDF space + clockwise
 * rotation), the same convention as the PDF Fill & Sign tool in this family.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('pdf-lib'));
  } else {
    root.RedactCore = factory(root.PDFLib);
  }
})(typeof self !== 'undefined' ? self : this, function (PDFLib) {
  'use strict';

  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

  // ------------------------------------------------------ Page selection

  /** "1-3, 5, 8-" -> sorted unique 0-based page indexes. Empty or "all" = every page. */
  function parsePages(spec, total) {
    if (!Number.isInteger(total) || total < 1) throw new Error('The PDF has no pages.');
    const text = String(spec == null ? '' : spec)
      .trim()
      .toLowerCase();
    if (text === '' || text === 'all') return Array.from({ length: total }, (_, i) => i);
    const out = new Set();
    const check = (n) => {
      if (n < 1 || n > total) throw new Error('Page ' + n + ' is out of range. This PDF has ' + total + ' page(s).');
      return n;
    };
    for (const raw of text.split(',')) {
      const t = raw.trim();
      if (!t) continue;
      let m = /^(\d+)$/.exec(t);
      if (m) {
        out.add(check(Number(m[1])) - 1);
        continue;
      }
      m = /^(\d+)\s*-\s*(\d*)$/.exec(t);
      if (!m) throw new Error('Cannot understand "' + t + '". Use numbers and ranges like 1-3, 5, 8-');
      const a = check(Number(m[1]));
      const b = check(m[2] === '' ? total : Number(m[2]));
      for (let p = Math.min(a, b); p <= Math.max(a, b); p++) out.add(p - 1);
    }
    if (out.size === 0) throw new Error('No pages selected.');
    return Array.from(out).sort((x, y) => x - y);
  }

  // --------------------------------------------------------- Rectangles

  /** Two dragged corners -> { x, y, w, h } with positive size. */
  function normalizeRect(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  }

  /** Keep a rectangle inside a page of the given size. */
  function clampRect(r, pageW, pageH) {
    const x = Math.max(0, Math.min(r.x, pageW));
    const y = Math.max(0, Math.min(r.y, pageH));
    return { x: x, y: y, w: Math.max(0, Math.min(r.x + r.w, pageW) - x), h: Math.max(0, Math.min(r.y + r.h, pageH) - y) };
  }

  /** Display points -> whole canvas pixels, rounded OUTWARD so no sliver is left uncovered. */
  function toPixels(r, scale) {
    const x = Math.floor(r.x * scale) - 1;
    const y = Math.floor(r.y * scale) - 1;
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      w: Math.ceil((r.x + r.w) * scale) + 1 - Math.max(0, x),
      h: Math.ceil((r.y + r.h) * scale) + 1 - Math.max(0, y),
    };
  }

  /** Drop boxes too small to matter (a stray click) and merge exact duplicates. */
  function cleanRects(list, minSize) {
    const min = minSize == null ? 3 : minSize;
    const seen = new Set();
    return list.filter(function (r) {
      if (r.w < min || r.h < min) return false;
      const key = [r.x, r.y, r.w, r.h].map((n) => Math.round(n * 10)).join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ---------------------------------------------------- Text -> boxes

  /**
   * Find text in extracted text "runs" and return boxes to redact.
   * run = { str, box: { x, y, w, h }, axis: "x" | "y", reverse: boolean }
   * (box in display points; `axis` is the direction the text flows on screen.)
   * opts: { regex, matchCase, whole (cover the entire run), pad }
   * Each match covers only its share of the run, estimated from character
   * position, widened by `pad` points. Review the boxes before saving.
   */
  function findTextBoxes(runs, query, opts) {
    const o = Object.assign({ regex: false, matchCase: false, whole: false, pad: 2 }, opts);
    if (!String(query)) throw new Error('Type the text to find.');
    let re;
    try {
      re = new RegExp(o.regex ? query : String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.matchCase ? 'gu' : 'giu');
    } catch (e) {
      throw new Error('That pattern is not valid: ' + e.message);
    }
    const boxes = [];
    for (const run of runs) {
      if (!run.str) continue;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(run.str)) !== null) {
        if (m[0] === '') {
          re.lastIndex++;
          continue;
        }
        boxes.push(
          o.whole ? padBox(run.box, o.pad) : sliceBox(run, m.index / run.str.length, (m.index + m[0].length) / run.str.length, o.pad),
        );
      }
    }
    return boxes;
  }

  const padBox = (b, p) => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p });

  /** The part of a run between two fractions (0..1) of its length, padded. */
  function sliceBox(run, from, to, pad) {
    const b = run.box;
    const f0 = run.reverse ? 1 - to : from;
    const f1 = run.reverse ? 1 - from : to;
    if (run.axis === 'y') return padBox({ x: b.x, y: b.y + b.h * f0, w: b.w, h: b.h * (f1 - f0) }, pad);
    return padBox({ x: b.x + b.w * f0, y: b.y, w: b.w * (f1 - f0), h: b.h }, pad);
  }

  // ------------------------------------------------------ Coordinates

  const normRotation = (r) => (((Math.round((Number(r) || 0) / 90) * 90) % 360) + 360) % 360;

  /** Display point (u right, v down) -> PDF user-space point. */
  function displayToUser(u, v, info) {
    const r = normRotation(info.rotation);
    let x;
    let y;
    if (r === 0) [x, y] = [u, info.height - v];
    else if (r === 90) [x, y] = [v, u];
    else if (r === 180) [x, y] = [info.width - u, v];
    else [x, y] = [info.width - v, info.height - u];
    return { x: info.x0 + x, y: info.y0 + y };
  }

  const displaySize = (info) =>
    normRotation(info.rotation) % 180 ? { width: info.height, height: info.width } : { width: info.width, height: info.height };

  const TEXT_BASELINE = 0.85; // baseline distance from the top of a text box, as a fraction of font size

  /**
   * Where to draw a watermark so its CENTRE sits in the middle of the visible
   * page, turned `angle` degrees counter-clockwise as seen on screen.
   */
  function planWatermark(info, textWidth, size, angle) {
    const d = displaySize(info);
    const th = (angle * Math.PI) / 180;
    const h = size * 0.7; // cap height
    // work in y-up display coordinates, then flip
    const cx = d.width / 2;
    const cy = d.height / 2;
    const px = cx - ((textWidth / 2) * Math.cos(th) - (h / 2) * Math.sin(th));
    const py = cy - ((textWidth / 2) * Math.sin(th) + (h / 2) * Math.cos(th));
    const p = displayToUser(px, d.height - py, info);
    return { x: p.x, y: p.y, rotate: angle + normRotation(info.rotation) };
  }

  /** Page-number placement. position: top|bottom + left|center|right, e.g. "bottom-center". */
  function planPageNumber(info, textWidth, size, position, margin) {
    const d = displaySize(info);
    const m = margin == null ? 28 : margin;
    const [vert, horiz] = String(position || 'bottom-center').split('-');
    const u = horiz === 'left' ? m : horiz === 'right' ? d.width - m - textWidth : (d.width - textWidth) / 2;
    const top = vert === 'top' ? m : d.height - m - size;
    const p = displayToUser(u, top + size * TEXT_BASELINE, info);
    return { x: p.x, y: p.y, rotate: normRotation(info.rotation) };
  }

  /** "Page {n} of {total}" -> "Page 3 of 12" */
  function formatLabel(template, n, total) {
    return String(template == null ? '{n}' : template)
      .replace(/\{n\}/g, String(n))
      .replace(/\{total\}/g, String(total));
  }

  /** Characters the standard PDF font cannot draw are replaced. */
  function sanitizeForFont(font, text) {
    const supported = new Set(font.getCharacterSet());
    const swaps = { '₹': 'Rs.', '…': '...', ' ': ' ', '\n': ' ', '\t': ' ' };
    let out = '';
    for (const ch of String(text)) {
      if (swaps[ch] !== undefined) out += swaps[ch];
      else if (supported.has(ch.codePointAt(0))) out += ch;
      else out += '?';
    }
    return out;
  }

  // -------------------------------------------------------------- PDF

  /** Visible-box info for every page of an open pdf-lib document. */
  function pageInfos(doc) {
    return doc.getPages().map(function (p) {
      const b = p.getCropBox();
      return { x0: b.x, y0: b.y, width: b.width, height: b.height, rotation: p.getRotation().angle };
    });
  }

  async function loadPdf(bytes) {
    try {
      return await PDFDocument.load(bytes);
    } catch (err) {
      if (/encrypted/i.test(String(err && err.message)))
        throw new Error('This PDF is password-protected. Remove the password first, then try again.');
      throw new Error('This file could not be read as a PDF (it may be damaged).');
    }
  }

  /** Number of pages and their display sizes, for the viewer. */
  async function inspect(bytes) {
    const doc = await loadPdf(bytes);
    return pageInfos(doc);
  }

  /**
   * Permanently redact. `redactions` maps page index -> list of boxes (display
   * points). `rasterize(pageIndex, boxes)` must return
   * { bytes, mime: "image/png" | "image/jpeg", widthPt, heightPt } - the page
   * as a picture with the boxes painted black (the browser does this with PDF.js).
   * Returns the new PDF bytes.
   */
  async function redact(bytes, redactions, rasterize) {
    const src = await loadPdf(bytes);
    const targets = Object.keys(redactions)
      .map(Number)
      .filter((i) => redactions[i] && redactions[i].length);
    if (targets.length === 0) throw new Error('Draw at least one box to redact.');
    const out = await PDFDocument.create();
    for (let i = 0; i < src.getPageCount(); i++) {
      if (targets.includes(i)) {
        const img = await rasterize(i, redactions[i]);
        const embedded = img.mime === 'image/png' ? await out.embedPng(img.bytes) : await out.embedJpg(img.bytes);
        const page = out.addPage([img.widthPt, img.heightPt]);
        page.drawImage(embedded, { x: 0, y: 0, width: img.widthPt, height: img.heightPt });
      } else {
        const [copy] = await out.copyPages(src, [i]);
        out.addPage(copy);
      }
    }
    return out.save();
  }

  /**
   * Add a text watermark and/or page numbers to a PDF.
   * opts.watermark: { text, size, opacity (0-1), angle, color: "gray"|"red"|"blue"|"black", pages: spec }
   * opts.numbers:   { format, position, size, start, pages: spec }
   * opts.clearInfo: wipe title/author/subject/keywords/creator.
   */
  async function stamp(bytes, opts) {
    const doc = await loadPdf(bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = doc.getPages();
    const infos = pageInfos(doc);
    const total = pages.length;

    const wm = opts && opts.watermark;
    if (wm && String(wm.text || '').trim()) {
      const size = Number(wm.size) || 64;
      if (size < 8 || size > 300) throw new Error('Watermark size must be between 8 and 300.');
      const opacity = Math.min(1, Math.max(0.02, wm.opacity == null ? 0.2 : Number(wm.opacity)));
      const color =
        { gray: rgb(0.45, 0.45, 0.45), red: rgb(0.8, 0.1, 0.1), blue: rgb(0.1, 0.25, 0.8), black: rgb(0, 0, 0) }[wm.color] ||
        rgb(0.45, 0.45, 0.45);
      const text = sanitizeForFont(bold, wm.text.trim());
      const width = bold.widthOfTextAtSize(text, size);
      for (const i of parsePages(wm.pages, total)) {
        const plan = planWatermark(infos[i], width, size, wm.angle == null ? 45 : Number(wm.angle));
        pages[i].drawText(text, {
          x: plan.x,
          y: plan.y,
          size: size,
          font: bold,
          color: color,
          opacity: opacity,
          rotate: degrees(plan.rotate),
        });
      }
    }

    const num = opts && opts.numbers;
    if (num) {
      const size = Number(num.size) || 10;
      const start = Number.isInteger(Number(num.start)) ? Number(num.start) : 1;
      const targets = parsePages(num.pages, total);
      for (const i of targets) {
        const label = sanitizeForFont(font, formatLabel(num.format || 'Page {n} of {total}', start + i, start + total - 1));
        const width = font.widthOfTextAtSize(label, size);
        const plan = planPageNumber(infos[i], width, size, num.position, 28);
        pages[i].drawText(label, { x: plan.x, y: plan.y, size: size, font: font, color: rgb(0.2, 0.2, 0.2), rotate: degrees(plan.rotate) });
      }
    }

    if (opts && opts.clearInfo) {
      doc.setTitle('');
      doc.setAuthor('');
      doc.setSubject('');
      doc.setKeywords([]);
      doc.setCreator('');
      doc.setProducer('');
    }
    return doc.save();
  }

  /** "report.pdf" -> "report-redacted.pdf" */
  function outputName(name, suffix) {
    return String(name).replace(/\.pdf$/i, '') + '-' + suffix + '.pdf';
  }

  return {
    parsePages: parsePages,
    normalizeRect: normalizeRect,
    clampRect: clampRect,
    toPixels: toPixels,
    cleanRects: cleanRects,
    findTextBoxes: findTextBoxes,
    sliceBox: sliceBox,
    displayToUser: displayToUser,
    displaySize: displaySize,
    planWatermark: planWatermark,
    planPageNumber: planPageNumber,
    formatLabel: formatLabel,
    inspect: inspect,
    redact: redact,
    stamp: stamp,
    outputName: outputName,
    TEXT_BASELINE: TEXT_BASELINE,
  };
});

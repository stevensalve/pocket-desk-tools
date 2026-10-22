/**
 * Scan Organiser - core logic (pure; works on plain { data, width, height } RGBA images,
 * the same shape as the browser's ImageData, so every function is testable in Node).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ScanCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function makeImage(width, height, fill) {
    const data = new Uint8ClampedArray(width * height * 4);
    if (fill)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = fill[0];
        data[i + 1] = fill[1];
        data[i + 2] = fill[2];
        data[i + 3] = 255;
      }
    return { data: data, width: width, height: height };
  }

  const clone = (img) => ({ data: new Uint8ClampedArray(img.data), width: img.width, height: img.height });
  const luma = (r, g, b) => Math.round(0.299 * r + 0.587 * g + 0.114 * b);

  function histogram(img) {
    const h = new Array(256).fill(0);
    for (let i = 0; i < img.data.length; i += 4) h[luma(img.data[i], img.data[i + 1], img.data[i + 2])]++;
    return h;
  }

  function grayscale(img) {
    const out = clone(img);
    for (let i = 0; i < out.data.length; i += 4) {
      const y = luma(out.data[i], out.data[i + 1], out.data[i + 2]);
      out.data[i] = out.data[i + 1] = out.data[i + 2] = y;
    }
    return out;
  }

  /**
   * Stretch brightness so the darkest and lightest `clip` fraction (default 1%) of pixels
   * become black and white. Good for faded or grey-looking scans. Per-channel gain is shared,
   * so colours are kept.
   */
  function autoContrast(img, clip) {
    const c = clip === undefined ? 0.01 : clip;
    if (!(c >= 0 && c < 0.5)) throw new Error('clip must be between 0 and 0.5');
    const h = histogram(img);
    const total = img.width * img.height;
    let lo = 0;
    let hi = 255;
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += h[i];
      if (acc > total * c) {
        lo = i;
        break;
      }
    }
    acc = 0;
    for (let i = 255; i >= 0; i--) {
      acc += h[i];
      if (acc > total * c) {
        hi = i;
        break;
      }
    }
    const out = clone(img);
    if (hi <= lo) return out;
    const scale = 255 / (hi - lo);
    for (let i = 0; i < out.data.length; i += 4) {
      for (let k = 0; k < 3; k++) out.data[i + k] = (out.data[i + k] - lo) * scale; // Uint8ClampedArray clamps
    }
    return out;
  }

  /** Otsu's method: the grey level that best separates "ink" from "paper". Input is a 256-bin histogram. */
  function otsuThreshold(hist) {
    const total = hist.reduce((a, b) => a + b, 0);
    if (!total) return 128;
    let sumAll = 0;
    for (let i = 0; i < 256; i++) sumAll += i * hist[i];
    let wB = 0;
    let sumB = 0;
    let best = 0;
    let threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sumAll - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) {
        best = between;
        threshold = t;
      }
    }
    return threshold;
  }

  /** Pure black-and-white "photocopy" look. threshold: 0-255, default auto (Otsu). */
  function blackAndWhite(img, threshold) {
    const t = threshold === undefined || threshold === null ? otsuThreshold(histogram(img)) : threshold;
    const out = clone(img);
    for (let i = 0; i < out.data.length; i += 4) {
      const v = luma(out.data[i], out.data[i + 1], out.data[i + 2]) > t ? 255 : 0;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
    }
    return out;
  }

  /** Brightness (-100..100) and contrast (-100..100) like a photo editor. */
  function adjust(img, brightness, contrast) {
    const b = ((brightness || 0) / 100) * 255;
    const c = contrast || 0;
    const factor = (259 * (c + 255)) / (255 * (259 - c));
    const out = clone(img);
    for (let i = 0; i < out.data.length; i += 4) {
      for (let k = 0; k < 3; k++) out.data[i + k] = factor * (out.data[i + k] + b - 128) + 128;
    }
    return out;
  }

  /**
   * Find the content area of a photographed page: the box around everything that differs
   * from the border colour. Returns { x, y, width, height } (the whole image if nothing is found).
   * `tolerance` is how different a pixel must be (0-255, default 40); `pad` extra pixels kept.
   */
  function contentBounds(img, tolerance, pad) {
    const tol = tolerance === undefined ? 40 : tolerance;
    const p = pad === undefined ? 4 : pad;
    const { width: w, height: h, data } = img;
    // Background = average of the outer ring of pixels.
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    const take = (x, y) => {
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    };
    for (let x = 0; x < w; x++) {
      take(x, 0);
      take(x, h - 1);
    }
    for (let y = 1; y < h - 1; y++) {
      take(0, y);
      take(w - 1, y);
    }
    r /= n;
    g /= n;
    b /= n;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const d = Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b);
        if (d / 3 > tol) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return { x: 0, y: 0, width: w, height: h };
    x0 = Math.max(0, x0 - p);
    y0 = Math.max(0, y0 - p);
    x1 = Math.min(w - 1, x1 + p);
    y1 = Math.min(h - 1, y1 + p);
    return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  }

  function crop(img, rect) {
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const w = Math.min(img.width - x, Math.floor(rect.width));
    const h = Math.min(img.height - y, Math.floor(rect.height));
    if (w < 1 || h < 1) throw new Error('The crop area is empty.');
    const out = makeImage(w, h);
    for (let row = 0; row < h; row++) {
      const src = ((y + row) * img.width + x) * 4;
      out.data.set(img.data.subarray(src, src + w * 4), row * w * 4);
    }
    return out;
  }

  /** Rotate clockwise by 90 degrees `turns` times (negative = anticlockwise). */
  function rotate(img, turns) {
    const t = ((turns % 4) + 4) % 4;
    if (t === 0) return clone(img);
    const { width: w, height: h } = img;
    const ow = t === 2 ? w : h;
    const oh = t === 2 ? h : w;
    const out = makeImage(ow, oh);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let nx;
        let ny;
        if (t === 1) {
          nx = h - 1 - y;
          ny = x;
        } else if (t === 2) {
          nx = w - 1 - x;
          ny = h - 1 - y;
        } else {
          nx = y;
          ny = w - 1 - x;
        }
        const s = (y * w + x) * 4;
        const d = (ny * ow + nx) * 4;
        out.data[d] = img.data[s];
        out.data[d + 1] = img.data[s + 1];
        out.data[d + 2] = img.data[s + 2];
        out.data[d + 3] = img.data[s + 3];
      }
    }
    return out;
  }

  /** Box-average downscale so the longest side is at most `maxSide` (never enlarges). */
  function downscale(img, maxSide) {
    const longest = Math.max(img.width, img.height);
    if (!(maxSide >= 1) || longest <= maxSide) return clone(img);
    const k = maxSide / longest;
    const ow = Math.max(1, Math.round(img.width * k));
    const oh = Math.max(1, Math.round(img.height * k));
    const out = makeImage(ow, oh);
    for (let y = 0; y < oh; y++) {
      const sy0 = Math.floor((y * img.height) / oh);
      const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * img.height) / oh));
      for (let x = 0; x < ow; x++) {
        const sx0 = Math.floor((x * img.width) / ow);
        const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * img.width) / ow));
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let n = 0;
        for (let sy = sy0; sy < sy1; sy++) {
          for (let sx = sx0; sx < sx1; sx++) {
            const i = (sy * img.width + sx) * 4;
            r += img.data[i];
            g += img.data[i + 1];
            b += img.data[i + 2];
            a += img.data[i + 3];
            n++;
          }
        }
        const d = (y * ow + x) * 4;
        out.data[d] = r / n;
        out.data[d + 1] = g / n;
        out.data[d + 2] = b / n;
        out.data[d + 3] = a / n;
      }
    }
    return out;
  }

  /** Apply a named filter: "none" | "gray" | "contrast" | "bw". */
  function applyFilter(img, name) {
    switch (name) {
      case 'gray':
        return grayscale(autoContrast(img, 0.005));
      case 'contrast':
        return autoContrast(img, 0.01);
      case 'bw':
        return blackAndWhite(autoContrast(img, 0.005));
      default:
        return clone(img);
    }
  }

  // ------------------------------------------------------- Page list helpers

  /** Move item from index `from` to `to`; returns a new array. */
  function move(list, from, to) {
    if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list.slice();
    const out = list.slice();
    out.splice(to, 0, out.splice(from, 1)[0]);
    return out;
  }

  /** File names for a ZIP: pattern with {n} (1-based, zero-padded to the total's width) and {date}. */
  function pageNames(pattern, count, ext, dateText) {
    const width = String(count).length;
    const base = (pattern || 'scan-{n}').trim() || 'scan-{n}';
    return Array.from({ length: count }, (_, i) => {
      const name = base.replace(/\{n\}/g, String(i + 1).padStart(width, '0')).replace(/\{date\}/g, dateText || '');
      // eslint-disable-next-line no-control-regex -- control characters are exactly what we strip from file names
      return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 100) + '.' + ext;
    });
  }

  const PAGE = { a4: [595.28, 841.89], letter: [612, 792] };

  /**
   * Build a PDF from encoded page images: pages = [{ bytes: Uint8Array, type: 'jpg'|'png', width, height }].
   * pageSize "fit" makes each page the image's size; "a4"/"letter" fit the image inside the page with a margin,
   * choosing portrait or landscape per page to match the image.
   */
  async function buildPdf(PDFLib, pages, opts) {
    const o = Object.assign({ pageSize: 'a4', margin: 18, title: '' }, opts);
    if (!pages.length) throw new Error('Add at least one page.');
    if (o.pageSize !== 'fit' && !PAGE[o.pageSize]) throw new Error('Unknown page size.');
    const doc = await PDFLib.PDFDocument.create();
    doc.setCreator('Pocket Desk Tools');
    if (o.title) doc.setTitle(o.title);
    for (const p of pages) {
      const img = p.type === 'png' ? await doc.embedPng(p.bytes) : await doc.embedJpg(p.bytes);
      if (o.pageSize === 'fit') {
        const page = doc.addPage([p.width, p.height]);
        page.drawImage(img, { x: 0, y: 0, width: p.width, height: p.height });
      } else {
        const base = PAGE[o.pageSize];
        const landscape = p.width > p.height;
        const W = landscape ? base[1] : base[0];
        const H = landscape ? base[0] : base[1];
        const k = Math.min((W - 2 * o.margin) / p.width, (H - 2 * o.margin) / p.height);
        const w = p.width * k;
        const h = p.height * k;
        doc.addPage([W, H]).drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
      }
    }
    return doc.save();
  }

  /** ZIP (stored, no extra compression: JPEG/PNG are already compressed). files = [{ name, bytes }] */
  function makeZip(fflate, files) {
    const input = {};
    files.forEach((f) => (input[f.name] = [f.bytes, { level: 0 }]));
    return fflate.zipSync(input);
  }

  return {
    makeImage: makeImage,
    histogram: histogram,
    grayscale: grayscale,
    autoContrast: autoContrast,
    otsuThreshold: otsuThreshold,
    blackAndWhite: blackAndWhite,
    adjust: adjust,
    contentBounds: contentBounds,
    crop: crop,
    rotate: rotate,
    downscale: downscale,
    applyFilter: applyFilter,
    move: move,
    pageNames: pageNames,
    buildPdf: buildPdf,
    makeZip: makeZip,
  };
});

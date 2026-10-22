/**
 * Diagram Sketcher - core logic (pure; no DOM).
 *
 * A diagram is plain data:
 *   { nextId, nodes: [{ id, x, y, w, h, text, shape, color }], edges: [{ id, from, to, label }] }
 * (x, y) is the centre of a node. Shapes: "box" | "round" | "ellipse" | "diamond".
 * Functions return NEW diagrams and never mutate their input.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DiagramCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SHAPES = ['box', 'round', 'ellipse', 'diamond'];
  const COLORS = {
    white: '#ffffff',
    blue: '#dbeafe',
    green: '#d1fae5',
    yellow: '#fef3c7',
    red: '#fee2e2',
    purple: '#ede9fe',
    grey: '#e5e7eb',
  };
  const CHAR_W = 8;
  const LINE_H = 18;

  const create = () => ({ nextId: 1, nodes: [], edges: [] });
  const copy = (d) => JSON.parse(JSON.stringify(d));

  /** Round to the nearest grid line (grid 0 or less disables snapping). */
  function snap(v, grid) {
    return grid > 0 ? Math.round(v / grid) * grid : v;
  }

  /** Width/height that fits the text (multi-line aware) for a shape. */
  function nodeSize(text, shape) {
    const lines = String(text || '').split('\n');
    const longest = Math.max.apply(null, lines.map((l) => l.length).concat([4]));
    let w = Math.max(80, longest * CHAR_W + 28);
    let h = Math.max(40, lines.length * LINE_H + 22);
    if (shape === 'diamond') {
      w = Math.round(w * 1.5);
      h = Math.round(h * 1.6);
    } else if (shape === 'ellipse') {
      w = Math.round(w * 1.25);
      h = Math.round(h * 1.2);
    }
    return { w: w, h: h };
  }

  function addNode(d, spec) {
    const s = Object.assign({ x: 0, y: 0, text: 'New', shape: 'box', color: 'white' }, spec);
    if (SHAPES.indexOf(s.shape) === -1) throw new Error('Unknown shape: ' + s.shape);
    if (!COLORS[s.color]) throw new Error('Unknown colour: ' + s.color);
    const out = copy(d);
    const size = nodeSize(s.text, s.shape);
    const node = { id: out.nextId++, x: s.x, y: s.y, w: size.w, h: size.h, text: String(s.text), shape: s.shape, color: s.color };
    out.nodes.push(node);
    return { diagram: out, id: node.id };
  }

  function updateNode(d, id, patch) {
    const out = copy(d);
    const n = out.nodes.find((x) => x.id === id);
    if (!n) throw new Error('No such node.');
    if (patch.shape !== undefined && SHAPES.indexOf(patch.shape) === -1) throw new Error('Unknown shape: ' + patch.shape);
    if (patch.color !== undefined && !COLORS[patch.color]) throw new Error('Unknown colour: ' + patch.color);
    Object.assign(n, patch);
    if (patch.text !== undefined || patch.shape !== undefined) Object.assign(n, nodeSize(n.text, n.shape));
    return out;
  }

  function removeNode(d, id) {
    const out = copy(d);
    out.nodes = out.nodes.filter((n) => n.id !== id);
    out.edges = out.edges.filter((e) => e.from !== id && e.to !== id);
    return out;
  }

  /** Connect two nodes. Returns the same diagram when the link is a self-link or already exists. */
  function addEdge(d, from, to, label) {
    if (from === to) return { diagram: d, id: null };
    if (!d.nodes.some((n) => n.id === from) || !d.nodes.some((n) => n.id === to))
      throw new Error('Both ends of a connector must be existing nodes.');
    if (d.edges.some((e) => e.from === from && e.to === to)) return { diagram: d, id: null };
    const out = copy(d);
    const edge = { id: out.nextId++, from: from, to: to, label: label ? String(label) : '' };
    out.edges.push(edge);
    return { diagram: out, id: edge.id };
  }

  function updateEdge(d, id, patch) {
    const out = copy(d);
    const e = out.edges.find((x) => x.id === id);
    if (!e) throw new Error('No such connector.');
    if (patch.label !== undefined) e.label = String(patch.label);
    return out;
  }

  function removeEdge(d, id) {
    const out = copy(d);
    out.edges = out.edges.filter((e) => e.id !== id);
    return out;
  }

  function moveNode(d, id, x, y, grid) {
    const out = copy(d);
    const n = out.nodes.find((q) => q.id === id);
    if (!n) throw new Error('No such node.');
    n.x = snap(x, grid);
    n.y = snap(y, grid);
    return out;
  }

  /** Where the straight line between two node centres meets the border of node `n` (towards `toward`). */
  function borderPoint(n, toward) {
    const dx = toward.x - n.x;
    const dy = toward.y - n.y;
    if (dx === 0 && dy === 0) return { x: n.x, y: n.y };
    const hw = n.w / 2;
    const hh = n.h / 2;
    let t;
    if (n.shape === 'ellipse') t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
    else if (n.shape === 'diamond') t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    else t = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
    return { x: n.x + dx * t, y: n.y + dy * t };
  }

  function edgeLine(d, edge) {
    const a = d.nodes.find((n) => n.id === edge.from);
    const b = d.nodes.find((n) => n.id === edge.to);
    if (!a || !b) return null;
    return { from: borderPoint(a, b), to: borderPoint(b, a) };
  }

  function bounds(d, pad) {
    const p = pad === undefined ? 24 : pad;
    if (!d.nodes.length) return { x: 0, y: 0, width: 200, height: 120 };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    d.nodes.forEach((n) => {
      x0 = Math.min(x0, n.x - n.w / 2);
      y0 = Math.min(y0, n.y - n.h / 2);
      x1 = Math.max(x1, n.x + n.w / 2);
      y1 = Math.max(y1, n.y + n.h / 2);
    });
    return { x: Math.floor(x0 - p), y: Math.floor(y0 - p), width: Math.ceil(x1 - x0 + 2 * p), height: Math.ceil(y1 - y0 + 2 * p) };
  }

  // -------------------------------------------------------- Outline -> tree

  /**
   * Turn an indented outline into a top-down tree diagram.
   *   CEO
   *     CTO
   *       Dev lead
   *     CFO
   * Indentation = 2 spaces, 4 spaces or a tab per level (the first indent sets the unit). Leading "-", "*" or "•" are ignored.
   * Only one top-level line is needed; several top-level lines get joined under a "(root)" node.
   * Returns { diagram, errors }.
   */
  function layoutTree(outline, opts) {
    const o = Object.assign({ hGap: 28, vGap: 56, shape: 'box' }, opts);
    const errors = [];
    const items = [];
    let unit = 0;
    String(outline || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .forEach(function (raw, i) {
        if (!raw.trim()) return;
        const m = /^([ \t]*)(.*)$/.exec(raw);
        const lead = m[1].replace(/\t/g, '    ');
        const text = m[2].replace(/^[-*•]\s+/, '').trim();
        if (!text) return;
        if (lead.length && !unit) unit = lead.length;
        const depth = lead.length ? Math.round(lead.length / (unit || 2)) : 0;
        if (lead.length && unit && lead.length % unit !== 0)
          errors.push('Line ' + (i + 1) + ': indentation is not a multiple of ' + unit + ' spaces.');
        items.push({ text: text, depth: depth, line: i + 1, children: [] });
      });
    if (!items.length) return { diagram: create(), errors: errors };

    const roots = [];
    const stack = [];
    items.forEach(function (it) {
      let depth = it.depth;
      const prev = stack.length ? stack[stack.length - 1].depth : -1;
      if (depth > prev + 1) {
        errors.push('Line ' + it.line + ': indented too far; attached to the nearest line above.');
        depth = prev + 1;
      }
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      it.depth = depth;
      if (stack.length) stack[stack.length - 1].children.push(it);
      else roots.push(it);
      stack.push(it);
    });
    const top = roots.length === 1 ? roots[0] : { text: '(root)', depth: -1, children: roots };

    // Sizes, then a simple tidy layout: each leaf gets its own slot; parents centre over their children.
    const size = (it) => nodeSize(it.text, o.shape);
    let cursor = 0;
    const placed = [];
    (function place(it, depth) {
      const s = size(it);
      it.w = s.w;
      it.h = s.h;
      if (!it.children.length) {
        it.cx = cursor + s.w / 2;
        cursor += s.w + o.hGap;
      } else {
        it.children.forEach((c) => place(c, depth + 1));
        const first = it.children[0].cx;
        const last = it.children[it.children.length - 1].cx;
        it.cx = (first + last) / 2;
        // keep the next sibling clear of a parent wider than its subtree
        cursor = Math.max(cursor, it.cx + s.w / 2 + o.hGap);
      }
      it.cy = depth * (80 + o.vGap) + 40;
      placed.push(it);
    })(top, 0);

    let d = create();
    const ids = new Map();
    placed
      .slice()
      .sort((a, b) => a.cy - b.cy || a.cx - b.cx)
      .forEach((it) => {
        const r = addNode(d, { x: Math.round(it.cx), y: Math.round(it.cy), text: it.text, shape: o.shape });
        d = r.diagram;
        ids.set(it, r.id);
      });
    placed.forEach((it) => it.children.forEach((c) => (d = addEdge(d, ids.get(it), ids.get(c)).diagram)));
    return { diagram: d, errors: errors };
  }

  // ------------------------------------------------------------- Export

  const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const num = (n) => Math.round(n * 100) / 100;

  function shapeSvg(n) {
    const fill = COLORS[n.color] || '#ffffff';
    const common = 'fill="' + fill + '" stroke="#374151" stroke-width="1.5"';
    const l = n.x - n.w / 2;
    const t = n.y - n.h / 2;
    if (n.shape === 'ellipse')
      return '<ellipse cx="' + num(n.x) + '" cy="' + num(n.y) + '" rx="' + num(n.w / 2) + '" ry="' + num(n.h / 2) + '" ' + common + '/>';
    if (n.shape === 'diamond')
      return (
        '<polygon points="' +
        [
          [n.x, t],
          [l + n.w, n.y],
          [n.x, t + n.h],
          [l, n.y],
        ]
          .map((p) => num(p[0]) + ',' + num(p[1]))
          .join(' ') +
        '" ' +
        common +
        '/>'
      );
    return (
      '<rect x="' +
      num(l) +
      '" y="' +
      num(t) +
      '" width="' +
      num(n.w) +
      '" height="' +
      num(n.h) +
      '" rx="' +
      (n.shape === 'round' ? 14 : 3) +
      '" ' +
      common +
      '/>'
    );
  }

  /** The diagram as a standalone SVG string. All user text is escaped. */
  function toSvg(d, opts) {
    const o = Object.assign({ background: '#ffffff' }, opts);
    const b = bounds(d);
    const out = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        b.width +
        '" height="' +
        b.height +
        '" viewBox="' +
        b.x +
        ' ' +
        b.y +
        ' ' +
        b.width +
        ' ' +
        b.height +
        '" font-family="Arial, Helvetica, sans-serif" font-size="14">',
      '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#374151"/></marker></defs>',
      '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.width + '" height="' + b.height + '" fill="' + esc(o.background) + '"/>',
    ];
    d.edges.forEach((e) => {
      const ln = edgeLine(d, e);
      if (!ln) return;
      out.push(
        '<line x1="' +
          num(ln.from.x) +
          '" y1="' +
          num(ln.from.y) +
          '" x2="' +
          num(ln.to.x) +
          '" y2="' +
          num(ln.to.y) +
          '" stroke="#374151" stroke-width="1.5" marker-end="url(#arrow)"/>',
      );
      if (e.label)
        out.push(
          '<text x="' +
            num((ln.from.x + ln.to.x) / 2) +
            '" y="' +
            num((ln.from.y + ln.to.y) / 2 - 4) +
            '" text-anchor="middle" font-size="12" fill="#111827" stroke="#ffffff" stroke-width="3" paint-order="stroke">' +
            esc(e.label) +
            '</text>',
        );
    });
    d.nodes.forEach((n) => {
      out.push(shapeSvg(n));
      const lines = n.text.split('\n');
      const top = n.y - ((lines.length - 1) * LINE_H) / 2;
      lines.forEach((ln, i) =>
        out.push(
          '<text x="' + num(n.x) + '" y="' + num(top + i * LINE_H + 5) + '" text-anchor="middle" fill="#111827">' + esc(ln) + '</text>',
        ),
      );
    });
    out.push('</svg>');
    return out.join('\n');
  }

  // -------------------------------------------------------- Save / load

  function serialize(d) {
    return JSON.stringify({ app: 'diagram-sketcher', version: 1, diagram: d }, null, 2);
  }

  /** Parse and validate a saved file; throws a friendly Error when it is not a diagram. */
  function parse(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not a saved diagram.');
    }
    const d = data && data.app === 'diagram-sketcher' ? data.diagram : null;
    if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) throw new Error('That file is not a saved diagram.');
    if (d.nodes.length > 2000 || d.edges.length > 5000) throw new Error('That diagram is too large.');
    const ids = new Set();
    let maxId = 0;
    const nodes = d.nodes.map((n) => {
      if (!Number.isFinite(n.id) || !Number.isFinite(n.x) || !Number.isFinite(n.y) || ids.has(n.id))
        throw new Error('The diagram file is damaged.');
      ids.add(n.id);
      maxId = Math.max(maxId, n.id);
      const shape = SHAPES.indexOf(n.shape) === -1 ? 'box' : n.shape;
      const text = String(n.text == null ? '' : n.text).slice(0, 500);
      return { id: n.id, x: n.x, y: n.y, text: text, shape: shape, color: COLORS[n.color] ? n.color : 'white', w: 0, h: 0 };
    });
    nodes.forEach((n) => Object.assign(n, nodeSize(n.text, n.shape)));
    const edges = d.edges
      .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
      .map((e) => {
        maxId = Math.max(maxId, Number.isFinite(e.id) ? e.id : 0);
        return { id: Number.isFinite(e.id) ? e.id : 0, from: e.from, to: e.to, label: String(e.label || '').slice(0, 200) };
      });
    const out = { nextId: maxId + 1, nodes: nodes, edges: edges };
    out.edges.forEach((e) => {
      if (!e.id) e.id = out.nextId++;
    });
    return out;
  }

  return {
    SHAPES: SHAPES,
    COLORS: COLORS,
    create: create,
    snap: snap,
    nodeSize: nodeSize,
    addNode: addNode,
    updateNode: updateNode,
    removeNode: removeNode,
    addEdge: addEdge,
    updateEdge: updateEdge,
    removeEdge: removeEdge,
    moveNode: moveNode,
    borderPoint: borderPoint,
    edgeLine: edgeLine,
    bounds: bounds,
    layoutTree: layoutTree,
    toSvg: toSvg,
    serialize: serialize,
    parse: parse,
  };
});

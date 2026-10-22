'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const dg = require('../js/core.js');

function two() {
  let d = dg.create();
  const a = dg.addNode(d, { x: 0, y: 0, text: 'A' });
  const b = dg.addNode(a.diagram, { x: 300, y: 0, text: 'B', shape: 'ellipse' });
  return { d: b.diagram, a: a.id, b: b.id };
}

test('snap', () => {
  assert.equal(dg.snap(37, 20), 40);
  assert.equal(dg.snap(29, 20), 20);
  assert.equal(dg.snap(-11, 20), -20);
  assert.equal(dg.snap(37, 0), 37);
});

test('nodeSize grows with text and differs by shape', () => {
  const small = dg.nodeSize('Hi', 'box');
  const big = dg.nodeSize('A much longer label here', 'box');
  assert.ok(big.w > small.w);
  assert.ok(dg.nodeSize('a\nb\nc', 'box').h > small.h);
  assert.ok(dg.nodeSize('Hi', 'diamond').w > small.w);
  assert.equal(small.w, 80);
});

test('addNode assigns ids, sizes, validates, and does not mutate', () => {
  const empty = dg.create();
  const r = dg.addNode(empty, { text: 'X', x: 5, y: 6 });
  assert.equal(r.id, 1);
  assert.equal(empty.nodes.length, 0);
  assert.equal(r.diagram.nodes[0].w, 80);
  assert.equal(dg.addNode(r.diagram, {}).id, 2);
  assert.throws(() => dg.addNode(empty, { shape: 'star' }), /Unknown shape/);
  assert.throws(() => dg.addNode(empty, { color: 'neon' }), /Unknown colour/);
});

test('updateNode resizes when text or shape changes', () => {
  const { d, a } = two();
  const u = dg.updateNode(d, a, { text: 'A very long node label indeed' });
  assert.ok(u.nodes[0].w > d.nodes[0].w);
  assert.equal(dg.updateNode(d, a, { color: 'red' }).nodes[0].color, 'red');
  assert.throws(() => dg.updateNode(d, 999, {}), /No such node/);
  assert.throws(() => dg.updateNode(d, a, { shape: 'x' }), /Unknown shape/);
});

test('edges: add, duplicate, self-link, invalid, label, remove with node', () => {
  const { d, a, b } = two();
  const e1 = dg.addEdge(d, a, b, 'yes');
  assert.ok(e1.id);
  assert.equal(e1.diagram.edges[0].label, 'yes');
  assert.equal(dg.addEdge(e1.diagram, a, b).id, null, 'duplicate ignored');
  assert.equal(dg.addEdge(e1.diagram, b, a).diagram.edges.length, 2, 'opposite direction is allowed');
  assert.equal(dg.addEdge(d, a, a).id, null);
  assert.throws(() => dg.addEdge(d, a, 99), /existing nodes/);
  assert.equal(dg.updateEdge(e1.diagram, e1.id, { label: 'no' }).edges[0].label, 'no');
  assert.equal(dg.removeEdge(e1.diagram, e1.id).edges.length, 0);
  assert.equal(dg.removeNode(e1.diagram, a).edges.length, 0, 'edges of a removed node go too');
});

test('moveNode snaps to grid', () => {
  const { d, a } = two();
  const m = dg.moveNode(d, a, 47, 33, 20);
  assert.equal(m.nodes[0].x, 40);
  assert.equal(m.nodes[0].y, 40);
  assert.equal(d.nodes[0].x, 0);
});

test('borderPoint lands on the shape outline', () => {
  const box = { x: 0, y: 0, w: 100, h: 40, shape: 'box' };
  assert.deepEqual(dg.borderPoint(box, { x: 200, y: 0 }), { x: 50, y: 0 });
  assert.deepEqual(dg.borderPoint(box, { x: 0, y: -100 }), { x: 0, y: -20 });
  const ell = { x: 0, y: 0, w: 100, h: 40, shape: 'ellipse' };
  assert.deepEqual(dg.borderPoint(ell, { x: 10, y: 0 }), { x: 50, y: 0 });
  const dia = { x: 0, y: 0, w: 100, h: 40, shape: 'diamond' };
  const p = dg.borderPoint(dia, { x: 100, y: 100 });
  assert.ok(Math.abs(Math.abs(p.x) / 50 + Math.abs(p.y) / 20 - 1) < 1e-9);
  assert.deepEqual(dg.borderPoint(box, { x: 0, y: 0 }), { x: 0, y: 0 });
});

test('edgeLine and bounds', () => {
  const { d, a, b } = two();
  const e = dg.addEdge(d, a, b);
  const ln = dg.edgeLine(e.diagram, e.diagram.edges[0]);
  assert.ok(ln.from.x > 0 && ln.to.x < 300);
  assert.equal(dg.edgeLine(d, { from: 1, to: 77 }), null);
  const bd = dg.bounds(d);
  assert.ok(bd.x < -40 && bd.width > 340);
  assert.deepEqual(dg.bounds(dg.create()), { x: 0, y: 0, width: 200, height: 120 });
});

test('layoutTree builds a tidy tree with parents above and centred over children', () => {
  const { diagram, errors } = dg.layoutTree('CEO\n  CTO\n    Dev\n    QA\n  CFO');
  assert.deepEqual(errors, []);
  assert.equal(diagram.nodes.length, 5);
  assert.equal(diagram.edges.length, 4);
  const by = Object.fromEntries(diagram.nodes.map((n) => [n.text, n]));
  assert.ok(by.CEO.y < by.CTO.y && by.CTO.y < by.Dev.y);
  assert.equal(by.CTO.y, by.CFO.y);
  assert.ok(by.Dev.x < by.QA.x);
  assert.ok(Math.abs(by.CTO.x - (by.Dev.x + by.QA.x) / 2) <= 1);
  assert.ok(by.CTO.x < by.CFO.x);
  // no two nodes on the same row overlap
  const rows = {};
  diagram.nodes.forEach((n) => (rows[n.y] = (rows[n.y] || []).concat(n)));
  Object.values(rows).forEach((r) => {
    r.sort((p, q) => p.x - q.x);
    for (let i = 1; i < r.length; i++) assert.ok(r[i].x - r[i].w / 2 >= r[i - 1].x + r[i - 1].w / 2, 'overlap on a row');
  });
});

test('layoutTree: bullets, tabs, several roots, bad indentation, empty', () => {
  const t = dg.layoutTree('- Root\n\t- Child');
  assert.equal(t.diagram.nodes.length, 2);
  assert.equal(t.diagram.edges.length, 1);
  const many = dg.layoutTree('One\nTwo');
  assert.equal(many.diagram.nodes.length, 3);
  assert.ok(many.diagram.nodes.some((n) => n.text === '(root)'));
  const jump = dg.layoutTree('A\n      B');
  assert.equal(jump.errors.length, 0, 'the first indent defines the unit');
  const bad = dg.layoutTree('A\n  B\n        C');
  assert.match(bad.errors[0], /Line 3.*too far/);
  assert.equal(bad.diagram.edges.length, 2);
  assert.match(dg.layoutTree('A\n  B\n   C').errors[0], /multiple of 2/);
  assert.deepEqual(dg.layoutTree('  \n').diagram.nodes, []);
});

test('toSvg escapes all user text and is well-formed enough', () => {
  let { d, a, b } = two();
  d = dg.updateNode(d, a, { text: '<script>alert("x")</script> & \'q\'' });
  d = dg.addEdge(d, a, b, '</text><b>').diagram;
  const svg = dg.toSvg(d);
  assert.ok(svg.startsWith('<svg xmlns='));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(!svg.includes('<script'));
  assert.ok(!svg.includes('<b>'));
  assert.match(svg, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;q&#39;/);
  assert.match(svg, /marker-end="url\(#arrow\)"/);
  assert.match(svg, /<ellipse /);
  assert.equal((svg.match(/<svg /g) || []).length, 1);
});

test('toSvg draws each shape and multi-line labels', () => {
  let d = dg.create();
  ['box', 'round', 'ellipse', 'diamond'].forEach((s, i) => (d = dg.addNode(d, { x: i * 200, y: 0, text: 'l1\nl2', shape: s }).diagram));
  const svg = dg.toSvg(d, { background: '#fafafa' });
  assert.match(svg, /<rect [^>]*rx="3"/);
  assert.match(svg, /rx="14"/);
  assert.match(svg, /<polygon /);
  assert.equal((svg.match(/>l1</g) || []).length, 4);
  assert.match(svg, /fill="#fafafa"/);
});

test('serialize / parse round-trip and validation', () => {
  const { d, a, b } = two();
  const e = dg.addEdge(d, a, b, 'go').diagram;
  const back = dg.parse(dg.serialize(e));
  assert.equal(back.nodes.length, 2);
  assert.equal(back.edges[0].label, 'go');
  assert.equal(back.nextId, e.nextId);
  assert.throws(() => dg.parse('not json'), /not a saved diagram/);
  assert.throws(() => dg.parse('{"app":"other"}'), /not a saved diagram/);
  assert.throws(
    () => dg.parse(JSON.stringify({ app: 'diagram-sketcher', diagram: { nodes: [{ id: 1, x: 'a', y: 0 }], edges: [] } })),
    /damaged/,
  );
  assert.throws(
    () =>
      dg.parse(
        JSON.stringify({
          app: 'diagram-sketcher',
          diagram: {
            nodes: [
              { id: 1, x: 0, y: 0 },
              { id: 1, x: 1, y: 1 },
            ],
            edges: [],
          },
        }),
      ),
    /damaged/,
  );
});

test('parse sanitises unknown shapes/colours and drops dangling edges', () => {
  const text = JSON.stringify({
    app: 'diagram-sketcher',
    diagram: { nodes: [{ id: 1, x: 0, y: 0, text: 'A', shape: 'hexagon', color: 'pink' }], edges: [{ id: 2, from: 1, to: 9 }] },
  });
  const d = dg.parse(text);
  assert.equal(d.nodes[0].shape, 'box');
  assert.equal(d.nodes[0].color, 'white');
  assert.equal(d.edges.length, 0);
  assert.ok(d.nodes[0].w >= 80);
});

/* Diagram Sketcher - user interface. The diagram model and SVG export live in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, readText, el } = OT;
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const canvas = $('canvas');

  let diagram = DiagramCore.create();
  let history = [];
  let selected = null; // { type: 'node' | 'edge', id }
  let connecting = false;
  let pending = null; // node id waiting for its target
  let drag = null;

  const grid = () => ($('snap').checked ? 20 : 0);
  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    return n;
  };

  function commit(next) {
    history.push(diagram);
    if (history.length > 100) history.shift();
    diagram = next;
    render();
  }

  /** Mouse/touch position -> diagram coordinates. */
  function toDiagram(evt) {
    const pt = canvas.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const p = pt.matrixTransform(canvas.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }

  function render() {
    canvas.textContent = '';
    // Show the whole diagram: viewBox grows with content but never drops below the visible area.
    const b = DiagramCore.bounds(diagram, 40);
    const w = Math.max(canvas.clientWidth || 900, b.x + b.width, 900);
    const h = Math.max(520, b.y + b.height);
    const x = Math.min(0, b.x);
    const y = Math.min(0, b.y);
    canvas.setAttribute('viewBox', x + ' ' + y + ' ' + (w - x) + ' ' + (h - y));
    canvas.setAttribute('height', String(Math.min(900, Math.max(520, Math.round(((h - y) * (canvas.clientWidth || 900)) / (w - x))))));

    const defs = svgEl('defs');
    const marker = svgEl('marker', {
      id: 'arrow',
      viewBox: '0 0 10 10',
      refX: '9',
      refY: '5',
      markerWidth: '8',
      markerHeight: '8',
      orient: 'auto-start-reverse',
    });
    marker.appendChild(svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#374151' }));
    defs.appendChild(marker);
    canvas.appendChild(defs);

    diagram.edges.forEach(function (e) {
      const ln = DiagramCore.edgeLine(diagram, e);
      if (!ln) return;
      const g = svgEl('g', {
        class: 'edge' + (selected && selected.type === 'edge' && selected.id === e.id ? ' sel' : ''),
        'data-edge': String(e.id),
      });
      g.appendChild(
        svgEl('line', {
          x1: ln.from.x,
          y1: ln.from.y,
          x2: ln.to.x,
          y2: ln.to.y,
          stroke: '#374151',
          'stroke-width': '1.5',
          'marker-end': 'url(#arrow)',
        }),
      );
      g.appendChild(svgEl('line', { x1: ln.from.x, y1: ln.from.y, x2: ln.to.x, y2: ln.to.y, stroke: 'transparent', 'stroke-width': '14' })); // easy to click
      if (e.label) {
        const t = svgEl('text', {
          x: (ln.from.x + ln.to.x) / 2,
          y: (ln.from.y + ln.to.y) / 2 - 4,
          'text-anchor': 'middle',
          'font-size': '12',
          fill: '#111827',
        });
        t.textContent = e.label;
        g.appendChild(t);
      }
      g.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        select({ type: 'edge', id: e.id });
      });
      canvas.appendChild(g);
    });

    diagram.nodes.forEach(function (n) {
      const cls =
        'node' + (selected && selected.type === 'node' && selected.id === n.id ? ' sel' : '') + (pending === n.id ? ' pending' : '');
      const g = svgEl('g', { class: cls, 'data-node': String(n.id), role: 'button', 'aria-label': 'Box: ' + n.text.replace(/\n/g, ' ') });
      const tmp = new DOMParser().parseFromString(DiagramCore.toSvg({ nextId: 2, nodes: [n], edges: [] }), 'image/svg+xml');
      const shape = tmp.documentElement.querySelector('rect:nth-of-type(2), ellipse, polygon');
      g.appendChild(document.importNode(shape, true));
      const lines = n.text.split('\n');
      const top = n.y - ((lines.length - 1) * 18) / 2;
      lines.forEach((ln, i) => {
        const t = svgEl('text', {
          x: n.x,
          y: top + i * 18 + 5,
          'text-anchor': 'middle',
          'font-size': '14',
          fill: '#111827',
          'pointer-events': 'none',
        });
        t.textContent = ln;
        g.appendChild(t);
      });
      g.addEventListener('pointerdown', (ev) => onNodeDown(ev, n));
      canvas.appendChild(g);
    });

    $('undo').disabled = history.length === 0;
    $('del').disabled = !selected;
    const field = $('text');
    field.disabled = !selected;
    if (selected) {
      const item =
        selected.type === 'node' ? diagram.nodes.find((n) => n.id === selected.id) : diagram.edges.find((e) => e.id === selected.id);
      if (!item) selected = null;
      else if (document.activeElement !== field) field.value = selected.type === 'node' ? item.text : item.label;
    }
    if (!selected) field.value = '';
  }

  function select(sel) {
    selected = sel;
    if (sel && sel.type === 'node') {
      const n = diagram.nodes.find((q) => q.id === sel.id);
      $('shape').value = n.shape;
      $('color').value = n.color;
    }
    render();
  }

  function onNodeDown(ev, n) {
    ev.stopPropagation();
    if (connecting) {
      if (pending === null) pending = n.id;
      else {
        const r = DiagramCore.addEdge(diagram, pending, n.id);
        pending = null;
        if (r.id) {
          history.push(diagram);
          diagram = r.diagram;
          selected = { type: 'edge', id: r.id };
        }
      }
      return render();
    }
    selected = { type: 'node', id: n.id };
    const p = toDiagram(ev);
    drag = { id: n.id, dx: n.x - p.x, dy: n.y - p.y, moved: false, base: diagram };
    canvas.setPointerCapture(ev.pointerId);
    $('shape').value = n.shape;
    $('color').value = n.color;
    render();
  }

  canvas.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    const p = toDiagram(ev);
    drag.moved = true;
    diagram = DiagramCore.moveNode(drag.base, drag.id, p.x + drag.dx, p.y + drag.dy, grid());
    render();
  });
  canvas.addEventListener('pointerup', function () {
    if (drag && drag.moved) history.push(drag.base);
    drag = null;
    render();
  });
  canvas.addEventListener('pointerdown', function () {
    if (!connecting) selected = null;
    pending = null;
    render();
  });
  canvas.addEventListener('dblclick', function (ev) {
    if (ev.target !== canvas) return;
    const p = toDiagram(ev);
    addBox(p.x, p.y);
  });
  canvas.addEventListener('keydown', function (ev) {
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && selected) {
      ev.preventDefault();
      removeSelected();
    }
  });

  function addBox(x, y) {
    const r = DiagramCore.addNode(diagram, {
      x: DiagramCore.snap(x, grid()),
      y: DiagramCore.snap(y, grid()),
      text: 'New box',
      shape: $('shape').value,
      color: $('color').value,
    });
    history.push(diagram);
    diagram = r.diagram;
    selected = { type: 'node', id: r.id };
    render();
    $('text').focus();
    $('text').select();
  }

  function removeSelected() {
    if (!selected) return;
    const next = selected.type === 'node' ? DiagramCore.removeNode(diagram, selected.id) : DiagramCore.removeEdge(diagram, selected.id);
    selected = null;
    commit(next);
  }

  $('add').addEventListener('click', () => {
    const b = DiagramCore.bounds(diagram, 0);
    addBox(diagram.nodes.length ? b.x + b.width + 120 : 160, diagram.nodes.length ? b.y + b.height / 2 : 100);
  });
  $('del').addEventListener('click', removeSelected);
  $('connect').addEventListener('click', () => {
    connecting = !connecting;
    pending = null;
    $('connect').setAttribute('aria-pressed', String(connecting));
    canvas.classList.toggle('connecting', connecting);
    $('help').textContent = connecting
      ? 'Connect mode: click the first box, then the box it points to. Click "Connect" again to stop.'
      : 'Click "Add box", or double-click the canvas. Drag boxes to move them.';
    render();
  });
  $('undo').addEventListener('click', () => {
    if (!history.length) return;
    diagram = history.pop();
    selected = null;
    render();
  });

  // Editing text / shape / colour of the selection
  $('text').addEventListener('input', function () {
    if (!selected) return;
    const next =
      selected.type === 'node'
        ? DiagramCore.updateNode(diagram, selected.id, { text: $('text').value })
        : DiagramCore.updateEdge(diagram, selected.id, { label: $('text').value });
    diagram = next; // typing is not pushed to history per keystroke
    render();
  });
  $('text').addEventListener('focus', () => history.push(diagram));
  $('text').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      canvas.focus();
    }
  });
  $('shape').addEventListener(
    'change',
    () => selected && selected.type === 'node' && commit(DiagramCore.updateNode(diagram, selected.id, { shape: $('shape').value })),
  );
  $('color').addEventListener(
    'change',
    () => selected && selected.type === 'node' && commit(DiagramCore.updateNode(diagram, selected.id, { color: $('color').value })),
  );
  Object.keys(DiagramCore.COLORS).forEach((c) =>
    $('color').appendChild(el('option', { value: c, text: c.charAt(0).toUpperCase() + c.slice(1) })),
  );

  // Outline -> tree
  $('make-tree').addEventListener('click', () => {
    const r = DiagramCore.layoutTree($('outline').value);
    if (!r.diagram.nodes.length) return setStatus($('outline-status'), 'Type at least one line first.', 'warn');
    selected = null;
    commit(r.diagram);
    setStatus(
      $('outline-status'),
      r.errors.length ? r.errors.join(' ') : r.diagram.nodes.length + ' boxes created. Drag them to adjust.',
      r.errors.length ? 'warn' : 'ok',
    );
  });

  // Export / save / open
  const svgText = () => DiagramCore.toSvg(diagram);
  $('dl-svg').addEventListener('click', () => {
    if (!diagram.nodes.length) return setStatus($('status'), 'Add something first.', 'warn');
    downloadBlob(svgText(), 'diagram.svg', 'image/svg+xml');
    setStatus($('status'), 'SVG saved.', 'ok');
  });
  $('dl-png').addEventListener('click', () => {
    if (!diagram.nodes.length) return setStatus($('status'), 'Add something first.', 'warn');
    const b = DiagramCore.bounds(diagram);
    const scale = Math.min(3, 8000 / Math.max(b.width, b.height));
    const img = new Image();
    img.onload = function () {
      const c = document.createElement('canvas');
      c.width = Math.round(b.width * scale);
      c.height = Math.round(b.height * scale);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        downloadBlob(blob, 'diagram.png');
        setStatus($('status'), 'PNG saved.', 'ok');
      }, 'image/png');
    };
    img.onerror = () => setStatus($('status'), 'Could not make the PNG; try SVG instead.', 'error');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText());
  });
  $('dl-json').addEventListener('click', () => {
    downloadBlob(DiagramCore.serialize(diagram), 'diagram.json', 'application/json');
    setStatus($('status'), 'Saved. Use "Open saved file" to continue later.', 'ok');
  });
  $('open').addEventListener('change', async () => {
    const f = $('open').files[0];
    if (!f) return;
    try {
      const next = DiagramCore.parse(await readText(f));
      selected = null;
      commit(next);
      setStatus($('status'), 'Opened ' + f.name + '.', 'ok');
    } catch (e) {
      setStatus($('status'), e.message, 'error');
    }
    $('open').value = '';
  });
  $('clear').addEventListener('click', () => {
    if (!diagram.nodes.length) return;
    selected = null;
    commit(DiagramCore.create());
    setStatus($('status'), 'Cleared. Use Undo to bring it back.', 'ok');
  });

  window.addEventListener('resize', render);
  render();
})();

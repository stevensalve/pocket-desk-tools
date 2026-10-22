/* Launcher page: renders the tool cards from site/tools-data.js and filters them. */
(function () {
  'use strict';

  const grid = document.getElementById('tool-grid');
  const search = document.getElementById('search');
  const empty = document.getElementById('no-results');

  function card(tool, index) {
    const a = document.createElement('a');
    a.className = 'tool-card';
    a.href = 'tools/' + tool.id + '/index.html';

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(index + 1);
    num.setAttribute('aria-hidden', 'true');

    const title = document.createElement('strong');
    title.textContent = tool.title;
    const tagline = document.createElement('span');
    tagline.textContent = tool.tagline;
    const replaces = document.createElement('small');
    replaces.textContent = 'Instead of: ' + tool.replaces;

    a.append(num, title, tagline, replaces);
    return a;
  }

  const cards = window.TOOLS.map(function (tool, i) {
    const node = card(tool, i);
    grid.appendChild(node);
    return {
      tool: tool,
      node: node,
      text: (tool.title + ' ' + tool.tagline + ' ' + tool.tags.join(' ') + ' ' + tool.replaces).toLowerCase(),
    };
  });

  search.addEventListener('input', function () {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    cards.forEach(function (c) {
      const match = !q || c.text.includes(q);
      c.node.hidden = !match;
      if (match) shown++;
    });
    empty.hidden = shown > 0;
  });
})();

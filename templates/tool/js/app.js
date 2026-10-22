/* {{title}} - user interface. Keep logic in core.js; this file only wires the page. */
(function () {
  'use strict';

  const { setStatus } = OT; // helpers from js/common.js
  const $ = (id) => document.getElementById(id);

  $('name').addEventListener('input', function () {
    try {
      setStatus($('status'), {{Global}}.greet($('name').value), 'ok');
    } catch (err) {
      setStatus($('status'), err.message, ''); // an empty field is not an error worth shouting about
    }
  });
})();

/**
 * {{title}} - core logic.
 *
 * Rules for this file:
 *  - No DOM access (no document/window) - it must run in Node for unit tests.
 *  - Pure functions: same input, same output, no hidden state.
 *  - Throw `Error` with a plain-language message for bad input; the UI shows it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.{{Global}} = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Example function - replace with your tool's real logic. */
  function greet(name) {
    const clean = String(name == null ? '' : name).trim();
    if (!clean) throw new Error('Type your name first.');
    return 'Hello, ' + clean + '!';
  }

  return { greet: greet };
});

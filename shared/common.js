/**
 * Offline Office Toolkit - shared helpers (namespace `OT`).
 *
 * Written as a classic script + CommonJS hybrid so it works when a page is
 * opened straight from disk (file://) AND can be unit-tested in Node.
 * Pure functions live at the top; DOM helpers below only run in a browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OT = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Human readable file size, e.g. 1536 -> "1.5 KB". */
  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return value.toFixed(value >= 10 ? 0 : 1) + ' ' + units[i];
  }

  /** Escape text for safe insertion with innerHTML. Prefer textContent. */
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** "report.final.pdf" -> "report.final" */
  function baseName(filename) {
    const i = String(filename).lastIndexOf('.');
    return i > 0 ? String(filename).slice(0, i) : String(filename);
  }

  /** Lower-cased extension without the dot: "A.PDF" -> "pdf". */
  function extension(filename) {
    const i = String(filename).lastIndexOf('.');
    return i > 0
      ? String(filename)
          .slice(i + 1)
          .toLowerCase()
      : '';
  }

  /** Strip characters that are illegal in file names on Windows/macOS/Linux. */
  function safeFileName(name, fallback) {
    const cleaned = String(name)
      .replace(/[\\/:*?"<>|]/g, '_')
      .split('')
      .map(function (c) {
        return c.charCodeAt(0) < 32 ? '_' : c; // control characters are illegal in file names too
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '');
    return cleaned || fallback || 'file';
  }

  /** Return a function that delays `fn` until `ms` ms of silence. */
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      const self = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(self, args);
      }, ms);
    };
  }

  /** Clamp a number into [min, max]. */
  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  // ------------------------------------------------------------------
  // Browser-only helpers
  // ------------------------------------------------------------------

  /** Save a Blob (or bytes) to the user's device via a temporary link. */
  function downloadBlob(data, filename, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 10000);
  }

  /** Read a File as ArrayBuffer. */
  function readArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () {
        resolve(r.result);
      };
      r.onerror = function () {
        reject(r.error || new Error('Could not read ' + file.name));
      };
      r.readAsArrayBuffer(file);
    });
  }

  /** Read a File as text (UTF-8). */
  function readText(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () {
        resolve(String(r.result));
      };
      r.onerror = function () {
        reject(r.error || new Error('Could not read ' + file.name));
      };
      r.readAsText(file);
    });
  }

  /** Show a message in an element with `role="status"`. kind: ok|error|warn|"" */
  function setStatus(el, message, kind) {
    if (!el) return;
    el.textContent = message || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  /**
   * Make a `<label class="dropzone">` accept drag & drop as well as clicks.
   * `onFiles(File[])` is called with the chosen files.
   */
  function bindDropzone(zone, input, onFiles) {
    function handle(fileList) {
      const files = Array.prototype.slice.call(fileList || []);
      if (files.length) onFiles(files);
    }
    input.addEventListener('change', function () {
      handle(input.files);
      input.value = ''; // allow picking the same file again
    });
    ['dragenter', 'dragover'].forEach(function (type) {
      zone.addEventListener(type, function (e) {
        e.preventDefault();
        zone.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (type) {
      zone.addEventListener(type, function (e) {
        e.preventDefault();
        zone.classList.remove('is-over');
      });
    });
    zone.addEventListener('drop', function (e) {
      handle(e.dataTransfer && e.dataTransfer.files);
    });
  }

  /**
   * Copy text to the clipboard. Uses the modern API when available and falls
   * back to a hidden textarea so it also works from file:// in older browsers.
   * Resolves to true on success.
   */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        },
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'visually-hidden';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  /** Create an element with attributes/text in one call. */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /** Wire up a simple accessible tab bar. Panels are matched via aria-controls. */
  function bindTabs(tabBar, onChange) {
    const tabs = Array.prototype.slice.call(tabBar.querySelectorAll('[role="tab"]'));
    function select(tab) {
      tabs.forEach(function (t) {
        const active = t === tab;
        t.setAttribute('aria-selected', String(active));
        t.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !active;
      });
      if (onChange) onChange(tab.getAttribute('aria-controls'));
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        select(t);
      });
      t.addEventListener('keydown', function (e) {
        let next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (next) {
          e.preventDefault();
          next.focus();
          select(next);
        }
      });
    });
    const initial = tabs.filter(function (t) {
      return t.getAttribute('aria-selected') === 'true';
    })[0];
    select(initial || tabs[0]);
  }

  return {
    formatBytes: formatBytes,
    escapeHtml: escapeHtml,
    baseName: baseName,
    extension: extension,
    safeFileName: safeFileName,
    debounce: debounce,
    clamp: clamp,
    downloadBlob: downloadBlob,
    readArrayBuffer: readArrayBuffer,
    readText: readText,
    setStatus: setStatus,
    bindDropzone: bindDropzone,
    bindTabs: bindTabs,
    copyText: copyText,
    el: el,
  };
});

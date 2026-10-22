/* Password & ID Generator - user interface. Generation logic lives in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, copyText, bindTabs, el } = OT;
  const $ = (id) => document.getElementById(id);

  const rng = PwCore.makeCryptoRng((buf) => crypto.getRandomValues(buf));
  const state = { tab: 'password', values: [] };

  // Show live values next to sliders.
  [
    ['pw-len', 'pw-len-out'],
    ['pp-words', 'pp-words-out'],
    ['pin-len', 'pin-len-out'],
  ].forEach(([i, o]) => $(i).addEventListener('input', () => ($(o).textContent = $(i).value)));

  const TABS = ['password', 'passphrase', 'pin', 'id'];
  TABS.forEach((t) =>
    $('tab-' + t).addEventListener('click', () => {
      state.tab = t;
      TABS.forEach((x) => {
        $('tab-' + x).setAttribute('aria-selected', String(x === t));
        $('panel-' + x).hidden = x !== t;
      });
      generate();
    }),
  );
  void bindTabs;

  function passwordOpts() {
    return {
      length: +$('pw-len').value,
      lower: $('pw-lower').checked,
      upper: $('pw-upper').checked,
      digits: $('pw-digits').checked,
      symbols: $('pw-symbols').checked,
      noAmbiguous: $('pw-amb').checked,
    };
  }

  function one() {
    switch (state.tab) {
      case 'password': {
        const o = passwordOpts();
        const text = PwCore.password(o, rng);
        return { text: text, bits: PwCore.entropyBits(PwCore.alphabetSize(o), o.length) };
      }
      case 'passphrase':
        return PwCore.passphrase(
          PwWords,
          { words: +$('pp-words').value, separator: $('pp-sep').value, capitalise: $('pp-cap').checked, number: $('pp-num').checked },
          rng,
        );
      case 'pin':
        return { text: PwCore.pin(+$('pin-len').value, rng), bits: Math.log2(10) * +$('pin-len').value };
      default:
        switch ($('id-kind').value) {
          case 'uuid4':
            return { text: PwCore.uuidV4(rng), bits: 122 };
          case 'uuid7':
            return { text: PwCore.uuidV7(Date.now(), rng), bits: 74 };
          case 'short':
            return { text: PwCore.shortId(2, 4, rng), bits: Math.log2(32) * 8 };
          case 'hex':
            return { text: PwCore.hexToken(32, rng), bits: 256 };
          default:
            return { text: PwCore.urlToken(32, rng), bits: 192 };
        }
    }
  }

  function generate() {
    const list = $('results');
    list.textContent = '';
    setStatus($('out-status'), '');
    try {
      const n = +$('count').value;
      const items = [];
      for (let i = 0; i < n; i++) items.push(one());
      state.values = items.map((x) => x.text);
      items.forEach((x) => list.appendChild(el('li', { text: x.text })));
      const bits = items[0].bits;
      const s = PwCore.strength(bits);
      $('meter').hidden = false;
      $('meter').value = s.level;
      const secretKind = state.tab === 'password' || state.tab === 'passphrase' || state.tab === 'pin';
      setStatus(
        $('strength'),
        s.label +
          ' - about ' +
          Math.round(bits) +
          ' bits.' +
          (secretKind ? ' A fast offline attacker would need ' + PwCore.crackTime(bits) + '.' : ''),
        s.level >= 2 ? 'ok' : 'warn',
      );
      $('copy').disabled = false;
      $('dl').disabled = false;
    } catch (err) {
      state.values = [];
      $('meter').hidden = true;
      $('copy').disabled = true;
      $('dl').disabled = true;
      setStatus($('strength'), '');
      setStatus($('out-status'), err.message, 'error');
    }
  }

  $('gen').addEventListener('click', generate);
  $('count').addEventListener('change', generate);
  [
    'pw-len',
    'pw-lower',
    'pw-upper',
    'pw-digits',
    'pw-symbols',
    'pw-amb',
    'pp-words',
    'pp-sep',
    'pp-cap',
    'pp-num',
    'pin-len',
    'id-kind',
  ].forEach((id) => $(id).addEventListener('input', generate));
  $('copy').addEventListener('click', async () => {
    await copyText(state.values.join('\n'));
    setStatus($('out-status'), 'Copied. Paste it into your password manager now.', 'ok');
  });
  $('dl').addEventListener('click', () => {
    downloadBlob(state.values.join('\n') + '\n', 'generated.txt', 'text/plain;charset=utf-8');
    setStatus($('out-status'), 'Saved. Delete the file once you have stored the values safely.', 'warn');
  });

  generate();
})();

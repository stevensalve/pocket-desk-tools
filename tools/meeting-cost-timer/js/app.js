/* Meeting Cost Timer - user interface. All arithmetic lives in core.js. */
(function () {
  'use strict';

  const { setStatus, downloadBlob, el } = OT;
  const $ = (id) => document.getElementById(id);
  const STORE = 'meeting-cost-timer.log.v1';

  // Browser storage can be blocked (private mode, file:// policies): fall back to memory.
  let memory = '[]';
  const store = {
    get() {
      try {
        return localStorage.getItem(STORE) || '[]';
      } catch (e) {
        return memory;
      }
    },
    set(v) {
      memory = v;
      try {
        localStorage.setItem(STORE, v);
      } catch (e) {
        /* keep in memory only */
      }
    },
  };

  let timer = CostCore.idle();
  let groups = [{ name: '', count: '4', rate: '60' }];
  let ticker = null;

  const symbol = () => $('symbol').value.trim();
  function parsedGroups() {
    return groups
      .map((g) => ({ count: CostCore.parseAmount(g.count), rate: CostCore.parseAmount(g.rate) }))
      .map((g) => ({ count: g.count === null ? 0 : g.count, rate: g.rate === null ? 0 : g.rate }));
  }
  const perHour = () => CostCore.hourlyCost(parsedGroups());

  function renderGroups() {
    const body = $('groups');
    body.textContent = '';
    groups.forEach(function (g, i) {
      const bind = (key, attrs, label) => {
        const input = el('input', Object.assign({ 'aria-label': label + ' (group ' + (i + 1) + ')', value: g[key] }, attrs));
        input.addEventListener('input', () => {
          g[key] = input.value;
          update();
        });
        return input;
      };
      const rm = el('button', { type: 'button', text: 'Remove', 'aria-label': 'Remove group ' + (i + 1) });
      rm.disabled = groups.length === 1;
      rm.addEventListener('click', () => {
        groups.splice(i, 1);
        renderGroups();
        update();
      });
      body.appendChild(
        el('tr', {}, [
          el('td', {}, [bind('name', { type: 'text', placeholder: 'e.g. Engineers' }, 'Group name')]),
          el('td', {}, [bind('count', { type: 'text', inputmode: 'numeric' }, 'People')]),
          el('td', {}, [bind('rate', { type: 'text', inputmode: 'decimal' }, 'Hourly rate')]),
          el('td', {}, [rm]),
        ]),
      );
    });
  }

  function validate() {
    const bad = groups.some((g) => CostCore.parseAmount(g.count) === null || CostCore.parseAmount(g.rate) === null);
    setStatus(
      $('who-status'),
      bad
        ? 'Use plain numbers like 4 and 60 or 1,250.50. Rows with other text count as zero.'
        : CostCore.headcount(parsedGroups()) + ' people, ' + CostCore.formatMoney(perHour(), symbol()) + ' per hour in total.',
      bad ? 'warn' : 'ok',
    );
  }

  function tick() {
    const ms = CostCore.elapsed(timer, Date.now());
    $('cost').textContent = CostCore.formatMoney(CostCore.costFor(perHour(), ms), symbol());
    $('time').textContent = CostCore.formatDuration(ms);
    $('rate').textContent =
      CostCore.formatMoney(perHour() / 3600, symbol()) + ' per second, ' + CostCore.formatMoney(perHour() / 60, symbol()) + ' per minute';
  }

  function update() {
    validate();
    tick();
    const minutes = parseFloat($('plan-min').value) || 0;
    const annual = CostCore.annualCost(perHour(), Math.max(0, minutes), $('freq').value);
    const label = {
      once: 'one meeting',
      daily: 'every working day for a year',
      weekly: 'weekly for a year',
      biweekly: 'every two weeks for a year',
      monthly: 'monthly for a year',
      quarterly: 'quarterly for a year',
    }[$('freq').value];
    setStatus(
      $('annual'),
      minutes > 0 ? 'A ' + minutes + '-minute meeting, ' + label + ', costs about ' + CostCore.formatMoney(annual, symbol()) + '.' : '',
      'ok',
    );
    $('perspective').textContent =
      minutes > 0 && CostCore.headcount(parsedGroups()) > 0
        ? CostCore.perspective(CostCore.annualCost(CostCore.headcount(parsedGroups()), minutes, $('freq').value), 1).replace(
            'at the average rate',
            'across all attendees',
          )
        : '';
    buttons();
  }

  function buttons() {
    const running = CostCore.isRunning(timer);
    const started = timer.startedAt !== null;
    $('start').disabled = started;
    $('pause').disabled = !started;
    $('pause').textContent = timer.pausedAt !== null ? 'Resume' : 'Pause';
    $('finish').disabled = !started;
    if (running && !ticker) ticker = setInterval(tick, 250);
    if (!running && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  $('start').addEventListener('click', () => {
    if (perHour() <= 0) return setStatus($('run-status'), 'Add at least one person with a rate first.', 'warn');
    setStatus($('run-status'), '');
    timer = CostCore.start(Date.now());
    update();
  });
  $('pause').addEventListener('click', () => {
    timer = timer.pausedAt !== null ? CostCore.resume(timer, Date.now()) : CostCore.pause(timer, Date.now());
    update();
  });
  $('reset').addEventListener('click', () => {
    timer = CostCore.idle();
    setStatus($('run-status'), '');
    update();
  });
  $('finish').addEventListener('click', () => {
    const now = Date.now();
    const ms = CostCore.elapsed(timer, now);
    const entry = CostCore.makeLogEntry({
      title: $('title').value,
      date: new Date(now).toISOString().slice(0, 10),
      ms: ms,
      cost: CostCore.costFor(perHour(), ms),
      people: CostCore.headcount(parsedGroups()),
      symbol: symbol(),
    });
    const log = CostCore.loadLog(store.get());
    log.unshift(entry);
    store.set(JSON.stringify(log.slice(0, 200)));
    timer = CostCore.idle();
    setStatus(
      $('run-status'),
      'Logged: ' + CostCore.formatMoney(entry.cost, entry.symbol) + ' over ' + CostCore.formatDuration(entry.ms) + '.',
      'ok',
    );
    update();
    renderLog();
  });

  function renderLog() {
    const log = CostCore.loadLog(store.get());
    const body = $('log-body');
    body.textContent = '';
    log.forEach((e) =>
      body.appendChild(
        el('tr', {}, [
          el('td', { text: e.date }),
          el('td', { text: e.title }),
          el('td', { text: CostCore.formatDuration(e.ms) }),
          el('td', { text: String(e.people) }),
          el('td', { text: CostCore.formatMoney(e.cost, e.symbol) }),
        ]),
      ),
    );
    $('log-table').hidden = !log.length;
    const total = log.reduce((s, e) => s + e.cost, 0);
    setStatus(
      $('log-total'),
      log.length ? log.length + ' meeting(s), ' + CostCore.formatMoney(total, log[0].symbol) + ' in total.' : 'No meetings logged yet.',
    );
    $('log-csv').disabled = !log.length;
    $('log-clear').disabled = !log.length;
  }
  $('log-csv').addEventListener('click', () =>
    downloadBlob(CostCore.logCsv(CostCore.loadLog(store.get())), 'meeting-log.csv', 'text/csv;charset=utf-8'),
  );
  $('log-clear').addEventListener('click', () => {
    store.set('[]');
    renderLog();
  });

  $('add-group').addEventListener('click', () => {
    if (groups.length >= 12) return setStatus($('who-status'), 'Up to 12 groups.', 'warn');
    groups.push({ name: '', count: '1', rate: '60' });
    renderGroups();
    update();
  });
  ['symbol', 'plan-min', 'freq'].forEach((id) => $(id).addEventListener('input', update));

  // When the tab returns to the foreground, refresh immediately (timestamps keep the time correct).
  document.addEventListener('visibilitychange', tick);

  renderGroups();
  renderLog();
  update();
})();

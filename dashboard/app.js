// Token Radar dashboard (model radar-4). Reads window.RADAR, written beside
// dashboard/ by main.ts from the same board board.json carries - the farm
// plans shown here are the board's own farm_steps, not a second derivation.
// No network: every byte it renders is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watch: false, sort: 'rank', dir: 1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) { return n === null || n === undefined ? 'n/a' : (n > 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtAge(d) {
    if (d === null || d === undefined) return 'unknown';
    return d >= 365 ? (d / 365).toFixed(1) + 'y' : Math.max(0, Math.round(d)) + 'd';
  }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) node.appendChild(x); });
      else node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sorted(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'rank') { av = a.rank; bv = b.rank; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.rank - b.rank;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'TOKEN RADAR' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'Model ' + DATA.model_version }),
        el('span', { text: DATA.scanned + ' protocols scanned' })));
  }
  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Every protocol that records no token, ranked by what its launch could be worth' }),
        el('p', null, 'The board ranks ', el('b', { text: DATA.board_size + ' protocols' }),
          ' that record no token in the snapshot - all ', el('b', { text: DATA.watchlist_size + ' watchlist protocols' }),
          ' at or above ' + fmtUsd(DATA.floor_usd) + ' TVL, plus ' + DATA.early_size + ' earlier ones below that floor. ',
          'A protocol records no token yet is not proof it has none: DefiLlama\'s record is what the radar reads. ',
          'Implied values are this model\'s estimates, not prices and not predictions that a token will be issued.')),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('span', { text: 'Protocols scanned' }), el('b', { text: String(DATA.scanned) })),
        el('div', { class: 'stat' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'stat' }, el('span', { text: 'Board rows ranked' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'stat' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(DATA.total_implied_usd) }))));
  }
  function method() {
    var chips = Object.keys(DATA.peers.by_category).filter(function (k) {
      return DATA.peers.by_category[k].peers >= 3;
    }).sort(function (a, b) { return DATA.peers.by_category[b].peers - DATA.peers.by_category[a].peers; }).slice(0, 10)
      .map(function (k) {
        return el('span', null, k + ' ', el('b', { text: 'x' + DATA.peers.by_category[k].ratio.toFixed(3) }), ' (' + DATA.peers.by_category[k].peers + ' peers)');
      });
    return el('section', { class: 'method' },
      el('h2', { text: 'The value model, stated plainly' }),
      el('p', { text: DATA.model_summary }),
      el('div', { class: 'formula', text: 'implied = round( TVL x category multiple x momentum x maturity x breadth x plausibility )' }),
      el('p', { text: 'Rows badged TRADES BY PROXY are the plausibility step made visible: bridges, staking products, exchanges, versioned re-releases and wrapped, staked or exchange-branded products. Their value already trades through a parent token or business, so the model counts only 4% of their raw implied value - they stay on the board for coverage, and the detail view states each one\'s reason.' }),
      el('p', { text: 'Category multiples measured from this snapshot\'s ' + DATA.peers.tokenized_peers + ' tokenized protocols (global median x' + DATA.peers.global_ratio.toFixed(3) + '):' }),
      el('div', { class: 'peers' }, chips));
  }
  function controls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; render(); });
    function select(id, label, values, allLabel, current, onChange) {
      var s = el('select', { id: id, 'aria-label': label }, el('option', { value: 'all', text: allLabel }),
        values.map(function (v) { return el('option', { value: v, text: v, selected: v === current ? 'selected' : null }); }));
      s.addEventListener('change', function () { onChange(s.value); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: label }), s);
    }
    var watch = el('input', { type: 'checkbox', id: 'watch' });
    if (state.watch) watch.setAttribute('checked', 'checked');
    watch.addEventListener('change', function () { state.watch = watch.checked; render(); });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      select('category', 'Category', cats, 'All categories', state.category, function (v) { state.category = v; }),
      select('chain', 'Chain', chains, 'All chains', state.chain, function (v) { state.chain = v; }),
      el('label', { class: 'check' }, watch, 'Watchlist only'),
      el('span', { class: 'count', text: filtered().length + ' of ' + DATA.board_size + ' rows shown' }));
  }
  function sortHeader(key, label, dir) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () {
        if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = dir; }
        render();
      } }, label, state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null));
  }
  function boardTable() {
    var list = sorted(filtered());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () {
          state.q = ''; state.category = 'all'; state.chain = 'all'; state.watch = false; render();
        } })));
    }
    var max = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var nameCell = el('div', { class: 'name' },
        el('b', null, r.name,
          r.watchlist ? el('span', { class: 'badge', text: 'WATCHLIST' }) : null,
          r.plausibility_reason ? el('span', { class: 'badge proxy', text: 'TRADES BY PROXY' }) : null),
        el('span', { class: 'sub', text: (r.category || 'Uncategorised') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') }));
      tbody.appendChild(el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num' }, el('span', { class: 'rankno' + (r.rank <= 3 ? ' top' : ''), text: String(r.rank) })),
        el('td', null, nameCell),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }))),
        el('td', null, el('span', { class: 'status', text: 'records no token' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { class: 'sub', text: 'Protocols that record no token, ranked by implied value. Select a row for its model breakdown and farm plan.' }),
        el('thead', null, el('tr', null,
          sortHeader('rank', 'Rank', 1), sortHeader('name', 'Protocol', 1), sortHeader('tvl', 'TVL', -1),
          sortHeader('growth', '7d', -1), sortHeader('age', 'Age', -1), sortHeader('implied', 'Implied value', -1),
          el('th', { scope: 'col', text: 'Token' }))),
        tbody)));
  }
  function earlySection() {
    if (!DATA.early.length) return null;
    return el('section', { class: 'early' },
      el('h2', { text: 'Early radar: momentum below the floor' }),
      el('p', { class: 'sub', text: 'Protocols under ' + fmtUsd(DATA.floor_usd) + ' TVL whose TVL grew fastest in the last 7 days - the launches a TVL table would not show yet. Select one for its farm plan.' }),
      el('div', { class: 'cards' }, DATA.early.map(function (r) {
        return el('button', { class: 'card', type: 'button', onclick: function () { openDetail(r.slug); } },
          el('b', { text: r.name }),
          el('span', { class: 'mom', text: fmtPct(r.change_7d) + ' in 7 days' }),
          el('span', { class: 'row' }, el('span', { text: 'TVL' }), el('span', { text: fmtUsd(r.tvl_usd) })),
          el('span', { class: 'row' }, el('span', { text: 'Implied' }), el('span', { text: fmtUsd(r.implied_value_usd) })),
          el('span', { class: 'row' }, el('span', { text: 'Board rank' }), el('span', { text: '#' + r.rank })));
      })));
  }
  function liveSection() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Uncategorised') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.ratio === null ? 'n/a' : 'x' + r.ratio.toFixed(3) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))));
    });
    return el('section', { class: 'early live' },
      el('h2', { text: 'Already trading: the peer set, kept apart' }),
      el('p', { class: 'sub', text: 'These protocols\' tokens already trade, so they are never ranked. Their market-cap/TVL ratios are the multiples the model applies to the board above.' }),
      el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }),
            el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }),
            el('th', { scope: 'col', text: 'Token' }))),
          tbody))));
  }
  function foot() {
    return el('footer', { class: 'foot' },
      el('p', { text: 'Data: ' + DATA.source + ' Snapshot date ' + DATA.as_of + '. The board is regenerated from that snapshot on every run of the program.' }),
      el('p', { text: 'Implied values are the model\'s estimates of what a launch could be worth if the protocol\'s record stayed as it is. They are not prices, not investment advice, and not a claim that any protocol will issue a token.' }));
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; });
  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' - watchlist' : '') + (row.plausibility_reason ? ' - trades by proxy' : '') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Uncategorised') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' - records no token in the snapshot' })),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })));
    function line(label, value) { return el('div', null, el('span', { text: label }), el('b', { text: value })); }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'How this implied value is built' }),
      el('div', { class: 'equation' },
        line('TVL', fmtUsd(row.tvl_usd)),
        line('Category multiple (' + row.ratio_source + ')', 'x' + row.category_ratio.toFixed(4)),
        line('7-day change', fmtPct(row.change_7d)),
        line('Momentum multiplier', 'x' + row.momentum_multiplier.toFixed(4)),
        line('Age recording no token', fmtAge(row.age_days)),
        line('First tracked by DefiLlama', row.listed_at || 'not reported'),
        line('Maturity multiplier', 'x' + row.maturity_multiplier.toFixed(4)),
        line('Breadth multiplier', 'x' + row.breadth_multiplier.toFixed(4)),
        line('Launch plausibility', 'x' + row.plausibility_factor.toFixed(2)),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { text: fmtUsd(row.implied_value_usd) }))),
      row.plausibility_reason ? el('p', { class: 'sub', text: 'Why the plausibility factor applies: ' + row.plausibility_reason + '. The protocol stays on the board for coverage; the factor keeps a product whose value already trades from outranking protocols still waiting on a launch of their own.' }) : null,
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol on the board; no name is special-cased. An estimate, not a price.' })));
    var fs = row.farm_summary;
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      fs ? el('div', { class: 'plan-glance' },
        el('div', null, el('span', { text: 'Capital in the position' }), el('b', { text: fmtUsd(fs.capital_usd) })),
        el('div', null, el('span', { text: 'Fees over the ' + fs.hold_days + '-day window' }), el('b', { text: 'about ' + fmtUsd(fs.fees_usd) })),
        el('div', null, el('span', { text: 'Time to set up' }), el('b', { text: fs.setup_minutes + ' minutes' })),
        el('div', null, el('span', { text: 'Time each week' }), el('b', { text: fs.weekly_minutes + ' minutes' }))) : null,
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) { return el('li', { text: s }); }))));
    if (!dialog.isConnected) app.appendChild(dialog);
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }
  function render() {
    if (dialog.isConnected) app.removeChild(dialog);
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(method());
    shell.appendChild(controls());
    shell.appendChild(boardTable());
    var early = earlySection();
    if (early) shell.appendChild(early);
    shell.appendChild(liveSection());
    shell.appendChild(foot());
    app.appendChild(shell);
    app.appendChild(dialog);
    app.setAttribute('aria-busy', 'false');
  }
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();

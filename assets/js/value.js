/* The Quant Hardwood — player value (#/<L>/value): wins above replacement (WAR) from HPM, the best
 * players at each position, and a filterable leaderboard.
 *
 * Data: data/<L>/<S>/value.json (analytics/value.py season_value: cols/rows, best, currency, roles).
 * WAR = (HPM + 2.0) x possessions / 100 / points per win; possessions = minutes x league pace / 48 (40
 * WNBA); points per win = the game model's margin sd x sqrt(2 pi). Before a season's first regular-season
 * game the page shows the latest season that has one. */
(function (HW) {
'use strict';

const FX = () => HW.fx;
const ROLE = { G: 'Guards', W: 'Wings', B: 'Bigs' };
const ROLE_ONE = { G: 'Guard', W: 'Wing', B: 'Big' };
const ST = { pos: 'all', team: 'all', min: null, q: '1', n: '100' };

function rowsOf(v) {
  const cols = (v && v.cols) || [];
  return ((v && v.rows) || []).map(r => { const o = {}; cols.forEach((c, i) => { o[c] = r[i]; }); return o; });
}

function why(fx, r) {
  const parts = [];
  if (fx.isNum(r.o) && fx.isNum(r.d)) parts.push('O ' + fx.signed(r.o, 1) + ' · D ' + fx.signed(r.d, 1));
  (r.why || []).forEach(w => parts.push(fx.esc(w[0]) + ' ' + w[1]));
  return parts.join(' · ');
}

function render(el, params, state) {
  const fx = FX(), L = fx.L(params, state);
  el.innerHTML = fx.muted('Loading…');
  return fx.ready().then(() => {
    const S = fx.S(params, state, L);
    const q = (params && params.query) || {};
    ['pos', 'team', 'min', 'q', 'n'].forEach(k => { if (q[k] !== undefined && q[k] !== '') ST[k] = q[k]; });
    return HW.load(fx.path(L, S, 'value.json')).then(v => {
      if (!fx.alive(el)) return null;
      if (fx.ok(v) && (v.rows || []).length) { draw(el, L, S, v, null); return null; }
      return HW.load(fx.path(L, S - 1, 'value.json')).then(pv => {
        if (!fx.alive(el)) return;
        if (fx.ok(pv) && (pv.rows || []).length) draw(el, L, S - 1, pv, S);
        else el.innerHTML = fx.card('Player value ' + fx.seasonLabel(L, S), '', fx.notBuilt('Player value for ' + fx.seasonLabel(L, S), v));
      });
    });
  });
}

function draw(el, L, S, v, asked) {
  const fx = FX();
  const rows = rowsOf(v);
  const byId = {}; rows.forEach(r => { byId[r.id] = r; });
  const cur = v.currency || {};
  const roles = v.roles || ROLE;
  const tName = id => fx.teamName(L, id);
  let h = '';
  if (asked) h += '<div class="card"><div class="pad">' + fx.muted('The ' + fx.esc(fx.seasonLabel(L, asked)) + ' regular season has not started, so this page shows ' + fx.esc(fx.seasonLabel(L, S)) + '. Each team\'s projected value for ' + fx.esc(fx.seasonLabel(L, asked)) + ' is on its team page ("Strengths and needs") and in the <a href="' + fx.href(L, 'trade') + '">trade simulator</a>.') + '</div></div>';
  h += '<div class="card"><div class="card-header">Player value ' + fx.esc(fx.seasonLabel(L, S)) + ' <span class="card-sub">Wins above replacement (WAR): a player\'s HPM (impact per 100 possessions, above an average player) over the possessions the player was on the floor, measured from a replacement player (' + fx.signed(cur.replacement, 1) + ' per 100), at ' + fx.num(cur.points_per_win, 1) + ' points of margin per win (the game model\'s margin spread × √2π). Possessions = minutes × league pace (' + fx.num(cur.pace, 1) + ') / ' + fx.num(cur.game_minutes, 0) + '. <a href="#/methodology">Methodology</a></span></div>';
  const top = rows.filter(r => r.q).sort((a, b) => b.war - a.war);
  const best = v.best || {};
  h += '<div class="kpi-grid">' + [fx.tile('Most WAR', top[0] ? fx.esc(top[0].name) : '—', top[0] ? fx.num(top[0].war, 1) + ' WAR · ' + fx.esc(fx.teamAbbr(L, top[0].team)) + ' · HPM ' + fx.signed(top[0].hpm, 1) : '')]
    .concat(['G', 'W', 'B'].map(k => { const r = byId[(best[k] || [])[0]]; return fx.tile('Best ' + (ROLE_ONE[k] || k).toLowerCase(), r ? fx.esc(r.name) : '—', r ? fx.num(r.war, 1) + ' WAR · ' + fx.esc(fx.teamAbbr(L, r.team)) : ''); })).join('') + '</div></div>';
  h += '<div class="card"><div class="card-header">Best at each position <span class="card-sub">Qualified players (' + fx.num(v.n_qualified, 0) + '; ' + (fx.isNum(v.min_floor) ? fx.num(v.min_floor, 0) + '+ minutes' : 'the minutes floor') + '). ESPN lists only G, F and C, so forwards are split into wings and bigs by box profile (rebounds, blocks, rim attempts against threes and assists). "Why" gives the offence and defence split of HPM and the player\'s best box skills (league percentile).</span></div><div class="grid-3 vl-best">' +
    ['G', 'W', 'B'].map(k => '<div><div class="vl-best-h">' + fx.esc(roles[k] || ROLE[k]) + '</div>' + HW.tableHTML([{ label: '#', align: 'right' }, { label: 'Player' }, { label: 'WAR', align: 'right' }, { label: 'HPM', align: 'right' }, { label: 'Pct', align: 'center', title: 'WAR percentile among qualified players' }],
      (best[k] || []).map((id, i) => { const r = byId[id] || {}; return { _href: fx.playerHref(L, id, S), cells: [i + 1, { v: r.name, html: fx.playerLink(L, id, r.name) + ' <span class="muted-inline">' + fx.esc(fx.teamAbbr(L, r.team)) + '</span><div class="vl-why">' + why(fx, r) + '</div>' }, { v: r.war, html: '<strong>' + fx.num(r.war, 1) + '</strong>' }, { v: r.hpm, html: fx.signed(r.hpm, 1) }, { v: r.pct, html: fx.pill(r.pct) }] }; }), { compact: true }) + '</div>').join('') + '</div></div>';
  const teams = Array.from(new Set(rows.map(r => r.team).filter(Boolean))).sort((a, b) => String(tName(a)).localeCompare(String(tName(b))));
  const maxMin = Math.max.apply(null, rows.map(r => r.min || 0).concat([100]));
  if (ST.min === null || !fx.isNum(ST.min)) ST.min = fx.isNum(v.min_floor) ? Math.round(v.min_floor) : 0;
  h += '<div class="card"><div class="card-header">Leaderboard <span class="card-sub" id="vl-sub"></span></div>' +
    '<div class="lab-controls hf-controls vl-ctl">' +
    '<label>Position<select id="vl-pos"><option value="all">All</option><option value="G">Guards</option><option value="W">Wings</option><option value="B">Bigs</option></select></label>' +
    '<label>Team<select id="vl-team"><option value="all">All teams</option>' + teams.map(t => '<option value="' + fx.esc(t) + '">' + fx.esc(tName(t)) + '</option>').join('') + '</select></label>' +
    '<label>Min minutes <span id="vl-min-v"></span><input id="vl-min" type="range" min="0" max="' + Math.ceil(maxMin / 50) * 50 + '" step="50"></label>' +
    '<label>Sample<select id="vl-q"><option value="1">Qualified only</option><option value="0">Everyone over the minutes</option></select></label>' +
    '<label>Show<select id="vl-n"><option value="50">Top 50</option><option value="100">Top 100</option><option value="0">All</option></select></label>' +
    '</div><div id="vl-table"></div><div class="pg-note">WAR and PAR (points above replacement) count the whole season; PAR/G is per game played; HPM is the rate per 100 possessions (O offence, D defence). Pct places WAR among qualified players (Pos pct among the same position group). ΔHPM is the change from last season. Percentiles of players below the minutes floor are against the qualified players and do not move theirs.</div></div>';
  h += '<div class="card"><div class="card-header">Rate against volume <span class="card-sub">HPM per 100 possessions against minutes played, coloured by position group; bigger dots carry more WAR. Qualified players.</span></div><div id="vl-chart" style="height:420px"></div></div>';
  el.innerHTML = h;
  const $ = id => document.getElementById(id);
  $('vl-pos').value = ST.pos; $('vl-team').value = teams.indexOf(ST.team) >= 0 ? ST.team : 'all'; $('vl-q').value = String(ST.q); $('vl-n').value = String(ST.n);
  $('vl-min').value = ST.min; $('vl-min-v').textContent = ST.min;
  const redraw = () => { syncUrl(L, S, asked); drawTable(L, S, rows); };
  $('vl-pos').onchange = e => { ST.pos = e.target.value; redraw(); };
  $('vl-team').onchange = e => { ST.team = e.target.value; redraw(); };
  $('vl-q').onchange = e => { ST.q = e.target.value; redraw(); };
  $('vl-n').onchange = e => { ST.n = e.target.value; redraw(); };
  $('vl-min').oninput = e => { ST.min = Number(e.target.value); $('vl-min-v').textContent = ST.min; };
  $('vl-min').onchange = redraw;
  drawTable(L, S, rows);
  HW.sortable(el);
  const col = { G: '#58a6ff', W: '#f0883e', B: '#3fb950' };
  const q = rows.filter(r => r.q && fx.isNum(r.hpm));
  fx.plot('vl-chart', ['G', 'W', 'B'].map(k => { const s = q.filter(r => r.role === k); return { type: 'scatter', mode: 'markers', name: roles[k] || ROLE[k], x: s.map(r => r.min), y: s.map(r => r.hpm),
    text: s.map(r => r.name + ' (' + fx.teamAbbr(L, r.team) + ')<br>WAR ' + fx.num(r.war, 1)), marker: { color: col[k], size: s.map(r => 5 + Math.max(0, r.war) * 1.2), opacity: 0.8, line: { color: '#0d1117', width: 1 } },
    hovertemplate: '%{text}<br>%{x:.0f} min · HPM %{y:+.1f}<extra></extra>' }; }),
  fx.layout({ showlegend: true, legend: { orientation: 'h', y: 1.08, font: { size: 10 } }, margin: { l: 50, r: 10, t: 20, b: 45 }, xaxis: { title: 'Minutes' }, yaxis: { title: 'HPM per 100', zeroline: true, zerolinecolor: '#6e7681' } }));
}

function drawTable(L, S, rows) {
  const fx = FX();
  let list = rows.filter(r => (ST.pos === 'all' || r.role === ST.pos) && (ST.team === 'all' || r.team === ST.team) && (r.min || 0) >= Number(ST.min || 0) && (String(ST.q) !== '1' || r.q));
  list.sort((a, b) => b.war - a.war);
  const total = list.length;
  if (Number(ST.n) > 0) list = list.slice(0, Number(ST.n));
  document.getElementById('vl-sub').textContent = total + ' players · ' + (ST.pos === 'all' ? 'all positions' : ROLE[ST.pos]) + (ST.team === 'all' ? '' : ' · ' + fx.teamName(L, ST.team)) + ' · ' + ST.min + '+ minutes';
  document.getElementById('vl-table').innerHTML = list.length ? HW.tableHTML([{ label: '#', align: 'right' }, { label: 'Player' }, { label: 'Team' }, { label: 'Pos', title: 'ESPN position and position group' }, { label: 'Age', align: 'right' },
    { label: 'GP', align: 'right' }, { label: 'Min', align: 'right' }, { label: 'WAR', align: 'right' }, { label: 'PAR/G', align: 'right', title: 'Points above replacement per game played' }, { label: 'HPM', align: 'right', title: 'Per 100 possessions' },
    { label: 'O', align: 'right' }, { label: 'D', align: 'right' }, { label: 'Pct', align: 'center' }, { label: 'Pos pct', align: 'center' }, { label: 'ΔHPM', align: 'right', title: 'Change from last season' }, { label: 'Last WAR', align: 'right' }],
    list.map((r, i) => ({ _href: fx.playerHref(L, r.id, S), cells: [i + 1, { v: r.name, html: fx.playerLink(L, r.id, r.name) }, { v: fx.teamAbbr(L, r.team), html: fx.teamLink(L, r.team) }, { v: r.role, html: fx.esc((r.pos || '') + ' · ' + (ROLE_ONE[r.role] || r.role)) },
      { v: r.age, html: fx.num(r.age, 0) }, r.gp, { v: r.min, html: fx.num(r.min, 0) }, { v: r.war, html: '<strong>' + fx.num(r.war, 1) + '</strong>' }, { v: r.par_g, html: fx.num(r.par_g, 1) }, { v: r.hpm, html: fx.signed(r.hpm, 1) },
      { v: r.o, html: fx.signed(r.o, 1) }, { v: r.d, html: fx.signed(r.d, 1) }, { v: r.pct, html: fx.pill(r.pct) }, { v: r.pct_role, html: fx.pill(r.pct_role) },
      { v: r.d_hpm, html: fx.isNum(r.d_hpm) ? '<span class="' + (r.d_hpm > 0 ? 'pg-up' : r.d_hpm < 0 ? 'pg-down' : '') + '">' + fx.signed(r.d_hpm, 1) + '</span>' : '—' }, { v: r.prev_war, html: fx.num(r.prev_war, 1) }] })), { compact: true, sticky: true })
    : fx.muted('No players match these filters.');
  HW.sortable('vl-table');
}

function syncUrl(L, S, asked) {
  try {
    const q = {};
    if (ST.pos !== 'all') q.pos = ST.pos;
    if (ST.team !== 'all') q.team = ST.team;
    q.min = String(ST.min);
    if (String(ST.q) !== '1') q.q = String(ST.q);
    if (String(ST.n) !== '100') q.n = String(ST.n);
    const s = asked || S;
    if (s !== FX().current(L)) q.s = String(s);
    const qs = Object.keys(q).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(q[k])).join('&');
    history.replaceState(null, '', '#/' + L + '/value' + (qs ? '?' + qs : ''));
  } catch (e) { /* history unavailable */ }
}

HW.route('value', render);
})(window.HW);

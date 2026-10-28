// app.js — UI, rendering, animations and peer-to-peer networking
'use strict';

const PREFIX = 'cabo-skat-v1-';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
};
const uid = () => Math.random().toString(36).slice(2, 10);
const AV_COLORS = ['#e76f51', '#2a9d8f', '#8e5bd6', '#e9a23b', '#3a86ff', '#d6336c', '#38b000'];
function avColor(id, v) { const i = v ? v.players.findIndex(p => p.id === id) : 0; return AV_COLORS[(i < 0 ? 0 : i) % AV_COLORS.length]; }
function avatar(p, v) { return `<span class="av" style="background:${avColor(p.id, v)}">${esc((p.name || '?').trim()[0] || '?').toUpperCase()}</span>`; }

const App = {
  mode: null, code: null, pid: null,
  name: store.get('cabo-name', ''),
  style: store.get('cabo-style', 'classic'),
  V: null, lastSeq: null, snapMode: false, showResults: true,
  net: 'idle', offline: false, prevPhase: null, resultsTimer: 0,
};
document.documentElement.style.setProperty('--back', BACK_SVG);

// ====================================================================
// Networking (PeerJS / WebRTC). The host's browser runs the Engine.
// ====================================================================
const Net = { peer: null, conns: new Map(), conn: null, lastHear: 0, retry: 0 };

function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
function shareLink() { return location.origin + location.pathname + '#' + App.code; }

function send(a) {
  if (App.mode === 'host') Engine.act(App.pid, a);
  else if (Net.conn && Net.conn.open) Net.conn.send({ t: 'act', a });
}

let saveTimer = 0;
function hostBroadcast() {
  const S = Engine.state;
  S.players.forEach(p => {
    if (p.bot) return;
    if (p.id === App.pid) onView(Engine.view(p.id));
    else { const c = Net.conns.get(p.id); if (c && c.open) { try { c.send({ t: 'view', v: Engine.view(p.id) }); } catch (e) {} } }
  });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set('cabo-host-' + App.code, JSON.stringify({ at: Date.now(), pid: App.pid, s: Engine.serialize() })), 250);
}

function startHost({ code, saved, quick } = {}) {
  App.mode = 'host';
  App.code = code || genCode();
  if (saved) { App.pid = saved.pid; Engine.load(JSON.parse(saved.s)); }
  else { App.pid = 'h-' + uid(); Engine.create(App.pid, App.name || t('you')); }
  Engine.onChange = hostBroadcast;
  history.replaceState(null, '', '#' + App.code);
  store.sset('cabo-hosting-' + App.code, '1');
  openHostPeer(0);
  if (quick) { Engine.addBot(); Engine.addBot(); Engine.startGame(); }
  Engine.kick();
}

function openHostPeer(attempt) {
  if (App.mode !== 'host') return;
  if (!window.Peer) { App.offline = true; refreshChrome(); return; }
  const peer = new Peer(PREFIX + App.code, { debug: 0 });
  Net.peer = peer;
  peer.on('open', () => { App.offline = false; refreshChrome(); });
  peer.on('connection', hostAccept);
  peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1500); });
  peer.on('error', e => {
    if (e.type === 'peer-unavailable') return;
    if (e.type === 'unavailable-id' || ['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
      if (e.type !== 'unavailable-id' || attempt > 6) { App.offline = true; refreshChrome(); }
      try { peer.destroy(); } catch (x) {}
      if (Net.peer === peer) setTimeout(() => openHostPeer(attempt + 1), Math.min(10000, 1500 + attempt * 1000));
    }
  });
}

function hostAccept(conn) {
  conn.lastSeen = Date.now();
  conn.on('data', msg => {
    conn.lastSeen = Date.now();
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello' && typeof msg.pid === 'string') {
      const pid = msg.pid.slice(0, 40);
      if (pid === App.pid) return;
      const pl = Engine.addPlayer(pid, String(msg.name || 'Player').slice(0, 16), false);
      if (!pl) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 600); return; }
      const old = Net.conns.get(pid);
      if (old && old !== conn) { try { old.close(); } catch (e) {} }
      Net.conns.set(pid, conn);
      conn.pid = pid;
      Engine.kick();
    } else if (msg.t === 'act' && conn.pid) Engine.act(conn.pid, msg.a);
    else if (msg.t === 'ping') conn.send({ t: 'pong' });
  });
  conn.on('close', () => dropConn(conn));
  conn.on('error', () => {});
}
function dropConn(conn) {
  if (conn.pid && Net.conns.get(conn.pid) === conn) { Net.conns.delete(conn.pid); Engine.setConnected(conn.pid, false); }
}

function startGuest(code) {
  App.mode = 'guest';
  App.code = code;
  App.pid = store.sget('cabo-pid-' + code) || ('g-' + uid());
  store.sset('cabo-pid-' + code, App.pid);
  store.sset('cabo-joined-' + code, '1');
  App.net = 'connecting';
  showScreen('lobby');
  connectGuest();
}

function connectGuest() {
  if (App.mode !== 'guest') return;
  if (!window.Peer) { App.net = 'hostGone'; refreshChrome(); return; }
  if (!Net.peer || Net.peer.destroyed) {
    const peer = new Peer({ debug: 0 });
    Net.peer = peer;
    peer.on('open', dial);
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1500); });
    peer.on('error', e => {
      if (e.type === 'peer-unavailable') { App.net = 'hostGone'; refreshChrome(); retryGuest(3000); }
      else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
        App.net = 'reconnecting'; refreshChrome();
        try { peer.destroy(); } catch (x) {}
        retryGuest(3000);
      }
    });
  } else if (Net.peer.open) dial();
  else retryGuest(2000);
}
let retryTimer = 0;
function retryGuest(ms) { clearTimeout(retryTimer); retryTimer = setTimeout(connectGuest, ms); }

function dial() {
  if (Net.conn) { try { Net.conn.close(); } catch (e) {} }
  const conn = Net.peer.connect(PREFIX + App.code, { reliable: true, serialization: 'json' });
  Net.conn = conn;
  conn.on('open', () => { Net.lastHear = Date.now(); conn.send({ t: 'hello', pid: App.pid, name: App.name || 'Player' }); });
  conn.on('data', msg => {
    Net.lastHear = Date.now();
    if (msg.t === 'view') { if (App.net !== 'ok') { App.net = 'ok'; refreshChrome(); } onView(msg.v); }
    else if (msg.t === 'full') { App.net = 'full'; refreshChrome(); }
  });
  conn.on('close', () => { if (Net.conn === conn && App.net !== 'full') { App.net = 'reconnecting'; refreshChrome(); retryGuest(2000); } });
  conn.on('error', () => {});
}

setInterval(() => {
  if (App.mode === 'guest' && Net.conn && Net.conn.open) {
    try { Net.conn.send({ t: 'ping' }); } catch (e) {}
    if (App.net === 'ok' && Date.now() - Net.lastHear > 10000) { App.net = 'reconnecting'; refreshChrome(); Net.conn.close(); retryGuest(500); }
  }
  if (App.mode === 'host') {
    Net.conns.forEach(c => { if (Date.now() - c.lastSeen > 12000) { try { c.close(); } catch (e) {} dropConn(c); } });
  }
}, 3000);

function leave() {
  if (App.mode === 'host') store.del('cabo-host-' + App.code);
  if (App.code) { try { sessionStorage.removeItem('cabo-joined-' + App.code); } catch (e) {} }
  try { Net.peer && Net.peer.destroy(); } catch (e) {}
  location.hash = '';
  location.reload();
}

// ====================================================================
// View handling
// ====================================================================
function onView(v) {
  const prev = App.V;
  App.V = v;
  if (App.lastSeq === null || v.seq < App.lastSeq) App.lastSeq = v.seq;
  if (v.phase === 'lobby') { showScreen('lobby'); renderLobby(); hideResults(); clearTable(); App.prevPhase = v.phase; return; }
  showScreen(null);
  if (v.phase !== 'play') App.snapMode = false;
  const fresh = v.fx.filter(f => f.seq > App.lastSeq);
  App.lastSeq = v.seq;
  renderTable(v, prev);
  fresh.forEach(f => handleFx(f, v));
  if ((v.phase === 'roundEnd' || v.phase === 'gameEnd') && App.prevPhase !== v.phase) {
    App.showResults = true;
    clearTimeout(App.resultsTimer);
    App.resultsTimer = setTimeout(() => renderResults(true), 1300);
  } else if (v.phase === 'roundEnd' || v.phase === 'gameEnd') renderResults(false);
  else hideResults();
  App.prevPhase = v.phase;
}

function me() { return App.V && App.V.players.find(p => p.id === App.V.me); }
function pname(id) { const p = App.V && App.V.players.find(x => x.id === id); return p ? (id === App.V.me ? t('you') : p.name) : '?'; }

// ====================================================================
// Layout
// ====================================================================
let L = null;
function computeLayout(v) {
  const W = innerWidth, H = innerHeight;
  const topH = 54, barH = 74;
  const n = v.players.length;
  const mi = Math.max(0, v.players.findIndex(p => p.id === v.me));
  const mine = v.players[mi];
  const opps = [];
  for (let i = 1; i < n; i++) opps.push(v.players[(mi + i) % n]);
  const myCols = Math.max(2, Math.ceil(mine.hand.length / 2));
  const avail = H - topH - barH;
  let ch = (avail - 150) / 3.95;
  let cw = Math.min(ch / 1.5, 124, (W - 40) / (myCols * 1.12));
  cw = Math.max(cw, 44);
  ch = cw * 1.5;
  const gap = Math.max(8, cw * 0.1);
  const oppW = (W - 16) / Math.max(1, opps.length);
  let os = 0.56;
  opps.forEach(o => {
    const cols = Math.max(2, Math.ceil(o.hand.length / 2));
    os = Math.min(os, (oppW - 24) / (cols * (cw + gap) + cw * 0.6));
  });
  os = Math.max(0.3, os);
  const och = ch * os;
  const seats = {};
  const handPos = (cx, cy, s, cols) => slot => {
    const col = Math.floor(slot / 2), row = slot % 2;
    return { x: cx + (col - (cols - 1) / 2) * (cw + gap) * s, y: cy + (row - 0.5) * (ch + gap) * s };
  };
  const oppTop = topH + 4;
  opps.forEach((o, i) => {
    const cols = Math.max(2, Math.ceil(o.hand.length / 2));
    const cx = 8 + oppW * (i + 0.5);
    const cy = oppTop + 30 + och + gap * os / 2;
    const half = (cols * (cw + gap) - gap) * os / 2;
    let dx = cx + half + cw * os * 0.75;
    if (dx + cw * os * 0.6 > W) dx = cx - half - cw * os * 0.75;
    seats[o.id] = { s: os, slot: handPos(cx, cy, os, cols), seatX: cx, seatY: oppTop, drawn: { x: dx, y: cy, s: os * 1.12, r: 7 } };
  });
  const oppBottom = oppTop + 30 + 2 * och + gap * os;
  const myRow1 = H - barH - 6 - ch / 2;
  const myCy = myRow1 - (ch + gap) / 2;
  const handTop = myCy - ch - gap / 2;
  const bannerY = handTop - 20;
  const room = bannerY - (W < 520 ? 30 : 20) - 28 - oppBottom - 8; // banner half-height, pile label, margin
  const ps = Math.min(0.92, Math.max(0.45, room / ch));
  const pileY = oppBottom + 8 + Math.max(ch * ps, room) / 2;
  const pw = cw * ps;
  seats[mine.id] = { s: 1, slot: handPos(W / 2, myCy, 1, myCols), me: true, drawn: { x: W / 2 + pw * 1.3, y: pileY - 4, s: ps * 1.08, r: 0 } };
  L = { W, H, cw, ch, gap, os, ps, pw, seats, opps, mine, pileY, deckX: W / 2 - pw * 1.3, discX: W / 2, bannerY, handTop };
  return L;
}

// ====================================================================
// Table rendering
// ====================================================================
const cardEls = new Map(); // id -> { el, place }

function makeCard(id) {
  const el = document.createElement('div');
  el.className = 'card down instant';
  el.innerHTML = '<div class="lift"><div class="flip"><div class="face front"></div><div class="face back"></div></div></div>';
  el.addEventListener('click', e => { e.stopPropagation(); onCardClick(id); });
  $('#cards').appendChild(el);
  return { el, front: el.querySelector('.front'), code: null, place: null };
}

function tf(x, y, s, r) { return `translate(${(x - L.cw / 2).toFixed(1)}px, ${(y - L.ch / 2).toFixed(1)}px) rotate(${r}deg) scale(${s})`; }
function jitter(id, m) { return ((id * 7919) % (2 * m + 1)) - m; }

function clearTable() {
  cardEls.forEach(c => c.el.remove());
  cardEls.clear();
  $('#seats').innerHTML = '';
  $('#banner').textContent = '';
}

function renderTable(v, prev) {
  computeLayout(v);
  const root = document.documentElement.style;
  root.setProperty('--cw', L.cw + 'px');
  root.setProperty('--ch', L.ch + 'px');
  const deck = $('#deck'), slot = $('#discardSlot');
  const pileT = x => `translate(${x - L.cw / 2}px, ${L.pileY - L.ch / 2}px) scale(${L.ps})`;
  deck.style.transform = pileT(L.deckX);
  const layers = Math.min(6, Math.ceil(v.deckCount / 4));
  deck.style.boxShadow = Array.from({ length: layers }, (_, i) => `${i + 1}px ${i + 1}px 0 ${i % 2 ? '#d9d2c4' : '#7d1528'}`).join(',') + ', 4px 10px 18px rgba(0,0,0,.4)';
  deck.querySelector('.count').textContent = v.deckCount;
  deck.classList.toggle('empty', !v.deckCount);
  slot.style.transform = pileT(L.discX);
  slot.querySelector('span').textContent = t('discardPile');
  const ring = $('#ring');
  const rw = L.pw * 4.6, rh = L.ch * L.ps * 1.6;
  Object.assign(ring.style, { width: rw + 'px', height: rh + 'px', left: (L.W / 2 - rw / 2) + 'px', top: (L.pileY - rh / 2) + 'px' });

  const myTurn = v.phase === 'play' && v.turn === v.me;
  const mineP = me();
  const ended = v.phase === 'roundEnd' || v.phase === 'gameEnd';
  const A = v.action;
  const caller = v.cabo && v.cabo.by;
  const canSnap = v.phase === 'play' && v.discard.length && caller !== v.me && mineP && mineP.hand.some(x => x != null);
  if (!canSnap) App.snapMode = false;

  // clickable logic
  const clickHand = (owner, id) => {
    if (App.snapMode) return owner === v.me;
    if (!myTurn) return false;
    if (v.step === 'drawn') return owner === v.me;
    if (v.step === 'action' && A && !A.decide) {
      if (A.kind === 'peek') return owner === v.me;
      if (A.kind === 'spy') return owner !== v.me;
      if (owner !== v.me && owner === caller) return false;
      if (A.kind === 'king') return owner === v.me ? !A.own : !A.opp;
      return true;
    }
    return false;
  };
  const deckClick = myTurn && v.step === 'start' && !App.snapMode;
  deck.classList.toggle('pick', !!deckClick);
  const topId = v.discard[v.discard.length - 1];
  const discClick = !App.snapMode && myTurn && ((v.step === 'start' && topId != null && mineP.hand.some(x => x != null)) || (v.step === 'drawn' && v.drawn && (v.drawn.from === 'deck' || !mineP.hand.some(x => x != null))));

  const targets = new Map();
  v.discard.forEach((id, i) => targets.set(id, { x: L.discX + jitter(id, 3), y: L.pileY + jitter(id + 3, 3), s: L.ps, r: jitter(id, 6) * 1.3, z: 10 + i, place: 'discard', click: discClick && i === v.discard.length - 1 }));
  v.players.forEach(p => {
    const seat = L.seats[p.id];
    if (!seat) return;
    p.hand.forEach((id, si) => {
      if (id == null) return;
      const pos = seat.slot(si);
      const sel = A && ((A.own && A.own.id === id) || (A.opp && A.opp.id === id));
      targets.set(id, { x: pos.x, y: pos.y, s: seat.s, r: 0, z: 30 + si, place: 'hand', owner: p.id, slot: si, click: clickHand(p.id, id), sel, lock: caller === p.id && !ended });
    });
  });
  if (v.drawn) {
    const seat = L.seats[v.drawn.by];
    const d = seat ? seat.drawn : { x: L.W / 2, y: L.pileY, s: L.ps, r: 0 };
    targets.set(v.drawn.id, { x: d.x, y: d.y, s: d.s, r: d.r, z: 90, place: 'drawn', drawn: true });
  }

  const memo = new Set(v.memo || []);
  let fresh = 0;
  const dealing = prev && prev.deal !== v.deal;
  // cards that left the table
  cardEls.forEach((c, id) => {
    if (targets.has(id)) return;
    const silent = c.place === 'discard' && v.discard.length >= 5 && Math.floor(id / 100) === v.deal;
    if (silent) { c.el.remove(); cardEls.delete(id); return; }
    c.el.classList.add('down');
    c.el.style.zIndex = 5;
    c.el.style.transform = tf(L.deckX, L.pileY, L.ps, 0);
    c.el.style.transitionDelay = '0ms';
    cardEls.delete(id);
    setTimeout(() => c.el.remove(), 650);
  });

  let order = 0;
  targets.forEach((tg, id) => {
    let c = cardEls.get(id);
    const isNew = !c;
    if (isNew) {
      c = makeCard(id);
      cardEls.set(id, c);
      c.el.style.transform = tf(L.deckX, L.pileY, L.ps, 0);
      c.el.style.zIndex = 100;
    }
    const delay = isNew && (dealing || !prev) ? (order++) * 55 : 0;
    if (isNew) fresh++;
    const el = c.el;
    if (isNew) { void el.offsetWidth; el.classList.remove('instant'); }
    el.style.transitionDelay = delay + 'ms';
    el.querySelector('.flip').style.transitionDelay = (ended && App.prevPhase !== v.phase ? 250 + (order++) * 70 : delay + (isNew ? 300 : 0)) + 'ms';
    el.style.transform = tf(tg.x, tg.y, tg.s, tg.r);
    el.style.zIndex = tg.z;
    c.place = tg.place;
    const code = v.faces[id];
    if (code) {
      if (c.code !== code || c.styleKey !== App.style + LANG) { c.front.style.backgroundImage = faceSVG(code, App.style, LANG); c.code = code; c.styleKey = App.style + LANG; }
      el.classList.remove('down');
    } else {
      el.classList.add('down');
      if (c.code) { const cc = c; setTimeout(() => { if (cc.el.classList.contains('down')) { cc.front.style.backgroundImage = ''; cc.code = null; } }, 700); }
    }
    el.classList.toggle('pick', !!tg.click && !App.snapMode);
    el.classList.toggle('snap', !!tg.click && App.snapMode);
    el.classList.toggle('sel', !!tg.sel);
    el.classList.toggle('lock', !!tg.lock);
    el.classList.toggle('drawn', !!tg.drawn);
    el.classList.toggle('memo', memo.has(id) && !code && tg.place === 'hand');
    el.style.cursor = tg.click ? 'pointer' : 'default';
    el.style.pointerEvents = tg.click ? 'auto' : 'none';
  });

  renderSeats(v);
  renderBanner(v, myTurn);
  renderButtons(v, myTurn, canSnap);
  $('#roundLbl').textContent = v.round ? `${t('round')} ${v.round}` : '';
}

function seatHTML(p, v) {
  const tags = [];
  if (p.bot) tags.push(`<span class="tag">${t('bot')}</span>`);
  if (v.cabo && v.cabo.by === p.id) tags.push(`<span class="tag cabo">CABO</span>`);
  if (v.phase === 'peek' && p.ready) tags.push(`<span class="tag ok">✓</span>`);
  if (!p.connected) tags.push(`<span class="tag">${t('disconnected')}</span>`);
  return `${avatar(p, v)}<span class="nm">${esc(p.id === v.me ? p.name + ' (' + t('you2') + ')' : p.name)}</span><span class="pts">${p.total}</span>${tags.join('')}`;
}

function renderSeats(v) {
  const box = $('#seats');
  const want = new Set();
  L.opps.forEach(p => {
    want.add(p.id);
    let el = box.querySelector(`[data-id="${CSS.escape(p.id)}"]`);
    if (!el) { el = document.createElement('div'); el.className = 'seat'; el.dataset.id = p.id; box.appendChild(el); }
    const s = L.seats[p.id];
    el.style.left = s.seatX + 'px';
    el.style.top = s.seatY + 'px';
    el.innerHTML = seatHTML(p, v);
    el.classList.toggle('active', v.turn === p.id);
    el.classList.toggle('off', !p.connected);
  });
  box.querySelectorAll('.seat').forEach(el => { if (!want.has(el.dataset.id)) el.remove(); });
  const m = me();
  $('#mySeat').innerHTML = m ? `<div class="seat ${v.turn === m.id ? 'active' : ''}">${seatHTML(m, v)}</div>` : '';
}

function renderBanner(v, myTurn) {
  const b = $('#banner');
  let txt = '', mine = false;
  const A = v.action;
  const m = me();
  if (v.phase === 'peek') { txt = m && !m.ready ? t('peekTitle') : t('waitingOthers'); mine = m && !m.ready; }
  else if (v.phase === 'play') {
    if (App.snapMode) { txt = t('snapPick'); mine = true; }
    else if (myTurn) {
      mine = true;
      if (v.step === 'start') txt = v.cabo ? t('yourTurnCabo') : t('yourTurn');
      else if (v.step === 'drawn') txt = v.drawn.from === 'deck' ? t('drawnDeck') : t('drawnDiscard');
      else if (v.step === 'action') txt = A.decide ? t('act_kingDecide') : t('act_' + A.kind);
    } else {
      const nm = pname(v.turn);
      if (v.step === 'action' && A) txt = t('waitAct_' + A.kind, { name: nm });
      else if (v.step === 'drawn') txt = t('waitDrawn', { name: nm });
      else txt = t('waitTurn', { name: nm });
      if (v.cabo) txt = '⏳ ' + t('lastRound') + ' · ' + txt;
    }
  }
  b.textContent = txt;
  b.classList.toggle('mine', !!mine);
  b.style.top = L.bannerY + 'px';
}

function btn(label, cls, fn, opts = {}) {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.innerHTML = label;
  if (opts.disabled) b.disabled = true;
  b.addEventListener('click', e => { e.stopPropagation(); Sound.init(); Sound.play('select'); buzz(8); fn(); });
  return b;
}

function renderButtons(v, myTurn, canSnap) {
  const box = $('#buttons');
  box.innerHTML = '';
  const add = b => box.appendChild(b);
  const m = me();
  if (v.phase === 'peek') {
    if (m && !m.ready) add(btn(t('ready') + ' ✓', 'primary big', () => send({ t: 'ready' })));
    return;
  }
  if (v.phase === 'play') {
    if (canSnap) {
      const topCode = v.faces[v.discard[v.discard.length - 1]];
      const b = btn(App.snapMode ? t('cancel') : '⚡ ' + t('snap'), 'snapbtn' + (App.snapMode ? ' on' : ''), () => { App.snapMode = !App.snapMode; renderTable(App.V, App.V); });
      if (topCode && !App.snapMode && m.hand.some(id => id != null && v.faces[id] && cardRank(v.faces[id]) === cardRank(topCode))) b.classList.add('flash');
      add(b);
    }
    if (App.snapMode) return;
    if (myTurn && v.step === 'start' && !v.cabo) add(btn(t('cabo'), 'cabo big', () => send({ t: 'cabo' })));
    if (myTurn && v.step === 'drawn' && (v.drawn.from === 'deck' || !m.hand.some(x => x != null))) {
      const k = cardAction(v.faces[v.drawn.id] || 'xA');
      add(btn(t('discard') + (k ? ` <small style="opacity:.75">→ ${t('name_' + k)}</small>` : ''), 'primary', () => send({ t: 'discard' })));
    }
    if (myTurn && v.step === 'action') {
      if (v.action.decide) {
        add(btn(t('keep'), 'ghost', () => send({ t: 'king', swap: false })));
        add(btn(t('doSwap'), 'primary', () => send({ t: 'king', swap: true })));
      } else add(btn(t('skip'), 'ghost', () => send({ t: 'skip' })));
    }
  }
  if (v.phase === 'roundEnd' || v.phase === 'gameEnd') {
    add(btn(App.showResults ? t('hideScores') : t('showScores'), 'ghost', () => { App.showResults = !App.showResults; renderResults(false); renderButtons(App.V, false, false); }));
  }
}

function onCardClick(id) {
  Sound.init();
  const v = App.V;
  if (!v) return;
  const c = cardEls.get(id);
  if (!c || c.el.style.pointerEvents === 'none') return;
  if (c.place === 'discard') {
    if (v.step === 'start') send({ t: 'draw', from: 'discard' });
    else send({ t: 'discard' });
    return;
  }
  if (c.place !== 'hand') return;
  let owner = null, slot = -1;
  v.players.forEach(p => { const i = p.hand.indexOf(id); if (i >= 0) { owner = p.id; slot = i; } });
  if (owner == null) return;
  buzz(10);
  if (App.snapMode) { App.snapMode = false; send({ t: 'snap', slot }); renderTable(v, v); return; }
  if (v.step === 'drawn') send({ t: 'swap', slot });
  else if (v.step === 'action') { Sound.play('select'); send({ t: 'pick', owner, slot }); }
}

$('#deck').addEventListener('click', () => {
  Sound.init();
  const v = App.V;
  if (v && v.phase === 'play' && v.turn === v.me && v.step === 'start') { buzz(10); send({ t: 'draw', from: 'deck' }); }
});

// ====================================================================
// Effects for game events
// ====================================================================
function toast(msg, cls = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2600);
}

function slam(text, sub) {
  const box = $('#slam');
  box.innerHTML = `<div class="wave"></div><div class="txt">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  setTimeout(() => { box.innerHTML = ''; }, 1700);
}

function shake() { const tb = $('#table'); tb.classList.remove('shake'); void tb.offsetWidth; tb.classList.add('shake'); }

function cardCenter(id) {
  const c = cardEls.get(id);
  if (!c) return { x: L.discX, y: L.pileY };
  const r = c.el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function pop(id, cls = 'pop', ms = 600) {
  const c = cardEls.get(id);
  if (!c) return;
  c.el.classList.remove(cls); void c.el.offsetWidth; c.el.classList.add(cls);
  setTimeout(() => c.el.classList.remove(cls), ms);
}

function handleFx(f, v) {
  const mineEv = f.pid === v.me;
  switch (f.type) {
    case 'deal': Sound.play('shuffle'); setTimeout(() => Sound.play('deal', v.players.length * 4 + 1), 150); break;
    case 'start': if (v.turn === v.me) { Sound.play('turn'); buzz(20); } break;
    case 'draw': Sound.play('swish'); if (mineEv || f.from === 'discard') Sound.play('flip', 0.18); break;
    case 'swap': Sound.play('swish'); Sound.play('place', 0.32); break;
    case 'discard': Sound.play('place', 0.05); if (mineEv && f.kind) Sound.play('select', 0.3); break;
    case 'peek': case 'spy':
      Sound.play('peek');
      if (!mineEv) toast(t('waitAct_' + f.type, { name: pname(f.pid) }) + (f.type === 'spy' && f.owner === v.me ? ' 👀' : ''));
      else pop(f.id);
      break;
    case 'select': if (!mineEv) Sound.play('select'); break;
    case 'trade': Sound.play('trade'); setTimeout(() => { pop(f.a); pop(f.b); }, 500); break;
    case 'keep': Sound.play('place'); break;
    case 'skip': break;
    case 'turn': if (f.pid === v.me) { Sound.play('turn'); buzz(20); } break;
    case 'cabo':
      Sound.play('cabo'); buzz([40, 60, 80]); shake();
      slam('CABO!', mineEv ? t('youCalled') : pname(f.pid));
      break;
    case 'snapOk': {
      Sound.play('snapOk'); buzz(25);
      setTimeout(() => { const p = cardCenter(f.id); Particles.sparks(p.x, p.y); pop(f.id); }, 480);
      toast('⚡ ' + t('snapOk', { name: pname(f.pid) }), 'good');
      break;
    }
    case 'snapFail':
      Sound.play('fail'); shake(); if (mineEv) buzz([60, 40, 60]);
      pop(f.id, 'wrong', 1900);
      toast(t('snapFail', { name: pname(f.pid) }), 'bad');
      break;
    case 'reshuffle': Sound.play('shuffle'); toast(t('reshuffle')); break;
    case 'roundEnd': Sound.play('roundEnd', 10); break;
    case 'gameEnd': setTimeout(() => { Sound.play('win'); Particles.confetti(v.results && v.results.winners.includes(v.me) ? 220 : 120); }, 1400); break;
    case 'join': Sound.play('join'); break;
  }
}

// ====================================================================
// Results
// ====================================================================
function hideResults() { clearTimeout(App.resultsTimer); $('#results').classList.remove('show'); }

function renderResults(animate) {
  const v = App.V, box = $('#results');
  if (!v || !v.results || !App.showResults) { box.classList.remove('show'); return; }
  const R = v.results;
  const rows = [...R.rows].sort((a, b) => a.total - b.total);
  const best = rows[0].total;
  let title = t('roundOver', { n: v.round });
  let win = false;
  if (R.over) {
    win = true;
    const names = R.winners.map(id => id === v.me ? null : pname(id)).filter(Boolean);
    title = R.winners.includes(v.me) ? '🏆 ' + t('youWin') : '🏆 ' + t('winner', { name: names.join(' & ') });
  }
  const isHost = App.mode === 'host';
  box.innerHTML = `<h2 class="${win ? 'win' : ''}">${esc(title)}</h2>` + rows.map((r, i) => {
    const p = v.players.find(x => x.id === r.id) || { name: '?', id: r.id };
    const notes = (r.note || '').split(' ').filter(Boolean).map(n => `<small class="${n === 'caboFail' ? 'bad' : 'good'}">${t(n)}</small>`).join('');
    return `<div class="rrow ${r.total === best ? 'best' : ''}" style="animation-delay:${i * 80}ms">${avatar(p, v)}
      <div class="nm">${esc(r.id === v.me ? t('you') : p.name)}${notes || `<small>${r.sum} ${t('points')}</small>`}</div>
      <div class="add">+${r.add}</div><div class="tot ${r.total > 100 ? 'over' : ''}" data-to="${r.total}" data-from="${r.total - r.add}">${animate ? r.total - r.add : r.total}</div></div>`;
  }).join('') + `<div class="row center wrap" style="margin-top:14px;gap:8px">${isHost
    ? (R.over ? `<button class="btn ghost" id="rLobby">${t('toLobby')}</button><button class="btn primary big" id="rNew">${t('newGame')}</button>` : `<button class="btn primary big" id="rNext">${t('nextRound')}</button>`)
    : `<div class="muted">${t('waitNext')}</div>`}</div>`;
  box.classList.add('show');
  const b1 = box.querySelector('#rNext'), b2 = box.querySelector('#rNew'), b3 = box.querySelector('#rLobby');
  b1 && b1.addEventListener('click', () => { Sound.play('select'); Engine.nextRound(); });
  b2 && b2.addEventListener('click', () => { Sound.play('select'); Engine.startGame(); });
  b3 && b3.addEventListener('click', () => { Sound.play('select'); Engine.backToLobby(); });
  if (animate) {
    box.querySelectorAll('.tot').forEach((el, i) => {
      const from = +el.dataset.from, to = +el.dataset.to;
      if (from === to) return;
      const steps = Math.min(24, Math.abs(to - from));
      let k = 0;
      setTimeout(function step() {
        k++;
        el.textContent = Math.round(from + (to - from) * k / steps);
        if (k % 2) Sound.play('tick', 0, k);
        if (k < steps) setTimeout(step, 40);
      }, 400 + i * 120);
    });
  }
}

// ====================================================================
// Screens: home & lobby
// ====================================================================
function showScreen(name) {
  ['home', 'lobby'].forEach(s => $('#' + s).classList.toggle('show', s === name));
  document.body.classList.toggle('menu', !!name);
}

function heroHTML() {
  const cards = ['hK', 'cB', 'sA', 'd7'];
  return `<div class="hero">${cards.map((c, i) => `<div class="hc" style="background-image:${faceSVG(c, App.style, LANG)};transform:translateX(-50%) rotate(${(i - 1.5) * 13}deg);animation-delay:${i * 70}ms, ${i * 300}ms"></div>`).join('')}</div>`;
}

function langSeg() {
  return `<div class="seg" id="langSeg"><button data-l="de" class="${LANG === 'de' ? 'on' : ''}">Deutsch</button><button data-l="en" class="${LANG === 'en' ? 'on' : ''}">English</button></div>`;
}
function bindLang(root) {
  root.querySelectorAll('#langSeg button').forEach(b => b.addEventListener('click', () => {
    LANG = b.dataset.l; store.set('cabo-lang', LANG); document.documentElement.lang = LANG; rerenderAll();
  }));
}

function renderHome() {
  const code = joinCodeFromHash();
  const el = $('#home');
  el.innerHTML = `<div class="panel">
    ${heroHTML()}
    <h1 class="title">Cabo</h1>
    <p class="tagline">${t('tagline')}</p>
    <div class="stack">
      <input class="field" id="nameIn" maxlength="16" placeholder="${t('yourName')}" value="${esc(App.name)}" autocomplete="nickname">
      ${code ? `<button class="btn primary big" id="bJoin">${t('joinRoom', { code })}</button>`
             : `<button class="btn primary big" id="bCreate">${t('create')}</button><button class="btn" id="bQuick">${t('quick')}</button>`}
      <div class="row center" style="margin-top:6px">${langSeg()}</div>
      <div class="row center"><button class="btn ghost" id="bRules">${t('rules')}</button><button class="btn ghost" id="bSet">${t('settings')}</button></div>
    </div></div>`;
  const nameIn = el.querySelector('#nameIn');
  const takeName = () => {
    Sound.init();
    App.name = nameIn.value.trim().slice(0, 16);
    if (!App.name) { nameIn.focus(); nameIn.style.borderColor = 'var(--red)'; return false; }
    store.set('cabo-name', App.name);
    return true;
  };
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') (el.querySelector('#bJoin') || el.querySelector('#bCreate')).click(); });
  el.querySelector('#bJoin') && el.querySelector('#bJoin').addEventListener('click', () => { if (takeName()) startGuest(code); });
  el.querySelector('#bCreate') && el.querySelector('#bCreate').addEventListener('click', () => { if (takeName()) { startHost(); } });
  el.querySelector('#bQuick') && el.querySelector('#bQuick').addEventListener('click', () => { if (takeName()) startHost({ quick: true }); });
  el.querySelector('#bRules').addEventListener('click', openRules);
  el.querySelector('#bSet').addEventListener('click', openSettings);
  bindLang(el);
}

function renderLobby() {
  const el = $('#lobby');
  const v = App.V;
  const isHost = App.mode === 'host';
  if (!v) {
    const msg = App.net === 'full' ? t('full') : App.net === 'hostGone' ? t('hostGone') : t('connecting');
    el.innerHTML = `<div class="panel"><h1 class="title" style="font-size:44px">Cabo</h1><p class="tagline ${App.net === 'connecting' ? 'dots' : ''}">${msg}</p>
      <div class="row center"><button class="btn ghost" id="lvBack">${t('back')}</button></div></div>`;
    el.querySelector('#lvBack').addEventListener('click', leave);
    return;
  }
  const players = v.players.map(p => `<div class="prow">${avatar(p, v)}<span class="nm">${esc(p.name)}${p.id === v.me ? ` <span class="tag">${t('you2')}</span>` : ''}</span>
      ${p.id === v.hostId ? `<span class="tag">${t('host')}</span>` : ''}${p.bot ? `<span class="tag">${t('bot')}</span>` : ''}${!p.connected ? `<span class="tag">${t('disconnected')}</span>` : ''}
      ${isHost && p.id !== v.hostId ? `<button class="x" data-rm="${esc(p.id)}">✕</button>` : ''}</div>`).join('');
  el.innerHTML = `<div class="panel stack">
    <div class="row" style="justify-content:space-between"><h2 style="margin:0">${t('lobby')}</h2><span class="tag" style="font-size:13px;padding:4px 10px">${t('room')} ${esc(App.code)}</span></div>
    ${isHost ? `<div class="lbl">${t('shareHint')}</div>
      <div class="linkbox"><input readonly id="lnk" value="${esc(shareLink())}"><button class="btn primary" id="bCopy">${t('copy')}</button>${navigator.share ? `<button class="btn" id="bShare">${t('share')}</button>` : ''}</div>
      ${App.offline ? `<div class="warn">${t('offline')}</div>` : ''}` : ''}
    <div class="lbl">${t('players')} (${v.players.length}/6)</div>
    <div class="plist">${players}</div>
    ${isHost ? `<div class="row"><button class="btn" id="bBot" ${v.players.length >= 6 ? 'disabled' : ''}>${t('addBot')}</button></div>` : ''}
    <div class="switch ${v.settings.easy ? 'on' : ''}" id="swEasy" style="${isHost ? '' : 'pointer-events:none;opacity:.8'}"><span class="kn"></span><span class="tx">${t('easy')}<small>${t('easyHint')}</small></span></div>
    ${isHost ? `<button class="btn primary big" id="bStart" ${v.players.length < 2 ? 'disabled' : ''}>${v.players.length < 2 ? t('needTwo') : t('start')}</button>`
             : `<p class="muted dots">${t('waitingHost')}</p>`}
    <div class="row center"><button class="btn ghost" id="bLeave">${t('leave')}</button><button class="btn ghost" id="bRules2">${t('rules')}</button></div>
  </div>`;
  const q = s => el.querySelector(s);
  q('#bLeave').addEventListener('click', leave);
  q('#bRules2').addEventListener('click', openRules);
  if (isHost) {
    q('#bCopy').addEventListener('click', () => {
      const inp = q('#lnk'); inp.select();
      (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).catch(() => document.execCommand('copy'));
      q('#bCopy').textContent = t('copied'); Sound.play('select');
      setTimeout(() => { const b = q('#bCopy'); if (b) b.textContent = t('copy'); }, 1500);
    });
    q('#bShare') && q('#bShare').addEventListener('click', () => navigator.share({ title: 'Cabo', text: LANG === 'de' ? 'Spiel Cabo mit mir!' : 'Play Cabo with me!', url: shareLink() }).catch(() => {}));
    q('#bBot').addEventListener('click', () => { Sound.play('join'); Engine.addBot(); });
    q('#bStart').addEventListener('click', () => { Sound.init(); Engine.startGame(); });
    q('#swEasy').addEventListener('click', () => Engine.setEasy(!v.settings.easy));
    el.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => Engine.removePlayer(b.dataset.rm)));
  }
}

// ====================================================================
// Modals
// ====================================================================
function openModal(html, bind) {
  const m = $('#modal');
  m.querySelector('.modal-body').innerHTML = html;
  m.classList.remove('hidden');
  bind && bind(m.querySelector('.modal-body'));
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
$('#modal .modal-x').addEventListener('click', closeModal);

function openRules() { openModal(`<h2>${t('rules')}</h2>${t('rulesHtml')}`); }

function openSettings() {
  const styles = ['classic', 'tournament', 'german'];
  openModal(`<h2>${t('settings')}</h2><div class="stack">
    <div class="lbl">${t('language')}</div>${langSeg()}
    <div class="lbl">${t('deckStyle')}</div>
    <div class="styles">${styles.map(s => `<button data-st="${s}" class="${App.style === s ? 'on' : ''}"><div class="mini">${['cB', 'hK', 'dA'].map(c => `<i style="background-image:${faceSVG(c, s, LANG)}"></i>`).join('')}</div>${t('st_' + s)}</button>`).join('')}</div>
    <div class="switch ${Sound.on ? 'on' : ''}" id="swSound"><span class="kn"></span><span class="tx">${t('sound')}</span></div>
  </div>`, body => {
    bindLang(body);
    body.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => { App.style = b.dataset.st; store.set('cabo-style', App.style); rerenderAll(); }));
    body.querySelector('#swSound').addEventListener('click', () => { Sound.on = !Sound.on; Sound.init(); Sound.play('select'); openSettings(); });
  });
}

function openScores() {
  const v = App.V;
  if (!v || !v.history) return;
  const ps = v.players;
  openModal(`<h2>${t('scores')}</h2><table class="scoretbl"><thead><tr><th>${t('round')}</th>${ps.map(p => `<th>${esc(p.id === v.me ? t('you') : p.name)}</th>`).join('')}</tr></thead>
    <tbody>${v.history.map((r, i) => `<tr><td>${i + 1}</td>${ps.map(p => { const x = r.find(y => y.id === p.id); return `<td>${x ? x.add : '–'}</td>`; }).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr><td>${t('total')}</td>${ps.map(p => `<td>${p.total}</td>`).join('')}</tr></tfoot></table>`);
}

$('#btnRules').addEventListener('click', openRules);
$('#btnSettings').addEventListener('click', openSettings);
$('#btnScores').addEventListener('click', openScores);

function rerenderAll() {
  if (!$('#modal').classList.contains('hidden')) {
    const isSettings = $('#modal .styles');
    if (isSettings) openSettings();
  }
  if (!App.mode) renderHome();
  else if (!App.V || App.V.phase === 'lobby') renderLobby();
  if (App.V && App.V.phase !== 'lobby') { renderTable(App.V, App.V); renderResults(false); }
}

function refreshChrome() {
  const n = $('#net');
  let msg = '';
  if (App.mode === 'guest' && App.V) {
    if (App.net === 'reconnecting') msg = t('reconnecting');
    else if (App.net === 'hostGone') msg = t('hostGone') + ' ' + t('reconnecting').split('–').pop();
    else if (App.net === 'full') msg = t('full');
  }
  n.textContent = msg;
  n.classList.toggle('show', !!msg);
  if (App.mode === 'guest' && !App.V) renderLobby();
  if (App.mode === 'host' && App.V && App.V.phase === 'lobby') renderLobby();
}

addEventListener('resize', () => { if (App.V && App.V.phase !== 'lobby') renderTable(App.V, App.V); });
document.addEventListener('pointerdown', () => Sound.init(), { once: false, passive: true });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); if (App.snapMode) { App.snapMode = false; App.V && renderTable(App.V, App.V); } }
});

// ====================================================================
// Boot
// ====================================================================
function joinCodeFromHash() {
  const h = location.hash.replace('#', '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return h.length >= 4 && h.length <= 8 ? h : null;
}

(function boot() {
  document.documentElement.lang = LANG;
  Particles.setup();
  const code = joinCodeFromHash();
  if (code) {
    let saved = null;
    try { saved = JSON.parse(store.get('cabo-host-' + code, 'null')); } catch (e) {}
    if (saved && store.sget('cabo-hosting-' + code) && Date.now() - saved.at < 12 * 3600e3) { startHost({ code, saved }); return; }
    if (store.sget('cabo-joined-' + code) && App.name) { startGuest(code); return; }
  }
  showScreen('home');
  renderHome();
})();

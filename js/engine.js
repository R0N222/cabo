// engine.js — authoritative game state. Runs only on the host's browser.
'use strict';

const Engine = (() => {
  const PEEK_MS = 3200;
  const FAIL_REVEAL_MS = 2000;
  const BOT_NAMES = ['Berta', 'Klaus', 'Heidi', 'Jürgen', 'Uschi', 'Detlef', 'Gisela'];
  let S = null;
  let onChange = () => {};
  let botTimer = null;
  const timers = new Set();

  const rnd = n => Math.floor(Math.random() * n);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function later(fn, ms) { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); }

  function create(hostId, hostName) {
    clearTimeout(botTimer); botTimer = null;
    timers.forEach(clearTimeout); timers.clear();
    S = {
      phase: 'lobby', hostId, players: [], deck: [], discard: [], faces: {}, known: {},
      turn: 0, step: 'start', drawn: null, action: null, cabo: null, reveals: [],
      round: 0, deal: 0, starter: rnd(8), settings: { easy: false }, fx: [], seq: 0,
      history: [], turnCount: 0, results: null,
    };
    addPlayer(hostId, hostName, false);
    return S;
  }

  function load(saved) {
    S = saved;
    for (const k in S.known) S.known[k] = new Set(S.known[k]);
    S.players.forEach(p => { if (!p.bot && p.id !== S.hostId) p.connected = false; });
    S.reveals = [];
    if (S.phase === 'play' && S.step === 'action' && S.action && S.action.kind === 'king') S.action.decide = !!(S.action.own && S.action.opp);
  }

  function serialize() {
    const known = {};
    for (const k in S.known) known[k] = [...S.known[k]];
    return JSON.stringify({ ...S, known, reveals: [] });
  }

  const player = id => S.players.find(p => p.id === id);
  const cur = () => S.players[S.turn];
  const top = () => S.discard[S.discard.length - 1];
  function fx(type, data = {}) { S.fx.push({ seq: ++S.seq, type, ...data }); if (S.fx.length > 40) S.fx.shift(); }
  function know(pid, id) { (S.known[pid] || (S.known[pid] = new Set())).add(id); }
  function knowAll(id) { S.players.forEach(p => know(p.id, id)); }
  function reveal(id, to, ms) {
    const r = { id, to, until: ms ? Date.now() + ms : 0 };
    S.reveals.push(r);
    if (ms) later(() => { S.reveals = S.reveals.filter(x => x !== r); commit(); }, ms);
  }
  function unreveal(id, to) { S.reveals = S.reveals.filter(r => !(r.id === id && r.to === to)); }

  // ---------- lobby ----------
  function addPlayer(id, name, bot) {
    if (player(id)) { const p = player(id); p.connected = true; if (name) p.name = name; return p; }
    if (S.phase !== 'lobby' || S.players.length >= 6) return null;
    const p = { id, name: (name || 'Player').slice(0, 16), bot, connected: true, hand: [], total: 0, ready: false };
    S.players.push(p);
    S.known[id] = new Set();
    fx('join', { pid: id });
    return p;
  }
  function addBot() {
    if (S.phase !== 'lobby' || S.players.length >= 6) return;
    const used = new Set(S.players.map(p => p.name));
    const name = 'Bot ' + (BOT_NAMES.find(n => !used.has('Bot ' + n)) || rnd(99));
    addPlayer('bot-' + Math.random().toString(36).slice(2, 8), name, true);
    commit();
  }
  function removePlayer(id) {
    if (S.phase !== 'lobby' || id === S.hostId) return;
    S.players = S.players.filter(p => p.id !== id);
    commit();
  }
  function setConnected(id, c) {
    const p = player(id);
    if (p && p.connected !== c) { p.connected = c; commit(); }
  }

  // ---------- round flow ----------
  function ensureDeck() {
    if (S.deck.length || S.discard.length < 2) return;
    const t = S.discard.pop();
    S.deck = shuffle(S.discard);
    S.discard = [t];
    fx('reshuffle');
  }

  function startRound() {
    S.deal++;
    S.round++;
    S.faces = {};
    const codes = shuffle([...ALL_CODES]);
    S.deck = codes.map((c, i) => { const id = S.deal * 100 + i; S.faces[id] = c; return id; });
    S.discard = [];
    S.reveals = [];
    S.known = {};
    for (let k = 0; k < 4; k++) S.players.forEach(p => { if (k === 0) p.hand = []; p.hand.push(S.deck.pop()); });
    S.players.forEach(p => {
      S.known[p.id] = new Set([p.hand[1], p.hand[3]]);
      p.ready = p.bot;
      p.roundScore = 0;
    });
    S.discard.push(S.deck.pop());
    knowAll(top());
    S.phase = 'peek';
    S.turn = S.starter % S.players.length;
    S.starter++;
    S.step = 'start'; S.drawn = null; S.action = null; S.cabo = null; S.turnCount = 0; S.results = null;
    fx('deal');
    maybeStartPlay();
    commit();
  }

  function startGame() {
    if (S.players.length < 2) return;
    if (S.phase !== 'lobby' && S.phase !== 'gameEnd') return;
    S.players.forEach(p => { p.total = 0; });
    S.history = [];
    S.round = 0;
    startRound();
  }

  function nextRound() { if (S.phase === 'roundEnd') startRound(); }

  function backToLobby() {
    S.phase = 'lobby';
    S.players = S.players.filter(p => p.bot || p.connected || p.id === S.hostId);
    S.players.forEach(p => { p.hand = []; p.total = 0; });
    S.deck = []; S.discard = []; S.drawn = null; S.action = null; S.cabo = null; S.results = null; S.history = [];
    commit();
  }

  function maybeStartPlay() {
    if (S.phase === 'peek' && S.players.every(p => p.ready)) {
      S.phase = 'play';
      fx('start', { pid: cur().id });
    }
  }

  function endTurn() {
    if (S.action) {
      [S.action.own, S.action.opp].forEach(pk => pk && unreveal(pk.id, cur().id));
    }
    S.step = 'start'; S.drawn = null; S.action = null; S.turnCount++;
    const next = (S.turn + 1) % S.players.length;
    if (S.cabo && S.players[next].id === S.cabo.by) { endRound(); return; }
    S.turn = next;
    fx('turn', { pid: cur().id });
  }

  function handSum(p) { return p.hand.reduce((a, id) => a + (id == null ? 0 : cardValue(S.faces[id])), 0); }

  function endRound() {
    S.phase = 'roundEnd';
    S.drawn = null; S.action = null; S.reveals = [];
    const sums = S.players.map(handSum);
    const min = Math.min(...sums);
    const rows = S.players.map((p, i) => {
      const caller = S.cabo && S.cabo.by === p.id;
      let add = sums[i], note = '';
      if (caller) { if (sums[i] <= min) { add = 0; note = 'caboOk'; } else { add = sums[i] + 10; note = 'caboFail'; } }
      p.total += add;
      if (p.total === 100) { p.total = 50; note = note ? note + ' lucky' : 'lucky'; }
      p.roundScore = add;
      return { id: p.id, sum: sums[i], add, total: p.total, note };
    });
    S.history.push(rows.map(r => ({ id: r.id, add: r.add })));
    const over = S.players.some(p => p.total > 100);
    const best = Math.min(...S.players.map(p => p.total));
    S.results = { rows, over, winners: over ? S.players.filter(p => p.total === best).map(p => p.id) : [] };
    fx('roundEnd');
    if (over) { S.phase = 'gameEnd'; fx('gameEnd'); }
  }

  function hasTargets(kind, pid) {
    const mine = player(pid).hand.some(id => id != null);
    const others = S.players.filter(p => p.id !== pid && (kind === 'spy' || !(S.cabo && S.cabo.by === p.id)))
      .some(p => p.hand.some(id => id != null));
    if (kind === 'peek') return mine;
    if (kind === 'spy') return others;
    return mine && others;
  }

  function pickValid(pk) { return pk && player(pk.owner) && player(pk.owner).hand[pk.slot] === pk.id; }

  // ---------- actions ----------
  function act(pid, a) {
    if (!S || !a) return;
    const p = player(pid);
    if (!p) return;
    const isTurn = S.phase === 'play' && cur().id === pid;

    switch (a.t) {
      case 'ready':
        if (S.phase !== 'peek') return;
        p.ready = true;
        maybeStartPlay();
        break;

      case 'cabo':
        if (!isTurn || S.step !== 'start' || S.cabo) return;
        S.cabo = { by: pid };
        fx('cabo', { pid });
        endTurn();
        break;

      case 'draw': {
        if (!isTurn || S.step !== 'start') return;
        if (a.from === 'discard') {
          if (!S.discard.length || !p.hand.some(id => id != null)) return;
          const id = S.discard.pop();
          S.drawn = { id, by: pid, from: 'discard' };
        } else {
          ensureDeck();
          if (!S.deck.length) return;
          const id = S.deck.pop();
          S.drawn = { id, by: pid, from: 'deck' };
          know(pid, id);
        }
        S.step = 'drawn';
        fx('draw', { pid, from: a.from === 'discard' ? 'discard' : 'deck' });
        break;
      }

      case 'swap': {
        if (!isTurn || S.step !== 'drawn') return;
        const old = p.hand[a.slot];
        if (old == null) return;
        p.hand[a.slot] = S.drawn.id;
        S.discard.push(old);
        knowAll(old);
        fx('swap', { pid, slot: a.slot, id: old });
        S.drawn = null;
        endTurn();
        botSnaps();
        break;
      }

      case 'discard': {
        if (!isTurn || S.step !== 'drawn') return;
        if (S.drawn.from !== 'deck' && p.hand.some(x => x != null)) return; // a taken discard must be swapped in
        const id = S.drawn.id;
        const fromDeck = S.drawn.from === 'deck';
        S.discard.push(id);
        knowAll(id);
        S.drawn = null;
        const kind = cardAction(S.faces[id]);
        fx('discard', { pid, id, kind });
        if (kind && S.drawn === null && hasTargets(kind, pid) && fromDeck) {
          S.step = 'action';
          S.action = { kind, own: null, opp: null, decide: false };
        } else endTurn();
        botSnaps();
        break;
      }

      case 'skip':
        if (!isTurn || S.step !== 'action') return;
        fx('skip', { pid });
        endTurn();
        break;

      case 'pick': {
        if (!isTurn || S.step !== 'action') return;
        const A = S.action;
        if (A.decide) return;
        const o = player(a.owner);
        const id = o && o.hand[a.slot];
        if (id == null) return;
        const mine = a.owner === pid;
        if (A.kind === 'peek') {
          if (!mine) return;
          know(pid, id); reveal(id, pid, PEEK_MS);
          fx('peek', { pid, owner: a.owner, id });
          endTurn();
        } else if (A.kind === 'spy') {
          if (mine) return;
          know(pid, id); reveal(id, pid, PEEK_MS);
          fx('spy', { pid, owner: a.owner, id });
          endTurn();
        } else {
          if (!mine && S.cabo && S.cabo.by === a.owner) return;
          const pk = { owner: a.owner, slot: a.slot, id };
          if (A.kind === 'king') {
            if (mine ? A.own : A.opp) return; // king picks are final
            know(pid, id); reveal(id, pid, 0);
          }
          if (mine) A.own = pk; else A.opp = pk;
          fx('select', { pid, id });
          if (!pickValid(A.own)) A.own = null;
          if (!pickValid(A.opp)) A.opp = null;
          if (A.own && A.opp) {
            if (A.kind === 'swap') { doSwap(A); endTurn(); } else A.decide = true;
          }
        }
        break;
      }

      case 'king': {
        if (!isTurn || S.step !== 'action' || !S.action.decide) return;
        const A = S.action;
        if (a.swap && pickValid(A.own) && pickValid(A.opp)) doSwap(A);
        else fx('keep', { pid });
        endTurn();
        break;
      }

      case 'snap': {
        if (S.phase !== 'play' || !S.discard.length) return;
        if (S.cabo && S.cabo.by === pid) return;
        const id = p.hand[a.slot];
        if (id == null) return;
        if (p.snapBlock && Date.now() < p.snapBlock) return;
        if (cardRank(S.faces[id]) === cardRank(S.faces[top()])) {
          p.hand[a.slot] = null;
          S.discard.push(id);
          knowAll(id);
          fx('snapOk', { pid, id });
          if (S.action) {
            if (!pickValid(S.action.own)) S.action.own = null;
            if (!pickValid(S.action.opp)) S.action.opp = null;
            if (S.action.decide && !(S.action.own && S.action.opp)) S.action.decide = false;
          }
          botSnaps();
        } else {
          knowAll(id);
          reveal(id, 'all', FAIL_REVEAL_MS);
          p.snapBlock = Date.now() + 1500;
          ensureDeck();
          let nid = null;
          if (S.deck.length) {
            nid = S.deck.pop();
            const free = p.hand.indexOf(null);
            if (free >= 0) p.hand[free] = nid; else p.hand.push(nid);
          }
          fx('snapFail', { pid, id, penalty: nid });
        }
        break;
      }
      default: return;
    }
    commit();
  }

  function doSwap(A) {
    const a = player(A.own.owner), b = player(A.opp.owner);
    a.hand[A.own.slot] = A.opp.id;
    b.hand[A.opp.slot] = A.own.id;
    fx('trade', { pid: cur().id, a: A.own.id, b: A.opp.id });
  }

  // ---------- views ----------
  function view(pid) {
    const now = Date.now();
    const me = player(pid);
    const known = S.known[pid] || new Set();
    const ended = S.phase === 'roundEnd' || S.phase === 'gameEnd';
    const visible = id => {
      if (ended) return true;
      if (S.discard.includes(id)) return true;
      if (S.drawn && S.drawn.id === id && (S.drawn.by === pid || S.drawn.from === 'discard')) return true;
      if (S.phase === 'peek' && me && !me.ready && (me.hand[1] === id || me.hand[3] === id)) return true;
      if (S.reveals.some(r => r.id === id && (r.to === pid || r.to === 'all') && (!r.until || r.until > now))) return true;
      if (S.settings.easy && known.has(id)) return true;
      return false;
    };
    const faces = {};
    const disc = S.discard.slice(-5);
    const ids = [...disc];
    S.players.forEach(p => p.hand.forEach(id => id != null && ids.push(id)));
    if (S.drawn) ids.push(S.drawn.id);
    ids.forEach(id => { if (visible(id)) faces[id] = S.faces[id]; });
    const memo = S.settings.easy ? [] : S.players.flatMap(p => p.hand.filter(id => id != null && known.has(id)));
    return {
      me: pid, hostId: S.hostId, phase: S.phase, round: S.round, deal: S.deal,
      players: S.players.map(p => ({
        id: p.id, name: p.name, bot: p.bot, connected: p.connected || p.bot, hand: p.hand,
        total: p.total, ready: p.ready, roundScore: p.roundScore,
      })),
      turn: S.phase === 'play' ? cur().id : null, step: S.step,
      drawn: S.drawn, action: S.action, cabo: S.cabo,
      deckCount: S.deck.length, discard: disc, faces, memo,
      settings: S.settings, results: S.results, history: S.history,
      fx: S.fx, seq: S.seq,
    };
  }

  // ---------- bots ----------
  const AVG = 7.4;
  const val = id => cardValue(S.faces[id]);

  function botKnowledge(p) {
    const k = S.known[p.id];
    const slots = p.hand.map((id, i) => ({ id, i })).filter(x => x.id != null);
    const knownSlots = slots.filter(x => k.has(x.id));
    const unknown = slots.filter(x => !k.has(x.id));
    let worst = null;
    knownSlots.forEach(x => { if (!worst || val(x.id) > val(worst.id)) worst = x; });
    const est = knownSlots.reduce((a, x) => a + val(x.id), 0) + unknown.length * AVG;
    return { k, slots, knownSlots, unknown, worst, est };
  }

  function oppCards(p, forSwap) {
    const out = [];
    S.players.forEach(o => {
      if (o.id === p.id) return;
      if (forSwap && S.cabo && S.cabo.by === o.id) return;
      o.hand.forEach((id, i) => id != null && out.push({ owner: o.id, slot: i, id }));
    });
    return out;
  }

  function botStep(p) {
    const K = botKnowledge(p);
    if (S.step === 'start') {
      const turnsEach = S.turnCount / S.players.length;
      const urge = turnsEach >= 10 || (turnsEach >= 6 && K.est <= 16);
      if (!S.cabo && turnsEach >= 1.5 && (urge || ((K.est <= 5 || (K.est <= 9 && K.unknown.length === 0 && turnsEach >= 2.5)) && K.unknown.length <= 1))) {
        return act(p.id, { t: 'cabo' });
      }
      const t = top();
      if (t != null && K.slots.length) {
        const tv = val(t);
        if (tv <= 2 && (K.unknown.length || (K.worst && val(K.worst.id) > tv + 2))) return act(p.id, { t: 'draw', from: 'discard' });
        if (tv <= 5 && K.worst && val(K.worst.id) >= tv + 5) return act(p.id, { t: 'draw', from: 'discard' });
      }
      return act(p.id, { t: 'draw', from: 'deck' });
    }
    if (S.step === 'drawn') {
      const dv = val(S.drawn.id);
      const swapWorst = K.worst && val(K.worst.id) > dv;
      if (S.drawn.from === 'discard') {
        const target = swapWorst ? K.worst : (K.unknown[0] || K.worst || K.slots[0]);
        return target ? act(p.id, { t: 'swap', slot: target.i }) : act(p.id, { t: 'discard' });
      }
      if (K.worst && val(K.worst.id) > dv + 1) return act(p.id, { t: 'swap', slot: K.worst.i });
      if (K.unknown.length && dv <= 5) return act(p.id, { t: 'swap', slot: K.unknown[rnd(K.unknown.length)].i });
      return act(p.id, { t: 'discard' });
    }
    if (S.step === 'action') {
      const A = S.action;
      const opp = oppCards(p, A.kind !== 'spy');
      if (A.kind === 'peek') {
        const u = K.unknown[0];
        return u ? act(p.id, { t: 'pick', owner: p.id, slot: u.i }) : act(p.id, { t: 'skip' });
      }
      if (A.kind === 'spy') {
        const u = opp.filter(c => !K.k.has(c.id));
        const c = (u.length ? u : opp)[rnd((u.length ? u : opp).length)];
        return c ? act(p.id, { t: 'pick', owner: c.owner, slot: c.slot }) : act(p.id, { t: 'skip' });
      }
      const lowKnown = opp.filter(c => K.k.has(c.id)).sort((a, b) => val(a.id) - val(b.id))[0];
      if (A.kind === 'swap') {
        if (!A.own) {
          const mine = K.worst && val(K.worst.id) >= 8 ? K.worst : null;
          if (!mine || (lowKnown && val(lowKnown.id) >= val(mine.id))) return act(p.id, { t: 'skip' });
          return act(p.id, { t: 'pick', owner: p.id, slot: mine.i });
        }
        const c = lowKnown && val(lowKnown.id) < val(A.own.id) ? lowKnown : opp.filter(c => !K.k.has(c.id))[0] || opp[rnd(opp.length)];
        return act(p.id, { t: 'pick', owner: c.owner, slot: c.slot });
      }
      if (A.kind === 'king') {
        if (A.decide) return act(p.id, { t: 'king', swap: val(A.opp.id) < val(A.own.id) });
        if (!A.own) {
          const mine = K.worst && val(K.worst.id) >= 7 ? K.worst : (K.unknown[0] || K.worst);
          return mine ? act(p.id, { t: 'pick', owner: p.id, slot: mine.i }) : act(p.id, { t: 'skip' });
        }
        const c = lowKnown && !K.k.has(A.own.id) ? lowKnown : (opp.filter(c => !K.k.has(c.id))[0] || opp[rnd(opp.length)]);
        return act(p.id, { t: 'pick', owner: c.owner, slot: c.slot });
      }
    }
  }

  // Bots throw matching cards they remember onto the pile
  function botSnaps() {
    const t = top();
    if (t == null) return;
    const r = cardRank(S.faces[t]);
    S.players.forEach(p => {
      if (!p.bot || (S.cabo && S.cabo.by === p.id)) return;
      const k = S.known[p.id];
      const slot = p.hand.findIndex(id => id != null && k.has(id) && cardRank(S.faces[id]) === r);
      if (slot < 0 || Math.random() < 0.25) return;
      const id = p.hand[slot];
      later(() => {
        if (S.phase !== 'play' || p.hand[slot] !== id || top() == null || cardRank(S.faces[top()]) !== r) return;
        act(p.id, { t: 'snap', slot });
      }, 900 + rnd(1400));
    });
  }

  function scheduleBots() {
    if (botTimer || !S) return;
    if (S.phase === 'peek') {
      const idle = S.players.find(p => !p.ready && !p.connected);
      if (idle) botTimer = setTimeout(() => { botTimer = null; if (!idle.connected && S.phase === 'peek') act(idle.id, { t: 'ready' }); }, 4000);
      return;
    }
    if (S.phase !== 'play') return;
    const p = cur();
    if (!p.bot && p.connected) return;
    const delay = p.bot ? (S.step === 'start' ? 1100 : 1000 + rnd(500)) : 5000;
    const turnKey = S.turnCount + S.step + (S.action ? (S.action.own ? 1 : 0) + (S.action.opp ? 2 : 0) + (S.action.decide ? 4 : 0) : 0);
    botTimer = setTimeout(() => {
      botTimer = null;
      const key = S.turnCount + S.step + (S.action ? (S.action.own ? 1 : 0) + (S.action.opp ? 2 : 0) + (S.action.decide ? 4 : 0) : 0);
      if (S.phase === 'play' && cur() === p && (p.bot || !p.connected) && key === turnKey) {
        const before = S.seq;
        botStep(p);
        if (S.seq === before) fallback(p);
      } else scheduleBots();
    }, delay);
  }

  // A bot move that was rejected must never stall the table
  function fallback(p) {
    if (S.step === 'start') act(p.id, { t: 'draw', from: 'deck' });
    else if (S.step === 'drawn') {
      if (S.drawn.from === 'deck') act(p.id, { t: 'discard' });
      else act(p.id, { t: 'swap', slot: p.hand.findIndex(id => id != null) });
    } else if (S.step === 'action') act(p.id, S.action.decide ? { t: 'king', swap: false } : { t: 'skip' });
    else commit();
  }

  function commit() { onChange(); scheduleBots(); }

  function setEasy(on) { S.settings.easy = !!on; commit(); }
  function kick() { commit(); }

  return {
    create, load, serialize, act, view, addBot, addPlayer, removePlayer, setConnected,
    startGame, nextRound, backToLobby, setEasy, kick,
    get state() { return S; },
    set onChange(fn) { onChange = fn; },
  };
})();

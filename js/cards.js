// cards.js — Skat deck (32 cards), values, actions and SVG card art
'use strict';

const SUITS = ['c', 's', 'h', 'd']; // Kreuz/Eichel, Pik/Grün, Herz/Rot, Karo/Schellen
const RANKS = ['7', '8', '9', 'T', 'B', 'D', 'K', 'A'];
const ALL_CODES = SUITS.flatMap(s => RANKS.map(r => s + r));

function cardRank(code) { return code[1]; }
function cardSuit(code) { return code[0]; }

// House rules the host can change in the lobby
const DEFAULT_RULES = {
  redKing: -1,       // value of Herz- and Karo-König: -1 or 0
  blackKing: false,  // Kreuz-/Pik-König may look at two cards and swap
  snap: true,        // throwing matching cards onto the discard pile
  penalty: 10,       // added to a failed Cabo call
  target: 100,       // the game ends once someone goes over this
  half: true,        // landing exactly on the target halves your score
  kamikaze: false,   // Dame, Dame, Kreuz-König, Pik-König: you 0, everyone else 50
  easy: false,       // memory aid: cards you have seen stay face-up for you
};
const RULE_CHOICES = { redKing: [-1, 0], penalty: [5, 10, 15], target: [50, 100, 150] };

function sanitizeRules(r) {
  const out = { ...DEFAULT_RULES };
  for (const k in DEFAULT_RULES) {
    if (!r || !(k in r)) continue;
    if (RULE_CHOICES[k]) { if (RULE_CHOICES[k].includes(r[k])) out[k] = r[k]; } else out[k] = !!r[k];
  }
  return out;
}

const isRedSuit = s => s === 'h' || s === 'd';

function cardValue(code, rules = DEFAULT_RULES) {
  const s = code[0], r = code[1];
  if (r === 'A') return 1;
  if (r === 'T') return 10;
  if (r === 'B') return 11;
  if (r === 'D') return 12;
  if (r === 'K') return isRedSuit(s) ? rules.redKing : 13;
  return +r;
}

function cardAction(code, rules = DEFAULT_RULES) {
  switch (code[1]) {
    case '7': case '8': return 'peek';
    case '9': case 'T': return 'spy';
    case 'B': case 'D': return 'swap';
    case 'K': return rules.blackKing && !isRedSuit(code[0]) ? 'king' : null;
    default: return null;
  }
}

function isKamikaze(codes) {
  if (codes.length !== 4) return false;
  const k = codes.map(c => c[1] === 'K' && isRedSuit(c[0]) ? 'r' : c[1]).sort().join('');
  return k === 'DDKK';
}

// ---------- Art ----------

const DECK_STYLES = {
  classic: { c: '#16161c', s: '#16161c', h: '#c8102e', d: '#c8102e' },
  tournament: { c: '#16161c', s: '#16803a', h: '#c8102e', d: '#e98a00' },
  german: { c: '#6b4a1e', s: '#2d7a2d', h: '#c8102e', d: '#d99a00' },
};

function rankLabel(r, style, lang) {
  if (r === 'T') return '10';
  if (style === 'german') return { B: 'U', D: 'O', K: 'K', A: 'A' }[r] || r;
  if (lang === 'en') return { B: 'J', D: 'Q', K: 'K', A: 'A' }[r] || r;
  return r; // B, D, K, A in German
}

// Suit shapes drawn inside a ±50 box, centred on 0,0
function suitShape(suit, style) {
  const col = DECK_STYLES[style][suit];
  if (style === 'german') {
    if (suit === 'h') return `<path fill="${col}" stroke="#7a0a1c" stroke-width="2" d="M0,46 C-10,30 -47,8 -47,-17 C-47,-37 -30,-47 -16,-45 C-6,-43 0,-35 0,-27 C0,-35 6,-43 16,-45 C30,-47 47,-37 47,-17 C47,8 10,30 0,46Z"/>`;
    if (suit === 'd') return `<g><circle r="38" cy="4" fill="#f4b81c" stroke="#8a5a00" stroke-width="3"/>
      <path d="M-38,0 Q0,-12 38,0 L38,10 Q0,-2 -38,10Z" fill="#c8102e"/>
      <circle cy="-36" r="7" fill="none" stroke="#8a5a00" stroke-width="4"/>
      <path d="M-14,26 Q0,32 14,26" stroke="#5a3a00" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="0" cy="28" r="4" fill="#5a3a00"/></g>`;
    if (suit === 's') return `<g><path fill="#2f8a2f" stroke="#155015" stroke-width="2.5" d="M0,40 C-6,26 -42,8 -36,-20 C-31,-40 -10,-46 0,-48 C10,-46 31,-40 36,-20 C42,8 6,26 0,40Z"/>
      <path d="M0,48 L0,-40 M0,-20 L-18,-32 M0,-20 L18,-32 M0,0 L-24,-12 M0,0 L24,-12 M0,18 L-18,8 M0,18 L18,8" stroke="#155015" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
    // Eichel (acorn)
    return `<g><path d="M0,-48 L0,-36" stroke="#5a3a12" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="0" cy="14" rx="25" ry="32" fill="#d9b44a" stroke="#7a5a12" stroke-width="2.5"/>
      <path d="M-30,-6 C-30,-30 30,-30 30,-6 C30,2 -30,2 -30,-6Z" fill="#7a5226" stroke="#4a2e0e" stroke-width="2.5"/>
      <path d="M-22,-18 L-8,-4 M-10,-26 L10,-4 M4,-27 L24,-6 M22,-20 L8,-4 M10,-27 L-12,-4 M-4,-27 L-24,-8" stroke="#4a2e0e" stroke-width="1.6"/></g>`;
  }
  switch (suit) {
    case 'h': return `<path fill="${col}" d="M0,46 C-10,30 -48,8 -48,-18 C-48,-38 -30,-48 -16,-46 C-6,-44 0,-36 0,-28 C0,-36 6,-44 16,-46 C30,-48 48,-38 48,-18 C48,8 10,30 0,46Z"/>`;
    case 'd': return `<path fill="${col}" d="M0,-50 Q14,-24 38,0 Q14,24 0,50 Q-14,24 -38,0 Q-14,-24 0,-50Z"/>`;
    case 's': return `<path fill="${col}" d="M0,-48 C10,-32 48,-12 48,12 C48,30 32,38 18,36 C10,35 4,30 2,24 C4,34 8,42 16,48 L-16,48 C-8,42 -4,34 -2,24 C-4,30 -10,35 -18,36 C-32,38 -48,30 -48,12 C-48,-12 -10,-32 0,-48Z"/>`;
    default: return `<g fill="${col}"><circle cy="-22" r="21"/><circle cx="-23" cy="9" r="21"/><circle cx="23" cy="9" r="21"/><circle cy="4" r="10"/><path d="M-4,10 L4,10 L12,48 L-12,48Z"/></g>`;
  }
}

function place(markup, x, y, size, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${size / 100})">${markup}</g>`;
}

const PIP_LAYOUTS = {
  '7': [[62, 70], [138, 70], [62, 150], [138, 150], [62, 230], [138, 230], [100, 110]],
  '8': [[62, 70], [138, 70], [62, 150], [138, 150], [62, 230], [138, 230], [100, 110], [100, 190]],
  '9': [[62, 66], [138, 66], [62, 122], [138, 122], [62, 178], [138, 178], [62, 234], [138, 234], [100, 150]],
  'T': [[62, 66], [138, 66], [62, 122], [138, 122], [62, 178], [138, 178], [62, 234], [138, 234], [100, 94], [100, 206]],
};

function figureHalf(rank, suit, style) {
  const P = DECK_STYLES[style][suit];
  const G = '#e2a72e';
  const B2 = (suit === 'h' || suit === 'd') ? '#23468f' : '#c8102e';
  const skin = '#f7d9bb';
  let hair = '', hat = '', item = '', face = '';
  if (rank === 'K') {
    hair = `<path d="M84,92 Q100,124 116,92 Q109,106 100,106 Q91,106 84,92Z" fill="#ece6da" stroke="#b9ae9a" stroke-width="1"/>`;
    hat = `<path d="M83,76 L83,57 L91,66 L100,52 L109,66 L117,57 L117,76Z" fill="${G}" stroke="#8a6200" stroke-width="1.5"/><circle cx="100" cy="66" r="3" fill="#c8102e"/><circle cx="88" cy="71" r="2" fill="#23468f"/><circle cx="112" cy="71" r="2" fill="#23468f"/>`;
    item = `<path d="M141,148 L141,96" stroke="#9aa3ad" stroke-width="5" stroke-linecap="round"/><path d="M132,104 L150,104" stroke="${G}" stroke-width="5" stroke-linecap="round"/><circle cx="141" cy="94" r="4" fill="${G}"/>`;
  } else if (rank === 'D') {
    hair = `<path d="M82,92 C78,68 90,62 100,62 C110,62 122,68 118,92 L121,114 L111,110 L112,88 C108,78 92,78 88,88 L89,110 L79,114Z" fill="#e9b949" stroke="#a87b16" stroke-width="1"/>`;
    hat = `<path d="M86,72 L93,62 L100,68 L107,62 L114,72Z" fill="${G}" stroke="#8a6200" stroke-width="1.2"/><circle cx="100" cy="67" r="2" fill="#c8102e"/>`;
    item = `<path d="M128,146 L130,120" stroke="#2d7a2d" stroke-width="3"/><circle cx="130" cy="116" r="7" fill="#d8304a"/><circle cx="130" cy="116" r="2.6" fill="${G}"/>`;
  } else {
    hair = `<path d="M85,86 L84,100 L90,96 Z M115,86 L116,100 L110,96Z" fill="#7a4a22"/><path d="M92,98 Q100,94 108,98 Q100,101 92,98Z" fill="#7a4a22"/>`;
    hat = `<path d="M81,82 C82,64 118,64 119,82Z" fill="${B2}" stroke="#00000033"/><path d="M115,74 C130,60 140,62 148,50 C141,68 130,74 117,80Z" fill="${G}"/>`;
    item = `<path d="M60,148 L60,90" stroke="#8a5a2b" stroke-width="3.5" stroke-linecap="round"/><path d="M60,88 L50,100 L60,105Z" fill="#b9c0c8" stroke="#6b7480"/>`;
  }
  if (rank !== 'B') face = `<path d="M96,100 Q100,103 104,100" stroke="#a33" stroke-width="1.5" fill="none"/>`;
  return `
    <path d="M46,150 C50,127 66,117 82,113 L118,113 C134,117 150,127 154,150Z" fill="${P}"/>
    <path d="M60,150 C62,134 70,126 82,120 L100,140 L118,120 C130,126 138,134 140,150Z" fill="${B2}" opacity=".9"/>
    <path d="M82,113 L100,136 L118,113" fill="none" stroke="${G}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="70" cy="139" r="3.5" fill="${G}"/><circle cx="130" cy="139" r="3.5" fill="${G}"/>
    <rect x="93" y="102" width="14" height="13" fill="${skin}"/>
    ${rank === 'D' ? hair : ''}
    <ellipse cx="100" cy="90" rx="15" ry="18" fill="${skin}" stroke="#0002"/>
    <circle cx="94.5" cy="88" r="1.9" fill="#222"/><circle cx="105.5" cy="88" r="1.9" fill="#222"/>
    ${face}${rank !== 'D' ? hair : ''}${hat}${item}`;
}

const _faceCache = new Map();

function faceSVG(code, style, lang) {
  const key = code + style + lang;
  if (_faceCache.has(key)) return _faceCache.get(key);
  const s = code[0], r = code[1];
  const col = DECK_STYLES[style][s];
  const shape = suitShape(s, style);
  const label = rankLabel(r, style, lang);
  const fs = label.length > 1 ? 30 : 36;
  const idx = `<text x="22" y="44" font-family="Georgia,'Times New Roman',serif" font-weight="700" font-size="${fs}" fill="${col}" text-anchor="middle" letter-spacing="${label.length > 1 ? -2 : 0}">${label}</text>${place(shape, 22, 66, 22)}`;
  let body = '';
  if (PIP_LAYOUTS[r]) {
    body = PIP_LAYOUTS[r].map(([x, y]) => place(shape, x, y, 40, y > 150 ? 180 : 0)).join('');
  } else if (r === 'A') {
    body = `<circle cx="100" cy="150" r="62" fill="none" stroke="${col}" stroke-opacity=".14" stroke-width="2"/>
      <circle cx="100" cy="150" r="70" fill="none" stroke="${col}" stroke-opacity=".08" stroke-width="6"/>` + place(shape, 100, 150, 100);
  } else {
    const half = figureHalf(r, s, style);
    body = `<defs><clipPath id="fc${code}"><rect x="38" y="46" width="124" height="208" rx="5"/></clipPath></defs>
      <rect x="38" y="46" width="124" height="208" rx="5" fill="#fbf4e4"/>
      <g clip-path="url(#fc${code})"><g>${half}</g><g transform="rotate(180 100 150)">${half}</g></g>
      <path d="M38,150 L162,150" stroke="${col}" stroke-opacity=".55" stroke-width="1.5"/>
      ${place(shape, 52, 62, 16)}${place(shape, 148, 238, 16, 180)}
      <rect x="38" y="46" width="124" height="208" rx="5" fill="none" stroke="${col}" stroke-width="2.5"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">
    <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f1ece2"/></linearGradient></defs>
    <rect x="1" y="1" width="198" height="298" rx="16" fill="url(#pg)" stroke="#00000022" stroke-width="2"/>
    ${body}${idx}<g transform="rotate(180 100 150)">${idx}</g></svg>`;
  const url = `url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/'/g, '%27')}')`;
  _faceCache.set(key, url);
  return url;
}

const BACK_SVG = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">
  <defs>
    <pattern id="lat" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="16" height="16" fill="#8e1830"/><path d="M0,8 L16,8 M8,0 L8,16" stroke="#b02742" stroke-width="2"/>
      <circle cx="8" cy="8" r="2.2" fill="#e6b450" opacity=".55"/>
    </pattern>
    <radialGradient id="gl" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient>
  </defs>
  <rect x="1" y="1" width="198" height="298" rx="16" fill="#fbf7ef"/>
  <rect x="11" y="11" width="178" height="278" rx="9" fill="url(#lat)"/>
  <rect x="11" y="11" width="178" height="278" rx="9" fill="url(#gl)"/>
  <rect x="17" y="17" width="166" height="266" rx="6" fill="none" stroke="#e6b450" stroke-width="2" opacity=".8"/>
  <ellipse cx="100" cy="150" rx="52" ry="34" fill="#5e0e1f" stroke="#e6b450" stroke-width="3"/>
  <text x="100" y="161" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-style="italic" font-size="31" fill="#f2c867" letter-spacing="1">Cabo</text>
  </svg>`;
  return `url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/'/g, '%27')}')`;
})();

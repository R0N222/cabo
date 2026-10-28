// fx.js — synthesized sounds, particles, confetti, haptics
'use strict';

const Sound = (() => {
  let ctx = null, master = null, noise = null;
  let on = (() => { try { return localStorage.getItem('cabo-sound') !== 'off'; } catch (e) { return true; } })();

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function env(g, t0, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function noiseBurst({ t = 0, dur = 0.15, type = 'bandpass', f0 = 2000, f1 = 600, q = 1, peak = 0.3, a = 0.01 }) {
    const t0 = ctx.currentTime + t;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); env(g, t0, a, peak, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  }

  function tone({ t = 0, f = 440, f1 = null, dur = 0.2, type = 'sine', peak = 0.2, a = 0.005 }) {
    const t0 = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); env(g, t0, a, peak, dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  const S = {
    swish: (t = 0) => noiseBurst({ t, dur: 0.16, f0: 3200, f1: 700, q: 0.8, peak: 0.22, a: 0.03 }),
    flip: (t = 0) => { noiseBurst({ t, dur: 0.05, type: 'highpass', f0: 4000, f1: 2500, peak: 0.25 }); tone({ t, f: 1900, f1: 1200, dur: 0.04, peak: 0.05, type: 'triangle' }); },
    place: (t = 0) => { tone({ t, f: 170, f1: 70, dur: 0.14, peak: 0.45 }); noiseBurst({ t, dur: 0.06, type: 'lowpass', f0: 1800, f1: 400, peak: 0.3 }); },
    select: (t = 0) => tone({ t, f: 980, f1: 1250, dur: 0.07, type: 'triangle', peak: 0.12 }),
    turn: () => { tone({ f: 784, dur: 0.25, peak: 0.12 }); tone({ t: 0.12, f: 1175, dur: 0.4, peak: 0.12 }); },
    snapOk: () => {
      S.place();
      [880, 1109, 1319, 1760].forEach((f, i) => tone({ t: 0.05 + i * 0.055, f, dur: 0.22, type: 'triangle', peak: 0.16 }));
      noiseBurst({ t: 0.08, dur: 0.35, type: 'highpass', f0: 7000, f1: 5000, peak: 0.08 });
    },
    fail: () => { tone({ f: 260, f1: 90, dur: 0.45, type: 'sawtooth', peak: 0.14 }); tone({ t: 0.02, f: 247, f1: 85, dur: 0.45, type: 'square', peak: 0.06 }); },
    cabo: () => {
      tone({ f: 90, f1: 40, dur: 0.6, peak: 0.6 });
      noiseBurst({ dur: 0.4, type: 'lowpass', f0: 3000, f1: 200, peak: 0.35 });
      [392, 494, 587, 784].forEach(f => tone({ t: 0.08, f, dur: 0.9, type: 'sawtooth', peak: 0.05 }));
      [392, 494, 587, 784].forEach(f => tone({ t: 0.08, f: f / 2, dur: 0.9, type: 'triangle', peak: 0.08 }));
    },
    peek: () => { S.flip(); tone({ t: 0.03, f: 660, f1: 990, dur: 0.18, peak: 0.07, type: 'sine' }); },
    trade: () => { S.swish(); S.swish(0.12); tone({ t: 0.1, f: 520, f1: 390, dur: 0.18, peak: 0.06, type: 'triangle' }); },
    shuffle: () => { for (let i = 0; i < 7; i++) noiseBurst({ t: i * 0.045, dur: 0.05, type: 'highpass', f0: 3500, f1: 2400, peak: 0.12 }); },
    deal: n => { for (let i = 0; i < n; i++) S.swish(i * 0.06); },
    tick: (t = 0, i = 0) => tone({ t, f: 900 + i * 40, dur: 0.04, type: 'square', peak: 0.03 }),
    win: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone({ t: i * 0.12, f, dur: 0.35, type: 'triangle', peak: 0.16 }));
      [523, 659, 784, 1047].forEach(f => tone({ t: 0.5, f, dur: 1.2, type: 'triangle', peak: 0.08 }));
    },
    roundEnd: n => { for (let i = 0; i < n; i++) S.flip(i * 0.07); },
    join: () => { tone({ f: 660, dur: 0.12, peak: 0.08 }); tone({ t: 0.08, f: 990, dur: 0.18, peak: 0.08 }); },
  };

  return {
    init,
    get on() { return on; },
    set on(v) { on = v; try { localStorage.setItem('cabo-sound', v ? 'on' : 'off'); } catch (e) {} },
    play(name, ...args) { if (!on || !ctx || ctx.state !== 'running') return; try { S[name](...args); } catch (e) {} },
  };
})();

function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

const Particles = (() => {
  let cv, cx, parts = [], raf = 0, dpr = 1;
  function setup() {
    cv = document.getElementById('fx');
    cx = cv.getContext('2d');
    const rs = () => { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    rs(); addEventListener('resize', rs);
  }
  function loop() {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.life -= 1; p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const a = Math.max(0, Math.min(1, p.life / 25));
      cx.globalAlpha = a;
      cx.fillStyle = p.c;
      if (p.kind === 'conf') {
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.scale(1, Math.cos(p.rot * 2.3));
        cx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); cx.restore();
      } else {
        cx.beginPath(); cx.arc(p.x, p.y, p.s * a, 0, 6.283); cx.fill();
      }
    }
    cx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(loop) : 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  return {
    setup,
    sparks(x, y, colors = ['#ffd76a', '#fff3c4', '#ffb02e'], n = 40) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, v = 2 + Math.random() * 7;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: 0.12, drag: 0.94, s: 1.5 + Math.random() * 3, c: colors[i % colors.length], life: 35 + Math.random() * 30, rot: 0, vr: 0 });
      }
      kick();
    },
    confetti(n = 160) {
      const cols = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#f8f9fa', '#c77dff'];
      for (let i = 0; i < n; i++) {
        parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.5, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4, g: 0.06, drag: 0.99, s: 7 + Math.random() * 7, c: cols[i % cols.length], life: 200 + Math.random() * 120, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, kind: 'conf' });
      }
      kick();
    },
  };
})();

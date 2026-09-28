/* ============================================================
   sfx.js — barcha tovushlar kod orqali yasaladi (fayl kerak emas)
   * Web Audio: karta, navbat, tanga, stiker effektlari
   * speechSynthesis: stiker/sovg'a so'zini ovoz chiqarib aytadi
     (masalan ❤️ → "I love you!")
   ============================================================ */
(function (global) {
  'use strict';

  let ctx = null;
  let master = null;
  const cfg = { sfx: true, speech: true, volume: 0.8 };

  function ac() {
    if (!ctx) {
      const C = global.AudioContext || global.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = cfg.volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // Brauzerlar tovushni faqat foydalanuvchi bosgandan keyin ruxsat beradi
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    global.addEventListener(ev, () => { ac(); }, { once: true, passive: true }));

  function configure(c) {
    Object.assign(cfg, c || {});
    if (master) master.gain.value = cfg.volume;
  }

  /* ---------- Asosiy "g'ishtlar" ---------- */
  function tone(freq, dur, o = {}) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (o.at || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    if (o.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o.vib; lg.gain.value = o.vibDepth || freq * 0.04;
      l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur);
    }
    const v = (o.vol == null ? 0.3 : o.vol);
    const a = o.attack || 0.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  let noiseBuf = null;
  function noise(dur, o = {}) {
    const c = ac(); if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + (o.at || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1500, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    const v = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  }
  const notes = (seq, o = {}) => {
    let at = o.at || 0;
    seq.forEach(([f, d]) => { if (f) tone(f, d * 1.1, { ...o, at }); at += d; });
  };

  /* ---------- Retseptlar ---------- */
  const R = {
    card: () => { noise(0.07, { freq: 2600, q: 0.8, vol: 0.25 }); noise(0.05, { freq: 900, vol: 0.12, at: 0.02 }); },
    deal: () => { for (let i = 0; i < 4; i++) noise(0.06, { freq: 2400, q: 0.7, vol: 0.18, at: i * 0.09 }); },
    turn: () => { tone(880, 0.18, { vol: 0.16 }); tone(1320, 0.3, { vol: 0.12, at: 0.09 }); },
    take: () => { notes([[660, 0.08], [880, 0.08], [1100, 0.16]], { type: 'triangle', vol: 0.14 }); },
    lose: () => { notes([[440, 0.14], [370, 0.14], [311, 0.3]], { type: 'triangle', vol: 0.14 }); },
    msg: () => { tone(1250, 0.08, { vol: 0.1 }); tone(1650, 0.12, { vol: 0.08, at: 0.06 }); },
    click: () => { tone(1800, 0.03, { vol: 0.06, type: 'square' }); },
    coins: () => { for (let i = 0; i < 5; i++) { tone(1900 + i * 120, 0.08, { type: 'square', vol: 0.06, at: i * 0.07 }); tone(2600 + i * 120, 0.1, { vol: 0.05, at: i * 0.07 + 0.03 }); } },
    levelup: () => { notes([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.4]], { type: 'square', vol: 0.09 }); notes([[262, 0.36], [392, 0.4]], { type: 'triangle', vol: 0.12 }); R.sparkle(0.35); },
    error: () => { tone(220, 0.15, { type: 'square', vol: 0.08 }); tone(180, 0.2, { type: 'square', vol: 0.08, at: 0.12 }); },
    join: () => { tone(660, 0.1, { vol: 0.12 }); tone(990, 0.16, { vol: 0.12, at: 0.08 }); },
    leave: () => { tone(990, 0.1, { vol: 0.12 }); tone(660, 0.16, { vol: 0.12, at: 0.08 }); },

    heartbeat: () => { [0, 0.18, 0.7, 0.88].forEach((at, i) => tone(i % 2 ? 55 : 70, 0.18, { at, vol: 0.5, to: 40 })); },
    chime: () => notes([[880, 0.12], [1108, 0.12], [1318, 0.12], [1760, 0.5]], { vol: 0.13 }),
    ding: () => { tone(1320, 0.5, { vol: 0.15 }); tone(1980, 0.4, { vol: 0.06 }); },
    kiss: () => { noise(0.05, { freq: 3200, q: 3, vol: 0.4 }); tone(1400, 0.12, { to: 500, vol: 0.2, at: 0.02 }); },
    crunch: () => { for (let i = 0; i < 6; i++) noise(0.05, { freq: 1500 + Math.random() * 2500, filter: 'highpass', vol: 0.3, at: i * 0.06 + Math.random() * 0.03 }); },
    slurp: () => { noise(0.5, { freq: 400, to: 2400, q: 6, vol: 0.3 }); },
    pop: () => { [0, 0.12, 0.22].forEach((at) => tone(700, 0.08, { to: 180, at, vol: 0.3 })); },
    sour: () => { tone(900, 0.4, { type: 'sawtooth', vib: 22, vibDepth: 40, vol: 0.06, to: 700 }); },
    boing: () => { tone(180, 0.5, { to: 520, vib: 14, vibDepth: 60, vol: 0.25 }); },
    pour: () => { for (let i = 0; i < 8; i++) noise(0.12, { freq: 500 + Math.random() * 900, q: 8, vol: 0.2, at: i * 0.08 }); },
    sparkle: (at0 = 0) => { for (let i = 0; i < 10; i++) tone(2200 + Math.random() * 2200, 0.12, { at: at0 + i * 0.05, vol: 0.06, type: 'triangle' }); },
    birthday: () => notes([[392, 0.22], [392, 0.1], [440, 0.3], [392, 0.3], [523, 0.3], [494, 0.55]], { type: 'triangle', vol: 0.16 }),
    fanfare: () => { notes([[523, 0.12], [523, 0.08], [523, 0.08], [659, 0.3], [523, 0.14], [784, 0.5]], { type: 'sawtooth', vol: 0.06 }); notes([[262, 0.62], [392, 0.6]], { type: 'square', vol: 0.05 }); },
    horn: () => { [0, 0.28].forEach((at) => { tone(440, 0.2, { type: 'square', vol: 0.08, at }); tone(554, 0.2, { type: 'square', vol: 0.07, at }); }); },
    fireworks: () => { noise(0.5, { freq: 300, to: 3000, q: 3, vol: 0.2 }); noise(0.7, { freq: 180, filter: 'lowpass', vol: 0.5, at: 0.5 }); R.sparkle(0.6); },
    applause: () => { for (let i = 0; i < 40; i++) noise(0.04, { freq: 1200 + Math.random() * 1800, q: 1.2, vol: 0.12 + Math.random() * 0.1, at: Math.random() * 1.4 }); },
    laugh: () => { [0, 0.16, 0.32, 0.48].forEach((at, i) => tone(420 - i * 25, 0.12, { type: 'triangle', vib: 30, vibDepth: 20, vol: 0.18, at })); },
    boo: () => { tone(260, 0.8, { type: 'sawtooth', to: 140, vol: 0.08, vib: 5, vibDepth: 8 }); },
    buzz: () => { tone(110, 0.6, { type: 'sawtooth', vib: 18, vibDepth: 14, vol: 0.12 }); tone(55, 0.6, { type: 'square', vol: 0.06 }); },
    sad: () => { tone(600, 0.9, { to: 250, vib: 6, vibDepth: 15, vol: 0.14, type: 'triangle' }); },
    hmm: () => { tone(180, 0.7, { to: 220, type: 'triangle', vol: 0.18 }); },
    cool: () => { tone(98, 0.3, { type: 'sawtooth', vol: 0.1 }); tone(1568, 0.4, { at: 0.18, vol: 0.12 }); },
    bleat: () => { tone(420, 0.9, { type: 'sawtooth', vib: 13, vibDepth: 60, vol: 0.1, to: 380 }); },
    whoosh: () => { noise(0.6, { freq: 200, to: 4000, q: 2, vol: 0.3 }); },
    shock: () => { tone(900, 0.4, { to: 1600, type: 'square', vol: 0.06 }); noise(0.2, { freq: 2000, vol: 0.2, at: 0.05 }); },
    snore: () => { [0, 0.9].forEach((at) => noise(0.7, { freq: 180, q: 3, vol: 0.35, at, attack: 0.25 })); },
    drum: () => { [0, 0.2, 0.4].forEach((at) => tone(90, 0.2, { to: 45, at, vol: 0.5 })); },
    shh: () => { noise(0.9, { freq: 4000, filter: 'highpass', vol: 0.18, attack: 0.1 }); },
    brr: () => { tone(300, 0.6, { vib: 32, vibDepth: 50, type: 'square', vol: 0.05 }); noise(0.6, { freq: 5000, filter: 'highpass', vol: 0.08 }); },
    fart: () => { tone(90, 0.45, { type: 'sawtooth', vib: 26, vibDepth: 30, vol: 0.15, to: 60 }); },
    rooster: () => { notes([[520, 0.12], [780, 0.16], [880, 0.3], [700, 0.25]], { type: 'sawtooth', vol: 0.05, vib: 9, vibDepth: 20 }); },
  };

  function play(name) {
    if (!cfg.sfx) return;
    const f = R[name];
    if (f) { try { f(); } catch (e) { /* e'tiborsiz */ } }
  }

  /* ---------- Ovoz chiqarib aytish ---------- */
  let voices = [];
  function loadVoices() {
    if (!global.speechSynthesis) return;
    voices = speechSynthesis.getVoices() || [];
  }
  if (global.speechSynthesis) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  function pickVoice() {
    const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
    return en.find((v) => /female|samantha|zira|google us/i.test(v.name)) || en[0] || null;
  }
  function say(text, o = {}) {
    if (!cfg.speech || !text || !global.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) u.voice = v;
      u.lang = (v && v.lang) || 'en-US';
      u.pitch = o.pitch || 1;
      u.rate = o.rate || 1;
      u.volume = Math.min(1, cfg.volume + 0.1);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* e'tiborsiz */ }
  }

  /** Stiker yoki sovg'aning to'liq ovozi: effekt + so'z */
  function item(it) {
    if (!it) return;
    play(it.sfx);
    setTimeout(() => say(it.say, { pitch: it.pitch }), 220);
  }

  function vibrate(ms) { try { if (cfg.vibrate && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* */ } }

  global.Sfx = { play, say, item, configure, vibrate, ctx: () => ac() };
})(window);

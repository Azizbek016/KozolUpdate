/* ============================================================
   shared.js — server VA brauzer uchun umumiy kod
   1) Karta qoidalari (yengish mantig'i)
   2) Level / tajriba (LP) hisobi
   3) Do'kon katalogi: karta skinlari, qo'lqoplar, sovg'alar, stikerlar
   Node:    const K = require('./public/shared.js')
   Brauzer: window.Kozol
   ============================================================ */
(function (root, factory) {
  const K = factory();
  if (typeof module === 'object' && module.exports) module.exports = K;
  else root.Kozol = K;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ============================================================
     1. QOIDALAR
     ============================================================ */
  const SUITS = ['C', 'S', 'D', 'H'];          // Chillik ♣, Qarg'a ♠, G'isht ♦, Tappon ♥
  const SUIT_UZ = { C: 'Chillik', S: "Qarg'a", D: "G'isht", H: 'Tappon' };
  const SUIT_CHAR = { C: '♣', S: '♠', D: '♦', H: '♥' };
  const RANKS = ['6', '7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
  // Kuch: Tuz > 10 > Karol > Dama > Valet > 9 > 8 > 7 > 6
  const POWER = { '6': 1, '7': 2, '8': 3, '9': 4, 'J': 5, 'Q': 6, 'K': 7, '10': 8, 'A': 9 };
  const VALUE = { '6': 0, '7': 0, '8': 0, '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
  const RANK_UZ = { J: 'V', Q: 'D', K: 'K', A: 'T' };

  const rankOf = (c) => c.slice(0, -1);
  const suitOf = (c) => c.slice(-1);
  const powOf = (c) => POWER[rankOf(c)];
  const valOf = (c) => VALUE[rankOf(c)];
  const sumValue = (cards) => cards.reduce((s, c) => s + valOf(c), 0);
  const label = (c) => (RANK_UZ[rankOf(c)] || rankOf(c)) + SUIT_CHAR[suitOf(c)];

  /** a kartasi b kartasini yengadimi? */
  function beats(a, b, trump) {
    const at = suitOf(a) === trump;
    const bt = suitOf(b) === trump;
    if (at !== bt) return at;                  // zot oddiy mastani yengadi
    if (suitOf(a) !== suitOf(b)) return false; // boshqa masta — yenga olmaydi
    return powOf(a) > powOf(b);
  }

  /**
   * ASOSIY QOIDA (tuzatilgan):
   * Stoldagi HAR BIR kartani alohida karta bilan urish kerak.
   * Masalan 8♣ 9♣ yurilgan, zot ♥ bo'lsa:
   *   10♣ + J♣  → to'g'ri (10 > 9, J > 8)
   *   7♥ + 10♣  → to'g'ri (zot 8 ni, 10 esa 9 ni uradi)
   *   A♥ + 6♣   → XATO (6♣ hech qaysi kartani ura olmaydi)
   * Har bir karta faqat bitta kartani uradi — juftlikni qidiramiz.
   * Qaytaradi: pairs[i] = target[i] ni uradigan mine indeksi, yoki null.
   */
  function matchBeat(mine, target, trump) {
    if (!Array.isArray(mine) || !Array.isArray(target)) return null;
    if (!target.length || mine.length !== target.length) return null;
    const n = target.length;
    const used = new Array(n).fill(false);
    const pairs = new Array(n).fill(-1);
    // Qiyin kartalarni birinchi joylaymiz (tezroq topiladi)
    const cnt = target.map((t) => mine.filter((m) => beats(m, t, trump)).length);
    const order = target.map((c, i) => i).sort((x, y) => cnt[x] - cnt[y]);
    function go(k) {
      if (k === n) return true;
      const ti = order[k];
      for (let j = 0; j < n; j++) {
        if (used[j] || !beats(mine[j], target[ti], trump)) continue;
        used[j] = true; pairs[ti] = j;
        if (go(k + 1)) return true;
        used[j] = false; pairs[ti] = -1;
      }
      return false;
    }
    return go(0) ? pairs : null;
  }
  const beatsAll = (mine, target, trump) => matchBeat(mine, target, trump) !== null;

  /** arr ichidan k tadan barcha kombinatsiyalar */
  function combos(arr, k) {
    const out = [];
    const cur = [];
    (function rec(i) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (let j = i; j < arr.length; j++) { cur.push(arr[j]); rec(j + 1); cur.pop(); }
    })(0);
    return out;
  }

  /** Qo'ldagi, stoldagi kartalarni to'liq ura oladigan barcha to'plamlar */
  function beatingSets(hand, target, trump) {
    if (!target || !target.length || hand.length < target.length) return [];
    return combos(hand, target.length).filter((set) => beatsAll(set, target, trump));
  }

  /* ============================================================
     2. LEVEL TIZIMI (PUBG uslubida)
     Har level = 100 LP. Boshida tez ko'tariladi, keyin sekinlashadi.
     Yutqazganda LP kamayadi (levelning o'zi tushmaydi).
     ============================================================ */
  const LP_PER_LEVEL = 100;
  const MAX_LEVEL = 100;

  /** Yutganda beriladigan LP (level oshgan sari kamayadi) */
  function winLp(level) {
    return Math.max(6, Math.round(6 + 94 * Math.exp(-(level - 1) / 11)));
  }
  /** Yutqazganda olinadigan LP (level oshgan sari ko'payadi) */
  function lossLp(level) {
    return Math.max(1, Math.round(1 + level * 0.1));
  }
  /** LP qo'shish / ayirish */
  function applyLp(level, lp, delta) {
    level = Math.max(1, Math.min(MAX_LEVEL, level | 0));
    if (level >= MAX_LEVEL) return { level: MAX_LEVEL, lp: 0, ups: 0 };
    let ups = 0;
    lp = (lp | 0) + (delta | 0);
    while (lp >= LP_PER_LEVEL && level < MAX_LEVEL) { lp -= LP_PER_LEVEL; level++; ups++; }
    if (level >= MAX_LEVEL) lp = 0;
    if (lp < 0) lp = 0;
    return { level, lp, ups };
  }

  const TIERS = [
    { id: 'bronze',   min: 1,   name: 'Bronza',  c1: '#e0a36a', c2: '#7a4520', glow: 'rgba(224,163,106,.45)' },
    { id: 'silver',   min: 10,  name: 'Kumush',  c1: '#eef2f7', c2: '#8a95a5', glow: 'rgba(220,228,240,.45)' },
    { id: 'gold',     min: 25,  name: 'Oltin',   c1: '#ffe38a', c2: '#b8860b', glow: 'rgba(255,214,90,.5)' },
    { id: 'platinum', min: 45,  name: 'Platina', c1: '#b9fff1', c2: '#3a9c8c', glow: 'rgba(120,240,220,.5)' },
    { id: 'diamond',  min: 65,  name: 'Olmos',   c1: '#c9e4ff', c2: '#3f6fe0', glow: 'rgba(120,170,255,.55)' },
    { id: 'crown',    min: 85,  name: 'Toj',     c1: '#ffb3d9', c2: '#9b1d6b', glow: 'rgba(255,120,200,.55)' },
    { id: 'legend',   min: 100, name: 'Afsona',  c1: '#fff1a8', c2: '#c0392b', glow: 'rgba(255,90,60,.6)' },
  ];
  function tierOf(level) {
    let t = TIERS[0];
    for (const x of TIERS) if (level >= x.min) t = x;
    return t;
  }
  const tierById = (id) => TIERS.find((t) => t.id === id) || null;

  const REWARD = {
    START_COINS: 150,
    DAILY: 25,
    WIN: [15, 20],     // yutganda tanga
    LOSS: [3, 5],      // yutqazganda tanga
    BOT_FACTOR: 0.5,   // raqiblar faqat bot bo'lsa — mukofot yarmi
    SOF_BONUS_LP: 3,   // har bir "sof kozol" uchun qo'shimcha LP
    QUIT_FACTOR: 2,    // o'yinni tashlab ketsa — LP jarimasi 2 barobar
  };
  const levelUpCoins = (newLevel) => 10 + newLevel;

  /* ============================================================
     3. DO'KON KATALOGI
     ============================================================ */

  /* --- Karta skinlari: faqat fon va ramka o'zgaradi, raqamlar/belgilar o'sha-o'sha --- */
  const SKINS = [
    { id: 'classic',  name: 'Klassik',     price: 0,    bg: ['#fdfbf5', '#f6f1e4'], stroke: '#d9d2c2', inner: '#eae4d6' },
    { id: 'ivory',    name: 'Fil suyagi',  price: 80,   bg: ['#fffaf0', '#efe2c4'], stroke: '#c9b48a', inner: '#e3d3ad' },
    { id: 'sky',      name: 'Osmon',       price: 120,  bg: ['#f5faff', '#d6e9fb'], stroke: '#8fb6dc', inner: '#bcd6ef' },
    { id: 'mint',     name: 'Yalpiz',      price: 120,  bg: ['#f4fff9', '#d3f3e4'], stroke: '#7cc5a4', inner: '#b3e3cc' },
    { id: 'rose',     name: 'Atirgul',     price: 150,  bg: ['#fff6f8', '#fbdbe3'], stroke: '#e19aac', inner: '#f2c0cd' },
    { id: 'lavender', name: 'Lavanda',     price: 150,  bg: ['#faf6ff', '#e5d9fb'], stroke: '#a992d6', inner: '#cfc0ee' },
    { id: 'sand',     name: 'Qum',         price: 180,  bg: ['#fbf4e6', '#ead7b0'], stroke: '#b8965a', inner: '#d9c08e', pattern: 'dots' },
    { id: 'ganch',    name: 'Ganch',       price: 260,  bg: ['#fffdf6', '#f2eadb'], stroke: '#c9a227', inner: '#e2c985', pattern: 'girih' },
    { id: 'snow',     name: 'Qor',         price: 300,  bg: ['#f7fbff', '#e1eefa'], stroke: '#7aa7d6', inner: '#b7d2ee', pattern: 'snow' },
    { id: 'samarkand',name: 'Samarqand',   price: 320,  bg: ['#f2fbff', '#d4ecf7'], stroke: '#1f7fb3', inner: '#6fb7da', pattern: 'tiles' },
    { id: 'marble',   name: 'Marmar',      price: 350,  bg: ['#fbfbfb', '#e4e5ea'], stroke: '#9ea3ad', inner: '#c9ccd3', pattern: 'marble' },
    { id: 'silver',   name: 'Kumush',      price: 450,  bg: ['#fbfcfe', '#cfd5de'], stroke: '#8d96a3', inner: '#b8bfca', pattern: 'shine' },
    { id: 'gold',     name: 'Oltin',       price: 700,  bg: ['#fff8dc', '#f1d27a'], stroke: '#b8860b', inner: '#d9b45b', pattern: 'shine' },
    { id: 'neon',     name: 'Neon',        price: 900,  bg: ['#fbfffe', '#e6fff8'], stroke: '#00c99d', inner: '#7dfbe0', glow: '#00e5b4' },
    { id: 'royal',    name: 'Shoh',        price: 1200, bg: ['#fffaf2', '#f3e3c3'], stroke: '#7b1420', inner: '#c9a227', pattern: 'girih', glow: '#e2b64a' },
  ];

  /* --- Qo'lqoplar: kartalarni ushlab turgan qo'l --- */
  const GLOVES = [
    { id: 'bare',      name: "Oddiy qo'l",    price: 0,   base: '#e9b98f', shade: '#c98f63', cuff: '#2d4a43', accent: '#1d332e', pattern: 'skin' },
    { id: 'white',     name: 'Oq ipak',       price: 60,  base: '#f7f5f0', shade: '#d6d1c4', cuff: '#e8e2d4', accent: '#c9c1ad', pattern: 'stitch' },
    { id: 'black',     name: 'Qora teri',     price: 90,  base: '#2b2b30', shade: '#141417', cuff: '#3a3a40', accent: '#8d8d96', pattern: 'stitch' },
    { id: 'red',       name: 'Qizil',         price: 90,  base: '#c8283a', shade: '#8e1624', cuff: '#f2ece0', accent: '#ff8a96', pattern: 'plain' },
    { id: 'blue',      name: "Ko'k",          price: 90,  base: '#2f6fd6', shade: '#1c4796', cuff: '#f2ece0', accent: '#9cc1ff', pattern: 'plain' },
    { id: 'green',     name: 'Yashil',        price: 90,  base: '#2f9e5c', shade: '#1d6a3c', cuff: '#f2ece0', accent: '#9ff0c0', pattern: 'plain' },
    { id: 'stripes',   name: "Yo'l-yo'l",     price: 130, base: '#f2ece0', shade: '#c9c1ad', cuff: '#c8283a', accent: '#c8283a', pattern: 'stripes' },
    { id: 'polka',     name: 'Nuqtali',       price: 130, base: '#ff9ecb', shade: '#d66a9c', cuff: '#ffffff', accent: '#ffffff', pattern: 'dots' },
    { id: 'hearts',    name: 'Yurakchali',    price: 160, base: '#ffd1dc', shade: '#e39aad', cuff: '#e0294a', accent: '#e0294a', pattern: 'hearts' },
    { id: 'stars',     name: 'Yulduzli',      price: 160, base: '#1d2b5c', shade: '#101838', cuff: '#e2b64a', accent: '#ffe38a', pattern: 'stars' },
    { id: 'boxer',     name: 'Bokschi',       price: 200, base: '#d42a2a', shade: '#8f1515', cuff: '#ffffff', accent: '#ffffff', pattern: 'knuckle' },
    { id: 'biker',     name: 'Baykerchi',     price: 220, base: '#3a3a40', shade: '#1b1b1f', cuff: '#1b1b1f', accent: '#c0c6cf', pattern: 'fingerless' },
    { id: 'ganch',     name: 'Ganch naqshli', price: 240, base: '#1d5c4f', shade: '#0e3a31', cuff: '#e2b64a', accent: '#e2b64a', pattern: 'ganch' },
    { id: 'atlas',     name: 'Atlas',         price: 260, base: '#d6245c', shade: '#8a1a4a', cuff: '#ffd23f', accent: '#1f7fb3', pattern: 'atlas' },
    { id: 'camo',      name: 'Kamuflyaj',     price: 260, base: '#6b7b3a', shade: '#46521f', cuff: '#3b3f22', accent: '#a39a5c', pattern: 'camo' },
    { id: 'checker',   name: 'Shaxmat',       price: 260, base: '#f2ece0', shade: '#bdb6a6', cuff: '#141414', accent: '#141414', pattern: 'checker' },
    { id: 'zebra',     name: 'Zebra',         price: 300, base: '#f7f7f7', shade: '#cfcfcf', cuff: '#141414', accent: '#141414', pattern: 'zebra' },
    { id: 'leopard',   name: 'Qoplon',        price: 320, base: '#e7b35a', shade: '#b07e2c', cuff: '#3a2a12', accent: '#3a2a12', pattern: 'leopard' },
    { id: 'flames',    name: 'Olovli',        price: 380, base: '#222226', shade: '#101012', cuff: '#ff6a00', accent: '#ffb300', pattern: 'flames' },
    { id: 'bolt',      name: 'Chaqmoq',       price: 380, base: '#1b1f3a', shade: '#0c0f22', cuff: '#ffe600', accent: '#ffe600', pattern: 'bolt' },
    { id: 'ice',       name: 'Muz',           price: 420, base: '#bfe9ff', shade: '#79c2ea', cuff: '#ffffff', accent: '#ffffff', pattern: 'ice' },
    { id: 'skeleton',  name: 'Skelet',        price: 450, base: '#18181c', shade: '#08080a', cuff: '#2a2a30', accent: '#f2f2f2', pattern: 'skeleton' },
    { id: 'rainbow',   name: 'Kamalak',       price: 520, base: '#ff5a5a', shade: '#b83a3a', cuff: '#ffffff', accent: '#ffffff', pattern: 'rainbow' },
    { id: 'dragon',    name: 'Ajdar',         price: 650, base: '#1f7a4a', shade: '#0f4a2b', cuff: '#c9a227', accent: '#7ff0b0', pattern: 'scales' },
    { id: 'galaxy',    name: 'Galaktika',     price: 800, base: '#2a1650', shade: '#140a2c', cuff: '#7a4fff', accent: '#ffffff', pattern: 'galaxy' },
    { id: 'goldglove', name: 'Oltin',         price: 1000,base: '#f1c84b', shade: '#b8860b', cuff: '#7b1420', accent: '#fff4c2', pattern: 'shine' },
    { id: 'diamond',   name: 'Brilliant',     price: 1500,base: '#dfeeff', shade: '#9fbde8', cuff: '#3f6fe0', accent: '#ffffff', pattern: 'gems' },
  ];

  /* --- Sovg'alar: sotib olinadi (dona), bitta yuborilsa 1 ta kamayadi --- */
  // sfx — sfx.js dagi tovush retsepti, say — ovoz chiqarib aytiladigan so'z
  const GIFTS = [
    { id: 'heart',     emoji: '❤️', name: 'Qizil yurak', price: 10,  pop: 2,   say: 'I love you!',          sfx: 'heartbeat', pitch: 1.1 },
    { id: 'rose',      emoji: '🌹', name: 'Atirgul',     price: 15,  pop: 3,   say: 'A rose for you!',       sfx: 'chime' },
    { id: 'kiss',      emoji: '💋', name: "O'pich",      price: 12,  pop: 2,   say: 'Mwah!',                 sfx: 'kiss', pitch: 1.4 },
    { id: 'apple',     emoji: '🍎', name: 'Olma',        price: 5,   pop: 1,   say: 'Crunchy apple!',        sfx: 'crunch' },
    { id: 'watermelon',emoji: '🍉', name: 'Tarvuz',      price: 8,   pop: 1,   say: 'Yummy watermelon!',     sfx: 'slurp' },
    { id: 'grapes',    emoji: '🍇', name: 'Uzum',        price: 6,   pop: 1,   say: 'Sweet grapes!',         sfx: 'pop' },
    { id: 'lemon',     emoji: '🍋', name: 'Limon',       price: 5,   pop: 1,   say: 'So sour!',              sfx: 'sour', pitch: 1.3 },
    { id: 'banana',    emoji: '🍌', name: 'Banan',       price: 6,   pop: 1,   say: 'Banana!',               sfx: 'boing' },
    { id: 'peach',     emoji: '🍑', name: 'Shaftoli',    price: 6,   pop: 1,   say: 'Juicy peach!',          sfx: 'slurp' },
    { id: 'bread',     emoji: '🥖', name: 'Non',         price: 7,   pop: 1,   say: 'Fresh bread for you!',  sfx: 'crunch' },
    { id: 'tea',       emoji: '🍵', name: 'Choy',        price: 8,   pop: 1,   say: "Let's have some tea.",  sfx: 'pour' },
    { id: 'choco',     emoji: '🍫', name: 'Shokolad',    price: 12,  pop: 2,   say: 'Chocolate for you!',    sfx: 'chime' },
    { id: 'tulip',     emoji: '🌷', name: 'Lola',        price: 14,  pop: 3,   say: 'Spring is here!',       sfx: 'chime' },
    { id: 'bouquet',   emoji: '💐', name: 'Guldasta',    price: 30,  pop: 6,   say: 'Flowers for you!',      sfx: 'sparkle' },
    { id: 'teddy',     emoji: '🧸', name: 'Ayiqcha',     price: 35,  pop: 7,   say: 'Big hug!',              sfx: 'boing', pitch: 1.3 },
    { id: 'cake',      emoji: '🎂', name: 'Tort',        price: 40,  pop: 8,   say: 'Happy birthday!',       sfx: 'birthday' },
    { id: 'star',      emoji: '⭐', name: 'Yulduz',      price: 45,  pop: 9,   say: "You're a star!",        sfx: 'sparkle' },
    { id: 'fireworks', emoji: '🎆', name: 'Salyut',      price: 60,  pop: 12,  say: 'Celebration!',          sfx: 'fireworks' },
    { id: 'trophy',    emoji: '🏆', name: 'Kubok',       price: 80,  pop: 16,  say: 'Champion!',             sfx: 'fanfare' },
    { id: 'gem',       emoji: '💎', name: 'Olmos',       price: 100, pop: 20,  say: 'Shine bright!',         sfx: 'sparkle' },
    { id: 'crown',     emoji: '👑', name: 'Toj',         price: 150, pop: 30,  say: 'All hail the king!',    sfx: 'fanfare' },
    { id: 'car',       emoji: '🚗', name: 'Mashina',     price: 200, pop: 40,  say: 'Beep beep! Nice car!',  sfx: 'horn' },
    { id: 'ring',      emoji: '💍', name: 'Uzuk',        price: 300, pop: 60,  say: 'Will you marry me?',    sfx: 'sparkle', pitch: 1.1 },
  ];

  /* --- Stikerlar: bir marta sotib olinadi, cheksiz ishlatiladi --- */
  const STICKERS = [
    { id: 'like',    emoji: '👍', name: 'Zo\'r',        price: 0,   say: 'Nice move!',        sfx: 'ding' },
    { id: 'dislike', emoji: '👎', name: 'Yomon',        price: 0,   say: 'Boooo!',            sfx: 'boo' },
    { id: 'laugh',   emoji: '😂', name: 'Kulgi',        price: 0,   say: 'Ha ha ha ha!',      sfx: 'laugh', pitch: 1.2 },
    { id: 'angry',   emoji: '😡', name: 'Jahl',         price: 0,   say: 'Grrrr!',            sfx: 'buzz', pitch: 0.7 },
    { id: 'clap',    emoji: '👏', name: 'Qarsak',       price: 0,   say: 'Bravo!',            sfx: 'applause' },
    { id: 'cry',     emoji: '😭', name: "Yig'i",        price: 0,   say: 'Noooo!',            sfx: 'sad', pitch: 1.2 },
    { id: 'think',   emoji: '🤔', name: "O'ylash",      price: 0,   say: 'Hmmm...',           sfx: 'hmm', pitch: 0.8 },
    { id: 'cool',    emoji: '😎', name: 'Salqin',       price: 0,   say: 'Too cool!',         sfx: 'cool' },
    { id: 'goat',    emoji: '🐐', name: 'Kozol!',       price: 40,  say: 'Meeeeh!',           sfx: 'bleat', pitch: 1.5 },
    { id: 'fire',    emoji: '🔥', name: 'Olov',         price: 40,  say: "I'm on fire!",      sfx: 'whoosh' },
    { id: 'gg',      emoji: '🤝', name: 'Yaxshi o\'yin',price: 40,  say: 'Good game!',        sfx: 'ding' },
    { id: 'shock',   emoji: '😱', name: 'Dahshat',      price: 50,  say: 'Oh my god!',        sfx: 'shock', pitch: 1.3 },
    { id: 'sleep',   emoji: '😴', name: 'Uyqu',         price: 50,  say: 'Hurry up, please.', sfx: 'snore', pitch: 0.8 },
    { id: 'please',  emoji: '🙏', name: 'Iltimos',      price: 50,  say: 'Please!',           sfx: 'chime' },
    { id: 'kisses',  emoji: '😘', name: "O'pay",        price: 60,  say: 'Kiss kiss!',        sfx: 'kiss', pitch: 1.4 },
    { id: 'strong',  emoji: '💪', name: 'Kuchli',       price: 60,  say: 'Strong!',           sfx: 'drum', pitch: 0.8 },
    { id: 'party',   emoji: '🎉', name: 'Bayram',       price: 60,  say: 'Party time!',       sfx: 'fireworks' },
    { id: 'shh',     emoji: '🤫', name: 'Jim',          price: 60,  say: 'Shhhh!',            sfx: 'shh' },
    { id: 'bye',     emoji: '👋', name: 'Xayr',         price: 60,  say: 'Bye bye!',          sfx: 'ding' },
    { id: 'cold',    emoji: '🥶', name: 'Muzlab',       price: 70,  say: 'Freezing!',         sfx: 'brr', pitch: 1.2 },
    { id: 'clown',   emoji: '🤡', name: 'Masxaraboz',   price: 70,  say: 'Clown!',            sfx: 'horn', pitch: 1.4 },
    { id: 'poop',    emoji: '💩', name: 'Voy',          price: 70,  say: 'Oops!',             sfx: 'fart', pitch: 1.2 },
    { id: 'rooster', emoji: '🐓', name: "Xo'roz",       price: 80,  say: 'Cock-a-doodle-doo!',sfx: 'rooster', pitch: 1.3 },
    { id: 'money',   emoji: '🤑', name: 'Pul',          price: 80,  say: 'Money money!',      sfx: 'coins' },
    { id: 'brain',   emoji: '🧠', name: 'Aqlli',        price: 90,  say: 'Big brain move!',   sfx: 'sparkle' },
    { id: 'luck',    emoji: '🍀', name: 'Omad',         price: 90,  say: 'Good luck!',        sfx: 'chime' },
    { id: 'rocket',  emoji: '🚀', name: 'Raketa',       price: 120, say: 'To the moon!',      sfx: 'whoosh' },
    { id: 'skull',   emoji: '💀', name: "O'ldim",       price: 120, say: "I'm dead!",         sfx: 'sad', pitch: 0.7 },
  ];

  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  const SKIN = byId(SKINS), GLOVE = byId(GLOVES), GIFT = byId(GIFTS), STICKER = byId(STICKERS);

  const REGIONS = [
    '', 'Toshkent', 'Toshkent viloyati', 'Andijon', 'Buxoro', "Farg'ona", 'Jizzax', 'Xorazm',
    'Namangan', 'Navoiy', 'Qashqadaryo', 'Qoraqalpog\'iston', 'Samarqand', 'Sirdaryo',
    'Surxondaryo', 'Chet elda',
  ];

  return {
    SUITS, SUIT_UZ, SUIT_CHAR, RANKS, POWER, VALUE,
    rankOf, suitOf, powOf, valOf, sumValue, label,
    beats, matchBeat, beatsAll, combos, beatingSets,
    LP_PER_LEVEL, MAX_LEVEL, winLp, lossLp, applyLp, TIERS, tierOf, tierById,
    REWARD, levelUpCoins,
    SKINS, GLOVES, GIFTS, STICKERS, SKIN, GLOVE, GIFT, STICKER, REGIONS,
  };
});

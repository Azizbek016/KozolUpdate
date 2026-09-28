'use strict';
/* ============================================================
   lib/accounts.js — o'yinchi hisoblari
   ------------------------------------------------------------
   * Hisoblar server xotirasida + data/accounts.json faylida.
   * Bepul hostingda (Render free) disk qayta ishga tushganda
     tozalanadi. Shuning uchun har bir o'yinchiga IMZOLANGAN
     nusxa (snapshot) beriladi va brauzerda saqlanadi. Server
     hisobni topa olmasa — nusxadan tiklaydi. Imzo (HMAC) tufayli
     tangalarni qo'lda o'zgartirib bo'lmaydi.
   * KOZOL_SECRET muhit o'zgaruvchisi doimiy bo'lishi kerak
     (render.yaml da avtomatik yaratiladi).
   ============================================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const K = require('../public/shared.js');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'accounts.json');
const AVATAR_COUNT = 12;
const MAX_AVATAR_CHARS = 80000;
const MAX_RECENT = 20;
const MAX_FRIENDS = 200;

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* e'tiborsiz */ }

/* ---------- Maxfiy kalit ---------- */
function loadSecret() {
  if (process.env.KOZOL_SECRET) return process.env.KOZOL_SECRET;
  const f = path.join(DATA_DIR, 'secret.txt');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) { /* yo'q */ }
  const s = crypto.randomBytes(32).toString('hex');
  try { fs.writeFileSync(f, s); } catch (e) { /* yozib bo'lmadi */ }
  return s;
}
const SECRET = loadSecret();

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');

/* ---------- Saqlash ---------- */
const accounts = new Map();

(function load() {
  try {
    const arr = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    for (const a of arr) if (a && a.id) accounts.set(a.id, normalize(a));
    console.log(`  Hisoblar yuklandi: ${accounts.size}`);
  } catch (e) { /* birinchi ishga tushirish */ }
})();

let saveTimer = null;
function markDirty() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = FILE + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(Array.from(accounts.values())));
      fs.renameSync(tmp, FILE);
    } catch (e) { console.error('Saqlashda xato:', e.message); }
  }, 2000);
}
function flushSync() {
  if (!saveTimer) return;
  clearTimeout(saveTimer); saveTimer = null;
  try { fs.writeFileSync(FILE, JSON.stringify(Array.from(accounts.values()))); } catch (e) { /* */ }
}

/* ---------- Yordamchi ---------- */
const today = () => {
  // Toshkent vaqti (UTC+5) bo'yicha sana
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function newId() {
  let id;
  do { id = String(rnd(10000000, 99999999)); } while (accounts.has(id));
  return id;
}

function cleanName(name, fallback) {
  const n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return n || fallback;
}
function cleanText(t, max) {
  return String(t || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanAvatar(av, fallback) {
  const v = String(av || '');
  if (/^p\d{1,2}$/.test(v)) {
    const i = parseInt(v.slice(1), 10);
    if (i >= 0 && i < AVATAR_COUNT) return v;
  }
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= MAX_AVATAR_CHARS) return v;
  return fallback || ('p' + Math.floor(Math.random() * AVATAR_COUNT));
}

function blank(id, secretHash) {
  return {
    id,
    secretHash,
    name: '',
    avatar: 'p' + Math.floor(Math.random() * AVATAR_COUNT),
    bio: '',
    region: '',
    favSuit: '',
    frame: 'auto',
    createdAt: Date.now(),
    lastSeen: Date.now(),
    level: 1,
    lp: 0,
    coins: K.REWARD.START_COINS,
    lastDaily: '',
    popularity: 0,
    stats: {
      games: 0, wins: 0, losses: 0, quits: 0, streak: 0, bestStreak: 0,
      roundsWon: 0, roundsLost: 0, kozolGiven: 0, sofKozol: 0, kozolTaken: 0,
      giftsSent: 0,
    },
    inv: { skins: ['classic'], gloves: ['bare'], stickers: [], gifts: {} },
    equip: { skin: 'classic', glove: 'bare' },
    giftsGot: {},
    friends: [],
    reqIn: [],
    reqOut: [],
    recent: [],
    privacy: { friendReq: true, invites: true },
  };
}

/** Tashqaridan kelgan (nusxadan tiklangan) ma'lumotni to'g'ri shaklga keltirish */
function normalize(a) {
  const b = blank(String(a.id), String(a.secretHash || ''));
  const out = Object.assign(b, {
    name: cleanName(a.name, ''),
    avatar: cleanAvatar(a.avatar, b.avatar),
    bio: cleanText(a.bio, 80),
    region: K.REGIONS.includes(a.region) ? a.region : '',
    favSuit: K.SUITS.includes(a.favSuit) ? a.favSuit : '',
    frame: typeof a.frame === 'string' ? a.frame : 'auto',
    createdAt: Number(a.createdAt) || Date.now(),
    lastSeen: Number(a.lastSeen) || Date.now(),
    level: Math.max(1, Math.min(K.MAX_LEVEL, Number(a.level) || 1)),
    lp: Math.max(0, Math.min(K.LP_PER_LEVEL - 1, Number(a.lp) || 0)),
    coins: Math.max(0, Math.floor(Number(a.coins) || 0)),
    lastDaily: String(a.lastDaily || ''),
    popularity: Math.max(0, Number(a.popularity) || 0),
  });
  if (a.stats && typeof a.stats === 'object') {
    for (const k of Object.keys(out.stats)) out.stats[k] = Math.max(0, Number(a.stats[k]) || 0);
  }
  const inv = a.inv || {};
  out.inv.skins = uniq(['classic'].concat((inv.skins || []).filter((x) => K.SKIN[x])));
  out.inv.gloves = uniq(['bare'].concat((inv.gloves || []).filter((x) => K.GLOVE[x])));
  out.inv.stickers = uniq((inv.stickers || []).filter((x) => K.STICKER[x]));
  out.inv.gifts = {};
  for (const [k, v] of Object.entries(inv.gifts || {})) {
    if (K.GIFT[k] && v > 0) out.inv.gifts[k] = Math.min(9999, Math.floor(v));
  }
  const eq = a.equip || {};
  out.equip.skin = out.inv.skins.includes(eq.skin) ? eq.skin : 'classic';
  out.equip.glove = out.inv.gloves.includes(eq.glove) ? eq.glove : 'bare';
  for (const [k, v] of Object.entries(a.giftsGot || {})) if (K.GIFT[k]) out.giftsGot[k] = Math.max(0, Math.floor(v));
  const ids = (x) => uniq((Array.isArray(x) ? x : []).map(String).filter((s) => /^\d{8}$/.test(s)));
  out.friends = ids(a.friends).slice(0, MAX_FRIENDS);
  out.reqIn = ids(a.reqIn).slice(0, 50);
  out.reqOut = ids(a.reqOut).slice(0, 50);
  out.recent = (Array.isArray(a.recent) ? a.recent : [])
    .filter((r) => r && /^\d{8}$/.test(String(r.id)))
    .map((r) => ({ id: String(r.id), t: Number(r.t) || 0 }))
    .slice(0, MAX_RECENT);
  if (a.privacy) {
    out.privacy.friendReq = a.privacy.friendReq !== false;
    out.privacy.invites = a.privacy.invites !== false;
  }
  return out;
}
const uniq = (arr) => Array.from(new Set(arr));

/* ---------- Imzolangan nusxa ---------- */
function snapshot(acc) {
  const body = Buffer.from(JSON.stringify(acc), 'utf8').toString('base64url');
  return body + '.' + hmac(body);
}
function fromSnapshot(snap) {
  if (typeof snap !== 'string' || snap.length > 400000) return null;
  const i = snap.lastIndexOf('.');
  if (i < 0) return null;
  const body = snap.slice(0, i);
  const sig = snap.slice(i + 1);
  const good = hmac(body);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
}

/* ---------- Kirish ---------- */
/**
 * {id, secret, snap} bilan kirish.
 * Qaytaradi: { acc, secret?, created, restored }
 */
function auth(creds) {
  const id = creds && String(creds.id || '');
  const secret = creds && String(creds.secret || '');
  if (/^\d{8}$/.test(id) && secret.length >= 16) {
    const h = sha(secret);
    const acc = accounts.get(id);
    if (acc) {
      if (acc.secretHash === h) { acc.lastSeen = Date.now(); return { acc, created: false, restored: false }; }
    } else if (creds.snap) {
      const data = fromSnapshot(creds.snap);
      if (data && String(data.id) === id && data.secretHash === h) {
        const restored = normalize(data);
        accounts.set(id, restored);
        markDirty();
        return { acc: restored, created: false, restored: true };
      }
    }
  }
  // Yangi hisob
  const newSecret = crypto.randomBytes(24).toString('base64url');
  const acc = blank(newId(), sha(newSecret));
  accounts.set(acc.id, acc);
  markDirty();
  return { acc, secret: newSecret, created: true, restored: false };
}

const get = (id) => accounts.get(String(id)) || null;

/* ---------- Ko'rinishlar ---------- */
function frameOf(acc) {
  const tier = K.tierOf(acc.level);
  if (acc.frame === 'none') return 'none';
  if (acc.frame && acc.frame !== 'auto') {
    const t = K.tierById(acc.frame);
    if (t && acc.level >= t.min) return t.id;
  }
  return tier.id;
}

/** Boshqalarga ko'rinadigan qisqa ma'lumot (ro'yxatlar uchun) */
function brief(acc) {
  if (!acc) return null;
  return {
    id: acc.id, name: acc.name || "O'yinchi", avatar: acc.avatar,
    level: acc.level, frame: frameOf(acc),
  };
}

/** Profil kartochkasi (PUBG uslubida) */
function publicProfile(acc) {
  if (!acc) return null;
  const s = acc.stats;
  const topGifts = Object.entries(acc.giftsGot)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([id, n]) => ({ id, n }));
  return {
    ...brief(acc),
    bio: acc.bio, region: acc.region, favSuit: acc.favSuit,
    lp: acc.lp, tier: K.tierOf(acc.level).id,
    createdAt: acc.createdAt, lastSeen: acc.lastSeen,
    popularity: acc.popularity,
    stats: {
      games: s.games, wins: s.wins, losses: s.losses, quits: s.quits,
      winRate: s.games ? Math.round((s.wins / s.games) * 100) : 0,
      bestStreak: s.bestStreak, streak: s.streak,
      kozolGiven: s.kozolGiven, sofKozol: s.sofKozol, kozolTaken: s.kozolTaken,
      roundsWon: s.roundsWon, giftsSent: s.giftsSent,
    },
    equip: { ...acc.equip },
    friendsCount: acc.friends.length,
    topGifts,
  };
}

/** O'yinchining o'ziga to'liq ma'lumot */
function selfView(acc) {
  return {
    ...publicProfile(acc),
    name: acc.name,                 // bo'sh bo'lsa — mijoz ism so'raydi
    frameChoice: acc.frame,
    coins: acc.coins,
    inv: acc.inv,
    privacy: acc.privacy,
    dailyReady: acc.lastDaily !== today(),
    reqIn: acc.reqIn.length,
    next: { win: K.winLp(acc.level), loss: K.lossLp(acc.level) },
  };
}

/* ---------- Profil tahrirlash ---------- */
function updateProfile(acc, p) {
  if (!p || typeof p !== 'object') return;
  if ('name' in p) acc.name = cleanName(p.name, acc.name || "O'yinchi");
  if ('avatar' in p) acc.avatar = cleanAvatar(p.avatar, acc.avatar);
  if ('bio' in p) acc.bio = cleanText(p.bio, 80);
  if ('region' in p && K.REGIONS.includes(p.region)) acc.region = p.region;
  if ('favSuit' in p && (p.favSuit === '' || K.SUITS.includes(p.favSuit))) acc.favSuit = p.favSuit;
  if ('frame' in p) {
    const f = String(p.frame);
    if (f === 'auto' || f === 'none') acc.frame = f;
    else {
      const t = K.tierById(f);
      if (t && acc.level >= t.min) acc.frame = f;
    }
  }
  if (p.privacy && typeof p.privacy === 'object') {
    acc.privacy.friendReq = p.privacy.friendReq !== false;
    acc.privacy.invites = p.privacy.invites !== false;
  }
  markDirty();
}

/* ---------- Iqtisod ---------- */
function claimDaily(acc) {
  const d = today();
  if (acc.lastDaily === d) return { ok: false, msg: 'Bugungi bonus olingan. Ertaga qayting!' };
  acc.lastDaily = d;
  acc.coins += K.REWARD.DAILY;
  markDirty();
  return { ok: true, coins: K.REWARD.DAILY };
}

function buy(acc, kind, id, qty) {
  qty = Math.max(1, Math.min(50, Math.floor(Number(qty) || 1)));
  let item, price;
  if (kind === 'skin') item = K.SKIN[id];
  else if (kind === 'glove') item = K.GLOVE[id];
  else if (kind === 'sticker') item = K.STICKER[id];
  else if (kind === 'gift') item = K.GIFT[id];
  if (!item) return { ok: false, msg: 'Bunday narsa yo\'q.' };

  if (kind === 'gift') {
    price = item.price * qty;
  } else {
    const list = kind === 'skin' ? acc.inv.skins : kind === 'glove' ? acc.inv.gloves : acc.inv.stickers;
    if (list.includes(id) || item.price === 0) return { ok: false, msg: 'Bu sizda allaqachon bor.' };
    price = item.price;
    qty = 1;
  }
  if (acc.coins < price) return { ok: false, msg: `Tanga yetmaydi: ${price} kerak, sizda ${acc.coins}.` };
  acc.coins -= price;
  if (kind === 'gift') acc.inv.gifts[id] = (acc.inv.gifts[id] || 0) + qty;
  else if (kind === 'skin') acc.inv.skins.push(id);
  else if (kind === 'glove') acc.inv.gloves.push(id);
  else acc.inv.stickers.push(id);
  markDirty();
  return { ok: true, spent: price, qty };
}

function equip(acc, kind, id) {
  if (kind === 'skin' && acc.inv.skins.includes(id)) acc.equip.skin = id;
  else if (kind === 'glove' && acc.inv.gloves.includes(id)) acc.equip.glove = id;
  else return false;
  markDirty();
  return true;
}

function hasSticker(acc, id) {
  const st = K.STICKER[id];
  return !!st && (st.price === 0 || acc.inv.stickers.includes(id));
}

/** Sovg'a yuborish: yuboruvchidan 1 dona kamayadi, oluvchiga mashhurlik qo'shiladi */
function sendGift(from, to, id) {
  const g = K.GIFT[id];
  if (!g) return { ok: false, msg: 'Bunday sovg\'a yo\'q.' };
  if ((from.inv.gifts[id] || 0) < 1) return { ok: false, msg: `${g.name} qolmagan — do'kondan oling.` };
  from.inv.gifts[id] -= 1;
  if (from.inv.gifts[id] <= 0) delete from.inv.gifts[id];
  from.stats.giftsSent += 1;
  if (to && to !== from) {
    to.popularity += g.pop;
    to.giftsGot[id] = (to.giftsGot[id] || 0) + 1;
  }
  markDirty();
  return { ok: true, gift: g };
}

/* ---------- O'yin natijalari ---------- */
/**
 * Match yakunida chaqiriladi.
 * opts: { won, vsBots, sofBonus }
 */
function applyMatch(acc, opts) {
  const before = { level: acc.level, lp: acc.lp, coins: acc.coins };
  const factor = opts.vsBots ? K.REWARD.BOT_FACTOR : 1;
  let lpDelta, coins;
  if (opts.won) {
    lpDelta = Math.max(1, Math.round((K.winLp(acc.level) + (opts.sofBonus || 0) * K.REWARD.SOF_BONUS_LP) * factor));
    coins = Math.max(1, Math.round(rnd(K.REWARD.WIN[0], K.REWARD.WIN[1]) * factor));
    acc.stats.wins += 1;
    acc.stats.streak += 1;
    acc.stats.bestStreak = Math.max(acc.stats.bestStreak, acc.stats.streak);
  } else {
    lpDelta = -K.lossLp(acc.level);
    coins = Math.max(1, Math.round(rnd(K.REWARD.LOSS[0], K.REWARD.LOSS[1]) * factor));
    acc.stats.losses += 1;
    acc.stats.streak = 0;
  }
  acc.stats.games += 1;
  const r = K.applyLp(acc.level, acc.lp, lpDelta);
  let bonus = 0;
  for (let L = acc.level + 1; L <= r.level; L++) bonus += K.levelUpCoins(L);
  acc.level = r.level;
  acc.lp = r.lp;
  acc.coins += coins + bonus;
  markDirty();
  return {
    won: !!opts.won, vsBots: !!opts.vsBots,
    lpDelta, coins, levelBonus: bonus,
    before, after: { level: acc.level, lp: acc.lp, coins: acc.coins },
    ups: r.ups,
  };
}

/** O'yinni to'liq tark etgani uchun jarima */
function applyQuit(acc) {
  const lpDelta = -K.lossLp(acc.level) * K.REWARD.QUIT_FACTOR;
  const r = K.applyLp(acc.level, acc.lp, lpDelta);
  acc.level = r.level;
  acc.lp = r.lp;
  acc.stats.games += 1;
  acc.stats.losses += 1;
  acc.stats.quits += 1;
  acc.stats.streak = 0;
  markDirty();
  return { lpDelta };
}

function addRecent(acc, otherIds) {
  const now = Date.now();
  for (const id of otherIds) {
    if (!id || id === acc.id) continue;
    acc.recent = acc.recent.filter((r) => r.id !== id);
    acc.recent.unshift({ id, t: now });
  }
  acc.recent = acc.recent.slice(0, MAX_RECENT);
  markDirty();
}

/* ---------- Do'stlar ---------- */
function friendRequest(from, to) {
  if (!to) return { ok: false, msg: 'Bunday ID li o\'yinchi topilmadi.' };
  if (from.id === to.id) return { ok: false, msg: 'O\'zingizni qo\'sha olmaysiz 🙂' };
  if (from.friends.includes(to.id)) return { ok: false, msg: 'U allaqachon do\'stingiz.' };
  if (from.friends.length >= MAX_FRIENDS) return { ok: false, msg: 'Do\'stlar ro\'yxati to\'lgan.' };
  // U sizga avval so'rov yuborgan bo'lsa — darhol do'st bo'lasiz
  if (from.reqIn.includes(to.id)) return friendAccept(from, to);
  if (!to.privacy.friendReq) return { ok: false, msg: 'Bu o\'yinchi do\'stlik so\'rovlarini qabul qilmaydi.' };
  if (from.reqOut.includes(to.id)) return { ok: false, msg: 'So\'rov allaqachon yuborilgan.' };
  from.reqOut.push(to.id);
  if (!to.reqIn.includes(from.id)) to.reqIn.unshift(from.id);
  to.reqIn = to.reqIn.slice(0, 50);
  markDirty();
  return { ok: true, pending: true };
}

function friendAccept(me, other) {
  if (!other) return { ok: false, msg: 'O\'yinchi topilmadi.' };
  me.reqIn = me.reqIn.filter((x) => x !== other.id);
  me.reqOut = me.reqOut.filter((x) => x !== other.id);
  other.reqIn = other.reqIn.filter((x) => x !== me.id);
  other.reqOut = other.reqOut.filter((x) => x !== me.id);
  if (!me.friends.includes(other.id)) me.friends.unshift(other.id);
  if (!other.friends.includes(me.id)) other.friends.unshift(me.id);
  markDirty();
  return { ok: true, accepted: true };
}

function friendDecline(me, otherId) {
  me.reqIn = me.reqIn.filter((x) => x !== otherId);
  const other = get(otherId);
  if (other) other.reqOut = other.reqOut.filter((x) => x !== me.id);
  markDirty();
  return { ok: true };
}

function friendRemove(me, otherId) {
  me.friends = me.friends.filter((x) => x !== otherId);
  me.reqOut = me.reqOut.filter((x) => x !== otherId);
  const other = get(otherId);
  if (other) {
    other.friends = other.friends.filter((x) => x !== me.id);
    other.reqIn = other.reqIn.filter((x) => x !== me.id);
  }
  markDirty();
  return { ok: true };
}

module.exports = {
  auth, get, snapshot, fromSnapshot, brief, publicProfile, selfView, frameOf,
  updateProfile, claimDaily, buy, equip, hasSticker, sendGift,
  applyMatch, applyQuit, addRecent,
  friendRequest, friendAccept, friendDecline, friendRemove,
  cleanName, cleanText, cleanAvatar, markDirty, flushSync, today,
  _accounts: accounts,
};

'use strict';
/* ============================================================
   O'ZBEK KOZOL (ZOT) — SERVER
   Node.js + Express + Socket.io
   Ishga tushirish:  npm install  &&  npm start

   BO'LIMLAR
     1. Sozlash va HTTP
     2. Karta qoidalari (public/shared.js dan)
     3. Onlayn o'yinchilar (presence)
     4. Xonalar
     5. Holatni yuborish
     6. Qonuniy yurishlar
     7. O'yin oqimi
     8. Mukofotlar (level, tanga)
     9. Bot
    10. Socket hodisalari
   ============================================================ */

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const K = require('./public/shared.js');
const A = require('./lib/accounts.js');

/* ============================================================
   1. SOZLASH VA HTTP
   ============================================================ */
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingTimeout: 25000, maxHttpBufferSize: 1e6 });

app.get('/ping', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({
    ok: true,
    xonalar: rooms.size,
    onlayn: online.size,
    ishlagan_vaqt: Math.round(process.uptime()) + 's',
  });
});

/**
 * Ovozli chat uchun ICE serverlar.
 * TURN (ixtiyoriy) — ba'zi mobil tarmoqlarda to'g'ridan-to'g'ri ulanish
 * ishlamasa kerak bo'ladi: TURN_URL, TURN_USER, TURN_PASS muhit o'zgaruvchilari.
 */
app.get('/config', (req, res) => {
  const ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) {
    ice.push({
      urls: process.env.TURN_URL.split(',').map((s) => s.trim()),
      username: process.env.TURN_USER || '',
      credential: process.env.TURN_PASS || '',
    });
  }
  res.json({ ice });
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

/* ============================================================
   2. KARTA QOIDALARI
   ============================================================ */
const { suitOf, rankOf, valOf, powOf, beats, beatsAll, beatingSets, sumValue, SUIT_UZ } = K;
const HAND_SIZE = 4;

function buildDeck() {
  const d = [];
  for (const s of K.SUITS) for (const r of K.RANKS) d.push(r + s);
  return d; // 36 karta
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   3. ONLAYN O'YINCHILAR
   ============================================================ */
const online = new Map();      // accId -> Set(socketId)
const socketAcc = new Map();   // socketId -> accId

function sidsOf(accId) { return online.get(accId) || new Set(); }
function isOnline(accId) { return sidsOf(accId).size > 0; }
function toAcc(accId, event, payload) {
  for (const sid of sidsOf(accId)) io.to(sid).emit(event, payload);
}

// Imzolangan nusxani tez-tez yubormaslik uchun (u 100 KB gacha bo'lishi mumkin)
const snapTimers = new Map();
function pushMe(acc) {
  if (!acc) return;
  toAcc(acc.id, 'me', A.selfView(acc));
  if (snapTimers.has(acc.id)) return;
  snapTimers.set(acc.id, setTimeout(() => {
    snapTimers.delete(acc.id);
    toAcc(acc.id, 'snap', A.snapshot(acc));
  }, 1500));
}

/* ============================================================
   4. XONALAR
   ============================================================ */
const rooms = new Map();
const BOT_NAMES = ['Bek', 'Sardor', 'Alisher', 'Rustam', 'Otabek', 'Shoxrux', 'Anvar', 'Dilshod', 'Umid', 'Farrux'];
const ACTIVE_PHASES = new Set(['coinflip', 'playing', 'roundEnd']);

function newCode() {
  let c;
  do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(c));
  return c;
}

function createRoom({ mode, target, isPublic, name }) {
  const code = newCode();
  const room = {
    code,
    name: A.cleanText(name, 24),
    isPublic: !!isPublic,
    mode,                      // 2 yoki 4
    target: [-6, -12, -16, -24].includes(target) ? target : -12,
    phase: 'lobby',            // lobby | coinflip | playing | roundEnd | matchEnd
    seats: new Array(mode).fill(null),
    hostSeat: 0,
    deck: [], trumpCard: null, trump: null,
    hands: {}, trick: null, leader: 0, turn: 0,
    vault: [[], []], roundPoints: [0, 0], matchScore: [0, 0],
    sofCount: [0, 0],
    round: 0,
    log: [], chat: [],
    timers: [], dropTimer: null,
    voice: new Map(),          // socketId -> seat
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

const teamOf = (seat) => seat % 2;                 // 0,2 -> 1-jamoa | 1,3 -> 2-jamoa
const nextSeat = (room, seat) => (seat + 1) % room.mode;
const onlineHumans = (room) => room.seats.filter((p) => p && p.accId && p.connected).length;
const seatOfSid = (room, sid) => room.seats.findIndex((p) => p && p.sid === sid);
const seatOfAcc = (room, accId) => room.seats.findIndex((p) => p && p.accId === accId && !p.quit);
/** Yangi odam egallashi mumkin bo'lgan o'rin: bo'sh, yoki bot (egasi qaytmaydigan) */
const takeable = (p) => !p || (p.bot && (p.filler || p.quit));

function pushLog(room, text) {
  room.log.push(text);
  if (room.log.length > 60) room.log.shift();
}
function clearTimers(room) {
  room.timers.forEach(clearTimeout);
  room.timers = [];
}
function later(room, ms, fn) {
  const t = setTimeout(() => {
    room.timers = room.timers.filter((x) => x !== t);
    try { fn(); } catch (e) { console.error(e); }
  }, ms);
  room.timers.push(t);
  return t;
}

function destroyRoom(room) {
  clearTimers(room);
  if (room.dropTimer) clearTimeout(room.dropTimer);
  rooms.delete(room.code);
  roomsChanged();
}

/** Hisobdan o'ringa ma'lumot ko'chirish */
function seatFromAcc(acc, sid) {
  return {
    sid, accId: acc.id,
    name: acc.name || "O'yinchi", avatar: acc.avatar,
    level: acc.level, frame: A.frameOf(acc),
    skin: acc.equip.skin, glove: acc.equip.glove,
    bot: false, human: true, connected: true, filler: false, away: false, quit: false,
    roundsSeen: 0, micMuted: false,
  };
}
function makeBot(room, seat) {
  const used = new Set(room.seats.filter(Boolean).map((p) => p.name));
  const nm = BOT_NAMES.find((b) => !used.has(b)) || ('Bot' + seat);
  const skins = K.SKINS.slice(0, 8);
  const gloves = K.GLOVES.slice(0, 12);
  return {
    sid: null, accId: null, name: nm, avatar: 'p' + ((seat * 5 + nm.length) % 12),
    level: 1 + Math.floor(Math.random() * 35), frame: 'bronze',
    skin: skins[Math.floor(Math.random() * skins.length)].id,
    glove: gloves[Math.floor(Math.random() * gloves.length)].id,
    bot: true, human: false, connected: true, filler: true, away: false, quit: false,
    roundsSeen: 0, micMuted: true,
  };
}
function fillBots(room) {
  for (let s = 0; s < room.mode; s++) {
    if (!room.seats[s]) { room.seats[s] = makeBot(room, s); room.hands[s] = room.hands[s] || []; }
  }
}

/* --- Ommaviy xonalar ro'yxati --- */
function roomSummary(room) {
  const host = room.seats[room.hostSeat];
  return {
    code: room.code,
    name: room.name || ((host ? host.name : 'Mehmon') + ' xonasi'),
    mode: room.mode,
    target: room.target,
    phase: room.phase,
    players: room.seats.map((p) => p ? {
      name: p.name, avatar: p.avatar, level: p.level, frame: p.frame,
      bot: p.bot && (p.filler || p.quit), away: p.away || !p.connected,
    } : null),
    free: room.seats.filter(takeable).length,
    humans: room.seats.filter((p) => p && p.accId && !p.quit).length,
    joinable: room.phase !== 'matchEnd' && room.seats.some(takeable),
    createdAt: room.createdAt,
  };
}
function publicRoomsList() {
  return Array.from(rooms.values())
    .filter((r) => r.isPublic && r.seats.some((p) => p && p.accId && !p.quit))
    .map(roomSummary)
    .sort((a, b) => (b.joinable - a.joinable) || (a.phase === 'lobby' ? -1 : 1) || b.createdAt - a.createdAt)
    .slice(0, 80);
}
let listTimer = null;
function roomsChanged() {
  if (listTimer) return;
  listTimer = setTimeout(() => {
    listTimer = null;
    io.to('watch:rooms').emit('rooms', publicRoomsList());
  }, 600);
}

/* ============================================================
   5. HOLATNI YUBORISH
   ============================================================ */
function publicPlayers(room) {
  const inVoice = new Set(room.voice.values());
  return room.seats.map((p, i) => p ? {
    seat: i,
    accId: p.accId,
    name: p.name, avatar: p.avatar, level: p.level, frame: p.frame,
    skin: p.skin, glove: p.glove,
    bot: p.bot, human: !!p.accId && !p.filler, connected: p.connected,
    away: p.away, quit: p.quit,
    team: teamOf(i),
    cardCount: (room.hands[i] || []).length,
    inVoice: inVoice.has(i), micMuted: !!p.micMuted,
  } : null);
}

function trickForSeat(room, seat) {
  const t = room.trick;
  if (!t) return null;
  return {
    count: t.count,
    leadSuit: t.leadSuit,
    best: t.best,
    bestSeat: t.bestSeat,
    plays: t.plays.map((p) => ({
      seat: p.seat,
      hidden: p.hidden,
      cards: p.hidden && p.seat !== seat ? p.cards.map(() => '??') : p.cards,
    })),
  };
}

function stateFor(room, seat) {
  return {
    code: room.code,
    name: room.name,
    isPublic: room.isPublic,
    mode: room.mode,
    phase: room.phase,
    seat,
    players: publicPlayers(room),
    hand: seat >= 0 ? (room.hands[seat] || []) : [],
    deckCount: room.deck.length,
    trump: room.trump,
    trumpCard: room.trumpCard,
    trumpTaken: room.deck.length === 0,
    turn: room.turn,
    leader: room.leader,
    trick: trickForSeat(room, seat),
    roundPoints: room.roundPoints,
    matchScore: room.matchScore,
    vaultCount: [room.vault[0].length, room.vault[1].length],
    target: room.target,
    hostSeat: room.hostSeat,
    round: room.round,
    legal: seat >= 0 && room.phase === 'playing' && room.turn === seat ? legalInfo(room, seat) : null,
    log: room.log.slice(-30),
    voice: Array.from(room.voice, ([sid, s]) => ({ sid, seat: s })),
  };
}

function broadcast(room) {
  room.seats.forEach((p, i) => {
    if (p && p.sid && p.connected && !p.bot) io.to(p.sid).emit('state', stateFor(room, i));
  });
  roomsChanged();
}
function emitAll(room, event, payload) {
  io.to('room:' + room.code).emit(event, payload);
}

/* ============================================================
   6. QONUNIY YURISHLAR
   ------------------------------------------------------------
   * Hujumchi 1..4 ta BIR MASTADAGI kartani tashlaydi.
   * Keyingilar aynan shuncha karta tashlaydi.
   * OCHIQ (yengish): stoldagi eng kuchli yurishning HAR BIR kartasi
     alohida karta bilan urilishi shart — o'sha mastaning kattasi
     yoki zot. Bittasi ham urilmasa — yengib bo'lmaydi.
   * Aks holda — YOPIB BERISH: istalgan kartalar teskari qo'yiladi.
   ============================================================ */
function minHandSize(room) {
  let m = Infinity;
  for (let s = 0; s < room.mode; s++) m = Math.min(m, (room.hands[s] || []).length);
  return m === Infinity ? 0 : m;
}

function legalInfo(room, seat) {
  const hand = room.hands[seat] || [];
  const t = room.trick;
  if (!t || t.plays.length === 0) {
    return { role: 'lead', count: null, canOpen: true, openable: hand.slice(), best: null,
      maxLead: Math.max(1, minHandSize(room)) };
  }
  const sets = beatingSets(hand, t.best, room.trump);
  const openable = Array.from(new Set(sets.flat()));
  return { role: 'follow', count: t.count, canOpen: sets.length > 0, openable, best: t.best };
}

function validatePlay(room, seat, cards, hidden) {
  const hand = room.hands[seat] || [];
  if (!Array.isArray(cards) || cards.length === 0) return 'Karta tanlanmadi.';
  if (cards.some((c) => typeof c !== 'string')) return 'Noto\'g\'ri karta.';
  if (new Set(cards).size !== cards.length) return 'Bir karta ikki marta tanlandi.';
  for (const c of cards) if (!hand.includes(c)) return 'Bu karta qo\'lingizda yo\'q.';

  const t = room.trick;
  if (!t || t.plays.length === 0) {
    const cap = Math.max(1, minHandSize(room));
    if (cards.length > cap) return `Ko'pi bilan ${cap} ta karta tashlash mumkin.`;
    const s = suitOf(cards[0]);
    if (!cards.every((c) => suitOf(c) === s)) return 'Hujumda kartalar bir mastada bo\'lishi kerak.';
    return null;
  }
  if (cards.length !== t.count) return `${t.count} ta karta tashlash kerak.`;
  if (hidden) return null;
  if (!beatsAll(cards, t.best, room.trump)) {
    return 'Har bir kartani urish kerak: o\'sha mastaning kattasi yoki zot bilan.';
  }
  return null;
}

/* ============================================================
   7. O'YIN OQIMI
   ============================================================ */
function startMatch(room) {
  room.matchScore = [0, 0];
  room.sofCount = [0, 0];
  room.round = 0;
  room.log = [];
  room.seats.forEach((p) => { if (p) p.roundsSeen = 0; });
  startRound(room, null);
}

function startRound(room, firstSeat) {
  clearTimers(room);
  room.round += 1;
  room.deck = shuffle(buildDeck());
  room.hands = {};
  room.vault = [[], []];
  room.roundPoints = [0, 0];
  room.trick = null;
  room.trumpCard = room.deck[0];         // pastdagi ochiq karta — eng oxirgi olinadi
  room.trump = suitOf(room.trumpCard);

  for (let s = 0; s < room.mode; s++) room.hands[s] = [];
  for (let k = 0; k < HAND_SIZE; k++) {
    for (let s = 0; s < room.mode; s++) room.hands[s].push(room.deck.pop());
  }
  pushLog(room, `${room.round}-qo'l. Zot: ${SUIT_UZ[room.trump]} ${K.SUIT_CHAR[room.trump]}`);

  if (firstSeat === null || firstSeat === undefined) {
    // 1-jamoa QORA, 2-jamoa QIZIL. Tasodifiy karta ochiladi.
    const probe = room.deck[1 + Math.floor(Math.random() * (room.deck.length - 1))];
    const isRed = suitOf(probe) === 'H' || suitOf(probe) === 'D';
    const startTeam = isRed ? 1 : 0;
    const team = [];
    for (let s = 0; s < room.mode; s++) if (teamOf(s) === startTeam) team.push(s);
    const chosen = team[Math.floor(Math.random() * team.length)];
    room.phase = 'coinflip';
    room.turn = chosen;
    room.leader = chosen;
    broadcast(room);
    emitAll(room, 'coinflip', {
      card: probe, color: isRed ? 'qizil' : 'qora', team: startTeam, seat: chosen,
      name: room.seats[chosen] ? room.seats[chosen].name : '',
    });
    later(room, 3200, () => {
      room.phase = 'playing';
      newTrick(room, chosen);
      emitAll(room, 'deal', {});
      broadcast(room);
      maybeBot(room);
    });
  } else {
    room.phase = 'playing';
    newTrick(room, firstSeat);
    emitAll(room, 'deal', {});
    broadcast(room);
    maybeBot(room);
  }
}

function newTrick(room, leader) {
  room.leader = leader;
  room.turn = leader;
  room.trick = { count: 0, leadSuit: null, plays: [], best: null, bestSeat: null };
}

function doPlay(room, seat, cards, hidden) {
  const t = room.trick;
  const isLead = t.plays.length === 0;
  room.hands[seat] = room.hands[seat].filter((c) => !cards.includes(c));

  let beat = false;
  if (isLead) {
    t.count = cards.length;
    t.leadSuit = suitOf(cards[0]);
    t.best = cards.slice();
    t.bestSeat = seat;
    hidden = false;
  } else if (!hidden && beatsAll(cards, t.best, room.trump)) {
    t.best = cards.slice();       // endi keyingilar SHU kartalarni urishi kerak
    t.bestSeat = seat;
    beat = true;
  }
  t.plays.push({ seat, cards: cards.slice(), hidden: !!hidden });

  const nm = room.seats[seat] ? room.seats[seat].name : '?';
  pushLog(room, hidden ? `${nm} yopib berdi (${cards.length})`
    : `${nm}${isLead ? ' yurdi' : ' urdi'}: ${cards.map(K.label).join(' ')}`);

  emitAll(room, 'played', { seat, cards: hidden ? cards.map(() => '??') : cards, hidden: !!hidden, beat, lead: isLead });

  if (t.plays.length >= room.mode) {
    room.turn = -1;
    broadcast(room);
    later(room, 1000, () => endTrick(room));
  } else {
    room.turn = nextSeat(room, seat);
    broadcast(room);
    maybeBot(room);
  }
}

function endTrick(room) {
  const t = room.trick;
  const winner = t.bestSeat;
  const team = teamOf(winner);
  const all = t.plays.flatMap((p) => p.cards);
  const pts = sumValue(all);
  room.vault[team].push(...all);
  room.roundPoints[team] += pts;
  const nm = room.seats[winner] ? room.seats[winner].name : '?';
  pushLog(room, `${nm} qo'lni oldi (+${pts})`);
  emitAll(room, 'trickWon', { seat: winner, team, points: pts, cards: all });
  room.trick = null;
  room.turn = -1;
  broadcast(room);
  later(room, 950, () => drawPhase(room, winner));
}

function drawPhase(room, winner) {
  // Qo'lni olgan birinchi oladi, keyin soat yo'nalishi bo'yicha
  const order = [];
  for (let i = 0; i < room.mode; i++) order.push((winner + i) % room.mode);
  const drawn = [];
  let progress = true;
  while (progress && room.deck.length > 0) {
    progress = false;
    for (const s of order) {
      if (room.deck.length === 0) break;
      if (room.hands[s].length < HAND_SIZE) {
        room.hands[s].push(room.deck.pop());
        drawn.push(s);
        progress = true;
      }
    }
  }
  if (drawn.length) emitAll(room, 'drew', { seats: drawn });
  const empty = room.seats.every((p, i) => (room.hands[i] || []).length === 0);
  if (room.deck.length === 0 && empty) return endRound(room);
  newTrick(room, winner);
  room.phase = 'playing';
  broadcast(room);
  maybeBot(room);
}

function endRound(room) {
  const [a, b] = room.roundPoints;
  let loser = null, delta = 0, label = '';
  if (a === b) {
    label = 'Durang (60–60)';
  } else {
    loser = a < b ? 0 : 1;
    const lp = Math.min(a, b);
    if (lp === 0) { delta = -6; label = 'SOF KOZOL!'; }
    else if (lp < 30) { delta = -4; label = 'KOZOL!'; }
    else { delta = -2; label = 'Yutqazdi'; }
    room.matchScore[loser] += delta;
    if (delta === -6) room.sofCount[1 - loser] += 1;
  }

  // Statistika
  room.seats.forEach((p, i) => {
    if (!p || !p.accId || p.quit) return;
    p.roundsSeen += 1;
    const acc = A.get(p.accId);
    if (!acc || loser === null) return;
    if (teamOf(i) === loser) {
      acc.stats.roundsLost += 1;
      if (delta <= -4) acc.stats.kozolTaken += 1;
    } else {
      acc.stats.roundsWon += 1;
      if (delta <= -4) acc.stats.kozolGiven += 1;
      if (delta === -6) acc.stats.sofKozol += 1;
    }
    A.markDirty();
  });

  room.phase = 'roundEnd';
  room.turn = -1;
  pushLog(room, `Hisob: ${a} — ${b}. ${label}`);
  broadcast(room);

  const done = room.matchScore.some((s) => s <= room.target);
  emitAll(room, 'roundEnd', { points: [a, b], loser, delta, label, matchScore: room.matchScore, finished: done });

  if (done) {
    room.phase = 'matchEnd';
    const winTeam = room.matchScore[0] <= room.target ? 1 : 0;
    pushLog(room, `MATCH TUGADI — ${winTeam + 1}-jamoa g'olib!`);
    broadcast(room);
    emitAll(room, 'matchEnd', { winTeam, matchScore: room.matchScore });
    giveRewards(room, winTeam);
  } else {
    // Yutqazgan jamoa keyingi qo'lni boshlaydi
    let nextLeader = room.leader;
    if (loser !== null) {
      const cand = [];
      for (let s = 0; s < room.mode; s++) if (teamOf(s) === loser) cand.push(s);
      nextLeader = cand[Math.floor(Math.random() * cand.length)];
    }
    later(room, 6000, () => { if (room.phase === 'roundEnd') startRound(room, nextLeader); });
  }
}

/* ============================================================
   8. MUKOFOTLAR
   ============================================================ */
function giveRewards(room, winTeam) {
  const accIds = room.seats.filter((p) => p && p.accId && !p.quit).map((p) => p.accId);
  room.seats.forEach((p, i) => {
    if (!p || !p.accId || p.quit || p.roundsSeen < 1) return;
    const acc = A.get(p.accId);
    if (!acc) return;
    const myTeam = teamOf(i);
    const vsBots = room.seats.every((q, j) => teamOf(j) === myTeam || !q || !q.accId || q.quit);
    const res = A.applyMatch(acc, {
      won: myTeam === winTeam,
      vsBots,
      sofBonus: room.sofCount[myTeam],
    });
    A.addRecent(acc, accIds);
    p.level = acc.level;
    p.frame = A.frameOf(acc);
    toAcc(acc.id, 'reward', res);
    pushMe(acc);
  });
  broadcast(room);
}

/* ============================================================
   9. BOT
   ============================================================ */
function maybeBot(room) {
  if (room.phase !== 'playing') return;
  const seat = room.turn;
  const p = room.seats[seat];
  if (!p || !p.bot) return;
  later(room, 900 + Math.random() * 700, () => {
    if (room.phase !== 'playing' || room.turn !== seat) return;
    const q = room.seats[seat];
    if (!q || !q.bot) return;
    const move = botMove(room, seat);
    if (move) doPlay(room, seat, move.cards, move.hidden);
  });
}

const isTrump = (c, trump) => suitOf(c) === trump;
function cheapest(cards, trump, n) {
  return cards.slice().sort((x, y) =>
    (isTrump(x, trump) - isTrump(y, trump)) || (valOf(x) - valOf(y)) || (powOf(x) - powOf(y))
  ).slice(0, n);
}
/** Yengish uchun sarflanadigan "narx" — zot va ochkoli kartalar qimmat */
function setCost(set, trump) {
  return set.reduce((s, c) => s + (isTrump(c, trump) ? 40 + powOf(c) * 2 : valOf(c) + powOf(c)), 0);
}

function botMove(room, seat) {
  const hand = (room.hands[seat] || []).slice();
  if (!hand.length) return null;
  const trump = room.trump;
  const t = room.trick;

  // --- Hujum ---
  if (!t || t.plays.length === 0) {
    const nonTrump = hand.filter((c) => !isTrump(c, trump));
    const pool = nonTrump.length ? nonTrump : hand;
    const bySuit = {};
    pool.forEach((c) => (bySuit[suitOf(c)] = bySuit[suitOf(c)] || []).push(c));
    for (const s of Object.keys(bySuit)) {
      const group = bySuit[s];
      const ace = group.find((c) => rankOf(c) === 'A');
      if (ace && group.length >= 2 && room.deck.length > 6 && minHandSize(room) >= 2) {
        const rest = group.filter((c) => c !== ace).sort((x, y) => valOf(x) - valOf(y));
        return { cards: [ace, rest[0]], hidden: false };
      }
    }
    const low = pool.slice().sort((x, y) => valOf(x) - valOf(y) || powOf(x) - powOf(y))[0];
    return { cards: [low], hidden: false };
  }

  // --- Javob ---
  const n = t.count;
  const partnerWinning = room.mode === 4 && teamOf(t.bestSeat) === teamOf(seat);
  const pot = sumValue(t.plays.flatMap((p) => p.cards));
  const sets = beatingSets(hand, t.best, trump).sort((x, y) => setCost(x, trump) - setCost(y, trump));
  const openPlay = sets.length ? sets[0] : null;
  const wantsToTake = !!openPlay && (!partnerWinning || pot >= 12 || room.deck.length === 0);
  if (openPlay && wantsToTake) return { cards: openPlay, hidden: false };

  let cover;
  if (partnerWinning) {
    // sherigi olayotgan bo'lsa — ochkoli kartani "tashlab" beradi
    cover = hand.slice().sort((x, y) => (isTrump(x, trump) - isTrump(y, trump)) || valOf(y) - valOf(x)).slice(0, n);
  } else {
    cover = cheapest(hand, trump, n);
  }
  if (cover.length < n) cover = hand.slice(0, n);
  return { cards: cover, hidden: true };
}

/* ============================================================
   10. SOCKET HODISALARI
   ============================================================ */
function rateLimiter(max, perMs) {
  const hits = [];
  return () => {
    const now = Date.now();
    while (hits.length && now - hits[0] > perMs) hits.shift();
    if (hits.length >= max) return false;
    hits.push(now);
    return true;
  };
}

/** Hisobning faol o'yinini topish (qaytish uchun) */
function activeGameOf(accId) {
  for (const room of rooms.values()) {
    const s = seatOfAcc(room, accId);
    if (s >= 0 && ACTIVE_PHASES.has(room.phase)) {
      return { code: room.code, name: room.name, mode: room.mode, seat: s };
    }
  }
  return null;
}

function friendsPayload(acc) {
  const status = (id) => {
    const ag = activeGameOf(id);
    let lobby = null;
    if (!ag) {
      for (const r of rooms.values()) {
        if (r.phase === 'lobby' && seatOfAcc(r, id) >= 0) { lobby = r; break; }
      }
    }
    const r = ag ? rooms.get(ag.code) : lobby;
    return r ? { code: r.code, phase: r.phase, isPublic: r.isPublic, joinable: r.seats.some(takeable) } : null;
  };
  const row = (id) => {
    const a = A.get(id);
    if (!a) return { id, name: 'Noma\'lum', avatar: 'p0', level: 1, frame: 'bronze', online: false, room: null };
    return { ...A.brief(a), online: isOnline(id), room: isOnline(id) ? status(id) : null, lastSeen: a.lastSeen };
  };
  return {
    friends: acc.friends.map(row).sort((x, y) => (y.online - x.online) || (y.lastSeen || 0) - (x.lastSeen || 0)),
    reqIn: acc.reqIn.map(row),
    reqOut: acc.reqOut.map(row),
    recent: acc.recent.filter((r) => !acc.friends.includes(r.id)).map((r) => ({ ...row(r.id), t: r.t })),
  };
}

io.on('connection', (socket) => {
  let acc = null;                              // shu ulanishning hisobi
  let cur = { code: null, seat: -1 };
  const chatOk = rateLimiter(6, 6000);
  const fxOk = rateLimiter(4, 4000);
  const actionOk = rateLimiter(30, 5000);

  const getRoom = () => (cur.code ? rooms.get(cur.code) : null);
  const need = () => !!acc;
  const reply = (cb, data) => { if (typeof cb === 'function') cb(data); };

  /* ---------- KIRISH ---------- */
  socket.on('auth', (creds, cb) => {
    const r = A.auth(creds || {});
    if (acc && acc.id !== r.acc.id) detachPresence();
    acc = r.acc;
    socketAcc.set(socket.id, acc.id);
    if (!online.has(acc.id)) online.set(acc.id, new Set());
    online.get(acc.id).add(socket.id);
    acc.lastSeen = Date.now();
    reply(cb, {
      me: A.selfView(acc),
      snap: A.snapshot(acc),
      secret: r.secret || null,
      created: r.created,
      restored: r.restored,
      active: activeGameOf(acc.id),
    });
  });

  function detachPresence() {
    if (!acc) return;
    const set = online.get(acc.id);
    if (set) { set.delete(socket.id); if (!set.size) online.delete(acc.id); }
    socketAcc.delete(socket.id);
  }

  /* ---------- PROFIL ---------- */
  socket.on('profile:update', (p, cb) => {
    if (!need()) return;
    A.updateProfile(acc, p);
    syncSeatsOf(acc);
    pushMe(acc);
    reply(cb, { ok: true });
  });

  socket.on('profile:get', (id, cb) => {
    if (!need()) return;
    const other = A.get(String(id || ''));
    if (!other) return reply(cb, { ok: false, msg: 'Bunday ID li o\'yinchi topilmadi.' });
    const prof = A.publicProfile(other);
    prof.online = isOnline(other.id);
    prof.isFriend = acc.friends.includes(other.id);
    prof.requested = acc.reqOut.includes(other.id);
    prof.requestedMe = acc.reqIn.includes(other.id);
    prof.isMe = other.id === acc.id;
    reply(cb, { ok: true, profile: prof });
  });

  socket.on('daily:claim', (x, cb) => {
    if (!need()) return;
    const r = A.claimDaily(acc);
    pushMe(acc);
    reply(cb, r);
  });

  /* ---------- DO'KON ---------- */
  socket.on('shop:buy', ({ kind, id, qty } = {}, cb) => {
    if (!need() || !actionOk()) return;
    const r = A.buy(acc, kind, id, qty);
    if (r.ok && (kind === 'skin' || kind === 'glove')) {
      A.equip(acc, kind, id);            // sotib olingan narsani darhol kiyamiz
      syncSeatsOf(acc);
    }
    pushMe(acc);
    reply(cb, r);
  });

  socket.on('shop:equip', ({ kind, id } = {}, cb) => {
    if (!need()) return;
    const ok = A.equip(acc, kind, id);
    if (ok) syncSeatsOf(acc);
    pushMe(acc);
    reply(cb, { ok, msg: ok ? '' : 'Bu narsa sizda yo\'q.' });
  });

  /** Profil/kiyim o'zgarsa — o'tirgan xonalardagi ma'lumotni yangilaymiz */
  function syncSeatsOf(a) {
    for (const room of rooms.values()) {
      const s = seatOfAcc(room, a.id);
      if (s < 0) continue;
      const p = room.seats[s];
      p.name = a.name || p.name; p.avatar = a.avatar; p.level = a.level;
      p.frame = A.frameOf(a); p.skin = a.equip.skin; p.glove = a.equip.glove;
      broadcast(room);
    }
  }

  /* ---------- DO'STLAR ---------- */
  socket.on('friends:list', (x, cb) => { if (need()) reply(cb, friendsPayload(acc)); });

  socket.on('friend:request', (id, cb) => {
    if (!need() || !actionOk()) return;
    const other = A.get(String(id || ''));
    const r = A.friendRequest(acc, other);
    if (r.ok && other) {
      toAcc(other.id, 'notify', r.accepted
        ? { type: 'friendAccepted', from: A.brief(acc) }
        : { type: 'friendRequest', from: A.brief(acc) });
      pushMe(other);
    }
    pushMe(acc);
    reply(cb, r);
  });

  socket.on('friend:accept', (id, cb) => {
    if (!need()) return;
    const other = A.get(String(id || ''));
    const r = A.friendAccept(acc, other);
    if (r.ok) { toAcc(other.id, 'notify', { type: 'friendAccepted', from: A.brief(acc) }); pushMe(other); }
    pushMe(acc);
    reply(cb, r);
  });

  socket.on('friend:decline', (id, cb) => {
    if (!need()) return;
    reply(cb, A.friendDecline(acc, String(id || '')));
    pushMe(acc);
  });

  socket.on('friend:remove', (id, cb) => {
    if (!need()) return;
    const other = A.get(String(id || ''));
    reply(cb, A.friendRemove(acc, String(id || '')));
    pushMe(acc);
    if (other) pushMe(other);
  });

  /** Do'stni o'z xonangizga taklif qilish */
  socket.on('invite', (id, cb) => {
    if (!need() || !actionOk()) return;
    const room = getRoom();
    if (!room) return reply(cb, { ok: false, msg: 'Avval xona oching.' });
    const other = A.get(String(id || ''));
    if (!other || !isOnline(other.id)) return reply(cb, { ok: false, msg: 'Do\'stingiz hozir onlayn emas.' });
    if (!other.privacy.invites) return reply(cb, { ok: false, msg: 'Bu o\'yinchi takliflarni o\'chirib qo\'ygan.' });
    toAcc(other.id, 'invite', { from: A.brief(acc), code: room.code, roomName: room.name, mode: room.mode });
    reply(cb, { ok: true });
  });

  /** Profil oynasidan sovg'a yuborish (o'yindan tashqari) */
  socket.on('gift:send', ({ to, id } = {}, cb) => {
    if (!need() || !fxOk()) return reply(cb, { ok: false, msg: 'Biroz kuting.' });
    const other = A.get(String(to || ''));
    if (!other || other.id === acc.id) return reply(cb, { ok: false, msg: 'Oluvchi topilmadi.' });
    const r = A.sendGift(acc, other, id);
    if (r.ok) {
      toAcc(other.id, 'notify', { type: 'gift', from: A.brief(acc), item: id });
      pushMe(other);
    }
    pushMe(acc);
    reply(cb, r.ok ? { ok: true } : r);
  });

  /* ---------- OMMAVIY XONALAR ---------- */
  socket.on('rooms:watch', (on) => {
    if (on) { socket.join('watch:rooms'); socket.emit('rooms', publicRoomsList()); }
    else socket.leave('watch:rooms');
  });

  /* ---------- XONA OCHISH / KIRISH ---------- */
  function sitDown(room, seat) {
    const prev = room.seats[seat];
    room.seats[seat] = seatFromAcc(acc, socket.id);
    room.hands[seat] = room.hands[seat] || [];
    cur = { code: room.code, seat };
    socket.join('room:' + room.code);
    socket.emit('joined', { code: room.code, seat });
    socket.emit('chatHistory', room.chat.slice(-50));
    if (prev && prev.bot && room.phase !== 'lobby') pushLog(room, `${room.seats[seat].name} bot o'rniga o'yinga qo'shildi`);
    else pushLog(room, `${room.seats[seat].name} qo'shildi`);
    broadcast(room);
    maybeBot(room);
  }

  /** Ulanish boshqa xonada bo'lsa — undan chiqaramiz */
  function leaveCurrent(mode) {
    const room = getRoom();
    if (!room) return;
    leaveRoom(room, cur.seat, mode || 'bot');
  }

  socket.on('createRoom', (o = {}, cb) => {
    if (!need() || !actionOk()) return;
    if (!acc.name) return reply(cb, { ok: false, msg: 'Avval profilingizda ism kiriting.' });
    const ag = activeGameOf(acc.id);
    if (ag) return reply(cb, { ok: false, msg: `Sizda davom etayotgan o'yin bor (xona ${ag.code}). Avval unga qayting yoki undan chiqing.`, active: ag });
    leaveCurrent('bot');
    const room = createRoom({
      mode: o.mode === 2 ? 2 : 4,
      target: Number(o.target) || -12,
      isPublic: o.isPublic !== false,
      name: o.name,
    });
    room.hostSeat = 0;
    sitDown(room, 0);
    if (o.bots) { fillBots(room); broadcast(room); }
    reply(cb, { ok: true, code: room.code });
  });

  socket.on('joinRoom', (o = {}, cb) => {
    if (!need() || !actionOk()) return;
    if (!acc.name) return reply(cb, { ok: false, msg: 'Avval profilingizda ism kiriting.' });
    const room = rooms.get(String(o.code || '').trim());
    if (!room) return reply(cb, { ok: false, msg: 'Bunday xona topilmadi.' });

    // O'zining o'rni bor bo'lsa — qaytadi
    const mine = seatOfAcc(room, acc.id);
    if (mine >= 0) return rejoinSeat(room, mine, cb);

    const ag = activeGameOf(acc.id);
    if (ag && ag.code !== room.code) return reply(cb, { ok: false, msg: `Sizda davom etayotgan o'yin bor (xona ${ag.code}).`, active: ag });
    if (room.phase === 'matchEnd') return reply(cb, { ok: false, msg: 'Bu o\'yin tugagan.' });

    let seat = -1;
    if (Number.isInteger(o.seat) && o.seat >= 0 && o.seat < room.mode && takeable(room.seats[o.seat])) seat = o.seat;
    if (seat < 0) seat = room.seats.findIndex((p) => p === null);
    if (seat < 0) seat = room.seats.findIndex(takeable);
    if (seat < 0) return reply(cb, { ok: false, msg: 'Xonada bo\'sh o\'rin yo\'q.' });

    leaveCurrent('bot');
    sitDown(room, seat);
    reply(cb, { ok: true, code: room.code });
  });

  /** Tezkor o'yin: mos ommaviy xonaga kirish yoki yangisini ochish */
  socket.on('quickPlay', (o = {}, cb) => {
    if (!need() || !actionOk()) return;
    if (!acc.name) return reply(cb, { ok: false, msg: 'Avval profilingizda ism kiriting.' });
    const ag = activeGameOf(acc.id);
    if (ag) return reply(cb, { ok: false, msg: `Sizda davom etayotgan o'yin bor (xona ${ag.code}).`, active: ag });
    const mode = o.mode === 2 ? 2 : 4;
    const cand = Array.from(rooms.values())
      .filter((r) => r.isPublic && r.mode === mode && r.phase === 'lobby' && r.seats.some(takeable) && onlineHumans(r) > 0)
      .sort((a, b) => onlineHumans(b) - onlineHumans(a))[0];
    leaveCurrent('bot');
    if (cand) {
      let seat = cand.seats.findIndex((p) => p === null);
      if (seat < 0) seat = cand.seats.findIndex(takeable);
      sitDown(cand, seat);
      return reply(cb, { ok: true, code: cand.code, joined: true });
    }
    const room = createRoom({ mode, target: -12, isPublic: true, name: '' });
    room.hostSeat = 0;
    sitDown(room, 0);
    reply(cb, { ok: true, code: room.code, created: true });
  });

  function rejoinSeat(room, seat, cb) {
    const p = room.seats[seat];
    // Boshqa oynada ochiq bo'lsa — o'sha oynani chiqaramiz
    if (p.sid && p.sid !== socket.id) {
      const old = io.sockets.sockets.get(p.sid);
      if (old) { old.emit('kicked', 'Hisobingiz boshqa oynada ochildi.'); old.leave('room:' + room.code); }
    }
    p.sid = socket.id;
    p.connected = true;
    p.bot = false;
    p.away = false;
    if (room.dropTimer) { clearTimeout(room.dropTimer); room.dropTimer = null; }
    cur = { code: room.code, seat };
    socket.join('room:' + room.code);
    pushLog(room, `${p.name} qaytib keldi`);
    socket.emit('joined', { code: room.code, seat, rejoin: true });
    socket.emit('chatHistory', room.chat.slice(-50));
    broadcast(room);
    reply(cb, { ok: true, code: room.code });
  }

  socket.on('rejoin', (o = {}, cb) => {
    if (!need()) return;
    const ag = activeGameOf(acc.id);
    const code = String((o && o.code) || (ag && ag.code) || '');
    const room = rooms.get(code);
    if (!room) return reply(cb, { ok: false, msg: 'O\'yin topilmadi — u tugagan bo\'lishi mumkin.' });
    const seat = seatOfAcc(room, acc.id);
    if (seat < 0) return reply(cb, { ok: false, msg: 'Bu xonada o\'rningiz yo\'q.' });
    rejoinSeat(room, seat, cb);
  });

  /* ---------- KUTISH XONASI ---------- */
  socket.on('addBots', () => {
    const room = getRoom();
    if (!room || room.phase !== 'lobby' || cur.seat !== room.hostSeat) return;
    fillBots(room);
    broadcast(room);
  });

  socket.on('switchSeat', (to) => {
    const room = getRoom();
    if (!room || room.phase !== 'lobby') return;
    to = Number(to);
    if (!Number.isInteger(to) || to < 0 || to >= room.mode || room.seats[to]) return;
    const from = cur.seat;
    room.seats[to] = room.seats[from];
    room.seats[from] = null;
    if (room.hostSeat === from) room.hostSeat = to;
    for (const [sid, s] of room.voice) if (s === from) room.voice.set(sid, to);
    cur.seat = to;
    socket.emit('joined', { code: room.code, seat: to });
    broadcast(room);
  });

  socket.on('kick', (seat) => {
    const room = getRoom();
    if (!room || room.phase !== 'lobby' || cur.seat !== room.hostSeat) return;
    seat = Number(seat);
    const p = room.seats[seat];
    if (!p || seat === cur.seat) return;
    if (p.sid) {
      const s = io.sockets.sockets.get(p.sid);
      if (s) { s.emit('kicked', 'Mezbon sizni xonadan chiqardi.'); s.leave('room:' + room.code); }
      voiceDrop(room, p.sid);
    }
    room.seats[seat] = null;
    broadcast(room);
  });

  socket.on('start', (x, cb) => {
    const room = getRoom();
    if (!room || room.phase !== 'lobby') return;
    if (cur.seat !== room.hostSeat) return reply(cb, { ok: false, msg: 'Faqat mezbon boshlaydi.' });
    if (room.seats.some((s) => s === null)) return reply(cb, { ok: false, msg: 'Barcha o\'rinlar to\'lishi kerak.' });
    startMatch(room);
    reply(cb, { ok: true });
  });

  socket.on('rematch', () => {
    const room = getRoom();
    if (!room || room.phase !== 'matchEnd' || cur.seat !== room.hostSeat) return;
    // Kutish xonasiga qaytamiz: chiqib ketganlar o'rni bo'shaydi
    room.seats = room.seats.map((p) => (!p ? null : p.filler ? p : (p.connected && !p.bot && !p.quit ? p : null)));
    room.phase = 'lobby';
    room.trick = null; room.hands = {}; room.deck = [];
    room.matchScore = [0, 0]; room.roundPoints = [0, 0]; room.vault = [[], []];
    room.trump = null; room.trumpCard = null; room.round = 0;
    pushLog(room, 'Yangi match uchun kutish xonasi');
    broadcast(room);
    emitAll(room, 'backToLobby', {});
  });

  /* ---------- YURISH ---------- */
  socket.on('play', ({ cards, hidden } = {}) => {
    const room = getRoom();
    if (!room || room.phase !== 'playing') return;
    if (room.turn !== cur.seat) return socket.emit('errorMsg', 'Hozir sizning navbatingiz emas.');
    const p = room.seats[cur.seat];
    if (!p || p.sid !== socket.id) return;
    const err = validatePlay(room, cur.seat, cards || [], !!hidden);
    if (err) return socket.emit('errorMsg', err);
    doPlay(room, cur.seat, cards, !!hidden);
  });

  /* ---------- CHIQISH ---------- */
  socket.on('leaveRoom', (mode, cb) => {
    const room = getRoom();
    if (!room) return reply(cb, { ok: true });
    leaveRoom(room, cur.seat, mode === 'quit' ? 'quit' : 'bot');
    reply(cb, { ok: true });
  });

  /**
   * mode 'bot'  — o'rniga bot o'ynab turadi, istalgan payt qaytish mumkin
   * mode 'quit' — o'yinni butunlay tark etadi (mag'lubiyat, LP jarimasi)
   */
  function leaveRoom(room, seat, mode) {
    const p = room.seats[seat];
    socket.leave('room:' + room.code);
    voiceDrop(room, socket.id);
    cur = { code: null, seat: -1 };
    if (!p || p.sid !== socket.id) return;

    if (room.phase === 'lobby' || room.phase === 'matchEnd') {
      room.seats[seat] = null;
      pushLog(room, `${p.name} xonadan chiqdi`);
      if (onlineHumans(room) === 0) return destroyRoom(room);
      if (seat === room.hostSeat) room.hostSeat = room.seats.findIndex((q) => q && q.accId && q.connected);
      broadcast(room);
      return;
    }

    p.sid = null;
    p.connected = false;
    p.bot = true;
    if (mode === 'quit') {
      p.quit = true;
      p.name = p.name + ' (bot)';
      const a = A.get(p.accId);
      if (a) { const r = A.applyQuit(a); pushMe(a); socket.emit('quitPenalty', r); }
      pushLog(room, `${p.name.replace(' (bot)', '')} o'yinni tark etdi — o'rnida bot`);
    } else {
      p.away = true;
      pushLog(room, `${p.name} chiqib turdi — o'rnida bot o'ynaydi`);
    }
    if (seat === room.hostSeat) {
      const h = room.seats.findIndex((q) => q && q.accId && q.connected);
      if (h >= 0) room.hostSeat = h;
    }
    checkEmpty(room);
    broadcast(room);
    maybeBot(room);
  }

  function checkEmpty(room) {
    if (onlineHumans(room) === 0 && !room.dropTimer) {
      room.dropTimer = setTimeout(() => {
        room.dropTimer = null;
        if (rooms.has(room.code) && onlineHumans(room) === 0) destroyRoom(room);
      }, 5 * 60 * 1000);
    }
  }

  /* ---------- CHAT ---------- */
  socket.on('chat', (text) => {
    const room = getRoom();
    if (!room || !acc) return;
    const msg = A.cleanText(text, 200);
    if (!msg) return;
    if (!chatOk()) return socket.emit('errorMsg', 'Juda tez yozyapsiz — biroz kuting.');
    const p = room.seats[cur.seat];
    const m = { seat: cur.seat, accId: acc.id, name: p ? p.name : acc.name, avatar: acc.avatar, text: msg, t: Date.now() };
    room.chat.push(m);
    if (room.chat.length > 80) room.chat.shift();
    emitAll(room, 'chat', m);
  });

  /* ---------- STIKER VA SOVG'ALAR (o'yin ichida) ---------- */
  socket.on('fx', ({ kind, id, to } = {}, cb) => {
    const room = getRoom();
    if (!room || !acc) return;
    if (!fxOk()) return reply(cb, { ok: false, msg: 'Biroz kuting.' });
    to = Number.isInteger(to) ? to : -1;
    if (to >= room.mode) to = -1;
    if (kind === 'sticker') {
      if (!A.hasSticker(acc, id)) return reply(cb, { ok: false, msg: 'Bu stiker sizda yo\'q — do\'kondan oling.' });
    } else if (kind === 'gift') {
      const target = room.seats[to];
      if (!target || to === cur.seat) return reply(cb, { ok: false, msg: 'Sovg\'ani kimga yuborishni tanlang.' });
      const toAcc2 = target.accId && !target.quit ? A.get(target.accId) : null;
      const r = A.sendGift(acc, toAcc2, id);
      if (!r.ok) return reply(cb, r);
      if (toAcc2) pushMe(toAcc2);
      pushMe(acc);
    } else return;
    emitAll(room, 'fx', { kind, id, from: cur.seat, to });
    reply(cb, { ok: true });
  });

  /* ---------- OVOZLI CHAT (WebRTC signallari) ---------- */
  socket.on('voice:join', () => {
    const room = getRoom();
    if (!room || cur.seat < 0) return;
    const peers = Array.from(room.voice.entries()).filter(([sid]) => sid !== socket.id)
      .map(([sid, seat]) => ({ sid, seat }));
    room.voice.set(socket.id, cur.seat);
    const p = room.seats[cur.seat];
    if (p) p.micMuted = false;
    socket.emit('voice:peers', peers);           // yangi kelgan hamma bilan ulanishni o'zi boshlaydi
    socket.to('room:' + room.code).emit('voice:joined', { sid: socket.id, seat: cur.seat, name: p ? p.name : '' });
    broadcast(room);
  });

  socket.on('voice:signal', ({ to, data } = {}) => {
    const room = getRoom();
    if (!room || !room.voice.has(socket.id) || !room.voice.has(to)) return;
    io.to(to).emit('voice:signal', { from: socket.id, seat: room.voice.get(socket.id), data });
  });

  socket.on('voice:mute', (muted) => {
    const room = getRoom();
    if (!room) return;
    const p = room.seats[cur.seat];
    if (p) { p.micMuted = !!muted; broadcast(room); }
  });

  socket.on('voice:leave', () => {
    const room = getRoom();
    if (room) voiceDrop(room, socket.id);
  });

  function voiceDrop(room, sid) {
    if (!room.voice.has(sid)) return;
    room.voice.delete(sid);
    emitAll(room, 'voice:left', { sid });
    broadcast(room);
  }

  /* ---------- UZILISH ---------- */
  socket.on('disconnect', () => {
    detachPresence();
    if (acc) acc.lastSeen = Date.now();
    const room = getRoom();
    if (!room) return;
    voiceDrop(room, socket.id);
    const seat = seatOfSid(room, socket.id);
    if (seat < 0) return;
    const p = room.seats[seat];
    if (room.phase === 'lobby' || room.phase === 'matchEnd') {
      room.seats[seat] = null;
      if (onlineHumans(room) === 0) return destroyRoom(room);
      if (seat === room.hostSeat) room.hostSeat = room.seats.findIndex((q) => q && q.accId && q.connected);
    } else {
      // O'rin band qoladi, vaqtincha bot o'ynaydi — qaytsa o'z o'rniga tushadi
      p.connected = false;
      p.bot = true;
      p.sid = null;
      pushLog(room, `${p.name} uzildi — bot o'ynab turadi`);
      maybeBot(room);
      checkEmpty(room);
    }
    broadcast(room);
  });
});

/* ============================================================ */

process.on('SIGTERM', () => { A.flushSync(); process.exit(0); });
process.on('SIGINT', () => { A.flushSync(); process.exit(0); });

if (require.main !== module && !process.env.KOZOL_RUN) {
  // testlar uchun ichki funksiyalar
  module.exports = {
    server, io, rooms, buildDeck, shuffle, createRoom, startRound, doPlay, botMove,
    validatePlay, legalInfo, minHandSize, teamOf, fillBots, listen: (p, cb) => server.listen(p, cb),
  };
} else {
  server.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log('  ║   O\'ZBEK KOZOL (ZOT) — server ishga  ║');
    console.log('  ║   tushdi. Brauzerda oching:          ║');
    console.log('  ║   http://localhost:' + String(PORT).padEnd(18) + '║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');
  });
}

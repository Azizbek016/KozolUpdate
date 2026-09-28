/* ============================================================
   app.js — asosiy mijoz: ulanish, hisob, menyu, profil,
   do'stlar, ommaviy xonalar, do'kon, sozlamalar.
   O'yin stoli — game.js da.
   ============================================================ */
'use strict';

const socket = io({ transports: ['websocket', 'polling'] });
const K = window.Kozol;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const App = {
  me: null,
  page: 'play',
  inRoom: false,
  code: null,
  active: null,           // davom etayotgan o'yin {code,...}
  shopKind: 'glove',
  roomFilter: 0,
  rooms: [],
  friends: null,
};

/* ============ YORDAMCHILAR ============ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ask(event, payload) {
  return new Promise((res) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; res({ ok: false, msg: 'Server javob bermadi.' }); } }, 8000);
    socket.emit(event, payload, (r) => { if (!done) { done = true; clearTimeout(t); res(r || {}); } });
  });
}

let toastT;
function toast(msg, kind) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2800);
  if (kind !== 'ok' && kind !== 'info') Sfx.play('error');
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { /* */ }
    ta.remove();
    return ok;
  }
}

function openOv(id) { $('#' + id).classList.add('show'); }
function closeOv(id) { $('#' + id).classList.remove('show'); }
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-close]');
  if (c) closeOv(c.dataset.close);
});
['playerCard', 'inviteModal', 'settings'].forEach((id) => {
  $('#' + id).addEventListener('click', (e) => { if (e.target.id === id) closeOv(id); });
});

/** Oddiy dialog: html + tugmalar. Tanlangan tugma qiymatini qaytaradi. */
let dialogResolve = null;
$('#dialog').addEventListener('click', (e) => {
  if (e.target.id === 'dialog') { closeOv('dialog'); if (dialogResolve) { const r = dialogResolve; dialogResolve = null; r(null); } }
});
function dialog(html, buttons) {
  if (dialogResolve) { dialogResolve(null); dialogResolve = null; }
  return new Promise((res) => {
    dialogResolve = res;
    const body = $('#dialogBody');
    body.innerHTML = html + '<div class="dlg-btns"></div>';
    const box = body.querySelector('.dlg-btns');
    (buttons || [{ label: 'Yopish', value: null, cls: 'btn-ghost' }]).forEach((b) => {
      const el = document.createElement('button');
      el.className = 'btn wide ' + (b.cls || 'btn-dark');
      el.innerHTML = b.label;
      if (b.disabled) el.disabled = true;
      el.addEventListener('click', () => {
        if (b.keep) { if (b.onClick) b.onClick(el); return; }
        closeOv('dialog');
        dialogResolve = null;
        res(b.value);
      });
      box.appendChild(el);
    });
    openOv('dialog');
  });
}

/* ============ AVATAR, RAMKA, LEVEL ============ */
const avaInner = (avatar) => `<span class="ava">${Avatars.html(avatar)}</span>`;
function setAvf(el, avatar, frame) {
  if (!el) return;
  const key = avatar + '|' + frame;
  if (el._k === key) return;
  el._k = key;
  el.className = el.className.replace(/\bfr-\S+/g, '').trim() + ' fr-' + (frame || 'none');
  el.innerHTML = avaInner(avatar);
}
function avfEl(avatar, frame, cls) {
  return `<span class="avf ${cls || ''} fr-${frame || 'none'}">${avaInner(avatar)}</span>`;
}
function lvlHex(level, cls) {
  const t = K.tierOf(level || 1);
  return `<span class="lvl-hex t-${t.id} ${cls || ''}" title="${esc(t.name)}">${level || 1}</span>`;
}
function setLvl(el, level) {
  if (!el) return;
  const t = K.tierOf(level || 1);
  el.textContent = level || 1;
  el.className = el.className.replace(/\bt-\S+/g, '').trim() + ' t-' + t.id;
}

/* ============ SEGMENT TUGMALARI ============ */
function segment(sel, onChange) {
  const el = $(sel);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    el.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    Sfx.play('click');
    if (onChange) onChange(b.dataset.v);
  });
  return () => { const a = el.querySelector('button.active'); return a ? a.dataset.v : null; };
}
function markSeg(sel, v) {
  $$(sel + ' button').forEach((b) => b.classList.toggle('active', b.dataset.v === String(v)));
}

/* ============ SOZLAMALAR ============ */
const DEF_SET = { sfx: true, speech: true, volume: 80, vibrate: true, hints: true, glove: true, bubbles: true, felt: 'emerald', anim: '1' };
let SET = Object.assign({}, DEF_SET);
try { Object.assign(SET, JSON.parse(localStorage.getItem('kozol_settings') || '{}')); } catch (e) { /* */ }
function saveSet() { try { localStorage.setItem('kozol_settings', JSON.stringify(SET)); } catch (e) { /* */ } applySet(); }
function applySet() {
  Sfx.configure({ sfx: SET.sfx, speech: SET.speech, volume: SET.volume / 100, vibrate: SET.vibrate });
  document.body.dataset.felt = SET.felt;
  document.documentElement.style.setProperty('--anim', SET.anim);
  document.body.classList.toggle('no-anim', SET.anim === '0');
  document.body.classList.toggle('fast-anim', SET.anim === '0.6');
  document.body.classList.toggle('no-glove', !SET.glove);
}
applySet();

function openSettings() {
  $('#setSfx').checked = SET.sfx;
  $('#setSpeech').checked = SET.speech;
  $('#setVol').value = SET.volume;
  $('#setVibrate').checked = SET.vibrate;
  $('#setHints').checked = SET.hints;
  $('#setGlove').checked = SET.glove;
  $('#setBubbles').checked = SET.bubbles;
  markSeg('#segFelt', SET.felt);
  markSeg('#segAnim', SET.anim);
  openOv('settings');
}
[['#setSfx', 'sfx'], ['#setSpeech', 'speech'], ['#setVibrate', 'vibrate'], ['#setHints', 'hints'],
 ['#setGlove', 'glove'], ['#setBubbles', 'bubbles']].forEach(([sel, key]) => {
  $(sel).addEventListener('change', (e) => {
    SET[key] = e.target.checked; saveSet();
    if (key === 'glove') { $('#heroFan')._k = ''; renderHero(); }
    if (window.Game) Game.refresh();
  });
});
$('#setVol').addEventListener('input', (e) => { SET.volume = Number(e.target.value); saveSet(); });
$('#setVol').addEventListener('change', () => Sfx.play('ding'));
segment('#segFelt', (v) => { SET.felt = v; saveSet(); });
segment('#segAnim', (v) => { SET.anim = v; saveSet(); });
$('#mSettings').addEventListener('click', openSettings);
$('#btnOpenSettings').addEventListener('click', openSettings);

/* ============ HISOB (brauzerda saqlanadi) ============ */
function loadCreds() {
  try { return JSON.parse(localStorage.getItem('kozol_acc') || 'null') || {}; } catch (e) { return {}; }
}
function saveCreds(c) {
  try { localStorage.setItem('kozol_acc', JSON.stringify(c)); } catch (e) {
    try { localStorage.setItem('kozol_acc', JSON.stringify({ id: c.id, secret: c.secret })); } catch (e2) { /* */ }
  }
}
let CREDS = loadCreds();

async function authenticate() {
  $('#bootText').textContent = 'Hisob tekshirilmoqda…';
  const r = await ask('auth', CREDS);
  if (!r || !r.me) { $('#bootText').textContent = 'Serverga ulanib bo\'lmadi. Qayta urinilmoqda…'; return; }
  if (r.secret) CREDS = { id: r.me.id, secret: r.secret };
  CREDS.id = r.me.id;
  CREDS.snap = r.snap;
  saveCreds(CREDS);
  setMe(r.me);

  // Eski versiyadan qolgan ism va rasmni ko'chiramiz
  if (r.created) {
    try {
      const old = JSON.parse(localStorage.getItem('kozol_profile') || 'null');
      if (old && old.name) socket.emit('profile:update', { name: old.name, avatar: old.avatar });
    } catch (e) { /* */ }
  }
  if (r.restored) toast('Hisobingiz zaxiradan tiklandi.', 'ok');

  $('#boot').classList.remove('show');
  App.active = r.active;

  // Uzilishdan keyin — o'yinga avtomatik qaytamiz
  const wasIn = sessionStorage.getItem('kozol_room');
  if (r.active && (wasIn === r.active.code || App.inRoom)) {
    socket.emit('rejoin', { code: r.active.code });
  } else if (App.inRoom && App.code) {
    const j = await ask('joinRoom', { code: App.code });
    if (!j.ok) { leaveToMenu(true); toast(j.msg || 'Xonaga qaytib bo\'lmadi.'); }
  } else {
    showMenu();
  }
  paintActive();
  if (!App.me.name && !r.created) setTimeout(() => openProfileEdit(true), 300);
  if (r.created) setTimeout(() => { if (!App.me.name) openProfileEdit(true); }, 700);
}

socket.on('connect', () => { setLink(false); authenticate(); });
socket.on('disconnect', () => setLink(true));
socket.on('connect_error', () => { $('#bootText').textContent = 'Server uyg\'onmoqda… (bepul serverda 30–60 soniya)'; });

function setLink(lost) {
  let el = $('#linkWarn');
  if (!el) {
    el = document.createElement('div');
    el.id = 'linkWarn';
    el.className = 'linkwarn';
    el.textContent = 'Aloqa uzildi — qayta ulanmoqda…';
    document.body.appendChild(el);
  }
  el.classList.toggle('show', !!lost && !$('#boot').classList.contains('show'));
}

socket.on('me', (me) => setMe(me));
socket.on('snap', (snap) => { CREDS.snap = snap; saveCreds(CREDS); });

function setMe(me) {
  const prev = App.me;
  App.me = me;
  paintHeader(prev);
  if (App.page === 'profile') renderMyProfile();
  if (App.page === 'shop') renderShop();
  if (App.page === 'friends' && prev && prev.reqIn !== me.reqIn) loadFriends();
  renderHero();
  if (window.Game) Game.onMe(me);
}

function paintHeader(prev) {
  const me = App.me;
  if (!me) return;
  setAvf($('#mAva'), me.avatar, me.frame);
  $('#mName').textContent = me.name || 'Ism kiriting';
  setLvl($('#mLvl'), me.level);
  $('#mLp').style.width = (me.level >= K.MAX_LEVEL ? 100 : me.lp) + '%';
  animateNumber($('#mCoins'), prev ? prev.coins : me.coins, me.coins);
  $$('.coinsMirror').forEach((el) => { el.textContent = me.coins; });
  $('#mDaily').classList.toggle('ready', !!me.dailyReady);
  $('#myId').textContent = me.id;
  const b = $('#friendsBadge');
  b.hidden = !me.reqIn;
  b.textContent = me.reqIn;
}

function animateNumber(el, from, to) {
  if (from === to || SET.anim === '0') { el.textContent = to; return; }
  const t0 = performance.now(), dur = 700;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  if (to > from) { el.parentElement.classList.add('bump'); setTimeout(() => el.parentElement.classList.remove('bump'), 700); }
}

/* ============ KUNLIK BONUS ============ */
$('#mDaily').addEventListener('click', async () => {
  const r = await ask('daily:claim');
  if (r.ok) { Sfx.play('coins'); toast(`+${r.coins} tanga! Ertaga yana keling.`, 'ok'); }
  else toast(r.msg || 'Xato', 'info');
});

/* ============ MENYU / SAHIFALAR ============ */
function showMenu() {
  $('#menu').hidden = false;
  $('#app').hidden = true;
  document.body.classList.remove('in-game');
  setPage(App.page);
}
function showGame() {
  $('#menu').hidden = true;
  $('#app').hidden = false;
  document.body.classList.add('in-game');
  socket.emit('rooms:watch', false);
  clearTimeout(friendsTimer);
}

function setPage(p) {
  App.page = p;
  $$('.m-nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === p));
  $$('.page').forEach((s) => s.classList.toggle('active', s.dataset.page === p));
  socket.emit('rooms:watch', p === 'public' && !App.inRoom);
  if (p === 'friends') loadFriends();
  if (p === 'shop') renderShop();
  if (p === 'profile') renderMyProfile();
  if (p === 'public') renderRooms();
  $('.m-pages').scrollTop = 0;
}
$('#mNav').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  Sfx.play('click');
  setPage(b.dataset.page);
});
$('#mMe').addEventListener('click', () => setPage('profile'));

/* --- Davom etayotgan o'yin banneri --- */
function paintActive() {
  const a = App.active;
  $('#activeBanner').hidden = !(a && !App.inRoom);
  if (a) $('#abCode').textContent = a.code;
}
$('#abBack').addEventListener('click', async () => {
  const r = await ask('rejoin', { code: App.active && App.active.code });
  if (!r.ok) { toast(r.msg); App.active = null; paintActive(); }
});
$('#abQuit').addEventListener('click', async () => {
  const v = await dialog(`<div class="panel-head"><h1>O'yinni tark etasizmi?</h1>
    <p>Bu mag'lubiyat hisoblanadi va LP kamayadi. O'rningizda bot o'ynashda davom etadi.</p></div>`,
    [{ label: 'Ha, tark etaman', value: 'quit', cls: 'btn-danger' }, { label: 'Yo\'q', value: null, cls: 'btn-ghost' }]);
  if (v !== 'quit') return;
  App.quitting = true;
  const r = await ask('rejoin', { code: App.active && App.active.code });
  if (r.ok) await ask('leaveRoom', 'quit');
  App.quitting = false;
  App.active = null;
  leaveToMenu(true);
});

/* ============ O'YNASH SAHIFASI ============ */
const getQuick = segment('#segQuick');
const getMode = segment('#segMode');
const getTarget = segment('#segTarget');
const getVis = segment('#segVis');

function needName() {
  if (App.me && App.me.name) return false;
  toast('Avval profilingizda ism kiriting.');
  openProfileEdit(true);
  return true;
}
function handleJoinFail(r) {
  if (r.active) { App.active = r.active; paintActive(); }
  toast(r.msg || 'Xato yuz berdi.');
}

$('#btnQuick').addEventListener('click', async () => {
  if (needName()) return;
  const r = await ask('quickPlay', { mode: Number(getQuick()) });
  if (!r.ok) return handleJoinFail(r);
  if (r.created) toast('Mos xona topilmadi — yangi ommaviy xona ochildi. Odamlar kelguncha kuting yoki botlar qo\'shing.', 'info');
});

$('#btnCreate').addEventListener('click', async () => {
  if (needName()) return;
  const r = await ask('createRoom', {
    name: $('#inRoomName').value,
    mode: Number(getMode()),
    target: Number(getTarget()),
    isPublic: getVis() === '1',
    bots: $('#inBots').checked,
  });
  if (!r.ok) handleJoinFail(r);
});

$('#btnJoin').addEventListener('click', () => joinByCode($('#inCode').value.trim()));
$('#inCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnJoin').click(); });

async function joinByCode(code, seat) {
  if (needName()) return;
  if (!/^\d{4}$/.test(String(code))) return toast('Xona kodi 4 ta raqamdan iborat.');
  const r = await ask('joinRoom', { code: String(code), seat });
  if (!r.ok) handleJoinFail(r);
}

$('#rulesToggle').addEventListener('click', () => {
  const r = $('#rules');
  r.classList.toggle('hidden');
  $('#rulesToggle').textContent = r.classList.contains('hidden') ? "Qoidalarni ko'rish ▾" : 'Qoidalarni yopish ▴';
});

/* --- Bosh sahifadagi qo'l: sizning qo'lqopingiz va karta skiningiz --- */
function renderHero() {
  const me = App.me;
  if (!me) return;
  const key = me.equip.skin + '|' + me.equip.glove + '|' + SET.glove;
  const box = $('#heroFan');
  if (box._k === key) return;
  box._k = key;
  const cards = ['AH', '10H', 'KS', 'AC'];
  box.innerHTML = `<div class="hf-back">${SET.glove ? Gloves.back(me.equip.glove) : ''}</div>
    <div class="hf-cards">${cards.map((c, i) =>
      `<div class="hf-card" style="--r:${(i - 1.5) * 13}deg">${Cards.face(c, me.equip.skin)}</div>`).join('')}</div>
    <div class="hf-thumb">${SET.glove ? Gloves.thumb(me.equip.glove) : ''}</div>`;
}

/* ============ OMMAVIY XONALAR ============ */
segment('#segRoomFilter', (v) => { App.roomFilter = Number(v); renderRooms(); });
socket.on('rooms', (list) => { App.rooms = list || []; if (App.page === 'public') renderRooms(); });

function renderRooms() {
  const ul = $('#roomList');
  const list = App.rooms.filter((r) => !App.roomFilter || r.mode === App.roomFilter);
  if (!list.length) {
    ul.innerHTML = `<li class="empty-state">
      <div class="es-ico">♠</div>
      <b>Hozircha ommaviy xona yo'q</b>
      <span>Birinchi bo'lib oching — boshqalar shu ro'yxatda ko'radi.</span>
      <button class="btn btn-gold" id="esCreate">Ommaviy xona ochish</button></li>`;
    $('#esCreate').addEventListener('click', () => { setPage('play'); markSeg('#segVis', '1'); $('#inRoomName').focus(); });
    return;
  }
  ul.innerHTML = list.map((r) => {
    const status = r.phase === 'lobby' ? 'Kutilmoqda' : r.phase === 'matchEnd' ? 'Tugadi' : "O'yinda";
    const seats = r.players.map((p, i) => p
      ? `<span class="rs ${p.bot ? 'bot' : ''} t${i % 2}" title="${esc(p.name)}${p.bot ? ' (bot)' : ''}">${avfEl(p.avatar, p.bot ? 'none' : p.frame, 'xs')}${p.bot ? '<i>🤖</i>' : ''}</span>`
      : `<span class="rs empty t${i % 2}" title="Bo'sh o'rin"></span>`).join('');
    const btn = r.joinable
      ? `<button class="btn btn-gold sm" data-join="${r.code}">${r.phase === 'lobby' ? 'Kirish' : 'Bot o\'rniga'}</button>`
      : `<button class="btn btn-ghost sm" disabled>Joy yo'q</button>`;
    return `<li class="room-row ph-${r.phase}">
      <div class="rr-main">
        <b>${esc(r.name)}</b>
        <span class="rr-meta"><span class="chip">${r.mode === 4 ? '2×2' : '1×1'}</span><span class="chip">${r.target}</span>
          <span class="chip st">${status}</span><span class="rr-code">#${r.code}</span></span>
      </div>
      <div class="rr-seats">${seats}</div>
      ${btn}
    </li>`;
  }).join('');
}
$('#roomList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-join]');
  if (b) joinByCode(b.dataset.join);
});

/* ============ DO'STLAR ============ */
$('#myIdChip').addEventListener('click', async () => {
  if (App.me && await copyText(App.me.id)) toast('ID nusxalandi — do\'stingizga yuboring.', 'ok');
});
$('#btnFindFriend').addEventListener('click', () => {
  const id = $('#inFriendId').value.trim();
  if (!/^\d{8}$/.test(id)) return toast('ID 8 ta raqamdan iborat.');
  openPlayer(id);
});
$('#inFriendId').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnFindFriend').click(); });

let friendsTimer = null;
async function loadFriends() {
  clearTimeout(friendsTimer);
  const r = await ask('friends:list');
  if (r && r.friends) { App.friends = r; renderFriends(); }
  if (App.page === 'friends' && !App.inRoom) friendsTimer = setTimeout(loadFriends, 12000);
  return r;
}

function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'hozirgina';
  if (m < 60) return m + ' daqiqa oldin';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' soat oldin';
  return Math.round(h / 24) + ' kun oldin';
}
function statusText(f) {
  if (!f.online) return f.lastSeen ? 'Oxirgi marta: ' + ago(f.lastSeen) : 'Oflayn';
  if (!f.room) return 'Onlayn';
  return f.room.phase === 'lobby' ? `Xona #${f.room.code} da kutyapti` : `O'ynayapti · #${f.room.code}`;
}

function personRow(f, actions) {
  return `<li class="prow" data-id="${f.id}">
    <button class="prow-who" data-open="${f.id}">
      <span class="prow-ava">${avfEl(f.avatar, f.frame, 'sm')}<span class="on-dot ${f.online ? 'on' : ''}"></span></span>
      <span class="prow-meta"><b><span class="pn">${esc(f.name)}</span> ${lvlHex(f.level, 'sm')}</b><small>${esc(actions.sub || statusText(f))}</small></span>
    </button>
    <span class="prow-act">${actions.html || ''}</span>
  </li>`;
}

function renderFriends() {
  const F = App.friends;
  const box = $('#friendsBody');
  if (!F) { box.innerHTML = ''; return; }
  let h = '';
  if (F.reqIn.length) {
    h += `<h4 class="sec">Do'stlik so'rovlari <i class="badge">${F.reqIn.length}</i></h4><ul class="plist">` +
      F.reqIn.map((f) => personRow(f, { html:
        `<button class="btn btn-gold sm" data-accept="${f.id}">Qabul</button><button class="btn btn-ghost sm" data-decline="${f.id}">Rad</button>` })).join('') + '</ul>';
  }
  h += `<h4 class="sec">Do'stlarim · ${F.friends.length}</h4>`;
  if (!F.friends.length) {
    h += `<div class="empty-state small"><b>Hali do'stlaringiz yo'q</b>
      <span>Do'stingizning ID sini yuqoriga yozing yoki birga o'ynaganlarni pastdan qo'shing. Sizning ID: <b>${App.me ? App.me.id : ''}</b></span></div>`;
  } else {
    h += '<ul class="plist">' + F.friends.map((f) => personRow(f, { html:
      (f.room && f.room.joinable && f.room.code !== App.code ? `<button class="btn btn-gold sm" data-joincode="${f.room.code}">Qo'shilish</button>` : '') })).join('') + '</ul>';
  }
  if (F.reqOut.length) {
    h += `<h4 class="sec">Yuborilgan so'rovlar</h4><ul class="plist">` +
      F.reqOut.map((f) => personRow(f, { sub: 'Javob kutilmoqda', html: `<button class="btn btn-ghost sm" data-cancel="${f.id}">Bekor</button>` })).join('') + '</ul>';
  }
  if (F.recent.length) {
    h += `<h4 class="sec">Yaqinda birga o'ynaganlar</h4><ul class="plist">` +
      F.recent.map((f) => personRow(f, { sub: 'Birga o\'ynadingiz · ' + ago(f.t), html:
        F.reqOut.some((x) => x.id === f.id) ? '' : `<button class="btn btn-dark sm" data-add="${f.id}" title="Do'st qo'shish"><svg><use href="#i-plus"/></svg></button>` })).join('') + '</ul>';
  }
  box.innerHTML = h;
}

$('#friendsBody').addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.open) return openPlayer(d.open);
  if (d.joincode) return joinByCode(d.joincode);
  let r;
  if (d.accept) r = await ask('friend:accept', d.accept);
  else if (d.decline) r = await ask('friend:decline', d.decline);
  else if (d.cancel) r = await ask('friend:remove', d.cancel);
  else if (d.add) r = await ask('friend:request', d.add);
  if (r) {
    if (r.ok) { Sfx.play('ding'); if (d.add) toast(r.accepted ? 'Endi do\'stsiz!' : 'So\'rov yuborildi.', 'ok'); }
    else toast(r.msg || 'Xato');
    loadFriends();
  }
});

/* ============ O'YINCHI KARTOCHKASI (PUBG uslubida) ============ */
function statTile(v, label) { return `<div class="st"><b>${v}</b><small>${label}</small></div>`; }

function playerCardHTML(p, opts = {}) {
  const tier = K.tierOf(p.level);
  const suit = p.favSuit ? `<span class="suit suit-${p.favSuit}">${K.SUIT_CHAR[p.favSuit]}</span>` : '';
  const lpPct = p.level >= K.MAX_LEVEL ? 100 : p.lp;
  const next = p.next ? `<small>Keyingi g'alaba <b class="plus">+${p.next.win}</b> · mag'lubiyat <b class="minus">−${p.next.loss}</b> LP</small>` : '';
  const s = p.stats;
  const gifts = p.topGifts && p.topGifts.length
    ? p.topGifts.map((g) => { const it = K.GIFT[g.id]; return it ? `<span class="gchip" title="${esc(it.name)}">${it.emoji}<b>${g.n}</b></span>` : ''; }).join('')
    : '<span class="muted">Hali sovg\'a olmagan</span>';
  const glove = K.GLOVE[p.equip.glove] || K.GLOVES[0];
  const skin = K.SKIN[p.equip.skin] || K.SKINS[0];
  return `<div class="pc tier-${tier.id}">
    <div class="pc-banner"></div>
    <div class="pc-top">
      ${avfEl(p.avatar, p.frame, 'xl')}
      <div class="pc-id">
        <h2><span>${esc(p.name)}</span> ${p.online !== undefined ? `<span class="on-dot ${p.online ? 'on' : ''}" title="${p.online ? 'Onlayn' : 'Oflayn'}"></span>` : ''}</h2>
        <div class="pc-sub">ID ${p.id}${p.region ? ' · ' + esc(p.region) : ''} ${suit}</div>
        ${p.bio ? `<div class="pc-bio">${esc(p.bio)}</div>` : ''}
      </div>
    </div>
    <div class="pc-level">
      ${lvlHex(p.level, 'lg')}
      <div class="pc-tier">
        <div class="pc-tier-name"><b>${tier.name}</b><span>${p.level >= K.MAX_LEVEL ? 'Maksimal level!' : `${p.lp} / ${K.LP_PER_LEVEL} LP`}</span></div>
        <div class="lp-bar big"><i style="width:${lpPct}%"></i></div>
        ${next}
      </div>
    </div>
    <div class="pc-stats">
      ${statTile(s.games, "O'yinlar")}${statTile(s.wins, "G'alaba")}${statTile(s.winRate + '%', 'Yutish')}
      ${statTile(s.bestStreak, 'Eng uzun seriya')}${statTile(s.kozolGiven, 'Kozol qildi')}${statTile(s.sofKozol, 'Sof kozol')}
      ${statTile(s.kozolTaken, 'Kozol bo\'ldi')}${statTile(p.popularity, 'Mashhurlik')}
    </div>
    <div class="pc-equip">
      <div class="pe"><div class="pe-img">${Gloves.icon(glove.id)}</div><small>${esc(glove.name)}</small></div>
      <div class="pe"><div class="pe-img cards">${Cards.face('AH', skin.id)}${Cards.face('10S', skin.id)}</div><small>${esc(skin.name)}</small></div>
      <div class="pe gifts"><div class="pe-gifts">${gifts}</div><small>Olgan sovg'alari</small></div>
    </div>
    ${opts.actions || ''}
  </div>`;
}

function renderMyProfile() {
  const me = App.me;
  if (!me) return;
  const ladder = `<div class="ladder">${K.TIERS.map((t) =>
    `<div class="lad ${me.level >= t.min ? 'got' : ''}"><span class="lvl-hex t-${t.id} sm">${t.min}</span><small>${t.name}</small></div>`).join('')}</div>`;
  $('#myCard').innerHTML = playerCardHTML(me, { actions: ladder });
}

async function openPlayer(id, ctx = {}) {
  const r = await ask('profile:get', id);
  if (!r.ok) return toast(r.msg || 'O\'yinchi topilmadi.');
  const p = r.profile;
  let acts = '';
  if (p.isMe) acts = `<button class="btn btn-gold" data-pc="edit">Profilni tahrirlash</button>`;
  else {
    if (p.isFriend) acts += `<button class="btn btn-ghost" data-pc="unfriend">Do'stlar ✓</button>`;
    else if (p.requestedMe) acts += `<button class="btn btn-gold" data-pc="accept">So'rovni qabul qilish</button>`;
    else if (p.requested) acts += `<button class="btn btn-ghost" disabled>So'rov yuborilgan</button>`;
    else acts += `<button class="btn btn-gold" data-pc="add"><svg><use href="#i-plus"/></svg> Do'st qo'shish</button>`;
    acts += `<button class="btn btn-dark" data-pc="gift"><svg><use href="#i-gift"/></svg> Sovg'a</button>`;
    if (ctx.seat !== undefined && window.Voice && Voice.active) {
      acts += `<button class="btn btn-dark" data-pc="mute">${Voice.mutedSeats.has(ctx.seat) ? 'Ovozini yoqish' : 'Ovozini o\'chirish'}</button>`;
    }
  }
  $('#pcBody').innerHTML = playerCardHTML(p, { actions: `<div class="pc-actions">${acts}</div>` });
  $('#pcBody').onclick = async (e) => {
    const b = e.target.closest('[data-pc]');
    if (!b) return;
    const a = b.dataset.pc;
    if (a === 'edit') { closeOv('playerCard'); return openProfileEdit(); }
    if (a === 'mute') { const m = Voice.togglePeer(ctx.seat); toast(m ? 'Bu o\'yinchining ovozi o\'chirildi.' : 'Ovoz yoqildi.', 'info'); closeOv('playerCard'); return; }
    if (a === 'gift') return giftPicker(p, ctx);
    let res;
    if (a === 'add') res = await ask('friend:request', p.id);
    if (a === 'accept') res = await ask('friend:accept', p.id);
    if (a === 'unfriend') {
      const v = await dialog(`<div class="panel-head"><h1>Do'stlikdan chiqarasizmi?</h1><p>${esc(p.name)}</p></div>`,
        [{ label: 'Ha, chiqarish', value: 1, cls: 'btn-danger' }, { label: 'Yo\'q', value: 0, cls: 'btn-ghost' }]);
      if (!v) return;
      res = await ask('friend:remove', p.id);
    }
    if (res) {
      if (res.ok) Sfx.play('ding');
      toast(res.ok ? (res.accepted ? 'Endi do\'stsiz!' : res.pending ? 'So\'rov yuborildi.' : 'Tayyor.') : res.msg, res.ok ? 'ok' : '');
      openPlayer(p.id, ctx);
      if (App.page === 'friends') loadFriends();
    }
  };
  openOv('playerCard');
}

/** Profil oynasidan sovg'a yuborish */
async function giftPicker(p, ctx = {}) {
  const inv = App.me.inv.gifts;
  const have = K.GIFTS.filter((g) => inv[g.id] > 0);
  if (!have.length) {
    const v = await dialog(`<div class="panel-head"><h1>Sovg'alaringiz yo'q</h1><p>Do'kondan sovg'a sotib oling — keyin istalgan o'yinchiga yubora olasiz.</p></div>`,
      [{ label: 'Do\'konga o\'tish', value: 1, cls: 'btn-gold', disabled: App.inRoom }, { label: 'Yopish', value: 0, cls: 'btn-ghost' }]);
    if (v) { closeOv('playerCard'); App.shopKind = 'gift'; markShopTab(); setPage('shop'); }
    return;
  }
  const html = `<div class="panel-head"><h1>${esc(p.name)} ga sovg'a</h1><p>Bitta sovg'a yuboriladi</p></div>
    <div class="fx-grid inline">${have.map((g) => `<button class="fx-item" data-g="${g.id}"><span class="e">${g.emoji}</span><small>${esc(g.name)} ×${inv[g.id]}</small></button>`).join('')}</div>`;
  const pr = dialog(html, [{ label: 'Bekor', value: null, cls: 'btn-ghost' }]);
  $('#dialogBody').querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', async () => {
    closeOv('dialog');
    const gid = b.dataset.g;
    // O'yin ichida bo'lsak — stol ustida uchib boradi
    if (App.inRoom && ctx.seat !== undefined && window.Game) {
      closeOv('playerCard');
      return Game.sendFx('gift', gid, ctx.seat);
    }
    const r = await ask('gift:send', { to: p.id, id: gid });
    if (r.ok) { Sfx.item(K.GIFT[gid]); toast('Sovg\'a yuborildi!', 'ok'); openPlayer(p.id, ctx); }
    else toast(r.msg);
  }));
  await pr;
}

/* ============ PROFILNI TAHRIRLASH ============ */
let draft = null;
function openProfileEdit(first) {
  const me = App.me;
  if (!me) return;
  draft = { avatar: me.avatar, frame: me.frameChoice || 'auto' };
  $('#pfName').value = me.name || '';
  $('#pfBio').value = me.bio || '';
  $('#pfRegion').innerHTML = K.REGIONS.map((r) => `<option value="${esc(r)}">${r ? esc(r) : '—'}</option>`).join('');
  $('#pfRegion').value = me.region || '';
  $('#pfSuit').value = me.favSuit || '';
  $('#pfReq').checked = me.privacy.friendReq;
  $('#pfInv').checked = me.privacy.invites;
  $('#pfNote').textContent = 'PNG yoki JPG · 160×160 ga kichraytiriladi';
  $('#pfCancel').style.display = first ? 'none' : '';
  renderAvaGrid();
  renderFrameGrid();
  paintPreview();
  openOv('profileEdit');
  setTimeout(() => $('#pfName').focus(), 80);
}
function curFrameFor(choice) {
  if (choice === 'none') return 'none';
  if (choice === 'auto') return K.tierOf(App.me.level).id;
  return choice;
}
function paintPreview() { setAvf($('#pfPreview'), draft.avatar, curFrameFor(draft.frame)); }

function renderAvaGrid() {
  const g = $('#avaGrid');
  if (!g.childElementCount) {
    Avatars.ids.forEach((id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.id = id;
      b.innerHTML = `<span class="ava">${Avatars.preset(id)}</span>`;
      b.addEventListener('click', () => { draft.avatar = id; paintPreview(); markAvaGrid(); });
      g.appendChild(b);
    });
  }
  markAvaGrid();
}
function markAvaGrid() { $$('#avaGrid button').forEach((b) => b.classList.toggle('on', b.dataset.id === draft.avatar)); }

function renderFrameGrid() {
  const lvl = App.me.level;
  const opts = [{ id: 'auto', name: 'Levelga mos' }]
    .concat(K.TIERS.map((t) => ({ id: t.id, name: t.name, min: t.min })))
    .concat([{ id: 'none', name: 'Ramkasiz' }]);
  $('#frameGrid').innerHTML = opts.map((o) => {
    const locked = o.min && lvl < o.min;
    const fr = o.id === 'auto' ? K.tierOf(lvl).id : o.id;
    return `<button type="button" class="fr-opt ${draft.frame === o.id ? 'on' : ''}" data-f="${o.id}" ${locked ? 'disabled' : ''}>
      <span class="avf sm fr-${fr}">${avaInner(draft.avatar)}</span><small>${o.name}${locked ? `<br>${o.min}-level` : ''}</small></button>`;
  }).join('');
}
$('#frameGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b || b.disabled) return;
  draft.frame = b.dataset.f;
  renderFrameGrid();
  paintPreview();
});

$('#pfCancel').addEventListener('click', () => closeOv('profileEdit'));
$('#pfSave').addEventListener('click', async () => {
  const nm = $('#pfName').value.trim();
  if (!nm) return toast('Ismingizni kiriting.');
  const r = await ask('profile:update', {
    name: nm, avatar: draft.avatar, bio: $('#pfBio').value, region: $('#pfRegion').value,
    favSuit: $('#pfSuit').value, frame: draft.frame,
    privacy: { friendReq: $('#pfReq').checked, invites: $('#pfInv').checked },
  });
  if (r.ok) { closeOv('profileEdit'); toast('Profil saqlandi.', 'ok'); Sfx.play('ding'); }
  else toast(r.msg || 'Saqlab bo\'lmadi.');
});
$('#btnEditProfile').addEventListener('click', () => openProfileEdit());

/* --- Rasm yuklash: kvadrat qilib kesib, 160×160 --- */
$('#pfFile').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type)) return toast('Faqat rasm fayli bo\'lishi kerak.');
  if (file.size > 12 * 1024 * 1024) return toast('Rasm juda katta (12 MB dan kam bo\'lsin).');
  $('#pfNote').textContent = 'Rasm tayyorlanmoqda…';
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const N = 160;
      const cv = document.createElement('canvas');
      cv.width = cv.height = N;
      const ctx = cv.getContext('2d');
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, N, N);
      let q = 0.82;
      let out = cv.toDataURL('image/jpeg', q);
      while (out.length > 60000 && q > 0.35) { q -= 0.12; out = cv.toDataURL('image/jpeg', q); }
      draft.avatar = out;
      paintPreview();
      markAvaGrid();
      renderFrameGrid();
      $('#pfNote').textContent = 'Rasm tayyor · ' + Math.round(out.length / 1024) + ' KB';
    };
    img.onerror = () => { $('#pfNote').textContent = 'Rasmni o\'qib bo\'lmadi.'; };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

/* ============ DO'KON ============ */
const SHOP_NOTES = {
  glove: "O'yinda kartalaringizni ushlab turgan qo'lga kiyiladi. Bir marta sotib olinadi.",
  skin: "Qo'lingizdagi va siz tashlagan kartalar rangi o'zgaradi. Raqam va belgilar o'sha-o'sha qoladi.",
  sticker: "O'yin paytida tashlanadi, hammaga ko'rinadi va ovozi chiqadi. Bir marta olinsa — cheksiz.",
  gift: "Boshqa o'yinchiga yuboriladi — uning mashhurligi oshadi. Har yuborishda 1 dona kamayadi.",
};
function markShopTab() { $$('#shopTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.k === App.shopKind)); }
$('#shopTabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (!t) return;
  App.shopKind = t.dataset.k;
  markShopTab();
  Sfx.play('click');
  renderShop();
});

function ownedState(kind, it) {
  const me = App.me;
  if (kind === 'glove') return me.equip.glove === it.id ? 'equipped' : me.inv.gloves.includes(it.id) ? 'owned' : 'buy';
  if (kind === 'skin') return me.equip.skin === it.id ? 'equipped' : me.inv.skins.includes(it.id) ? 'owned' : 'buy';
  if (kind === 'sticker') return it.price === 0 || me.inv.stickers.includes(it.id) ? 'owned' : 'buy';
  return 'buy';
}
const priceTag = (p) => `<span class="price"><i class="coin"></i>${p}</span>`;

function renderShop() {
  const me = App.me;
  if (!me) return;
  const kind = App.shopKind;
  $('#shopNote').textContent = SHOP_NOTES[kind];
  const list = kind === 'glove' ? K.GLOVES : kind === 'skin' ? K.SKINS : kind === 'sticker' ? K.STICKERS : K.GIFTS;
  $('#shopGrid').className = 'shop-grid k-' + kind;
  $('#shopGrid').innerHTML = list.map((it) => {
    const st = ownedState(kind, it);
    let pic;
    if (kind === 'glove') pic = Gloves.icon(it.id);
    else if (kind === 'skin') pic = `<div class="sk-pair">${Cards.face('AH', it.id)}${Cards.face('KS', it.id)}</div>`;
    else pic = `<span class="emo">${it.emoji}</span>`;
    let foot;
    if (kind === 'gift') foot = `${priceTag(it.price)}${me.inv.gifts[it.id] ? `<span class="have">×${me.inv.gifts[it.id]}</span>` : ''}`;
    else if (st === 'equipped') foot = '<span class="tag on">Kiyilgan</span>';
    else if (st === 'owned') foot = `<span class="tag">${it.price === 0 ? 'Bepul' : 'Sizda bor'}</span>`;
    else foot = priceTag(it.price);
    const afford = st !== 'buy' || me.coins >= it.price;
    return `<button class="shop-item st-${st} ${afford ? '' : 'poor'}" data-id="${it.id}">
      <div class="si-pic">${pic}</div><b>${esc(it.name)}</b><div class="si-foot">${foot}</div></button>`;
  }).join('');
}

$('#shopGrid').addEventListener('click', (e) => {
  const b = e.target.closest('.shop-item');
  if (b) shopItemDialog(App.shopKind, b.dataset.id);
});

async function shopItemDialog(kind, id) {
  const me = App.me;
  const it = (kind === 'glove' ? K.GLOVE : kind === 'skin' ? K.SKIN : kind === 'sticker' ? K.STICKER : K.GIFT)[id];
  if (!it) return;
  const st = ownedState(kind, it);
  let pic;
  if (kind === 'glove') pic = `<div class="dlg-glove">${Gloves.icon(id)}</div>`;
  else if (kind === 'skin') pic = `<div class="dlg-skin">${['AH', '10C', 'KS', '7D'].map((c, i) => `<div style="--r:${(i - 1.5) * 10}deg">${Cards.face(c, id)}</div>`).join('')}</div>`;
  else pic = `<div class="dlg-emo">${it.emoji}</div><p class="say">«${esc(it.say)}»</p>`;
  const extra = kind === 'gift' ? `<p class="set-note tc">Sizda: ${me.inv.gifts[id] || 0} dona · oluvchiga +${it.pop} mashhurlik</p>` : '';
  const html = `<div class="panel-head"><h1>${esc(it.name)}</h1><p>${SHOP_NOTES[kind]}</p></div>${pic}${extra}`;
  const btns = [];
  if (kind === 'sticker' || kind === 'gift') btns.push({ label: '▶ Ovozini eshitish', keep: true, cls: 'btn-dark', onClick: () => Sfx.item(it) });
  if (kind === 'gift') {
    [1, 5, 10].forEach((q) => btns.push({ label: `${q} dona — ${it.price * q} tanga`, value: 'buy' + q, cls: q === 1 ? 'btn-gold' : 'btn-dark', disabled: me.coins < it.price * q }));
  } else if (st === 'buy') {
    btns.push({ label: me.coins < it.price ? `Tanga yetmaydi — ${it.price} kerak` : `Sotib olish — ${it.price} tanga`, value: 'buy1', cls: 'btn-gold', disabled: me.coins < it.price });
  } else if (st === 'owned' && kind !== 'sticker') {
    btns.push({ label: 'Kiyish', value: 'equip', cls: 'btn-gold' });
  }
  btns.push({ label: 'Yopish', value: null, cls: 'btn-ghost' });
  const v = await dialog(html, btns);
  if (!v) return;
  if (v === 'equip') {
    const r = await ask('shop:equip', { kind, id });
    if (r.ok) { Sfx.play('ding'); toast(`${it.name} kiyildi.`, 'ok'); } else toast(r.msg);
    return;
  }
  const qty = Number(v.slice(3)) || 1;
  const r = await ask('shop:buy', { kind, id, qty });
  if (r.ok) {
    Sfx.play('coins');
    toast(kind === 'gift' ? `${it.name} ×${qty} sotib olindi!` : kind === 'sticker' ? `${it.name} stikeri sizniki!` : `${it.name} sizniki va darhol kiyildi!`, 'ok');
  } else toast(r.msg);
}

/* ============ BILDIRISHNOMALAR ============ */
function note(html, buttons, ms = 9000) {
  const box = $('#notes');
  const el = document.createElement('div');
  el.className = 'note';
  el.innerHTML = `<div class="note-body">${html}</div><div class="note-btns"></div>`;
  const nb = el.querySelector('.note-btns');
  (buttons || []).forEach((b) => {
    const x = document.createElement('button');
    x.className = 'btn sm ' + (b.cls || 'btn-dark');
    x.textContent = b.label;
    x.addEventListener('click', () => { el.remove(); if (b.onClick) b.onClick(); });
    nb.appendChild(x);
  });
  const close = document.createElement('button');
  close.className = 'note-x';
  close.innerHTML = '<svg><use href="#i-close"/></svg>';
  close.addEventListener('click', () => el.remove());
  el.appendChild(close);
  box.appendChild(el);
  while (box.childElementCount > 3) box.firstElementChild.remove();
  Sfx.play('msg');
  Sfx.vibrate(60);
  setTimeout(() => el.remove(), ms);
}

socket.on('notify', (n) => {
  const who = n.from ? `${avfEl(n.from.avatar, n.from.frame, 'sm')}<b>${esc(n.from.name)}</b>` : '';
  if (n.type === 'friendRequest') {
    note(`${who} sizga do'stlik so'rovi yubordi`, [
      { label: 'Qabul', cls: 'btn-gold', onClick: async () => { const r = await ask('friend:accept', n.from.id); toast(r.ok ? 'Endi do\'stsiz!' : r.msg, r.ok ? 'ok' : ''); if (App.page === 'friends') loadFriends(); } },
      { label: 'Profil', onClick: () => openPlayer(n.from.id) },
    ]);
  } else if (n.type === 'friendAccepted') {
    note(`${who} do'stlik so'rovingizni qabul qildi 🎉`);
  } else if (n.type === 'gift') {
    const g = K.GIFT[n.item];
    if (g) { note(`${who} sizga sovg'a yubordi: <span class="note-emo">${g.emoji}</span> ${esc(g.name)}`); Sfx.item(g); }
  }
  if (App.page === 'friends') loadFriends();
});

socket.on('invite', (inv) => {
  note(`${avfEl(inv.from.avatar, inv.from.frame, 'sm')}<b>${esc(inv.from.name)}</b> sizni o'yinga taklif qildi
    <small>${inv.mode === 4 ? '2×2' : '1×1'} · xona #${inv.code}</small>`, [
    { label: 'Qo\'shilish', cls: 'btn-gold', onClick: () => joinByCode(inv.code) },
    { label: 'Keyin', cls: 'btn-ghost' },
  ], 20000);
});

/* ============ ZAXIRA / TIKLASH ============ */
$('#btnBackup').addEventListener('click', async () => {
  const code = btoa(unescape(encodeURIComponent(JSON.stringify({ id: CREDS.id, secret: CREDS.secret, snap: CREDS.snap }))));
  if (await copyText(code)) toast('Zaxira kodi nusxalandi. Uni hech kimga bermang — bu hisobingiz kaliti.', 'ok');
  else toast('Nusxalab bo\'lmadi.');
});
$('#btnRestore').addEventListener('click', async () => {
  closeOv('settings');
  const pr = dialog(`<div class="panel-head"><h1>Hisobni tiklash</h1>
    <p>Boshqa qurilmada nusxalagan zaxira kodini qo'ying. Shu qurilmadagi hozirgi hisob almashtiriladi.</p></div>
    <textarea id="restoreText" class="restore" rows="5" placeholder="Zaxira kodi…"></textarea>`,
    [{ label: 'Tiklash', value: 'ok', cls: 'btn-gold' }, { label: 'Bekor', value: null, cls: 'btn-ghost' }]);
  const ta = $('#restoreText');
  const v = await pr;
  if (v !== 'ok') return;
  try {
    const c = JSON.parse(decodeURIComponent(escape(atob(ta.value.trim()))));
    if (!c.id || !c.secret) throw new Error('bad');
    saveCreds(c);
    toast('Tiklanmoqda…', 'info');
    setTimeout(() => location.reload(), 500);
  } catch (e) { toast('Zaxira kodi noto\'g\'ri.'); }
});

/* ============ XONADAN CHIQIB MENYUGA ============ */
function leaveToMenu(silent) {
  App.inRoom = false;
  App.code = null;
  sessionStorage.removeItem('kozol_room');
  ['waiting', 'matchEnd', 'roundEnd', 'coin', 'leaveConfirm', 'inviteModal'].forEach(closeOv);
  if (window.Voice && Voice.active) Voice.stop();
  if (window.Game) Game.reset();
  showMenu();
  paintActive();
  if (!silent) Sfx.play('leave');
}

window.App = App;
window.AppUI = {
  esc, ask, toast, dialog, openOv, closeOv, setAvf, avfEl, lvlHex, setLvl, openPlayer,
  showGame, showMenu, leaveToMenu, paintActive, loadFriends, copyText, segment, markSeg, giftPicker,
  set: () => SET,
};

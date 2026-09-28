/* ============================================================
   game.js — o'yin stoli
   Kartalar, qo'l (qo'lqop bilan), yurishlar, chat, stikerlar,
   ovozli qo'ng'iroq, chiqish, qo'l/match yakuni va mukofotlar.
   ============================================================ */
'use strict';

const Game = (() => {
  const U = window.AppUI;
  const { esc, ask, toast, openOv, closeOv, setAvf, avfEl, setLvl } = U;

  let S = null;              // serverdan kelgan oxirgi holat
  let selected = [];
  let mySeat = -1;
  let pendingDeal = false;
  let centerLock = 0;
  let lastHandKey = '';
  let lastPlayCount = 0;
  let prevTurn = -1;
  let gloveKey = '';
  let chatLog = [];
  let unread = 0;
  let chatTab = 'chat';
  let fxKind = 'sticker';
  let fxTarget = -1;
  let lastReward = null;

  /* ============ KARTA ELEMENTI ============ */
  function cardEl(id, faceDown, skin) {
    const d = document.createElement('div');
    d.className = 'card' + (faceDown ? ' down' : '');
    d.dataset.id = id;
    const front = faceDown || id === '??' ? '' : Cards.face(id, skin);
    d.innerHTML = `<div class="card-inner"><div class="f">${front}</div><div class="b">${Cards.back()}</div></div>`;
    return d;
  }
  function miniBack() {
    const d = document.createElement('div');
    d.className = 'mini';
    d.innerHTML = Cards.back();
    return d;
  }
  const skinOf = (seat) => (S && S.players[seat] ? S.players[seat].skin : 'classic');

  /* ============ O'RIN JOYLASHUVI ============
     Soat strelkasi bo'ylab: siz (past) → chap → yuqori → o'ng.        */
  function posOf(seat) {
    if (mySeat < 0 || !S) return null;
    const n = S.mode;
    const rel = (seat - mySeat + n) % n;
    if (n === 2) return rel === 0 ? 'south' : 'north';
    return ['south', 'west', 'north', 'east'][rel];
  }
  function seatNode(seat) {
    const p = posOf(seat);
    if (!p) return null;
    return p === 'south' ? $('#meTag') : $('#seat-' + p + ' .seat-tag');
  }
  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function banner(text) {
    const b = $('#turnBanner');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(banner._t);
    banner._t = setTimeout(() => b.classList.remove('show'), 2000);
  }

  /* ============ SOCKET ============ */
  socket.on('joined', ({ code, seat, rejoin }) => {
    const fresh = App.code !== code;
    App.inRoom = true;
    App.code = code;
    App.active = null;
    sessionStorage.setItem('kozol_room', code);
    mySeat = seat;
    if (fresh || rejoin) {
      selected = []; lastHandKey = ''; lastPlayCount = 0; centerLock = 0;
      $('#center').innerHTML = '';
      if (fresh) { chatLog = []; unread = 0; paintUnread(); }
    }
    U.showGame();
    U.paintActive();
    Sfx.play('join');
    if (rejoin) toast("O'yinga qaytdingiz.", 'ok');
  });

  socket.on('chatHistory', (list) => { chatLog = list || []; renderChat(); });

  socket.on('state', (st) => {
    S = st;
    mySeat = st.seat;
    if (window.Voice) Voice.syncSeats(st.voice);
    render(st);
  });

  socket.on('errorMsg', (m) => toast(m));

  socket.on('kicked', (msg) => { toast(msg || 'Xonadan chiqarildingiz.'); U.leaveToMenu(true); });

  socket.on('quitPenalty', (r) => toast(`O'yin tark etildi: ${r.lpDelta} LP`, 'info'));

  socket.on('deal', () => { pendingDeal = true; lastHandKey = ''; lastPlayCount = 0; Sfx.play('deal'); });

  socket.on('drew', () => {
    $('#deckZone').classList.add('shake');
    setTimeout(() => $('#deckZone').classList.remove('shake'), 320);
    Sfx.play('deal');
  });

  socket.on('played', (d) => {
    Sfx.play('card');
    if (d.beat && d.seat !== mySeat) Sfx.vibrate(20);
  });

  socket.on('coinflip', (d) => {
    closeOv('waiting');
    closeOv('matchEnd');
    const ov = $('#coin');
    openOv('coin');
    $('#coinCard').innerHTML = Cards.face(d.card);
    $('#coinResult').innerHTML = '';
    setTimeout(() => {
      const mine = d.team === (mySeat % 2);
      $('#coinResult').innerHTML =
        `Ochilgan karta <b>${esc(d.color)}</b> — <b>${d.team + 1}-jamoa</b> boshlaydi (${esc(d.name)})` +
        (mine ? '<br><b>Birinchi yurish sizniki!</b>' : '');
    }, 850);
    setTimeout(() => ov.classList.remove('show'), 3100);
  });

  socket.on('trickWon', (d) => {
    centerLock = Date.now() + 900;
    const usTeam = mySeat % 2;
    const vault = d.team === usTeam ? $('#vaultUs') : $('#vaultThem');
    const vr = vault.getBoundingClientRect();
    $$('#center .playgroup').forEach((g) => {
      const gr = g.getBoundingClientRect();
      g.style.setProperty('--sx', (vr.left + vr.width / 2 - gr.left - gr.width / 2) + 'px');
      g.style.setProperty('--sy', (vr.top + vr.height / 2 - gr.top - gr.height / 2) + 'px');
      g.querySelectorAll('.card.down').forEach((c) => {
        if (c.dataset.id && c.dataset.id !== '??') c.classList.remove('down');
      });
      setTimeout(() => g.classList.add('sweep'), 260);
    });
    vault.classList.add('hit');
    setTimeout(() => vault.classList.remove('hit'), 500);
    const nm = S && S.players[d.seat] ? S.players[d.seat].name : '';
    banner(`${nm} qo'lni oldi · +${d.points} ochko`);
    Sfx.play(d.team === usTeam ? 'take' : 'card');
  });

  socket.on('roundEnd', (d) => {
    const us = mySeat % 2;
    $('#reLabel').textContent = d.label;
    $('#rePtUs').textContent = d.points[us];
    $('#rePtThem').textContent = d.points[1 - us];
    $('#reMatch').textContent = d.loser === null
      ? 'Durang — hisob o\'zgarmadi'
      : `${d.loser === us ? 'Biz' : 'Ular'} ${d.delta} ball oldi · Umumiy: ${d.matchScore[us]} : ${d.matchScore[1 - us]}`;
    openOv('roundEnd');
    Sfx.play(d.loser === null ? 'ding' : d.loser === us ? 'lose' : 'take');
    if (!d.finished) setTimeout(() => closeOv('roundEnd'), 5600);
  });

  socket.on('matchEnd', (d) => {
    const us = mySeat % 2;
    closeOv('roundEnd');
    const won = d.winTeam === us;
    $('#meTitle').textContent = won ? '🏆 Siz yutdingiz!' : 'Bu safar yutqazdingiz';
    $('#meScore').textContent = `Hisob: ${d.matchScore[us]} : ${d.matchScore[1 - us]}`;
    $('#reward').hidden = true;
    const host = S && mySeat === S.hostSeat;
    $('#btnRematch').style.display = host ? '' : 'none';
    openOv('matchEnd');
    Sfx.play(won ? 'fanfare' : 'lose');
    if (lastReward && Date.now() - lastReward.t < 3000) showReward(lastReward.r);
  });

  socket.on('reward', (r) => {
    lastReward = { r, t: Date.now() };
    if ($('#matchEnd').classList.contains('show')) showReward(r);
  });

  socket.on('backToLobby', () => {
    closeOv('matchEnd');
    lastHandKey = ''; lastPlayCount = 0;
    $('#center').innerHTML = '';
  });

  /* ============ MUKOFOT ANIMATSIYASI ============ */
  function showReward(r) {
    lastReward = null;
    $('#reward').hidden = false;
    const lpEl = $('#rwLp');
    lpEl.textContent = (r.lpDelta > 0 ? '+' : '') + r.lpDelta;
    lpEl.className = r.lpDelta >= 0 ? 'plus' : 'minus';
    $('#rwCoins').innerHTML = `<i class="coin"></i>+${r.coins + r.levelBonus}`;
    const notes = [];
    if (r.ups) notes.push(`<b>Level oshdi!</b> ${r.before.level} → ${r.after.level} · bonus +${r.levelBonus} tanga`);
    if (r.vsBots) notes.push('Raqiblar botlar edi — mukofot yarmi berildi.');
    if (r.after.level >= K.MAX_LEVEL) notes.push('Siz maksimal levelga yetdingiz — Afsona!');
    $('#rwNote').innerHTML = notes.join('<br>');

    const hex = $('#rwLvl');
    const bar = $('#rwBar');
    const txt = $('#rwLpText');
    setLvl(hex, r.before.level);
    bar.style.transition = 'none';
    bar.style.width = r.before.lp + '%';
    txt.textContent = `${r.before.lp} / ${K.LP_PER_LEVEL}`;
    void bar.offsetWidth;
    const fill = (to, ms) => { bar.style.transition = `width ${ms}ms cubic-bezier(.22,.85,.28,1)`; bar.style.width = to + '%'; };
    let step = 0;
    const levels = r.ups;
    const tick = () => {
      if (step < levels) {
        fill(100, 700);
        setTimeout(() => {
          step++;
          setLvl(hex, r.before.level + step);
          hex.classList.add('pop');
          setTimeout(() => hex.classList.remove('pop'), 600);
          Sfx.play('levelup');
          bar.style.transition = 'none';
          bar.style.width = '0%';
          void bar.offsetWidth;
          tick();
        }, 760);
      } else {
        fill(r.after.level >= K.MAX_LEVEL ? 100 : r.after.lp, 700);
        txt.textContent = r.after.level >= K.MAX_LEVEL ? 'MAX' : `${r.after.lp} / ${K.LP_PER_LEVEL}`;
        setTimeout(() => Sfx.play('coins'), 500);
      }
    };
    setTimeout(tick, 350);
  }

  /* ============ RENDER ============ */
  function render(st) {
    // Kutish xonasi
    if (st.phase === 'lobby') {
      openOv('waiting');
      renderWaiting(st);
    } else {
      closeOv('waiting');
      closeOv('inviteModal');
    }
    if (st.phase !== 'matchEnd') closeOv('matchEnd');

    $('#roomCode').textContent = st.code;

    const us = mySeat % 2;
    $('#matchT0').textContent = st.matchScore[us];
    $('#matchT1').textContent = st.matchScore[1 - us];
    $('#roundT0').textContent = st.roundPoints[us] + ' ochko';
    $('#roundT1').textContent = st.roundPoints[1 - us] + ' ochko';
    $('#scoreT0').classList.toggle('lead', st.matchScore[us] > st.matchScore[1 - us]);
    $('#scoreT1').classList.toggle('lead', st.matchScore[1 - us] > st.matchScore[us]);

    // Talon va zot
    $('#deckCount').textContent = st.deckCount;
    $('#trumpName').innerHTML = st.trump
      ? `Zot: <span class="suit-${st.trump}">${K.SUIT_CHAR[st.trump]}</span> ${K.SUIT_UZ[st.trump]}` : 'Zot: —';
    const tc = $('#trumpCard');
    if (st.trumpCard && !st.trumpTaken) {
      if (tc.dataset.id !== st.trumpCard) { tc.innerHTML = Cards.face(st.trumpCard); tc.dataset.id = st.trumpCard; }
      tc.style.display = '';
    } else { tc.style.display = 'none'; tc.dataset.id = ''; }
    const stack = $('#deckStack');
    const layers = Math.min(4, Math.ceil(st.deckCount / 6));
    if (stack.childElementCount !== layers) {
      stack.innerHTML = '';
      for (let i = 0; i < layers; i++) {
        const l = document.createElement('div');
        l.className = 'layer';
        l.style.transform = `translate(${i * -2}px, ${i * -2}px)`;
        l.innerHTML = Cards.back();
        stack.appendChild(l);
      }
    }
    $('#vaultUsN').textContent = st.vaultCount[us];
    $('#vaultThemN').textContent = st.vaultCount[1 - us];

    // Raqiblar
    ['north', 'west', 'east'].forEach((p) => {
      const node = $('#seat-' + p);
      node.style.display = 'none';
      node.classList.remove('active', 'mate');
    });
    st.players.forEach((pl, seat) => {
      if (!pl || seat === mySeat) return;
      const p = posOf(seat);
      if (p === 'south' || !p) return;
      const node = $('#seat-' + p);
      node.style.display = '';
      node.classList.toggle('active', st.turn === seat && st.phase === 'playing');
      node.classList.toggle('mate', st.mode === 4 && (seat % 2) === us);
      node.classList.toggle('offline', !!pl.accId && !pl.connected);
      const tag = node.querySelector('.seat-tag');
      tag.dataset.seat = seat;
      const mark = pl.bot && !pl.accId ? ' 🤖' : pl.quit ? '' : pl.away || (!pl.connected && pl.accId) ? ' 💤' : '';
      tag.querySelector('.nm').textContent = pl.name + mark;
      setAvf(tag.querySelector('.avf'), pl.avatar, pl.frame);
      setLvl(tag.querySelector('.lvl-hex'), pl.level);
      tag.querySelector('.cnt').textContent = pl.cardCount + ' karta';
      paintMic(tag.querySelector('.mic'), pl);
      const box = node.querySelector('.seat-cards');
      if (box.childElementCount !== pl.cardCount) {
        box.innerHTML = '';
        for (let i = 0; i < pl.cardCount; i++) box.appendChild(miniBack());
      }
    });

    const me = st.players[mySeat];
    const meTag = $('#meTag');
    meTag.dataset.seat = mySeat;
    meTag.classList.toggle('active', st.turn === mySeat && st.phase === 'playing');
    setAvf(meTag.querySelector('.avf'), me ? me.avatar : App.me.avatar, me ? me.frame : App.me.frame);
    meTag.querySelector('.nm').textContent = me
      ? `${me.name} · ${st.mode === 4 ? (us === 0 ? '1-jamoa' : '2-jamoa') : 'siz'}` : '';
    if (me) paintMic(meTag.querySelector('.mic'), me);

    // Navbat tovushi
    if (st.phase === 'playing' && st.turn === mySeat && prevTurn !== mySeat) {
      Sfx.play('turn');
      Sfx.vibrate(80);
    }
    prevTurn = st.turn;

    renderCenter(st);
    renderGlove(st);
    renderHand(st);
    $('#log').innerHTML = (st.log || []).slice().reverse().map((l) => `<li>${esc(l)}</li>`).join('');
    paintVoice();
  }

  function paintMic(el, pl) {
    if (!el) return;
    el.className = 'mic' + (pl.inVoice ? ' on' : '') + (pl.inVoice && pl.micMuted ? ' muted' : '') +
      (window.Voice && Voice.mutedSeats.has(pl.seat) ? ' silenced' : '');
    el.innerHTML = pl.inVoice ? `<svg><use href="#${pl.micMuted ? 'i-micoff' : 'i-mic'}"/></svg>` : '';
  }

  /* ============ KUTISH XONASI ============ */
  function renderWaiting(st) {
    $('#waitCode').textContent = st.code;
    $('#waitName').textContent = st.name || 'Xona';
    $('#waitVis').textContent = st.isPublic ? 'Ommaviy' : 'Faqat kod bilan';
    $('#waitVis').classList.toggle('private', !st.isPublic);
    const isHost = mySeat === st.hostSeat;
    const ul = $('#seatList');
    ul.innerHTML = '';
    for (let i = 0; i < st.mode; i++) {
      const p = st.players[i];
      const li = document.createElement('li');
      li.className = `team-${i % 2}`;
      if (!p) {
        li.className += ' empty';
        li.dataset.switch = i;
        li.innerHTML = `<span class="avf sm fr-none"><span class="ava"></span></span><span class="sl-name">Bo'sh o'rin<small>Bosib shu yerga o'ting</small></span>` +
          `<span class="tm">${(i % 2) + 1}-jamoa</span>`;
      } else {
        const me = i === mySeat;
        li.className += me ? ' me' : '';
        li.innerHTML = `${avfEl(p.avatar, p.frame, 'sm')}
          <span class="sl-name">${esc(p.name)}${p.bot ? ' 🤖' : ''}
            <small>${U.lvlHex(p.level, 'sm')} ${i === st.hostSeat ? 'Mezbon' : me ? 'Siz' : p.bot ? 'Bot' : 'O\'yinchi'}${p.inVoice ? ' · 🎙' : ''}</small></span>
          <span class="tm">${(i % 2) + 1}-jamoa</span>
          ${isHost && !me ? `<button class="icon-btn tiny kick" data-kick="${i}" title="Chiqarish"><svg><use href="#i-close"/></svg></button>` : ''}`;
        if (p.accId && !me) li.dataset.open = p.accId;
      }
      ul.appendChild(li);
    }
    const full = st.players.every(Boolean);
    $('#btnStart').disabled = !isHost || !full;
    $('#btnBots').style.display = isHost && !full ? '' : 'none';
    $('#btnStart').textContent = isHost ? (full ? "O'yinni boshlash" : 'O\'yinchilar kutilmoqda…') : 'Mezbon boshlashini kuting…';
  }

  $('#seatList').addEventListener('click', (e) => {
    const k = e.target.closest('[data-kick]');
    if (k) { socket.emit('kick', Number(k.dataset.kick)); return; }
    const li = e.target.closest('li');
    if (!li) return;
    if (li.dataset.switch !== undefined) socket.emit('switchSeat', Number(li.dataset.switch));
    else if (li.dataset.open) U.openPlayer(li.dataset.open, { seat: Number(li.dataset.seat) });
  });
  $('#btnBots').addEventListener('click', () => socket.emit('addBots'));
  $('#btnStart').addEventListener('click', async () => {
    const r = await ask('start');
    if (r && r.ok === false) toast(r.msg);
  });
  $('#btnWaitLeave').addEventListener('click', async () => {
    await ask('leaveRoom', 'bot');
    U.leaveToMenu();
  });
  $('#btnCopyCode').addEventListener('click', async () => {
    if (S && await U.copyText(S.code)) toast('Xona kodi nusxalandi.', 'ok');
  });
  $('#btnWaitChat').addEventListener('click', () => openChat());

  /* --- Do'stlarni taklif qilish --- */
  $('#btnInvite').addEventListener('click', async () => {
    const ul = $('#inviteList');
    ul.innerHTML = '<li class="muted tc">Yuklanmoqda…</li>';
    openOv('inviteModal');
    const r = await U.loadFriends();
    const inRoom = new Set((S ? S.players : []).filter(Boolean).map((p) => p.accId));
    const list = (r && r.friends ? r.friends : []).filter((f) => f.online && !inRoom.has(f.id));
    if (!list.length) {
      ul.innerHTML = `<li class="empty-state small"><b>Hozir onlayn do'stlaringiz yo'q</b>
        <span>Xona kodini yuboring: <b>${S ? S.code : ''}</b>${S && S.isPublic ? ' — yoki ular «Ommaviy» bo\'limidan topadi.' : ''}</span></li>`;
      return;
    }
    ul.innerHTML = list.map((f) => `<li class="prow"><span class="prow-who">${avfEl(f.avatar, f.frame, 'sm')}
      <span class="prow-meta"><b>${esc(f.name)} ${U.lvlHex(f.level, 'sm')}</b><small>${f.room ? 'Boshqa xonada' : 'Onlayn'}</small></span></span>
      <span class="prow-act"><button class="btn btn-gold sm" data-inv="${f.id}">Taklif</button></span></li>`).join('');
  });
  $('#inviteList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-inv]');
    if (!b) return;
    const r = await ask('invite', b.dataset.inv);
    if (r.ok) { b.textContent = 'Yuborildi ✓'; b.disabled = true; Sfx.play('ding'); }
    else toast(r.msg);
  });

  /* ============ STOL MARKAZI ============ */
  function renderCenter(st) {
    if (Date.now() < centerLock) return;
    const c = $('#center');
    const plays = st.trick ? st.trick.plays : [];
    if (plays.length < lastPlayCount || plays.length === 0) {
      c.innerHTML = '';
      lastPlayCount = 0;
    }
    for (let i = lastPlayCount; i < plays.length; i++) {
      const pl = plays[i];
      const g = document.createElement('div');
      g.className = 'playgroup' + (i === 0 ? ' lead' : '');
      const who = document.createElement('div');
      who.className = 'who';
      const nm = st.players[pl.seat] ? st.players[pl.seat].name : '';
      who.textContent = i === 0 ? nm + ' · yurdi' : pl.hidden ? nm + ' · yopdi' : nm;
      g.appendChild(who);
      const skin = skinOf(pl.seat);
      pl.cards.forEach((id) => g.appendChild(cardEl(id, pl.hidden, skin)));
      c.appendChild(g);
      const node = seatNode(pl.seat);
      if (node) {
        const n = centerOf(node);
        const gr = g.getBoundingClientRect();
        g.style.setProperty('--fx', (n.x - gr.left - gr.width / 2) + 'px');
        g.style.setProperty('--fy', (n.y - gr.top - gr.height / 2) + 'px');
        g.style.setProperty('--fr', (Math.random() * 16 - 8) + 'deg');
      }
      g.classList.add('fly');
      g.addEventListener('animationend', () => g.classList.remove('fly'), { once: true });
    }
    lastPlayCount = plays.length;
    $$('#center .playgroup').forEach((g, i) =>
      g.classList.toggle('win', !!(st.trick && plays[i] && plays[i].seat === st.trick.bestSeat)));
  }

  /* ============ QO'LQOP ============ */
  function renderGlove(st) {
    const me = st.players[mySeat];
    const glove = me ? me.glove : App.me.equip.glove;
    const show = U.set().glove && st.phase !== 'lobby' && (st.hand || []).length > 0;
    $('#handWrap').classList.toggle('gloved', show);
    const key = show ? glove : '';
    if (key === gloveKey) return;
    gloveKey = key;
    $('#gloveBack').innerHTML = show ? Gloves.back(glove) : '';
    $('#gloveThumb').innerHTML = show ? Gloves.thumb(glove) : '';
  }

  /* ============ QO'L ============ */
  function renderHand(st) {
    const hand = st.hand || [];
    const me = st.players[mySeat];
    const skin = me ? me.skin : 'classic';
    const key = hand.join(',') + '|' + skin;
    const box = $('#hand');
    if (key !== lastHandKey) {
      const deckRect = $('#deckZone').getBoundingClientRect();
      box.innerHTML = '';
      box.dataset.n = hand.length;
      hand.forEach((id, i) => {
        const el = cardEl(id, false, skin);
        const mid = (hand.length - 1) / 2;
        el.style.setProperty('--rot', ((i - mid) * 7).toFixed(1) + 'deg');
        el.style.setProperty('--drop', (Math.abs(i - mid) * Math.abs(i - mid) * 3).toFixed(1) + 'px');
        el.addEventListener('click', () => toggleSelect(id));
        box.appendChild(el);
      });
      if (pendingDeal) {
        Array.from(box.children).forEach((el, i) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty('--dx', (deckRect.left - r.left) + 'px');
          el.style.setProperty('--dy', (deckRect.top - r.top) + 'px');
          el.style.setProperty('--d', (i * 90) + 'ms');
          el.classList.add('dealing');
          el.addEventListener('animationend', () => el.classList.remove('dealing'), { once: true });
        });
        pendingDeal = false;
      }
      selected = selected.filter((c) => hand.includes(c));
      lastHandKey = key;
    }
    paintSelection(st);
    updateActions(st);
  }

  function toggleSelect(id) {
    if (!S || S.turn !== mySeat || S.phase !== 'playing') return;
    const i = selected.indexOf(id);
    if (i >= 0) selected.splice(i, 1);
    else {
      // Kerakli sondan ortiq tanlansa — eng eskisini almashtiramiz
      if (S.legal && S.legal.role === 'follow' && selected.length >= S.legal.count) selected.shift();
      selected.push(id);
    }
    Sfx.play('click');
    paintSelection(S);
    updateActions(S);
  }

  $('#btnClear').addEventListener('click', () => {
    selected = [];
    if (!S) return;
    paintSelection(S);
    updateActions(S);
  });

  function paintSelection(st) {
    $$('#hand .card').forEach((el) => {
      const id = el.dataset.id;
      el.classList.toggle('sel', selected.includes(id));
      el.classList.toggle('hintable', canHint(st, id));
      el.classList.toggle('dead', !isSelectable(st, id));
    });
  }

  /** Karta stoldagilarni urishda qatnasha oladimi (yoritish uchun) */
  function canHint(st, id) {
    if (!U.set().hints || !st || st.turn !== mySeat || !st.legal || st.legal.role === 'lead') return false;
    return st.legal.openable.includes(id);
  }
  function isSelectable(st, id) {
    if (!st || st.turn !== mySeat || !st.legal) return true;
    if (st.legal.role === 'lead') {
      if (!selected.length) return true;
      return K.suitOf(id) === K.suitOf(selected[0]) || selected.includes(id);
    }
    return true; // yopib berish uchun har qanday karta yaraydi
  }

  function openPlayValid(st) {
    if (!st.legal) return false;
    if (st.legal.role === 'lead') {
      const cap = st.legal.maxLead || 4;
      if (!selected.length || selected.length > cap) return false;
      const s = K.suitOf(selected[0]);
      return selected.every((c) => K.suitOf(c) === s);
    }
    if (selected.length !== st.legal.count) return false;
    return K.beatsAll(selected, st.legal.best, st.trump);
  }

  const cardsLabel = (arr) => arr.map((c) => {
    const s = K.suitOf(c);
    return `<span class="cl suit-${s}">${K.label(c)}</span>`;
  }).join(' ');

  function updateActions(st) {
    const myTurn = st && st.phase === 'playing' && st.turn === mySeat;
    const bPlay = $('#btnPlay'), bCover = $('#btnCover'), hint = $('#hint');
    $('.actions').classList.toggle('idle', !myTurn);
    if (!myTurn) {
      bPlay.disabled = bCover.disabled = true;
      bCover.style.display = '';
      hint.textContent = st && st.phase === 'playing'
        ? (st.players[st.turn] ? st.players[st.turn].name + ' o\'ylayapti…' : '…')
        : (st && st.phase === 'roundEnd' ? 'Qo\'l yakunlandi' : st && st.phase === 'lobby' ? 'O\'yinchilar kutilmoqda…' : 'Kuting…');
      return;
    }
    const lead = st.legal.role === 'lead';
    const valid = openPlayValid(st);
    bPlay.disabled = !valid;
    bCover.disabled = lead || selected.length !== st.legal.count;
    bCover.style.display = lead ? 'none' : '';
    bPlay.textContent = lead ? 'Yurish' : 'Urish';

    if (lead) {
      hint.textContent = selected.length
        ? `${selected.length} ta karta tanlandi — «Yurish» ni bosing`
        : `Sizning yurishingiz: bir mastadagi 1–${st.legal.maxLead || 4} ta kartani tanlang`;
      return;
    }
    const need = st.legal.count;
    const base = `Ustida: ${cardsLabel(st.legal.best)}`;
    if (!st.legal.canOpen) {
      hint.innerHTML = `${base} — urolmaysiz, ${need} ta kartani yopib bering`;
    } else if (selected.length === need && !valid) {
      hint.innerHTML = `${base} — bu kartalar <b>har birini</b> urmaydi (katta karta yoki zot kerak). Yopib berish mumkin`;
    } else {
      hint.innerHTML = need > 1
        ? `${base} — har bir kartani alohida urish kerak (${need} ta)`
        : `${base} — urish yoki yopib berish`;
    }
  }

  $('#btnPlay').addEventListener('click', () => {
    if (!S || S.turn !== mySeat) return;
    if (!openPlayValid(S)) return toast('Bu yurish qoidaga to\'g\'ri kelmaydi.');
    socket.emit('play', { cards: selected.slice(), hidden: false });
    selected = [];
  });
  $('#btnCover').addEventListener('click', () => {
    if (!S || S.turn !== mySeat || !S.legal || S.legal.role === 'lead') return;
    if (selected.length !== S.legal.count) return toast(`${S.legal.count} ta karta tanlang.`);
    socket.emit('play', { cards: selected.slice(), hidden: true });
    selected = [];
  });

  /* Klaviatura: 1..4 — karta, Enter — yurish, Probel — yopib berish */
  document.addEventListener('keydown', (e) => {
    if (!App.inRoom || !S || S.turn !== mySeat) return;
    if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
    if (e.key >= '1' && e.key <= '9') {
      const el = $$('#hand .card')[Number(e.key) - 1];
      if (el) toggleSelect(el.dataset.id);
    }
    if (e.key === 'Enter' && !$('#btnPlay').disabled) $('#btnPlay').click();
    if (e.key === ' ' && !$('#btnCover').disabled) { e.preventDefault(); $('#btnCover').click(); }
  });

  /* O'yinchi nomini bosganda — profil kartochkasi */
  $('#table').addEventListener('click', (e) => {
    const t = e.target.closest('.seat-tag');
    if (!t || !S) return;
    const seat = Number(t.dataset.seat);
    const p = S.players[seat];
    if (!p) return;
    if (p.accId && !p.quit) U.openPlayer(p.accId, { seat });
    else toast(`${p.name} — kompyuter o'yinchisi`, 'info');
  });
  $('#meTag').addEventListener('click', () => { if (App.me) U.openPlayer(App.me.id); });

  /* ============ CHAT ============ */
  function openChat(tab) {
    if (tab) setChatTab(tab);
    $('#chatDrawer').classList.add('open');
    $('#chatDrawer').setAttribute('aria-hidden', 'false');
    unread = 0;
    paintUnread();
    renderChat();
    setTimeout(() => { if (window.innerWidth > 700) $('#chatInput').focus(); }, 200);
  }
  function closeChat() {
    $('#chatDrawer').classList.remove('open');
    $('#chatDrawer').setAttribute('aria-hidden', 'true');
  }
  const chatOpen = () => $('#chatDrawer').classList.contains('open');
  $('#btnChat').addEventListener('click', () => (chatOpen() ? closeChat() : openChat()));
  $('#chatClose').addEventListener('click', closeChat);

  function setChatTab(t) {
    chatTab = t;
    $$('#chatTabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
    $('#chatBody').classList.toggle('hidden', t !== 'chat');
    $('#log').classList.toggle('hidden', t !== 'log');
    $('#quickchat').classList.toggle('hidden', t !== 'chat');
    $('#chatForm').classList.toggle('hidden', t !== 'chat');
  }
  $('#chatTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) setChatTab(b.dataset.t);
  });

  function paintUnread() {
    [$('#chatBadge'), $('#waitChatBadge')].forEach((b) => {
      b.hidden = !unread;
      b.textContent = unread > 9 ? '9+' : unread;
    });
  }

  function renderChat() {
    const box = $('#chatBody');
    if (!chatLog.length) {
      box.innerHTML = '<div class="chat-empty">Hali xabar yo\'q. Birinchi bo\'lib salom bering 👋</div>';
      return;
    }
    const myId = App.me && App.me.id;
    box.innerHTML = chatLog.map((m) => {
      const mine = m.accId === myId;
      const time = new Date(m.t).toTimeString().slice(0, 5);
      return `<div class="msg ${mine ? 'mine' : ''}">
        ${mine ? '' : `<span class="ava sm">${Avatars.html(m.avatar)}</span>`}
        <div class="msg-b">${mine ? '' : `<b>${esc(m.name)}</b>`}<p>${esc(m.text)}</p><time>${time}</time></div>
      </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  socket.on('chat', (m) => {
    chatLog.push(m);
    if (chatLog.length > 100) chatLog.shift();
    const mine = App.me && m.accId === App.me.id;
    if (chatOpen() && chatTab === 'chat') renderChat();
    else if (!mine) { unread++; paintUnread(); }
    if (!mine) Sfx.play('msg');
    if (U.set().bubbles && !$('#app').hidden) bubble(m.seat, m.text);
  });

  function bubble(seat, text) {
    const anchor = seatNode(seat);
    if (!anchor || anchor.offsetParent === null) return;
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text.length > 70 ? text.slice(0, 68) + '…' : text;
    const c = centerOf(anchor);
    $('#bubbles').appendChild(el);
    const w = el.offsetWidth;
    el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, c.x - w / 2)) + 'px';
    el.style.top = Math.max(60, c.y - anchor.offsetHeight / 2 - el.offsetHeight - 8) + 'px';
    setTimeout(() => el.remove(), 3400);
  }

  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#chatInput');
    const t = inp.value.trim();
    if (!t) return;
    socket.emit('chat', t);
    inp.value = '';
  });
  $('#quickchat').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) socket.emit('chat', b.textContent);
  });

  /* ============ STIKER VA SOVG'ALAR ============ */
  function openFx() {
    $('#fxSheet').classList.add('open');
    renderFx();
  }
  function closeFx() { $('#fxSheet').classList.remove('open'); }
  $('#btnFx').addEventListener('click', () => ($('#fxSheet').classList.contains('open') ? closeFx() : openFx()));
  $('#fxClose').addEventListener('click', closeFx);
  $('#fxTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    fxKind = b.dataset.k;
    $$('#fxTabs .tab').forEach((x) => x.classList.toggle('active', x === b));
    renderFx();
  });

  function renderFx() {
    if (!S || !App.me) return;
    // Kimga
    const others = S.players.filter((p) => p && p.seat !== mySeat);
    if (fxKind === 'gift' && (fxTarget < 0 || fxTarget === mySeat || !S.players[fxTarget])) fxTarget = others.length ? others[0].seat : -1;
    const opts = (fxKind === 'sticker' ? [{ seat: -1, name: 'Hammaga' }] : []).concat(others);
    $('#fxTarget').innerHTML = '<span class="fx-to">Kimga:</span>' + opts.map((p) =>
      `<button class="fx-who ${fxTarget === p.seat ? 'on' : ''}" data-to="${p.seat}">${p.seat >= 0 ? avfEl(p.avatar, p.frame, 'xs') : '🌐'}<span>${esc(p.name)}</span></button>`).join('');
    const me = App.me;
    const list = fxKind === 'sticker' ? K.STICKERS : K.GIFTS;
    $('#fxGrid').innerHTML = list.map((it) => {
      const own = fxKind === 'sticker' ? (it.price === 0 || me.inv.stickers.includes(it.id)) : (me.inv.gifts[it.id] || 0) > 0;
      const badge = fxKind === 'gift' ? (own ? `<i class="q">×${me.inv.gifts[it.id]}</i>` : `<i class="q buy"><i class="coin"></i>${it.price}</i>`)
        : (own ? '' : `<i class="q buy"><i class="coin"></i>${it.price}</i>`);
      return `<button class="fx-item ${own ? '' : 'locked'}" data-id="${it.id}" title="${esc(it.name)}"><span class="e">${it.emoji}</span><small>${esc(it.name)}</small>${badge}</button>`;
    }).join('');
  }
  $('#fxTarget').addEventListener('click', (e) => {
    const b = e.target.closest('[data-to]');
    if (!b) return;
    fxTarget = Number(b.dataset.to);
    renderFx();
  });
  $('#fxGrid').addEventListener('click', async (e) => {
    const b = e.target.closest('.fx-item');
    if (!b) return;
    const id = b.dataset.id;
    const it = fxKind === 'sticker' ? K.STICKER[id] : K.GIFT[id];
    if (b.classList.contains('locked')) {
      const v = await U.dialog(`<div class="panel-head"><h1>${it.emoji} ${esc(it.name)}</h1>
        <p>${fxKind === 'sticker' ? 'Bu stiker sizda yo\'q. Bir marta sotib olsangiz — cheksiz ishlatasiz.' : 'Bu sovg\'a tugagan.'}</p></div>
        <p class="say tc">«${esc(it.say)}»</p>`, [
        { label: '▶ Ovozini eshitish', keep: true, cls: 'btn-dark', onClick: () => Sfx.item(it) },
        { label: `Sotib olish — ${it.price} tanga`, value: 'buy', cls: 'btn-gold', disabled: App.me.coins < it.price },
        { label: 'Yopish', value: null, cls: 'btn-ghost' },
      ]);
      if (v !== 'buy') return;
      const r = await ask('shop:buy', { kind: fxKind, id, qty: 1 });
      if (!r.ok) return toast(r.msg);
      Sfx.play('coins');
      setTimeout(renderFx, 150);
      return;
    }
    sendFx(fxKind, id, fxTarget);
  });

  async function sendFx(kind, id, to) {
    const r = await ask('fx', { kind, id, to });
    if (!r.ok) return toast(r.msg || 'Yuborib bo\'lmadi.');
    if (window.innerWidth < 700) closeFx();
  }

  socket.on('fx', (d) => {
    const it = d.kind === 'sticker' ? K.STICKER[d.id] : K.GIFT[d.id];
    if (!it) return;
    flyEmoji(d.from, d.to, it, d.kind);
    Sfx.item(it);
    if ($('#fxSheet').classList.contains('open')) setTimeout(renderFx, 200);
  });

  function flyEmoji(from, to, it, kind) {
    const src = seatNode(from);
    const tgt = to >= 0 ? seatNode(to) : $('#center');
    if (!src || !tgt || $('#app').hidden) return;
    const a = centerOf(src);
    const b = to >= 0 ? centerOf(tgt) : centerOf($('#table'));
    const el = document.createElement('div');
    el.className = 'fly-emo ' + kind;
    el.textContent = it.emoji;
    el.style.left = a.x + 'px';
    el.style.top = a.y + 'px';
    el.style.setProperty('--tx', (b.x - a.x) + 'px');
    el.style.setProperty('--ty', (b.y - a.y) + 'px');
    $('#fxLayer').appendChild(el);
    el.addEventListener('animationend', () => {
      el.remove();
      // Tushgan joyda "portlash"
      const pop = document.createElement('div');
      pop.className = 'pop-emo';
      pop.textContent = it.emoji;
      pop.style.left = b.x + 'px';
      pop.style.top = b.y + 'px';
      $('#fxLayer').appendChild(pop);
      for (let i = 0; i < 8; i++) {
        const s = document.createElement('i');
        s.className = 'spark';
        s.style.left = b.x + 'px';
        s.style.top = b.y + 'px';
        s.style.setProperty('--a', (i * 45) + 'deg');
        $('#fxLayer').appendChild(s);
        setTimeout(() => s.remove(), 700);
      }
      setTimeout(() => pop.remove(), 1500);
    }, { once: true });
  }

  /* ============ OVOZLI CHAT ============ */
  if (window.Voice) {
    Voice.init(socket);
    Voice.onError = (m) => toast(m);
    Voice.onChange = () => paintVoice();
    Voice.onSpeaking = (seat, on) => {
      const node = seat === 'me' ? $('#meTag') : seatNode(seat);
      if (node) node.classList.toggle('speaking', on);
      const chip = $(`#vbPeople [data-s="${seat === 'me' ? mySeat : seat}"]`);
      if (chip) chip.classList.toggle('speaking', on);
    };
  }

  socket.on('voice:joined', ({ name, seat }) => {
    Sfx.play('join');
    if (window.Voice && !Voice.active && App.inRoom) {
      toast(`${name} ovozli chatni boshladi — 📞 tugmasini bosing`, 'info');
      $('#btnVoice').classList.add('ring');
      setTimeout(() => $('#btnVoice').classList.remove('ring'), 6000);
    }
  });

  $('#btnVoice').addEventListener('click', async () => {
    if (!window.Voice) return;
    if (!Voice.active) {
      $('#btnVoice').classList.remove('ring');
      const ok = await Voice.start();
      if (ok) { Sfx.play('join'); toast('Ovozli chatga ulandingiz.', 'ok'); }
    } else {
      $('#voiceBar').classList.toggle('collapsed');
    }
  });
  $('#vbMute').addEventListener('click', () => Voice.setMuted(!Voice.muted));
  $('#vbDeaf').addEventListener('click', () => Voice.setDeafened(!Voice.deafened));
  $('#vbEnd').addEventListener('click', () => { Voice.stop(); Sfx.play('leave'); });

  let vbTimer = null;
  function paintVoice() {
    if (!window.Voice) return;
    const on = Voice.active;
    $('#voiceBar').hidden = !on;
    $('#btnVoice').classList.toggle('live', on);
    $('#btnVoice').querySelector('use').setAttribute('href', on ? (Voice.muted ? '#i-micoff' : '#i-mic') : '#i-phone');
    $('#vbMute').classList.toggle('off', Voice.muted);
    $('#vbMute').querySelector('use').setAttribute('href', Voice.muted ? '#i-micoff' : '#i-mic');
    $('#vbDeaf').classList.toggle('off', Voice.deafened);
    $('#vbDeaf').querySelector('use').setAttribute('href', Voice.deafened ? '#i-speakeroff' : '#i-speaker');
    if (on && S) {
      const people = S.players.filter((p) => p && p.inVoice);
      $('#vbPeople').innerHTML = people.map((p) =>
        `<span class="vbp ${p.micMuted ? 'muted' : ''}" data-s="${p.seat}" title="${esc(p.name)}">${avfEl(p.avatar, 'none', 'xs')}</span>`).join('');
    }
    if (on && !vbTimer) {
      vbTimer = setInterval(() => {
        const s = Math.floor((Date.now() - Voice.startedAt) / 1000);
        $('#vbTime').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      }, 1000);
    }
    if (!on && vbTimer) { clearInterval(vbTimer); vbTimer = null; $('#vbTime').textContent = '00:00'; }
  }

  /* ============ CHIQISH ============ */
  $('#btnExit').addEventListener('click', async () => {
    if (!S) return U.leaveToMenu();
    if (S.phase === 'lobby' || S.phase === 'matchEnd') {
      await ask('leaveRoom', 'bot');
      return U.leaveToMenu();
    }
    const me = App.me;
    $('#quitNote').textContent = `Mag'lubiyat hisoblanadi: −${K.lossLp(me.level) * K.REWARD.QUIT_FACTOR} LP`;
    openOv('leaveConfirm');
  });
  $('#btnLeaveBot').addEventListener('click', async () => {
    const code = S && S.code;
    await ask('leaveRoom', 'bot');
    U.leaveToMenu();
    App.active = { code };
    U.paintActive();
    toast('O\'rningizda bot o\'ynayapti. Istalgan payt «Qaytish» ni bosing.', 'info');
  });
  $('#btnLeaveQuit').addEventListener('click', async () => {
    await ask('leaveRoom', 'quit');
    App.active = null;
    U.leaveToMenu();
  });

  $('#btnRematch').addEventListener('click', () => socket.emit('rematch'));
  $('#btnLeave').addEventListener('click', async () => {
    await ask('leaveRoom', 'bot');
    U.leaveToMenu();
  });

  window.addEventListener('resize', () => { if (S) renderCenter(S); });

  /* ============ TASHQI INTERFEYS ============ */
  function reset() {
    S = null;
    mySeat = -1;
    selected = [];
    lastHandKey = '';
    lastPlayCount = 0;
    gloveKey = '';
    prevTurn = -1;
    chatLog = [];
    unread = 0;
    paintUnread();
    closeChat();
    closeFx();
    $('#center').innerHTML = '';
    $('#hand').innerHTML = '';
    $('#gloveBack').innerHTML = '';
    $('#gloveThumb').innerHTML = '';
  }
  function refresh() {
    if (!S) return;
    lastHandKey = '';
    gloveKey = '_';
    render(S);
  }
  function onMe() {
    if ($('#fxSheet').classList.contains('open')) renderFx();
  }

  setChatTab('chat');
  return { reset, refresh, onMe, sendFx };
})();

window.Game = Game;

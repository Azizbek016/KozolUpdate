/* ============================================================
   voice.js — ovozli chat (qo'ng'iroqdek)
   WebRTC "mesh": har bir o'yinchi boshqalar bilan to'g'ridan-to'g'ri
   ulanadi, server faqat signallarni uzatadi (ovoz serverdan o'tmaydi).
   * Yangi qo'shilgan o'yinchi hamma bilan ulanishni o'zi boshlaydi.
   * Kim gapirayotgani avatar atrofidagi halqa bilan ko'rinadi.
   Eslatma: mikrofon faqat HTTPS (yoki localhost) da ishlaydi.
   ============================================================ */
(function (global) {
  'use strict';

  const V = {
    active: false,
    muted: false,
    deafened: false,
    startedAt: 0,
    peers: new Map(),          // sid -> { pc, seat, audio, stream, level, queue }
    mutedSeats: new Set(),     // shaxsan o'chirib qo'yilgan o'yinchilar
    onChange: () => {},
    onSpeaking: () => {},      // (seat | 'me', bool)
    onError: () => {},
  };
  let socket = null;
  let local = null;
  let ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  let actx = null;
  const meters = new Map();    // key -> { analyser, data, speaking }
  let raf = 0;

  const supported = () => !!(global.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  function init(sock) {
    socket = sock;
    socket.on('voice:peers', (list) => {
      if (!V.active) return;
      list.forEach(({ sid, seat }) => makePeer(sid, seat, true));
    });
    socket.on('voice:signal', async ({ from, seat, data }) => {
      if (!V.active || !data) return;
      let p = V.peers.get(from) || makePeer(from, seat, false);
      try {
        if (data.sdp) {
          await p.pc.setRemoteDescription(data.sdp);
          if (data.sdp.type === 'offer') {
            const ans = await p.pc.createAnswer();
            await p.pc.setLocalDescription(ans);
            socket.emit('voice:signal', { to: from, data: { sdp: p.pc.localDescription } });
          }
          while (p.queue.length) await p.pc.addIceCandidate(p.queue.shift()).catch(() => {});
        } else if (data.candidate) {
          if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.candidate).catch(() => {});
          else p.queue.push(data.candidate);
        }
      } catch (e) { console.warn('voice signal', e); }
    });
    socket.on('voice:left', ({ sid }) => dropPeer(sid));
    socket.on('disconnect', () => { if (V.active) stop(false); });
  }

  async function loadIce() {
    try {
      const r = await fetch('/config');
      const j = await r.json();
      if (j && Array.isArray(j.ice) && j.ice.length) ice = j.ice;
    } catch (e) { /* standart STUN */ }
  }

  async function start() {
    if (V.active) return true;
    if (!supported()) { V.onError('Bu brauzer ovozli chatni qo\'llamaydi.'); return false; }
    if (!global.isSecureContext) { V.onError('Ovozli chat faqat https:// manzilda ishlaydi.'); return false; }
    try {
      local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (e) {
      V.onError(e && e.name === 'NotAllowedError'
        ? 'Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.'
        : 'Mikrofon topilmadi yoki band.');
      return false;
    }
    await loadIce();
    V.active = true;
    V.muted = false;
    V.startedAt = Date.now();
    meter('me', local);
    socket.emit('voice:join');
    V.onChange();
    return true;
  }

  function makePeer(sid, seat, initiator) {
    if (V.peers.has(sid)) return V.peers.get(sid);
    const pc = new RTCPeerConnection({ iceServers: ice });
    const p = { pc, seat, audio: null, stream: null, queue: [] };
    V.peers.set(sid, p);
    if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('voice:signal', { to: sid, data: { candidate: e.candidate } });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      p.stream = stream;
      if (!p.audio) {
        p.audio = document.createElement('audio');
        p.audio.autoplay = true;
        p.audio.playsInline = true;
        p.audio.setAttribute('playsinline', '');
        holder().appendChild(p.audio);
      }
      p.audio.srcObject = stream;
      p.audio.muted = V.deafened || V.mutedSeats.has(p.seat);
      p.audio.play().catch(() => {});
      meter(sid, stream, p.seat);
      V.onChange();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        V.onError('Bir o\'yinchi bilan ovozli ulanish bo\'lmadi (tarmoq cheklovi).');
        dropPeer(sid);
      }
      V.onChange();
    };
    if (initiator) {
      (async () => {
        try {
          const off = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(off);
          socket.emit('voice:signal', { to: sid, data: { sdp: pc.localDescription } });
        } catch (e) { console.warn('offer', e); }
      })();
    }
    return p;
  }

  function dropPeer(sid) {
    const p = V.peers.get(sid);
    if (!p) return;
    try { p.pc.close(); } catch (e) { /* */ }
    if (p.audio) { p.audio.srcObject = null; p.audio.remove(); }
    meters.delete(sid);
    V.onSpeaking(p.seat, false);
    V.peers.delete(sid);
    V.onChange();
  }

  function stop(notify = true) {
    if (!V.active) return;
    V.active = false;
    Array.from(V.peers.keys()).forEach(dropPeer);
    if (local) local.getTracks().forEach((t) => t.stop());
    local = null;
    meters.delete('me');
    V.onSpeaking('me', false);
    if (notify && socket) socket.emit('voice:leave');
    V.onChange();
  }

  function setMuted(m) {
    V.muted = !!m;
    if (local) local.getAudioTracks().forEach((t) => { t.enabled = !V.muted; });
    if (socket) socket.emit('voice:mute', V.muted);
    V.onChange();
  }
  function setDeafened(d) {
    V.deafened = !!d;
    V.peers.forEach((p) => { if (p.audio) p.audio.muted = V.deafened || V.mutedSeats.has(p.seat); });
    V.onChange();
  }
  function togglePeer(seat) {
    if (V.mutedSeats.has(seat)) V.mutedSeats.delete(seat); else V.mutedSeats.add(seat);
    V.peers.forEach((p) => { if (p.audio) p.audio.muted = V.deafened || V.mutedSeats.has(p.seat); });
    V.onChange();
    return V.mutedSeats.has(seat);
  }

  function holder() {
    let h = document.getElementById('voiceAudio');
    if (!h) {
      h = document.createElement('div');
      h.id = 'voiceAudio';
      h.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;';
      document.body.appendChild(h);
    }
    return h;
  }

  /* ---------- Kim gapiryapti ---------- */
  function meter(key, stream, seat) {
    try {
      if (!actx) {
        const C = global.AudioContext || global.webkitAudioContext;
        actx = new C();
      }
      if (actx.state === 'suspended') actx.resume();
      const src = actx.createMediaStreamSource(stream);
      const an = actx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      meters.set(key, { an, data: new Uint8Array(an.fftSize), speaking: false, seat, hold: 0 });
      if (!raf) loop();
    } catch (e) { /* analiz ixtiyoriy */ }
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!meters.size) { cancelAnimationFrame(raf); raf = 0; return; }
    const now = performance.now();
    meters.forEach((m, key) => {
      m.an.getByteTimeDomainData(m.data);
      let sum = 0;
      for (let i = 0; i < m.data.length; i++) { const v = (m.data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / m.data.length);
      const mutedMe = key === 'me' && V.muted;
      const loud = rms > 0.035 && !mutedMe;
      if (loud) m.hold = now + 250;
      const sp = now < m.hold;
      if (sp !== m.speaking) {
        m.speaking = sp;
        const peer = V.peers.get(key);
        V.onSpeaking(key === 'me' ? 'me' : (peer ? peer.seat : m.seat), sp);
      }
    });
  }

  V.init = init;
  V.start = start;
  V.stop = stop;
  V.setMuted = setMuted;
  V.setDeafened = setDeafened;
  V.togglePeer = togglePeer;
  V.supported = supported;
  /** Server yuborgan {sid, seat} ro'yxati bo'yicha o'rinlarni yangilash */
  V.syncSeats = (list) => {
    (list || []).forEach(({ sid, seat }) => { const p = V.peers.get(sid); if (p) p.seat = seat; });
  };
  V.count = () => V.peers.size + (V.active ? 1 : 0);
  global.Voice = V;
})(window);

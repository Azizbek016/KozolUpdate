/* ============================================================
   cards.js — kartalarni SVG orqali chizish
   Rasmdagi klassik ("DBK") uslubga yaqin: burchak indekslari,
   to'g'ri joylashgan belgilar (pip) va bezakli surat kartalar.

   Agar o'zingizning PNG rasmlaringizni ishlatmoqchi bo'lsangiz:
   public/cards/ papkasiga AS.png, 10H.png, 6C.png ... deb saqlang
   va pastdagi USE_IMAGES ni true qiling.
   ============================================================ */
(function (global) {
  'use strict';

  const USE_IMAGES = false;          // true qilsangiz — public/cards/*.png ishlatiladi
  const IMAGE_DIR = 'cards/';

  const SUIT_UZ = { C: "Chillik", S: "Qarg'a", D: "G'isht", H: "Tappon" };
  const SUIT_CHAR = { C: '♣', S: '♠', D: '♦', H: '♥' };
  const RED = { H: 1, D: 1 };

  const GOLD = '#c9a227';
  const GOLD_L = '#f0d789';
  const INK = '#141414';
  const CRIMSON = '#c8102e';
  const SKIN = '#f4d9bd';
  const ROBE_B = '#1e2126';

  /* --- Masta shakllari (0..100 kvadratda) --- */
  const SUIT_PATH = {
    H: 'M50 92 C18 68 4 50 4 32 C4 14 17 4 30 4 C40 4 47 10 50 18 C53 10 60 4 70 4 C83 4 96 14 96 32 C96 50 82 68 50 92 Z',
    D: 'M50 3 L93 50 L50 97 L7 50 Z',
    S: 'M50 4 C60 24 96 44 96 66 C96 80 86 90 74 90 C65 90 57 85 54 77 C53 86 57 93 63 97 L37 97 C43 93 47 86 46 77 C43 85 35 90 26 90 C14 90 4 80 4 66 C4 44 40 24 50 4 Z',
    C: 'M50 6 C61 6 70 15 70 26 C70 30 69 34 67 37 C70 35 74 34 78 34 C89 34 98 43 98 54 C98 65 89 74 78 74 C68 74 60 67 58 58 C57 68 60 84 68 96 L32 96 C40 84 43 68 42 58 C40 67 32 74 22 74 C11 74 2 65 2 54 C2 43 11 34 22 34 C26 34 30 35 33 37 C31 34 30 30 30 26 C30 15 39 6 50 6 Z',
  };

  function pip(suit, cx, cy, size, rot) {
    const k = size / 100;
    const c = RED[suit] ? CRIMSON : INK;
    const t = `translate(${cx} ${cy}) rotate(${rot || 0}) scale(${k}) translate(-50 -50)`;
    return `<path d="${SUIT_PATH[suit]}" fill="${c}" transform="${t}"/>`;
  }

  /* --- Raqamli kartalar uchun belgilar joylashuvi --- */
  const L = 68, R = 172, C = 120;
  const col3 = [84, 168, 252];
  const col4 = [84, 140, 196, 252];

  function layout(rank) {
    const put = (xs, ys) => {
      const out = [];
      xs.forEach((x) => ys.forEach((y) => out.push([x, y, y > 168 ? 180 : 0])));
      return out;
    };
    switch (rank) {
      case '6': return put([L, R], col3);
      case '7': return put([L, R], col3).concat([[C, 126, 0]]);
      case '8': return put([L, R], col3).concat([[C, 126, 0], [C, 210, 180]]);
      case '9': return put([L, R], col4).concat([[C, 168, 0]]);
      case '10': return put([L, R], col4).concat([[C, 112, 0], [C, 224, 180]]);
      default: return [];
    }
  }

  /* --- Surat kartalar (J / Q / K) uchun yarim figura --- */
  function halfFigure(kind, suit) {
    const accent = RED[suit] ? CRIMSON : ROBE_B;
    const robe = `
      <path d="M14 114 L14 86 C14 67 40 55 78 55 C116 55 142 67 142 86 L142 114 Z"
            fill="${accent}" stroke="${INK}" stroke-width="2.5"/>
      <path d="M22 114 L22 92 C22 79 44 70 78 70 C112 70 134 79 134 92 L134 114"
            fill="none" stroke="${GOLD}" stroke-width="2.5"/>
      <path d="M78 74 L92 90 L78 106 L64 90 Z" fill="${GOLD_L}" stroke="${GOLD}" stroke-width="1.5"/>
      <path d="M40 96 l10 -10 l10 10 l-10 10 Z" fill="${GOLD}" opacity=".85"/>
      <path d="M96 96 l10 -10 l10 10 l-10 10 Z" fill="${GOLD}" opacity=".85"/>
      <path d="M50 60 L78 80 L106 60 L98 51 L78 68 L58 51 Z"
            fill="${GOLD_L}" stroke="${GOLD}" stroke-width="1.5"/>`;

    const face = `
      <ellipse cx="78" cy="37" rx="19" ry="23" fill="${SKIN}" stroke="${INK}" stroke-width="2"/>
      <circle cx="71" cy="34" r="2.2" fill="${INK}"/>
      <circle cx="85" cy="34" r="2.2" fill="${INK}"/>
      <path d="M72 46 q6 4 12 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;

    let head = '', item = '';

    if (kind === 'K') {
      head = `
        <path d="M56 20 q22 -10 44 0 l4 10 q-26 -8 -52 0 Z" fill="${accent}" stroke="${INK}" stroke-width="2"/>
        <path d="M46 20 L54 2 L66 15 L78 0 L90 15 L102 2 L110 20 Z"
              fill="${GOLD_L}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="54" cy="4" r="3" fill="${CRIMSON}"/><circle cx="78" cy="2" r="3.4" fill="${CRIMSON}"/>
        <circle cx="102" cy="4" r="3" fill="${CRIMSON}"/>
        <rect x="46" y="20" width="64" height="9" rx="2" fill="${GOLD}" stroke="${INK}" stroke-width="1.6"/>
        <path d="M60 46 q18 24 36 0 q-3 27 -18 30 q-15 -3 -18 -30 Z" fill="#efe6d8" stroke="${INK}" stroke-width="1.8"/>`;
      item = `
        <rect x="130" y="96" width="9" height="18" fill="${GOLD}" stroke="${INK}" stroke-width="1.5"/>
        <rect x="118" y="88" width="33" height="8" rx="2" fill="${GOLD_L}" stroke="${INK}" stroke-width="1.5"/>
        <path d="M129 88 L129 30 L134.5 18 L140 30 L140 88 Z" fill="#e8ebef" stroke="${INK}" stroke-width="1.8"/>`;
    } else if (kind === 'Q') {
      head = `
        <path d="M54 34 q-10 26 -4 52 q-12 -12 -12 -32 q0 -14 6 -22 Z" fill="#8a5a2b" stroke="${INK}" stroke-width="1.6"/>
        <path d="M102 34 q10 26 4 52 q12 -12 12 -32 q0 -14 -6 -22 Z" fill="#8a5a2b" stroke="${INK}" stroke-width="1.6"/>
        <path d="M52 24 q6 -20 26 -20 q20 0 26 20 Z" fill="${GOLD_L}" stroke="${INK}" stroke-width="2"/>
        <circle cx="60" cy="8" r="4" fill="${GOLD_L}" stroke="${INK}" stroke-width="1.5"/>
        <circle cx="78" cy="1" r="4.5" fill="${GOLD_L}" stroke="${INK}" stroke-width="1.5"/>
        <circle cx="96" cy="8" r="4" fill="${GOLD_L}" stroke="${INK}" stroke-width="1.5"/>
        <rect x="52" y="24" width="52" height="8" rx="2" fill="${GOLD}" stroke="${INK}" stroke-width="1.6"/>`;
      item = `
        <path d="M134 114 L134 52" stroke="#2f6b3d" stroke-width="3"/>
        <path d="M134 70 q-14 -4 -16 -16 q14 0 16 12 Z" fill="#2f6b3d"/>
        <g>
          <circle cx="134" cy="40" r="8" fill="${CRIMSON}" stroke="${INK}" stroke-width="1.4"/>
          <circle cx="123" cy="34" r="7" fill="${CRIMSON}" stroke="${INK}" stroke-width="1.4"/>
          <circle cx="145" cy="34" r="7" fill="${CRIMSON}" stroke="${INK}" stroke-width="1.4"/>
          <circle cx="134" cy="26" r="7" fill="${CRIMSON}" stroke="${INK}" stroke-width="1.4"/>
          <circle cx="134" cy="34" r="4.5" fill="${GOLD_L}"/>
        </g>`;
    } else { // J
      head = `
        <path d="M54 32 q-8 22 -4 42 q-10 -10 -10 -26 Z" fill="#4a3b2a" stroke="${INK}" stroke-width="1.6"/>
        <path d="M102 32 q8 22 4 42 q10 -10 10 -26 Z" fill="#4a3b2a" stroke="${INK}" stroke-width="1.6"/>
        <path d="M50 30 q4 -22 28 -22 q24 0 28 22 Z" fill="${accent}" stroke="${INK}" stroke-width="2"/>
        <rect x="48" y="28" width="60" height="8" rx="3" fill="${GOLD}" stroke="${INK}" stroke-width="1.6"/>
        <path d="M104 16 q22 -12 34 2 q-18 -2 -30 8 Z" fill="${GOLD_L}" stroke="${INK}" stroke-width="1.4"/>`;
      item = `
        <path d="M132 114 L132 26" stroke="#6b4a25" stroke-width="4"/>
        <path d="M132 26 L150 34 L132 44 Z" fill="#dfe3e8" stroke="${INK}" stroke-width="1.6"/>
        <path d="M132 30 L118 36 L132 40 Z" fill="#dfe3e8" stroke="${INK}" stroke-width="1.6"/>`;
    }
    return `<g>${item}${robe}${head}${face}</g>`;
  }

  function courtBody(rank, suit) {
    const half = halfFigure(rank, suit);
    return `
      <rect x="42" y="54" width="156" height="228" rx="7"
            fill="#fffdf7" stroke="${GOLD}" stroke-width="2"/>
      <rect x="47" y="59" width="146" height="218" rx="5"
            fill="none" stroke="${GOLD}" stroke-width="1" opacity=".55"/>
      <line x1="47" y1="168" x2="193" y2="168" stroke="${GOLD}" stroke-width="1" opacity=".55"/>
      <g transform="translate(42 54)">${half}</g>
      <g transform="rotate(180 120 168) translate(42 54)">${half}</g>
      ${pip(suit, 58, 74, 22, 0)}
      ${pip(suit, 182, 262, 22, 180)}`;
  }

  /* --- Burchak indekslari --- */
  function corner(rank, suit) {
    const c = RED[suit] ? CRIMSON : INK;
    const fs = rank === '10' ? 36 : 44;
    const label = rank === '10' ? '10' : rank;
    const g = `
      <text x="24" y="48" font-family="Georgia,'Times New Roman',serif" font-size="${fs}"
            font-weight="700" fill="${c}" text-anchor="middle">${label}</text>
      ${pip(suit, 24, 74, 26, 0)}`;
    return g + `<g transform="rotate(180 120 168)">${g}</g>`;
  }

  /* --- Karta skini: faqat fon va ramka (raqam/belgilar o'zgarmaydi) --- */
  function skinDefs(skin, uid) {
    const [c1, c2] = skin.bg;
    let pat = '';
    const a = skin.inner;
    switch (skin.pattern) {
      case 'dots':
        pat = `<pattern id="p${uid}" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="1.6" fill="${a}" opacity=".55"/></pattern>`; break;
      case 'girih':
        pat = `<pattern id="p${uid}" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M15 2 L28 15 L15 28 L2 15 Z" fill="none" stroke="${a}" stroke-width="1.1" opacity=".45"/>
          <circle cx="15" cy="15" r="1.8" fill="${a}" opacity=".45"/></pattern>`; break;
      case 'snow':
        pat = `<pattern id="p${uid}" width="40" height="40" patternUnits="userSpaceOnUse">
          <g stroke="${a}" stroke-width="1.2" opacity=".5"><path d="M10 4 L10 16 M4 10 L16 10 M6 6 L14 14 M14 6 L6 14"/>
          <path d="M30 24 L30 34 M25 29 L35 29"/></g></pattern>`; break;
      case 'tiles':
        pat = `<pattern id="p${uid}" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect x="1" y="1" width="22" height="22" rx="3" fill="none" stroke="${a}" stroke-width="1" opacity=".4"/>
          <path d="M12 5 L19 12 L12 19 L5 12 Z" fill="${a}" opacity=".18"/></pattern>`; break;
      case 'marble':
        pat = `<pattern id="p${uid}" width="240" height="336" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="${a}" opacity=".45"><path d="M-10 60 C40 40 70 110 130 80 S220 40 260 90" stroke-width="1.6"/>
          <path d="M-10 200 C50 170 90 240 150 210 S230 180 260 230" stroke-width="1.2"/>
          <path d="M40 330 C70 280 120 300 160 260" stroke-width="1"/></g></pattern>`; break;
      case 'shine':
        pat = `<linearGradient id="p${uid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".0"/>
          <stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`; break;
    }
    return `<defs><linearGradient id="b${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>${pat}</defs>`;
  }

  function base(skinId) {
    const K = global.Kozol;
    const skin = K && skinId && K.SKIN[skinId];
    if (!skin || skin.id === 'classic') {
      return `<rect x="1.5" y="1.5" width="237" height="333" rx="16" fill="#fdfbf5"
            stroke="#d9d2c2" stroke-width="2"/>
      <rect x="7" y="7" width="226" height="322" rx="12" fill="none"
            stroke="#eae4d6" stroke-width="1.5"/>`;
    }
    const uid = Math.random().toString(36).slice(2, 8);
    const over = skin.pattern ? `<rect x="3" y="3" width="234" height="330" rx="15" fill="url(#p${uid})"/>` : '';
    const glow = skin.glow ? `<rect x="3.5" y="3.5" width="233" height="329" rx="15" fill="none" stroke="${skin.glow}" stroke-width="5" opacity=".55"/>` : '';
    return `${skinDefs(skin, uid)}
      <rect x="1.5" y="1.5" width="237" height="333" rx="16" fill="url(#b${uid})" stroke="${skin.stroke}" stroke-width="2.5"/>
      ${over}${glow}
      <rect x="7" y="7" width="226" height="322" rx="12" fill="none" stroke="${skin.inner}" stroke-width="1.8"/>`;
  }

  /* --- To'liq karta --- */
  function face(id, skinId) {
    if (USE_IMAGES) {
      return `<img class="card-img" src="${IMAGE_DIR}${id}.png" alt="${id}">`;
    }
    const rank = id.slice(0, -1);
    const suit = id.slice(-1);
    let body;
    if (rank === 'A') {
      body = `<g>
        ${pip(suit, 120, 168, 104, 0)}
        <circle cx="120" cy="168" r="82" fill="none" stroke="${GOLD}" stroke-width="1.4" opacity=".5"/>
      </g>`;
    } else if (rank === 'J' || rank === 'Q' || rank === 'K') {
      body = courtBody(rank, suit);
    } else {
      body = layout(rank).map(([x, y, r]) => pip(suit, x, y, 42, r)).join('');
    }
    return `<svg class="card-svg" viewBox="0 0 240 336" xmlns="http://www.w3.org/2000/svg">
      ${base(skinId)}
      ${corner(rank, suit)}
      ${body}
    </svg>`;
  }

  /* --- Karta orqasi: girih (o'zbekcha ganch) naqshi --- */
  function back() {
    const gid = 'girih' + Math.random().toString(36).slice(2, 7);
    return `<svg class="card-svg" viewBox="0 0 240 336" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="${gid}" width="34" height="34" patternUnits="userSpaceOnUse">
          <rect width="34" height="34" fill="#7b1420"/>
          <path d="M17 2 L32 17 L17 32 L2 17 Z" fill="none" stroke="#e2b64a" stroke-width="1.2" opacity=".8"/>
          <path d="M17 9 L25 17 L17 25 L9 17 Z" fill="none" stroke="#e2b64a" stroke-width="1" opacity=".55"/>
          <circle cx="17" cy="17" r="2" fill="#e2b64a" opacity=".7"/>
          <path d="M0 0 L4 4 M34 0 L30 4 M0 34 L4 30 M34 34 L30 30" stroke="#e2b64a" stroke-width="1" opacity=".5"/>
        </pattern>
      </defs>
      <rect x="1.5" y="1.5" width="237" height="333" rx="16" fill="#fdfbf5" stroke="#d9d2c2" stroke-width="2"/>
      <rect x="12" y="12" width="216" height="312" rx="10" fill="url(#${gid})"/>
      <rect x="12" y="12" width="216" height="312" rx="10" fill="none" stroke="#e2b64a" stroke-width="2"/>
      <g opacity=".9">
        <circle cx="120" cy="168" r="46" fill="#7b1420" stroke="#e2b64a" stroke-width="2"/>
        <path d="M120 130 L152 168 L120 206 L88 168 Z" fill="none" stroke="#e2b64a" stroke-width="1.6"/>
        <path d="M120 142 L146 168 L120 194 L94 168 Z" fill="none" stroke="#e2b64a" stroke-width="1.2" opacity=".7"/>
        <text x="120" y="176" font-family="Georgia,serif" font-size="20" font-weight="700"
              fill="#e2b64a" text-anchor="middle" letter-spacing="2">ZOT</text>
      </g>
    </svg>`;
  }

  global.Cards = { face, back, SUIT_UZ, SUIT_CHAR, RED, USE_IMAGES };
})(window);

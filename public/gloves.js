/* ============================================================
   gloves.js — kartalarni ushlab turgan qo'l (qo'lqop)
   Ikki qatlam chiziladi:
     back()  — kaft va barmoqlar (kartalar ORQASIDA)
     thumb() — bosh barmoq (kartalar USTIDA)
   icon()   — do'kon va profil uchun kichik rasm
   Barcha qo'lqoplar shared.js dagi GLOVES ro'yxatidan olinadi.
   ============================================================ */
(function (global) {
  'use strict';

  const K = global.Kozol;
  const uid = () => 'g' + Math.random().toString(36).slice(2, 8);

  // Shakllar (viewBox 0 0 200 200)
  const PALM = 'M58 116 C54 94 70 84 100 84 C130 84 148 94 144 118 L139 160 C136 177 122 186 100 186 C78 186 64 177 61 160 Z';
  const FINGERS = [
    'M64 104 C62 80 64 58 72 52 C80 47 86 54 86 64 L86 100 Z',
    'M84 98 C82 66 84 42 94 38 C104 35 108 44 106 58 L104 96 Z',
    'M103 96 C103 64 106 42 116 40 C126 39 128 50 126 62 L121 98 Z',
    'M119 100 C121 76 126 60 134 58 C142 57 144 66 141 78 L136 110 Z',
  ];
  const THUMB = 'M60 156 C48 142 52 122 68 112 L96 92 C106 85 120 90 119 102 C118 109 113 112 106 116 L86 132 C80 146 72 164 60 156 Z';
  const CUFF = 'M64 164 L136 164 L138 200 L62 200 Z';

  function patternDef(g, id) {
    const a = g.accent, b = g.base, s = g.shade;
    switch (g.pattern) {
      case 'stripes':
        return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="16" height="16" fill="${b}"/><rect width="7" height="16" fill="${a}"/></pattern>`;
      case 'dots':
        return `<pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse">
          <rect width="18" height="18" fill="${b}"/><circle cx="5" cy="5" r="3.4" fill="${a}"/>
          <circle cx="14" cy="14" r="3.4" fill="${a}"/></pattern>`;
      case 'hearts':
        return `<pattern id="${id}" width="24" height="22" patternUnits="userSpaceOnUse">
          <rect width="24" height="22" fill="${b}"/>
          <path d="M12 17 C4 11 3 7 6 5 C8 3.5 11 4.5 12 7 C13 4.5 16 3.5 18 5 C21 7 20 11 12 17 Z" fill="${a}"/></pattern>`;
      case 'stars':
        return `<pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="${b}"/>
          <path d="M8 2 L9.8 6.6 L14.6 6.8 L10.8 9.8 L12.2 14.4 L8 11.7 L3.8 14.4 L5.2 9.8 L1.4 6.8 L6.2 6.6 Z" fill="${a}"/>
          <circle cx="20" cy="19" r="1.6" fill="${a}"/></pattern>`;
      case 'checker':
        return `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="${b}"/><rect width="10" height="10" fill="${a}"/>
          <rect x="10" y="10" width="10" height="10" fill="${a}"/></pattern>`;
      case 'zebra':
        return `<pattern id="${id}" width="40" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-20)">
          <rect width="40" height="22" fill="${b}"/>
          <path d="M0 4 C10 0 18 10 40 5 L40 11 C22 16 10 7 0 11 Z" fill="${a}"/></pattern>`;
      case 'leopard':
        return `<pattern id="${id}" width="30" height="30" patternUnits="userSpaceOnUse">
          <rect width="30" height="30" fill="${b}"/>
          <path d="M6 5 c4 -3 9 0 8 4 c-1 4 -7 5 -9 2" fill="none" stroke="${a}" stroke-width="2.6" stroke-linecap="round"/>
          <circle cx="9" cy="8" r="2" fill="${s}"/>
          <path d="M19 18 c4 -2 8 1 7 5 c-1 3 -6 4 -8 1" fill="none" stroke="${a}" stroke-width="2.6" stroke-linecap="round"/>
          <circle cx="22" cy="21" r="2" fill="${s}"/></pattern>`;
      case 'camo':
        return `<pattern id="${id}" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect width="60" height="60" fill="${b}"/>
          <path d="M4 10 C14 2 24 8 22 18 C20 26 8 28 4 20 Z" fill="${s}"/>
          <path d="M34 30 C44 22 58 28 56 40 C54 50 40 50 34 42 Z" fill="${a}"/>
          <path d="M10 40 C18 34 26 40 24 48 C22 56 12 56 8 50 Z" fill="${a}"/>
          <path d="M36 4 C44 0 52 6 50 12 C48 18 40 18 36 12 Z" fill="${s}"/></pattern>`;
      case 'ganch':
        return `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse">
          <rect width="22" height="22" fill="${b}"/>
          <path d="M11 1 L21 11 L11 21 L1 11 Z" fill="none" stroke="${a}" stroke-width="1.4"/>
          <path d="M11 6 L16 11 L11 16 L6 11 Z" fill="none" stroke="${a}" stroke-width="1" opacity=".7"/>
          <circle cx="11" cy="11" r="1.6" fill="${a}"/></pattern>`;
      case 'atlas':
        return `<pattern id="${id}" width="36" height="40" patternUnits="userSpaceOnUse">
          <rect width="36" height="40" fill="${b}"/>
          <path d="M0 0 C8 10 -2 20 6 30 C10 36 4 40 4 40 L12 40 C12 34 18 28 12 20 C6 12 14 6 10 0 Z" fill="${g.cuff}"/>
          <path d="M18 0 C24 10 16 20 24 30 C28 36 22 40 22 40 L28 40 C30 32 34 28 28 20 C22 12 30 6 26 0 Z" fill="${a}"/>
          <path d="M12 0 L16 0 L16 40 L12 40 Z" fill="#ffffff" opacity=".35"/></pattern>`;
      case 'flames':
        return `<linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="${g.cuff}"/><stop offset=".45" stop-color="${a}" stop-opacity=".9"/>
          <stop offset=".75" stop-color="${b}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
      case 'rainbow':
        return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff4d4d"/><stop offset=".2" stop-color="#ffa53a"/>
          <stop offset=".4" stop-color="#ffe14d"/><stop offset=".6" stop-color="#4dd67a"/>
          <stop offset=".8" stop-color="#4da3ff"/><stop offset="1" stop-color="#9b5cff"/></linearGradient>`;
      case 'galaxy':
        return `<radialGradient id="${id}" cx="40%" cy="40%" r="75%">
          <stop offset="0" stop-color="#7a4fff"/><stop offset=".45" stop-color="${b}"/>
          <stop offset="1" stop-color="${s}"/></radialGradient>`;
      case 'shine':
        return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${a}"/><stop offset=".35" stop-color="${b}"/>
          <stop offset=".6" stop-color="${s}"/><stop offset=".8" stop-color="${b}"/>
          <stop offset="1" stop-color="${a}"/></linearGradient>`;
      case 'scales':
        return `<pattern id="${id}" width="16" height="12" patternUnits="userSpaceOnUse">
          <rect width="16" height="12" fill="${b}"/>
          <path d="M0 12 A8 8 0 0 1 16 12" fill="none" stroke="${a}" stroke-width="1.4" opacity=".8"/>
          <path d="M-8 6 A8 8 0 0 1 8 6 M8 6 A8 8 0 0 1 24 6" fill="none" stroke="${s}" stroke-width="1.6"/></pattern>`;
      case 'ice':
        return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${s}"/></linearGradient>`;
      case 'gems':
        return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="${b}"/>
          <stop offset=".7" stop-color="${s}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>`;
      default:
        return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${s}"/></linearGradient>`;
    }
  }

  /** Shakl ustiga qo'shimcha bezaklar (naqshdan tashqari) */
  function extras(g, part) {
    const a = g.accent;
    switch (g.pattern) {
      case 'stitch':
        return part === 'palm'
          ? `<path d="M68 118 C66 100 78 94 100 94 C122 94 136 100 134 120 L130 158" fill="none" stroke="${a}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".9"/>`
          : `<path d="M66 148 C60 138 64 126 74 119 L98 101" fill="none" stroke="${a}" stroke-width="1.5" stroke-dasharray="4 3" opacity=".9"/>`;
      case 'knuckle':
        return part === 'palm'
          ? `<ellipse cx="100" cy="132" rx="26" ry="20" fill="${a}" opacity=".95"/>
             <text x="100" y="140" font-family="Georgia,serif" font-size="20" font-weight="700" fill="${g.base}" text-anchor="middle">K</text>`
          : '';
      case 'bolt':
        return part === 'palm'
          ? `<path d="M108 96 L86 136 L102 136 L92 176 L122 124 L104 124 L116 96 Z" fill="${a}"/>`
          : `<path d="M100 96 L84 118 L94 118 L86 134 L104 112 L95 112 Z" fill="${a}"/>`;
      case 'flames':
        return part === 'palm'
          ? `<path d="M66 170 C70 150 78 160 80 140 C86 156 92 146 96 126 C102 148 110 144 112 132 C118 150 126 146 132 136 C134 152 138 160 136 172 Z" fill="${g.cuff}" opacity=".9"/>
             <path d="M76 172 C80 158 86 164 90 150 C94 162 100 158 104 146 C108 160 116 158 120 150 C124 162 126 168 124 174 Z" fill="${a}"/>`
          : '';
      case 'ice':
        return `<g stroke="#ffffff" stroke-width="1.4" opacity=".85" fill="none">
          ${part === 'palm'
            ? '<path d="M100 104 L100 160 M76 132 L124 132 M83 115 L117 149 M117 115 L83 149"/><circle cx="100" cy="132" r="4" fill="#fff"/>'
            : '<path d="M78 118 L100 102 M82 108 L92 122"/>'}</g>`;
      case 'skeleton':
        return part === 'palm'
          ? `<g fill="${a}"><rect x="94" y="100" width="12" height="44" rx="6"/><rect x="74" y="104" width="10" height="36" rx="5" transform="rotate(-8 79 122)"/>
             <rect x="116" y="104" width="10" height="36" rx="5" transform="rotate(8 121 122)"/>
             <ellipse cx="100" cy="160" rx="22" ry="9"/></g>`
          : `<g fill="${a}"><rect x="70" y="118" width="30" height="9" rx="4.5" transform="rotate(-38 85 122)"/>
             <circle cx="104" cy="104" r="6"/></g>`;
      case 'galaxy':
        return `<g fill="#fff">${Array.from({ length: part === 'palm' ? 14 : 5 }, (_, i) =>
          `<circle cx="${70 + ((i * 37) % 64)}" cy="${part === 'palm' ? 96 + ((i * 53) % 80) : 104 + ((i * 29) % 30)}" r="${i % 3 ? 0.9 : 1.6}" opacity=".9"/>`).join('')}</g>`;
      case 'gems':
        return part === 'palm'
          ? `<g fill="none" stroke="#fff" stroke-width="1.2" opacity=".9"><path d="M100 100 L120 124 L100 170 L80 124 Z M80 124 L120 124 M100 100 L100 170"/></g>
             <path d="M128 102 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="#fff"/>`
          : `<path d="M98 100 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 Z" fill="#fff"/>`;
      case 'shine':
        return part === 'palm'
          ? `<path d="M74 110 C80 98 96 94 110 96" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".55"/>`
          : `<path d="M72 128 L94 108" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/>`;
      default:
        return '';
    }
  }

  const SKIN_TONE = '#e9b98f', SKIN_SHADE = '#c98f63', NAIL = '#f6d3c1';

  function get(id) { return (K && K.GLOVE[id]) || (K && K.GLOVES[0]); }

  function paintFill(g, pid, gid) {
    const flat = ['plain', 'skin', 'stitch', 'knuckle', 'fingerless', 'bolt', 'skeleton'].includes(g.pattern);
    return flat ? `url(#${gid})` : `url(#${pid})`;
  }

  /** Kartalar orqasidagi qatlam: barmoqlar, kaft, yeng */
  function back(id) {
    const g = get(id);
    const pid = uid(), gid = uid();
    const fill = paintFill(g, pid, gid);
    const fingerFill = g.pattern === 'fingerless' ? SKIN_TONE : fill;
    const fingerTips = g.pattern === 'fingerless'
      ? FINGERS.map((d) => `<path d="${d}" fill="${SKIN_TONE}" stroke="${SKIN_SHADE}" stroke-width="1.5"/>`).join('') +
        `<path d="M64 100 L141 100 L141 112 L62 112 Z" fill="${g.base}"/>`
      : FINGERS.map((d) => `<path d="${d}" fill="${fingerFill}" stroke="${g.shade}" stroke-width="1.5"/>`).join('');
    return `<svg class="glove-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${patternDef(g, pid)}
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${g.base}"/><stop offset="1" stop-color="${g.shade}"/></linearGradient></defs>
      ${fingerTips}
      <path d="${PALM}" fill="${fill}" stroke="${g.shade}" stroke-width="2"/>
      <path d="M72 150 C86 160 114 160 130 148" fill="none" stroke="${g.shade}" stroke-width="2" opacity=".45"/>
      ${extras(g, 'palm')}
      <path d="${CUFF}" fill="${g.cuff}" stroke="${g.shade}" stroke-width="1.5"/>
      <path d="M63 174 L137 174" stroke="${g.accent}" stroke-width="3" opacity=".8"/>
    </svg>`;
  }

  /** Kartalar ustidagi bosh barmoq */
  function thumb(id) {
    const g = get(id);
    const pid = uid(), gid = uid();
    const fill = paintFill(g, pid, gid);
    const bare = g.pattern === 'skin' || g.pattern === 'fingerless';
    const nail = bare
      ? `<ellipse cx="108" cy="100" rx="8" ry="6" transform="rotate(-38 108 100)" fill="${NAIL}" stroke="${SKIN_SHADE}" stroke-width="1"/>`
      : '';
    const tip = g.pattern === 'fingerless'
      ? `<path d="M96 92 C106 85 120 90 119 102 C118 109 113 112 106 116 L92 105 Z" fill="${SKIN_TONE}" stroke="${SKIN_SHADE}" stroke-width="1.4"/>`
      : '';
    return `<svg class="glove-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${patternDef(g, pid)}
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${g.base}"/><stop offset="1" stop-color="${g.shade}"/></linearGradient>
        <filter id="${gid}s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="-2" dy="3" stdDeviation="3" flood-opacity=".35"/></filter></defs>
      <g filter="url(#${gid}s)">
        <path d="${THUMB}" fill="${fill}" stroke="${g.shade}" stroke-width="2"/>
        ${tip}${nail}${extras(g, 'thumb')}
      </g>
    </svg>`;
  }

  /** Kichik ko'rinish: qo'l + ikkita karta */
  function icon(id) {
    return `<div class="glove-icon">
      <div class="gi-back">${back(id)}</div>
      <div class="gi-cards"><i></i><i></i></div>
      <div class="gi-thumb">${thumb(id)}</div>
    </div>`;
  }

  global.Gloves = { back, thumb, icon, get };
})(window);

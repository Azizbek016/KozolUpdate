/* ============================================================
   avatars.js — profil rasmlari
   12 ta tayyor avatar SVG orqali chiziladi (hech qanday rasm fayli kerak emas).
   Foydalanuvchi o'z rasmini yuklasa — u data URL ko'rinishida saqlanadi.
   ============================================================ */
(function (global) {
  'use strict';

  const PALETTES = [
    ['#1d5c4f', '#08281f', '#e8c46a'],
    ['#7b1420', '#340810', '#f0d489'],
    ['#1e3f6b', '#0a1a30', '#8fc4f0'],
    ['#5c3a12', '#241305', '#f2c97a'],
    ['#43225c', '#1a0a26', '#d5a8f0'],
    ['#0f5560', '#03222a', '#7fe0dc'],
    ['#6b3410', '#2a1206', '#ffb877'],
    ['#2f5c18', '#122507', '#b9e87a'],
    ['#5c1440', '#25061a', '#ff9ed0'],
    ['#123a5c', '#04182a', '#6fd0ff'],
    ['#5c5410', '#232004', '#f2e97a'],
    ['#2a2a33', '#0e0e12', '#cfd4e0'],
  ];

  /* --- Naqsh turlari (100x100 doira ichida) --- */
  function pattern(kind, fg) {
    const s = { fill: 'none', stroke: fg };
    switch (kind) {
      case 0: // sakkiz burchakli yulduz (girih)
        return `
          <rect x="24" y="24" width="52" height="52" fill="none" stroke="${fg}" stroke-width="3"/>
          <rect x="24" y="24" width="52" height="52" fill="none" stroke="${fg}" stroke-width="3"
                transform="rotate(45 50 50)"/>
          <circle cx="50" cy="50" r="9" fill="${fg}"/>`;
      case 1: // olti bargli gul
        return `
          <g fill="${fg}" opacity=".92">
            ${[0, 60, 120, 180, 240, 300].map((a) =>
              `<ellipse cx="50" cy="30" rx="9" ry="17" transform="rotate(${a} 50 50)"/>`).join('')}
          </g>
          <circle cx="50" cy="50" r="7" fill="${fg}"/>`;
      case 2: // panjara + romb
        return `
          <g stroke="${fg}" stroke-width="2.6" fill="none" opacity=".85">
            <path d="M18 50 L50 18 L82 50 L50 82 Z"/>
            <path d="M30 50 L50 30 L70 50 L50 70 Z"/>
            <path d="M18 50 H82 M50 18 V82"/>
          </g>`;
      case 3: // halqalar
        return `
          <g stroke="${fg}" fill="none">
            <circle cx="50" cy="50" r="30" stroke-width="3"/>
            <circle cx="50" cy="50" r="21" stroke-width="2" stroke-dasharray="5 4"/>
            <circle cx="50" cy="50" r="11" stroke-width="3"/>
            <circle cx="50" cy="50" r="4" fill="${fg}" stroke="none"/>
          </g>`;
      case 4: // burchaklar
        return `
          <g stroke="${fg}" fill="none" stroke-width="3.4" stroke-linecap="round">
            <path d="M26 60 L50 36 L74 60"/>
            <path d="M26 74 L50 50 L74 74"/>
            <path d="M26 46 L50 22 L74 46" opacity=".45"/>
          </g>`;
      default: // o'n ikki bargli rozetka
        return `
          <g stroke="${fg}" fill="none" stroke-width="2.4" opacity=".9">
            ${Array.from({ length: 12 }, (_, i) =>
              `<circle cx="50" cy="27" r="12" transform="rotate(${i * 30} 50 50)"/>`).join('')}
          </g>
          <circle cx="50" cy="50" r="6" fill="${fg}"/>`;
    }
  }

  const COUNT = PALETTES.length;

  /** preset avatar SVG (id: 'p0' … 'p11') */
  function preset(id) {
    const i = Math.abs(parseInt(String(id).replace(/\D/g, ''), 10) || 0) % COUNT;
    const [c1, c2, fg] = PALETTES[i];
    const gid = 'ag' + i + '_' + Math.random().toString(36).slice(2, 7);
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="${gid}" cx="35%" cy="28%">
        <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
      </radialGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#${gid})"/>
      ${pattern(i % 6, fg)}
      <circle cx="50" cy="50" r="48.5" fill="none" stroke="${fg}" stroke-width="1.6" opacity=".55"/>
    </svg>`;
  }

  /**
   * Har qanday avatar qiymatini HTML ga aylantiradi.
   * 'p3' -> tayyor avatar | 'data:image/...' -> yuklangan rasm
   */
  function html(value) {
    const v = String(value || 'p0');
    if (v.startsWith('data:image/')) {
      return `<img src="${v.replace(/"/g, '&quot;')}" alt="">`;
    }
    return preset(v);
  }

  const ids = Array.from({ length: COUNT }, (_, i) => 'p' + i);
  const random = () => 'p' + Math.floor(Math.random() * COUNT);

  global.Avatars = { preset, html, ids, random, COUNT };
})(window);

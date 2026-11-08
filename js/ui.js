/* ==========================================================================
   Konys Pizza · ui.js
   Utilidades compartidas por el módulo cliente y el panel de administración:
   iconos, ilustraciones (vectores del diseño de Figma), formato de datos,
   generación de slots horarios, toasts y helpers de modales.
   Se carga como script clásico (funciona también abriendo el HTML con doble clic).
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Colores del Design System (deben coincidir con css/styles.css) ---------- */
  const C = {
    wine: '#641C23', wine800: '#7D2930', wine600: '#9C3A40', wine100: '#F6E8E9', wineFloor: '#F2E5E7', wineLine: '#E5CDD0',
    orange: '#F28C28', orange50: '#FFF8F0',
    gray200: '#E2E5E8', gray300: '#CBD5E1', gray400: '#94A3B8', gray500: '#64748B',
    green: '#16A34A', red: '#DC2626',
  };

  /* ---------- Iconos (trazo 2 px, estilo Lucide) ---------- */
  const P = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    calcheck: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    alertc: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    checkc: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    cl: '<polyline points="15 18 9 12 15 6"/>', cr: '<polyline points="9 18 15 12 9 6"/>', cd: '<polyline points="6 9 12 15 18 9"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    arrowl: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    arrowr: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    table: '<rect x="2" y="7" width="20" height="4" rx="1"/><line x1="5" y1="11" x2="5" y2="20"/><line x1="19" y1="11" x2="19" y2="20"/><line x1="9" y1="11" x2="9" y2="15"/><line x1="15" y1="11" x2="15" y2="15"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    ticket: '<path d="M2 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><line x1="13" y1="5" x2="13" y2="7"/><line x1="13" y1="11" x2="13" y2="13"/><line x1="13" y1="17" x2="13" y2="19"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  };
  const icon = (name, size = 20, color = 'currentColor', width = 2) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

  /* ---------- Ilustraciones de marca (las mismas del archivo de Figma) ---------- */
  function coneArt(top = 'pepperoni') {
    let s = `<path d="M12 26 L52 26 L34 60.5 Q32 63.5 30 60.5 Z" fill="#F2A541"/><path d="M12 26 L52 26 L50.6 28.7 L13.4 28.7 Z" fill="#DE8C2C" opacity=".55"/>
    <g stroke="#CF7A22" stroke-width="1.5" stroke-linecap="round" opacity=".75" fill="none"><path d="M24 29 L37 50"/><path d="M33 29 L43.5 39"/><path d="M41 29 L46.5 34.5"/><path d="M40 29 L27 50"/><path d="M31 29 L20.5 39"/><path d="M23 29 L17.5 34.5"/><path d="M30 29 L32 56"/></g>
    <path d="M10 27 C10 18 19 12.5 32 12.5 C45 12.5 54 18 54 27 C54 29.2 52.4 30.2 50.6 30.2 C48.6 30.2 47.8 34 45.4 34 C43 34 43 30.4 40 30.4 C37 30.4 36.8 36.4 33.6 36.4 C30.4 36.4 30.6 30.6 27.4 30.6 C24.4 30.6 24.4 33.6 21.6 33.6 C19.2 33.6 18.6 30.2 15.6 30.2 C12.8 30.2 10 29.4 10 27 Z" fill="#FFCB52"/>
    <path d="M14 22 C17 16.5 24 14.2 32 14.2 C40 14.2 47 16.5 50 22 C44 19.2 38.5 18.4 32 18.4 C25.5 18.4 20 19.2 14 22 Z" fill="#FFE08A"/>`;
    if (top === 'pepperoni' || top === 'especial') s += `<circle cx="21" cy="22" r="3.6" fill="#D6402A"/><circle cx="20" cy="21" r="1" fill="#F06A4F"/><circle cx="33.5" cy="19" r="3.8" fill="#D6402A"/><circle cx="32.5" cy="18" r="1" fill="#F06A4F"/><circle cx="44" cy="23.5" r="3.4" fill="#D6402A"/><circle cx="43" cy="22.6" r="1" fill="#F06A4F"/><circle cx="28" cy="26.5" r="2.8" fill="#D6402A"/>`;
    if (top === 'hawaiana') s += `<rect x="18" y="19" width="7" height="5" rx="1.5" fill="#F4A6A0" transform="rotate(-12 21 21)"/><rect x="38" y="20" width="7" height="5" rx="1.5" fill="#F4A6A0" transform="rotate(14 41 22)"/><rect x="28" y="16" width="4.5" height="4.5" rx="1" fill="#FFD23F" stroke="#E7B416" stroke-width=".6"/><rect x="31" y="24" width="4.5" height="4.5" rx="1" fill="#FFD23F" stroke="#E7B416" stroke-width=".6"/><rect x="45" y="25" width="4" height="4" rx="1" fill="#FFD23F" stroke="#E7B416" stroke-width=".6"/>`;
    else s += `<path d="M26 20.5 C27.5 17.5 31 17 31.5 17.6 C31 20 28.4 21.6 26 20.5 Z" fill="#3E9B57"/><path d="M38.5 26.5 C40 24 43 23.6 43.6 24.2 C42.8 26.4 40.6 27.6 38.5 26.5 Z" fill="#3E9B57"/>`;
    if (top === 'especial') s += `<path d="M14.5 26 q2.5-3 5 0" stroke="#4CAF50" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M47 18 q2.5-2 4.5 1" stroke="#4CAF50" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    return s;
  }
  const coneMark = (size = 48, top = 'pepperoni') => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">${coneArt(top)}</svg>`;

  function wavy(cx, cy, r, amp, n) {
    let d = '';
    for (let i = 0; i <= 120; i++) { const t = (i / 120) * Math.PI * 2, rr = r + amp * Math.sin(n * t); d += (i ? 'L' : 'M') + (cx + rr * Math.cos(t)).toFixed(1) + ' ' + (cy + rr * Math.sin(t)).toFixed(1); }
    return d + 'Z';
  }
  const POS = [[0, 0], [32, -30], [-36, -22], [-8, 40], [40, 20], [-42, 22], [6, -46], [46, -10], [-20, -48], [22, 46]];
  function pizzaArt(kind) {
    let s = `<circle cx="100" cy="100" r="88" fill="#E3963F"/><circle cx="100" cy="100" r="84" fill="#EDA850"/><circle cx="100" cy="100" r="72" fill="#D2442A"/><path d="${wavy(100, 100, 64, 4, 11)}" fill="#FFD27A"/><path d="${wavy(100, 100, 44, 3, 8)}" fill="#FFDD94" opacity=".7"/>`;
    POS.forEach(([x, y], i) => {
      const X = 100 + x, Y = 100 + y;
      if (kind === 'pepperoni' || (kind === 'especial' && i % 2 === 0)) s += `<circle cx="${X}" cy="${Y}" r="11" fill="#C13A26"/><circle cx="${X - 3}" cy="${Y - 3}" r="2" fill="#E05A42"/>`;
      if (kind === 'especial' && i % 2 === 1) s += `<path d="M${X - 8} ${Y + 2} q8 -14 16 0 z" fill="#D9C4A3"/><rect x="${X - 2.5}" y="${Y + 1}" width="5" height="7" rx="2" fill="#C8AE88"/>`;
      if (kind === 'margarita') {
        if (i % 3 === 0) s += `<circle cx="${X}" cy="${Y}" r="11" fill="#FFF7E6"/>`;
        else if (i % 3 === 1) s += `<circle cx="${X}" cy="${Y}" r="10" fill="#E2523B"/><circle cx="${X}" cy="${Y}" r="6.5" fill="#F0745D"/>`;
        else s += `<ellipse cx="${X}" cy="${Y}" rx="10" ry="5.5" fill="#3E9B57" transform="rotate(${i * 37} ${X} ${Y})"/>`;
      }
    });
    if (kind === 'especial') s += `<path d="M70 72 q8-8 16 0" stroke="#3FA45B" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M118 126 q8-8 16 0" stroke="#3FA45B" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    s += `<g stroke="#EDA850" stroke-width="2.5" opacity=".55"><line x1="100" y1="16" x2="100" y2="184"/><line x1="16" y1="100" x2="184" y2="100"/><line x1="41" y1="41" x2="159" y2="159"/><line x1="159" y1="41" x2="41" y2="159"/></g>`;
    return s;
  }
  function drinkArt(kind) {
    const liq = kind === 'cola' ? '#5B2C1A' : '#EFE9CF';
    let s = `<ellipse cx="100" cy="182" rx="44" ry="7" fill="#000" opacity=".08"/><path d="M60 48 L140 48 L130 172 Q129 180 121 180 L79 180 Q71 180 70 172 Z" fill="#FFFFFF" opacity=".75" stroke="#CBD5E1" stroke-width="2"/><path d="M65 80 L135 80 L130.6 172 Q130 177 122 177 L78 177 Q70 177 69.4 172 Z" fill="${liq}"/><rect x="80" y="86" width="22" height="20" rx="4" fill="#fff" opacity=".45" transform="rotate(-10 91 96)"/><rect x="104" y="96" width="20" height="18" rx="4" fill="#fff" opacity=".4" transform="rotate(12 114 105)"/><rect x="112" y="18" width="7" height="92" rx="3.5" fill="${C.orange}" transform="rotate(14 115 64)"/>`;
    s += kind === 'cola' ? `<circle cx="62" cy="52" r="14" fill="#F6D44B"/><circle cx="62" cy="52" r="10" fill="#FBE79A"/>` : `<circle cx="62" cy="52" r="15" fill="#7CC243"/><circle cx="62" cy="52" r="11" fill="#C8E89A"/>`;
    return s;
  }
  const sticksArt = () => `<ellipse cx="100" cy="170" rx="80" ry="10" fill="#000" opacity=".07"/><rect x="20" y="70" width="160" height="96" rx="20" fill="#B9773F"/><rect x="20" y="66" width="160" height="94" rx="20" fill="#CF8B4F"/>${[0, 1, 2, 3].map(i => `<rect x="${38 + i * 22}" y="${54 - (i % 2) * 6}" width="18" height="96" rx="9" fill="#EDB765" transform="rotate(${-18 + i * 4} ${47 + i * 22} 102)"/><circle cx="${44 + i * 22}" cy="${86 + (i % 2) * 10}" r="1.8" fill="#4E9F3D"/>`).join('')}<circle cx="148" cy="112" r="24" fill="#fff"/><circle cx="148" cy="112" r="18" fill="#D2442A"/>`;
  const brownieArt = () => `<ellipse cx="100" cy="172" rx="78" ry="10" fill="#000" opacity=".07"/><ellipse cx="100" cy="140" rx="82" ry="34" fill="#fff" stroke="#E2E5E8" stroke-width="2"/><path d="M46 112 L132 104 L154 126 L66 136 Z" fill="#7A4630"/><path d="M66 136 L154 126 L154 146 L66 158 Z" fill="#5A3221"/><path d="M46 112 L66 136 L66 158 L46 132 Z" fill="#4A2818"/><circle cx="104" cy="96" r="26" fill="#FFF4DC"/><path d="M82 104 q6 10 12 0 q6 12 12 0 q6 10 12 0" stroke="#3B1F14" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="116" cy="72" rx="9" ry="5" fill="#3E9B57" transform="rotate(-30 116 72)"/>`;

  /* Ilustraciones disponibles para platos (campo `imagen` de la tabla platos). */
  const PLATO_ART = {
    'pizza-especial': { bg: C.orange50, svg: () => svg200(pizzaArt('especial')) },
    'pizza-margarita': { bg: C.orange50, svg: () => svg200(pizzaArt('margarita')) },
    'pizza-pepperoni': { bg: C.orange50, svg: () => svg200(pizzaArt('pepperoni')) },
    'cono-pepperoni': { bg: C.orange50, svg: () => `<svg viewBox="0 0 64 64" fill="none">${coneArt('pepperoni')}</svg>` },
    'cono-hawaiana': { bg: C.orange50, svg: () => `<svg viewBox="0 0 64 64" fill="none">${coneArt('hawaiana')}</svg>` },
    'palitos': { bg: '#FDF3E7', svg: () => svg200(sticksArt()) },
    'brownie': { bg: '#F6EEE9', svg: () => svg200(brownieArt()) },
    'limonada': { bg: '#EEF6E8', svg: () => svg200(drinkArt('limonada')) },
    'gaseosa': { bg: C.wine100, svg: () => svg200(drinkArt('cola')) },
  };
  function svg200(inner) { return `<svg viewBox="0 0 200 200">${inner}</svg>`; }
  const DEFAULT_ART = { pizzas: 'pizza-pepperoni', entradas: 'palitos', postres: 'brownie', bebidas: 'limonada' };

  /** Solo http(s). Rechaza javascript:, data: y rutas de protocolo relativo. */
  function urlSegura(v) {
    const s = String(v || '').trim();
    if (!/^https?:\/\//i.test(s)) return false;
    try {
      const u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) { return false; }
  }

  /** Imagen de un plato: URL propia (si el admin la cargó) o la ilustración de marca. */
  function platoImg(plato, extraClass = '') {
    const ref = (plato && plato.imagen) || DEFAULT_ART[plato && plato.categoria] || 'pizza-pepperoni';
    if (urlSegura(ref)) return `<div class="media ${extraClass}"><img src="${esc(ref)}" alt="${esc(plato.nombre)}" loading="lazy"></div>`;
    const art = PLATO_ART[ref] || PLATO_ART['pizza-pepperoni'];
    return `<div class="media media-art ${extraClass}" style="background:${art.bg}">${art.svg()}</div>`;
  }

  /** Mesa vista desde arriba: sillas según capacidad, piso según zona. */
  function tableArt(zona = 'terraza', seats = 4) {
    const t = String(zona).toLowerCase().startsWith('terr');
    const floor = t ? '#FBEBD7' : C.wineFloor, line = t ? '#F3D9BB' : C.wineLine, chair = t ? C.orange : C.wine600;
    let s = `<rect width="320" height="190" fill="${floor}"/>`;
    for (let x = 0; x <= 320; x += 40) s += `<line x1="${x}" y1="0" x2="${x}" y2="190" stroke="${line}" stroke-width="2"/>`;
    if (t) {
      for (let y = 0; y <= 190; y += 40) s += `<line x1="0" y1="${y}" x2="320" y2="${y}" stroke="${line}" stroke-width="2"/>`;
      s += `<circle cx="28" cy="28" r="22" fill="#3E9B57"/><circle cx="20" cy="22" r="10" fill="#57B36F"/><circle cx="292" cy="162" r="24" fill="#3E9B57"/><circle cx="300" cy="154" r="11" fill="#57B36F"/><circle cx="296" cy="30" r="14" fill="#57B36F"/>`;
    } else s += `<circle cx="160" cy="95" r="110" fill="#fff" opacity=".45"/><rect x="18" y="16" width="56" height="36" rx="4" fill="#fff" stroke="${C.wineLine}" stroke-width="2"/><rect x="250" y="140" width="48" height="34" rx="4" fill="#fff" stroke="${C.wineLine}" stroke-width="2"/>`;
    const ch = (x, y, r) => `<rect x="${x - 15}" y="${y - 12}" width="30" height="24" rx="8" fill="${chair}" transform="rotate(${r} ${x} ${y})"/>`;
    const plate = (x, y) => `<circle cx="${x}" cy="${y}" r="11" fill="#fff" stroke="#E2E5E8" stroke-width="2"/><circle cx="${x}" cy="${y}" r="5" fill="#FFD27A"/>`;
    const n = Math.max(1, Math.min(12, Number(seats) || 2));
    if (n <= 4) {
      const R = n <= 2 ? 40 : 46, ang = n <= 2 ? [180, 0] : n === 3 ? [180, 0, 270] : [180, 0, 270, 90];
      ang.forEach(a => { const r = a * Math.PI / 180; s += ch(160 + (R + 22) * Math.cos(r), 95 + (R + 22) * Math.sin(r), a + 90); });
      s += `<circle cx="160" cy="98" r="${R}" fill="#000" opacity=".08"/><circle cx="160" cy="95" r="${R}" fill="#fff" stroke="#E2E5E8" stroke-width="2"/>`;
      ang.forEach(a => { const r = a * Math.PI / 180; s += plate(160 + (R - 18) * Math.cos(r), 95 + (R - 18) * Math.sin(r)); });
    } else {
      const k = Math.ceil(n / 2), W = k * 50 + 20, x0 = 160 - W / 2;
      for (let i = 0; i < k; i++) { const x = x0 + 35 + i * 50; s += ch(x, 37, 0) + (i < Math.floor(n / 2) ? ch(x, 153, 180) : ''); }
      s += `<rect x="${x0}" y="62" width="${W}" height="72" rx="14" fill="#000" opacity=".08"/><rect x="${x0}" y="59" width="${W}" height="72" rx="14" fill="#fff" stroke="#E2E5E8" stroke-width="2"/>`;
      for (let i = 0; i < k; i++) { const x = x0 + 35 + i * 50; s += plate(x, 77) + (i < Math.floor(n / 2) ? plate(x, 113) : ''); }
    }
    s += `<circle cx="160" cy="95" r="6" fill="${C.orange}"/><circle cx="160" cy="95" r="12" fill="${C.orange}" opacity=".2"/>`;
    return `<svg viewBox="0 0 320 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
  }
  /** Foto de la mesa: usa foto_url si existe; si no, la ilustración. */
  function mesaImg(mesa, extraClass = '') {
    if (mesa && urlSegura(mesa.foto_url)) return `<div class="media ${extraClass}"><img src="${esc(mesa.foto_url)}" alt="${esc(mesa.nombre)}" loading="lazy"></div>`;
    return `<div class="media media-art media-fill ${extraClass}">${tableArt(mesa.zona, mesa.capacidad)}</div>`;
  }

  function heroArt() {
    const leaf = (x, y, r, sc) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${sc})"><path d="M0 0 C10 -18 34 -20 40 -14 C34 4 14 12 0 0 Z" fill="#3E9B57"/><path d="M2 -1 C14 -8 26 -11 36 -13" stroke="#2C7A43" stroke-width="1.6" fill="none"/></g>`;
    const pep = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#D6402A"/><circle cx="${x - r * .3}" cy="${y - r * .3}" r="${r * .25}" fill="#F06A4F"/><circle cx="${x + r * .35}" cy="${y + r * .2}" r="${r * .18}" fill="#A92E1C"/>`;
    const tom = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#E2523B"/><circle cx="${x}" cy="${y}" r="${r * .72}" fill="#F27A62"/><g fill="#FFE3A3"><circle cx="${x - r * .3}" cy="${y - r * .2}" r="${r * .1}"/><circle cx="${x + r * .3}" cy="${y - r * .2}" r="${r * .1}"/><circle cx="${x}" cy="${y + r * .35}" r="${r * .1}"/></g>`;
    const mush = (x, y, sc) => `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M-22 0 C-22 -18 22 -18 22 0 Z" fill="#E8D5B5"/><rect x="-7" y="-1" width="14" height="18" rx="6" fill="#F6EBD8"/></g>`;
    return `<svg viewBox="0 0 560 560" fill="none" aria-hidden="true"><circle cx="280" cy="280" r="250" stroke="#FFFFFF" stroke-opacity=".12" stroke-width="2" stroke-dasharray="6 10"/><circle cx="280" cy="292" r="200" fill="${C.orange}"/><path d="M120 360 A200 200 0 0 0 440 360 Z" fill="#E07B17" opacity=".45"/><ellipse cx="290" cy="500" rx="120" ry="14" fill="#000" opacity=".22"/><g transform="translate(118 70) scale(5.2) rotate(-10 32 32)">${coneArt('especial')}</g>${leaf(56, 170, -20, 1.5)}${leaf(430, 110, 30, 1.3)}${leaf(470, 420, 160, 1.4)}${pep(470, 230, 26)}${pep(84, 380, 22)}${tom(150, 96, 26)}${tom(452, 340, 20)}${mush(86, 270, 1.2)}<circle cx="400" cy="70" r="6" fill="#FFCB52"/><circle cx="60" cy="470" r="8" fill="#FFCB52"/></svg>`;
  }
  const successArt = () => `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="#E8F7EE"/><circle cx="60" cy="60" r="40" fill="${C.green}"/><polyline points="42 61 54 73 79 47" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="20" width="9" height="5" rx="2" fill="${C.orange}" transform="rotate(-30 14 22)"/><rect x="100" y="14" width="9" height="5" rx="2" fill="${C.wine}" transform="rotate(25 104 16)"/><circle cx="106" cy="92" r="4" fill="${C.orange}"/><circle cx="14" cy="96" r="3.5" fill="#FFCB52"/></svg>`;
  const emptyArt = () => `<svg viewBox="0 0 180 180" fill="none" aria-hidden="true"><circle cx="90" cy="90" r="84" fill="${C.orange50}"/><rect x="42" y="50" width="96" height="84" rx="14" fill="#fff" stroke="${C.gray200}" stroke-width="3"/><rect x="42" y="50" width="96" height="24" rx="12" fill="${C.wine}"/><rect x="42" y="62" width="96" height="12" fill="${C.wine}"/><line x1="66" y1="40" x2="66" y2="58" stroke="${C.wine600}" stroke-width="5" stroke-linecap="round"/><line x1="114" y1="40" x2="114" y2="58" stroke="${C.wine600}" stroke-width="5" stroke-linecap="round"/><g fill="${C.gray200}"><rect x="56" y="86" width="16" height="12" rx="3"/><rect x="82" y="86" width="16" height="12" rx="3"/><rect x="108" y="86" width="16" height="12" rx="3"/><rect x="56" y="108" width="16" height="12" rx="3"/><rect x="82" y="108" width="16" height="12" rx="3"/></g><circle cx="128" cy="128" r="24" fill="${C.red}"/><g stroke="#fff" stroke-width="5" stroke-linecap="round"><line x1="119" y1="119" x2="137" y2="137"/><line x1="137" y1="119" x2="119" y2="137"/></g></svg>`;

  /* ---------- Formato ---------- */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const cop = (n) => '$' + Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const pad = (n) => String(n).padStart(2, '0');
  /** Fecha local en formato ISO (YYYY-MM-DD) sin desfase por zona horaria. */
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const fechaCorta = (s) => { const d = parseDate(s); return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
  const fechaLarga = (s) => { const d = parseDate(s); const t = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; return t[0].toUpperCase() + t.slice(1); };
  const fechaNum = (s) => { const d = parseDate(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const hhmm = (t) => String(t || '').slice(0, 5);
  const toMin = (t) => { const [h, m] = hhmm(t).split(':').map(Number); return h * 60 + m; };
  const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const zonaTxt = (z) => String(z).toLowerCase().startsWith('terr') ? 'Terraza' : 'Salón';
  const zonaIcon = (z) => String(z).toLowerCase().startsWith('terr') ? 'sun' : 'home';
  const CATS = { pizzas: 'Pizzas', entradas: 'Entradas', postres: 'Postres', bebidas: 'Bebidas' };
  const codigoReserva = (r) => `KNY-${String(r.fecha).slice(2, 4)}${String(r.fecha).slice(5, 7)}-${String(r.id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`;

  /**
   * Genera los slots de una mesa para una fecha (RF-04 / RF-11).
   * - Un slot empieza cada 30 min dentro de cada jornada activa del día.
   * - Si el slot más la duración no cabe antes del cierre → 'dis' (no disponible).
   * - Si se cruza con una reserva no cancelada de la mesa → 'oc' (ocupado).
   * - Si la hora ya pasó (día de hoy) → 'dis'.
   */
  function generarSlots(fecha, horarios, reservasMesa) {
    const dia = DIAS[parseDate(fecha).getDay()];
    const jornadas = horarios.filter(h => h.dia_semana === dia && h.activo).sort((a, b) => toMin(a.hora_inicio) - toMin(b.hora_inicio));
    const esHoy = fecha === isoDate(new Date());
    const ahora = nowMin();
    const ocupados = (reservasMesa || []).filter(r => r.estado !== 'cancelada').map(r => [toMin(r.hora_inicio), toMin(r.hora_fin)]);
    return jornadas.map(j => {
      const ini = toMin(j.hora_inicio), fin = toMin(j.hora_fin), dur = Number(j.duracion_slot) || 60;
      const slots = [];
      for (let m = ini; m < fin; m += 30) {
        let estado = 'av';
        if (m + dur > fin || (esHoy && m <= ahora)) estado = 'dis';
        else if (ocupados.some(([a, b]) => m < b && a < m + dur)) estado = 'oc';
        slots.push({ hora: fromMin(m), fin: fromMin(m + dur), estado });
      }
      return { jornada: j.jornada, desde: hhmm(j.hora_inicio), hasta: hhmm(j.hora_fin), duracion: dur, slots };
    });
  }
  const diaAbierto = (fecha, horarios) => { const dia = DIAS[parseDate(fecha).getDay()]; return horarios.some(h => h.dia_semana === dia && h.activo); };
  const hora12 = (t) => { let [h, m] = hhmm(t).split(':').map(Number); const s = h >= 12 ? 'p. m.' : 'a. m.'; h = h % 12 || 12; return `${h}:${pad(m)} ${s}`; };

  /* ---------- Componentes HTML pequeños ---------- */
  const CHIP = { libre: ['libre', 'Libre'], ocupada: ['ocupada', 'Ocupada'], inactiva: ['inactiva', 'Inactiva'], confirmada: ['libre', 'Confirmada'], cancelada: ['ocupada', 'Cancelada'], completada: ['completada', 'Completada'], activa: ['libre', 'Activa'], disponible: ['libre', 'Disponible'], nodisponible: ['inactiva', 'No disponible'], proxima: ['pendiente', 'Próxima'] };
  const chip = (k, text) => { const [cls, t] = CHIP[k] || [k, k]; return `<span class="chip chip-${cls}"><span class="dot"></span>${esc(text || t)}</span>`; };

  /* ---------- Toasts ---------- */
  function toast(msg, type = 'success') {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('data-testid', 'toast');
    el.setAttribute('data-toast', type);
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${icon(type === 'error' ? 'alertc' : type === 'info' ? 'info' : 'checkc', 20)}<span>${esc(msg)}</span>`;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3600);
  }

  /* ---------- Modales (abrir / cerrar con Esc y clic fuera) ---------- */
  function openModal(el) {
    el.hidden = false; document.body.classList.add('no-scroll');
    requestAnimationFrame(() => el.classList.add('open'));
    const f = el.querySelector('[autofocus], input, button'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 50);
  }
  function closeModal(el) {
    el.classList.remove('open'); document.body.classList.remove('no-scroll');
    setTimeout(() => { el.hidden = true; }, 180);
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.overlay.open').forEach(o => o.dispatchEvent(new CustomEvent('modal:close'))); });

  window.KUI = { C, icon, coneMark, coneArt, tableArt, mesaImg, platoImg, PLATO_ART, heroArt, successArt, emptyArt, esc, urlSegura, cop, DIAS, DIAS_CORTOS, MESES, pad, isoDate, parseDate, fechaCorta, fechaLarga, fechaNum, hhmm, toMin, fromMin, nowMin, hora12, initials, zonaTxt, zonaIcon, CATS, codigoReserva, generarSlots, diaAbierto, chip, toast, openModal, closeModal };

  /* Hidrata iconos declarados en HTML: <i data-icon="calendar" data-size="18"></i> */
  function hydrateIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 20, el.dataset.color || 'currentColor'); });
    root.querySelectorAll('[data-cone]').forEach(el => { el.outerHTML = coneMark(Number(el.dataset.cone) || 46, el.dataset.top || 'pepperoni'); });
  }
  KUI.hydrateIcons = hydrateIcons;
})();

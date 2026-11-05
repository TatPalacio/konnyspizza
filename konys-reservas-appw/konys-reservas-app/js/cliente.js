/* ==========================================================================
   Konys Pizza · cliente.js
   Módulo del cliente (RF-01 a RF-07):
   mesas y disponibilidad → modal de reserva (fecha, hora, datos) →
   validaciones y errores → reserva confirmada · carta digital por categorías.
   ========================================================================== */
(function () {
  'use strict';
  const U = window.KUI;
  const { icon, esc, chip } = U;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const state = {
    mesas: [], horarios: [], platos: [], reservasHoy: [],
    zona: 'todas', cat: 'todo',
    r: null,          // reserva en curso
    jornadas: [],     // slots de la mesa/fecha elegidas
    errors: {}, topAlert: null, saving: false,
  };

  /* ---------------------------------------------------------------- */
  /* Inicio                                                             */
  /* ---------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    U.hydrateIcons();
    $('#hero-art').insertAdjacentHTML('afterbegin', U.heroArt());
    bindHeader();
    bindTabs();
    skeletons();
    if (DB.mode === 'demo') demoBadge();
    try {
      const hoy = U.isoDate(new Date());
      const [mesas, horarios, platos, reservasHoy] = await Promise.all([
        DB.listMesas({ soloActivas: true }), DB.listHorarios(), DB.listPlatos({ soloDisponibles: true }), DB.listOcupacion({ fecha: hoy }),
      ]);
      Object.assign(state, { mesas, horarios, platos, reservasHoy });
      renderMesas(); renderCarta(); renderFooterHorario();
    } catch (err) {
      console.error(err);
      const msg = `<div class="alert alert-error" style="grid-column:1/-1">${icon('alertc', 20)}<div><b>No pudimos cargar la información</b>Revisa tu conexión e inténtalo de nuevo.</div></div>`;
      $('#mesas-grid').innerHTML = msg; $('#carta-grid').innerHTML = msg;
    }
  }

  function skeletons() {
    $('#mesas-grid').innerHTML = Array(4).fill('<div class="skeleton" style="height:300px"></div>').join('');
    $('#carta-grid').innerHTML = Array(4).fill('<div class="skeleton" style="height:340px"></div>').join('');
  }

  function demoBadge() {
    const b = document.createElement('div');
    b.className = 'demo-badge';
    b.innerHTML = `${icon('database', 14)}Modo demo · datos guardados en este navegador <button type="button">Restablecer</button>`;
    b.querySelector('button').onclick = async () => { await DB.reset(); location.reload(); };
    document.body.appendChild(b);
  }

  /* ---------------------------------------------------------------- */
  /* Encabezado, navegación y menú móvil                                */
  /* ---------------------------------------------------------------- */
  function bindHeader() {
    const header = $('#site-header');
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    const menu = $('#mobile-menu');
    $('#menu-open').onclick = () => { menu.hidden = false; document.body.classList.add('no-scroll'); };
    const closeMenu = () => { menu.hidden = true; document.body.classList.remove('no-scroll'); };
    $('#menu-close').onclick = closeMenu;
    $$('a', menu).forEach(a => a.addEventListener('click', closeMenu));

    // Cualquier enlace interno vuelve a la vista de inicio si se está en la confirmación.
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', () => { if (!$('#vista-confirmacion').hidden) showInicio(false); }));

    // Resalta la sección visible en el menú.
    const links = $$('.nav a');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const id = e.target.id === 'contacto' ? 'contacto' : e.target.id;
        links.forEach(l => l.classList.toggle('active', l.dataset.nav === id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['inicio', 'mesas', 'carta', 'contacto'].forEach(id => io.observe(document.getElementById(id)));
  }

  function bindTabs() {
    $('#zona-tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-zona]'); if (!b) return;
      state.zona = b.dataset.zona; $$('#zona-tabs .tab').forEach(t => t.setAttribute('aria-selected', t === b)); renderMesas();
    });
    $('#cat-tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      state.cat = b.dataset.cat; $$('#cat-tabs .tab').forEach(t => t.setAttribute('aria-selected', t === b)); renderCarta();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Mesas (RF-01)                                                       */
  /* ---------------------------------------------------------------- */
  /** Estado general de la mesa: ocupada si hay una reserva en curso ahora mismo. */
  function estadoMesa(m) {
    const ahora = U.nowMin();
    return state.reservasHoy.some(r => r.mesa_id === m.id && r.estado !== 'cancelada' && U.toMin(r.hora_inicio) <= ahora && ahora < U.toMin(r.hora_fin)) ? 'ocupada' : 'libre';
  }

  function renderMesas() {
    const list = state.mesas.filter(m => state.zona === 'todas' || m.zona === state.zona);
    const grid = $('#mesas-grid');
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${U.emptyArt()}
        <h3 class="h3">No hay mesas disponibles${state.zona !== 'todas' ? ' en ' + (state.zona === 'terraza' ? 'la terraza' : 'el salón') : ''}</h3>
        <p class="body-lg muted">${state.mesas.length ? 'Prueba con otra zona del restaurante.' : 'En este momento no hay mesas habilitadas para reservas. Escríbenos por WhatsApp para más información.'}</p>
        ${state.mesas.length ? `<button class="btn btn-primary" data-zona-reset>${icon('table', 18)}Ver todas las mesas</button>` : ''}</div>`;
      const reset = grid.querySelector('[data-zona-reset]');
      if (reset) reset.onclick = () => $('#zona-tabs [data-zona="todas"]').click();
      return;
    }
    grid.innerHTML = list.map(m => {
      const est = estadoMesa(m);
      return `<article class="card mesa-card">
        ${U.mesaImg(m)}<span class="status">${chip(est)}</span>
        <div class="mesa-body">
          <div class="title-row"><h3 class="h4">${esc(m.nombre)}</h3><span class="chip-m">${chip(est)}</span></div>
          <div class="meta"><span>${icon(U.zonaIcon(m.zona), 16)}${U.zonaTxt(m.zona)}</span><span>${icon('users', 16)}${m.capacidad} personas</span></div>
          ${est === 'libre'
            ? `<button class="btn btn-primary btn-block" data-reservar="${m.id}">Reservar${icon('arrowr', 18)}</button>`
            : `<button class="btn btn-secondary btn-block" data-reservar="${m.id}">${icon('clock', 18)}Ver horarios</button>`}
        </div></article>`;
    }).join('');
    $$('[data-reservar]', grid).forEach(b => b.onclick = () => openReserva(Number(b.dataset.reservar)));
  }

  /* ---------------------------------------------------------------- */
  /* Carta (RF-07)                                                       */
  /* ---------------------------------------------------------------- */
  function renderCarta() {
    const list = state.platos.filter(p => state.cat === 'todo' || p.categoria === state.cat);
    $('#carta-grid').innerHTML = list.length ? list.map((p, i) => `<article class="card plato-card">
      ${U.platoImg(p)}
      <div class="plato-body">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="tag">${U.CATS[p.categoria] || esc(p.categoria)}</span>${i === 0 && state.cat === 'todo' ? '<span class="tag tag-accent">Favorita</span>' : ''}</div>
        <div><h3 class="h4" style="font-size:18px">${esc(p.nombre)}</h3><p class="body-sm muted desc">${esc(p.descripcion)}</p></div>
        <div class="plato-price"><b>${U.cop(p.precio)}</b><span class="caption muted">COP</span></div>
      </div></article>`).join('')
      : `<div class="empty" style="grid-column:1/-1">${icon('utensils', 40, U.C.gray400)}<h3 class="h4">Sin platos disponibles en esta categoría</h3></div>`;
  }

  function renderFooterHorario() {
    const act = state.horarios.filter(h => h.activo);
    if (!act.length) return;
    const orden = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const cerrados = orden.filter(d => !act.some(h => h.dia_semana === d));
    const abiertos = orden.filter(d => !cerrados.includes(d));
    const cap = s => s[0].toUpperCase() + s.slice(1, 3);
    const rango = abiertos.length ? `${cap(abiertos[0])} – ${cap(abiertos[abiertos.length - 1])}` : '';
    const ref = act.filter(h => h.dia_semana === abiertos[0]).sort((a, b) => U.toMin(a.hora_inicio) - U.toMin(b.hora_inicio));
    $('#footer-horario').innerHTML = `${rango}<br>${ref.map(h => `${U.hora12(h.hora_inicio).replace(' p. m.', '').replace(' a. m.', '')} – ${U.hora12(h.hora_fin)}`).join('<br>')}`;
    $('#footer-cerrado').hidden = !cerrados.length;
    if (cerrados.length) $('#footer-cerrado span').textContent = `${cerrados.map(d => d[0].toUpperCase() + d.slice(1)).join(', ')}: cerrado`;
  }

  /* ---------------------------------------------------------------- */
  /* Modal de reserva (RF-02 a RF-05)                                   */
  /* ---------------------------------------------------------------- */
  const modal = () => $('#reserva-modal');

  function primeraFechaAbierta() {
    const d = new Date();
    for (let i = 0; i < 60; i++) { const f = U.isoDate(d); if (U.diaAbierto(f, state.horarios)) return f; d.setDate(d.getDate() + 1); }
    return null;
  }

  async function openReserva(mesaId) {
    const mesa = state.mesas.find(m => m.id === mesaId); if (!mesa) return;
    const prev = state.r || {};
    const fecha = primeraFechaAbierta();
    state.r = { mesa, fecha, hora: null, nombre: prev.nombre || '', tel: prev.tel || '', personas: Math.min(prev.personas || 0, mesa.capacidad) };
    state.errors = {}; state.topAlert = null;
    const f = fecha ? U.parseDate(fecha) : new Date();
    state.mes = new Date(f.getFullYear(), f.getMonth(), 1);
    renderModalShell();
    U.openModal(modal());
    await loadSlots();
  }

  function closeReserva() { U.closeModal(modal()); }
  modal().addEventListener('click', e => { if (e.target === modal()) closeReserva(); });
  modal().addEventListener('modal:close', closeReserva);

  async function loadSlots() {
    const { mesa, fecha } = state.r;
    state.jornadas = null; renderSlots();
    if (!fecha) { state.jornadas = []; renderSlots(); return; }
    try {
      const reservas = await DB.listOcupacion({ fecha, mesa_id: mesa.id }); // sin datos personales
      if (state.r.fecha !== fecha || state.r.mesa.id !== mesa.id) return; // el usuario cambió de fecha mientras cargaba
      state.jornadas = U.generarSlots(fecha, state.horarios, reservas);
    } catch (err) { console.error(err); state.jornadas = []; U.toast('No pudimos consultar los horarios. Inténtalo de nuevo.', 'error'); }
    renderSlots(); renderSteps(); renderSummary();
  }

  function renderModalShell() {
    const { mesa } = state.r;
    $('#reserva-box').innerHTML = `
      <div class="modal-head reserve-head">
        <div class="info">
          <button class="btn btn-soft btn-icon back" data-close aria-label="Volver">${icon('arrowl', 18)}</button>
          <div class="mesa-thumb">${U.mesaImg(mesa, 'media-fill')}</div>
          <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
            <h2 class="h3" id="reserva-title" style="font-size:24px;line-height:30px">Reservar · ${esc(mesa.nombre)}</h2>
            <div class="meta"><span>${icon(U.zonaIcon(mesa.zona), 16)}${U.zonaTxt(mesa.zona)}</span><span>${icon('users', 16)}${mesa.capacidad} personas</span><span>${icon('hourglass', 16)}Reservas de ${duracion()} min</span></div>
          </div>
        </div>
        <button class="btn btn-soft btn-icon close" data-close aria-label="Cerrar">${icon('x', 18)}</button>
      </div>
      <div class="reserve-top-alert" id="r-top" hidden></div>
      <div class="reserve-grid">
        <div class="reserve-col col-fecha">
          <div class="soft reserve-mesa" style="display:none;align-items:center;gap:14px;padding:12px">
            <div style="width:72px;height:60px;border-radius:12px;overflow:hidden;flex:none">${U.mesaImg(mesa, 'media-fill')}</div>
            <div style="display:flex;flex-direction:column;gap:4px"><b class="h5">${esc(mesa.nombre)}</b><div class="meta" style="font-size:13px;gap:4px 12px"><span>${icon(U.zonaIcon(mesa.zona), 14)}${U.zonaTxt(mesa.zona)}</span><span>${icon('users', 14)}Hasta ${mesa.capacidad}</span><span>${icon('hourglass', 14)}${duracion()} min</span></div></div>
          </div>
          <div class="step" id="st-1"></div>
          <div class="cal-month-m" style="display:none;align-items:center;justify-content:space-between"><span class="label" id="dm-label"></span></div>
          <div class="daystrip" id="r-days" role="listbox" aria-label="Elige el día"></div>
          <div class="cal-wrap" id="r-cal"></div>
        </div>
        <div class="reserve-col col-hora">
          <div class="step" id="st-2"></div>
          <div id="r-slot-msg"></div>
          <div id="r-slots" style="display:flex;flex-direction:column;gap:18px"></div>
          <div class="divider"></div>
          <div class="legend"><span><i></i>Disponible</span><span><i class="oc"></i>Ocupado</span><span><i class="sel"></i>Seleccionado</span><span><i class="dis"></i>No disponible</span></div>
        </div>
        <form class="reserve-col col-datos" id="r-form" novalidate>
          <div class="step" id="st-3"></div>
          <div id="r-form-alert"></div>
          <div class="datos-inner">
            <div class="field" id="f-nombre">
              <label class="field-label" for="i-nombre">Nombre completo<span class="req">*</span></label>
              <div class="input">${icon('user', 18)}<input id="i-nombre" name="nombre" autocomplete="name" placeholder="Ej. Juan Pérez" maxlength="80"></div>
              <div class="helper" hidden></div>
            </div>
            <div class="field" id="f-tel">
              <label class="field-label" for="i-tel">Teléfono / WhatsApp<span class="opt">(opcional)</span></label>
              <div class="input">${icon('phone', 18)}<input id="i-tel" name="tel" type="tel" inputmode="numeric" autocomplete="tel" placeholder="300 000 0000" maxlength="14"></div>
              <div class="helper" hidden></div>
            </div>
            <div class="field" id="f-personas">
              <label class="field-label" for="i-personas">Número de personas<span class="req">*</span></label>
              <div class="input stepper">
                <button type="button" class="btn btn-icon btn-sm" data-step="-1" aria-label="Quitar una persona">${icon('minus', 16)}</button>
                <span class="value">${icon('users', 16, U.C.gray400)}<input id="i-personas" type="number" min="1" max="20" inputmode="numeric" placeholder="0" aria-describedby="h-personas"> personas</span>
                <button type="button" class="btn btn-icon btn-sm" data-step="1" aria-label="Agregar una persona">${icon('plus', 16)}</button>
              </div>
              <div class="helper" id="h-personas"></div>
              <div id="cap-alert"></div>
            </div>
          </div>
          <div class="soft summary" id="r-summary"></div>
          <div class="reserve-submit"><button type="submit" class="btn btn-primary btn-lg btn-block" id="r-submit">${icon('check', 18)}Confirmar reserva</button></div>
          <p class="caption muted reserve-note">Sin registro ni pagos. Tu mesa queda apartada al confirmar.</p>
        </form>
      </div>`;
    const box = $('#reserva-box');
    $$('[data-close]', box).forEach(b => b.onclick = closeReserva);
    const r = state.r;
    $('#i-nombre').value = r.nombre; $('#i-tel').value = formatTel(r.tel); $('#i-personas').value = r.personas || '';
    $('#i-nombre').addEventListener('input', e => { r.nombre = e.target.value; clearErr('nombre'); renderSteps(); });
    $('#i-nombre').addEventListener('blur', () => validate(['nombre']));
    $('#i-tel').addEventListener('input', e => { r.tel = e.target.value.replace(/\D/g, '').slice(0, 10); e.target.value = formatTel(r.tel); clearErr('tel'); });
    $('#i-tel').addEventListener('blur', () => validate(['tel']));
    $('#i-personas').addEventListener('input', e => { setPersonas(parseInt(e.target.value, 10) || 0, false); });
    $$('[data-step]', box).forEach(b => b.onclick = () => setPersonas((r.personas || 0) + Number(b.dataset.step), true));
    $('#r-form').addEventListener('submit', e => { e.preventDefault(); submit(); });
    renderCalendar(); renderDays(); renderSteps(); renderPersonasHelp(); renderSummary(); renderTop();
  }

  const duracion = () => { const h = state.horarios.find(x => x.activo); return h ? Number(h.duracion_slot) : 60; };
  const formatTel = (t) => { t = String(t || ''); return t.length > 6 ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : t.length > 3 ? `${t.slice(0, 3)} ${t.slice(3)}` : t; };

  /* ----- Paso 1: fecha (calendario en escritorio, tira de días en móvil) ----- */
  function renderCalendar() {
    const m = state.mes, y = m.getFullYear(), mo = m.getMonth();
    const hoy = U.isoDate(new Date());
    const first = new Date(y, mo, 1), offset = (first.getDay() + 6) % 7; // semana inicia el lunes
    const start = new Date(y, mo, 1 - offset);
    const minMes = new Date(); minMes.setDate(1);
    const puedeAtras = new Date(y, mo, 1) > new Date(minMes.getFullYear(), minMes.getMonth(), 1);
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const f = U.isoDate(d), otro = d.getMonth() !== mo;
      if (otro) { cells += `<span class="day is-muted" aria-hidden="true">${d.getDate()}</span>`; continue; }
      const pasado = f < hoy, cerrado = !U.diaAbierto(f, state.horarios);
      const cls = ['day', f === state.r.fecha ? 'is-sel' : '', f === hoy && f !== state.r.fecha ? 'is-today' : '', cerrado && !pasado ? 'is-closed' : ''].join(' ');
      cells += `<button type="button" class="${cls}" data-fecha="${f}" ${pasado || cerrado ? 'disabled' : ''} aria-label="${U.fechaLarga(f)}${cerrado ? ', cerrado' : ''}" aria-pressed="${f === state.r.fecha}">${d.getDate()}</button>`;
    }
    $('#r-cal').innerHTML = `<div class="cal">
      <div class="cal-head"><b class="h5">${U.MESES[mo][0].toUpperCase() + U.MESES[mo].slice(1)} ${y}</b>
        <div style="display:flex;gap:6px"><button type="button" class="btn btn-soft btn-icon btn-sm" data-mes="-1" ${puedeAtras ? '' : 'disabled'} aria-label="Mes anterior">${icon('cl', 16)}</button><button type="button" class="btn btn-soft btn-icon btn-sm" data-mes="1" aria-label="Mes siguiente">${icon('cr', 16)}</button></div></div>
      <div class="cal-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<span class="cal-wk">${d}</span>`).join('')}${cells}</div>
      <div class="cal-legend"><span><i style="width:10px;height:10px;border-radius:3px;background:var(--orange)"></i>Seleccionado</span><span><b style="color:var(--gray-300);text-decoration:line-through;font-weight:500">9</b>Cerrado</span></div></div>`;
    $$('[data-mes]', $('#r-cal')).forEach(b => b.onclick = () => { state.mes = new Date(y, mo + Number(b.dataset.mes), 1); renderCalendar(); });
    $$('[data-fecha]', $('#r-cal')).forEach(b => b.onclick = () => pickFecha(b.dataset.fecha));
  }
  function renderDays() {
    const d = new Date(); let html = '';
    for (let i = 0; i < 21; i++) {
      const f = U.isoDate(d), abierto = U.diaAbierto(f, state.horarios);
      html += `<button type="button" data-fecha="${f}" class="${f === state.r.fecha ? 'is-sel' : ''}" ${abierto ? '' : 'disabled'} aria-label="${U.fechaLarga(f)}"><small>${U.DIAS_CORTOS[d.getDay()]}</small><b>${d.getDate()}</b></button>`;
      d.setDate(d.getDate() + 1);
    }
    $('#r-days').innerHTML = html;
    const f = state.r.fecha ? U.parseDate(state.r.fecha) : new Date();
    $('#dm-label').textContent = `${U.MESES[f.getMonth()][0].toUpperCase() + U.MESES[f.getMonth()].slice(1)} ${f.getFullYear()}`;
    $$('[data-fecha]', $('#r-days')).forEach(b => b.onclick = () => pickFecha(b.dataset.fecha));
    const sel = $('#r-days .is-sel'); if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  function pickFecha(f) {
    state.r.fecha = f; state.r.hora = null; state.topAlert = null; clearErr('hora');
    renderCalendar(); renderDays(); renderTop(); renderSteps(); renderSummary(); loadSlots();
  }

  /* ----- Paso 2: hora (RF-04) ----- */
  function renderSlots() {
    const box = $('#r-slots'); if (!box) return;
    const msg = $('#r-slot-msg');
    msg.innerHTML = state.errors.hora ? `<div class="helper is-error" style="padding:10px 12px;border-radius:10px;background:var(--red-50)">${icon('alertc', 14)}${state.errors.hora}</div>` : '';
    if (state.jornadas === null) { box.innerHTML = '<div class="skeleton" style="height:240px"></div>'; return; }
    const libres = state.jornadas.flatMap(j => j.slots).filter(s => s.estado === 'av');
    if (!state.jornadas.length || !libres.length) {
      const alt = siguienteFechaConCupo();
      box.innerHTML = `<div class="slots-empty">${U.emptyArt().replace('<svg', '<svg class="big"')}
        <b class="h5">No hay horarios disponibles para esta fecha</b>
        <span class="body-sm muted">${state.r.fecha ? 'Todos los horarios de esta mesa están ocupados o ya pasaron. Elige otra fecha u horario.' : 'El restaurante no tiene días habilitados por ahora.'}</span>
        ${alt ? `<button type="button" class="btn btn-secondary btn-sm" data-alt="${alt}">${icon('calendar', 16)}Ver ${U.fechaCorta(alt).replace(/ \d{4}$/, '')}</button>` : ''}</div>`;
      const b = box.querySelector('[data-alt]'); if (b) b.onclick = () => pickFecha(b.dataset.alt);
      return;
    }
    box.innerHTML = state.jornadas.map(j => `<div class="slots-group">
      <div class="slots-title">${icon(j.jornada === 'almuerzo' ? 'sun' : 'clock', 15)}${j.jornada === 'almuerzo' ? 'Almuerzo' : 'Noche'} · ${U.hora12(j.desde).replace(/ [ap]\. m\./, '')} – ${U.hora12(j.hasta)}</div>
      <div class="slots">${j.slots.map(s => {
        const sel = s.hora === state.r.hora;
        const err = state.topAlert && state.topAlert.hora === s.hora;
        const cls = err ? 'is-err' : sel ? 'is-sel' : s.estado === 'oc' ? 'is-oc' : s.estado === 'dis' ? 'is-dis' : '';
        const label = s.estado === 'oc' ? 'ocupado' : s.estado === 'dis' ? 'no disponible' : 'disponible';
        return `<button type="button" class="slot ${cls}" data-hora="${s.hora}" ${s.estado !== 'av' ? 'disabled' : ''} aria-pressed="${sel}" aria-label="${s.hora}, ${label}">${s.hora}</button>`;
      }).join('')}</div></div>`).join('');
    $$('[data-hora]', box).forEach(b => b.onclick = () => pickHora(b.dataset.hora));
  }
  function pickHora(h) {
    state.r.hora = h; clearErr('hora');
    if (state.topAlert) { state.topAlert = null; renderTop(); }
    renderSlots(); renderSteps(); renderSummary();
    if (window.matchMedia('(max-width: 1023px)').matches) $('#i-nombre').focus({ preventScroll: false });
  }
  /** Siguiente día con atención (próximos 30) para sugerir otra fecha. */
  function siguienteFechaConCupo() {
    const d = state.r.fecha ? U.parseDate(state.r.fecha) : new Date();
    for (let i = 1; i <= 30; i++) { d.setDate(d.getDate() + 1); const f = U.isoDate(d); if (U.diaAbierto(f, state.horarios)) return f; }
    return null;
  }

  /* ----- Paso 3: datos y validaciones (RF-05) ----- */
  function setPersonas(n, fromButton) {
    const r = state.r;
    r.personas = Math.max(0, Math.min(20, n));
    if (fromButton) $('#i-personas').value = r.personas || '';
    clearErr('personas');
    if (r.personas > r.mesa.capacidad) validate(['personas']);
    renderPersonasHelp(); renderSteps(); renderSummary();
  }
  function renderPersonasHelp() {
    const r = state.r, f = $('#f-personas');
    const err = state.errors.personas;
    $('.input', f).classList.toggle('is-error', !!err);
    $('#h-personas').className = 'helper' + (err ? ' is-error' : '');
    $('#h-personas').innerHTML = err ? `${icon('alertc', 14)}${err}` : `${icon('info', 14, U.C.gray400)}Máximo ${r.mesa.capacidad} personas en esta mesa`;
    $('#cap-alert').innerHTML = r.personas > r.mesa.capacidad ? `<div class="alert alert-warning" style="margin-top:6px">${icon('alert', 20, '#D97706')}<div><b>¿Son más de ${r.mesa.capacidad}?</b>Corrige la cantidad o elige una mesa con mayor capacidad.
      <div class="alert-actions"><button type="button" class="btn btn-soft btn-sm" data-ajustar style="height:32px">Ajustar a ${r.mesa.capacidad}</button><button type="button" class="btn btn-ghost btn-sm" data-otra style="height:32px;color:var(--yellow-800)">Otra mesa${icon('arrowr', 16)}</button></div></div></div>` : '';
    const aj = $('[data-ajustar]'); if (aj) aj.onclick = () => setPersonas(r.mesa.capacidad, true);
    const ot = $('[data-otra]'); if (ot) ot.onclick = () => { closeReserva(); document.getElementById('mesas').scrollIntoView({ behavior: 'smooth' }); };
  }

  const RULES = {
    nombre: (r) => { const v = r.nombre.trim(); if (!v) return 'Ingresa tu nombre completo'; if (v.length < 3) return 'El nombre debe tener al menos 3 letras'; if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/.test(v)) return 'Usa solo letras y espacios'; return null; },
    tel: (r) => (r.tel && !/^3\d{9}$/.test(r.tel) && !/^\d{10}$/.test(r.tel)) ? 'Ingresa un número válido de 10 dígitos' : null,
    personas: (r) => !r.personas ? 'Indica cuántas personas asistirán' : r.personas > r.mesa.capacidad ? `La ${r.mesa.nombre} admite máximo ${r.mesa.capacidad} personas` : null,
    hora: (r) => !r.hora ? 'Selecciona un horario para continuar' : null,
  };
  function validate(keys) {
    let ok = true;
    keys.forEach(k => { const e = RULES[k](state.r); if (e) { state.errors[k] = e; ok = false; } else delete state.errors[k]; paintErr(k); });
    return ok;
  }
  function clearErr(k) { if (state.errors[k]) { delete state.errors[k]; paintErr(k); } }
  function paintErr(k) {
    if (k === 'hora') { renderSlots(); return; }
    if (k === 'personas') { renderPersonasHelp(); return; }
    const f = $('#f-' + k); if (!f) return;
    const e = state.errors[k], inp = $('.input', f), h = $('.helper', f);
    inp.classList.toggle('is-error', !!e);
    inp.classList.toggle('is-success', !e && k === 'tel' && /^\d{10}$/.test(state.r.tel || ''));
    h.hidden = !e; h.className = 'helper' + (e ? ' is-error' : ''); h.innerHTML = e ? `${icon('alertc', 14)}${e}` : '';
    $('input', f).setAttribute('aria-invalid', !!e);
  }

  function renderSteps() {
    const r = state.r; if (!$('#st-1')) return;
    const datosOk = !RULES.nombre(r) && !RULES.tel(r) && !RULES.personas(r);
    const step = (n, st, t, sub) => `<span class="step-n">${st === 'done' ? icon('check', 16, '#fff', 3) : n}</span><span class="t"><b class="h5">${t}</b><span class="body-sm muted">${sub}</span></span>`;
    const set = (id, st, html) => { const el = $(id); el.className = 'step' + (st === 'done' ? ' is-done' : st === 'active' ? ' is-active' : ''); el.innerHTML = html; };
    set('#st-1', r.fecha ? 'done' : 'active', step(1, r.fecha ? 'done' : 'active', 'Elige la fecha', r.fecha ? U.fechaLarga(r.fecha) : 'Días con atención'));
    const s2 = r.hora ? 'done' : r.fecha ? 'active' : 'pending';
    set('#st-2', s2, step(2, s2, 'Elige la hora', r.hora ? `${r.hora} – ${U.fromMin(U.toMin(r.hora) + duracion())}` : 'Selecciona un horario libre'));
    const s3 = r.hora && datosOk ? 'done' : r.hora ? 'active' : 'pending';
    set('#st-3', s3, step(3, s3, 'Tus datos', 'Sin registro ni pagos'));
  }

  function renderSummary() {
    const r = state.r, el = $('#r-summary'); if (!el) return;
    const row = (ic, k, v) => `<div class="summary-row"><span>${icon(ic, 16)}${k}</span><b class="${v ? '' : 'empty-val'}">${v || '—'}</b></div>`;
    el.innerHTML = `<span class="overline muted" style="font-size:11px">Resumen de tu reserva</span>
      ${row('table', 'Mesa', `${esc(r.mesa.nombre)} · ${U.zonaTxt(r.mesa.zona)}`)}${row('calendar', 'Fecha', r.fecha ? U.fechaCorta(r.fecha) : '')}
      ${row('clock', 'Hora', r.hora ? `${r.hora} – ${U.fromMin(U.toMin(r.hora) + duracion())}` : '')}
      ${row('users', 'Personas', r.personas ? `${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}${r.personas > r.mesa.capacidad ? ' · excede' : ''}` : '')}
      ${row('hourglass', 'Duración', `${duracion()} min`)}`;
  }

  function renderTop() {
    const box = $('#r-top'); if (!box) return;
    const a = state.topAlert;
    box.hidden = !a;
    if (!a) { box.innerHTML = ''; return; }
    const cercanos = (state.jornadas || []).flatMap(j => j.slots).filter(s => s.estado === 'av')
      .sort((x, y) => Math.abs(U.toMin(x.hora) - U.toMin(a.hora)) - Math.abs(U.toMin(y.hora) - U.toMin(a.hora))).slice(0, 2).sort((x, y) => U.toMin(x.hora) - U.toMin(y.hora));
    box.innerHTML = `<div class="alert alert-error" role="alert">${icon('alertc', 20)}<div style="flex:1"><b>Este horario ya no está disponible</b>Otra persona acaba de reservar la ${esc(state.r.mesa.nombre)} a las ${a.hora}. Tus datos se conservaron: solo elige otro horario para continuar.
      ${cercanos.length ? `<div class="alert-actions"><span class="caption">Horarios cercanos:</span>${cercanos.map(s => `<button type="button" class="slot" style="height:36px;width:72px" data-near="${s.hora}">${s.hora}</button>`).join('')}</div>` : ''}</div>
      <button type="button" class="close" aria-label="Cerrar aviso">${icon('x', 18)}</button></div>`;
    $$('[data-near]', box).forEach(b => b.onclick = () => pickHora(b.dataset.near));
    box.querySelector('.close').onclick = () => { state.topAlert = null; renderTop(); renderSlots(); };
  }

  /* ----- Confirmar (paso 10 del flujo: verificar disponibilidad y guardar) ----- */
  async function submit() {
    if (state.saving) return;
    const ok = validate(['hora', 'nombre', 'tel', 'personas']);
    $('#r-form-alert').innerHTML = ok ? '' : `<div class="alert alert-error" role="alert">${icon('alertc', 20)}<div><b>Revisa los campos marcados</b></div></div>`;
    renderSteps(); renderSummary();
    if (!ok) { const first = $('.is-error input, .helper.is-error', $('#reserva-box')); if (first && first.focus) first.focus(); return; }
    const r = state.r, btn = $('#r-submit');
    state.saving = true; btn.disabled = true; btn.innerHTML = 'Confirmando…';
    try {
      const reserva = await DB.crearReserva({ mesa_id: r.mesa.id, fecha: r.fecha, hora_inicio: r.hora, cliente_nombre: r.nombre, cliente_contacto: r.tel, num_personas: r.personas });
      closeReserva();
      if (reserva.fecha === U.isoDate(new Date())) state.reservasHoy.push(reserva);
      renderMesas();
      showConfirmacion(reserva, r.mesa);
      state.r = { ...state.r, hora: null };
    } catch (err) {
      if (err.code === 'HORA_OCUPADA') {
        state.topAlert = { hora: r.hora }; r.hora = null;
        await loadSlots(); renderTop();
        $('#reserva-box .reserve-grid').scrollTop = 0;
      } else if (err.code === 'CAPACIDAD') { validate(['personas']); }
      else if (err.code === 'MESA_INACTIVA') { U.toast(err.message, 'error'); closeReserva(); }
      else if (err.code === 'HORARIO_INVALIDO') { U.toast(err.message, 'error'); r.hora = null; await loadSlots(); }
      else if (err.code === 'DATOS_INVALIDOS') { U.toast(err.message, 'error'); validate(['nombre', 'tel', 'personas']); }
      else { console.error(err); U.toast('No pudimos guardar la reserva. Inténtalo de nuevo.', 'error'); }
    } finally {
      state.saving = false;
      if ($('#r-submit')) { btn.disabled = false; btn.innerHTML = `${icon('check', 18)}Confirmar reserva`; }
      renderSteps(); renderSummary();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Reserva confirmada (RF-06)                                         */
  /* ---------------------------------------------------------------- */
  function showConfirmacion(res, mesa) {
    const fin = res.hora_fin ? U.hhmm(res.hora_fin) : U.fromMin(U.toMin(res.hora_inicio) + duracion());
    const det = [['user', 'Cliente', res.cliente_nombre], ['table', 'Mesa', mesa.nombre], [U.zonaIcon(mesa.zona), 'Zona', U.zonaTxt(mesa.zona)], ['users', 'Personas', `${res.num_personas} ${res.num_personas === 1 ? 'persona' : 'personas'}`], ['calendar', 'Fecha', U.fechaLarga(res.fecha)], ['clock', 'Hora', `${U.hhmm(res.hora_inicio)} – ${fin}`]];
    const nombre = esc(String(res.cliente_nombre).trim().split(/\s+/)[0]);
    const v = $('#vista-confirmacion');
    v.innerHTML = `<div class="container">
      <div class="confirm-hero">${U.successArt()}<h1 class="h2">¡Tu reserva ha sido confirmada!</h1><p class="body-lg muted" style="max-width:560px">Te esperamos, ${nombre}. Presenta el código al llegar o muestra esta pantalla como comprobante.</p></div>
      <div class="card confirm-card">
        <div class="code-box"><div><small>Código de reserva</small><b>${U.codigoReserva(res)}</b></div>${chip('confirmada')}</div>
        <div class="detail-grid">${det.map(([i, k, val]) => `<div class="detail"><span class="ic">${icon(i, 18)}</span><div><span class="caption muted">${k}</span><b>${esc(val)}</b></div></div>`).join('')}</div>
        <div class="alert alert-info">${icon('info', 20)}<div><b>Tu mesa queda apartada por ${duracion()} minutos</b>Si necesitas cambiar o cancelar, escríbenos por WhatsApp al +57 300 000 0000 (número de ejemplo).</div></div>
        <div class="confirm-actions"><button class="btn btn-soft" id="c-print">${icon('printer', 18)}Guardar comprobante</button><button class="btn btn-primary" id="c-home">${icon('home', 18)}Volver al inicio</button></div>
      </div></div>`;
    $('#vista-inicio').hidden = true; v.hidden = false;
    $('#site-header').classList.add('is-light');
    $('#c-home').onclick = () => showInicio(true);
    $('#c-print').onclick = () => window.print();
    window.scrollTo({ top: 0 });
    history.pushState({ vista: 'confirmacion' }, '', '#confirmacion');
  }
  function showInicio(scrollTop) {
    $('#vista-confirmacion').hidden = true; $('#vista-inicio').hidden = false;
    $('#site-header').classList.remove('is-light');
    if (scrollTop) { history.pushState({}, '', '#inicio'); window.scrollTo({ top: 0 }); }
  }
  window.addEventListener('popstate', () => { if (!$('#vista-confirmacion').hidden) showInicio(true); });
})();

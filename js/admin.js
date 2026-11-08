/* ==========================================================================
   Konys Pizza · admin.js
   Módulo administrador (RF-08 a RF-14):
   acceso (contraseña demo o Supabase Auth) · resumen del día · reservas ·
   CRUD de mesas y cambio de estado · horarios por día · CRUD de la carta.
   ========================================================================== */
(function () {
  'use strict';
  const U = window.KUI;
  const { icon, esc, chip } = U;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const SECTIONS = { resumen: 'Resumen', reservas: 'Reservas', mesas: 'Mesas', horarios: 'Horarios', carta: 'Carta' };
  const DIAS_ORDEN = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const PAGE = 8;
  let sesionActual = null;

  const st = {
    mesas: [], horarios: [], platos: [], reservas: [],
    filtro: { fecha: U.isoDate(new Date()), mesa: '' }, page: 1,
    cartaCat: 'todo', cartaQ: '', horariosDraft: null, previewDia: null, cargaError: null,
  };

  document.addEventListener('DOMContentLoaded', () => {
    U.hydrateIcons();
    $('#login-pics').innerHTML = `<div class="media media-fill">${U.tableArt('terraza', 4)}</div><div class="media media-fill">${U.tableArt('salon', 6)}</div>`;
    const d = new Date();
    $('#today').insertAdjacentText('beforeend', `${U.DIAS[d.getDay()][0].toUpperCase() + U.DIAS[d.getDay()].slice(1)}, ${d.getDate()} ${U.MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`);
    bindLogin(); bindShell(); vigilarSesion();
    prepararFormulario();
    comprobarSesion();
  });

  /* ---------------------------------------------------------------- */
  /* Acceso (RF-08)                                                     */
  /* Demo: solo contraseña local. Supabase: correo + Auth + administradores. */
  /* ---------------------------------------------------------------- */
  function esSupabase() { return DB.mode === 'supabase'; }

  /** Solo modo demo. No es la contraseña del usuario de Supabase. */
  function passwordDemo() {
    const cfg = window.KONYS_CONFIG || {};
    return cfg.ADMIN_PASSWORD || 'konys2026';
  }

  function prepararFormulario() {
    const supa = esSupabase();
    $('#f-email').hidden = !supa;
    const email = $('#i-email');
    email.required = supa;
    email.disabled = !supa;
    if (!supa) email.value = '';
    const ayuda = $('#login-ayuda');
    if (ayuda) {
      ayuda.textContent = supa
        ? 'Ingresa con el correo y la contraseña de Supabase Authentication'
        : 'Ingresa la contraseña para continuar';
    }
  }

  async function comprobarSesion() {
    try {
      const s = await DB.auth.sesion();
      if (s && s.rol === 'admin') {
        aplicarUsuario(s);
        await enter();
        return;
      }
    } catch (e) {
      console.error(e && e.code ? e.code : 'sesion');
    }
    showLogin();
    if (DB.auth && DB.auth.aviso) alertaLogin('error', 'Cuenta sin permisos', DB.auth.aviso);
  }

  function aplicarUsuario(s) {
    sesionActual = s;
    const nombre = s.nombre || 'Administrador';
    $('#admin-user-name').textContent = nombre;
    $('#admin-user-email').textContent = s.email || 'Konys Pizza';
    const iniciales = nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
    $('#admin-avatar').textContent = iniciales || 'AD';
  }

  function showLogin() {
    $('#login').hidden = false;
    $('#shell').hidden = true;
    setTimeout(() => {
      if (esSupabase() && !$('#i-email').value) $('#i-email').focus();
      else $('#i-pass').focus();
    }, 50);
  }

  function limpiarErroresLogin() {
    ['email', 'pass'].forEach(k => {
      const f = $(`#f-${k}`);
      if (!f) return;
      f.querySelector('.input').classList.remove('is-error');
      const i = f.querySelector('input');
      if (i) i.setAttribute('aria-invalid', 'false');
      const h = f.querySelector('.helper');
      if (h) h.hidden = true;
    });
    $('#login-alert').innerHTML = '';
  }

  function marcarCampo(k, msg) {
    const f = $(`#f-${k}`);
    if (!f) return;
    f.querySelector('.input').classList.add('is-error');
    f.querySelector('input').setAttribute('aria-invalid', 'true');
    const h = f.querySelector('.helper');
    h.hidden = false;
    h.innerHTML = `${icon('alertc', 14)}${esc(msg)}`;
  }

  function alertaLogin(tipo, titulo, texto) {
    const estilo = tipo === 'warning' ? 'alert-warning' : 'alert-error';
    const ic = tipo === 'warning' ? 'lock' : 'alertc';
    $('#login-alert').innerHTML = `<div class="alert ${estilo}" role="alert" data-testid="login-error">${icon(ic, 20)}<div><b>${esc(titulo)}</b>${esc(texto)}</div></div>`;
  }

  function bindLogin() {
    $('#toggle-pass').onclick = () => {
      const i = $('#i-pass');
      i.type = i.type === 'password' ? 'text' : 'password';
      const oculto = i.type === 'password';
      $('#toggle-pass').innerHTML = icon(oculto ? 'eye' : 'eyeoff', 18);
      $('#toggle-pass').setAttribute('aria-pressed', String(!oculto));
      $('#toggle-pass').setAttribute('aria-label', oculto ? 'Mostrar contraseña' : 'Ocultar contraseña');
    };
    ['#i-email', '#i-pass'].forEach(sel => {
      $(sel).addEventListener('input', limpiarErroresLogin);
    });
    $('#login-form').addEventListener('submit', async e => {
      e.preventDefault();
      limpiarErroresLogin();
      if (esSupabase()) await entrarSupabase();
      else await entrarDemo();
    });
  }

  async function entrarDemo() {
    const v = $('#i-pass').value;
    if (v !== passwordDemo()) {
      marcarCampo('pass', v ? 'La contraseña no coincide' : 'Ingresa la contraseña');
      if (v) alertaLogin('error', 'Contraseña incorrecta', 'Verifica e inténtalo de nuevo.');
      $('#i-pass').focus();
      return;
    }
    const s = await DB.auth.abrir();
    $('#i-pass').value = '';
    aplicarUsuario(s);
    await enter();
  }

  async function entrarSupabase() {
    const email = $('#i-email').value.trim();
    const password = $('#i-pass').value;
    const campos = KVal.erroresLogin({ email, password });
    if (campos.email) marcarCampo('email', campos.email);
    if (campos.password) marcarCampo('pass', campos.password);
    if (campos.email || campos.password) {
      (campos.email ? $('#i-email') : $('#i-pass')).focus();
      return;
    }
    const btn = $('#login-form button[type="submit"]');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = 'Verificando…';
    try {
      const s = await DB.auth.login(email, password);
      if (!s || s.rol !== 'admin') {
        await DB.auth.cerrar();
        throw new DB.ReservaError('SIN_PERMISO', 'Esta cuenta no está registrada como administrador.');
      }
      aplicarUsuario(s);
      $('#i-email').value = '';
      $('#i-pass').value = '';
      await enter();
    } catch (err) {
      const code = err && err.code;
      console.error(code || 'login');
      if (code === 'CREDENCIALES') {
        marcarCampo('pass', 'Correo o contraseña incorrectos');
        alertaLogin('error', 'No pudimos iniciar sesión', err.message);
        $('#i-pass').focus();
      } else if (code === 'BLOQUEO') {
        alertaLogin('warning', 'Demasiados intentos', err.message);
        $('#i-pass').focus();
      } else if (code === 'SIN_PERMISO') {
        alertaLogin('error', 'Cuenta sin permisos', err.message);
        $('#i-email').focus();
      } else {
        alertaLogin('error', 'No pudimos iniciar sesión', (err && err.message) || 'Revisa la conexión e inténtalo de nuevo.');
        $('#i-email').focus();
      }
      $('#i-pass').value = '';
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.innerHTML = `Ingresar${icon('arrowr', 18)}`;
    }
  }

  function vigilarSesion() {
    setInterval(async () => {
      if ($('#shell').hidden) return;
      try {
        const s = await DB.auth.sesion();
        if (!s || s.rol !== 'admin') sesionExpirada();
      } catch (e) { /* sin red: no cerrar la sesión */ }
    }, 60000);
  }

  function sesionExpirada() {
    if ($('#shell').hidden) return;
    const aviso = DB.auth && DB.auth.aviso;
    DB.auth.cerrar();
    sesionActual = null;
    location.hash = '';
    showLogin();
    if (aviso) alertaLogin('error', 'Cuenta sin permisos', aviso);
    else U.toast('Tu sesión ya no es válida. Vuelve a iniciar sesión.', 'error');
  }

  async function enter() {
    $('#login').hidden = true;
    $('#shell').hidden = false;
    await loadAll();
    st.sinAdmin = DB.mode === 'supabase' && !(await DB.esAdmin());
    route();
  }

  /* ---------------------------------------------------------------- */
  /* Estructura del panel y navegación por hash                         */
  /* ---------------------------------------------------------------- */
  function bindShell() {
    $('#logout').onclick = async () => {
      await DB.auth.cerrar();
      sesionActual = null;
      location.hash = '';
      showLogin();
    };
    const shell = $('#shell');
    const menuBtn = $('#admin-menu');
    const cerrarMenu = () => { shell.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', 'false'); };
    menuBtn.onclick = () => { shell.classList.add('menu-open'); menuBtn.setAttribute('aria-expanded', 'true'); };
    $('#sidebar-backdrop').onclick = cerrarMenu;
    $$('.side-item').forEach(a => a.addEventListener('click', cerrarMenu));
    window.addEventListener('hashchange', () => { if (!$('#shell').hidden) route(); });
    const m = $('#admin-modal');
    m.addEventListener('click', e => { if (e.target === m) closeModal(); });
    m.addEventListener('modal:close', closeModal);
  }
  function route() {
    const sec = (location.hash || '#resumen').slice(1);
    const key = SECTIONS[sec] ? sec : 'resumen';
    $$('.side-item').forEach(a => a.classList.toggle('active', a.dataset.sec === key));
    $('#crumb').textContent = SECTIONS[key];
    document.title = `${SECTIONS[key]} · Konys Admin`;
    ({ resumen, reservas, mesas, horarios, carta })[key]();
    window.scrollTo({ top: 0 });
  }

  async function loadAll() {
    try {
      const [mesas, horarios, platos, reservas] = await Promise.all([DB.listMesas(), DB.listHorarios(), DB.listPlatos(), DB.listReservas()]);
      Object.assign(st, { mesas, horarios, platos, reservas, cargaError: null });
      updateBadge();
    } catch (err) {
      console.error(err);
      st.cargaError = err && err.code === 'SIN_PERMISO' ? null : err;
    }
  }
  const mesaById = (id) => st.mesas.find(m => m.id === Number(id));
  const hoy = () => U.isoDate(new Date());
  function proximasHoy() {
    const ahora = U.nowMin();
    return st.reservas.filter(r => r.fecha === hoy() && r.estado === 'confirmada' && U.toMin(r.hora_inicio) > ahora);
  }
  function updateBadge() { const n = proximasHoy().length; const b = $('#badge-res'); b.hidden = !n; b.textContent = n; }
  function estadoMesaAhora(m) {
    if (!m.activa) return { k: 'inactiva', sub: 'No visible para clientes' };
    const ahora = U.nowMin();
    const delDia = st.reservas.filter(r => r.mesa_id === m.id && r.fecha === hoy() && r.estado !== 'cancelada');
    const actual = delDia.find(r => U.toMin(r.hora_inicio) <= ahora && ahora < U.toMin(r.hora_fin));
    if (actual) return { k: 'ocupada', sub: `Hasta ${U.hhmm(actual.hora_fin)}` };
    const prox = delDia.filter(r => U.toMin(r.hora_inicio) > ahora).sort((a, b) => U.toMin(a.hora_inicio) - U.toMin(b.hora_inicio))[0];
    return { k: 'libre', sub: prox ? `Próxima ${U.hhmm(prox.hora_inicio)}` : 'Sin más reservas hoy' };
  }
  const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const head = (title, sub, actions = '') => `<div class="page-head"><div><h1 class="h2">${title}</h1><p class="body muted">${sub}</p></div><div class="page-actions">${actions}</div></div>`;
  const errMsg = (e, fallback) => (e && e.code === 'SIN_PERMISO') ? e.message : fallback;
  const avisoPermisos = () => st.sinAdmin ? `<div class="alert alert-warning" role="alert">${icon('lock', 20, '#D97706')}<div><b>Sesión sin permisos de administrador</b>La base de datos no entrega datos de clientes ni acepta cambios. La cuenta debe estar en la tabla <code>administradores</code> (supabase/schema.sql, sección 7).</div></div>` : '';
  function bannerCarga() {
    const e = st.cargaError;
    if (!e) return '';
    return `<div class="alert alert-error" role="alert" data-testid="admin-carga-error">${icon('alertc', 20)}<div><b>No pudimos cargar los datos del panel</b>${esc(e.message || 'Revisa la conexión e inténtalo de nuevo.')}<div class="alert-actions"><button type="button" class="btn btn-soft btn-sm" id="admin-reintentar" data-testid="admin-reintentar">Reintentar</button></div></div></div>`;
  }
  const render = (html) => {
    $('#content').innerHTML = avisoPermisos() + bannerCarga() + html;
    const b = $('#admin-reintentar');
    if (b) b.onclick = async () => { await loadAll(); route(); };
  };

  /* ---------------------------------------------------------------- */
  /* Resumen                                                            */
  /* ---------------------------------------------------------------- */
  function resumen() {
    const delDia = st.reservas.filter(r => r.fecha === hoy());
    const activas = st.mesas.filter(m => m.activa);
    const estados = st.mesas.map(m => ({ m, ...estadoMesaAhora(m) }));
    const ocupadas = estados.filter(e => e.k === 'ocupada');
    const prox = proximasHoy();
    const h = new Date().getHours();
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const kpi = (ic, bg, fg, label, val, sub) => `<div class="panel kpi"><div class="kpi-top"><span class="body-sm muted" style="font-weight:500">${label}</span><span class="kpi-ic" style="background:${bg};color:${fg}">${icon(ic, 20)}</span></div><div><b>${val}</b><div class="caption muted" style="font-size:13px">${sub}</div></div></div>`;

    // Actividad: reservas por franja horaria del día (según los horarios configurados).
    const jornadas = U.generarSlots(hoy(), st.horarios, []);
    const franjas = jornadas.flatMap(j => j.slots.filter(s => U.toMin(s.fin) <= U.toMin(j.hasta)).map(s => ({ hora: s.hora, j: j.jornada })));
    const conteo = franjas.map(f => ({ ...f, n: delDia.filter(r => r.estado !== 'cancelada' && U.hhmm(r.hora_inicio) === f.hora).length }));
    const max = Math.max(1, ...conteo.map(c => c.n));
    const chart = jornadas.length ? `<div class="bars">${conteo.map(c => `<div class="bar"><span class="caption" style="font-weight:600;color:${c.n ? 'var(--wine)' : 'var(--gray-300)'}">${c.n}</span><i class="${c.n === max && c.n > 1 ? 'peak' : c.j === 'almuerzo' ? 'alm' : ''}" style="height:${(c.n / max) * 170}px"></i></div>`).join('')}</div>
      <div class="bar-labels">${conteo.map(c => `<span>${c.hora}</span>`).join('')}</div>
      <div class="legend"><span><i style="background:#F9C48E;border-color:#F9C48E"></i>Almuerzo</span><span><i style="background:var(--wine-600);border-color:var(--wine-600)"></i>Noche</span><span><i class="sel"></i>Hora pico</span></div>`
      : `<div class="slots-empty">${icon('clock', 32, U.C.gray400)}<b class="h5">Hoy el restaurante está cerrado</b><span class="body-sm muted">Puedes cambiarlo en la sección Horarios.</span></div>`;

    render(`${head(`${saludo} 👋`, 'Esto es lo que pasa hoy en Konys Pizza.', `<a href="#mesas" class="btn btn-soft" data-testid="mesa-nueva" data-new-mesa>${icon('plus', 18)}Nueva mesa</a><a href="#reservas" class="btn btn-primary" data-testid="ver-reservas">${icon('calcheck', 18)}Ver reservas</a>`)}
      <div class="kpis">
        ${kpi('calcheck', 'var(--orange-100)', 'var(--orange-700)', 'Reservas del día', delDia.filter(r => r.estado !== 'cancelada').length, `${pl(delDia.filter(r => r.estado === 'completada').length, 'completada', 'completadas')} · ${pl(delDia.filter(r => r.estado === 'cancelada').length, 'cancelada', 'canceladas')}`)}
        ${kpi('table', 'var(--green-50)', 'var(--green)', 'Mesas disponibles', activas.length - ocupadas.length, `de ${pl(activas.length, 'mesa activa', 'mesas activas')}`)}
        ${kpi('users', 'var(--red-50)', 'var(--red)', 'Mesas ocupadas', ocupadas.length, ocupadas.length ? ocupadas.map(o => `${esc(o.m.nombre)} ${o.sub.toLowerCase()}`).slice(0, 1).join('') : 'Ninguna en este momento')}
        ${kpi('clock', 'var(--wine-100)', 'var(--wine)', 'Próximas reservas', prox.length, 'en lo que queda del día')}
      </div>
      <div class="dash-row">
        <div class="panel chart"><div style="display:flex;justify-content:space-between;align-items:center"><div><b class="h5">Actividad de hoy</b><div class="body-sm muted">Reservas por franja horaria</div></div></div>${chart}</div>
        <div class="panel mini-list"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><b class="h5">Estado de mesas</b><div class="body-sm muted">Ahora · ${U.hora12(U.fromMin(U.nowMin()))}</div></div><a href="#mesas" class="btn btn-ghost btn-sm">Gestionar${icon('arrowr', 16)}</a></div>
          ${estados.map(e => `<div class="mini-item"><span class="ic">${icon('table', 18)}</span><div class="grow"><b class="label">${esc(e.m.nombre)}</b><span class="caption muted">${U.zonaTxt(e.m.zona)} · ${e.m.capacidad} personas</span></div><div class="end">${chip(e.k)}<span class="caption muted">${e.sub}</span></div></div>`).join('') || '<p class="body-sm muted">No hay mesas registradas.</p>'}
        </div>
      </div>
      <div class="table-wrap"><div class="table-title"><b class="h5">Próximas reservas de hoy</b><a href="#reservas" class="btn btn-ghost btn-sm">Ver todas${icon('arrowr', 16)}</a></div>
        <div class="table-scroll">${prox.length ? `<table class="table"><thead><tr><th>Cliente</th><th>Mesa</th><th>Hora</th><th>Personas</th><th>Estado</th></tr></thead><tbody>
          ${prox.slice(0, 5).map((r, i) => `<tr><td><div class="who"><span class="avatar">${U.initials(r.cliente_nombre)}</span><b class="label">${esc(r.cliente_nombre)}</b></div></td><td>${esc((mesaById(r.mesa_id) || {}).nombre || '—')}</td><td><b>${U.hhmm(r.hora_inicio)}</b></td><td>${r.num_personas}</td><td>${chip(i === 0 ? 'proxima' : 'confirmada')}</td></tr>`).join('')}</tbody></table>`
          : `<p class="body-sm muted" style="padding:0 24px 24px">No quedan reservas confirmadas para hoy.</p>`}</div></div>`);
    const nm = $('[data-new-mesa]'); if (nm) nm.addEventListener('click', () => setTimeout(() => mesaForm(), 50));
  }

  /* ---------------------------------------------------------------- */
  /* Reservas (RF-12)                                                    */
  /* ---------------------------------------------------------------- */
  function reservas() {
    const f = st.filtro;
    const list = st.reservas.filter(r => (!f.fecha || r.fecha === f.fecha) && (!f.mesa || r.mesa_id === Number(f.mesa)))
      .sort((a, b) => (a.fecha + U.hhmm(a.hora_inicio)).localeCompare(b.fecha + U.hhmm(b.hora_inicio)));
    const pages = Math.max(1, Math.ceil(list.length / PAGE)); st.page = Math.min(st.page, pages);
    const slice = list.slice((st.page - 1) * PAGE, st.page * PAGE);
    const cnt = (e) => list.filter(r => r.estado === e).length;
    render(`${head('Reservas', 'Consulta y gestiona las reservas registradas.')}
      <form class="panel filters" id="filtros">
        <div class="field"><label class="field-label" for="fl-fecha">Fecha</label><div class="input">${icon('calendar', 18)}<input type="date" id="fl-fecha" data-testid="reservas-fecha" value="${f.fecha}"></div></div>
        <div class="field"><label class="field-label" for="fl-mesa">Mesa</label><div class="input"><select id="fl-mesa" data-testid="reservas-mesa"><option value="">Todas las mesas</option>${st.mesas.map(m => `<option value="${m.id}" ${String(m.id) === String(f.mesa) ? 'selected' : ''}>${esc(m.nombre)} · ${U.zonaTxt(m.zona)}</option>`).join('')}</select>${icon('cd', 16)}</div></div>
        <button class="btn btn-dark" type="submit" data-testid="reservas-filtrar">${icon('filter', 18)}Filtrar</button>
        <button class="btn btn-ghost" type="button" id="fl-clear" data-testid="reservas-limpiar">Limpiar</button>
        <div class="counts">${chip('confirmada', pl(cnt('confirmada'), 'confirmada', 'confirmadas'))}${chip('completada', pl(cnt('completada'), 'completada', 'completadas'))}${chip('cancelada', pl(cnt('cancelada'), 'cancelada', 'canceladas'))}</div>
      </form>
      <div class="table-wrap"><div class="table-scroll">
        ${slice.length ? `<table class="table" data-testid="reservas-list"><thead><tr><th>Cliente</th><th>Mesa</th><th>Fecha</th><th>Hora</th><th>Personas</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead><tbody>
        ${slice.map(r => `<tr><td><div class="who"><span class="avatar">${U.initials(r.cliente_nombre)}</span><div><b class="label">${esc(r.cliente_nombre)}</b><span class="caption muted">${r.cliente_contacto ? esc(r.cliente_contacto) : 'Sin contacto'}</span></div></div></td>
          <td>${esc((mesaById(r.mesa_id) || {}).nombre || 'Mesa eliminada')}</td><td>${U.fechaNum(r.fecha)}</td><td><b>${U.hhmm(r.hora_inicio)}</b></td><td>${r.num_personas}</td><td>${chip(r.estado)}</td>
          <td><div class="actions"><button class="btn btn-soft btn-icon btn-sm" data-testid="reserva-ver" data-ver="${r.id}" aria-label="Ver detalle">${icon('eye', 16)}</button>
          ${r.estado === 'confirmada' ? `<button class="btn btn-soft btn-sm" data-testid="reserva-completar" data-completar="${r.id}">${icon('check', 16)}Completar</button><button class="btn btn-danger-outline btn-icon btn-sm" data-testid="reserva-cancelar" data-cancelar="${r.id}" aria-label="Cancelar reserva">${icon('x', 16)}</button>` : ''}</div></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty" data-testid="reservas-empty" style="border:0;border-radius:0">${U.emptyArt()}<b class="h4">No hay reservas con estos filtros</b><p class="body-sm muted">Cambia la fecha o la mesa, o pulsa «Limpiar» para ver todas.</p></div>`}
      </div>
      <div class="pager"><span class="body-sm muted">Mostrando ${list.length ? (st.page - 1) * PAGE + 1 : 0}–${Math.min(st.page * PAGE, list.length)} de ${list.length} reservas</span>
        <div class="pages"><button class="btn btn-soft btn-icon btn-sm" data-pg="${st.page - 1}" ${st.page === 1 ? 'disabled' : ''} aria-label="Anterior">${icon('cl', 16)}</button>
        ${Array.from({ length: pages }, (_, i) => `<button class="pg" data-pg="${i + 1}" aria-current="${i + 1 === st.page}">${i + 1}</button>`).join('')}
        <button class="btn btn-soft btn-icon btn-sm" data-pg="${st.page + 1}" ${st.page === pages ? 'disabled' : ''} aria-label="Siguiente">${icon('cr', 16)}</button></div></div></div>`);
    $('#filtros').onsubmit = (e) => { e.preventDefault(); st.filtro = { fecha: $('#fl-fecha').value, mesa: $('#fl-mesa').value }; st.page = 1; reservas(); };
    $('#fl-clear').onclick = () => { st.filtro = { fecha: '', mesa: '' }; st.page = 1; reservas(); };
    $$('[data-pg]').forEach(b => b.onclick = () => { st.page = Number(b.dataset.pg); reservas(); });
    $$('[data-ver]').forEach(b => b.onclick = () => reservaDetalle(Number(b.dataset.ver)));
    $$('[data-completar]').forEach(b => b.onclick = () => cambiarEstado(Number(b.dataset.completar), 'completada'));
    $$('[data-cancelar]').forEach(b => b.onclick = () => confirmar({ title: '¿Cancelar esta reserva?', text: 'El horario volverá a quedar disponible para otros clientes.', cta: 'Cancelar reserva', danger: true, icon: 'x', onOk: () => cambiarEstado(Number(b.dataset.cancelar), 'cancelada') }));
  }
  async function cambiarEstado(id, estado) {
    try {
      const r = await DB.setEstadoReserva(id, estado);
      const i = st.reservas.findIndex(x => x.id === id); if (i >= 0) st.reservas[i] = { ...st.reservas[i], estado };
      updateBadge(); closeModal(); route();
      U.toast(estado === 'completada' ? 'Reserva marcada como completada' : 'Reserva cancelada', estado === 'completada' ? 'success' : 'info');
      return r;
    } catch (e) { console.error(e); U.toast(errMsg(e, 'No se pudo actualizar la reserva'), 'error'); }
  }
  function reservaDetalle(id) {
    const r = st.reservas.find(x => x.id === id); if (!r) return;
    const m = mesaById(r.mesa_id) || { nombre: 'Mesa eliminada', zona: 'salon' };
    const row = (ic, k, v) => `<div class="summary-row"><span>${icon(ic, 16)}${k}</span><b>${v}</b></div>`;
    openModal(`<div class="modal-head"><div><b class="h4">Reserva ${U.codigoReserva(r)}</b><div class="body-sm muted">Registrada el ${r.creado_en ? U.fechaNum(r.creado_en.slice(0, 10)) : '—'}</div></div><button class="btn btn-soft btn-icon" data-close aria-label="Cerrar">${icon('x', 18)}</button></div>
      <div class="modal-body"><div style="display:flex;align-items:center;justify-content:space-between"><div class="who" style="display:flex;gap:12px;align-items:center"><span class="avatar">${U.initials(r.cliente_nombre)}</span><div style="display:flex;flex-direction:column"><b class="label">${esc(r.cliente_nombre)}</b><span class="caption muted">${r.cliente_contacto ? esc(r.cliente_contacto) : 'Sin contacto'}</span></div></div>${chip(r.estado)}</div>
      <div class="soft summary">${row('table', 'Mesa', `${esc(m.nombre)} · ${U.zonaTxt(m.zona)}`)}${row('calendar', 'Fecha', U.fechaLarga(r.fecha))}${row('clock', 'Hora', `${U.hhmm(r.hora_inicio)} – ${U.hhmm(r.hora_fin)}`)}${row('users', 'Personas', r.num_personas)}</div></div>
      <div class="modal-foot">${r.estado === 'confirmada' ? `<button class="btn btn-danger-outline" data-c>${icon('x', 18)}Cancelar reserva</button><button class="btn btn-primary" data-ok>${icon('check', 18)}Marcar completada</button>` : `<button class="btn btn-soft" data-close>Cerrar</button>`}</div>`, 520);
    const b = $('#admin-modal-box');
    if ($('[data-ok]', b)) { $('[data-ok]', b).onclick = () => cambiarEstado(id, 'completada'); $('[data-c]', b).onclick = () => cambiarEstado(id, 'cancelada'); }
  }

  /* ---------------------------------------------------------------- */
  /* Mesas (RF-09, RF-10, RF-13)                                         */
  /* ---------------------------------------------------------------- */
  function mesas() {
    const act = st.mesas.filter(m => m.activa).length;
    render(`${head('Mesas', 'Registra y administra las mesas del restaurante.', `<button class="btn btn-primary" id="nueva-mesa" data-testid="mesa-nueva">${icon('plus', 18)}Nueva mesa</button>`)}
      <div class="chips-row"><span class="chip chip-neutral">${st.mesas.length} mesas registradas</span>${chip('activa', pl(act, 'activa', 'activas'))}${chip('inactiva', pl(st.mesas.length - act, 'inactiva', 'inactivas'))}</div>
      <div class="table-wrap"><div class="table-scroll">
        ${st.mesas.length ? `<table class="table"><thead><tr><th>Mesa</th><th>Zona</th><th>Capacidad</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead><tbody>
        ${st.mesas.map(m => `<tr class="${m.activa ? '' : 'is-muted'}"><td><div class="who"><span class="thumb" style="${m.activa ? '' : 'opacity:.5'}">${U.mesaImg(m, 'media-fill')}</span><div><b class="label">${esc(m.nombre)}</b><span class="caption muted">${m.creado_en ? 'Creada ' + U.fechaNum(m.creado_en.slice(0, 10)) : ''}</span></div></div></td>
          <td><span class="ic-text">${icon(U.zonaIcon(m.zona), 16)}${U.zonaTxt(m.zona)}</span></td><td><span class="ic-text">${icon('users', 16)}${m.capacidad} personas</span></td>
          <td><label class="toggle-wrap"><button class="toggle" role="switch" aria-checked="${m.activa}" data-testid="mesa-toggle" data-toggle="${m.id}" aria-label="Activar o desactivar ${esc(m.nombre)}"></button><span style="color:${m.activa ? 'var(--green-700)' : 'var(--gray-500)'}">${m.activa ? 'Activa' : 'Inactiva'}</span></label></td>
          <td><div class="actions"><button class="btn btn-soft btn-sm" data-testid="mesa-editar" data-edit="${m.id}">${icon('pencil', 16)}Editar</button><button class="btn btn-danger-outline btn-sm" data-testid="mesa-eliminar" data-del="${m.id}">${icon('trash', 16)}Eliminar</button></div></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty" data-testid="mesas-empty" style="border:0">${U.emptyArt()}<b class="h4">Aún no hay mesas</b><p class="body-sm muted">Registra la primera mesa para empezar a recibir reservas.</p></div>`}
      </div></div>
      <div class="alert alert-info">${icon('info', 20)}<div><b>Las mesas inactivas no aparecen para los clientes</b>Úsalo para mantenimiento, eventos privados o cierre temporal de la terraza.</div></div>`);
    $('#nueva-mesa').onclick = () => mesaForm();
    $$('[data-edit]').forEach(b => b.onclick = () => mesaForm(mesaById(b.dataset.edit)));
    $$('[data-toggle]').forEach(b => b.onclick = () => toggleMesa(mesaById(b.dataset.toggle)));
    $$('[data-del]').forEach(b => b.onclick = () => {
      const m = mesaById(b.dataset.del);
      const futuras = st.reservas.filter(r => r.mesa_id === m.id && r.estado === 'confirmada' && r.fecha >= hoy()).length;
      confirmar({ title: `¿Eliminar la ${m.nombre}?`, text: `Se eliminará la mesa y dejará de aparecer para los clientes.${futuras ? ` Tiene ${futuras} reserva(s) confirmada(s) próximas: considera desactivarla en lugar de eliminarla.` : ''}`, cta: 'Eliminar mesa', danger: true, icon: 'trash', onOk: () => deleteMesa(m) });
    });
  }
  async function toggleMesa(m) {
    try { await DB.saveMesa({ id: m.id, activa: !m.activa }); m.activa = !m.activa; mesas(); U.toast(`${m.nombre} ${m.activa ? 'activada' : 'desactivada'}`, 'info'); }
    catch (e) { console.error(e); U.toast(errMsg(e, 'No se pudo cambiar el estado'), 'error'); }
  }
  async function deleteMesa(m) {
    try { await DB.deleteMesa(m.id); st.mesas = st.mesas.filter(x => x.id !== m.id); closeModal(); mesas(); U.toast(`${m.nombre} eliminada`, 'info'); }
    catch (e) { console.error(e); closeModal(); U.toast(errMsg(e, 'No se pudo eliminar. Si tiene reservas asociadas, desactívala.'), 'error'); }
  }
  function mesaForm(m) {
    const edit = !!m; const d = m ? { ...m } : { nombre: `Mesa ${st.mesas.length + 1}`, zona: 'terraza', capacidad: 4, activa: true, foto_url: '' };
    openModal(`<div class="modal-head"><div><b class="h4">${edit ? 'Editar mesa' : 'Nueva mesa'}</b><div class="body-sm muted">${edit ? 'Actualiza los datos de la mesa.' : 'Completa los datos para habilitarla en reservas.'}</div></div><button class="btn btn-soft btn-icon" data-close aria-label="Cerrar">${icon('x', 18)}</button></div>
      <form id="mesa-form" data-testid="mesa-form" novalidate><div class="modal-body">
        ${fieldHTML('m-nombre', 'Nombre o número', `<input id="m-nombre" maxlength="30" value="${esc(d.nombre)}" placeholder="Ej. Mesa 6">`, { icon: 'table', req: true })}
        <div class="field"><span class="field-label">Zona<span class="req">*</span></span><div class="seg" id="m-zona">${['terraza', 'salon'].map(z => `<button type="button" data-z="${z}" aria-pressed="${d.zona === z}">${icon(U.zonaIcon(z), 16)}${U.zonaTxt(z)}</button>`).join('')}</div></div>
        <div class="form-grid">
          ${fieldHTML('m-cap', 'Capacidad', `<input id="m-cap" type="number" min="1" max="12" inputmode="numeric" value="${d.capacidad}"><span class="suffix">personas</span>`, { icon: 'users', req: true })}
          <div class="field"><span class="field-label">Estado</span><div class="input" style="justify-content:space-between;color:var(--ink)"><span id="m-act-l">${d.activa ? 'Activa' : 'Inactiva'}</span><button type="button" class="toggle" role="switch" id="m-act" aria-checked="${d.activa}" aria-label="Mesa activa"></button></div><div class="helper">Visible para clientes cuando está activa</div></div>
        </div>
        ${fieldHTML('m-foto', 'Foto', `<input id="m-foto" type="url" value="${esc(d.foto_url || '')}" placeholder="https://… (opcional)">`, { icon: 'image', opt: '(opcional)', help: 'Si la dejas vacía se usa la ilustración de la mesa.' })}
        <div class="upload"><span class="media media-fill" id="m-prev">${U.mesaImg(d, 'media-fill')}</span><div><b class="label">Vista previa</b><div class="caption muted">Así se verá la tarjeta en el sitio.</div></div></div>
      </div>
      <div class="modal-foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button type="submit" class="btn btn-primary" data-testid="mesa-guardar">${icon('save', 18)}${edit ? 'Guardar cambios' : 'Guardar mesa'}</button></div></form>`, 560);
    const box = $('#admin-modal-box');
    const prev = () => { $('#m-prev').innerHTML = U.mesaImg({ ...d, foto_url: $('#m-foto').value.trim() }, 'media-fill'); };
    $$('[data-z]', box).forEach(b => b.onclick = () => { d.zona = b.dataset.z; $$('[data-z]', box).forEach(x => x.setAttribute('aria-pressed', x === b)); prev(); });
    $('#m-act').onclick = () => { d.activa = !d.activa; $('#m-act').setAttribute('aria-checked', d.activa); $('#m-act-l').textContent = d.activa ? 'Activa' : 'Inactiva'; };
    $('#m-cap').oninput = () => { d.capacidad = Number($('#m-cap').value) || 0; setErr('m-cap'); prev(); };
    $('#m-nombre').oninput = () => setErr('m-nombre');
    $('#m-foto').oninput = () => setErr('m-foto');
    $('#mesa-form').onsubmit = async (e) => {
      e.preventDefault();
      const nombre = $('#m-nombre').value.trim(), cap = Number($('#m-cap').value), foto = $('#m-foto').value.trim();
      const data = { nombre, zona: d.zona, capacidad: cap, activa: d.activa, foto_url: foto || null };
      const errores = KVal.erroresMesa(data, st.mesas, edit ? m.id : null);
      setErr('m-nombre', errores.nombre);
      setErr('m-cap', errores.capacidad);
      setErr('m-foto', errores.foto);
      if (KVal.primerError(errores)) { if (errores.zona) U.toast(errores.zona, 'error'); return; }
      try {
        await DB.saveMesa(edit ? { id: m.id, ...data } : data);
        st.mesas = await DB.listMesas(); closeModal(); mesas(); U.toast(edit ? 'Mesa actualizada' : `${nombre} registrada`);
      } catch (err) { console.error(err); U.toast(errMsg(err, 'No se pudo guardar la mesa'), 'error'); }
    };
  }

  /* ---------------------------------------------------------------- */
  /* Horarios (RF-11)                                                    */
  /* ---------------------------------------------------------------- */
  function horarios() {
    if (!st.horariosDraft) st.horariosDraft = JSON.parse(JSON.stringify(st.horarios));
    const draft = st.horariosDraft;
    const dirty = JSON.stringify(draft) !== JSON.stringify(st.horarios);
    const hoyDia = U.DIAS[new Date().getDay()];
    if (!st.previewDia) st.previewDia = hoyDia;
    const rows = DIAS_ORDEN.map(dia => {
      const js = draft.filter(h => h.dia_semana === dia).sort((a, b) => U.toMin(a.hora_inicio) - U.toMin(b.hora_inicio));
      const on = js.some(h => h.activo);
      const dur = js[0] ? js[0].duracion_slot : 60;
      return `<tr class="${on ? '' : 'is-muted'}" data-dia="${dia}" style="cursor:pointer">
        <td><div style="display:flex;flex-direction:column"><b class="label" style="${on ? '' : 'color:var(--gray-400)'}">${dia[0].toUpperCase() + dia.slice(1)}</b>${dia === hoyDia ? '<span class="caption orange">Hoy</span>' : ''}${dia === st.previewDia ? '<span class="caption muted">Vista previa</span>' : ''}</div></td>
        <td>${on ? `<div class="jornadas">${js.map(h => `<div class="jornada"><span class="tag ${h.jornada === 'almuerzo' ? 'tag-accent' : ''}">${h.jornada === 'almuerzo' ? 'Almuerzo' : 'Noche'}</span>
          <div class="input time">${icon('clock', 14)}<input type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${U.hhmm(h.hora_inicio)}" data-h="${h.id}" data-k="hora_inicio" aria-label="Inicio ${h.jornada} ${dia}"></div><span class="muted">—</span>
          <div class="input time">${icon('clock', 14)}<input type="text" inputmode="numeric" maxlength="5" placeholder="HH:MM" value="${U.hhmm(h.hora_fin)}" data-h="${h.id}" data-k="hora_fin" aria-label="Cierre ${h.jornada} ${dia}"></div></div>`).join('')}</div>` : '<span class="chip chip-inactiva"><span class="dot"></span>Cerrado</span>'}</td>
        <td>${on ? `<div class="input dur"><select data-dur="${dia}" aria-label="Duración ${dia}">${[30, 45, 60, 90, 120].map(v => `<option value="${v}" ${Number(dur) === v ? 'selected' : ''}>${v} min</option>`).join('')}</select>${icon('cd', 14)}</div>` : '<span class="muted">—</span>'}</td>
        <td><label class="toggle-wrap"><button type="button" class="toggle" role="switch" aria-checked="${on}" data-dia-toggle="${dia}" aria-label="Abrir o cerrar ${dia}"></button><span style="color:${on ? 'var(--green-700)' : 'var(--gray-500)'}">${on ? 'Abierto' : 'Cerrado'}</span></label></td></tr>`;
    }).join('');
    const pv = U.generarSlots(nextDateFor(st.previewDia), draft, []);
    const total = pv.flatMap(j => j.slots.filter(s => U.toMin(s.fin) <= U.toMin(j.hasta))).length;
    const errores = validarHorarios(draft);
    render(`${head('Horarios de atención', 'Define las jornadas por día y la duración de cada reserva.', `<button class="btn btn-soft" id="h-discard" data-testid="horarios-descartar" ${dirty ? '' : 'disabled'}>Descartar</button><button class="btn btn-primary" id="h-save" data-testid="horarios-guardar" ${dirty ? '' : 'disabled'}>${icon('save', 18)}Guardar cambios</button>`)}
      ${errores.length ? `<div class="alert alert-error" role="alert" data-testid="horarios-error">${icon('alertc', 20)}<div><b>Revisa los horarios</b>${errores.map(esc).join('<br>')}</div></div>` : dirty ? `<div class="alert alert-warning">${icon('alert', 20, '#D97706')}<div><b>Tienes cambios sin guardar</b>Guarda para que los clientes vean los nuevos horarios.</div></div>` : ''}
      <div class="horarios-layout">
        <div class="table-wrap"><div class="table-scroll"><table class="table"><thead><tr><th>Día</th><th>Jornadas · inicio y cierre</th><th>Duración</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div></div>
        <div class="panel preview"><div><b class="h5">Vista previa de slots</b><div class="body-sm muted">${st.previewDia[0].toUpperCase() + st.previewDia.slice(1)} · reservas de ${(draft.find(h => h.dia_semana === st.previewDia) || {}).duracion_slot || 60} min</div></div>
          ${pv.length ? pv.map(j => `<div style="display:flex;flex-direction:column;gap:8px"><span class="caption muted" style="font-weight:600">${j.jornada === 'almuerzo' ? 'Almuerzo' : 'Noche'}</span><div class="pv">${j.slots.map(s => `<span class="${U.toMin(s.fin) > U.toMin(j.hasta) ? 'dis' : ''}">${s.hora}</span>`).join('')}</div></div>`).join('')
          : `<p class="body-sm muted">Este día está cerrado: no se generan horarios.</p>`}
          <div class="alert alert-info">${icon('info', 20)}<div><b>${total} horarios por mesa</b>Se generan cada 30 min según la jornada y la duración. Los punteados no alcanzan a terminar antes del cierre.</div></div>
          <p class="caption muted">Toca un día de la tabla para ver su vista previa.</p></div>
      </div>`);
    $$('[data-h]').forEach(i => i.onchange = () => { const h = draft.find(x => x.id === Number(i.dataset.h)); let v = i.value.trim(); if (/^\d{3,4}$/.test(v)) v = v.padStart(4, '0').replace(/(\d\d)(\d\d)/, '$1:$2'); h[i.dataset.k] = v; horarios(); });
    $$('[data-dur]').forEach(s => s.onchange = () => { draft.filter(h => h.dia_semana === s.dataset.dur).forEach(h => h.duracion_slot = Number(s.value)); horarios(); });
    $$('[data-dia-toggle]').forEach(b => b.onclick = (e) => { e.stopPropagation(); const dia = b.dataset.diaToggle; const on = draft.filter(h => h.dia_semana === dia).some(h => h.activo); draft.filter(h => h.dia_semana === dia).forEach(h => h.activo = !on); horarios(); });
    $$('tr[data-dia]').forEach(tr => tr.addEventListener('click', e => { if (e.target.closest('input,select,button')) return; st.previewDia = tr.dataset.dia; horarios(); }));
    $('#h-discard').onclick = () => { st.horariosDraft = null; horarios(); };
    $('#h-save').onclick = async () => {
      if (errores.length) { U.toast('Corrige los horarios antes de guardar', 'error'); return; }
      try { await DB.saveHorarios(draft); st.horarios = JSON.parse(JSON.stringify(draft)); horarios(); U.toast('Horarios guardados'); }
      catch (e) { console.error(e); U.toast(errMsg(e, 'No se pudieron guardar los horarios'), 'error'); }
    };
  }
  function validarHorarios(rows) { return KVal.erroresHorarios(rows); }
  function nextDateFor(dia) { const d = new Date(); for (let i = 0; i < 7; i++) { if (U.DIAS[d.getDay()] === dia) break; d.setDate(d.getDate() + 1); } d.setDate(d.getDate() + 7); return U.isoDate(d); }

  /* ---------------------------------------------------------------- */
  /* Carta (RF-14)                                                       */
  /* ---------------------------------------------------------------- */
  function carta() {
    const q = st.cartaQ.toLowerCase();
    const list = st.platos.filter(p => (st.cartaCat === 'todo' || p.categoria === st.cartaCat) && (!q || (p.nombre + ' ' + p.descripcion).toLowerCase().includes(q)));
    const n = (c) => st.platos.filter(p => c === 'todo' || p.categoria === c).length;
    render(`${head('Carta digital', 'Los platos ocultos o no disponibles no se muestran a los clientes.', `<button class="btn btn-primary" id="nuevo-plato" data-testid="plato-nuevo">${icon('plus', 18)}Agregar plato</button>`)}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
        <div class="tabs" role="tablist">${['todo', 'pizzas', 'entradas', 'postres', 'bebidas'].map(c => `<button class="tab" role="tab" data-cc="${c}" aria-selected="${st.cartaCat === c}">${c === 'todo' ? 'Todo' : U.CATS[c]} · ${n(c)}</button>`).join('')}</div>
        <div class="input" style="width:280px;max-width:100%">${icon('search', 18)}<input id="c-q" data-testid="plato-buscar" placeholder="Buscar plato…" value="${esc(st.cartaQ)}" aria-label="Buscar plato"></div>
      </div>
      <div class="table-wrap"><div class="table-scroll">
        ${list.length ? `<table class="table" data-testid="platos-list"><thead><tr><th>Plato</th><th>Categoría</th><th>Descripción</th><th>Precio</th><th>Estado</th><th style="text-align:right">Acciones</th></tr></thead><tbody>
        ${list.map(p => `<tr class="${p.disponible ? '' : 'is-muted'}"><td><div class="who"><span class="thumb sq" style="${p.disponible ? '' : 'opacity:.5'}">${U.platoImg(p)}</span><b class="label">${esc(p.nombre)}</b></div></td>
          <td><span class="tag">${U.CATS[p.categoria] || esc(p.categoria)}</span></td><td><span class="ellipsis" title="${esc(p.descripcion)}">${esc(p.descripcion)}</span></td><td><b>${U.cop(p.precio)}</b></td>
          <td>${chip(p.disponible ? 'disponible' : 'nodisponible')}</td>
          <td><div class="actions"><button class="btn btn-soft btn-icon btn-sm" data-pe="${p.id}" aria-label="Editar">${icon('pencil', 16)}</button><button class="btn btn-soft btn-icon btn-sm" data-ph="${p.id}" aria-label="${p.disponible ? 'Ocultar' : 'Mostrar'}" title="${p.disponible ? 'Ocultar de la carta' : 'Mostrar en la carta'}">${icon(p.disponible ? 'eyeoff' : 'eye', 16)}</button><button class="btn btn-danger-outline btn-icon btn-sm" data-pd="${p.id}" aria-label="Eliminar">${icon('trash', 16)}</button></div></td></tr>`).join('')}
        </tbody></table>` : `<div class="empty" data-testid="platos-empty" style="border:0">${icon('utensils', 40, U.C.gray400)}<b class="h4">No hay platos que coincidan</b></div>`}
      </div></div>`);
    $$('[data-cc]').forEach(b => b.onclick = () => { st.cartaCat = b.dataset.cc; carta(); });
    const qi = $('#c-q'); qi.oninput = () => { st.cartaQ = qi.value; const pos = qi.selectionStart; carta(); const n2 = $('#c-q'); n2.focus(); n2.setSelectionRange(pos, pos); };
    $('#nuevo-plato').onclick = () => platoForm();
    const byId = (id) => st.platos.find(p => p.id === Number(id));
    $$('[data-pe]').forEach(b => b.onclick = () => platoForm(byId(b.dataset.pe)));
    $$('[data-ph]').forEach(b => b.onclick = async () => {
      const p = byId(b.dataset.ph);
      try { await DB.savePlato({ id: p.id, disponible: !p.disponible }); p.disponible = !p.disponible; carta(); U.toast(p.disponible ? `${p.nombre} visible en la carta` : `${p.nombre} oculto de la carta`, 'info'); }
      catch (e) { console.error(e); U.toast(errMsg(e, 'No se pudo actualizar el plato'), 'error'); }
    });
    $$('[data-pd]').forEach(b => b.onclick = () => {
      const p = byId(b.dataset.pd);
      confirmar({ title: `¿Eliminar «${p.nombre}»?`, text: 'Se eliminará definitivamente de la carta. Si solo quieres retirarlo por un tiempo, usa «Ocultar».', cta: 'Eliminar plato', danger: true, icon: 'trash', onOk: async () => {
        try { await DB.deletePlato(p.id); st.platos = st.platos.filter(x => x.id !== p.id); closeModal(); carta(); U.toast('Plato eliminado', 'info'); }
        catch (e) { console.error(e); U.toast(errMsg(e, 'No se pudo eliminar'), 'error'); }
      } });
    });
  }
  function platoForm(p) {
    const edit = !!p;
    const d = p ? { ...p } : { nombre: '', categoria: 'pizzas', descripcion: '', precio: '', disponible: true, imagen: 'pizza-pepperoni' };
    const isUrl = /^https?:\/\//.test(d.imagen || '');
    openModal(`<div class="modal-head"><div><b class="h4">${edit ? 'Editar plato' : 'Nuevo plato'}</b><div class="body-sm muted">${edit ? 'Los cambios se verán de inmediato en la carta.' : 'Agrega un plato a la carta digital.'}</div></div><button class="btn btn-soft btn-icon" data-close aria-label="Cerrar">${icon('x', 18)}</button></div>
      <form id="plato-form" data-testid="plato-form" novalidate><div class="modal-body"><div class="plato-form">
        <div style="display:flex;flex-direction:column;gap:10px"><span class="field-label">Imagen</span><div class="preview-img" id="p-prev">${U.platoImg(d)}</div>
          <div class="art-picker" id="p-arts">${Object.keys(U.PLATO_ART).map(k => `<button type="button" data-art="${k}" aria-pressed="${d.imagen === k}" title="${k}">${U.platoImg({ imagen: k, nombre: k })}</button>`).join('')}</div>
          ${fieldHTML('p-url', '', `<input id="p-url" type="url" placeholder="o pega una URL https://…" value="${isUrl ? esc(d.imagen) : ''}">`, { icon: 'image' })}</div>
        <div style="display:flex;flex-direction:column;gap:16px">
          ${fieldHTML('p-nombre', 'Nombre del plato', `<input id="p-nombre" maxlength="60" value="${esc(d.nombre)}" placeholder="Ej. Pizza Konys Especial">`, { req: true })}
          <div class="form-grid">
            <div class="field"><label class="field-label" for="p-cat">Categoría<span class="req">*</span></label><div class="input"><select id="p-cat">${Object.entries(U.CATS).map(([k, v]) => `<option value="${k}" ${d.categoria === k ? 'selected' : ''}>${v}</option>`).join('')}</select>${icon('cd', 16)}</div></div>
            ${fieldHTML('p-precio', 'Precio (COP)', `<span style="font-weight:600;color:var(--gray-500)">$</span><input id="p-precio" inputmode="numeric" value="${d.precio ? Number(d.precio).toLocaleString('es-CO') : ''}" placeholder="34.000">`, { req: true })}
          </div>
          ${fieldHTML('p-desc', 'Descripción', `<textarea id="p-desc" maxlength="140" placeholder="Ingredientes principales">${esc(d.descripcion)}</textarea>`, { help: `<span id="p-count">${(d.descripcion || '').length}</span> / 140 caracteres` })}
          <div class="switch-row"><div><b class="label">Disponible en la carta</b><span class="caption muted">Si lo desactivas, el plato se oculta a los clientes</span></div><button type="button" class="toggle" role="switch" id="p-disp" aria-checked="${d.disponible}" aria-label="Disponible"></button></div>
        </div></div></div>
      <div class="modal-foot"><button type="button" class="btn btn-soft" data-close>Cancelar</button><button type="submit" class="btn btn-primary" data-testid="plato-guardar">${icon('save', 18)}${edit ? 'Guardar cambios' : 'Agregar plato'}</button></div></form>`, 760);
    const box = $('#admin-modal-box');
    const prev = () => { $('#p-prev').innerHTML = U.platoImg({ ...d, nombre: d.nombre || 'Plato' }); };
    $$('[data-art]', box).forEach(b => b.onclick = () => { d.imagen = b.dataset.art; $('#p-url').value = ''; $$('[data-art]', box).forEach(x => x.setAttribute('aria-pressed', x === b)); prev(); });
    $('#p-url').oninput = () => { const v = $('#p-url').value.trim(); setErr('p-url'); if (/^https?:\/\/\S+$/.test(v)) { d.imagen = v; $$('[data-art]', box).forEach(x => x.setAttribute('aria-pressed', false)); prev(); } };
    $('#p-cat').onchange = () => { d.categoria = $('#p-cat').value; };
    $('#p-desc').oninput = () => { $('#p-count').textContent = $('#p-desc').value.length; };
    $('#p-nombre').oninput = () => setErr('p-nombre');
    $('#p-precio').oninput = (e) => { const digits = e.target.value.replace(/\D/g, '').slice(0, 7); e.target.value = digits ? Number(digits).toLocaleString('es-CO') : ''; setErr('p-precio'); };
    $('#p-disp').onclick = () => { d.disponible = !d.disponible; $('#p-disp').setAttribute('aria-checked', d.disponible); };
    $('#plato-form').onsubmit = async (e) => {
      e.preventDefault();
      const nombre = $('#p-nombre').value.trim(), precio = Number($('#p-precio').value.replace(/\D/g, '')), url = $('#p-url').value.trim();
      const data = { nombre, categoria: $('#p-cat').value, descripcion: $('#p-desc').value.trim(), precio, disponible: d.disponible, imagen: url || d.imagen || null };
      const errores = KVal.erroresPlato(data, edit ? p.id : null);
      setErr('p-nombre', errores.nombre);
      setErr('p-precio', errores.precio);
      setErr('p-desc', errores.descripcion);
      setErr('p-url', errores.imagen && url ? errores.imagen : '');
      if (errores.imagen && !url) U.toast(errores.imagen, 'error');
      if (errores.categoria) U.toast(errores.categoria, 'error');
      if (KVal.primerError(errores)) return;
      try { await DB.savePlato(edit ? { id: p.id, ...data } : data); st.platos = await DB.listPlatos(); closeModal(); carta(); U.toast(edit ? 'Plato actualizado' : 'Plato agregado a la carta'); }
      catch (err) { console.error(err); U.toast(errMsg(err, 'No se pudo guardar el plato'), 'error'); }
    };
  }

  /* ---------------------------------------------------------------- */
  /* Utilidades de formularios y modales                                 */
  /* ---------------------------------------------------------------- */
  function fieldHTML(id, label, inner, o = {}) {
    return `<div class="field" id="fw-${id}">${label ? `<label class="field-label" for="${id}">${label}${o.req ? '<span class="req">*</span>' : ''}${o.opt ? `<span class="opt">${o.opt}</span>` : ''}</label>` : ''}
      <div class="input">${o.icon ? icon(o.icon, 18) : ''}${inner}</div><div class="helper" ${o.help ? '' : 'hidden'} data-help="${esc(o.help || '')}">${o.help || ''}</div></div>`;
  }
  /** Marca o limpia el error de un campo. Devuelve false si se marcó error. */
  function setErr(id, msg) {
    const w = $('#fw-' + id); if (!w) return !msg;
    const h = $('.helper', w);
    const input = $('input, textarea, select', w);
    $('.input', w).classList.toggle('is-error', !!msg);
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) { h.hidden = false; h.className = 'helper is-error'; h.setAttribute('role', 'alert'); h.innerHTML = `${icon('alertc', 14)}${esc(msg)}`; }
    else { h.className = 'helper'; h.removeAttribute('role'); h.innerHTML = h.dataset.help || ''; h.hidden = !h.dataset.help; if (id === 'p-desc') h.innerHTML = `<span id="p-count">${$('#p-desc').value.length}</span> / 140 caracteres`; }
    return !msg;
  }
  function openModal(html, width = 560) {
    const box = $('#admin-modal-box');
    box.className = 'modal'; box.style.maxWidth = width + 'px'; box.innerHTML = html;
    $$('[data-close]', box).forEach(b => b.onclick = closeModal);
    vincularAyudas(box);
    U.openModal($('#admin-modal'));
  }
  function vincularAyudas(root) {
    root.querySelectorAll('.field').forEach(w => {
      const help = $('.helper', w);
      const input = $('input, textarea, select', w);
      if (!help || !input) return;
      if (!help.id && input.id) help.id = `help-${input.id}`;
      if (help.id) input.setAttribute('aria-describedby', help.id);
      if (!input.hasAttribute('aria-invalid')) input.setAttribute('aria-invalid', 'false');
    });
  }
  function closeModal() { const m = $('#admin-modal'); if (!m.hidden) U.closeModal(m); }
  function confirmar({ title, text, cta, danger, icon: ic, onOk }) {
    const box = $('#admin-modal-box');
    box.className = 'modal modal-sm'; box.style.maxWidth = '440px';
    box.innerHTML = `<span class="modal-icon" style="${danger ? '' : 'background:var(--wine-100);color:var(--wine)'}">${icon(danger ? 'alert' : ic, 24)}</span>
      <div style="display:flex;flex-direction:column;gap:8px"><b class="h4">${esc(title)}</b><p class="body-sm muted">${esc(text)}</p></div>
      <div class="actions"><button class="btn btn-soft" data-close data-testid="confirm-cancelar">Cancelar</button><button class="btn ${danger ? 'btn-danger' : 'btn-dark'}" data-ok data-testid="confirm-aceptar">${icon(ic, 18)}${esc(cta)}</button></div>`;
    $('[data-close]', box).onclick = closeModal;
    $('[data-ok]', box).onclick = onOk;
    U.openModal($('#admin-modal'));
  }
})();

/* ==========================================================================
   Konys Pizza · supabase.js
   Capa de datos única para cliente y administrador.

   - Si js/config.js tiene SUPABASE_URL y SUPABASE_ANON_KEY → usa Supabase
     (tablas: mesas, horarios, reservas, platos · ver supabase/schema.sql).
   - Si no están configuradas → MODO DEMO: los mismos datos se guardan en el
     navegador (localStorage) para poder probar toda la aplicación sin backend.

   Todas las funciones son async y devuelven datos con los nombres de campo
   del modelo de datos del documento (sección 10).
   ========================================================================== */
(function () {
  'use strict';
  const CFG = window.KONYS_CONFIG || {};
  const sdkListo = !!(window.supabase && window.supabase.createClient);
  if (CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !sdkListo) {
    console.warn('Konys: config.js tiene URL y clave, pero el SDK de Supabase no cargó. Se usa modo demo.');
  }
  const hasSupabase = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && sdkListo);
  const sb = hasSupabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
  const { isoDate, toMin, fromMin, hhmm, parseDate, DIAS } = window.KUI;

  /** Error con código para que la interfaz muestre el estado correcto. */
  class ReservaError extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra; } }

  /* ------------------------------------------------------------------ */
  /* MODO DEMO (localStorage)                                            */
  /* ------------------------------------------------------------------ */
  const KEY = 'konys-demo-v1';
  function seed() {
    const now = new Date().toISOString();
    const mesas = [
      { id: 1, nombre: 'Mesa 1', zona: 'terraza', capacidad: 2, activa: true, foto_url: null, creado_en: now },
      { id: 2, nombre: 'Mesa 2', zona: 'terraza', capacidad: 4, activa: true, foto_url: null, creado_en: now },
      { id: 3, nombre: 'Mesa 3', zona: 'salon', capacidad: 6, activa: true, foto_url: null, creado_en: now },
      { id: 4, nombre: 'Mesa 4', zona: 'salon', capacidad: 4, activa: true, foto_url: null, creado_en: now },
      { id: 5, nombre: 'Mesa 5', zona: 'salon', capacidad: 8, activa: false, foto_url: null, creado_en: now },
    ];
    let hid = 1; const horarios = [];
    ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].forEach(d => {
      horarios.push({ id: hid++, dia_semana: d, jornada: 'almuerzo', hora_inicio: '12:30', hora_fin: '14:30', duracion_slot: 60, activo: d !== 'lunes' });
      horarios.push({ id: hid++, dia_semana: d, jornada: 'noche', hora_inicio: '17:00', hora_fin: '23:00', duracion_slot: 60, activo: d !== 'lunes' });
    });
    const platos = [
      { id: 1, nombre: 'Pizza Konys Especial', categoria: 'pizzas', descripcion: 'Pepperoni, champiñones, pimentón verde y doble mozzarella.', precio: 34000, disponible: true, imagen: 'pizza-especial' },
      { id: 2, nombre: 'Pizza Margarita', categoria: 'pizzas', descripcion: 'Salsa de tomate, mozzarella fresca y albahaca.', precio: 28000, disponible: true, imagen: 'pizza-margarita' },
      { id: 3, nombre: 'Cono Pepperoni', categoria: 'pizzas', descripcion: 'Nuestro cono icónico relleno de pepperoni y queso fundido.', precio: 15000, disponible: true, imagen: 'cono-pepperoni' },
      { id: 4, nombre: 'Cono Hawaiano', categoria: 'pizzas', descripcion: 'Jamón, piña caramelizada y mozzarella en masa crocante.', precio: 15000, disponible: true, imagen: 'cono-hawaiana' },
      { id: 5, nombre: 'Palitos de ajo', categoria: 'entradas', descripcion: 'Pan horneado con mantequilla de ajo, perejil y salsa napolitana.', precio: 12000, disponible: true, imagen: 'palitos' },
      { id: 6, nombre: 'Brownie con helado', categoria: 'postres', descripcion: 'Brownie tibio de chocolate con helado de vainilla.', precio: 11000, disponible: true, imagen: 'brownie' },
      { id: 7, nombre: 'Limonada de coco', categoria: 'bebidas', descripcion: 'Limonada natural cremosa con leche de coco. 400 ml.', precio: 9000, disponible: true, imagen: 'limonada' },
      { id: 8, nombre: 'Gaseosa 400 ml', categoria: 'bebidas', descripcion: 'Bebida gaseosa fría, con hielo y limón.', precio: 5000, disponible: true, imagen: 'gaseosa' },
    ];
    // Reservas de ejemplo alrededor de la fecha actual (datos ficticios).
    const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return isoDate(x); };
    const r = (id, mesa, nombre, tel, p, off, h, estado) => ({ id, mesa_id: mesa, cliente_nombre: nombre, cliente_contacto: tel, num_personas: p, fecha: d(off), hora_inicio: h, hora_fin: fromMin(toMin(h) + 60), estado, creado_en: now });
    const reservas = [
      r(1, 3, 'Juan Pérez', '3001234567', 4, 0, '12:30', 'completada'), r(2, 1, 'María Gómez', null, 2, 0, '13:00', 'completada'),
      r(3, 2, 'Andrés Rojas', '3005550012', 3, 0, '17:00', 'confirmada'), r(4, 4, 'Sofía Ruiz', '3005550013', 4, 0, '18:00', 'confirmada'),
      r(5, 3, 'Camilo Pardo', '3005550014', 6, 0, '19:00', 'confirmada'), r(6, 4, 'Laura Díaz', '3005550015', 2, 0, '20:00', 'cancelada'),
      r(7, 1, 'Valentina Mora', null, 2, 0, '20:00', 'confirmada'), r(8, 2, 'Diego Herrera', '3005550017', 4, 0, '21:00', 'confirmada'),
      r(9, 3, 'Natalia Ríos', '3005550018', 5, 1, '13:00', 'confirmada'), r(10, 1, 'Felipe Castro', '3005550019', 2, 1, '19:00', 'confirmada'),
      r(11, 2, 'Paula Vargas', '3005550020', 4, 2, '18:30', 'confirmada'), r(12, 4, 'Sebastián León', null, 3, -1, '19:30', 'completada'),
    ];
    return { mesas, horarios, platos, reservas, seq: { mesas: 6, platos: 9, reservas: 13 } };
  }
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.mesas) return s; } catch (e) { /* sin acceso */ } const s = seed(); save(s); return s; };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* modo privado */ } };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const delay = (v) => new Promise(res => setTimeout(() => res(clone(v)), 120)); // simula red

  const demo = {
    async listMesas({ soloActivas } = {}) { const s = load(); return delay(s.mesas.filter(m => !soloActivas || m.activa).sort((a, b) => a.id - b.id)); },
    async saveMesa(m) {
      const s = load();
      if (m.id) { const i = s.mesas.findIndex(x => x.id === m.id); s.mesas[i] = { ...s.mesas[i], ...m }; }
      else s.mesas.push({ ...m, id: s.seq.mesas++, creado_en: new Date().toISOString() });
      save(s); return delay(m);
    },
    async deleteMesa(id) { const s = load(); s.mesas = s.mesas.filter(m => m.id !== id); save(s); return delay(true); },
    async listHorarios() { return delay(load().horarios); },
    async saveHorarios(rows) { const s = load(); rows.forEach(r => { const i = s.horarios.findIndex(h => h.id === r.id); if (i >= 0) s.horarios[i] = { ...s.horarios[i], ...r }; }); save(s); return delay(true); },
    async listPlatos({ soloDisponibles } = {}) { return delay(load().platos.filter(p => !soloDisponibles || p.disponible).sort((a, b) => a.id - b.id)); },
    async savePlato(p) {
      const s = load();
      if (p.id) { const i = s.platos.findIndex(x => x.id === p.id); s.platos[i] = { ...s.platos[i], ...p }; }
      else s.platos.push({ ...p, id: s.seq.platos++ });
      save(s); return delay(p);
    },
    async deletePlato(id) { const s = load(); s.platos = s.platos.filter(p => p.id !== id); save(s); return delay(true); },
    async listReservas({ fecha, mesa_id, desde } = {}) {
      return delay(load().reservas.filter(r => (!fecha || r.fecha === fecha) && (!mesa_id || r.mesa_id === Number(mesa_id)) && (!desde || r.fecha >= desde))
        .sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio)));
    },
    async insertReserva(r) { const s = load(); const nueva = { ...r, id: s.seq.reservas++, creado_en: new Date().toISOString() }; s.reservas.push(nueva); save(s); return delay(nueva); },
    async setEstadoReserva(id, estado) { const s = load(); const r = s.reservas.find(x => x.id === id); if (r) r.estado = estado; save(s); return delay(r); },
    async reset() { const s = seed(); save(s); return true; },
  };

  /* ------------------------------------------------------------------ */
  /* SUPABASE                                                            */
  /* Reglas de acceso (supabase/schema.sql):                             */
  /*  - Visitantes: leen mesas activas, horarios y platos disponibles;    */
  /*    reservan con la función crear_reserva() y consultan la ocupación */
  /*    con ocupacion_reservas() (sin nombres ni teléfonos).             */
  /*  - Lectura de reservas y escrituras del panel: solo administradores */
  /*    autenticados con Supabase Auth (tabla public.administradores).   */
  /* ------------------------------------------------------------------ */
  const SIN_PERMISO = 'Supabase rechazó la operación: el panel no tiene una sesión de administrador (ver supabase/schema.sql, sección 7).';
  // Códigos de PostgreSQL / PostgREST que indican falta de permisos (RLS o GRANT).
  const esPermiso = (e) => e && (e.code === '42501' || e.code === 'PGRST301' || e.code === 'PGRST116' || /row-level security|permission denied/i.test(e.message || ''));
  const ok = ({ data, error }) => { if (error) throw (esPermiso(error) ? new ReservaError('SIN_PERMISO', SIN_PERMISO) : error); return data; };
  // Con RLS, un UPDATE/DELETE sin permiso no da error: afecta 0 filas. Se detecta aquí.
  const okFilas = (res) => { const data = ok(res); if (Array.isArray(data) && data.length === 0) throw new ReservaError('SIN_PERMISO', SIN_PERMISO); return Array.isArray(data) ? data[0] : data; };
  // Errores de crear_reserva(): el HINT trae el código que entiende cliente.js.
  const HINTS = ['HORA_OCUPADA', 'CAPACIDAD', 'MESA_INACTIVA', 'HORARIO_INVALIDO', 'DATOS_INVALIDOS'];
  const live = {
    async listMesas({ soloActivas } = {}) { let q = sb.from('mesas').select('*').order('id'); if (soloActivas) q = q.eq('activa', true); return ok(await q); },
    async saveMesa(m) { const { id, ...rest } = m; return okFilas(id ? await sb.from('mesas').update(rest).eq('id', id).select() : await sb.from('mesas').insert(rest).select()); },
    async deleteMesa(id) { return okFilas(await sb.from('mesas').delete().eq('id', id).select('id')); },
    async listHorarios() { return ok(await sb.from('horarios').select('*').order('id')); },
    async saveHorarios(rows) { return ok(await sb.from('horarios').upsert(rows).select('id')); },
    async listPlatos({ soloDisponibles } = {}) { let q = sb.from('platos').select('*').order('id'); if (soloDisponibles) q = q.eq('disponible', true); return ok(await q); },
    async savePlato(p) { const { id, ...rest } = p; return okFilas(id ? await sb.from('platos').update(rest).eq('id', id).select() : await sb.from('platos').insert(rest).select()); },
    async deletePlato(id) { return okFilas(await sb.from('platos').delete().eq('id', id).select('id')); },
    /** Reservas completas (con datos personales): solo las devuelve a un administrador. */
    async listReservas({ fecha, mesa_id, desde } = {}) {
      let q = sb.from('reservas').select('*').order('fecha').order('hora_inicio');
      if (fecha) q = q.eq('fecha', fecha); if (mesa_id) q = q.eq('mesa_id', mesa_id); if (desde) q = q.gte('fecha', desde);
      return ok(await q);
    },
    /** Ocupación pública de una fecha (mesa_id, fecha, hora_inicio, hora_fin, estado), sin datos personales. */
    async listOcupacion({ fecha, mesa_id } = {}) { return ok(await sb.rpc('ocupacion_reservas', { p_fecha: fecha, p_mesa_id: mesa_id ?? null })); },
    async setEstadoReserva(id, estado) { return okFilas(await sb.from('reservas').update({ estado }).eq('id', id).select()); },
    /** ¿La sesión actual es de un administrador registrado en public.administradores? */
    async esAdmin() { const { data, error } = await sb.rpc('es_admin'); return !error && data === true; },
    async reset() { return false; },
  };
  demo.listOcupacion = async ({ fecha, mesa_id } = {}) => (await demo.listReservas({ fecha, mesa_id }))
    .filter(r => r.estado !== 'cancelada').map(({ mesa_id: m, fecha: f, hora_inicio, hora_fin, estado }) => ({ mesa_id: m, fecha: f, hora_inicio, hora_fin, estado }));
  demo.esAdmin = async () => true;

  const api = hasSupabase ? live : demo;

  /**
   * Crea una reserva aplicando las reglas del documento:
   * RF-05 (capacidad), RF-13 (mesa activa) y paso 10 del flujo (verificar que
   * el slot siga libre justo antes de guardar para evitar la doble reserva).
   * - Supabase: todo se valida en el servidor con crear_reserva(); la base de
   *   datos además impide reservas superpuestas aunque lleguen al mismo tiempo.
   * - Demo: las mismas reglas se validan aquí con los datos del navegador.
   */
  async function crearReserva({ mesa_id, fecha, hora_inicio, cliente_nombre, cliente_contacto, num_personas }) {
    if (hasSupabase) {
      const { data, error } = await sb.rpc('crear_reserva', {
        p_mesa_id: Number(mesa_id), p_fecha: fecha, p_hora_inicio: hhmm(hora_inicio),
        p_cliente_nombre: String(cliente_nombre).trim(), p_cliente_contacto: cliente_contacto ? String(cliente_contacto).replace(/\D/g, '') : null,
        p_num_personas: Number(num_personas),
      });
      if (error) {
        if (HINTS.includes(error.hint)) throw new ReservaError(error.hint, error.message);
        throw error;
      }
      return data;
    }
    const mesas = await api.listMesas();
    const mesa = mesas.find(m => m.id === Number(mesa_id));
    if (!mesa || !mesa.activa) throw new ReservaError('MESA_INACTIVA', 'La mesa no está disponible para reservas.');
    if (Number(num_personas) > mesa.capacidad) throw new ReservaError('CAPACIDAD', `La ${mesa.nombre} admite máximo ${mesa.capacidad} personas.`, { max: mesa.capacidad });
    const horarios = await api.listHorarios();
    const dia = DIAS[parseDate(fecha).getDay()];
    const jornada = horarios.find(h => h.dia_semana === dia && h.activo && toMin(hora_inicio) >= toMin(h.hora_inicio) && toMin(hora_inicio) < toMin(h.hora_fin));
    if (!jornada) throw new ReservaError('HORARIO_INVALIDO', 'El restaurante no atiende en esa fecha u hora.');
    const dur = Number(jornada.duracion_slot);
    const ini = toMin(hora_inicio), fin = ini + dur;
    if (fin > toMin(jornada.hora_fin)) throw new ReservaError('HORARIO_INVALIDO', 'Ese horario no está disponible para reservas.');
    const existentes = await api.listReservas({ fecha, mesa_id: mesa.id });
    if (existentes.some(r => r.estado !== 'cancelada' && ini < toMin(r.hora_fin) && toMin(r.hora_inicio) < fin)) {
      throw new ReservaError('HORA_OCUPADA', 'Este horario ya no está disponible.');
    }
    return demo.insertReserva({
      mesa_id: mesa.id, fecha, hora_inicio: hhmm(hora_inicio), hora_fin: fromMin(fin),
      cliente_nombre: String(cliente_nombre).trim(), cliente_contacto: cliente_contacto ? String(cliente_contacto).replace(/\D/g, '') : null,
      num_personas: Number(num_personas), estado: 'confirmada',
    });
  }

  window.DB = { mode: hasSupabase ? 'supabase' : 'demo', ReservaError, crearReserva, ...api };
})();

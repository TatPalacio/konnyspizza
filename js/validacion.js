/* ==========================================================================
   Konys Pizza · validacion.js
   Reglas compartidas por la interfaz y por la capa de datos (js/supabase.js).
   Así el formulario y el guardado no pueden divergir: la vista no es la
   única barrera. Los textos coinciden con los que ya muestra la interfaz.
   ========================================================================== */
(function () {
  'use strict';
  const U = () => window.KUI;
  const NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;
  const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const ZONAS = ['terraza', 'salon'];
  const ESTADOS_RESERVA = ['confirmada', 'cancelada', 'completada'];

  const capDia = (dia) => dia[0].toUpperCase() + dia.slice(1);
  const limpiarNombre = (v) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();
  const contactoLimpio = (v) => {
    const d = String(v ?? '').replace(/\D/g, '');
    return d ? d : null;
  };
  const primerError = (mapa) => Object.values(mapa || {}).find(Boolean) || '';
  const tiene = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

  /**
   * Errores de campo del formulario de reserva.
   * `capacidad` es opcional: sin ella no se compara contra una mesa concreta.
   */
  function erroresReserva(r) {
    const e = {};
    const nombre = limpiarNombre(r.nombre);
    if (!nombre) e.nombre = 'Ingresa tu nombre completo';
    else if (nombre.length < 3) e.nombre = 'El nombre debe tener al menos 3 letras';
    else if (nombre.length > 80) e.nombre = 'El nombre admite máximo 80 caracteres';
    else if (!NOMBRE.test(nombre)) e.nombre = 'Usa solo letras y espacios';

    const tel = contactoLimpio(r.tel);
    if (tel && !/^\d{10}$/.test(tel)) e.tel = 'Ingresa un número válido de 10 dígitos';

    const n = Number(r.personas);
    if (!Number.isInteger(n) || n < 1) e.personas = 'Indica cuántas personas asistirán';
    else if (r.capacidad && n > Number(r.capacidad)) e.personas = `La ${r.mesaNombre || 'mesa'} admite máximo ${r.capacidad} personas`;
    else if (!r.capacidad && n > 12) e.personas = 'Ninguna mesa admite más de 12 personas';

    if (!r.hora) e.hora = 'Selecciona un horario para continuar';
    return e;
  }

  /**
   * Misma decisión que crear_reserva() en supabase/schema.sql, para el modo demo.
   * Devuelve { ok:false, code, message, extra } o { ok:true, ...datos listos para guardar }.
   */
  function evaluarReserva(ctx) {
    const ui = U();
    const mesa = ctx.mesa || null;
    const campos = erroresReserva({
      nombre: ctx.cliente_nombre,
      tel: ctx.cliente_contacto,
      personas: ctx.num_personas,
      capacidad: mesa ? mesa.capacidad : undefined,
      mesaNombre: mesa ? mesa.nombre : '',
      hora: ctx.hora_inicio,
    });
    const fail = (code, message, extra) => ({ ok: false, code, message, extra });
    if (campos.nombre || campos.tel) return fail('DATOS_INVALIDOS', campos.nombre || campos.tel);
    const personas = Number(ctx.num_personas);
    if (!Number.isInteger(personas) || personas < 1) return fail('DATOS_INVALIDOS', campos.personas || 'Indica cuántas personas asistirán');
    if (!ctx.fecha || !ctx.hora_inicio) return fail('HORARIO_INVALIDO', 'Selecciona fecha y horario.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ctx.fecha))) return fail('HORARIO_INVALIDO', 'Selecciona fecha y horario.');
    if (!mesa || !mesa.activa) return fail('MESA_INACTIVA', 'La mesa no está disponible para reservas.');
    if (personas > mesa.capacidad) return fail('CAPACIDAD', `La ${mesa.nombre} admite máximo ${mesa.capacidad} personas.`, { max: mesa.capacidad });

    const horaTxt = ui.hhmm(ctx.hora_inicio);
    if (!HORA.test(horaTxt)) return fail('HORARIO_INVALIDO', 'Ese horario no está disponible para reservas.');
    const dia = ui.DIAS[ui.parseDate(ctx.fecha).getDay()];
    const ini = ui.toMin(horaTxt);
    const jornada = (ctx.horarios || []).find((h) => h.dia_semana === dia && h.activo && ini >= ui.toMin(h.hora_inicio) && ini < ui.toMin(h.hora_fin));
    if (!jornada) return fail('HORARIO_INVALIDO', 'El restaurante no atiende en esa fecha u hora.');
    const dur = Number(jornada.duracion_slot) || 60;
    const fin = ini + dur;
    const base = ui.toMin(jornada.hora_inicio);
    if ((ini - base) % 30 !== 0 || fin > ui.toMin(jornada.hora_fin)) return fail('HORARIO_INVALIDO', 'Ese horario no está disponible para reservas.');
    const hoy = ui.isoDate(new Date());
    if (ctx.fecha < hoy || (ctx.fecha === hoy && ini <= ui.nowMin())) return fail('HORARIO_INVALIDO', 'Ese horario ya pasó. Elige otro.');

    const ocupada = (ctx.reservas || []).some((r) => {
      if (r.estado === 'cancelada') return false;
      if (r.mesa_id != null && Number(r.mesa_id) !== Number(mesa.id)) return false;
      if (r.fecha && r.fecha !== ctx.fecha) return false;
      return ini < ui.toMin(r.hora_fin) && ui.toMin(r.hora_inicio) < fin;
    });
    if (ocupada) return fail('HORA_OCUPADA', 'Este horario ya no está disponible.');

    return {
      ok: true,
      mesa,
      nombre: limpiarNombre(ctx.cliente_nombre),
      contacto: contactoLimpio(ctx.cliente_contacto),
      personas,
      hora_inicio: horaTxt,
      hora_fin: ui.fromMin(fin),
    };
  }

  function erroresMesa(m, mesas, editId) {
    const e = {};
    const nuevo = editId == null;
    if (nuevo || tiene(m, 'nombre')) {
      const nombre = limpiarNombre(m.nombre);
      if (!nombre) e.nombre = 'El nombre es obligatorio';
      else if (nombre.length > 30) e.nombre = 'El nombre admite máximo 30 caracteres';
      else if ((mesas || []).some((x) => x.nombre.toLowerCase() === nombre.toLowerCase() && String(x.id) !== String(editId))) e.nombre = 'Ya existe una mesa con ese nombre';
    }
    if (nuevo || tiene(m, 'zona')) {
      if (!ZONAS.includes(m.zona)) e.zona = 'Elige terraza o salón';
    }
    if (nuevo || tiene(m, 'capacidad')) {
      const cap = Number(m.capacidad);
      if (!Number.isInteger(cap) || cap < 1 || cap > 12) e.capacidad = 'Debe ser un número entre 1 y 12';
    }
    if (tiene(m, 'foto_url') && m.foto_url && !U().urlSegura(m.foto_url)) e.foto = 'Ingresa una URL válida (https://…)';
    return e;
  }

  function erroresPlato(p, editId) {
    const e = {};
    const nuevo = editId == null;
    const cats = U().CATS;
    if (nuevo || tiene(p, 'nombre')) {
      const nombre = limpiarNombre(p.nombre);
      if (!nombre) e.nombre = 'El nombre es obligatorio';
      else if (nombre.length > 60) e.nombre = 'El nombre admite máximo 60 caracteres';
    }
    if (nuevo || tiene(p, 'categoria')) {
      if (!cats[p.categoria]) e.categoria = 'Categoría no válida';
    }
    if (tiene(p, 'descripcion') && String(p.descripcion || '').length > 140) e.descripcion = 'La descripción admite máximo 140 caracteres';
    if (nuevo || tiene(p, 'precio')) {
      const precio = Number(p.precio);
      if (!Number.isInteger(precio) || precio < 100 || precio > 9999999) e.precio = 'Ingresa un precio válido en pesos';
    }
    if (tiene(p, 'imagen') && p.imagen) {
      const img = String(p.imagen).trim();
      if (/^https?:/i.test(img)) {
        if (!U().urlSegura(img)) e.imagen = 'URL no válida';
      } else if (!U().PLATO_ART[img]) e.imagen = 'Imagen no válida';
    }
    return e;
  }

  function erroresHorarios(rows) {
    const ui = U();
    const errs = [];
    DIAS.forEach((dia) => {
      const js = (rows || []).filter((h) => h.dia_semana === dia && h.activo).sort((a, b) => ui.toMin(a.hora_inicio) - ui.toMin(b.hora_inicio));
      const malHora = js.filter((h) => !HORA.test(ui.hhmm(h.hora_inicio)) || !HORA.test(ui.hhmm(h.hora_fin)));
      if (malHora.length) { errs.push(`${capDia(dia)}: usa el formato de 24 horas HH:MM (ej. 17:00).`); return; }
      js.forEach((h) => {
        if (!h.hora_inicio || !h.hora_fin || ui.toMin(h.hora_inicio) >= ui.toMin(h.hora_fin)) errs.push(`${capDia(dia)} · ${h.jornada}: la hora de inicio debe ser anterior al cierre.`);
        const dur = Number(h.duracion_slot);
        if (!Number.isInteger(dur) || dur < 15 || dur > 240) errs.push(`${capDia(dia)} · ${h.jornada}: la duración debe estar entre 15 y 240 minutos.`);
      });
      for (let i = 1; i < js.length; i++) {
        if (ui.toMin(js[i].hora_inicio) < ui.toMin(js[i - 1].hora_fin)) errs.push(`${capDia(dia)}: las jornadas se cruzan.`);
      }
    });
    return errs;
  }

  function recortarMesa(m) {
    const o = {};
    if (tiene(m, 'nombre')) o.nombre = limpiarNombre(m.nombre);
    if (tiene(m, 'zona')) o.zona = m.zona;
    if (tiene(m, 'capacidad')) o.capacidad = Number(m.capacidad);
    if (tiene(m, 'activa')) o.activa = !!m.activa;
    if (tiene(m, 'foto_url')) o.foto_url = m.foto_url ? String(m.foto_url).trim() : null;
    return o;
  }

  function recortarPlato(p) {
    const o = {};
    if (tiene(p, 'nombre')) o.nombre = limpiarNombre(p.nombre);
    if (tiene(p, 'categoria')) o.categoria = p.categoria;
    if (tiene(p, 'descripcion')) o.descripcion = String(p.descripcion || '').trim();
    if (tiene(p, 'precio')) o.precio = Number(p.precio);
    if (tiene(p, 'disponible')) o.disponible = !!p.disponible;
    if (tiene(p, 'imagen')) o.imagen = p.imagen ? String(p.imagen).trim() : null;
    return o;
  }

  window.KVal = {
    SESION_ADMIN: 'konys-admin-session',
    ESTADOS_RESERVA,
    erroresReserva,
    evaluarReserva,
    erroresMesa,
    erroresPlato,
    erroresHorarios,
    contactoLimpio,
    recortarMesa,
    recortarPlato,
    primerError,
  };
})();

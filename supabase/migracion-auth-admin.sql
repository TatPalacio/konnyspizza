-- ==========================================================================
-- Konys Pizza · Migración incremental de autenticación del panel
-- Pégala en Supabase → SQL Editor si YA ejecutaste schema.sql antes de la
-- política administradores_propia. No hace DROP TABLE y no borra reservas.
--
-- Si el proyecto es nuevo, no hace falta: schema.sql ya incluye esto.
-- Si este script se detiene porque una función todavía usa usuario_id,
-- vuelve a ejecutar schema.sql completo (reemplaza crear_reserva).
-- ==========================================================================

begin;

-- El navegador solo lee la fila propia. Altas y bajas quedan en el SQL Editor.
revoke insert, update, delete, truncate on public.administradores from authenticated;
grant select on public.administradores to authenticated;

drop policy if exists administradores_propia on public.administradores;
create policy administradores_propia on public.administradores
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Quita usuario_id solo si un intento de cuentas de cliente lo dejó en reservas.
do $$
declare
  r record;
  v_fun text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reservas' and column_name = 'usuario_id'
  ) then
    return;
  end if;

  select string_agg(p.proname, ', ' order by p.proname) into v_fun
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and pg_get_functiondef(p.oid) ilike '%usuario_id%';

  if v_fun is not null then
    raise exception
      'No se quitó usuario_id: estas funciones todavía lo usan (%). Ejecuta supabase/schema.sql completo. No se borraron reservas.',
      v_fun;
  end if;

  for r in
    select pol.polname as name
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reservas'
      and (
        coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') ilike '%usuario_id%'
        or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ilike '%usuario_id%'
      )
  loop
    execute format('drop policy %I on public.reservas', r.name);
  end loop;

  alter table public.reservas drop column usuario_id;
end $$;

commit;

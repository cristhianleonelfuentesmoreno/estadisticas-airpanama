-- Endurecimiento de seguridad (auditoría 2026-09-23)

-- 1. Helpers en un schema NO expuesto por la API REST (no se pueden llamar por /rpc)
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and role = 'administrador' and status = 'aprobado'
  );
$$;

create or replace function private.is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and status = 'aprobado'
  );
$$;

revoke all on function private.is_admin(), private.is_approved() from public, anon;
grant execute on function private.is_admin(), private.is_approved() to authenticated;

-- 2. perfiles: usar los nuevos helpers y eliminar public.is_admin() expuesta por RPC
drop policy "Permitir a los administradores leer todos los perfiles" on public.perfiles;
create policy "Permitir a los administradores leer todos los perfiles"
  on public.perfiles for select to authenticated using (private.is_admin());

drop policy "Permitir a administradores actualizar perfiles" on public.perfiles;
create policy "Permitir a administradores actualizar perfiles"
  on public.perfiles for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

drop function public.is_admin();

-- 3. Funciones SECURITY DEFINER de triggers: nadie debe poder llamarlas por /rpc
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 4. manual_flights_log: estaba abierta a cualquiera (incluso sin login)
drop policy "Enable read/write access for all users" on public.manual_flights_log;
create policy "Usuarios aprobados gestionan vuelos manuales"
  on public.manual_flights_log for all to authenticated
  using (private.is_approved()) with check (private.is_approved());

-- 5. Históricos Malek: solo usuarios APROBADOS (antes bastaba con tener cuenta)
drop policy "Usuarios autenticados pueden registrar llegadas" on public.llegadas_malek_historico;
drop policy "Usuarios autenticados pueden ver llegadas" on public.llegadas_malek_historico;
drop policy "Usuarios autenticados pueden editar llegadas" on public.llegadas_malek_historico;
create policy "Usuarios aprobados pueden ver llegadas"
  on public.llegadas_malek_historico for select to authenticated using (private.is_approved());
create policy "Usuarios aprobados pueden registrar llegadas"
  on public.llegadas_malek_historico for insert to authenticated with check (private.is_approved());
create policy "Usuarios aprobados pueden editar llegadas"
  on public.llegadas_malek_historico for update to authenticated
  using (private.is_approved()) with check (private.is_approved());

drop policy "Usuarios autenticados pueden registrar salidas" on public.salidas_malek_historico;
drop policy "Usuarios autenticados pueden ver salidas" on public.salidas_malek_historico;
drop policy "Usuarios autenticados pueden editar salidas" on public.salidas_malek_historico;
create policy "Usuarios aprobados pueden ver salidas"
  on public.salidas_malek_historico for select to authenticated using (private.is_approved());
create policy "Usuarios aprobados pueden registrar salidas"
  on public.salidas_malek_historico for insert to authenticated with check (private.is_approved());
create policy "Usuarios aprobados pueden editar salidas"
  on public.salidas_malek_historico for update to authenticated
  using (private.is_approved()) with check (private.is_approved());

-- 6. Auditoría: solo el servidor (service role) escribe; solo admins leen
drop policy "Insercion general desde el servidor" on public.registros_auditoria;
drop policy "Admins pueden ver auditoria" on public.registros_auditoria;
create policy "Admins pueden ver auditoria"
  on public.registros_auditoria for select to authenticated using (private.is_admin());

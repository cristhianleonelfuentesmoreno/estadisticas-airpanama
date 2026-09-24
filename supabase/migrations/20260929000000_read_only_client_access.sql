-- Seguridad: los usuarios solo LEEN directamente; toda escritura pasa por el servidor,
-- que verifica el rol y registra en la bitácora.
-- Antes, un usuario aprobado podía (con su sesión y las herramientas del navegador)
-- ocultar o crear vuelos, cambiar pasajeros, editar el itinerario y falsear la
-- ubicación de sus sesiones, sin pasar por los permisos ni dejar rastro.

-- Registro histórico
drop policy if exists "Usuarios aprobados pueden editar llegadas" on public.llegadas_malek_historico;
drop policy if exists "Usuarios aprobados pueden registrar llegadas" on public.llegadas_malek_historico;
drop policy if exists "Usuarios aprobados pueden editar salidas" on public.salidas_malek_historico;
drop policy if exists "Usuarios aprobados pueden registrar salidas" on public.salidas_malek_historico;

-- Itinerario: solo lectura
drop policy if exists "Usuarios aprobados gestionan vuelos manuales" on public.manual_flights_log;
create policy "Usuarios aprobados ven vuelos manuales" on public.manual_flights_log
  for select to authenticated using ((select private.is_approved()));

-- Sesiones: el servidor las crea y actualiza (con la IP que ve él, no la que diga el navegador)
drop policy if exists "Usuarios pueden insertar sus propias sesiones" on public.sesiones;
drop policy if exists "Usuarios pueden actualizar sus propias sesiones" on public.sesiones;

-- Perfiles y flota: los cambios del administrador también pasan por el servidor (bitácora)
drop policy if exists "Permitir a administradores actualizar perfiles" on public.perfiles;
drop policy if exists "Admins gestionan aircraft_types" on public.aircraft_types;
drop policy if exists "Admins gestionan aircraft" on public.aircraft;
drop policy if exists "Admins gestionan crew_members" on public.crew_members;
drop policy if exists "Admins gestionan flight_routes" on public.flight_routes;
drop policy if exists "Admins gestionan scheduled_flights" on public.scheduled_flights;

-- Función de la bitácora con search_path fijo (aviso de Supabase)
alter function private.bitacora_inalterable() set search_path = '';

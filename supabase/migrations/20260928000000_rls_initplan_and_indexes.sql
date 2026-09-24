-- Rendimiento: las reglas de acceso calculaban auth.uid() / private.is_approved() fila por
-- fila. Envueltas en (select …), Postgres las calcula una sola vez por consulta (un reporte
-- anual lee ~2.600 filas). Mismo significado, mismos nombres.
alter policy "Usuarios aprobados pueden ver llegadas" on public.llegadas_malek_historico using ((select private.is_approved()));
alter policy "Usuarios aprobados pueden editar llegadas" on public.llegadas_malek_historico using ((select private.is_approved())) with check ((select private.is_approved()));
alter policy "Usuarios aprobados pueden registrar llegadas" on public.llegadas_malek_historico with check ((select private.is_approved()));
alter policy "Usuarios aprobados pueden ver salidas" on public.salidas_malek_historico using ((select private.is_approved()));
alter policy "Usuarios aprobados pueden editar salidas" on public.salidas_malek_historico using ((select private.is_approved())) with check ((select private.is_approved()));
alter policy "Usuarios aprobados pueden registrar salidas" on public.salidas_malek_historico with check ((select private.is_approved()));
alter policy "Usuarios aprobados gestionan vuelos manuales" on public.manual_flights_log using ((select private.is_approved())) with check ((select private.is_approved()));
alter policy "Permitir a los usuarios leer su propio perfil" on public.perfiles using ((select auth.uid()) = id);
alter policy "Usuarios pueden ver sus propias sesiones" on public.sesiones using ((select auth.uid()) = user_id);
alter policy "Usuarios pueden actualizar sus propias sesiones" on public.sesiones using ((select auth.uid()) = user_id);
alter policy "Usuarios pueden insertar sus propias sesiones" on public.sesiones with check ((select auth.uid()) = user_id);
alter policy "Usuarios ven sus solicitudes" on public.solicitudes_eliminacion using (solicitado_por = (select auth.uid()));

-- Índices para las búsquedas más frecuentes
create index if not exists manual_flights_log_flightdate_idx on public.manual_flights_log ("flightDate");
create index if not exists sesiones_user_idx on public.sesiones (user_id, ultima_actividad desc);
create index if not exists sesiones_estado_idx on public.sesiones (estado, ultima_actividad desc);

-- Índice duplicado (ya existía idx_auditoria_fecha sobre la misma columna)
drop index if exists public.registros_auditoria_creado_idx;

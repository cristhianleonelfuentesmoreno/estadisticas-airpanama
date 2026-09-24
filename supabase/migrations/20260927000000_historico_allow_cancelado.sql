-- La app usa el estado CANCELADO (marcar cancelado → Pendientes → aprobar, editar en el
-- Registro, reportes), pero las tablas del histórico no lo aceptaban: aprobar un vuelo
-- cancelado fallaba. Se agrega a los valores permitidos.
alter table public.llegadas_malek_historico drop constraint llegadas_malek_historico_estado_final_check;
alter table public.llegadas_malek_historico add constraint llegadas_malek_historico_estado_final_check
  check (estado_final in ('LLEGÓ', 'CUMPLIDO', 'DEMORADO', 'DESVIADO', 'CANCELADO', 'PENDIENTE'));
alter table public.salidas_malek_historico drop constraint salidas_malek_historico_estado_final_check;
alter table public.salidas_malek_historico add constraint salidas_malek_historico_estado_final_check
  check (estado_final in ('LLEGÓ', 'CUMPLIDO', 'DEMORADO', 'DESVIADO', 'CANCELADO', 'PENDIENTE'));

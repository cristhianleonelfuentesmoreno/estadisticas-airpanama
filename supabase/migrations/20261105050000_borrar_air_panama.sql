-- ValisVentas ya no usa nada de Estadísticas Air Panama. Respaldo de estas tablas (JSON) en
-- _local/respaldo-airpanama-2026-11-04/ en la Mac de Cristhian; el código quedó en la etiqueta airpanama-final.
-- Nada fuera de este grupo depende de ellas (revisado: llaves foráneas, funciones y vistas).
drop table public.solicitudes_eliminacion;
drop table public.scheduled_flights;
drop table public.manual_flights_log;
drop table public.llegadas_malek_historico;
drop table public.salidas_malek_historico;
drop table public.crew_members;
drop table public.flight_routes;
drop table public.aircraft;
drop table public.aircraft_types;

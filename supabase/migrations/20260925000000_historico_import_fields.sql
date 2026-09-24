-- Importación del registro mensual (Excel del aeropuerto) al histórico.
-- El Excel trae datos del vuelo que antes no se guardaban (matrícula, avión, handler,
-- stand, servicio, notas, MTOW) y sus horas no son confiables: solo se usa la fecha.
-- Por eso la hora real deja de ser obligatoria.

alter table public.llegadas_malek_historico
  alter column hora_llegada_real drop not null,
  add column if not exists matricula text,
  add column if not exists avion     text,
  add column if not exists handler   text,
  add column if not exists stand     text,
  add column if not exists servicio  text,
  add column if not exists notas     text,
  add column if not exists mtow_kg   integer,
  add column if not exists fuente    text;   -- 'excel' si vino de la importación

alter table public.salidas_malek_historico
  alter column hora_salida_real drop not null,
  add column if not exists matricula text,
  add column if not exists avion     text,
  add column if not exists handler   text,
  add column if not exists stand     text,
  add column if not exists servicio  text,
  add column if not exists notas     text,
  add column if not exists mtow_kg   integer,
  add column if not exists fuente    text;

-- La importación busca por fecha: acelera la detección de vuelos ya guardados
create index if not exists llegadas_malek_historico_fecha_idx on public.llegadas_malek_historico (fecha);
create index if not exists salidas_malek_historico_fecha_idx on public.salidas_malek_historico (fecha);

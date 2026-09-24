-- Velocidad real de la app: cuánto tarda cada cambio de pantalla para cada persona,
-- por sección y tipo de dispositivo. Se ve en el panel (sección "Velocidad de la app").
create table if not exists public.metricas_navegacion (
  id          bigint generated always as identity primary key,
  creado_en   timestamptz not null default now(),
  usuario_id  uuid references public.perfiles (id) on delete set null,
  pagina      text not null,                 -- /dashboard, /dashboard/diario…
  tipo        text not null check (tipo in ('carga_inicial', 'cambio_seccion', 'cambio_filtro')),
  dispositivo text not null check (dispositivo in ('celular', 'tablet', 'computadora')),
  conexion    text,                          -- 4g, 3g, wifi… (si el navegador lo informa)
  duracion_ms integer not null check (duracion_ms between 0 and 60000)
);
create index if not exists metricas_navegacion_creado_idx on public.metricas_navegacion (creado_en desc);

-- Solo el servidor escribe y lee (a través de acciones que verifican el rol)
alter table public.metricas_navegacion enable row level security;

-- Resumen por sección, tipo y dispositivo: mediana y "casos lentos" (percentil 90)
create or replace function public.metricas_navegacion_resumen(dias integer)
returns table (pagina text, tipo text, dispositivo text, mediciones bigint, mediana_ms integer, lento_ms integer)
language sql stable
set search_path = ''
as $$
  select m.pagina, m.tipo, m.dispositivo, count(*),
         (percentile_cont(0.5) within group (order by m.duracion_ms))::integer,
         (percentile_cont(0.9) within group (order by m.duracion_ms))::integer
  from public.metricas_navegacion m
  where m.creado_en >= now() - make_interval(days => greatest(1, least(dias, 365)))
  group by 1, 2, 3
  order by 1, 2, 3;
$$;
revoke all on function public.metricas_navegacion_resumen(integer) from public, anon, authenticated;

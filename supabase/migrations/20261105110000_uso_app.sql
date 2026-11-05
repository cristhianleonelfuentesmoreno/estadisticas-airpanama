-- Cómo usa cada persona la app: qué pantallas abre, qué hace y qué no.
-- Sirve para mejorar el programa (qué se usa, qué no, dónde se traban).
-- Cada usuario solo puede anotar lo suyo; solo el administrador lo lee.

create table public.uso_app (
  id bigint generated always as identity primary key,
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  evento text not null check (evento ~ '^[a-z_]{2,40}$'),
  detalle jsonb not null default '{}'::jsonb check (octet_length(detalle::text) <= 2000),
  creado_en timestamptz not null default now()
);

create index uso_app_tienda_fecha on public.uso_app (tienda_id, creado_en desc);
create index uso_app_usuario_fecha on public.uso_app (usuario_id, creado_en desc);

alter table public.uso_app enable row level security;

create policy uso_app_insert on public.uso_app for insert to authenticated
  with check (usuario_id = (select auth.uid()) and public.puede_ver_tienda(tienda_id));

create policy uso_app_select on public.uso_app for select to authenticated
  using ((select public.es_admin()));

revoke update, delete on public.uso_app from authenticated, anon;

-- Resumen para el administrador: por persona y por acción, cuántas veces y la última vez.
create or replace function public.resumen_uso(p_dias int default 30)
returns table (usuario text, tienda text, evento text, veces bigint, ultima_vez timestamptz)
language sql stable security invoker set search_path = public as $$
  select coalesce(p.nombre, p.email, u.usuario_id::text), t.nombre, u.evento, count(*), max(u.creado_en)
  from uso_app u
  join tiendas t on t.id = u.tienda_id
  left join perfiles p on p.id = u.usuario_id
  where u.creado_en >= now() - make_interval(days => greatest(1, least(p_dias, 365)))
  group by 1, 2, 3
  order by 1, 4 desc;
$$;
revoke all on function public.resumen_uso(int) from public, anon;
grant execute on function public.resumen_uso(int) to authenticated;

-- Alta de dueños: quien se registra llena su solicitud mientras espera; el administrador
-- la revisa, la corrige si hace falta y al aprobar se crean su negocio y su tienda.
-- Solo agrega: los negocios que ya existen quedan con 30 %, que es lo que usaban.

alter table public.negocios
  add column porcentaje_ganancia numeric(5,2) not null default 30
  check (porcentaje_ganancia >= 0 and porcentaje_ganancia < 100);

create table public.solicitudes_negocio (
  usuario_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  negocio text not null check (length(trim(negocio)) between 2 and 80),
  tipo text check (tipo is null or length(tipo) <= 40),
  telefono text check (telefono is null or telefono ~ '^[0-9 +()-]{7,20}$'),
  vende_por_libra boolean not null default false,
  porcentaje_ganancia numeric(5,2) not null default 30 check (porcentaje_ganancia >= 0 and porcentaje_ganancia < 100),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.solicitudes_negocio enable row level security;

-- Cada persona ve y cambia solo la suya; el administrador la lee desde el servidor
create policy solicitudes_propia_select on public.solicitudes_negocio for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy solicitudes_propia_insert on public.solicitudes_negocio for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy solicitudes_propia_update on public.solicitudes_negocio for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
revoke delete on public.solicitudes_negocio from authenticated, anon;

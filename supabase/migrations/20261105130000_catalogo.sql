-- Catálogo de códigos de barras de Valis: la única tabla que comparten todos los negocios.
-- Solo datos del producto (nombre, marca, presentación, foto); nunca precios, costos, stock ni ventas.
-- Lo lee cualquier cuenta aprobada; lo escribe solo el administrador.

create table public.catalogo (
  codigo text primary key check (codigo ~ '^[0-9]{8,14}$'),
  nombre text not null check (length(trim(nombre)) > 0),
  marca text,
  presentacion text,
  categoria text,
  imagen_url text check (imagen_url is null or imagen_url ~ '^https://'),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users(id) on delete set null
);

alter table public.catalogo enable row level security;

create policy catalogo_select on public.catalogo for select to authenticated
  using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.status = 'aprobado'));
create policy catalogo_admin on public.catalogo for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- Fotos del catálogo: se ven con un enlace público; las sube el servidor con la llave de administrador
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 524288, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

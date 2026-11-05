-- El catálogo también guarda productos sin código de barras (especias y granos que llegan
-- en paquete y se venden sueltos). Cada fila tiene ahora su propio id; el código pasa a opcional
-- y sigue sin poder repetirse.

alter table public.catalogo drop constraint catalogo_pkey;
alter table public.catalogo add column id uuid not null default gen_random_uuid();
alter table public.catalogo add primary key (id);
alter table public.catalogo alter column codigo drop not null;
alter table public.catalogo add constraint catalogo_codigo_unico unique (codigo);

-- "El paquete trae 24 y se venden sueltas"
alter table public.catalogo add column por_paquete integer check (por_paquete is null or por_paquete between 2 and 1000);
alter table public.catalogo add column vende_suelto boolean not null default false;

-- Dos productos sin código no pueden llamarse igual
create unique index catalogo_nombre_sin_codigo on public.catalogo (lower(nombre)) where codigo is null;

-- ValisVentas: negocios, tiendas, productos, inventario por movimientos, entradas (facturas) y ventas.
-- El stock nunca se edita: es la suma de movimientos_inventario. Entradas y ventas se guardan
-- solo con registrar_entrada() y registrar_venta(), que validan al usuario y escriben todo en una transacción.

-- ---------- Tablas ----------

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  creado_en timestamptz not null default now()
);

create table public.tiendas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete restrict,
  nombre text not null check (length(trim(nombre)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  creado_en timestamptz not null default now()
);
create index tiendas_negocio_idx on public.tiendas(negocio_id);

create table public.miembros (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol text not null check (rol in ('dueno', 'cajero')),
  creado_en timestamptz not null default now(),
  primary key (negocio_id, usuario_id)
);
create index miembros_usuario_idx on public.miembros(usuario_id);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete restrict,
  nombre text not null check (length(trim(nombre)) > 0),
  marca text,
  presentacion text,
  categoria text,
  codigo_barras text check (codigo_barras is null or codigo_barras ~ '^[0-9A-Za-z-]{4,32}$'),
  vende_por text not null default 'unidad' check (vende_por in ('unidad', 'libra')),
  precio_venta numeric(12,2) check (precio_venta is null or precio_venta >= 0),
  costo numeric(12,4) check (costo is null or costo >= 0),
  itbms numeric(4,2) not null default 0 check (itbms in (0, 7, 10, 15)),
  imagen_url text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null,
  unique (negocio_id, codigo_barras)
);
create index productos_negocio_idx on public.productos(negocio_id);

create table public.entradas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete restrict,
  proveedor text not null check (length(trim(proveedor)) > 0),
  numero_factura text,
  fecha date not null default (now() at time zone 'America/Panama')::date,
  total numeric(12,2) not null default 0,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null
);
create index entradas_tienda_idx on public.entradas(tienda_id, creado_en desc);

create table public.entradas_lineas (
  id bigint generated always as identity primary key,
  entrada_id uuid not null references public.entradas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  cantidad numeric(12,3) not null check (cantidad > 0),
  costo_unitario numeric(12,4) not null check (costo_unitario >= 0)
);
create index entradas_lineas_entrada_idx on public.entradas_lineas(entrada_id);
create index entradas_lineas_producto_idx on public.entradas_lineas(producto_id);

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete restrict,
  total numeric(12,2) not null check (total >= 0),
  metodo_pago text not null check (metodo_pago in ('efectivo', 'yappy', 'tarjeta')),
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null
);
create index ventas_tienda_idx on public.ventas(tienda_id, creado_en desc);

create table public.ventas_lineas (
  id bigint generated always as identity primary key,
  venta_id uuid not null references public.ventas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  cantidad numeric(12,3) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0)
);
create index ventas_lineas_venta_idx on public.ventas_lineas(venta_id);
create index ventas_lineas_producto_idx on public.ventas_lineas(producto_id);

create table public.movimientos_inventario (
  id bigint generated always as identity primary key,
  tienda_id uuid not null references public.tiendas(id) on delete restrict,
  producto_id uuid not null references public.productos(id) on delete restrict,
  tipo text not null check (tipo in ('inicial', 'entrada', 'venta', 'ajuste')),
  cantidad numeric(12,3) not null check (cantidad <> 0),
  costo_unitario numeric(12,4),
  entrada_id uuid references public.entradas(id) on delete restrict,
  venta_id uuid references public.ventas(id) on delete restrict,
  nota text,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null
);
create index movimientos_tienda_producto_idx on public.movimientos_inventario(tienda_id, producto_id);
create index movimientos_producto_idx on public.movimientos_inventario(producto_id);
create index movimientos_entrada_idx on public.movimientos_inventario(entrada_id);
create index movimientos_venta_idx on public.movimientos_inventario(venta_id);

-- ---------- Quién es de qué negocio ----------

create or replace function public.es_miembro_negocio(p_negocio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where negocio_id = p_negocio and usuario_id = (select auth.uid()));
$$;

create or replace function public.es_miembro_tienda(p_tienda uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tiendas t join miembros m on m.negocio_id = t.negocio_id
    where t.id = p_tienda and m.usuario_id = (select auth.uid())
  );
$$;

revoke all on function public.es_miembro_negocio(uuid) from public, anon;
revoke all on function public.es_miembro_tienda(uuid) from public, anon;
grant execute on function public.es_miembro_negocio(uuid) to authenticated;
grant execute on function public.es_miembro_tienda(uuid) to authenticated;

-- ---------- Stock = suma de movimientos ----------

create view public.stock with (security_invoker = true) as
  select tienda_id, producto_id, sum(cantidad)::numeric(12,3) as cantidad
  from public.movimientos_inventario
  group by tienda_id, producto_id;

-- ---------- Seguridad por filas ----------

alter table public.negocios enable row level security;
alter table public.tiendas enable row level security;
alter table public.miembros enable row level security;
alter table public.productos enable row level security;
alter table public.entradas enable row level security;
alter table public.entradas_lineas enable row level security;
alter table public.ventas enable row level security;
alter table public.ventas_lineas enable row level security;
alter table public.movimientos_inventario enable row level security;

revoke all on public.negocios, public.tiendas, public.miembros, public.productos, public.entradas,
  public.entradas_lineas, public.ventas, public.ventas_lineas, public.movimientos_inventario, public.stock from anon;

create policy negocios_select on public.negocios for select to authenticated
  using (public.es_miembro_negocio(id));
create policy tiendas_select on public.tiendas for select to authenticated
  using (public.es_miembro_negocio(negocio_id));
create policy miembros_select on public.miembros for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy productos_select on public.productos for select to authenticated
  using (public.es_miembro_negocio(negocio_id));
create policy productos_insert on public.productos for insert to authenticated
  with check (public.es_miembro_negocio(negocio_id) and creado_por = (select auth.uid()));
create policy productos_update on public.productos for update to authenticated
  using (public.es_miembro_negocio(negocio_id)) with check (public.es_miembro_negocio(negocio_id));

create policy entradas_select on public.entradas for select to authenticated
  using (public.es_miembro_tienda(tienda_id));
create policy entradas_lineas_select on public.entradas_lineas for select to authenticated
  using (exists (select 1 from public.entradas e where e.id = entrada_id and public.es_miembro_tienda(e.tienda_id)));
create policy ventas_select on public.ventas for select to authenticated
  using (public.es_miembro_tienda(tienda_id));
create policy ventas_lineas_select on public.ventas_lineas for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_id and public.es_miembro_tienda(v.tienda_id)));
create policy movimientos_select on public.movimientos_inventario for select to authenticated
  using (public.es_miembro_tienda(tienda_id));
-- Sin políticas de insert/update/delete en entradas, ventas y movimientos: solo las funciones de abajo escriben.

-- ---------- Registrar una factura de proveedor ----------
-- p_lineas: [{ "producto_id": uuid, "cantidad": number, "costo_unitario": number }]

create or replace function public.registrar_entrada(
  p_tienda uuid, p_proveedor text, p_numero_factura text, p_lineas jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_negocio uuid;
  v_entrada uuid;
  v_linea jsonb;
  v_producto uuid;
  v_cantidad numeric;
  v_costo numeric;
  v_total numeric := 0;
begin
  if v_uid is null or not public.es_miembro_tienda(p_tienda) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if coalesce(trim(p_proveedor), '') = '' then
    raise exception 'Falta el proveedor';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La factura no tiene productos';
  end if;

  select negocio_id into v_negocio from tiendas where id = p_tienda;

  insert into entradas (tienda_id, proveedor, numero_factura, creado_por)
  values (p_tienda, trim(p_proveedor), nullif(trim(p_numero_factura), ''), v_uid)
  returning id into v_entrada;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_producto := (v_linea->>'producto_id')::uuid;
    v_cantidad := (v_linea->>'cantidad')::numeric;
    v_costo := (v_linea->>'costo_unitario')::numeric;
    if v_cantidad is null or v_cantidad <= 0 or v_costo is null or v_costo < 0 then
      raise exception 'Cantidad o costo inválido';
    end if;
    if not exists (select 1 from productos where id = v_producto and negocio_id = v_negocio) then
      raise exception 'Producto de otro negocio';
    end if;

    insert into entradas_lineas (entrada_id, producto_id, cantidad, costo_unitario)
    values (v_entrada, v_producto, v_cantidad, v_costo);
    insert into movimientos_inventario (tienda_id, producto_id, tipo, cantidad, costo_unitario, entrada_id, creado_por)
    values (p_tienda, v_producto, 'entrada', v_cantidad, v_costo, v_entrada, v_uid);
    update productos set costo = v_costo where id = v_producto;
    v_total := v_total + round(v_cantidad * v_costo, 2);
  end loop;

  update entradas set total = v_total where id = v_entrada;
  return v_entrada;
end;
$$;

-- ---------- Registrar una venta ----------
-- p_lineas: [{ "producto_id": uuid, "cantidad": number, "precio_unitario": number|null }]
-- El precio sale del producto; solo se acepta el que manda la caja si el producto no tiene precio.

create or replace function public.registrar_venta(
  p_tienda uuid, p_metodo_pago text, p_lineas jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_negocio uuid;
  v_venta uuid;
  v_linea jsonb;
  v_producto productos%rowtype;
  v_cantidad numeric;
  v_precio numeric;
  v_subtotal numeric;
  v_total numeric := 0;
begin
  if v_uid is null or not public.es_miembro_tienda(p_tienda) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_metodo_pago not in ('efectivo', 'yappy', 'tarjeta') then
    raise exception 'Método de pago inválido';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  select negocio_id into v_negocio from tiendas where id = p_tienda;

  insert into ventas (tienda_id, total, metodo_pago, creado_por)
  values (p_tienda, 0, p_metodo_pago, v_uid)
  returning id into v_venta;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    select * into v_producto from productos
      where id = (v_linea->>'producto_id')::uuid and negocio_id = v_negocio;
    if not found then
      raise exception 'Producto de otro negocio';
    end if;
    v_cantidad := (v_linea->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida';
    end if;
    v_precio := coalesce(v_producto.precio_venta, (v_linea->>'precio_unitario')::numeric);
    if v_precio is null or v_precio < 0 then
      raise exception 'El producto % no tiene precio', v_producto.nombre;
    end if;
    v_subtotal := round(v_cantidad * v_precio, 2);

    insert into ventas_lineas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    values (v_venta, v_producto.id, v_cantidad, v_precio, v_subtotal);
    insert into movimientos_inventario (tienda_id, producto_id, tipo, cantidad, costo_unitario, venta_id, creado_por)
    values (p_tienda, v_producto.id, 'venta', -v_cantidad, v_producto.costo, v_venta, v_uid);
    v_total := v_total + v_subtotal;
  end loop;

  update ventas set total = v_total where id = v_venta;
  return v_venta;
end;
$$;

revoke all on function public.registrar_entrada(uuid, text, text, jsonb) from public, anon;
revoke all on function public.registrar_venta(uuid, text, jsonb) from public, anon;
grant execute on function public.registrar_entrada(uuid, text, text, jsonb) to authenticated;
grant execute on function public.registrar_venta(uuid, text, jsonb) to authenticated;

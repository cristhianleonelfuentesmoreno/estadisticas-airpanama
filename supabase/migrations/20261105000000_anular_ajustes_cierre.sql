-- Uso diario sin miedo: anular una venta, mercancía que entra o sale sin factura y cierre de caja del día.
-- Nada se borra: anular y ajustar agregan movimientos; el cierre guarda lo que dijo el sistema y lo que se contó.

-- ---------- Columnas nuevas ----------

alter table public.ventas
  add column anulada_en timestamptz,
  add column anulada_por uuid references auth.users(id) on delete set null,
  add column motivo_anulacion text check (motivo_anulacion is null or length(motivo_anulacion) <= 200);

-- Costo del producto al momento de vender: la ganancia del día no cambia si después cambia el costo
alter table public.ventas_lineas
  add column costo_unitario numeric(12,4) check (costo_unitario is null or costo_unitario >= 0);

alter table public.movimientos_inventario drop constraint movimientos_inventario_tipo_check;
alter table public.movimientos_inventario
  add constraint movimientos_inventario_tipo_check check (tipo in ('inicial', 'entrada', 'venta', 'ajuste', 'anulacion')),
  add column motivo text check (motivo is null or motivo in ('regalia', 'compra_sin_factura', 'danado', 'consumo', 'conteo'));

-- Efectivo con el que abre la caja cada día
alter table public.tiendas
  add column base_caja numeric(12,2) not null default 25 check (base_caja >= 0);

create table public.cierres_caja (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete restrict,
  fecha date not null,
  base_caja numeric(12,2) not null,
  ventas_cantidad integer not null,
  total_ventas numeric(12,2) not null,
  efectivo numeric(12,2) not null,
  yappy numeric(12,2) not null,
  tarjeta numeric(12,2) not null,
  ganancia numeric(12,2) not null,
  efectivo_esperado numeric(12,2) not null,
  efectivo_contado numeric(12,2) not null check (efectivo_contado >= 0),
  diferencia numeric(12,2) not null,
  nota text check (nota is null or length(nota) <= 300),
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null,
  unique (tienda_id, fecha)
);

alter table public.cierres_caja enable row level security;
revoke all on public.cierres_caja from anon;
create policy cierres_select on public.cierres_caja for select to authenticated
  using (public.es_miembro_tienda(tienda_id));

-- ---------- La venta guarda el costo de cada línea ----------

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

    insert into ventas_lineas (venta_id, producto_id, cantidad, precio_unitario, subtotal, costo_unitario)
    values (v_venta, v_producto.id, v_cantidad, v_precio, v_subtotal, v_producto.costo);
    insert into movimientos_inventario (tienda_id, producto_id, tipo, cantidad, costo_unitario, venta_id, creado_por)
    values (p_tienda, v_producto.id, 'venta', -v_cantidad, v_producto.costo, v_venta, v_uid);
    v_total := v_total + v_subtotal;
  end loop;

  update ventas set total = v_total where id = v_venta;
  return v_venta;
end;
$$;

-- ---------- Anular una venta: devuelve la mercancía al inventario ----------

create or replace function public.anular_venta(p_venta uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_venta ventas%rowtype;
begin
  select * into v_venta from ventas where id = p_venta for update;
  if not found or v_uid is null or not public.es_miembro_tienda(v_venta.tienda_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_venta.anulada_en is not null then
    raise exception 'Esta venta ya estaba anulada';
  end if;

  update ventas
    set anulada_en = now(), anulada_por = v_uid, motivo_anulacion = nullif(left(trim(p_motivo), 200), '')
    where id = p_venta;

  insert into movimientos_inventario (tienda_id, producto_id, tipo, cantidad, costo_unitario, venta_id, nota, creado_por)
  select v_venta.tienda_id, vl.producto_id, 'anulacion', vl.cantidad, vl.costo_unitario, p_venta, 'Venta anulada', v_uid
  from ventas_lineas vl where vl.venta_id = p_venta;
end;
$$;

-- ---------- Mercancía sin factura ----------
-- regalia / compra_sin_factura: entra (la regalía no cambia el costo del producto)
-- danado / consumo: sale
-- conteo: p_cantidad es lo que se contó; se guarda solo la diferencia

create or replace function public.registrar_ajuste(
  p_tienda uuid, p_producto uuid, p_motivo text, p_cantidad numeric, p_costo numeric, p_nota text
) returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_producto productos%rowtype;
  v_actual numeric;
  v_cambio numeric;
  v_costo numeric;
begin
  if v_uid is null or not public.es_miembro_tienda(p_tienda) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select p.* into v_producto from productos p join tiendas t on t.negocio_id = p.negocio_id
    where p.id = p_producto and t.id = p_tienda
    for update of p;
  if not found then
    raise exception 'Producto de otro negocio';
  end if;
  if p_cantidad is null or p_cantidad < 0 or (p_motivo <> 'conteo' and p_cantidad = 0) then
    raise exception 'Cantidad inválida';
  end if;
  if p_costo is not null and p_costo < 0 then
    raise exception 'Costo inválido';
  end if;

  if p_motivo = 'regalia' then
    v_cambio := p_cantidad; v_costo := 0;
  elsif p_motivo = 'compra_sin_factura' then
    v_cambio := p_cantidad; v_costo := coalesce(p_costo, v_producto.costo);
    if p_costo is not null then
      update productos set costo = p_costo where id = p_producto;
    end if;
  elsif p_motivo in ('danado', 'consumo') then
    v_cambio := -p_cantidad; v_costo := v_producto.costo;
  elsif p_motivo = 'conteo' then
    select coalesce(sum(cantidad), 0) into v_actual
      from movimientos_inventario where tienda_id = p_tienda and producto_id = p_producto;
    v_cambio := p_cantidad - v_actual; v_costo := v_producto.costo;
  else
    raise exception 'Motivo inválido';
  end if;

  if v_cambio <> 0 then
    insert into movimientos_inventario (tienda_id, producto_id, tipo, motivo, cantidad, costo_unitario, nota, creado_por)
    values (p_tienda, p_producto, 'ajuste', p_motivo, v_cambio, v_costo, nullif(left(trim(p_nota), 200), ''), v_uid);
  end if;
  return v_cambio;
end;
$$;

-- ---------- Resumen y cierre del día (hora de Panamá) ----------

create or replace function public.resumen_dia(p_tienda uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_fecha date := (now() at time zone 'America/Panama')::date;
  v_desde timestamptz := v_fecha::timestamp at time zone 'America/Panama';
  v_r jsonb;
begin
  if auth.uid() is null or not public.es_miembro_tienda(p_tienda) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'fecha', v_fecha,
    'base_caja', t.base_caja,
    'ventas_cantidad', count(v.id),
    'total_ventas', coalesce(sum(v.total), 0),
    'efectivo', coalesce(sum(v.total) filter (where v.metodo_pago = 'efectivo'), 0),
    'yappy', coalesce(sum(v.total) filter (where v.metodo_pago = 'yappy'), 0),
    'tarjeta', coalesce(sum(v.total) filter (where v.metodo_pago = 'tarjeta'), 0),
    'ganancia', coalesce((
      select round(sum(vl.subtotal - vl.cantidad * vl.costo_unitario), 2)
      from ventas_lineas vl join ventas v2 on v2.id = vl.venta_id
      where v2.tienda_id = p_tienda and v2.creado_en >= v_desde and v2.creado_en < v_desde + interval '1 day'
        and v2.anulada_en is null and vl.costo_unitario is not null
    ), 0),
    'ventas_sin_costo', coalesce((
      select round(sum(vl.subtotal), 2)
      from ventas_lineas vl join ventas v2 on v2.id = vl.venta_id
      where v2.tienda_id = p_tienda and v2.creado_en >= v_desde and v2.creado_en < v_desde + interval '1 day'
        and v2.anulada_en is null and vl.costo_unitario is null
    ), 0)
  ) into v_r
  from tiendas t
  left join ventas v on v.tienda_id = t.id and v.creado_en >= v_desde and v.creado_en < v_desde + interval '1 day' and v.anulada_en is null
  where t.id = p_tienda
  group by t.base_caja;
  return v_r;
end;
$$;

create or replace function public.cerrar_caja(p_tienda uuid, p_efectivo_contado numeric, p_nota text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_r jsonb;
  v_esperado numeric;
  v_id uuid;
begin
  if v_uid is null or not public.es_miembro_tienda(p_tienda) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_efectivo_contado is null or p_efectivo_contado < 0 then
    raise exception 'Escribe cuánto efectivo contaste';
  end if;
  v_r := public.resumen_dia(p_tienda);
  v_esperado := (v_r->>'base_caja')::numeric + (v_r->>'efectivo')::numeric;

  insert into cierres_caja (tienda_id, fecha, base_caja, ventas_cantidad, total_ventas, efectivo, yappy, tarjeta, ganancia,
    efectivo_esperado, efectivo_contado, diferencia, nota, creado_por)
  values (p_tienda, (v_r->>'fecha')::date, (v_r->>'base_caja')::numeric, (v_r->>'ventas_cantidad')::int,
    (v_r->>'total_ventas')::numeric, (v_r->>'efectivo')::numeric, (v_r->>'yappy')::numeric, (v_r->>'tarjeta')::numeric,
    (v_r->>'ganancia')::numeric, v_esperado, p_efectivo_contado, round(p_efectivo_contado - v_esperado, 2),
    nullif(left(trim(p_nota), 300), ''), v_uid)
  on conflict (tienda_id, fecha) do update set
    base_caja = excluded.base_caja, ventas_cantidad = excluded.ventas_cantidad, total_ventas = excluded.total_ventas,
    efectivo = excluded.efectivo, yappy = excluded.yappy, tarjeta = excluded.tarjeta, ganancia = excluded.ganancia,
    efectivo_esperado = excluded.efectivo_esperado, efectivo_contado = excluded.efectivo_contado,
    diferencia = excluded.diferencia, nota = excluded.nota, creado_en = now(), creado_por = excluded.creado_por
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.anular_venta(uuid, text) from public, anon;
revoke all on function public.registrar_ajuste(uuid, uuid, text, numeric, numeric, text) from public, anon;
revoke all on function public.resumen_dia(uuid) from public, anon;
revoke all on function public.cerrar_caja(uuid, numeric, text) from public, anon;
grant execute on function public.anular_venta(uuid, text) to authenticated;
grant execute on function public.registrar_ajuste(uuid, uuid, text, numeric, numeric, text) to authenticated;
grant execute on function public.resumen_dia(uuid) to authenticated;
grant execute on function public.cerrar_caja(uuid, numeric, text) to authenticated;

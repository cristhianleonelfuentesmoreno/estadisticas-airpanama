-- Seguridad: cuentas aprobadas, acceso por tienda y números válidos.
-- Los miembros sin tienda asignada conservan acceso a todo el negocio.

alter table public.miembros
  add column tienda_id uuid null references public.tiendas(id) on delete cascade;

create or replace function public.es_miembro_tienda(p_tienda uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tiendas t join miembros m on m.negocio_id = t.negocio_id
    join perfiles p on p.id = m.usuario_id
    where p.status = 'aprobado' and (m.tienda_id is null or m.tienda_id = t.id)
      and t.id = p_tienda and m.usuario_id = (select auth.uid()) and m.rol in ('dueno', 'cajero')
  );
$$;

create or replace function public.es_miembro_negocio(p_negocio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros m join perfiles p on p.id = m.usuario_id
    where p.status = 'aprobado' and m.negocio_id = p_negocio and m.usuario_id = (select auth.uid()) and m.rol in ('dueno', 'cajero')
  );
$$;

create or replace function public.puede_ver_tienda(p_tienda uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tiendas t join miembros m on m.negocio_id = t.negocio_id
    join perfiles p on p.id = m.usuario_id
    where p.status = 'aprobado' and (m.tienda_id is null or m.tienda_id = t.id)
      and t.id = p_tienda and m.usuario_id = (select auth.uid())
  );
$$;

create or replace function public.puede_ver_negocio(p_negocio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros m join perfiles p on p.id = m.usuario_id
    where p.status = 'aprobado' and m.negocio_id = p_negocio and m.usuario_id = (select auth.uid()));
$$;

revoke all on function public.es_miembro_tienda(uuid) from public, anon;
grant execute on function public.es_miembro_tienda(uuid) to authenticated;

revoke all on function public.es_miembro_negocio(uuid) from public, anon;
grant execute on function public.es_miembro_negocio(uuid) to authenticated;

revoke all on function public.puede_ver_tienda(uuid) from public, anon;
grant execute on function public.puede_ver_tienda(uuid) to authenticated;

revoke all on function public.puede_ver_negocio(uuid) from public, anon;
grant execute on function public.puede_ver_negocio(uuid) to authenticated;

alter policy tiendas_select on public.tiendas using (public.puede_ver_tienda(id));

-- Se rechaza NaN también cuando se escribe sin pasar por las funciones.

alter table public.ventas
  add constraint ventas_total_no_nan check (total <> 'NaN'::numeric);

alter table public.ventas_lineas
  add constraint ventas_lineas_cantidad_no_nan check (cantidad <> 'NaN'::numeric),
  add constraint ventas_lineas_precio_unitario_no_nan check (precio_unitario <> 'NaN'::numeric),
  add constraint ventas_lineas_subtotal_no_nan check (subtotal <> 'NaN'::numeric),
  add constraint ventas_lineas_costo_unitario_no_nan check (costo_unitario <> 'NaN'::numeric);

alter table public.entradas
  add constraint entradas_total_no_nan check (total <> 'NaN'::numeric);

alter table public.entradas_lineas
  add constraint entradas_lineas_cantidad_no_nan check (cantidad <> 'NaN'::numeric),
  add constraint entradas_lineas_costo_unitario_no_nan check (costo_unitario <> 'NaN'::numeric);

alter table public.movimientos_inventario
  add constraint movimientos_inventario_cantidad_no_nan check (cantidad <> 'NaN'::numeric),
  add constraint movimientos_inventario_costo_unitario_no_nan check (costo_unitario <> 'NaN'::numeric);

alter table public.productos
  add constraint productos_precio_venta_no_nan check (precio_venta <> 'NaN'::numeric),
  add constraint productos_costo_no_nan check (costo <> 'NaN'::numeric),
  add constraint productos_stock_minimo_no_nan check (stock_minimo <> 'NaN'::numeric);

alter table public.cierres_caja
  add constraint cierres_caja_base_caja_no_nan check (base_caja <> 'NaN'::numeric),
  add constraint cierres_caja_total_ventas_no_nan check (total_ventas <> 'NaN'::numeric),
  add constraint cierres_caja_efectivo_no_nan check (efectivo <> 'NaN'::numeric),
  add constraint cierres_caja_yappy_no_nan check (yappy <> 'NaN'::numeric),
  add constraint cierres_caja_tarjeta_no_nan check (tarjeta <> 'NaN'::numeric),
  add constraint cierres_caja_ganancia_no_nan check (ganancia <> 'NaN'::numeric),
  add constraint cierres_caja_efectivo_esperado_no_nan check (efectivo_esperado <> 'NaN'::numeric),
  add constraint cierres_caja_efectivo_contado_no_nan check (efectivo_contado <> 'NaN'::numeric),
  add constraint cierres_caja_diferencia_no_nan check (diferencia <> 'NaN'::numeric);

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
    if v_cantidad is null or v_cantidad = 'NaN'::numeric or v_cantidad <= 0
      or v_costo is null or v_costo = 'NaN'::numeric or v_costo < 0 then
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
    if v_cantidad is null or v_cantidad = 'NaN'::numeric or v_cantidad <= 0 then
      raise exception 'Cantidad inválida';
    end if;
    v_precio := coalesce(v_producto.precio_venta, (v_linea->>'precio_unitario')::numeric);
    if v_precio is null or v_precio = 'NaN'::numeric or v_precio < 0
      or (v_linea->>'precio_unitario')::numeric = 'NaN'::numeric then
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
  if p_cantidad is null or p_cantidad = 'NaN'::numeric or p_cantidad < 0 or (p_motivo <> 'conteo' and p_cantidad = 0) then
    raise exception 'Cantidad inválida';
  end if;
  if p_costo is not null and (p_costo = 'NaN'::numeric or p_costo < 0) then
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
  if p_efectivo_contado is null or p_efectivo_contado = 'NaN'::numeric or p_efectivo_contado < 0 then
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

revoke all on function public.registrar_entrada(uuid, text, text, jsonb) from public, anon;
grant execute on function public.registrar_entrada(uuid, text, text, jsonb) to authenticated;

revoke all on function public.registrar_venta(uuid, text, jsonb) from public, anon;
grant execute on function public.registrar_venta(uuid, text, jsonb) to authenticated;

revoke all on function public.registrar_ajuste(uuid, uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.registrar_ajuste(uuid, uuid, text, numeric, numeric, text) to authenticated;

revoke all on function public.cerrar_caja(uuid, numeric, text) from public, anon;
grant execute on function public.cerrar_caja(uuid, numeric, text) to authenticated;

-- El bloqueo por IP evita superar el límite con pedidos simultáneos.
create or replace function public.registrar_acceso_fallido(
  p_ip text, p_nombre_referencia text, p_ubicacion text, p_dispositivo text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_intentos bigint;
begin
  if p_ip is not null and p_ip <> '' then
    perform pg_advisory_xact_lock(hashtext(p_ip));
    select count(*) into v_intentos from registros_auditoria
      where tipo_evento = 'acceso_fallido' and ip = p_ip
        and creado_en >= now() - interval '10 minutes';
    if v_intentos >= 20 then
      return;
    end if;
  end if;

  insert into registros_auditoria (
    tipo_evento, usuario_id, actor_nombre, actor_rol, entidad, entidad_id,
    nombre_referencia, descripcion, detalles_extra, ip, ubicacion, dispositivo
  ) values (
    'acceso_fallido', null, null, null, null, null,
    left(p_nombre_referencia, 300), 'Credenciales inválidas o acceso bloqueado por política de firewall.',
    '{}'::jsonb, coalesce(nullif(p_ip, ''), 'IP desconocida'), p_ubicacion, p_dispositivo
  );
end;
$$;

revoke all on function public.registrar_acceso_fallido(text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_acceso_fallido(text, text, text, text) to service_role;

revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.perfiles (id, email, role, status, nombre)
  values (new.id, new.email, 'usuario', 'pendiente', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

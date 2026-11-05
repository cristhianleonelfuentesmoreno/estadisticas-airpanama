-- Caja sin internet: cada venta lleva un número que genera el celular (id_cliente) y la hora
-- en que de verdad se hizo. Si el celular la manda dos veces, la base devuelve la misma venta.
-- Las llamadas de antes (sin estos datos) siguen funcionando igual.

alter table public.ventas add column id_cliente uuid;
create unique index ventas_id_cliente on public.ventas (id_cliente) where id_cliente is not null;

drop function public.registrar_venta(uuid, text, jsonb);

create function public.registrar_venta(
  p_tienda uuid, p_metodo_pago text, p_lineas jsonb, p_id_cliente uuid default null, p_hecha_en timestamptz default null
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
  v_cuando timestamptz := now();
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

  -- La misma venta que llega dos veces (el celular reintentó sin saber si había llegado) no se cobra dos veces
  if p_id_cliente is not null then
    select id into v_venta from ventas where id_cliente = p_id_cliente and tienda_id = p_tienda;
    if found then
      return v_venta;
    end if;
  end if;
  -- Hecha sin internet: se guarda con su hora real, si es de los últimos 3 días y no del futuro
  if p_hecha_en is not null and p_hecha_en <= now() and p_hecha_en > now() - interval '3 days' then
    v_cuando := p_hecha_en;
  end if;

  insert into ventas (tienda_id, total, metodo_pago, creado_por, id_cliente, creado_en)
  values (p_tienda, 0, p_metodo_pago, v_uid, p_id_cliente, v_cuando)
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
    insert into movimientos_inventario (tienda_id, producto_id, tipo, cantidad, costo_unitario, venta_id, creado_por, creado_en)
    values (p_tienda, v_producto.id, 'venta', -v_cantidad, v_producto.costo, v_venta, v_uid, v_cuando);
    v_total := v_total + v_subtotal;
  end loop;

  update ventas set total = v_total where id = v_venta;
  return v_venta;
end;
$$;
revoke all on function public.registrar_venta(uuid, text, jsonb, uuid, timestamptz) from public, anon;
grant execute on function public.registrar_venta(uuid, text, jsonb, uuid, timestamptz) to authenticated;

-- Corregir una factura ya registrada: proveedor, número, cantidad y costo de cada línea.
-- No se borra la historia: la diferencia de cantidad entra como otro movimiento de la
-- factura ("Corrección de factura"), así el inventario cuadra y se ve qué se cambió.
-- p_lineas: [{ "id": number, "cantidad": number, "costo_unitario": number }]; cantidad 0 = quitar la línea.
create or replace function public.editar_entrada(
  p_entrada uuid, p_proveedor text, p_numero_factura text, p_lineas jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tienda uuid;
  v_linea jsonb;
  v_actual entradas_lineas%rowtype;
  v_cantidad numeric;
  v_costo numeric;
  v_ultima uuid;
begin
  select tienda_id into v_tienda from entradas where id = p_entrada;
  if v_uid is null or v_tienda is null or not public.es_miembro_tienda(v_tienda) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if coalesce(trim(p_proveedor), '') = '' then
    raise exception 'Falta el proveedor';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' then
    raise exception 'Líneas inválidas';
  end if;

  update entradas set proveedor = trim(p_proveedor), numero_factura = nullif(trim(p_numero_factura), '') where id = p_entrada;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    select * into v_actual from entradas_lineas where id = (v_linea->>'id')::bigint and entrada_id = p_entrada;
    if not found then
      raise exception 'Esa línea no es de esta factura';
    end if;
    v_cantidad := (v_linea->>'cantidad')::numeric;
    v_costo := (v_linea->>'costo_unitario')::numeric;
    if v_cantidad is null or v_cantidad = 'NaN'::numeric or v_cantidad < 0
      or v_costo is null or v_costo = 'NaN'::numeric or v_costo < 0 then
      raise exception 'Cantidad o costo inválido';
    end if;

    if v_cantidad <> v_actual.cantidad then
      insert into movimientos_inventario (tienda_id, producto_id, tipo, cantidad, costo_unitario, entrada_id, nota, creado_por)
      values (v_tienda, v_actual.producto_id, 'entrada', v_cantidad - v_actual.cantidad, v_costo, p_entrada, 'Corrección de factura', v_uid);
    end if;
    if v_cantidad = 0 then
      delete from entradas_lineas where id = v_actual.id;
    else
      update entradas_lineas set cantidad = v_cantidad, costo_unitario = v_costo where id = v_actual.id;
    end if;

    -- El costo del producto cambia solo si esta es su factura más reciente
    if v_cantidad > 0 and v_costo <> v_actual.costo_unitario then
      select e.id into v_ultima from entradas e join entradas_lineas l on l.entrada_id = e.id
      where l.producto_id = v_actual.producto_id and e.tienda_id = v_tienda
      order by e.creado_en desc limit 1;
      if v_ultima = p_entrada then
        update productos set costo = v_costo where id = v_actual.producto_id;
      end if;
    end if;
  end loop;

  if not exists (select 1 from entradas_lineas where entrada_id = p_entrada) then
    raise exception 'La factura tiene que quedar con al menos un producto';
  end if;
  update entradas set total = (
    select coalesce(sum(round(cantidad * costo_unitario, 2)), 0) from entradas_lineas where entrada_id = p_entrada
  ) where id = p_entrada;
end;
$$;
revoke all on function public.editar_entrada(uuid, text, text, jsonb) from public, anon;
grant execute on function public.editar_entrada(uuid, text, text, jsonb) to authenticated;

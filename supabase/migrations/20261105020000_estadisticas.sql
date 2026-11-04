-- "Mi negocio": ventas, ganancia y productos de un período, calculados en la base (hora de Panamá, sin anuladas).
create or replace function public.estadisticas(p_tienda uuid, p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ini timestamptz := p_desde::timestamp at time zone 'America/Panama';
  v_fin timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Panama';
  v_dias int := p_hasta - p_desde + 1;
  v_r jsonb;
begin
  if auth.uid() is null or not public.es_miembro_tienda(p_tienda) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_dias < 1 or v_dias > 400 then
    raise exception 'Período inválido';
  end if;

  with v as (
    select * from ventas where tienda_id = p_tienda and anulada_en is null and creado_en >= v_ini and creado_en < v_fin
  ), l as (
    select vl.*, p.nombre, p.vende_por from ventas_lineas vl join v on v.id = vl.venta_id join productos p on p.id = vl.producto_id
  ), por_producto as (
    select producto_id, nombre, vende_por, sum(cantidad) as cantidad, sum(subtotal) as importe,
      round(sum(subtotal - cantidad * costo_unitario) filter (where costo_unitario is not null), 2) as ganancia
    from l group by producto_id, nombre, vende_por
  ), quietos as (
    select p.nombre, p.vende_por, s.cantidad, round(s.cantidad * coalesce(p.costo, 0), 2) as valor
    from productos p join stock s on s.producto_id = p.id and s.tienda_id = p_tienda
    where p.activo and s.cantidad > 0 and not exists (
      select 1 from movimientos_inventario m
      where m.producto_id = p.id and m.tienda_id = p_tienda and m.tipo = 'venta' and m.creado_en >= now() - interval '30 days'
    )
  )
  select jsonb_build_object(
    'total', (select coalesce(sum(total), 0) from v),
    'ventas', (select count(*) from v),
    'ganancia', (select coalesce(round(sum(subtotal - cantidad * costo_unitario), 2), 0) from l where costo_unitario is not null),
    'ventas_sin_costo', (select coalesce(sum(subtotal), 0) from l where costo_unitario is null),
    'total_anterior', (
      select coalesce(sum(total), 0) from ventas
      where tienda_id = p_tienda and anulada_en is null and creado_en >= v_ini - make_interval(days => v_dias) and creado_en < v_ini
    ),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'total', coalesce(t.total, 0)) order by d), '[]'::jsonb)
      from generate_series(p_desde, p_hasta, interval '1 day') d
      left join (select (creado_en at time zone 'America/Panama')::date as dia, sum(total) as total from v group by 1) t on t.dia = d::date
    ),
    'metodos', (select coalesce(jsonb_object_agg(metodo_pago, s), '{}'::jsonb) from (select metodo_pago, sum(total) as s from v group by 1) m),
    'mas_vendidos', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.importe desc), '[]'::jsonb)
      from (select nombre, vende_por, cantidad, importe, ganancia from por_producto order by importe desc limit 10) t
    ),
    'mas_ganancia', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.ganancia desc), '[]'::jsonb)
      from (select nombre, vende_por, cantidad, importe, ganancia from por_producto where ganancia is not null order by ganancia desc limit 5) t
    ),
    'quietos', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.valor desc), '[]'::jsonb)
      from (select * from quietos order by valor desc limit 15) t
    ),
    'quietos_cantidad', (select count(*) from quietos),
    'quietos_valor', (select coalesce(sum(valor), 0) from quietos),
    'perdidas', (
      select coalesce(round(sum(-cantidad * coalesce(costo_unitario, 0)), 2), 0) from movimientos_inventario
      where tienda_id = p_tienda and tipo = 'ajuste' and motivo = 'danado' and creado_en >= v_ini and creado_en < v_fin
    ),
    'primera_venta', (select min(creado_en) from ventas where tienda_id = p_tienda and anulada_en is null)
  ) into v_r;
  return v_r;
end;
$$;

revoke all on function public.estadisticas(uuid, date, date) from public, anon;
grant execute on function public.estadisticas(uuid, date, date) to authenticated;

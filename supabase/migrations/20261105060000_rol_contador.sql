-- Rol "contador": entra a una tienda solo para ver y descargar los reportes del mes.
-- Puede LEER ventas, compras, movimientos y productos; no puede vender, cerrar caja,
-- registrar facturas ni cambiar productos.
--
-- Cómo: "ver" (puede_ver_*) acepta a cualquier miembro; "operar" (es_miembro_*, que ya usan
-- las funciones que escriben y las políticas de productos) queda solo para dueño y cajero.

alter table public.miembros drop constraint miembros_rol_check;
alter table public.miembros add constraint miembros_rol_check check (rol in ('dueno', 'cajero', 'contador'));

create or replace function public.puede_ver_tienda(p_tienda uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tiendas t join miembros m on m.negocio_id = t.negocio_id
    where t.id = p_tienda and m.usuario_id = (select auth.uid())
  );
$$;

create or replace function public.puede_ver_negocio(p_negocio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros where negocio_id = p_negocio and usuario_id = (select auth.uid()));
$$;

revoke all on function public.puede_ver_tienda(uuid) from public, anon;
revoke all on function public.puede_ver_negocio(uuid) from public, anon;
grant execute on function public.puede_ver_tienda(uuid) to authenticated;
grant execute on function public.puede_ver_negocio(uuid) to authenticated;

-- Operar: solo dueño y cajero
create or replace function public.es_miembro_tienda(p_tienda uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tiendas t join miembros m on m.negocio_id = t.negocio_id
    where t.id = p_tienda and m.usuario_id = (select auth.uid()) and m.rol in ('dueno', 'cajero')
  );
$$;

create or replace function public.es_miembro_negocio(p_negocio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros where negocio_id = p_negocio and usuario_id = (select auth.uid()) and rol in ('dueno', 'cajero')
  );
$$;

-- Lecturas que el contador necesita para su reporte
alter policy tiendas_select on public.tiendas using (public.puede_ver_negocio(negocio_id));
alter policy negocios_select on public.negocios using (public.puede_ver_negocio(id));
alter policy productos_select on public.productos using (public.puede_ver_negocio(negocio_id));
alter policy ventas_select on public.ventas using (public.puede_ver_tienda(tienda_id));
alter policy ventas_lineas_select on public.ventas_lineas
  using (exists (select 1 from public.ventas v where v.id = venta_id and public.puede_ver_tienda(v.tienda_id)));
alter policy entradas_select on public.entradas using (public.puede_ver_tienda(tienda_id));
alter policy entradas_lineas_select on public.entradas_lineas
  using (exists (select 1 from public.entradas e where e.id = entrada_id and public.puede_ver_tienda(e.tienda_id)));
alter policy movimientos_select on public.movimientos_inventario using (public.puede_ver_tienda(tienda_id));
alter policy cierres_select on public.cierres_caja using (public.puede_ver_tienda(tienda_id));

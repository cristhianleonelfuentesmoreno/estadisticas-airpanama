import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProductos, getTiendaParaOperar } from '@/lib/tienda/servidor'
import { inicioDeHoyPanama } from '@/lib/tienda/formato'
import CajaClient from '@/components/tienda/CajaClient'
import PrimerosPasos, { type Paso } from '@/components/tienda/PrimerosPasos'

export default async function CajaPage({ params }: PageProps<'/t/[slug]/caja'>) {
  const { slug } = await params
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) notFound()

  const supabase = await createClient()
  const [productos, { data: ventasHoy }, { count: ventasTotales }, { count: facturas }] = await Promise.all([
    getProductos(tienda),
    supabase.from('ventas').select('total').eq('tienda_id', tienda.id).is('anulada_en', null).gte('creado_en', inicioDeHoyPanama()),
    supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('tienda_id', tienda.id),
    supabase.from('entradas').select('id', { count: 'exact', head: true }).eq('tienda_id', tienda.id),
  ])
  const resumen = {
    cantidad: ventasHoy?.length ?? 0,
    total: (ventasHoy ?? []).reduce((s, v) => s + Number(v.total), 0),
  }

  const conCosto = productos.filter(p => p.costo !== null).length
  const pasos: Paso[] = [
    { titulo: 'Agrega tus productos', detalle: 'Escanéalos o escríbelos en Inventario', href: `/t/${slug}/inventario`, hecho: productos.length > 0 },
    { titulo: 'Ponle precio a todo', detalle: 'Así la caja cobra sola', href: `/t/${slug}/inventario?filtro=sin-precio`, hecho: productos.length > 0 && productos.every(p => p.precio_venta !== null) },
    { titulo: 'Registra una factura de tu proveedor', detalle: 'Tómale foto y se llena sola', href: `/t/${slug}/facturas/nueva`, hecho: (facturas ?? 0) > 0 },
    { titulo: 'Escribe lo que te cuesta cada producto', detalle: `Para saber cuánto ganas · ${conCosto} de ${productos.length} listos`, href: `/t/${slug}/inventario?filtro=sin-costo`, hecho: productos.length > 0 && conCosto >= productos.length / 2 },
    { titulo: 'Haz tu primera venta', detalle: 'Toca “Escanear producto” aquí abajo', href: `/t/${slug}/caja`, hecho: (ventasTotales ?? 0) > 0 },
  ]

  return (
    <>
      <PrimerosPasos slug={slug} pasos={pasos} />
      <CajaClient tiendaId={tienda.id} slug={slug} productos={productos} ventasHoy={resumen} />
    </>
  )
}

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTiendaParaOperar } from '@/lib/tienda/servidor'
import FacturaDetalle, { type LineaGuardada } from '@/components/tienda/FacturaDetalle'
import type { VendePor } from '@/lib/tienda/tipos'
import { GANANCIA_POR_DEFECTO } from '@/lib/tienda/formato'

export default async function FacturaPage({ params }: PageProps<'/t/[slug]/facturas/[id]'>) {
  const { slug, id } = await params
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) notFound()

  const supabase = await createClient()
  const { data: entrada } = await supabase
    .from('entradas')
    .select('id, proveedor, numero_factura, fecha, total, entradas_lineas(id, cantidad, costo_unitario, producto_id, productos(nombre, precio_venta, vende_por, porcentaje_ganancia))')
    .eq('id', id)
    .eq('tienda_id', tienda.id)
    .maybeSingle()
  if (!entrada) notFound()

  type Fila = { id: number; cantidad: number; costo_unitario: number; producto_id: string; productos: { nombre: string; precio_venta: number | null; vende_por: VendePor; porcentaje_ganancia: number } | null }
  const lineas: LineaGuardada[] = (entrada.entradas_lineas as unknown as Fila[])
    .map(l => ({
      id: Number(l.id),
      producto_id: l.producto_id,
      nombre: l.productos?.nombre ?? 'Producto',
      vende_por: l.productos?.vende_por ?? 'unidad',
      cantidad: Number(l.cantidad),
      costo: Number(l.costo_unitario),
      porcentaje: Number(l.productos?.porcentaje_ganancia ?? GANANCIA_POR_DEFECTO),
      precio: l.productos?.precio_venta === null || l.productos?.precio_venta === undefined ? null : Number(l.productos.precio_venta),
    }))
    .sort((a, b) => a.id - b.id)

  return (
    <FacturaDetalle
      tiendaId={tienda.id}
      slug={slug}
      entradaId={entrada.id as string}
      proveedor={entrada.proveedor as string}
      numero={(entrada.numero_factura as string | null) ?? ''}
      fecha={entrada.fecha as string}
      lineas={lineas}
    />
  )
}

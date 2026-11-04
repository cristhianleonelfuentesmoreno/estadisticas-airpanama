import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProductos, getTiendaParaOperar } from '@/lib/tienda/servidor'
import FacturaNueva from '@/components/tienda/FacturaNueva'

export default async function NuevaFacturaPage({ params }: PageProps<'/t/[slug]/facturas/nueva'>) {
  const { slug } = await params
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) notFound()

  const supabase = await createClient()
  const [productos, { data: previas }] = await Promise.all([
    getProductos(tienda),
    supabase.from('entradas').select('proveedor').eq('tienda_id', tienda.id).limit(200),
  ])
  const proveedores = [...new Set((previas ?? []).map(p => p.proveedor as string))].sort()

  return <FacturaNueva tiendaId={tienda.id} slug={slug} productos={productos} proveedores={proveedores} />
}

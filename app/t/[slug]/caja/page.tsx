import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProductos, getTienda } from '@/lib/tienda/servidor'
import { inicioDeHoyPanama } from '@/lib/tienda/formato'
import CajaClient from '@/components/tienda/CajaClient'

export default async function CajaPage({ params }: PageProps<'/t/[slug]/caja'>) {
  const { slug } = await params
  const tienda = await getTienda(slug)
  if (!tienda) notFound()

  const supabase = await createClient()
  const [productos, { data: ventasHoy }] = await Promise.all([
    getProductos(tienda),
    supabase.from('ventas').select('total').eq('tienda_id', tienda.id).is('anulada_en', null).gte('creado_en', inicioDeHoyPanama()),
  ])
  const resumen = {
    cantidad: ventasHoy?.length ?? 0,
    total: (ventasHoy ?? []).reduce((s, v) => s + Number(v.total), 0),
  }

  return <CajaClient tiendaId={tienda.id} slug={slug} productos={productos} ventasHoy={resumen} />
}

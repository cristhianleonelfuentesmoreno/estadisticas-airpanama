import { notFound } from 'next/navigation'
import { getTiendaParaOperar, getVentasHoy } from '@/lib/tienda/servidor'
import VentasHoy from '@/components/tienda/VentasHoy'

export default async function VentasPage({ params }: PageProps<'/t/[slug]/ventas'>) {
  const { slug } = await params
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) notFound()
  const ventas = await getVentasHoy(tienda)
  return <VentasHoy tiendaId={tienda.id} slug={slug} ventas={ventas} />
}

import { notFound } from 'next/navigation'
import { getProductos, getTienda } from '@/lib/tienda/servidor'
import InventarioClient from '@/components/tienda/InventarioClient'

export default async function InventarioPage({ params }: PageProps<'/t/[slug]/inventario'>) {
  const { slug } = await params
  const tienda = await getTienda(slug)
  if (!tienda) notFound()
  const productos = await getProductos(tienda)
  return <InventarioClient tiendaId={tienda.id} productos={productos} />
}

import { notFound } from 'next/navigation'
import { getProductos, getTiendaParaOperar } from '@/lib/tienda/servidor'
import InventarioClient, { type Filtro } from '@/components/tienda/InventarioClient'

const FILTROS: Filtro[] = ['todos', 'por-agotarse', 'sin-contar', 'sin-costo', 'sin-precio', 'sin-codigo']

export default async function InventarioPage({ params, searchParams }: PageProps<'/t/[slug]/inventario'>) {
  const { slug } = await params
  const { filtro } = await searchParams
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) notFound()
  const productos = await getProductos(tienda)
  const inicial = FILTROS.find(f => f === filtro) ?? 'todos'
  return <InventarioClient tiendaId={tienda.id} tiendaNombre={tienda.nombre} slug={slug} productos={productos} filtroInicial={inicial} />
}

import { notFound } from 'next/navigation'
import { getProductos, getTiendaParaOperar, getUltimoProveedor } from '@/lib/tienda/servidor'
import InventarioClient, { type Filtro } from '@/components/tienda/InventarioClient'

const FILTROS: Filtro[] = ['todos', 'por-agotarse', 'sin-contar', 'sin-costo', 'sin-precio', 'sin-codigo', 'vence-pronto', 'en-pausa']

export default async function InventarioPage({ params, searchParams }: PageProps<'/t/[slug]/inventario'>) {
  const { slug } = await params
  const { filtro } = await searchParams
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) notFound()
  const [productos, proveedorDe] = await Promise.all([getProductos(tienda, { conPausados: true }), getUltimoProveedor(tienda)])
  const inicial = FILTROS.find(f => f === filtro) ?? 'todos'
  return <InventarioClient tiendaId={tienda.id} tiendaNombre={tienda.nombre} slug={slug} productos={productos} proveedorDe={proveedorDe} filtroInicial={inicial} />
}

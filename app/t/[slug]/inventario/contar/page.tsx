import { notFound } from 'next/navigation'
import { getProductos, getTiendaParaOperar } from '@/lib/tienda/servidor'
import ContarRapido from '@/components/tienda/ContarRapido'

export default async function ContarPage({ params }: PageProps<'/t/[slug]/inventario/contar'>) {
  const { slug } = await params
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) notFound()
  const productos = await getProductos(tienda)
  return <ContarRapido tiendaId={tienda.id} slug={slug} productos={productos} />
}

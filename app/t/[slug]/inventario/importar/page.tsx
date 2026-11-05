import { notFound } from 'next/navigation'
import { getTiendaParaOperar } from '@/lib/tienda/servidor'
import ImportarExcel from '@/components/tienda/ImportarExcel'

export default async function ImportarPage({ params }: PageProps<'/t/[slug]/inventario/importar'>) {
  const { slug } = await params
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) notFound()
  return <ImportarExcel tiendaId={tienda.id} slug={slug} />
}

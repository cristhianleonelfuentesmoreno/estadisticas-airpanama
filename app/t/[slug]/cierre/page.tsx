import { notFound } from 'next/navigation'
import { getCierreHoy, getResumenDia, getTienda } from '@/lib/tienda/servidor'
import CierreDia from '@/components/tienda/CierreDia'

export default async function CierrePage({ params }: PageProps<'/t/[slug]/cierre'>) {
  const { slug } = await params
  const tienda = await getTienda(slug)
  if (!tienda) notFound()
  const resumen = await getResumenDia(tienda)
  const cierre = await getCierreHoy(tienda, resumen.fecha)
  return <CierreDia tiendaId={tienda.id} slug={slug} resumen={resumen} cierre={cierre} />
}

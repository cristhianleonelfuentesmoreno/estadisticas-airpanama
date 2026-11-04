import { notFound } from 'next/navigation'
import { getProductos, getTienda } from '@/lib/tienda/servidor'
import SinFactura from '@/components/tienda/SinFactura'

export default async function SinFacturaPage({ params }: PageProps<'/t/[slug]/facturas/sin-factura'>) {
  const { slug } = await params
  const tienda = await getTienda(slug)
  if (!tienda) notFound()
  const productos = await getProductos(tienda)
  return <SinFactura tiendaId={tienda.id} slug={slug} productos={productos} />
}

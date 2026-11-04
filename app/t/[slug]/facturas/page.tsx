import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FilePlus2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getTienda } from '@/lib/tienda/servidor'
import { dinero, fechaCorta } from '@/lib/tienda/formato'

export default async function FacturasPage({ params }: PageProps<'/t/[slug]/facturas'>) {
  const { slug } = await params
  const tienda = await getTienda(slug)
  if (!tienda) notFound()

  const supabase = await createClient()
  const { data: entradas } = await supabase
    .from('entradas')
    .select('id, proveedor, numero_factura, fecha, total, entradas_lineas(count)')
    .eq('tienda_id', tienda.id)
    .order('creado_en', { ascending: false })
    .limit(50)

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/t/${slug}/facturas/nueva`}
        className="flex items-center justify-center gap-3 rounded-3xl bg-emerald-600 py-5 text-xl font-bold text-white shadow-lg"
      >
        <FilePlus2 className="h-7 w-7" /> Registrar factura
      </Link>
      <p className="px-1 text-sm text-slate-500">Lo que llega del proveedor sube el inventario y actualiza el costo de cada producto.</p>
      <ul className="divide-y divide-slate-100 rounded-3xl bg-white shadow-sm">
        {(entradas ?? []).map(e => {
          const lineas = (e.entradas_lineas as unknown as { count: number }[])[0]?.count ?? 0
          return (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">{e.proveedor}</p>
                <p className="text-xs text-slate-500">
                  {fechaCorta(`${e.fecha}T12:00:00-05:00`)} · {lineas} productos{e.numero_factura ? ` · N.º ${e.numero_factura}` : ''}
                </p>
              </div>
              <p className="font-bold text-slate-800">{dinero(Number(e.total))}</p>
            </li>
          )
        })}
        {!entradas?.length && <li className="px-4 py-10 text-center text-slate-500">Todavía no hay facturas.</li>}
      </ul>
    </div>
  )
}

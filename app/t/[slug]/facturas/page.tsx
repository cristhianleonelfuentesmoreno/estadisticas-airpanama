import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, FilePlus2, PackageOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getTiendaParaOperar } from '@/lib/tienda/servidor'
import { dinero, fechaCorta } from '@/lib/tienda/formato'

export default async function FacturasPage({ params }: PageProps<'/t/[slug]/facturas'>) {
  const { slug } = await params
  const tienda = await getTiendaParaOperar(slug)
  if (!tienda) notFound()

  const supabase = await createClient()
  const { data: entradas } = await supabase
    .from('entradas')
    .select('id, proveedor, numero_factura, fecha, total, entradas_lineas(count)')
    .eq('tienda_id', tienda.id)
    .order('creado_en', { ascending: false })
    .limit(50)

  return (
    <div className="escalonado flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <Link
          href={`/t/${slug}/facturas/nueva`}
          className="brillo flex items-center gap-4 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-lg shadow-emerald-700/30"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20"><FilePlus2 className="h-7 w-7" /></span>
          <span>
            <span className="block text-xl font-bold">Llegó mercancía con factura</span>
            <span className="text-sm text-emerald-50/90">Tómale foto y se llena sola</span>
          </span>
        </Link>
        <Link
          href={`/t/${slug}/facturas/sin-factura`}
          className="flex items-center gap-4 rounded-3xl bg-white p-5 text-emerald-900 shadow-sm ring-1 ring-slate-100 hover:ring-emerald-200"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><PackageOpen className="h-7 w-7" /></span>
          <span>
            <span className="block text-lg font-bold">Sin factura</span>
            <span className="text-sm text-slate-500">Regalo, daño, vencido o conteo</span>
          </span>
        </Link>
      </div>
      <p className="px-1 pt-1 text-sm font-semibold text-slate-500">Facturas registradas</p>
      <ul className="divide-y divide-slate-100 rounded-3xl bg-white shadow-sm">
        {(entradas ?? []).map(e => {
          const lineas = (e.entradas_lineas as unknown as { count: number }[])[0]?.count ?? 0
          return (
            <li key={e.id}>
              <Link href={`/t/${slug}/facturas/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700">{e.proveedor.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{e.proveedor}</p>
                  <p className="text-xs text-slate-500">
                    {fechaCorta(`${e.fecha}T12:00:00-05:00`)} · {lineas} productos{e.numero_factura ? ` · N.º ${e.numero_factura}` : ''}
                  </p>
                </div>
                <p className="font-bold text-slate-800">{dinero(Number(e.total))}</p>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </Link>
            </li>
          )
        })}
        {!entradas?.length && <li className="px-4 py-10 text-center text-slate-500">Todavía no hay facturas.</li>}
      </ul>
    </div>
  )
}

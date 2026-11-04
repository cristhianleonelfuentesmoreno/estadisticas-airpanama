import { notFound } from 'next/navigation'
import { CalendarDays, Download, FileSpreadsheet } from 'lucide-react'
import { getTienda } from '@/lib/tienda/servidor'
import { ultimosMeses } from '@/lib/tienda/reportes'

const INCLUYE = [
  'Ventas de cada día: efectivo, Yappy y tarjeta',
  'Ventas con ITBMS, el ITBMS cobrado y las exentas',
  'Compras con factura: proveedor y número',
  'Mercancía dañada o vencida y ventas anuladas',
]

// Lo único que ve el contador: los reportes del mes para descargar. También la puede abrir el dueño.
export default async function ContadorPage({ params }: PageProps<'/t/[slug]/contador'>) {
  const { slug } = await params
  const tienda = await getTienda(slug)
  if (!tienda) notFound()
  const [actual, ...anteriores] = ultimosMeses(12)

  return (
    <div className="escalonado mx-auto flex w-full max-w-2xl flex-col gap-4">
      <section className="brillo relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 p-6 text-white shadow-xl shadow-emerald-900/20">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lime-300/15 blur-2xl" />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><FileSpreadsheet className="h-6 w-6" /></span>
        <h2 className="mt-3 text-2xl font-black">Reportes para el contador</h2>
        <p className="mt-1 text-emerald-100/90">Un Excel por mes de {tienda.nombre}, listo para la declaración.</p>
        <ul className="mt-4 grid gap-1.5 text-sm text-emerald-50/90 sm:grid-cols-2">
          {INCLUYE.map(i => <li key={i} className="flex gap-2"><span className="text-lime-300">●</span>{i}</li>)}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="mb-3 flex items-center gap-2 font-bold text-slate-800"><CalendarDays className="h-5 w-5 text-emerald-600" /> Elige el mes</p>
        <a href={`/t/${slug}/contador/excel?mes=${actual.id}`} download className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-5 py-4 font-bold text-white shadow-lg shadow-emerald-700/25">
          <span>{actual.nombre}</span>
          <Download className="h-5 w-5" />
        </a>
        <ul className="grid gap-2 sm:grid-cols-2">
          {anteriores.map(m => (
            <li key={m.id}>
              <a href={`/t/${slug}/contador/excel?mes=${m.id}`} download className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-700 ring-1 ring-slate-100 hover:bg-emerald-50 hover:ring-emerald-200">
                {m.nombre}
                <Download className="h-4 w-4 text-emerald-600" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

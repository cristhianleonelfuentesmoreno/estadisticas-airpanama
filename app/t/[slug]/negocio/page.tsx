import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, Banknote, CreditCard, Download, FileSpreadsheet, PackageX, Smartphone, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { getEstadisticas, getTienda } from '@/lib/tienda/servidor'
import { cambioPorcentual, cantidad as fmtCantidad, dinero, rangoDe, type Periodo } from '@/lib/tienda/formato'
import type { ProductoVendido } from '@/lib/tienda/tipos'
import Cifra from '@/components/ui/Cifra'

const PERIODOS: { id: Periodo; nombre: string; anterior: string }[] = [
  { id: 'hoy', nombre: 'Hoy', anterior: 'ayer' },
  { id: 'semana', nombre: '7 días', anterior: 'los 7 días anteriores' },
  { id: 'mes', nombre: 'Este mes', anterior: 'los mismos días antes' },
]
const METODO = {
  efectivo: { nombre: 'Efectivo', Icono: Banknote, color: 'bg-emerald-500' },
  yappy: { nombre: 'Yappy', Icono: Smartphone, color: 'bg-sky-500' },
  tarjeta: { nombre: 'Tarjeta', Icono: CreditCard, color: 'bg-violet-500' },
} as const
const DIAS_PARA_QUIETOS = 14

function nombreDia(dia: string, corto: boolean) {
  const fecha = new Date(`${dia}T12:00:00-05:00`)
  return new Intl.DateTimeFormat('es-PA', corto ? { weekday: 'narrow' } : { day: 'numeric' }).format(fecha)
}

export default async function NegocioPage({ params, searchParams }: PageProps<'/t/[slug]/negocio'>) {
  const { slug } = await params
  const { periodo: p } = await searchParams
  const tienda = await getTienda(slug)
  if (!tienda) notFound()

  const periodo = PERIODOS.find(x => x.id === p) ?? PERIODOS[1]
  const { desde, hasta } = rangoDe(periodo.id)
  const e = await getEstadisticas(tienda, desde, hasta)
  const cambio = cambioPorcentual(e.total, e.total_anterior)
  const maxDia = Math.max(...e.por_dia.map(d => d.total), 0.01)
  const mejorDia = e.por_dia.reduce<(typeof e.por_dia)[number] | null>((m, d) => (d.total > 0 && (!m || d.total > m.total) ? d : m), null)
  const totalMetodos = Object.values(e.metodos).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <div className="escalonado grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-sm lg:col-span-2 lg:max-w-md">
        {PERIODOS.map(x => (
          <Link
            key={x.id}
            href={`/t/${slug}/negocio?periodo=${x.id}`}
            className={`rounded-xl py-2.5 text-center text-sm font-bold ${x.id === periodo.id ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {x.nombre}
          </Link>
        ))}
      </div>

      <section className="brillo relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 p-6 text-white shadow-xl shadow-emerald-900/20 lg:col-span-2">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-lime-300/15 blur-2xl" />
        <p className="text-sm font-medium text-emerald-100/90">Vendiste</p>
        <p className="text-5xl font-black tracking-tight"><Cifra valor={e.total} /></p>
        <p className="mt-1 text-emerald-100/90">en {e.ventas} {e.ventas === 1 ? 'venta' : 'ventas'}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-300 px-3 py-1.5 text-sm font-bold text-emerald-950">
            <Sparkles className="h-4 w-4" /> Ganaste <Cifra valor={e.ganancia} />
          </span>
          {cambio !== null && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${cambio >= 0 ? 'bg-white/15 text-white' : 'bg-red-500/90 text-white'}`}>
              {cambio >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {cambio >= 0 ? `${cambio}% más` : `${-cambio}% menos`} que {periodo.anterior}
            </span>
          )}
        </div>
        {e.ventas_sin_costo > 0 && (
          <p className="mt-3 text-xs text-emerald-100/70">
            La ganancia no cuenta {dinero(e.ventas_sin_costo)} vendidos de productos sin costo. Se completa al registrar sus facturas.
          </p>
        )}
      </section>

      {periodo.id !== 'hoy' && (
        <section className="rounded-3xl bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <p className="font-bold text-slate-800">Ventas por día</p>
            {mejorDia && <p className="text-xs text-slate-500">Mejor día: <b className="text-emerald-700">{dinero(mejorDia.total)}</b></p>}
          </div>
          <div className="relative flex h-44 items-end gap-1 lg:h-56 lg:gap-2">
            {!mejorDia && (
              <p className="absolute inset-0 flex items-center justify-center text-center text-sm text-slate-400">Aquí vas a ver cómo suben tus ventas cada día.</p>
            )}
            {e.por_dia.map((d, i) => (
              <div key={d.dia} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className={`text-[10px] font-bold text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100 ${d === mejorDia ? 'opacity-100' : ''}`}>
                  {d.total > 0 ? dinero(d.total).replace('.00', '') : ''}
                </span>
                <div
                  className={`barra-y w-full rounded-t-lg ${d === mejorDia ? 'bg-gradient-to-t from-emerald-600 to-lime-400' : d.total > 0 ? 'bg-gradient-to-t from-emerald-500 to-emerald-400' : 'bg-slate-100'}`}
                  style={{ height: `${Math.max((d.total / maxDia) * 100, 3)}%`, ['--i' as string]: i }}
                  title={`${d.dia}: ${dinero(d.total)}`}
                />
                <span className="text-[10px] text-slate-400">{nombreDia(d.dia, e.por_dia.length <= 7)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {e.ventas > 0 && (
        <section className="rounded-3xl bg-white p-5 shadow-sm lg:col-span-2">
          <p className="mb-3 font-bold text-slate-800">Cómo te pagaron</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {(['efectivo', 'yappy', 'tarjeta'] as const).map((m, i) => (
              <div key={m} className={`barra-x ${METODO[m].color}`} style={{ width: `${((e.metodos[m] ?? 0) / (totalMetodos || 1)) * 100}%`, ['--i' as string]: i }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['efectivo', 'yappy', 'tarjeta'] as const).map(m => {
              const { nombre, Icono, color } = METODO[m]
              return (
                <div key={m} className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${color}`}><Icono className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{nombre}</p>
                    <p className="font-bold text-slate-900">{dinero(e.metodos[m] ?? 0)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <ListaProductos titulo="Lo que más se vende" vacio="Cuando vendas, aquí aparece lo que más sale." productos={e.mas_vendidos} mostrar="importe" />
      <ListaProductos titulo="Lo que más ganancia te deja" vacio="Aparece cuando vendas productos que tengan costo." productos={e.mas_ganancia} mostrar="ganancia" />

      {e.perdidas > 0 && (
        <section className="flex items-center gap-3 rounded-3xl bg-red-50 p-5 text-red-800 lg:col-span-2">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <p>Perdiste <b>{dinero(e.perdidas)}</b> en mercancía dañada o vencida.</p>
        </section>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm lg:col-span-2">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-6 w-6" /></span>
          <div>
            <p className="font-bold text-slate-800">Para tu contador</p>
            <p className="text-sm text-slate-500">Un Excel con las ventas de cada día, el ITBMS, las compras con factura, lo dañado y lo anulado. Descárgalo y mándaselo.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ultimosMeses().map(m => (
            <a key={m.id} href={`/t/${slug}/negocio/contador?mes=${m.id}`} download className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25">
              <Download className="h-4 w-4" /> {m.nombre}
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm lg:col-span-2">
        <p className="flex items-center gap-2 font-bold text-slate-800"><PackageX className="h-5 w-5 text-amber-600" /> Lo que no se mueve</p>
        {e.dias_vendiendo < DIAS_PARA_QUIETOS ? (
          <p className="mt-2 text-sm text-slate-500">
            Cuando lleves {DIAS_PARA_QUIETOS} días vendiendo con ValisVentas, aquí te digo qué productos llevan un mes sin venderse y cuánta plata hay parada en ellos.
          </p>
        ) : e.quietos_cantidad === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Todo lo que tienes se vendió en el último mes. ¡Bien!</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600">
              {e.quietos_cantidad} productos no se venden hace un mes. Tienes <b>{dinero(e.quietos_valor)}</b> parados ahí.
            </p>
            <ul className="mt-3 divide-y divide-slate-100">
              {e.quietos.map(q => (
                <li key={q.nombre} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="truncate">{q.nombre}</span>
                  <span className="shrink-0 text-slate-500">{fmtCantidad(q.cantidad, q.vende_por)} · {dinero(q.valor)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

// Los últimos 3 meses en hora de Panamá: "2026-11", "2026-10", "2026-09"
function ultimosMeses(): { id: string; nombre: string }[] {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama' }).format(new Date())
  let anio = Number(hoy.slice(0, 4))
  let mes = Number(hoy.slice(5, 7))
  const meses = []
  for (let i = 0; i < 3; i++) {
    const id = `${anio}-${String(mes).padStart(2, '0')}`
    const nombre = new Intl.DateTimeFormat('es-PA', { month: 'long', timeZone: 'UTC' }).format(new Date(`${id}-15T12:00:00Z`))
    const mayuscula = nombre.charAt(0).toUpperCase() + nombre.slice(1)
    meses.push({ id, nombre: i === 0 ? `${mayuscula} (va en curso)` : mayuscula })
    mes -= 1
    if (mes === 0) { mes = 12; anio -= 1 }
  }
  return meses
}

function ListaProductos({ titulo, vacio, productos, mostrar }: { titulo: string; vacio: string; productos: ProductoVendido[]; mostrar: 'importe' | 'ganancia' }) {
  const valorDe = (p: ProductoVendido) => Math.max((mostrar === 'ganancia' ? p.ganancia : p.importe) ?? 0, 0)
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="font-bold text-slate-800">{titulo}</p>
      {productos.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{vacio}</p>
      ) : (
        <ol className="mt-2 divide-y divide-slate-100">
          {productos.map((p, i) => (
            <li key={p.nombre} className="flex items-center gap-3 py-2.5">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${i === 0 ? 'bg-lime-300 text-emerald-950' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-800">{p.nombre}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={`barra-x block h-full rounded-full ${mostrar === 'ganancia' ? 'bg-lime-400' : 'bg-emerald-500'}`}
                    style={{ width: `${(valorDe(p) / (valorDe(productos[0]) || 1)) * 100}%`, ['--i' as string]: i }}
                  />
                </span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <b className={mostrar === 'ganancia' ? 'text-emerald-700' : 'text-slate-900'}>{dinero(mostrar === 'ganancia' ? p.ganancia : p.importe)}</b>
                <span className="block text-xs text-slate-400">{fmtCantidad(p.cantidad, p.vende_por)} vendidos</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

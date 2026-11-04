import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, PackageX, TrendingDown, TrendingUp } from 'lucide-react'
import { getEstadisticas, getTienda } from '@/lib/tienda/servidor'
import { cambioPorcentual, cantidad as fmtCantidad, dinero, rangoDe, type Periodo } from '@/lib/tienda/formato'
import type { ProductoVendido } from '@/lib/tienda/tipos'

const PERIODOS: { id: Periodo; nombre: string; anterior: string }[] = [
  { id: 'hoy', nombre: 'Hoy', anterior: 'ayer' },
  { id: 'semana', nombre: '7 días', anterior: 'los 7 días anteriores' },
  { id: 'mes', nombre: 'Este mes', anterior: 'los mismos días antes' },
]
const METODO = { efectivo: 'Efectivo', yappy: 'Yappy', tarjeta: 'Tarjeta' } as const
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-sm">
        {PERIODOS.map(x => (
          <Link
            key={x.id}
            href={`/t/${slug}/negocio?periodo=${x.id}`}
            className={`rounded-xl py-2.5 text-center text-sm font-bold ${x.id === periodo.id ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
          >
            {x.nombre}
          </Link>
        ))}
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">Vendiste</p>
        <p className="text-4xl font-black text-slate-900">{dinero(e.total)}</p>
        <p className="mt-1 text-slate-600">
          y ganaste más o menos <b className="text-emerald-700">{dinero(e.ganancia)}</b> en {e.ventas} {e.ventas === 1 ? 'venta' : 'ventas'}
        </p>
        {cambio !== null && (
          <p className={`mt-3 flex items-center gap-1.5 font-semibold ${cambio >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {cambio >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            {cambio >= 0 ? `${cambio}% más` : `${-cambio}% menos`} que {periodo.anterior}
          </p>
        )}
        {e.ventas_sin_costo > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            La ganancia no cuenta {dinero(e.ventas_sin_costo)} vendidos de productos sin costo. Se completa al registrar sus facturas.
          </p>
        )}
      </section>

      {periodo.id !== 'hoy' && (
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="mb-3 font-bold text-slate-800">Ventas por día</p>
          <div className="flex h-36 items-end gap-1">
            {e.por_dia.map(d => (
              <div key={d.dia} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-md ${d.total > 0 ? 'bg-emerald-500' : 'bg-slate-100'}`}
                  style={{ height: `${Math.max((d.total / maxDia) * 100, 3)}%` }}
                  title={`${d.dia}: ${dinero(d.total)}`}
                />
                <span className="text-[10px] text-slate-400">{nombreDia(d.dia, e.por_dia.length <= 7)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {e.ventas > 0 && (
        <section className="grid grid-cols-3 gap-2 text-center">
          {(['efectivo', 'yappy', 'tarjeta'] as const).map(m => (
            <div key={m} className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-xs text-slate-500">{METODO[m]}</p>
              <p className="font-bold text-slate-900">{dinero(e.metodos[m] ?? 0)}</p>
            </div>
          ))}
        </section>
      )}

      <ListaProductos titulo="Lo que más se vende" vacio="Cuando vendas, aquí aparece lo que más sale." productos={e.mas_vendidos} mostrar="importe" />
      <ListaProductos titulo="Lo que más ganancia te deja" vacio="Aparece cuando vendas productos que tengan costo." productos={e.mas_ganancia} mostrar="ganancia" />

      {e.perdidas > 0 && (
        <section className="flex items-center gap-3 rounded-3xl bg-red-50 p-5 text-red-800">
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <p>Perdiste <b>{dinero(e.perdidas)}</b> en mercancía dañada o vencida.</p>
        </section>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm">
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

function ListaProductos({ titulo, vacio, productos, mostrar }: { titulo: string; vacio: string; productos: ProductoVendido[]; mostrar: 'importe' | 'ganancia' }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="font-bold text-slate-800">{titulo}</p>
      {productos.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{vacio}</p>
      ) : (
        <ol className="mt-2 divide-y divide-slate-100">
          {productos.map((p, i) => (
            <li key={p.nombre} className="flex items-center gap-3 py-2">
              <span className="w-5 text-center text-sm font-bold text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{p.nombre}</span>
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

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, PartyPopper, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { cerrarCaja } from '@/app/actions/tienda'
import { dinero, redondear2 } from '@/lib/tienda/formato'
import type { CierreDia as Cierre, ResumenDia } from '@/lib/tienda/tipos'

function Diferencia({ diferencia }: { diferencia: number }) {
  if (Math.abs(diferencia) < 0.005) {
    return <p className="flex items-center gap-2 text-xl font-black text-emerald-700"><CheckCircle2 className="h-6 w-6" /> ¡Cuadra perfecto!</p>
  }
  return (
    <p className={`flex items-center gap-2 text-xl font-black ${diferencia > 0 ? 'text-amber-600' : 'text-red-600'}`}>
      <TriangleAlert className="h-6 w-6" /> {diferencia > 0 ? `Sobran ${dinero(diferencia)}` : `Faltan ${dinero(-diferencia)}`}
    </p>
  )
}

export default function CierreDia({
  tiendaId, slug, resumen, cierre,
}: {
  tiendaId: string
  slug: string
  resumen: ResumenDia
  cierre: Cierre | null
}) {
  const router = useRouter()
  const [contando, setContando] = useState(!cierre)
  const [contado, setContado] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, startGuardar] = useTransition()

  const esperado = redondear2(resumen.base_caja + resumen.efectivo)
  const contadoNum = Number(contado)
  const hayConteo = contado.trim() !== '' && Number.isFinite(contadoNum) && contadoNum >= 0
  const diferencia = hayConteo ? redondear2(contadoNum - esperado) : 0

  function cerrar() {
    if (!hayConteo) return
    startGuardar(async () => {
      const r = await cerrarCaja(tiendaId, contadoNum, nota)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setContando(false)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/t/${slug}/caja`} className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
        <ArrowLeft className="h-4 w-4" /> Volver a la caja
      </Link>

      {!contando && cierre ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center shadow-sm">
          <PartyPopper className="h-12 w-12 text-emerald-600" />
          <p className="text-lg font-bold text-slate-800">Día cerrado</p>
          <p className="text-slate-600">Hoy vendiste</p>
          <p className="text-4xl font-black text-slate-900">{dinero(cierre.total_ventas)}</p>
          <p className="text-slate-600">y ganaste más o menos <b className="text-emerald-700">{dinero(cierre.ganancia)}</b></p>
          {resumen.ventas_sin_costo > 0 && (
            <p className="text-xs text-slate-400">La ganancia no cuenta {dinero(resumen.ventas_sin_costo)} de productos que todavía no tienen costo.</p>
          )}
          <div className="mt-2 w-full rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Efectivo: debía haber {dinero(cierre.efectivo_esperado)}, contaste {dinero(cierre.efectivo_contado)}</p>
            <div className="mt-1 flex justify-center"><Diferencia diferencia={cierre.diferencia} /></div>
          </div>
          {resumen.total_ventas !== cierre.total_ventas && (
            <p className="text-sm text-amber-700">Hubo ventas después del cierre. Vuelve a contar para incluirlas.</p>
          )}
          <button onClick={() => setContando(true)} className="mt-2 rounded-2xl bg-slate-100 px-5 py-3 font-semibold text-slate-700">
            Volver a contar
          </button>
        </section>
      ) : (
        <>
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Hoy vendiste</p>
            <p className="text-4xl font-black text-slate-900">{dinero(resumen.total_ventas)}</p>
            <p className="text-sm text-slate-500">en {resumen.ventas_cantidad} ventas</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Dato titulo="Efectivo" valor={dinero(resumen.efectivo)} />
              <Dato titulo="Yappy" valor={dinero(resumen.yappy)} />
              <Dato titulo="Tarjeta" valor={dinero(resumen.tarjeta)} />
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-slate-600">
              En la caja debe haber <b className="text-slate-900">{dinero(esperado)}</b>
              <span className="block text-sm text-slate-500">{dinero(resumen.base_caja)} con que abrió + {dinero(resumen.efectivo)} de ventas en efectivo</span>
            </p>
            <label className="flex flex-col gap-1 text-base font-semibold text-slate-800">
              Cuenta el efectivo y escribe cuánto hay
              <input
                value={contado}
                onChange={e => setContado(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-3xl font-black"
              />
            </label>
            {hayConteo && <Diferencia diferencia={diferencia} />}
            {hayConteo && Math.abs(diferencia) >= 0.005 && (
              <input
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="¿Sabes por qué? (opcional)"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-base"
              />
            )}
            <button
              onClick={cerrar}
              disabled={!hayConteo || guardando}
              className="rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white disabled:opacity-50"
            >
              {guardando ? 'Cerrando…' : 'Cerrar el día'}
            </button>
          </section>
        </>
      )}
    </div>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-2">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className="font-bold text-slate-900">{valor}</p>
    </div>
  )
}

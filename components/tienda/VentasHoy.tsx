'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { anularVenta } from '@/app/actions/tienda'
import { cantidad as fmtCantidad, dinero } from '@/lib/tienda/formato'
import type { VentaDelDia } from '@/lib/tienda/tipos'

const METODO = { efectivo: 'Efectivo', yappy: 'Yappy', tarjeta: 'Tarjeta' } as const
const MOTIVOS = ['Me equivoqué al cobrar', 'El cliente devolvió el producto', 'Otro motivo']

function hora(iso: string) {
  return new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export default function VentasHoy({ tiendaId, slug, ventas }: { tiendaId: string; slug: string; ventas: VentaDelDia[] }) {
  const router = useRouter()
  const [anulando, setAnulando] = useState<VentaDelDia | null>(null)
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [pendiente, startAnular] = useTransition()
  const validas = ventas.filter(v => !v.anulada_en)
  const total = validas.reduce((s, v) => s + v.total, 0)

  function confirmar() {
    if (!anulando) return
    startAnular(async () => {
      const r = await anularVenta(tiendaId, anulando.id, motivo)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Venta anulada. Los productos volvieron al inventario.')
      setAnulando(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/t/${slug}/caja`} className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
        <ArrowLeft className="h-4 w-4" /> Volver a la caja
      </Link>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Hoy</p>
        <p className="text-3xl font-black text-slate-900">{dinero(total)}</p>
        <p className="text-sm text-slate-500">{validas.length} ventas</p>
      </div>

      {ventas.length === 0 && <p className="py-10 text-center text-slate-500">Todavía no hay ventas hoy.</p>}

      <ul className="flex flex-col gap-2">
        {ventas.map(v => (
          <li key={v.id} className={`rounded-2xl bg-white p-4 shadow-sm ${v.anulada_en ? 'opacity-60' : ''}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className={`text-xl font-black ${v.anulada_en ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{dinero(v.total)}</p>
              <p className="text-sm text-slate-500">{hora(v.creado_en)} · {METODO[v.metodo_pago]}</p>
            </div>
            <ul className="mt-2 text-sm text-slate-600">
              {v.lineas.map((l, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{fmtCantidad(l.cantidad, l.vende_por)} × {l.nombre}</span>
                  <span>{dinero(l.subtotal)}</span>
                </li>
              ))}
            </ul>
            {v.anulada_en ? (
              <p className="mt-2 text-sm font-semibold text-red-600">Anulada{v.motivo_anulacion ? `: ${v.motivo_anulacion}` : ''}</p>
            ) : (
              <button
                onClick={() => { setMotivo(MOTIVOS[0]); setAnulando(v) }}
                className="mt-3 flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
              >
                <Undo2 className="h-4 w-4" /> Anular esta venta
              </button>
            )}
          </li>
        ))}
      </ul>

      {anulando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div>
              <p className="text-lg font-bold">¿Anular la venta de {dinero(anulando.total)}?</p>
              <p className="text-sm text-slate-500">Los productos vuelven al inventario y la venta deja de contar en el día. Queda anotado quién la anuló.</p>
            </div>
            <div className="flex flex-col gap-2">
              {MOTIVOS.map(m => (
                <button
                  key={m}
                  onClick={() => setMotivo(m)}
                  className={`rounded-xl px-4 py-3 text-left font-semibold ${motivo === m ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAnulando(null)} className="rounded-2xl bg-slate-100 py-3 font-semibold">No, volver</button>
              <button onClick={confirmar} disabled={pendiente} className="rounded-2xl bg-red-600 py-3 font-bold text-white disabled:opacity-50">
                {pendiente ? 'Anulando…' : 'Sí, anular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

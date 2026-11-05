'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { editarFactura } from '@/app/actions/tienda'
import { dinero, fechaCorta, margen, redondear2 } from '@/lib/tienda/formato'
import type { VendePor } from '@/lib/tienda/tipos'

export type LineaGuardada = {
  id: number
  producto_id: string
  nombre: string
  vende_por: VendePor
  cantidad: number
  costo: number
  precio: number | null
}

type Linea = LineaGuardada & { cantidadTxt: string; costoTxt: string; precioTxt: string; quitada: boolean }

function numero(t: string): number | null {
  if (t.trim() === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// Una factura ya guardada: se ve cuánto se gana con cada producto y se puede corregir
// la cantidad, el costo y el precio de venta. Al guardar, el inventario se ajusta solo.
export default function FacturaDetalle({
  tiendaId, slug, entradaId, proveedor: proveedorInicial, numero: numeroInicial, fecha, lineas: iniciales,
}: {
  tiendaId: string
  slug: string
  entradaId: string
  proveedor: string
  numero: string
  fecha: string
  lineas: LineaGuardada[]
}) {
  const router = useRouter()
  const [proveedor, setProveedor] = useState(proveedorInicial)
  const [numeroFactura, setNumeroFactura] = useState(numeroInicial)
  const comoEstaban = () => iniciales.map(l => ({
    ...l,
    cantidadTxt: String(Number(l.cantidad.toFixed(3))),
    costoTxt: String(Number(l.costo.toFixed(4))),
    precioTxt: l.precio === null ? '' : l.precio.toFixed(2),
    quitada: false,
  }))
  const [lineas, setLineas] = useState<Linea[]>(comoEstaban)
  const [guardando, startGuardar] = useTransition()

  function cambiar(id: number, cambios: Partial<Linea>) {
    setLineas(ls => ls.map(l => (l.id === id ? { ...l, ...cambios } : l)))
  }

  const vivas = lineas.filter(l => !l.quitada)
  const total = redondear2(vivas.reduce((s, l) => s + redondear2((numero(l.cantidadTxt) ?? 0) * (numero(l.costoTxt) ?? 0)), 0))
  const gananciaTotal = redondear2(vivas.reduce((s, l) => {
    const precio = numero(l.precioTxt)
    const costo = numero(l.costoTxt)
    return precio === null || costo === null ? s : s + (numero(l.cantidadTxt) ?? 0) * (precio - costo)
  }, 0))
  const sinPrecio = vivas.filter(l => numero(l.precioTxt) === null).length

  const cambiosLineas = lineas.filter(l => l.quitada || numero(l.cantidadTxt) !== l.cantidad || numero(l.costoTxt) !== l.costo)
  const cambiosPrecios = lineas.filter(l => !l.quitada && l.precioTxt.trim() !== '' && numero(l.precioTxt) !== l.precio)
  const hayCambios = cambiosLineas.length > 0 || cambiosPrecios.length > 0
    || proveedor.trim() !== proveedorInicial || numeroFactura.trim() !== numeroInicial

  function guardar() {
    if (!proveedor.trim()) {
      toast.error('Falta el proveedor')
      return
    }
    const mala = lineas.find(l => !l.quitada && (numero(l.cantidadTxt) === null || numero(l.cantidadTxt) === 0 || numero(l.costoTxt) === null))
    if (mala) {
      toast.error(`Revisa la cantidad y el costo de ${mala.nombre}`)
      return
    }
    const precioMalo = cambiosPrecios.find(l => numero(l.precioTxt) === null)
    if (precioMalo) {
      toast.error(`El precio de ${precioMalo.nombre} no es válido`)
      return
    }
    if (!vivas.length) {
      toast.error('La factura tiene que quedar con al menos un producto')
      return
    }
    startGuardar(async () => {
      const r = await editarFactura(
        tiendaId, entradaId, proveedor, numeroFactura,
        cambiosLineas.map(l => ({ id: l.id, cantidad: l.quitada ? 0 : numero(l.cantidadTxt) ?? 0, costo_unitario: numero(l.costoTxt) ?? l.costo })),
        cambiosPrecios.map(l => ({ producto_id: l.producto_id, precio_venta: numero(l.precioTxt) ?? 0 })),
      )
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Factura corregida. El inventario ya está al día.')
      router.push(`/t/${slug}/facturas`)
    })
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex items-center gap-2">
        <Link href={`/t/${slug}/facturas`} aria-label="Volver" className="rounded-full bg-white p-2 text-slate-600 shadow-sm"><ArrowLeft className="h-5 w-5" /></Link>
        <p className="text-sm text-slate-500">Factura del {fechaCorta(`${fecha}T12:00:00-05:00`)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Proveedor
          <input value={proveedor} onChange={e => setProveedor(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          N.º de factura
          <input value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} placeholder="Opcional" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total de la factura</p>
          <p className="text-2xl font-black text-slate-800">{dinero(total)}</p>
        </div>
        <div className="rounded-3xl bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ganas si vendes todo</p>
          <p className={`text-2xl font-black ${gananciaTotal < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{dinero(gananciaTotal)}</p>
          {sinPrecio > 0 && <p className="text-xs text-amber-700">{sinPrecio} sin precio de venta</p>}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {lineas.map(l => {
          const cant = numero(l.cantidadTxt)
          const costo = numero(l.costoTxt)
          const precio = numero(l.precioTxt)
          const ganas = precio !== null && costo !== null ? redondear2(precio - costo) : null
          const pct = margen(precio, costo)
          const unidad = l.vende_por === 'libra' ? 'lb' : 'c/u'
          if (l.quitada) {
            return (
              <li key={l.id} className="flex items-center gap-3 rounded-3xl bg-slate-100 px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-slate-500 line-through">{l.nombre}</p>
                <button onClick={() => cambiar(l.id, { quitada: false })} className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  <RotateCcw className="h-4 w-4" /> Devolver
                </button>
              </li>
            )
          }
          return (
            <li key={l.id} className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 font-bold text-slate-800">{l.nombre}</p>
                <button onClick={() => cambiar(l.id, { quitada: true })} aria-label={`Quitar ${l.nombre}`} className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Llegaron{l.vende_por === 'libra' ? ' (lb)' : ''}
                  <input value={l.cantidadTxt} onChange={e => cambiar(l.id, { cantidadTxt: e.target.value })} inputMode="decimal" className="rounded-xl border border-slate-200 px-2 py-2 text-base" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Costo {unidad} $
                  <input value={l.costoTxt} onChange={e => cambiar(l.id, { costoTxt: e.target.value })} inputMode="decimal" className="rounded-xl border border-slate-200 px-2 py-2 text-base" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  Vendes a $
                  <input value={l.precioTxt} onChange={e => cambiar(l.id, { precioTxt: e.target.value })} inputMode="decimal" placeholder="Sin precio" className="rounded-xl border border-slate-200 px-2 py-2 text-base" />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Total {dinero(cant !== null && costo !== null ? redondear2(cant * costo) : null)}</span>
                {ganas === null
                  ? <span className="font-semibold text-amber-700">Ponle precio para ver cuánto ganas</span>
                  : (
                    <>
                      <span className={`font-bold ${ganas <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {ganas <= 0 ? `Pierdes ${dinero(-ganas)}` : `Ganas ${dinero(ganas)}`} {unidad}{pct !== null ? ` (${pct}%)` : ''}
                      </span>
                      {cant !== null && <span className="text-slate-500">Si vendes todo: <b className="text-slate-700">{dinero(redondear2(cant * ganas))}</b></span>}
                    </>
                  )}
              </div>
            </li>
          )
        })}
      </ul>

      {hayCambios && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-6 lg:pl-64">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 rounded-3xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
            <button disabled={guardando} onClick={() => { setLineas(comoEstaban()); setProveedor(proveedorInicial); setNumeroFactura(numeroInicial) }} className="rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700">Deshacer</button>
            <button disabled={guardando} onClick={guardar} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { dinero, margen, porcentajeValido, precioParaGanar, redondear2 } from '@/lib/tienda/formato'
import type { VendePor } from '@/lib/tienda/tipos'

// Precio de venta y % de ganancia, amarrados: si cambias el %, el precio se calcula solo
// (costo / (1 - %)); si cambias el precio, se ve a qué % quedó. Con el costo también se puede
// escribir cuánto quieres ganar en dólares. Abajo dice cuánto cambió.
export default function PrecioGanancia({
  costo, vendePor, precioAntes, precio, porcentaje, onPrecio, onPorcentaje,
}: {
  costo: number | null
  vendePor: VendePor
  precioAntes: number | null
  precio: string
  porcentaje: string
  onPrecio: (v: string) => void
  onPorcentaje: (v: string) => void
}) {
  const conCosto = costo !== null && costo > 0
  // Mientras se escribe la ganancia se respeta lo que teclea; al salir vuelve a la cuenta
  const [ganasTexto, setGanasTexto] = useState<string | null>(null)

  function cambiarPrecio(v: string) {
    onPrecio(v)
    const n = Number(v)
    if (!conCosto || v.trim() === '' || !Number.isFinite(n)) return
    const pct = margen(n, costo)
    if (pct !== null && pct >= 0 && pct < 100) onPorcentaje(String(pct))
  }

  function cambiarPorcentaje(v: string) {
    onPorcentaje(v)
    const pct = porcentajeValido(v)
    if (conCosto && pct !== null) onPrecio(precioParaGanar(costo, pct).toFixed(2))
  }

  function cambiarGanas(v: string) {
    setGanasTexto(v)
    const g = Number(v)
    if (!conCosto || v.trim() === '' || !Number.isFinite(g)) return
    const nuevo = redondear2(costo + g)
    onPrecio(nuevo.toFixed(2))
    const pct = margen(nuevo, costo)
    if (pct !== null && pct >= 0 && pct < 100) onPorcentaje(String(pct))
  }

  const precioNum = precio.trim() === '' ? null : Number(precio)
  const ganas = conCosto && precioNum !== null && Number.isFinite(precioNum) ? redondear2(precioNum - costo) : null
  const diferencia = precioNum !== null && Number.isFinite(precioNum) && precioAntes !== null ? redondear2(precioNum - precioAntes) : null

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          {vendePor === 'libra' ? 'Precio por libra' : 'Precio de venta'}
          <input value={precio} onChange={e => cambiarPrecio(e.target.value)} inputMode="decimal" placeholder="0.00" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Quiero ganar (%)
          <input value={porcentaje} onChange={e => cambiarPorcentaje(e.target.value)} disabled={!conCosto} inputMode="decimal" placeholder="30" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base disabled:bg-slate-50 disabled:text-slate-400" />
        </label>
      </div>
      {conCosto && (
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Ganas por {vendePor === 'libra' ? 'libra' : 'unidad'} ($)
          <input
            value={ganasTexto ?? (ganas === null ? '' : ganas.toFixed(2))}
            onChange={e => cambiarGanas(e.target.value)}
            onBlur={() => setGanasTexto(null)}
            inputMode="decimal"
            placeholder="0.00"
            className={`rounded-xl border px-3 py-2.5 text-base font-bold ${ganas !== null && ganas <= 0 ? 'border-red-300 text-red-600' : 'border-emerald-200 text-emerald-700'}`}
          />
          {ganas !== null && ganas <= 0 && <span className="text-xs font-semibold text-red-600">Así pierdes {dinero(-ganas)} en cada {vendePor === 'libra' ? 'libra' : 'una'}.</span>}
        </label>
      )}
      {!conCosto && <p className="text-xs text-slate-400">Para calcular con el % hace falta saber cuánto te cuesta.</p>}
      {conCosto && porcentaje.trim() !== '' && porcentajeValido(porcentaje) === null && (
        <p className="text-xs font-semibold text-red-600">El % va de 0 a 99.</p>
      )}
      {diferencia !== null && diferencia !== 0 && (
        <p className={`rounded-xl px-3 py-2 text-sm ${diferencia > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          Antes {dinero(precioAntes)} → ahora <b>{dinero(precioNum)}</b> ({diferencia > 0 ? 'sube' : 'baja'} {dinero(Math.abs(diferencia))})
        </p>
      )}
    </div>
  )
}

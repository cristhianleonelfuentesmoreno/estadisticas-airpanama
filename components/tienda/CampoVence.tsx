'use client'

import { useRef } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { hoyPanama, sumarMeses, textoVence, vencePronto } from '@/lib/tienda/formato'

const RAPIDOS = [[1, '+1 mes'], [3, '+3 meses'], [6, '+6 meses'], [12, '+1 año']] as const

// Fecha de vencimiento, opcional. Al tocar el campo se abre el calendario del celular;
// los botones de abajo ponen la fecha de un toque.
export default function CampoVence({ valor, onChange, compacto = false }: { valor: string; onChange: (v: string) => void; compacto?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const hoy = hoyPanama()

  function abrir() {
    const input = ref.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      input.focus()
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`font-medium text-slate-600 ${compacto ? 'text-xs' : 'text-sm'}`}>Vence el (opcional)</span>
      <div className="flex gap-2">
        <div onClick={abrir} className="relative flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <CalendarDays className="h-5 w-5 shrink-0 text-emerald-600" />
          <input
            ref={ref}
            type="date"
            value={valor}
            min={hoy}
            onChange={e => onChange(e.target.value)}
            className="w-full cursor-pointer bg-transparent py-2.5 text-base focus:outline-none"
          />
        </div>
        {valor && (
          <button type="button" onClick={() => onChange('')} aria-label="Quitar fecha" className="rounded-xl bg-slate-100 px-3 text-slate-500">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {RAPIDOS.map(([meses, texto]) => (
          <button key={meses} type="button" onClick={() => onChange(sumarMeses(hoy, meses))} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
            {texto}
          </button>
        ))}
      </div>
      {valor && (
        <p className={`text-xs font-semibold ${vencePronto(valor, hoy) ? 'text-amber-700' : 'text-emerald-700'}`}>{textoVence(valor, hoy)}</p>
      )}
    </div>
  )
}

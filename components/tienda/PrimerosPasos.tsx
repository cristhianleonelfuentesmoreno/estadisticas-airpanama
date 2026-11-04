'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ChevronRight, Rocket, X } from 'lucide-react'

export type Paso = { titulo: string; detalle: string; href: string; hecho: boolean }

// Guía para el dueño nuevo: se va marcando sola con lo que ya hizo y se puede esconder
const clave = (slug: string) => `valisventas:pasos-ocultos:${slug}`
const avisar = new Set<() => void>()
function suscribir(fn: () => void) {
  avisar.add(fn)
  window.addEventListener('storage', fn)
  return () => {
    avisar.delete(fn)
    window.removeEventListener('storage', fn)
  }
}

export default function PrimerosPasos({ slug, pasos }: { slug: string; pasos: Paso[] }) {
  const oculto = useSyncExternalStore(suscribir, () => localStorage.getItem(clave(slug)) === '1', () => true)
  const [abierta, setAbierta] = useState(false)
  const hechos = pasos.filter(p => p.hecho).length
  const siguiente = pasos.findIndex(p => !p.hecho)
  if (oculto || hechos === pasos.length) return null

  function esconder() {
    localStorage.setItem(clave(slug), '1')
    avisar.forEach(fn => fn())
  }

  return (
    <section className="mb-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-emerald-100">
      <div className="flex items-start gap-3 bg-gradient-to-br from-emerald-50 to-lime-50 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
          <Rocket className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-emerald-950">Primeros pasos · {hechos} de {pasos.length}</p>
          <p className="text-sm text-emerald-900/70">Cada paso hace que la app te ayude más.</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="barra-x h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" style={{ width: `${(hechos / pasos.length) * 100}%` }} />
          </div>
        </div>
        <button onClick={esconder} aria-label="Esconder la guía" className="rounded-full p-1.5 text-emerald-900/50 hover:bg-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      <ol className="divide-y divide-slate-100">
        {pasos.map((p, i) => (abierta || i === siguiente) && (
          <li key={p.titulo}>
            <Link href={p.href} className={`flex items-center gap-3 px-4 py-3 hover:bg-emerald-50/60 active:scale-100 ${p.hecho ? 'opacity-60' : ''}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${p.hecho ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {p.hecho ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold ${p.hecho ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{p.titulo}</span>
                {!p.hecho && <span className="block text-sm text-slate-500">{p.detalle}</span>}
              </span>
              {!p.hecho && <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />}
            </Link>
          </li>
        ))}
      </ol>
      <button onClick={() => setAbierta(a => !a)} className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-sm font-semibold text-emerald-700 active:scale-100">
        {abierta ? 'Ver menos' : 'Ver todos los pasos'}
        <ChevronDown className={`h-4 w-4 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
    </section>
  )
}

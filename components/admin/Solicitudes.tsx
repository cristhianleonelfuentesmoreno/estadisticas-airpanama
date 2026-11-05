'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Store } from 'lucide-react'
import { toast } from 'sonner'
import { aprobarSolicitud, type Registrado } from '@/app/actions/tiendas'
import { TIPOS_NEGOCIO, type DatosSolicitud } from '@/lib/tienda/solicitud'

const fecha = (iso: string) =>
  iso ? new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: 'numeric', month: 'short' }).format(new Date(iso)) : ''

// Dueños que se registraron y esperan. Lo que contaron de su negocio llega aquí; el administrador
// lo corrige si hace falta y al aprobar se crea su tienda.
export function Solicitudes({ registrados }: { registrados: Registrado[] }) {
  const pendientes = registrados.filter(r => r.estado === 'pendiente')
  if (!pendientes.length) return null
  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-500">
        Quieren abrir su tienda <span className="rounded-full bg-amber-400 px-2 text-xs text-amber-950">{pendientes.length}</span>
      </h2>
      {pendientes.map(r => <Tarjeta key={r.usuario_id} registrado={r} />)}
    </div>
  )
}

function Tarjeta({ registrado: r }: { registrado: Registrado }) {
  const router = useRouter()
  const [datos, setDatos] = useState<DatosSolicitud>(r.solicitud ?? { negocio: '', tipo: 'Minisúper', telefono: '', vende_por_libra: false, porcentaje_ganancia: 30 })
  const [pct, setPct] = useState(String(datos.porcentaje_ganancia))
  const [aprobando, start] = useTransition()

  function aprobar(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await aprobarSolicitud(r.usuario_id, { ...datos, porcentaje_ganancia: Number(pct) })
      if (!res.ok) return void toast.error(res.error)
      toast.success(`${res.data.tienda} ya está abierta. La próxima vez que entre, va directo a su caja.`, { duration: 7000 })
      router.refresh()
    })
  }

  return (
    <form onSubmit={aprobar} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-2 ring-amber-200">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800">{(r.nombre || r.usuario).slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">{r.nombre || r.usuario}</p>
          <p className="truncate text-sm text-slate-500">{r.usuario}{r.creado_en ? ` · se registró el ${fecha(r.creado_en)}` : ''}</p>
          {!r.solicitud && <p className="mt-1 text-xs font-semibold text-amber-700">No llenó los datos de su negocio: escríbelos tú.</p>}
        </div>
        {datos.telefono && (
          <a href={`https://wa.me/${datos.telefono.replace(/\D/g, '').replace(/^(\d{8})$/, '507$1')}`} target="_blank" rel="noreferrer" aria-label="Escribirle por WhatsApp" className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Phone className="h-5 w-5" /></a>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Nombre del negocio
          <input value={datos.negocio} onChange={e => setDatos({ ...datos, negocio: e.target.value })} required minLength={2} className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Tipo
          <select value={datos.tipo} onChange={e => setDatos({ ...datos, tipo: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base">
            {TIPOS_NEGOCIO.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Teléfono
          <input value={datos.telefono} onChange={e => setDatos({ ...datos, telefono: e.target.value })} inputMode="tel" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Ganancia por defecto (%)
          <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" checked={datos.vende_por_libra} onChange={e => setDatos({ ...datos, vende_por_libra: e.target.checked })} className="h-5 w-5 accent-emerald-600" />
        Vende por libra (se le crean papa, cebolla, tomate, zanahoria y ají, sin precio)
      </label>
      <button disabled={aprobando} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">
        <Store className="h-5 w-5" /> {aprobando ? 'Creando su tienda…' : 'Aprobar y crear su tienda'}
      </button>
    </form>
  )
}

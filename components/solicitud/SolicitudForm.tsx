'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { CheckCircle2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { guardarSolicitud } from '@/app/actions/solicitud'
import { TIPOS_NEGOCIO, type DatosSolicitud } from '@/lib/tienda/solicitud'
import BotonSalir from '@/components/tienda/BotonSalir'

// Mientras su cuenta espera, la persona cuenta de su negocio. Con eso el administrador
// la aprueba de un toque y su tienda queda lista.
export default function SolicitudForm({ nombre, guardada }: { nombre: string; guardada: DatosSolicitud | null }) {
  const [editando, setEditando] = useState(guardada === null)
  const [datos, setDatos] = useState<DatosSolicitud>(guardada ?? { negocio: '', tipo: 'Minisúper', telefono: '', vende_por_libra: false, porcentaje_ganancia: 30 })
  const [pct, setPct] = useState(String(datos.porcentaje_ganancia))
  const [enviada, setEnviada] = useState(guardada !== null)
  const [guardando, start] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await guardarSolicitud({ ...datos, porcentaje_ganancia: Number(pct) })
      if (!r.ok) return void toast.error(r.error)
      setDatos({ ...datos, porcentaje_ganancia: Number(pct) })
      setEnviada(true)
      setEditando(false)
      toast.success('Listo. Te avisamos cuando tu tienda esté abierta.')
    })
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-emerald-900 to-emerald-950 px-5 py-10 text-white">
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <Image src="/icono-app.png" alt="ValisVentas" width={72} height={72} priority className="h-[72px] w-[72px] drop-shadow-xl" />
        <h1 className="text-center text-2xl font-black">{nombre ? `¡Hola, ${nombre.split(' ')[0]}!` : '¡Ya tienes tu cuenta!'}</h1>
        <p className="text-center text-emerald-100/90">
          {enviada ? 'Recibimos los datos de tu negocio. Cuando el equipo de Valis Digital te apruebe, entras directo a tu caja.' : 'Cuéntanos de tu negocio. Con esto dejamos tu tienda lista cuando te aprobemos.'}
        </p>

        {editando ? (
          <form onSubmit={enviar} className="flex w-full flex-col gap-3 rounded-3xl bg-white p-5 text-slate-800 shadow-xl">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              Nombre del negocio
              <input value={datos.negocio} onChange={e => setDatos({ ...datos, negocio: e.target.value })} required minLength={2} maxLength={80} placeholder="Mini Super La Esperanza" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              ¿Qué tipo de negocio es?
              <select value={datos.tipo} onChange={e => setDatos({ ...datos, tipo: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base">
                {TIPOS_NEGOCIO.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              Teléfono o WhatsApp
              <input value={datos.telefono} onChange={e => setDatos({ ...datos, telefono: e.target.value })} inputMode="tel" placeholder="6123-4567" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
            </label>
            <fieldset className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              <legend className="mb-1">¿Vendes cosas por libra (verdura, fruta, pollo)?</legend>
              <div className="grid grid-cols-2 gap-2">
                {[[true, 'Sí'], [false, 'No']].map(([v, t]) => (
                  <button key={String(v)} type="button" onClick={() => setDatos({ ...datos, vende_por_libra: v as boolean })} className={`rounded-xl py-2.5 font-bold ${datos.vende_por_libra === v ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{t as string}</button>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              ¿Cuánto quieres ganar en cada producto? (%)
              <input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal" placeholder="30" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
              <span className="text-xs text-slate-400">Si no sabes, deja 30. Después lo cambias producto por producto.</span>
            </label>
            <button disabled={guardando} className="mt-1 rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white disabled:opacity-50">{guardando ? 'Enviando…' : enviada ? 'Guardar cambios' : 'Enviar'}</button>
          </form>
        ) : (
          <div className="flex w-full flex-col gap-2 rounded-3xl bg-white/10 p-4">
            <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5 text-lime-300" /> {datos.negocio}</p>
            <p className="text-sm text-emerald-100/90">{datos.tipo}{datos.telefono ? ` · ${datos.telefono}` : ''} · {datos.vende_por_libra ? 'vende por libra' : 'no vende por libra'} · gana {datos.porcentaje_ganancia} %</p>
            <button onClick={() => setEditando(true)} className="mt-1 flex items-center justify-center gap-1.5 rounded-2xl bg-white/15 py-2.5 text-sm font-semibold"><Pencil className="h-4 w-4" /> Cambiar algo</button>
          </div>
        )}

        <div className="flex items-center gap-3 text-sm text-emerald-100/80">
          Salir de la cuenta <BotonSalir className="bg-white/15 text-white" />
        </div>
      </div>
    </main>
  )
}

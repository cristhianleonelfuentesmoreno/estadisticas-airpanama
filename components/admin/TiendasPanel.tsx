'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Plus, Store, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/dialogs'
import { agregarDueno, crearTienda, quitarDeTienda, type TiendaAdmin } from '@/app/actions/tiendas'

const ESTADO = {
  activo: { texto: 'Activo', clase: 'bg-emerald-100 text-emerald-800' },
  invitado: { texto: 'Invitado, aún no entra', clase: 'bg-amber-100 text-amber-800' },
  bloqueado: { texto: 'Sin acceso', clase: 'bg-red-100 text-red-700' },
} as const

const entrada = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base'

export function TiendasPanel({ tiendas }: { tiendas: TiendaAdmin[] }) {
  const router = useRouter()
  const [creando, setCreando] = useState(false)
  const [agregandoEn, setAgregandoEn] = useState<TiendaAdmin | null>(null)

  async function quitar(t: TiendaAdmin, usuarioId: string, quien: string) {
    const ok = await confirmDialog({
      title: `¿Quitar a ${quien} de ${t.nombre}?`,
      message: 'Ya no podrá entrar a esta tienda. Su cuenta y las ventas que hizo se quedan.',
      confirmText: 'Sí, quitar',
      tone: 'danger',
    })
    if (!ok) return
    const r = await quitarDeTienda(t.negocio_id, usuarioId)
    if (!r.ok) return void toast.error(r.error)
    toast.success('Listo')
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center gap-3">
        <span className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Store className="h-6 w-6" /></span>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Tiendas</h2>
          <p className="text-sm text-slate-500">Cada negocio solo ve lo suyo. Los dueños usan la app completa, sin este panel.</p>
        </div>
        <button onClick={() => setCreando(true)} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> Nueva tienda
        </button>
      </div>

      {tiendas.length === 0 && <p className="text-sm text-slate-500">Todavía no hay tiendas.</p>}

      <ul className="flex flex-col gap-3">
        {tiendas.map(t => (
          <li key={t.id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900">{t.nombre}</p>
                <p className="text-xs text-slate-500">{t.negocio} · {t.productos} productos · /{t.slug}</p>
              </div>
              <button onClick={() => setAgregandoEn(t)} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 shadow-sm">
                <UserPlus className="h-4 w-4" /> Agregar dueño
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {t.personas.length === 0 && <li className="text-sm text-amber-700">Sin dueño todavía: agrégalo para que pueda entrar.</li>}
              {t.personas.map(p => (
                <li key={p.usuario_id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-800">{p.nombre || p.email}</span>
                  {p.nombre && <span className="text-slate-500">{p.email}</span>}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p.rol === 'dueno' ? 'Dueño' : 'Cajero'}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${ESTADO[p.estado].clase}`}>{ESTADO[p.estado].texto}</span>
                  <button onClick={() => quitar(t, p.usuario_id, p.nombre || p.email)} aria-label="Quitar" className="ml-auto text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {creando && <NuevaTienda onCerrar={() => setCreando(false)} onCreada={() => { setCreando(false); router.refresh() }} />}
      {agregandoEn && <AgregarDueno tienda={agregandoEn} onCerrar={() => setAgregandoEn(null)} onListo={() => { setAgregandoEn(null); router.refresh() }} />}
    </section>
  )
}

function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onCerrar}>
      <div onClick={e => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-slate-900">{titulo}</p>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function NuevaTienda({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: () => void }) {
  const [negocio, setNegocio] = useState('')
  const [tienda, setTienda] = useState('')
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [pendiente, start] = useTransition()

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await crearTienda({ negocio, tienda })
      if (!r.ok) return void toast.error(r.error)
      if (email.trim()) {
        const d = await agregarDueno(r.data.negocio_id, { email, nombre })
        if (!d.ok) {
          toast.error(`La tienda se creó, pero: ${d.error}`)
          return onCreada()
        }
        toast.success(d.data.invitado ? `Tienda creada. Le llegó un correo a ${email} para entrar.` : `Tienda creada y ${email} ya es el dueño.`)
      } else {
        toast.success('Tienda creada. Agrégale su dueño.')
      }
      onCreada()
    })
  }

  return (
    <Ventana titulo="Nueva tienda" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Nombre del negocio
          <input required value={negocio} onChange={e => setNegocio(e.target.value)} placeholder="Ej. Abarrotería La Esperanza" className={entrada} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Nombre de la tienda (si es distinto)
          <input value={tienda} onChange={e => setTienda(e.target.value)} placeholder="Ej. La Esperanza 2" className={entrada} />
        </label>
        <p className="pt-1 text-sm font-bold text-slate-800">Dueño (opcional, se puede agregar después)</p>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo del dueño" className={entrada} />
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del dueño" className={entrada} />
        <button disabled={pendiente} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">
          {pendiente ? 'Creando…' : 'Crear tienda'}
        </button>
      </form>
    </Ventana>
  )
}

function AgregarDueno({ tienda, onCerrar, onListo }: { tienda: TiendaAdmin; onCerrar: () => void; onListo: () => void }) {
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [pendiente, start] = useTransition()

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await agregarDueno(tienda.negocio_id, { email, nombre })
      if (!r.ok) return void toast.error(r.error)
      toast.success(r.data.invitado ? `Le llegó un correo a ${email} para crear su contraseña.` : `${email} ya es dueño de ${tienda.nombre}.`)
      onListo()
    })
  }

  return (
    <Ventana titulo={`Agregar dueño a ${tienda.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo" className={entrada} />
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" className={entrada} />
        <p className="flex gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <Mail className="h-4 w-4 shrink-0" />
          Si ya tiene cuenta, entra de una vez a su tienda. Si no, le llega un correo para crear su contraseña (o puede entrar con Google usando ese correo).
        </p>
        <button disabled={pendiente} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">
          {pendiente ? 'Agregando…' : 'Agregar como dueño'}
        </button>
      </form>
    </Ventana>
  )
}

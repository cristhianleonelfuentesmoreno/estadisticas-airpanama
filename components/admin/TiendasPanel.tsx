'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, KeyRound, MessageCircle, Plus, RefreshCw, Store, UserCheck, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/dialogs'
import {
  agregarRegistrado, cambiarContrasenaDueno, crearDueno, crearTienda, quitarDeTienda, type Registrado, type TiendaAdmin,
} from '@/app/actions/tiendas'
import { limpiarUsuario } from '@/lib/cuenta'

const ESTADO = {
  activo: { texto: 'Ya entró', clase: 'bg-emerald-100 text-emerald-800' },
  invitado: { texto: 'Aún no ha entrado', clase: 'bg-amber-100 text-amber-800' },
  bloqueado: { texto: 'Sin acceso', clase: 'bg-red-100 text-red-700' },
} as const

const entrada = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base'

// Contraseña fácil de dictar por teléfono: una palabra y 4 números ("mango4827")
const PALABRAS = ['mango', 'coco', 'sol', 'luna', 'cafe', 'pan', 'rio', 'mar', 'piña', 'arroz', 'queso', 'limon', 'canela', 'miel']
function contrasenaNueva(): string {
  const n = new Uint32Array(2)
  crypto.getRandomValues(n)
  return `${PALABRAS[n[0] % PALABRAS.length].replace('ñ', 'n')}${String(1000 + (n[1] % 9000))}`
}

type Datos = { nombre: string; usuario: string; contrasena: string | null; tienda: string; yaExistia: boolean }

export function TiendasPanel({ tiendas, registrados }: { tiendas: TiendaAdmin[]; registrados: Registrado[] }) {
  const router = useRouter()
  const [creando, setCreando] = useState(false)
  const [agregandoEn, setAgregandoEn] = useState<TiendaAdmin | null>(null)
  const [nuevaClave, setNuevaClave] = useState<{ id: string; nombre: string; tienda: string } | null>(null)
  const [datos, setDatos] = useState<Datos | null>(null)

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

  function listo(d: Datos) {
    setCreando(false)
    setAgregandoEn(null)
    setNuevaClave(null)
    setDatos(d)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-slate-600">Cada negocio solo ve lo suyo. Los dueños usan la app completa de su tienda, sin este panel.</p>
        <button onClick={() => setCreando(true)} className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-3 font-bold text-white shadow">
          <Plus className="h-5 w-5" /> Nueva tienda
        </button>
      </div>

      {tiendas.length === 0 && <p className="text-slate-500">Todavía no hay tiendas.</p>}

      <ul className="flex flex-col gap-3">
        {tiendas.map(t => (
          <li key={t.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Store className="h-6 w-6" /></span>
                <div>
                  <p className="text-lg font-bold text-slate-900">{t.nombre}</p>
                  <p className="text-sm text-slate-500">{t.productos} productos</p>
                </div>
              </div>
              <button onClick={() => setAgregandoEn(t)} className="flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-2.5 font-bold text-emerald-800">
                <UserPlus className="h-5 w-5" /> Agregar dueño
              </button>
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {t.personas.length === 0 && <li className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">Sin dueño todavía: toca “Agregar dueño”.</li>}
              {t.personas.map(p => (
                <li key={p.usuario_id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{p.nombre || p.email}</p>
                    <p className="text-sm text-slate-500">Usuario: <b className="font-mono">{p.email}</b></p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO[p.estado].clase}`}>{ESTADO[p.estado].texto}</span>
                  <button
                    onClick={() => setNuevaClave({ id: p.usuario_id, nombre: p.nombre || p.email, tienda: t.nombre })}
                    className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
                  >
                    <KeyRound className="h-4 w-4" /> Nueva contraseña
                  </button>
                  <button onClick={() => quitar(t, p.usuario_id, p.nombre || p.email)} aria-label="Quitar de la tienda" className="rounded-xl p-2 text-slate-400">
                    <X className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {creando && <NuevaTienda onCerrar={() => setCreando(false)} onListo={listo} />}
      {agregandoEn && <AgregarDueno tienda={agregandoEn} registrados={registrados} onCerrar={() => setAgregandoEn(null)} onListo={listo} />}
      {nuevaClave && <NuevaContrasena persona={nuevaClave} onCerrar={() => setNuevaClave(null)} onListo={listo} />}
      {datos && <DatosParaEntrar datos={datos} onCerrar={() => setDatos(null)} />}
    </section>
  )
}

function Ventana({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center" onClick={onCerrar}>
      <div onClick={e => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-bold text-slate-900">{titulo}</p>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Nombre, usuario (sale del nombre) y contraseña (ya generada). Reutilizado en "Nueva tienda" y "Agregar dueño".
function CamposDueno({
  nombre, setNombre, usuario, setUsuario, contrasena, setContrasena,
}: {
  nombre: string; setNombre: (v: string) => void
  usuario: string; setUsuario: (v: string) => void
  contrasena: string; setContrasena: (v: string) => void
}) {
  const [usuarioTocado, setUsuarioTocado] = useState(false)
  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
        Nombre del dueño
        <input
          value={nombre}
          onChange={e => { setNombre(e.target.value); if (!usuarioTocado) setUsuario(limpiarUsuario(e.target.value.split(' ')[0] ?? '')) }}
          placeholder="Ej. Jeremías Pérez"
          className={entrada}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
        Usuario para entrar
        <input
          value={usuario}
          onChange={e => { setUsuarioTocado(true); setUsuario(e.target.value) }}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="Ej. jeremias"
          className={`${entrada} font-mono`}
        />
        <span className="text-xs text-slate-400">Sin espacios. Si prefieres, puede ser su correo.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
        Contraseña
        <div className="flex gap-2">
          <input value={contrasena} onChange={e => setContrasena(e.target.value)} autoCapitalize="none" autoCorrect="off" className={`${entrada} font-mono`} />
          <button type="button" onClick={() => setContrasena(contrasenaNueva())} aria-label="Otra contraseña" className="rounded-xl bg-slate-100 px-3 text-slate-700">
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </label>
    </>
  )
}

function NuevaTienda({ onCerrar, onListo }: { onCerrar: () => void; onListo: (d: Datos) => void }) {
  const [negocio, setNegocio] = useState('')
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState(contrasenaNueva)
  const [pendiente, start] = useTransition()

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await crearTienda({ negocio, tienda: negocio })
      if (!r.ok) return void toast.error(r.error)
      if (!nombre.trim()) {
        toast.success('Tienda creada. Agrégale su dueño.')
        return onCerrar()
      }
      const d = await crearDueno(r.data.negocio_id, { nombre, usuario, contrasena })
      if (!d.ok) {
        toast.error(`La tienda se creó, pero el dueño no: ${d.error}`)
        return onCerrar()
      }
      onListo({ nombre, usuario: d.data.usuario, contrasena: d.data.contrasena, tienda: negocio, yaExistia: d.data.yaExistia })
    })
  }

  return (
    <Ventana titulo="Nueva tienda" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Nombre de la tienda
          <input required value={negocio} onChange={e => setNegocio(e.target.value)} placeholder="Ej. Abarrotería La Esperanza" className={entrada} />
        </label>
        <p className="pt-2 text-sm font-bold text-slate-800">Su dueño</p>
        <CamposDueno nombre={nombre} setNombre={setNombre} usuario={usuario} setUsuario={setUsuario} contrasena={contrasena} setContrasena={setContrasena} />
        <button disabled={pendiente} className="mt-1 rounded-2xl bg-emerald-600 py-3.5 font-bold text-white disabled:opacity-50">
          {pendiente ? 'Creando…' : 'Crear tienda'}
        </button>
      </form>
    </Ventana>
  )
}

const ESTADO_REGISTRO = {
  pendiente: { texto: 'Esperando aprobación', clase: 'bg-amber-100 text-amber-800' },
  aprobado: { texto: 'Aprobado, sin tienda', clase: 'bg-slate-100 text-slate-600' },
  rechazado: { texto: 'Rechazado', clase: 'bg-red-100 text-red-700' },
} as const

const fechaCorta = (iso: string) =>
  iso ? new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: 'numeric', month: 'short' }).format(new Date(iso)) : ''

function AgregarDueno({
  tienda, registrados, onCerrar, onListo,
}: {
  tienda: TiendaAdmin
  registrados: Registrado[]
  onCerrar: () => void
  onListo: (d: Datos) => void
}) {
  const [modo, setModo] = useState<'nueva' | 'registrado'>(registrados.some(r => r.estado === 'pendiente') ? 'registrado' : 'nueva')
  const [agregando, startAgregar] = useTransition()
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState(contrasenaNueva)
  const [pendiente, start] = useTransition()

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await crearDueno(tienda.negocio_id, { nombre, usuario, contrasena })
      if (!r.ok) return void toast.error(r.error)
      onListo({ nombre, usuario: r.data.usuario, contrasena: r.data.contrasena, tienda: tienda.nombre, yaExistia: r.data.yaExistia })
    })
  }

  function elegir(r: Registrado) {
    startAgregar(async () => {
      const res = await agregarRegistrado(tienda.negocio_id, r.usuario_id)
      if (!res.ok) return void toast.error(res.error)
      onListo({ nombre: res.data.nombre, usuario: res.data.usuario, contrasena: null, tienda: tienda.nombre, yaExistia: true })
    })
  }

  return (
    <Ventana titulo={`Agregar dueño a ${tienda.nombre}`} onCerrar={onCerrar}>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        <button onClick={() => setModo('nueva')} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold ${modo === 'nueva' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'}`}>
          <UserPlus className="h-4 w-4" /> Crear cuenta nueva
        </button>
        <button onClick={() => setModo('registrado')} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold ${modo === 'registrado' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600'}`}>
          <UserCheck className="h-4 w-4" /> Ya se registró
          {registrados.length > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-xs text-amber-950">{registrados.length}</span>}
        </button>
      </div>

      {modo === 'nueva' ? (
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <CamposDueno nombre={nombre} setNombre={setNombre} usuario={usuario} setUsuario={setUsuario} contrasena={contrasena} setContrasena={setContrasena} />
          <button disabled={pendiente} className="mt-1 rounded-2xl bg-emerald-600 py-3.5 font-bold text-white disabled:opacity-50">
            {pendiente ? 'Creando…' : 'Crear su cuenta'}
          </button>
        </form>
      ) : registrados.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          Nadie se ha registrado sin tienda. Cuando alguien se registre en la página de inicio, aparece aquí.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">Toca a la persona: queda aprobada y como dueña de {tienda.nombre}. Entra con la contraseña que ella misma eligió.</p>
          <ul className="flex flex-col gap-2">
            {registrados.map(r => (
              <li key={r.usuario_id}>
                <button
                  disabled={agregando}
                  onClick={() => elegir(r)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{r.nombre || r.usuario}</p>
                    <p className="truncate text-sm text-slate-500">{r.usuario}{r.creado_en ? ` · se registró el ${fechaCorta(r.creado_en)}` : ''}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ESTADO_REGISTRO[r.estado].clase}`}>{ESTADO_REGISTRO[r.estado].texto}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Ventana>
  )
}

function NuevaContrasena({
  persona, onCerrar, onListo,
}: {
  persona: { id: string; nombre: string; tienda: string }
  onCerrar: () => void
  onListo: (d: Datos) => void
}) {
  const [contrasena, setContrasena] = useState(contrasenaNueva)
  const [pendiente, start] = useTransition()

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await cambiarContrasenaDueno(persona.id, contrasena)
      if (!r.ok) return void toast.error(r.error)
      onListo({ nombre: persona.nombre, usuario: r.data.usuario, contrasena, tienda: persona.tienda, yaExistia: false })
    })
  }

  return (
    <Ventana titulo={`Nueva contraseña para ${persona.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">La anterior deja de funcionar. Después te muestro los datos para pasárselos.</p>
        <div className="flex gap-2">
          <input value={contrasena} onChange={e => setContrasena(e.target.value)} autoCapitalize="none" autoCorrect="off" className={`${entrada} font-mono`} />
          <button type="button" onClick={() => setContrasena(contrasenaNueva())} aria-label="Otra contraseña" className="rounded-xl bg-slate-100 px-3 text-slate-700">
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
        <button disabled={pendiente} className="rounded-2xl bg-emerald-600 py-3.5 font-bold text-white disabled:opacity-50">
          {pendiente ? 'Guardando…' : 'Poner esta contraseña'}
        </button>
      </form>
    </Ventana>
  )
}

function DatosParaEntrar({ datos, onCerrar }: { datos: Datos; onCerrar: () => void }) {
  const direccion = typeof window !== 'undefined' ? window.location.origin : ''
  const texto = [
    `Hola ${datos.nombre.split(' ')[0]}, ya tienes ValisVentas para ${datos.tienda}.`,
    `Entra aquí: ${direccion}`,
    `Usuario: ${datos.usuario}`,
    ...(datos.contrasena ? [`Contraseña: ${datos.contrasena}`] : ['Contraseña: la misma que ya usas']),
  ].join('\n')

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <Ventana titulo={datos.yaExistia ? 'Listo: ya tenía cuenta' : 'Listo: estos son sus datos'} onCerrar={onCerrar}>
      <div className="flex flex-col gap-2 rounded-2xl bg-emerald-50 p-4">
        <Fila titulo="Dirección" valor={direccion.replace(/^https?:\/\//, '')} />
        <Fila titulo="Usuario" valor={datos.usuario} />
        <Fila titulo="Contraseña" valor={datos.contrasena ?? 'la misma que ya usa'} />
      </div>
      {datos.contrasena && <p className="text-xs text-slate-500">Guárdala o mándasela ahora: después no se puede volver a ver (sí se puede poner otra).</p>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={copiar} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 font-semibold text-slate-800">
          <Copy className="h-5 w-5" /> Copiar
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 font-bold text-white"
        >
          <MessageCircle className="h-5 w-5" /> WhatsApp
        </a>
      </div>
    </Ventana>
  )
}

function Fila({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-emerald-800">{titulo}</span>
      <b className="break-all text-right font-mono text-lg text-slate-900">{valor}</b>
    </p>
  )
}

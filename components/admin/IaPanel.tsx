'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CheckCircle2, ChevronDown, ChevronRight, KeyRound, Loader2, Sparkles, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/dialogs'
import {
  consumoIa, guardarClaveIa, guardarLimiteIa, quitarClaveIa,
  type ConfigIa, type ConsumoTienda, type PeriodoConsumo,
} from '@/app/actions/ia'

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const usd = (n: number) => (n === 0 ? '$0' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`)
const miles = (n: number) => n.toLocaleString('es-PA')

export function IaPanel({ config }: { config: ConfigIa }) {
  const router = useRouter()
  const [clave, setClave] = useState('')
  const [limite, setLimite] = useState(String(config.limite_diario))
  const [abierto, setAbierto] = useState(false)
  const [pendiente, start] = useTransition()

  function guardarClave(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const r = await guardarClaveIa(clave)
      if (!r.ok) return void toast.error(r.error)
      setClave('')
      toast.success('Clave guardada. La lectura de facturas con foto ya está activa para todas las tiendas.')
      router.refresh()
    })
  }

  async function quitar() {
    const ok = await confirmDialog({
      title: '¿Quitar la clave?',
      message: 'Ninguna tienda podrá leer facturas con foto hasta que pongas otra clave. Lo demás sigue funcionando.',
      confirmText: 'Sí, quitarla',
      tone: 'danger',
    })
    if (!ok) return
    start(async () => {
      const r = await quitarClaveIa()
      if (!r.ok) return void toast.error(r.error)
      toast.success('Clave quitada')
      router.refresh()
    })
  }

  function guardarLimite() {
    start(async () => {
      const r = await guardarLimiteIa(Number(limite))
      if (!r.ok) return void toast.error(r.error)
      toast.success('Límite guardado')
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center gap-3">
        <span className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Sparkles className="h-6 w-6" /></span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Inteligencia artificial</h2>
          <p className="text-sm text-slate-500">Lectura de facturas con foto · modelo {config.modelo}</p>
        </div>
      </div>

      <div className={`flex items-center gap-2 rounded-2xl p-3 text-sm ${config.clave_final ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
        {config.clave_final ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
        {config.clave_final
          ? <span>Clave activa, termina en <b className="font-mono">…{config.clave_final}</b>{config.clave_actualizada_en ? ` · puesta el ${fecha(config.clave_actualizada_en)}` : ''}</span>
          : <span>Sin clave: las tiendas todavía no pueden leer facturas con foto.</span>}
      </div>

      <form onSubmit={guardarClave} className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3">
          <KeyRound className="h-4 w-4 text-slate-400" />
          <input
            type="password"
            autoComplete="off"
            value={clave}
            onChange={e => setClave(e.target.value)}
            placeholder={config.clave_final ? 'Pegar una clave nueva para reemplazarla' : 'Pegar la clave de Claude (sk-ant-…)'}
            className="w-full bg-transparent py-2.5 font-mono text-sm focus:outline-none"
          />
        </label>
        <button disabled={pendiente || !clave.trim()} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {pendiente ? 'Probando…' : 'Guardar clave'}
        </button>
        {config.clave_final && (
          <button type="button" onClick={quitar} disabled={pendiente} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">
            Quitar
          </button>
        )}
      </form>
      <p className="-mt-2 text-xs text-slate-400">Se guarda cifrada. Nadie la puede volver a ver, ni desde aquí: solo los últimos 4 caracteres.</p>

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
        <span>Cada tienda puede leer hasta</span>
        <input value={limite} onChange={e => setLimite(e.target.value)} inputMode="numeric" className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-center font-bold" />
        <span>facturas al día</span>
        {limite !== String(config.limite_diario) && (
          <button onClick={guardarLimite} disabled={pendiente} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Guardar</button>
        )}
      </div>
      {config.precio && (
        <p className="text-xs text-slate-400">
          Precio del modelo: ${config.precio.entrada} por millón de tokens de entrada y ${config.precio.salida} de salida.
        </p>
      )}

      <button onClick={() => setAbierto(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 py-3 font-bold text-white shadow-md shadow-emerald-700/30">
        <BarChart3 className="h-5 w-5" /> Ver consumo por tienda
      </button>

      {abierto && <ConsumoModal onCerrar={() => setAbierto(false)} />}
    </section>
  )
}

const PERIODOS: { id: PeriodoConsumo; nombre: string }[] = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'mes', nombre: 'Este mes' },
  { id: 'mes-pasado', nombre: 'Mes pasado' },
  { id: 'todo', nombre: 'Todo' },
]

function ConsumoModal({ onCerrar }: { onCerrar: () => void }) {
  const [periodo, setPeriodo] = useState<PeriodoConsumo>('mes')
  const [datos, setDatos] = useState<ConsumoTienda[] | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [cargando, start] = useTransition()

  function cargar(p: PeriodoConsumo) {
    start(async () => setDatos(await consumoIa(p)))
  }
  useEffect(() => {
    start(async () => setDatos(await consumoIa('mes')))
  }, [])

  const total = (datos ?? []).reduce(
    (t, d) => ({ lecturas: t.lecturas + d.lecturas, costo: t.costo + d.costo_usd, entrada: t.entrada + d.tokens_entrada, salida: t.salida + d.tokens_salida }),
    { lecturas: 0, costo: 0, entrada: 0, salida: 0 },
  )

  return (
    <div className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <div onClick={e => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between bg-emerald-800 px-5 py-4 text-white">
          <div>
            <p className="text-lg font-bold">Consumo de inteligencia artificial</p>
            <p className="text-sm text-emerald-100">Lecturas de facturas con foto, por tienda</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded-full bg-white/15 p-2"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3">
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => { setPeriodo(p.id); cargar(p.id) }} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${periodo === p.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {p.nombre}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4">
          <Dato titulo="Gasto total" valor={usd(total.costo)} fuerte />
          <Dato titulo="Lecturas" valor={miles(total.lecturas)} />
          <Dato titulo="Tokens de entrada" valor={miles(total.entrada)} />
          <Dato titulo="Tokens de salida" valor={miles(total.salida)} />
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          {cargando || !datos ? (
            <p className="flex items-center justify-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Cargando…</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-2">Tienda</th>
                  <th className="px-2 text-right">Lecturas</th>
                  <th className="px-2 text-right">Fallidas</th>
                  <th className="hidden px-2 text-right sm:table-cell">Tokens</th>
                  <th className="px-2 text-right">Gasto</th>
                  <th className="hidden pl-2 sm:table-cell">Última</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datos.map(t => (
                  <Fragment key={t.tienda_id}>
                    <tr onClick={() => setAbierta(a => (a === t.tienda_id ? null : t.tienda_id))} className="cursor-pointer hover:bg-slate-50">
                      <td className="py-3 pr-2">
                        <span className="flex items-center gap-1 font-semibold text-slate-800">
                          {abierta === t.tienda_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {t.tienda}
                        </span>
                        <span className="pl-5 text-xs text-slate-400">{t.negocio}</span>
                      </td>
                      <td className="px-2 text-right font-semibold">{t.lecturas}</td>
                      <td className={`px-2 text-right ${t.fallidas ? 'text-red-600' : 'text-slate-400'}`}>{t.fallidas}</td>
                      <td className="hidden px-2 text-right text-slate-500 sm:table-cell">{miles(t.tokens_entrada + t.tokens_salida)}</td>
                      <td className="px-2 text-right font-bold text-slate-900">{usd(t.costo_usd)}</td>
                      <td className="hidden pl-2 text-slate-500 sm:table-cell">{t.ultima ? fecha(t.ultima) : '—'}</td>
                    </tr>
                    {abierta === t.tienda_id && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 p-3">
                          {t.detalle.length === 0 ? (
                            <p className="text-sm text-slate-500">Sin lecturas en este período.</p>
                          ) : (
                            <ul className="flex flex-col gap-1.5">
                              {t.detalle.map(d => (
                                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl bg-white px-3 py-2 text-xs">
                                  <span className={`font-bold ${d.ok ? 'text-emerald-700' : d.ok === false ? 'text-red-600' : 'text-slate-400'}`}>
                                    {d.ok ? '✓ Leída' : d.ok === false ? `✗ ${d.error ?? 'Falló'}` : 'En curso'}
                                  </span>
                                  <span className="text-slate-600">{fecha(d.creado_en)}</span>
                                  <span className="text-slate-600">{d.usuario}</span>
                                  {d.lineas !== null && <span className="text-slate-500">{d.lineas} productos</span>}
                                  <span className="text-slate-500">{miles(d.tokens_entrada)} + {miles(d.tokens_salida)} tokens</span>
                                  {d.duracion_ms !== null && <span className="text-slate-500">{(d.duracion_ms / 1000).toFixed(1)} s</span>}
                                  <span className="ml-auto font-bold text-slate-900">{usd(d.costo_usd)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function Dato({ titulo, valor, fuerte }: { titulo: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`text-lg font-black ${fuerte ? 'text-emerald-700' : 'text-slate-900'}`}>{valor}</p>
    </div>
  )
}

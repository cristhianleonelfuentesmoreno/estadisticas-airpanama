'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, CheckCircle2, FileSpreadsheet, ImageIcon, Loader2, Plus, TriangleAlert, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { importarExcel, importarFilas, leerInventarioConFoto, revisarExcel, revisarFilas, type FilaFoto } from '@/app/actions/importar'
import { prepararFoto } from '@/components/tienda/LeerFacturaFoto'
import { dinero } from '@/lib/tienda/formato'
import type { Paso } from '@/lib/tienda/importar'

type Vista = 'nuevo' | 'actualizar' | 'error' | 'igual'
const VISTAS: { id: Vista; nombre: string; clase: string }[] = [
  { id: 'nuevo', nombre: 'Nuevos', clase: 'bg-emerald-50 text-emerald-800' },
  { id: 'actualizar', nombre: 'Se actualizan', clase: 'bg-sky-50 text-sky-800' },
  { id: 'error', nombre: 'Con error', clase: 'bg-red-50 text-red-700' },
  { id: 'igual', nombre: 'Quedan igual', clase: 'bg-slate-100 text-slate-600' },
]

function aBase64(archivo: File): Promise<string> {
  return new Promise((ok, mal) => {
    const lector = new FileReader()
    lector.onload = () => ok(String(lector.result).split(',')[1] ?? '')
    lector.onerror = () => mal(new Error('archivo'))
    lector.readAsDataURL(archivo)
  })
}

// Subir el inventario desde Excel: 1) descargar la plantilla o usar el Excel de Inventario,
// 2) elegir el archivo y revisar qué va a pasar con cada fila, 3) importar.
export default function ImportarExcel({ tiendaId, slug }: { tiendaId: string; slug: string }) {
  const entrada = useRef<HTMLInputElement>(null)
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<{ nombre: string; base64: string } | null>(null)
  // Con foto: lo que leyó la IA, para corregir antes de revisar
  const [filasFoto, setFilasFoto] = useState<FilaFoto[] | null>(null)
  const [deFoto, setDeFoto] = useState(false)
  const [leyendo, startLeer] = useTransition()
  const [pasos, setPasos] = useState<Paso[] | null>(null)
  const [vista, setVista] = useState<Vista>('nuevo')
  const [hecho, setHecho] = useState<{ creados: number; actualizados: number; contados: number; fallaron: number } | null>(null)
  const [revisando, startRevisar] = useTransition()
  const [importando, startImportar] = useTransition()

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return void toast.error('El archivo es muy grande (más de 5 MB)')
    const base64 = await aBase64(f).catch(() => '')
    if (!base64) return void toast.error('No se pudo abrir el archivo')
    setHecho(null)
    startRevisar(async () => {
      const r = await revisarExcel(tiendaId, base64)
      if (!r.ok) {
        setPasos(null)
        setArchivo(null)
        return void toast.error(r.error, { duration: 7000 })
      }
      setArchivo({ nombre: f.name, base64 })
      setPasos(r.data.pasos)
      const primera = VISTAS.find(v => r.data.pasos.some(p => p.accion === v.id))
      setVista(primera?.id ?? 'nuevo')
    })
  }

  async function alElegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const base64 = await prepararFoto(f).catch(() => '')
    if (!base64) return void toast.error('No se pudo abrir la foto. Prueba con otra.')
    setHecho(null)
    startLeer(async () => {
      const r = await leerInventarioConFoto(tiendaId, base64, 'image/jpeg')
      if (!r.ok) return void toast.error(r.error, { duration: 7000 })
      setFilasFoto(r.data.filas)
      toast.success(`Leí ${r.data.filas.length} productos. Corrige lo que haga falta.`, { duration: 5000 })
    })
  }

  function cambiarFila(i: number, campo: keyof FilaFoto, v: string) {
    setFilasFoto(fs => fs?.map((f, j) => (j === i ? { ...f, [campo]: v } : f)) ?? null)
  }

  function revisarFoto() {
    if (!filasFoto) return
    startRevisar(async () => {
      const r = await revisarFilas(tiendaId, filasFoto)
      if (!r.ok) return void toast.error(r.error)
      setDeFoto(true)
      setArchivo({ nombre: 'Lista leída con foto', base64: '' })
      setPasos(r.data.pasos)
      setVista(VISTAS.find(v => r.data.pasos.some(p => p.accion === v.id))?.id ?? 'nuevo')
    })
  }

  function importar() {
    if (!archivo) return
    startImportar(async () => {
      const r = deFoto && filasFoto ? await importarFilas(tiendaId, filasFoto) : await importarExcel(tiendaId, archivo.base64)
      if (!r.ok) return void toast.error(r.error)
      setHecho(r.data)
      setPasos(null)
      setArchivo(null)
      setFilasFoto(null)
      setDeFoto(false)
    })
  }

  const cuenta = (v: Vista) => pasos?.filter(p => p.accion === v).length ?? 0
  const aplicar = cuenta('nuevo') + cuenta('actualizar')

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex items-center gap-2">
        <Link href={`/t/${slug}/inventario`} aria-label="Volver" className="rounded-full bg-white p-2 text-slate-600 shadow-sm"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-bold text-slate-800">Subir inventario</h1>
      </div>

      {hecho && (
        <div className="flex flex-col gap-3 rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <p className="flex items-center gap-2 text-lg font-bold text-emerald-800"><CheckCircle2 className="h-6 w-6" /> Listo</p>
          <p className="text-emerald-900">
            {hecho.creados} productos nuevos, {hecho.actualizados} actualizados y {hecho.contados} contados.
            {hecho.fallaron > 0 && <span className="font-semibold text-red-700"> {hecho.fallaron} no se pudieron guardar.</span>}
          </p>
          <Link href={`/t/${slug}/inventario`} className="rounded-2xl bg-emerald-600 py-3 text-center font-bold text-white">Ver el inventario</Link>
        </div>
      )}

      {!pasos && filasFoto && (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-sm text-slate-500">Esto leí en la foto. Corrige nombres y números, o quita lo que sobra. Después toca «Revisar».</p>
          <ul className="flex flex-col gap-2">
            {filasFoto.map((f, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex gap-2">
                  <input value={f.nombre} onChange={e => cambiarFila(i, 'nombre', e.target.value)} placeholder="Producto" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-base font-semibold" />
                  <button onClick={() => setFilasFoto(fs => fs?.filter((_, j) => j !== i) ?? null)} aria-label="Quitar" className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-5 w-5" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([['cantidad', 'Hay'], ['precio', 'Precio $'], ['costo', 'Costo $']] as const).map(([campo, etiqueta]) => (
                    <label key={campo} className="flex flex-col gap-0.5 text-xs font-medium text-slate-500">
                      {etiqueta}
                      <input value={f[campo]} onChange={e => cambiarFila(i, campo, e.target.value)} inputMode="decimal" className="rounded-xl border border-slate-200 px-2 py-2 text-base" />
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <button onClick={() => setFilasFoto(fs => [...(fs ?? []), { nombre: '', codigo: '', cantidad: '', precio: '', costo: '' }])} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 font-semibold text-emerald-800 ring-1 ring-emerald-100">
            <Plus className="h-5 w-5" /> Agregar otro
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setFilasFoto(null)} className="rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700">Cancelar</button>
            <button onClick={revisarFoto} disabled={revisando || !filasFoto.length} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{revisando ? 'Revisando…' : 'Revisar'}</button>
          </div>
        </div>
      )}

      {!pasos && !filasFoto && (
        <ol className="flex flex-col gap-3">
          <li className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm">
            <p className="font-bold text-slate-800">1. Llena el Excel</p>
            <p className="text-sm text-slate-500">Una fila por producto. Solo el nombre es obligatorio. Si pones lo que te cuesta y no el precio, el precio sale con tu % de ganancia.</p>
            <a href={`/t/${slug}/inventario/plantilla`} download className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 py-3 font-bold text-emerald-800">
              <FileSpreadsheet className="h-5 w-5" /> Descargar la plantilla
            </a>
            <p className="text-xs text-slate-400">También sirve el Excel que descargas en Inventario: lo cambias y lo vuelves a subir.</p>
          </li>
          <li className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm">
            <p className="font-bold text-slate-800">2. Súbelo</p>
            <p className="text-sm text-slate-500">Antes de guardar nada te muestro qué se crea, qué se cambia y qué tiene error.</p>
            <button onClick={() => entrada.current?.click()} disabled={revisando} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 font-bold text-white disabled:opacity-60">
              {revisando ? <><Loader2 className="h-5 w-5 animate-spin" /> Revisando…</> : <><Upload className="h-5 w-5" /> Elegir el archivo</>}
            </button>
            <input ref={entrada} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={alElegir} className="hidden" />
          </li>
          <li className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm">
            <p className="font-bold text-slate-800">O con una foto de tu lista</p>
            <p className="text-sm text-slate-500">Tómale foto al cuaderno o a la hoja donde llevas tu inventario. La leo, la corriges y la subes. Usa una de las lecturas con foto del día.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => camara.current?.click()} disabled={leyendo} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 py-3 font-bold text-emerald-800 disabled:opacity-60">
                {leyendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} {leyendo ? 'Leyendo…' : 'Tomar foto'}
              </button>
              <button onClick={() => galeria.current?.click()} disabled={leyendo} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700 disabled:opacity-60">
                <ImageIcon className="h-5 w-5" /> Elegir foto
              </button>
            </div>
            <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegirFoto} className="hidden" />
            <input ref={galeria} type="file" accept="image/*" onChange={alElegirFoto} className="hidden" />
          </li>
        </ol>
      )}

      {pasos && archivo && (
        <>
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="truncate text-sm text-slate-500">{archivo.nombre}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {VISTAS.map(v => (
                <button key={v.id} onClick={() => setVista(v.id)} className={`rounded-2xl px-3 py-2.5 text-left ring-2 ${vista === v.id ? 'ring-emerald-500' : 'ring-transparent'} ${v.clase}`}>
                  <span className="block text-2xl font-black">{cuenta(v.id)}</span>
                  <span className="text-xs font-semibold">{v.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm">
            {pasos.filter(p => p.accion === vista).slice(0, 300).map(p => (
              <li key={p.fila} className="flex items-start gap-3 px-4 py-3">
                <span className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-slate-400">fila {p.fila}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{p.nombre}</p>
                  {p.accion === 'error' && <p className="flex items-center gap-1 text-sm font-semibold text-red-600"><TriangleAlert className="h-4 w-4" /> {p.error}</p>}
                  {p.accion === 'actualizar' && <p className="text-sm text-sky-800">{p.cambios.join(' · ')}</p>}
                  {p.accion === 'nuevo' && (
                    <p className="text-sm text-slate-500">
                      {[p.codigo ?? 'sin código', p.categoria, p.vende_por === 'libra' ? 'por libra' : null,
                        p.precio !== null ? `a ${dinero(p.precio)}` : p.costo !== null ? `cuesta ${dinero(p.costo)}, precio con tu %` : 'sin precio',
                        p.disponible !== null ? `hay ${p.disponible}` : null].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </li>
            ))}
            {!cuenta(vista) && <li className="px-4 py-8 text-center text-slate-500">Nada aquí.</li>}
          </ul>
          {cuenta('error') > 0 && <p className="px-1 text-sm text-slate-500">Las filas con error no se suben. Corrígelas en el Excel y vuelve a subirlo cuando quieras.</p>}

          <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-6 lg:pl-64">
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 rounded-3xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
              <button disabled={importando} onClick={() => { setPasos(null); setArchivo(null); setDeFoto(false) }} className="rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700">{deFoto ? 'Corregir' : 'Otro archivo'}</button>
              <button disabled={importando || aplicar === 0} onClick={importar} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">
                {importando ? 'Subiendo…' : aplicar === 0 ? 'Nada que subir' : `Subir ${aplicar}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

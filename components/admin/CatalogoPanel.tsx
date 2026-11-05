'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle2, ImagePlus, ScanBarcode, Search, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { buscarParaCatalogo, guardarEnCatalogo, type CodigoSinFoto, type EntradaCatalogo } from '@/app/actions/catalogo'
import { normalizarCodigo, revisarCodigo } from '@/lib/tienda/formato'
import { CATEGORIAS } from '@/lib/tienda/categorias'
import Escaner from '@/components/tienda/Escaner'

type Foto = { base64: string; tipo: 'image/webp' | 'image/jpeg'; vista: string }

// La foto se achica en el celular (600 px, webp si el navegador puede) antes de subirla
async function prepararFoto(archivo: File): Promise<Foto> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error('foto'))
      i.src = url
    })
    const escala = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(img.naturalWidth * escala)
    lienzo.height = Math.round(img.naturalHeight * escala)
    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('foto')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, lienzo.width, lienzo.height)
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
    let vista = lienzo.toDataURL('image/webp', 0.82)
    let tipo: Foto['tipo'] = 'image/webp'
    // Safari viejo no sabe hacer webp y devuelve png: entonces va en jpg
    if (!vista.startsWith('data:image/webp')) {
      vista = lienzo.toDataURL('image/jpeg', 0.85)
      tipo = 'image/jpeg'
    }
    return { base64: vista.split(',')[1] ?? '', tipo, vista }
  } finally {
    URL.revokeObjectURL(url)
  }
}

const VACIO = { codigo: '', nombre: '', marca: '', presentacion: '', categoria: 'Abarrotes' }

export function CatalogoPanel({ catalogo, sinFoto }: { catalogo: EntradaCatalogo[]; sinFoto: CodigoSinFoto[] }) {
  const router = useRouter()
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [escaneando, setEscaneando] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [form, setForm] = useState<typeof VACIO | null>(null)
  const [imagenActual, setImagenActual] = useState<string | null>(null)
  const [foto, setFoto] = useState<Foto | null>(null)
  const [buscar, setBuscar] = useState('')
  const [cargando, startCargar] = useTransition()
  const [guardando, startGuardar] = useTransition()

  const revision = codigo.trim() ? revisarCodigo(normalizarCodigo(codigo)) : null
  const conFoto = catalogo.filter(c => c.imagen_url).length
  const lista = useMemo(() => {
    const f = buscar.trim().toLowerCase()
    return catalogo.filter(c => !f || c.nombre.toLowerCase().includes(f) || c.codigo.includes(f)).slice(0, 60)
  }, [catalogo, buscar])

  function abrir(crudo: string) {
    const c = normalizarCodigo(crudo.trim())
    setCodigo(c)
    if (!revisarCodigo(c).valido) {
      setForm(null)
      return
    }
    startCargar(async () => {
      const r = await buscarParaCatalogo(c)
      setFoto(null)
      if ('nuevo' in r) {
        setImagenActual(null)
        setForm({ ...VACIO, codigo: c, nombre: r.nombre ?? '' })
      } else {
        setImagenActual(r.imagen_url)
        setForm({ codigo: c, nombre: r.nombre, marca: r.marca ?? '', presentacion: r.presentacion ?? '', categoria: r.categoria ?? 'Abarrotes' })
      }
    })
  }

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    try {
      setFoto(await prepararFoto(archivo))
    } catch {
      toast.error('No se pudo abrir la foto. Prueba con otra.')
    }
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    startGuardar(async () => {
      const r = await guardarEnCatalogo(form, foto ? { base64: foto.base64, tipo: foto.tipo } : null)
      if (!r.ok) return void toast.error(r.error)
      toast.success(r.data.tiendasConFoto > 0
        ? `Guardado. ${r.data.tiendasConFoto === 1 ? 'Una tienda ya tiene' : `${r.data.tiendasConFoto} tiendas ya tienen`} la foto.`
        : 'Guardado en el catálogo.')
      setForm(null)
      setFoto(null)
      setCodigo('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2">
        {[['En el catálogo', catalogo.length], ['Con foto', conFoto], ['Faltan foto', sinFoto.length]].map(([t, n]) => (
          <div key={t} className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-black text-slate-800">{n}</p>
            <p className="text-xs font-semibold text-slate-500">{t}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Agregar o corregir un código</h2>
          <p className="text-sm text-slate-500">Lo que guardes aquí lo reciben todas las tiendas al escanear ese código. Solo el producto: nunca precios ni ventas.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') abrir(codigo) }}
            inputMode="numeric"
            placeholder="Código de barras"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-base tabular-nums"
          />
          <button onClick={() => abrir(codigo)} disabled={!revision?.valido || cargando} className="rounded-xl bg-emerald-600 px-4 font-bold text-white disabled:opacity-40">Abrir</button>
          <button onClick={() => setEscaneando(true)} aria-label="Escanear" className="rounded-xl bg-emerald-50 px-3 text-emerald-700"><ScanBarcode className="h-6 w-6" /></button>
        </div>
        {revision && (revision.valido
          ? <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> El código cuadra</p>
          : <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600"><XCircle className="h-4 w-4" />
              {revision.debia ? `No cuadra: el último dígito debería ser ${revision.debia}` : 'Tiene que tener 8, 12, 13 o 14 números'}
            </p>)}

        {form && (
          <form onSubmit={guardar} className="flex flex-col gap-3 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-3">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                {foto || imagenActual
                  ? <img src={foto?.vista ?? imagenActual ?? ''} alt="" className="h-full w-full object-contain" />
                  : <ImagePlus className="h-8 w-8 text-slate-300" />}
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => camara.current?.click()} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"><Camera className="h-4 w-4" /> Tomar foto</button>
                <button type="button" onClick={() => galeria.current?.click()} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Elegir del celular</button>
              </div>
              <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegir} className="hidden" />
              <input ref={galeria} type="file" accept="image/*" onChange={alElegir} className="hidden" />
            </div>
            <p className="text-xs text-slate-500">De frente, con fondo claro y que se lea la marca.</p>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              Nombre
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Coca-Cola 2 L" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                Marca
                <input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                Presentación
                <input value={form.presentacion} onChange={e => setForm({ ...form, presentacion: e.target.value })} placeholder="2 L, 75 g…" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              Categoría
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base">
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setForm(null); setFoto(null) }} className="rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700">Cancelar</button>
              <button disabled={guardando} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-slate-500">Les falta foto · los que más tiendas usan primero</h2>
        <ul className="divide-y divide-slate-100 rounded-3xl bg-white shadow-sm">
          {sinFoto.slice(0, 40).map(s => (
            <li key={s.codigo}>
              <button onClick={() => abrir(s.codigo)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{s.nombre}</p>
                  <p className="text-xs tabular-nums text-slate-500">{s.codigo}{s.enCatalogo ? ' · ya está, sin foto' : ''}</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{s.tiendas} {s.tiendas === 1 ? 'tienda' : 'tiendas'}</span>
              </button>
            </li>
          ))}
          {!sinFoto.length && <li className="px-4 py-8 text-center text-slate-500">Todos los códigos de las tiendas ya tienen foto.</li>}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-slate-500">En el catálogo</h2>
        <label className="flex items-center gap-2 rounded-2xl bg-white px-3 shadow-sm">
          <Search className="h-5 w-5 text-slate-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre o código" className="w-full bg-transparent py-3 text-base focus:outline-none" />
          {buscar && <button onClick={() => setBuscar('')} aria-label="Borrar búsqueda"><X className="h-5 w-5 text-slate-400" /></button>}
        </label>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map(c => (
            <li key={c.codigo}>
              <button onClick={() => abrir(c.codigo)} className="flex w-full flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center shadow-sm hover:ring-2 hover:ring-emerald-200">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                  {c.imagen_url ? <img src={c.imagen_url} alt="" className="h-full w-full object-contain" /> : <ImagePlus className="h-6 w-6 text-slate-300" />}
                </div>
                <p className="line-clamp-2 text-sm font-semibold text-slate-800">{c.nombre}</p>
                <p className="text-[11px] tabular-nums text-slate-400">{c.codigo}</p>
              </button>
            </li>
          ))}
          {!lista.length && <li className="col-span-full px-4 py-8 text-center text-slate-500">{buscar ? 'No hay nada con esa búsqueda.' : 'Todavía no hay productos en el catálogo.'}</li>}
        </ul>
      </div>

      {escaneando && <Escaner titulo="Escanea el producto" onCodigo={c => { setEscaneando(false); abrir(c) }} onCerrar={() => setEscaneando(false)} />}
    </div>
  )
}

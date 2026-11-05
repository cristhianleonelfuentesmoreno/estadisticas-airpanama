'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Barcode, Camera, CheckCircle2, ChevronDown, ImagePlus, Package, Plus, ScanBarcode, Search, X, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { guardarEnCatalogo, type DatosCatalogo, type ItemCatalogo } from '@/app/actions/catalogo'
import { normalizarCodigo, revisarCodigo } from '@/lib/tienda/formato'
import { CATEGORIAS } from '@/lib/tienda/categorias'
import Escaner from '@/components/tienda/Escaner'

type Foto = { base64: string; tipo: 'image/webp' | 'image/jpeg'; vista: string }
type Filtro = 'todos' | 'falta-foto' | 'completos' | 'sin-codigo'

const FILTROS: { id: Filtro; nombre: string }[] = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'falta-foto', nombre: 'Les falta foto' },
  { id: 'completos', nombre: 'Completos' },
  { id: 'sin-codigo', nombre: 'Sin código (sueltos)' },
]

function cumple(i: ItemCatalogo, f: Filtro): boolean {
  if (f === 'falta-foto') return !i.imagen_url
  if (f === 'completos') return Boolean(i.imagen_url)
  if (f === 'sin-codigo') return i.codigo === null
  return true
}

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

const VACIO: DatosCatalogo = { id: null, codigo: '', nombre: '', marca: '', presentacion: '', categoria: 'Abarrotes', por_paquete: '', vende_suelto: false }

function datosDe(i: ItemCatalogo): DatosCatalogo {
  return {
    id: i.id, codigo: i.codigo ?? '', nombre: i.nombre, marca: i.marca ?? '', presentacion: i.presentacion ?? '',
    categoria: i.categoria ?? 'Abarrotes', por_paquete: i.por_paquete ? String(i.por_paquete) : '', vende_suelto: i.vende_suelto,
  }
}

export function CatalogoPanel({ items }: { items: ItemCatalogo[] }) {
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [categoria, setCategoria] = useState('')
  const [eligiendo, setEligiendo] = useState(false)
  // Abierto: qué se edita. conCodigo = producto nuevo con código que todavía hay que escribir o escanear
  const [abierto, setAbierto] = useState<{ datos: DatosCatalogo; imagen: string | null; conCodigo: boolean } | null>(null)

  const completos = items.filter(i => i.imagen_url).length
  const lista = useMemo(() => {
    const f = buscar.trim().toLowerCase()
    return items.filter(i => cumple(i, filtro) && (!categoria || i.categoria === categoria)
      && (!f || i.nombre.toLowerCase().includes(f) || (i.codigo ?? '').includes(f) || (i.marca ?? '').toLowerCase().includes(f)))
  }, [items, buscar, filtro, categoria])
  const hayFiltro = filtro !== 'todos' || categoria !== ''
  const categoriasUsadas = CATEGORIAS.filter(c => items.some(i => i.categoria === c))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {([['Productos', items.length], ['Completos', completos], ['Les falta foto', items.length - completos]] as const).map(([t, n]) => (
          <div key={t} className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-black text-slate-800">{n}</p>
            <p className="text-xs font-semibold text-slate-500">{t}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-white px-3 shadow-sm ring-1 ring-slate-100">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar nombre, marca o código" className="w-full min-w-0 bg-transparent py-3 text-base focus:outline-none" />
          {buscar && <button onClick={() => setBuscar('')} aria-label="Borrar búsqueda"><X className="h-5 w-5 text-slate-400" /></button>}
        </label>
        <button onClick={() => setEligiendo(true)} className={`flex shrink-0 items-center gap-1 rounded-2xl px-4 font-bold shadow-sm ${hayFiltro ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-100'}`}>
          Filtro <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {hayFiltro && (
        <div className="-mt-2 flex items-center gap-2 px-1 text-sm text-slate-600">
          <span className="font-semibold">{[FILTROS.find(f => f.id === filtro)?.nombre, categoria].filter(Boolean).join(' · ')}</span>
          <button onClick={() => { setFiltro('todos'); setCategoria('') }} className="font-semibold text-emerald-700 underline">Quitar filtro</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setAbierto({ datos: VACIO, imagen: null, conCodigo: true })} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 font-bold text-white shadow-sm">
          <Plus className="h-5 w-5" /> Con código
        </button>
        <button onClick={() => setAbierto({ datos: { ...VACIO, categoria: 'Especias y condimentos', vende_suelto: true }, imagen: null, conCodigo: false })} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-200">
          <Plus className="h-5 w-5" /> Sin código (sueltos)
        </button>
      </div>

      <p className="px-1 text-sm font-semibold text-slate-500">{lista.length} {lista.length === 1 ? 'producto' : 'productos'}</p>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm">
        {lista.slice(0, 200).map(i => (
          <li key={i.id ?? i.codigo ?? i.nombre}>
            <button onClick={() => setAbierto({ datos: datosDe(i), imagen: i.imagen_url, conCodigo: false })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${i.codigo ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
                {i.codigo ? <Barcode className="h-5 w-5" /> : <Package className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{i.nombre}</p>
                <p className="truncate text-xs text-slate-500">
                  {[i.codigo ?? 'Sin código', i.categoria, i.vende_suelto && i.por_paquete ? `paquete de ${i.por_paquete}, se vende suelto` : null, i.tiendas ? `${i.tiendas} ${i.tiendas === 1 ? 'tienda' : 'tiendas'}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              {i.imagen_url
                ? <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Completo</span>
                : <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">Falta foto</span>}
            </button>
          </li>
        ))}
        {!lista.length && <li className="px-4 py-10 text-center text-slate-500">{buscar || hayFiltro ? 'No hay nada con esa búsqueda o ese filtro.' : 'Todavía no hay productos.'}</li>}
      </ul>

      {eligiendo && (
        <div onClick={() => setEligiendo(false)} className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center">
          <div onClick={e => e.stopPropagation()} className="flex max-h-[85dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
            <p className="text-lg font-bold">¿Qué quieres ver?</p>
            <div className="grid grid-cols-2 gap-2">
              {FILTROS.map(f => (
                <button key={f.id} onClick={() => { setFiltro(f.id); setEligiendo(false) }} className={`rounded-2xl px-3 py-3 text-left font-semibold ${filtro === f.id ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
                  {f.nombre}
                  <span className={`block text-sm font-normal ${filtro === f.id ? 'text-white/80' : 'text-slate-500'}`}>{items.filter(i => cumple(i, f.id)).length}</span>
                </button>
              ))}
            </div>
            {categoriasUsadas.length > 0 && (
              <>
                <p className="pt-1 text-sm font-semibold text-slate-500">Por categoría</p>
                <div className="flex flex-wrap gap-2">
                  {categoriasUsadas.map(c => (
                    <button key={c} onClick={() => { setCategoria(categoria === c ? '' : c); setEligiendo(false) }} className={`rounded-full px-3 py-2 text-sm font-semibold ${categoria === c ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{c}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {abierto && <Ficha key={abierto.datos.id ?? abierto.datos.codigo} inicial={abierto} items={items} onCerrar={() => setAbierto(null)} />}
    </div>
  )
}

// Hoja para agregar o corregir un producto del catálogo
function Ficha({ inicial, items, onCerrar }: {
  inicial: { datos: DatosCatalogo; imagen: string | null; conCodigo: boolean }
  items: ItemCatalogo[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [datos, setDatos] = useState(inicial.datos)
  const [imagen, setImagen] = useState(inicial.imagen)
  const [foto, setFoto] = useState<Foto | null>(null)
  const [escaneando, setEscaneando] = useState(false)
  const [guardando, start] = useTransition()
  // El código solo se escribe en uno nuevo; en uno que ya existe queda fijo
  const pideCodigo = inicial.conCodigo
  const revision = datos.codigo.trim() ? revisarCodigo(normalizarCodigo(datos.codigo)) : null

  // Si el código que escribe ya está en la lista, se llena con lo que hay
  function ponerCodigo(crudo: string) {
    const c = crudo.replace(/\D/g, '')
    const ya = revisarCodigo(normalizarCodigo(c)).valido ? items.find(i => i.codigo === normalizarCodigo(c)) : undefined
    if (ya) {
      setDatos(datosDe(ya))
      setImagen(ya.imagen_url)
    } else {
      setDatos(d => ({ ...d, codigo: c }))
    }
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
    if (pideCodigo && !revision?.valido) return void toast.error('Revisa el código de barras')
    start(async () => {
      const r = await guardarEnCatalogo(datos, foto ? { base64: foto.base64, tipo: foto.tipo } : null)
      if (!r.ok) return void toast.error(r.error)
      toast.success(r.data.tiendasConFoto > 0
        ? `Guardado. ${r.data.tiendasConFoto === 1 ? 'Una tienda ya tiene' : `${r.data.tiendasConFoto} tiendas ya tienen`} la foto.`
        : 'Guardado en el catálogo.')
      onCerrar()
      router.refresh()
    })
  }

  return (
    <div className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center">
      <form onSubmit={guardar} className="flex max-h-[92dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-900">{datos.id ? 'Corregir producto' : pideCodigo ? 'Producto con código' : datos.codigo ? 'Producto de las tiendas' : 'Producto sin código'}</p>
            <p className="text-sm text-slate-500">{datos.codigo && !pideCodigo ? <span className="font-mono">{datos.codigo}</span> : pideCodigo ? 'Escanéalo o escribe el número' : 'Especias, granos y lo que se vende suelto'}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
        </div>

        {pideCodigo && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <input value={datos.codigo} onChange={e => ponerCodigo(e.target.value)} inputMode="numeric" placeholder="Código de barras" autoFocus className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-base tabular-nums" />
              <button type="button" onClick={() => setEscaneando(true)} aria-label="Escanear" className="rounded-xl bg-emerald-50 px-3 text-emerald-700"><ScanBarcode className="h-6 w-6" /></button>
            </div>
            {revision && (revision.valido
              ? <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> El código cuadra</p>
              : <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600"><XCircle className="h-4 w-4" />
                  {revision.debia ? `No cuadra: el último dígito debería ser ${revision.debia}` : 'Tiene que tener 8, 12, 13 o 14 números'}
                </p>)}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200">
            {foto || imagen ? <img src={foto?.vista ?? imagen ?? ''} alt="" className="h-full w-full object-contain" /> : <ImagePlus className="h-7 w-7 text-slate-300" />}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <button type="button" onClick={() => camara.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white"><Camera className="h-4 w-4" /> {foto || imagen ? 'Cambiar foto' : 'Tomar foto'}</button>
            <button type="button" onClick={() => galeria.current?.click()} className="rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700">Elegir del celular</button>
          </div>
          <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegir} className="hidden" />
          <input ref={galeria} type="file" accept="image/*" onChange={alElegir} className="hidden" />
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Nombre
          <input value={datos.nombre} onChange={e => setDatos({ ...datos, nombre: e.target.value })} required placeholder={datos.codigo || pideCodigo ? 'Coca-Cola 2 L' : 'Comino molido'} className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Marca
            <input value={datos.marca} onChange={e => setDatos({ ...datos, marca: e.target.value })} placeholder="Opcional" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Tamaño
            <input value={datos.presentacion} onChange={e => setDatos({ ...datos, presentacion: e.target.value })} placeholder="2 L, 5 g…" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Categoría
          <select value={datos.categoria} onChange={e => setDatos({ ...datos, categoria: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base">
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>

        <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">¿Llega en paquete y se vende suelto?</p>
          <div className="grid grid-cols-2 gap-2">
            {([[false, 'No, entero'], [true, 'Sí, suelto']] as const).map(([v, t]) => (
              <button key={t} type="button" onClick={() => setDatos({ ...datos, vende_suelto: v })} className={`rounded-xl py-2.5 text-sm font-bold ${datos.vende_suelto === v ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{t}</button>
            ))}
          </div>
          {datos.vende_suelto && (
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              ¿Cuántas unidades trae el paquete?
              <input value={datos.por_paquete} onChange={e => setDatos({ ...datos, por_paquete: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="24" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base" />
              <span className="text-xs text-slate-400">La tienda compra el paquete y vende cada sobrecito por separado.</span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={onCerrar} className="rounded-2xl bg-slate-100 py-3 font-semibold text-slate-700">Cancelar</button>
          <button disabled={guardando} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>

      {escaneando && <Escaner titulo="Escanea el producto" onCodigo={c => { setEscaneando(false); ponerCodigo(c) }} onCerrar={() => setEscaneando(false)} />}
    </div>
  )
}

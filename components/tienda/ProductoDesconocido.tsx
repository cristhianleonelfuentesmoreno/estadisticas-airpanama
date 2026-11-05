'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Link2, Loader2, PackagePlus, Search, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { actualizarProducto, buscarEnCatalogoAbierto, crearProducto } from '@/app/actions/tienda'
import { dinero, GANANCIA_POR_DEFECTO } from '@/lib/tienda/formato'
import type { Producto, SugerenciaProducto, VendePor } from '@/lib/tienda/tipos'
import { CATEGORIAS, SIN_ITBMS } from '@/lib/tienda/categorias'

// Se abre cuando se escanea un código que la tienda no tiene.
// Opción 1: crear el producto (con nombre, marca y foto del catálogo abierto si existe).
// Opción 2: es un producto que ya está (del cuaderno, sin código) y solo se le asigna el código.
// Sin código (codigo = null) solo crea: frutas, verduras, pan y lo que no trae código de barras.
export default function ProductoDesconocido({
  tiendaId,
  codigo,
  nombreInicial = '',
  vendePorInicial = 'unidad',
  productos,
  onListo,
  onCerrar,
}: {
  tiendaId: string
  codigo: string | null
  nombreInicial?: string
  vendePorInicial?: VendePor
  productos: Producto[]
  onListo: (producto: Producto) => void
  onCerrar: () => void
}) {
  const [modo, setModo] = useState<'nuevo' | 'existente'>('nuevo')
  const [buscando, setBuscando] = useState(codigo !== null)
  const [sugerencia, setSugerencia] = useState<SugerenciaProducto | null>(null)
  const [nombre, setNombre] = useState(nombreInicial)
  const [marca, setMarca] = useState('')
  const [presentacion, setPresentacion] = useState('')
  const [categoria, setCategoria] = useState(codigo === null ? 'Verduras y frutas' : 'Abarrotes')
  const [vendePor, setVendePor] = useState<VendePor>(vendePorInicial)
  const [precio, setPrecio] = useState('')
  const [filtro, setFiltro] = useState('')
  const [guardando, startGuardar] = useTransition()

  useEffect(() => {
    if (codigo === null) return
    let vigente = true
    buscarEnCatalogoAbierto(codigo).then(s => {
      if (!vigente) return
      setSugerencia(s)
      if (s?.nombre) setNombre(s.nombre)
      if (s?.marca) setMarca(s.marca)
      if (s?.presentacion) setPresentacion(s.presentacion)
      setBuscando(false)
    })
    return () => {
      vigente = false
    }
  }, [codigo])

  const sinCodigo = useMemo(() => {
    const f = filtro.trim().toLowerCase()
    return productos
      .filter(p => !p.codigo_barras && (!f || p.nombre.toLowerCase().includes(f)))
      .slice(0, 40)
  }, [productos, filtro])

  function crear(e: React.FormEvent) {
    e.preventDefault()
    const precioNum = precio.trim() === '' ? null : Number(precio)
    if (precioNum !== null && (!Number.isFinite(precioNum) || precioNum < 0)) {
      toast.error('El precio no es válido')
      return
    }
    startGuardar(async () => {
      const datos = {
        nombre, marca: marca || null, presentacion: presentacion || null, categoria, codigo_barras: codigo,
        vende_por: vendePor, precio_venta: precioNum, itbms: SIN_ITBMS.has(categoria) ? 0 : 7,
        imagen_url: sugerencia?.imagen_url ?? null,
      }
      const r = await crearProducto(tiendaId, datos)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Producto creado')
      onListo({
        id: r.data.id, nombre: nombre.trim(), marca: datos.marca, presentacion: datos.presentacion, categoria,
        codigo_barras: codigo, vende_por: vendePor, precio_venta: precioNum, costo: null, itbms: datos.itbms,
        imagen_url: datos.imagen_url, stock_minimo: null, activo: true, porcentaje_ganancia: GANANCIA_POR_DEFECTO, vence_el: null, stock: 0, contado: false,
      })
    })
  }

  function asignar(p: Producto) {
    if (codigo === null) return
    startGuardar(async () => {
      const r = await actualizarProducto(tiendaId, p.id, {
        codigo_barras: codigo,
        ...(sugerencia?.imagen_url && !p.imagen_url ? { imagen_url: sugerencia.imagen_url } : {}),
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`Código guardado en ${p.nombre}`)
      onListo({ ...p, codigo_barras: codigo, imagen_url: p.imagen_url ?? sugerencia?.imagen_url ?? null })
    })
  }

  return (
    <div className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <p className="text-lg font-bold text-slate-900">Producto nuevo</p>
            {codigo !== null
              ? <p className="font-mono text-sm text-slate-500">{codigo}</p>
              : <p className="text-sm text-slate-500">Sin código de barras: frutas, verduras, pan…</p>}
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded-full bg-slate-100 p-2">
            <X className="h-5 w-5" />
          </button>
        </div>

        {codigo !== null && <div className="grid grid-cols-2 gap-2 p-3">
          <button
            onClick={() => setModo('nuevo')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${modo === 'nuevo' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            <PackagePlus className="h-4 w-4" /> Crear nuevo
          </button>
          <button
            onClick={() => setModo('existente')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${modo === 'existente' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            <Link2 className="h-4 w-4" /> Ya lo tengo
          </button>
        </div>}

        {modo === 'nuevo' ? (
          <form onSubmit={crear} className={`flex flex-col gap-3 overflow-y-auto px-4 pb-4 ${codigo === null ? 'pt-4' : ''}`}>
            {codigo === null ? null : buscando ? (
              <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando en el catálogo abierto…
              </p>
            ) : sugerencia ? (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3">
                {sugerencia.imagen_url && (
                  <img src={sugerencia.imagen_url} alt="" className="h-16 w-16 rounded-lg bg-white object-contain" />
                )}
                <p className="flex items-center gap-1 text-sm text-emerald-800">
                  <Sparkles className="h-4 w-4 shrink-0" /> Encontrado en el catálogo abierto. Revisa y confirma.
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                No está en el catálogo abierto. Escribe los datos una vez y queda guardado para siempre.
              </p>
            )}

            <Campo etiqueta="Nombre">
              <input required value={nombre} onChange={e => setNombre(e.target.value)} className={entrada} placeholder="Ej. Kachitos clásico" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Marca">
                <input value={marca} onChange={e => setMarca(e.target.value)} className={entrada} />
              </Campo>
              <Campo etiqueta="Tamaño">
                <input value={presentacion} onChange={e => setPresentacion(e.target.value)} className={entrada} placeholder="Ej. 42 g" />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Categoría">
                <select value={categoria} onChange={e => setCategoria(e.target.value)} className={entrada}>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Se vende por">
                <select value={vendePor} onChange={e => setVendePor(e.target.value as VendePor)} className={entrada}>
                  <option value="unidad">Unidad</option>
                  <option value="libra">Libra (pesa)</option>
                </select>
              </Campo>
            </div>
            <Campo etiqueta={vendePor === 'libra' ? 'Precio por libra' : 'Precio de venta'}>
              <input value={precio} onChange={e => setPrecio(e.target.value)} inputMode="decimal" className={entrada} placeholder="0.00" />
            </Campo>
            <button disabled={guardando || !nombre.trim()} className="mt-1 rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar producto'}
            </button>
          </form>
        ) : (
          <div className="flex min-h-0 flex-col gap-2 px-4 pb-4">
            <p className="text-sm text-slate-600">Elige el producto del inventario al que pertenece este código.</p>
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar" className="w-full bg-transparent py-2.5 focus:outline-none" />
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {sinCodigo.map(p => (
                <li key={p.id}>
                  <button disabled={guardando} onClick={() => asignar(p)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                    <span className="font-medium text-slate-800">{p.nombre}</span>
                    <span className="text-sm text-slate-500">{dinero(p.precio_venta)}</span>
                  </button>
                </li>
              ))}
              {!sinCodigo.length && <li className="py-6 text-center text-sm text-slate-500">No hay productos sin código con ese nombre.</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

const entrada = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base focus:border-emerald-500 focus:outline-none'

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
      {etiqueta}
      {children}
    </label>
  )
}

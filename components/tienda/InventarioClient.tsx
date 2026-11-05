'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Barcode, CalendarClock, ChevronDown, CircleDollarSign, ClipboardList, FileSpreadsheet, Hash, MessageCircle, Package, PackagePlus, Pause, Play, ScanBarcode, Search, SlidersHorizontal, Tag, Wallet, X, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { actualizarProducto } from '@/app/actions/tienda'
import { anotarUso } from '@/app/actions/uso'
import { cantidad as fmtCantidad, dinero, gananciaPorUnidad, margen, MINIMO_POR_DEFECTO, normalizarCodigo, hoyPanama, porAgotarse, porcentajeValido, precioParaGanar, textoPedido, textoVence, vencePronto, agruparPorProveedor } from '@/lib/tienda/formato'
import type { Producto } from '@/lib/tienda/tipos'
import Escaner, { precargarEscaner } from '@/components/tienda/Escaner'
import ProductoDesconocido from '@/components/tienda/ProductoDesconocido'
import FotoProducto from '@/components/tienda/FotoProducto'
import { CATEGORIAS } from '@/lib/tienda/categorias'
import PrecioGanancia from '@/components/tienda/PrecioGanancia'
import CampoVence from '@/components/tienda/CampoVence'

export type Filtro = 'todos' | 'por-agotarse' | 'sin-contar' | 'sin-costo' | 'sin-precio' | 'sin-codigo' | 'vence-pronto' | 'en-pausa'

// Los filtros salen en una hoja con botones grandes; cada uno dice cuántos productos tiene
const FILTROS: { id: Filtro; nombre: string; Icono: LucideIcon }[] = [
  { id: 'todos', nombre: 'Todos', Icono: Package },
  { id: 'por-agotarse', nombre: 'Para pedir', Icono: ClipboardList },
  { id: 'vence-pronto', nombre: 'Vence pronto', Icono: CalendarClock },
  { id: 'sin-contar', nombre: 'Sin contar', Icono: Hash },
  { id: 'sin-costo', nombre: 'Sin costo', Icono: CircleDollarSign },
  { id: 'sin-precio', nombre: 'Sin precio', Icono: Tag },
  { id: 'sin-codigo', nombre: 'Sin código', Icono: Barcode },
  { id: 'en-pausa', nombre: 'En pausa', Icono: Pause },
]

export default function InventarioClient({
  tiendaId, tiendaNombre, slug, productos: iniciales, proveedorDe, filtroInicial = 'todos',
}: {
  tiendaId: string
  tiendaNombre: string
  slug: string
  productos: Producto[]
  // Último proveedor que trajo cada producto: la lista de pedido sale separada por proveedor
  proveedorDe: Record<string, string>
  filtroInicial?: Filtro
}) {
  const router = useRouter()
  const [productos, setProductos] = useState(iniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial)
  const [categoria, setCategoria] = useState('')
  const [eligiendo, setEligiendo] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  // Código escaneado que no está; '' = producto nuevo sin código
  const [desconocido, setDesconocido] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<Producto | null>(null)
  useEffect(precargarEscaner, [])

  // Los que están en pausa no cuentan para nada: solo salen en su filtro
  const activos = useMemo(() => productos.filter(p => p.activo), [productos])
  const hoy = hoyPanama()

  const cumple = useCallback((p: Producto, f: Filtro) => {
    if (f === 'en-pausa') return !p.activo
    if (!p.activo) return false
    if (f === 'por-agotarse') return porAgotarse(p)
    if (f === 'vence-pronto') return vencePronto(p.vence_el, hoy)
    if (f === 'sin-contar') return !p.contado
    if (f === 'sin-precio') return p.precio_venta === null
    if (f === 'sin-codigo') return !p.codigo_barras
    if (f === 'sin-costo') return p.costo === null
    return true
  }, [hoy])

  const cuantos = useMemo(() => new Map(FILTROS.map(f => [f.id, productos.filter(p => cumple(p, f.id)).length])), [productos, cumple])
  const categorias = useMemo(() => {
    const n = new Map<string, number>()
    for (const p of activos) n.set(p.categoria ?? 'Sin categoría', (n.get(p.categoria ?? 'Sin categoría') ?? 0) + 1)
    return [...n.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [activos])

  const resumen = useMemo(() => ({
    total: activos.length,
    venta: activos.reduce((s, p) => s + Math.max(p.stock, 0) * (p.precio_venta ?? 0), 0),
    porAgotarse: activos.filter(porAgotarse).length,
    sinCosto: activos.filter(p => p.costo === null).length,
  }), [activos])

  const lista = useMemo(() => {
    const f = busqueda.trim().toLowerCase()
    return productos.filter(p => {
      if (!cumple(p, filtro)) return false
      if (categoria && (p.categoria ?? 'Sin categoría') !== categoria) return false
      return !f || p.nombre.toLowerCase().includes(f) || (p.categoria ?? '').toLowerCase().includes(f) || p.codigo_barras === f
    })
  }, [productos, busqueda, filtro, categoria, cumple])

  const alEscanear = useCallback((codigo: string) => {
    setEscaneando(false)
    const c = normalizarCodigo(codigo)
    const p = productos.find(x => x.codigo_barras && normalizarCodigo(x.codigo_barras) === c)
    if (p) setAbierto(p)
    else setDesconocido(c)
  }, [productos])

  function reemplazar(p: Producto) {
    setProductos(ps => ps.some(x => x.id === p.id) ? ps.map(x => (x.id === p.id ? p : x)) : [...ps, p])
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="escalonado grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <button onClick={() => setFiltro('todos')} className="text-left">
          <Tarjeta titulo="Productos" valor={String(resumen.total)} Icono={Package} tono="emerald" activa={filtro === 'todos'} />
        </button>
        <button onClick={() => setFiltro('por-agotarse')} className="text-left">
          <Tarjeta titulo="Para pedir" valor={String(resumen.porAgotarse)} Icono={ClipboardList} tono={resumen.porAgotarse > 0 ? 'lime' : 'emerald'} activa={filtro === 'por-agotarse'} nota={resumen.porAgotarse > 0 ? 'Tu lista de pedido' : 'Tienes de todo'} />
        </button>
        <button onClick={() => setFiltro('sin-costo')} className="text-left">
          <Tarjeta titulo="Sin costo" valor={String(resumen.sinCosto)} Icono={CircleDollarSign} tono={resumen.sinCosto > 0 ? 'amber' : 'emerald'} activa={filtro === 'sin-costo'} nota={resumen.sinCosto > 0 ? 'Escríbelo y ve cuánto ganas' : 'Ya sabes cuánto ganas en todo'} />
        </button>
        <Tarjeta titulo="Tu mercancía vale" valor={dinero(resumen.venta)} Icono={Wallet} tono="lime" nota="a precio de venta" />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-4 shadow-sm">
          <Search className="h-5 w-5 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto o categoría" className="w-full bg-transparent py-3.5 focus:outline-none" />
        </div>
        <button onClick={() => setEscaneando(true)} aria-label="Escanear" className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-4 text-white shadow-md shadow-emerald-700/30">
          <ScanBarcode className="h-6 w-6" />
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setEligiendo(true)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-emerald-100 hover:ring-emerald-300">
          <SlidersHorizontal className="h-5 w-5 shrink-0 text-emerald-700" />
          <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
            {FILTROS.find(f => f.id === filtro)?.nombre}{categoria ? ` · ${categoria}` : ''} <span className="font-normal text-slate-500">({lista.length})</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
        </button>
        {(filtro !== 'todos' || categoria) && (
          <button onClick={() => { setFiltro('todos'); setCategoria('') }} aria-label="Quitar filtro" className="rounded-2xl bg-slate-100 px-4 text-slate-600">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button onClick={() => setDesconocido('')} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
          <PackagePlus className="h-5 w-5" /> Producto sin código
        </button>
        <a href={`/t/${slug}/inventario/excel`} download className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-100 hover:ring-emerald-300">
          <FileSpreadsheet className="h-5 w-5" /> Descargar todo en Excel
        </a>
      </div>

      {filtro === 'por-agotarse' && lista.length > 0 && (
        <div className="flex flex-col gap-2">
          {agruparPorProveedor(lista, proveedorDe).map(({ proveedor, productos: ps }) => (
            <a
              key={proveedor ?? 'sin-proveedor'}
              href={`https://wa.me/?text=${encodeURIComponent(textoPedido(ps, tiendaNombre, proveedor ?? undefined))}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => void anotarUso(tiendaId, 'whatsapp_pedido', { productos: ps.length, con_proveedor: proveedor !== null })}
              className="flex items-center gap-3 rounded-2xl bg-[#25D366] px-4 py-3 text-white shadow"
            >
              <MessageCircle className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{proveedor ? `Pedido a ${proveedor}` : 'Sin proveedor todavía'}</span>
                <span className="block text-xs text-white/85">{ps.length} {ps.length === 1 ? 'producto' : 'productos'} · mandar por WhatsApp</span>
              </span>
            </a>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-slate-100 shadow-sm lg:grid-cols-2">
        {lista.map(p => (
          <li key={p.id} className="bg-white">
            <button onClick={() => setAbierto(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50/60 active:scale-100">
              <FotoProducto producto={p} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{p.nombre}</p>
                <p className="truncate text-xs text-slate-500">{p.activo ? '' : 'En pausa · '}{p.categoria ?? 'Sin categoría'}{p.codigo_barras ? ` · ${p.codigo_barras}` : ''}</p>
                {p.vence_el && vencePronto(p.vence_el, hoy) && (
                  <p className="mt-0.5 w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{textoVence(p.vence_el, hoy)}</p>
                )}
              </div>
              <div className="text-right">
                <p className={`ml-auto w-fit rounded-full px-2 py-0.5 text-sm font-bold ${!p.contado ? 'bg-slate-100 text-slate-400' : p.stock <= 0 ? 'bg-red-50 text-red-600' : porAgotarse(p) ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-800'}`}>{p.contado ? fmtCantidad(p.stock, p.vende_por) : 'sin contar'}</p>
                <p className="text-xs text-slate-500">{dinero(p.precio_venta)}{p.vende_por === 'libra' ? '/lb' : ''}</p>
                {gananciaPorUnidad(p.precio_venta, p.costo) === null
                  ? <p className="text-[11px] font-semibold text-amber-600">sin costo</p>
                  : <p className={`text-[11px] font-semibold ${(gananciaPorUnidad(p.precio_venta, p.costo) ?? 0) <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>ganas {dinero(gananciaPorUnidad(p.precio_venta, p.costo))}</p>}
              </div>
            </button>
          </li>
        ))}
        {!lista.length && <li className="bg-white px-4 py-10 text-center text-slate-500 lg:col-span-2">No hay productos con ese filtro.</li>}
      </ul>

      {eligiendo && (
        <div onClick={() => setEligiendo(false)} className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center">
          <div onClick={e => e.stopPropagation()} className="flex max-h-[88dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <p className="text-lg font-bold">¿Qué quieres ver?</p>
              <button onClick={() => setEligiendo(false)} aria-label="Cerrar" className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FILTROS.map(({ id, nombre, Icono }) => {
                const n = cuantos.get(id) ?? 0
                return (
                  <button
                    key={id}
                    onClick={() => { setFiltro(id); setEligiendo(false); void anotarUso(tiendaId, 'filtro', { filtro: id }) }}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3.5 text-left ${filtro === id ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/25' : 'bg-slate-50 text-slate-800 hover:bg-emerald-50'}`}
                  >
                    <Icono className={`h-5 w-5 shrink-0 ${filtro === id ? 'text-lime-300' : 'text-emerald-700'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{nombre}</span>
                      <span className={`block text-xs ${filtro === id ? 'text-emerald-100' : 'text-slate-500'}`}>{n} {n === 1 ? 'producto' : 'productos'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {categorias.length > 1 && (
              <>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Por categoría</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['', activos.length] as const, ...categorias].map(([c, n]) => (
                    <button
                      key={c || 'todas'}
                      onClick={() => { setCategoria(c); setEligiendo(false); void anotarUso(tiendaId, 'filtro', { categoria: c }) }}
                      className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-3 text-left text-sm ${categoria === c ? 'bg-emerald-700 font-semibold text-white' : 'bg-slate-50 text-slate-700 hover:bg-emerald-50'}`}
                    >
                      <span className="truncate">{c || 'Todas'}</span>
                      <span className={`shrink-0 text-xs ${categoria === c ? 'text-emerald-100' : 'text-slate-400'}`}>{n}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {escaneando && <Escaner titulo="Escanea para buscar" onCodigo={alEscanear} onCerrar={() => setEscaneando(false)} />}

      {desconocido !== null && (
        <ProductoDesconocido
          tiendaId={tiendaId}
          desde="inventario"
          codigo={desconocido || null}
          productos={productos}
          onCerrar={() => setDesconocido(null)}
          onListo={p => {
            reemplazar(p)
            setDesconocido(null)
            setAbierto(p)
          }}
        />
      )}

      {abierto && (
        <FichaProducto
          tiendaId={tiendaId}
          producto={abierto}
          onCerrar={() => setAbierto(null)}
          onGuardado={p => {
            reemplazar(p)
            setAbierto(null)
          }}
        />
      )}
    </div>
  )
}

const TONOS = {
  emerald: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-600',
  amber: 'bg-amber-100 text-amber-700',
  lime: 'bg-lime-200 text-emerald-900',
} as const

function Tarjeta({ titulo, valor, nota, Icono, tono, activa }: { titulo: string; valor: string; nota?: string; Icono: LucideIcon; tono: keyof typeof TONOS; activa?: boolean }) {
  return (
    <div className={`h-full rounded-2xl bg-white p-3 shadow-sm ring-2 transition-shadow lg:p-4 ${activa ? 'ring-emerald-500' : 'ring-transparent'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{titulo}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${TONOS[tono]}`}><Icono className="h-4 w-4" /></span>
      </div>
      <p className={`text-xl font-black lg:text-2xl ${tono === 'red' ? 'text-red-600' : 'text-slate-900'}`}>{valor}</p>
      {nota && <p className="text-[11px] text-slate-400">{nota}</p>}
    </div>
  )
}

function FichaProducto({
  tiendaId, producto, onCerrar, onGuardado,
}: {
  tiendaId: string
  producto: Producto
  onCerrar: () => void
  onGuardado: (p: Producto) => void
}) {
  const [nombre, setNombre] = useState(producto.nombre)
  const [precio, setPrecio] = useState(producto.precio_venta?.toString() ?? '')
  const [costo, setCosto] = useState(producto.costo !== null ? String(Number(producto.costo.toFixed(4))) : '')
  const [codigo, setCodigo] = useState(producto.codigo_barras ?? '')
  const [minimo, setMinimo] = useState(producto.stock_minimo?.toString() ?? '')
  const [categoria, setCategoria] = useState(producto.categoria ?? '')
  const [vence, setVence] = useState(producto.vence_el ?? '')
  // Con precio y costo se muestra lo que de verdad gana hoy; si no, lo que quiere ganar
  const [porcentaje, setPorcentaje] = useState(String(margen(producto.precio_venta, producto.costo) ?? producto.porcentaje_ganancia))
  const [escaneando, setEscaneando] = useState(false)
  const [guardando, startGuardar] = useTransition()
  const precioNum = precio.trim() === '' ? null : Number(precio)
  const costoNum = costo.trim() === '' ? null : Number(costo)
  const costoValido = costoNum !== null && Number.isFinite(costoNum) && costoNum >= 0 ? costoNum : null
  const ganancia = margen(precioNum, costoValido)
  const ganas = gananciaPorUnidad(precioNum, costoValido)

  // Si cambia el costo, el precio se queda y se ve el % nuevo; sin precio, lo calcula con el %
  function cambiarCosto(v: string) {
    setCosto(v)
    const c = Number(v)
    if (v.trim() === '' || !Number.isFinite(c) || c <= 0) return
    if (precioNum !== null && Number.isFinite(precioNum)) {
      const pct = margen(precioNum, c)
      if (pct !== null && pct >= 0 && pct < 100) setPorcentaje(String(pct))
    } else {
      const pct = porcentajeValido(porcentaje)
      if (pct !== null) setPrecio(precioParaGanar(c, pct).toFixed(2))
    }
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (precioNum !== null && (!Number.isFinite(precioNum) || precioNum < 0)) {
      toast.error('El precio no es válido')
      return
    }
    if (costoNum !== null && costoValido === null) {
      toast.error('El costo no es válido')
      return
    }
    const minimoNum = minimo.trim() === '' ? null : Number(minimo)
    if (minimoNum !== null && (!Number.isFinite(minimoNum) || minimoNum < 0)) {
      toast.error('El aviso de "quedan pocos" no es válido')
      return
    }
    const pct = porcentajeValido(porcentaje) ?? producto.porcentaje_ganancia
    startGuardar(async () => {
      const r = await actualizarProducto(tiendaId, producto.id, { nombre, precio_venta: precioNum, costo: costoValido, codigo_barras: codigo || null, stock_minimo: minimoNum, categoria: categoria || null, porcentaje_ganancia: pct, vence_el: vence || null }, 'inventario')
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Guardado')
      onGuardado({ ...producto, nombre: nombre.trim(), precio_venta: precioNum, costo: costoValido, codigo_barras: codigo.trim() || null, stock_minimo: minimoNum, categoria: categoria || null, porcentaje_ganancia: pct, vence_el: vence || null })
    })
  }

  // Pausar no borra nada: el producto deja de salir en la caja y en los pedidos hasta que se vuelva a activar
  function cambiarPausa() {
    startGuardar(async () => {
      const r = await actualizarProducto(tiendaId, producto.id, { activo: !producto.activo }, 'inventario')
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(producto.activo ? `${producto.nombre} quedó en pausa. Ya no sale en la caja.` : `${producto.nombre} se vuelve a vender`)
      onGuardado({ ...producto, activo: !producto.activo })
    })
  }

  return (
    <div className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center">
      <form onSubmit={guardar} className="flex max-h-[92dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="flex items-start gap-3">
          <FotoProducto producto={producto} tamano="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight">{producto.nombre}</p>
            <p className="text-sm text-slate-500">{producto.categoria}{producto.marca ? ` · ${producto.marca}` : ''}{producto.presentacion ? ` · ${producto.presentacion}` : ''}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Dato titulo="En tienda" valor={producto.contado ? fmtCantidad(producto.stock, producto.vende_por) : 'Sin contar'} alerta={producto.contado && producto.stock <= 0} />
          <Dato titulo="Te cuesta" valor={dinero(costoValido)} />
          <Dato titulo="Lo vendes a" valor={dinero(precioNum)} />
        </div>

        <div className={`rounded-2xl p-4 text-center ${ganas === null ? 'bg-amber-50 text-amber-800' : ganas <= 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
          {ganas === null ? (
            <p className="flex items-center justify-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Escribe cuánto te cuesta para saber cuánto ganas.
            </p>
          ) : ganas <= 0 ? (
            <p className="text-lg font-black">¡Pierdes {dinero(-ganas)} en cada {producto.vende_por === 'libra' ? 'libra' : 'unidad'}!</p>
          ) : (
            <>
              <p className="text-2xl font-black">Ganas {dinero(ganas)}</p>
              <p className="text-sm">por {producto.vende_por === 'libra' ? 'libra' : 'unidad'} · {ganancia}% de lo que cobras</p>
            </>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Me cuesta (por {producto.vende_por === 'libra' ? 'libra' : 'unidad'})
          <input value={costo} onChange={e => cambiarCosto(e.target.value)} inputMode="decimal" placeholder="Lo que pagaste al proveedor por cada una" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
          <span className="text-xs text-slate-400">También se actualiza solo cuando registras una factura de este producto.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Nombre
          <input value={nombre} onChange={e => setNombre(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
        <PrecioGanancia
          costo={costoValido}
          vendePor={producto.vende_por}
          precioAntes={producto.precio_venta}
          precio={precio}
          porcentaje={porcentaje}
          onPrecio={setPrecio}
          onPorcentaje={setPorcentaje}
        />
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Categoría
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base">
            {!categoria && <option value="">Sin categoría</option>}
            {categoria && !CATEGORIAS.includes(categoria) && <option>{categoria}</option>}
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <CampoVence valor={vence} onChange={setVence} />
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Avísame cuando queden
          <input value={minimo} onChange={e => setMinimo(e.target.value)} inputMode="decimal" placeholder={`${MINIMO_POR_DEFECTO} (si lo dejas vacío)`} className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Código de barras
          <div className="flex gap-2">
            <input value={codigo} onChange={e => setCodigo(e.target.value)} inputMode="numeric" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-base" />
            <button type="button" onClick={() => setEscaneando(true)} aria-label="Escanear código" className="rounded-xl bg-emerald-600 px-3 text-white">
              <ScanBarcode className="h-5 w-5" />
            </button>
          </div>
        </label>

        <button disabled={guardando} className="rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white disabled:opacity-50">
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" disabled={guardando} onClick={cambiarPausa} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50">
          {producto.activo
            ? <><Pause className="h-4 w-4" /> Ya no lo vendo: ponerlo en pausa</>
            : <><Play className="h-4 w-4" /> Volver a venderlo</>}
        </button>
      </form>
      {escaneando && (
        <Escaner titulo="Escanea el código de este producto" onCodigo={c => { setCodigo(normalizarCodigo(c)); setEscaneando(false) }} onCerrar={() => setEscaneando(false)} />
      )}
    </div>
  )
}

function Dato({ titulo, valor, alerta }: { titulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-2">
      <p className="text-[11px] text-slate-500">{titulo}</p>
      <p className={`font-bold ${alerta ? 'text-red-600' : 'text-slate-900'}`}>{valor}</p>
    </div>
  )
}

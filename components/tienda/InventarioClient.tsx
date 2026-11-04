'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CircleDollarSign, ClipboardList, FileSpreadsheet, MessageCircle, Package, ScanBarcode, Search, Wallet, X, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { actualizarProducto } from '@/app/actions/tienda'
import { cantidad as fmtCantidad, dinero, gananciaPorUnidad, margen, MINIMO_POR_DEFECTO, normalizarCodigo, porAgotarse, precioParaGanar, textoPedido } from '@/lib/tienda/formato'
import type { Producto } from '@/lib/tienda/tipos'
import Escaner, { precargarEscaner } from '@/components/tienda/Escaner'
import ProductoDesconocido from '@/components/tienda/ProductoDesconocido'
import FotoProducto from '@/components/tienda/FotoProducto'

export type Filtro = 'todos' | 'por-agotarse' | 'sin-contar' | 'sin-costo' | 'sin-precio' | 'sin-codigo'

export default function InventarioClient({
  tiendaId, tiendaNombre, slug, productos: iniciales, filtroInicial = 'todos',
}: {
  tiendaId: string
  tiendaNombre: string
  slug: string
  productos: Producto[]
  filtroInicial?: Filtro
}) {
  const router = useRouter()
  const [productos, setProductos] = useState(iniciales)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial)
  const [escaneando, setEscaneando] = useState(false)
  const [desconocido, setDesconocido] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<Producto | null>(null)
  useEffect(precargarEscaner, [])

  const resumen = useMemo(() => ({
    total: productos.length,
    venta: productos.reduce((s, p) => s + Math.max(p.stock, 0) * (p.precio_venta ?? 0), 0),
    porAgotarse: productos.filter(porAgotarse).length,
    sinCosto: productos.filter(p => p.costo === null).length,
  }), [productos])

  const lista = useMemo(() => {
    const f = busqueda.trim().toLowerCase()
    return productos.filter(p => {
      if (filtro === 'por-agotarse' && !porAgotarse(p)) return false
      if (filtro === 'sin-contar' && p.contado) return false
      if (filtro === 'sin-precio' && p.precio_venta !== null) return false
      if (filtro === 'sin-codigo' && p.codigo_barras) return false
      if (filtro === 'sin-costo' && p.costo !== null) return false
      return !f || p.nombre.toLowerCase().includes(f) || (p.categoria ?? '').toLowerCase().includes(f) || p.codigo_barras === f
    })
  }, [productos, busqueda, filtro])

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

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([['todos', 'Todos'], ['por-agotarse', 'Para pedir'], ['sin-contar', 'Sin contar'], ['sin-costo', 'Sin costo'], ['sin-precio', 'Sin precio'], ['sin-codigo', 'Sin código']] as const).map(([f, nombre]) => (
          <button key={f} onClick={() => setFiltro(f)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${filtro === f ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/25' : 'bg-white text-slate-600 shadow-sm hover:bg-emerald-50'}`}>
            {nombre}
          </button>
        ))}
      </div>

      <a href={`/t/${slug}/inventario/excel`} download className="flex items-center justify-center gap-2 self-end rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-100 hover:ring-emerald-300">
        <FileSpreadsheet className="h-5 w-5" /> Descargar todo en Excel
      </a>

      {filtro === 'por-agotarse' && lista.length > 0 && (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(textoPedido(lista, tiendaNombre))}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-base font-bold text-white shadow"
        >
          <MessageCircle className="h-5 w-5" /> Mandar la lista de pedido por WhatsApp
        </a>
      )}

      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-slate-100 shadow-sm lg:grid-cols-2">
        {lista.map(p => (
          <li key={p.id} className="bg-white">
            <button onClick={() => setAbierto(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50/60 active:scale-100">
              <FotoProducto producto={p} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{p.nombre}</p>
                <p className="truncate text-xs text-slate-500">{p.categoria ?? 'Sin categoría'}{p.codigo_barras ? ` · ${p.codigo_barras}` : ''}</p>
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

      {escaneando && <Escaner titulo="Escanea para buscar" onCodigo={alEscanear} onCerrar={() => setEscaneando(false)} />}

      {desconocido && (
        <ProductoDesconocido
          tiendaId={tiendaId}
          codigo={desconocido}
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
  const [escaneando, setEscaneando] = useState(false)
  const [guardando, startGuardar] = useTransition()
  const precioNum = precio.trim() === '' ? null : Number(precio)
  const costoNum = costo.trim() === '' ? null : Number(costo)
  const costoValido = costoNum !== null && Number.isFinite(costoNum) && costoNum >= 0 ? costoNum : null
  const ganancia = margen(precioNum, costoValido)
  const ganas = gananciaPorUnidad(precioNum, costoValido)

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
    startGuardar(async () => {
      const r = await actualizarProducto(tiendaId, producto.id, { nombre, precio_venta: precioNum, costo: costoValido, codigo_barras: codigo || null, stock_minimo: minimoNum })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('Guardado')
      onGuardado({ ...producto, nombre: nombre.trim(), precio_venta: precioNum, costo: costoValido, codigo_barras: codigo.trim() || null, stock_minimo: minimoNum })
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
          <input value={costo} onChange={e => setCosto(e.target.value)} inputMode="decimal" placeholder="Lo que pagaste al proveedor por cada una" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
          <span className="text-xs text-slate-400">También se actualiza solo cuando registras una factura de este producto.</span>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Nombre
          <input value={nombre} onChange={e => setNombre(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          {producto.vende_por === 'libra' ? 'Precio por libra' : 'Precio de venta'}
          <input value={precio} onChange={e => setPrecio(e.target.value)} inputMode="decimal" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
        {costoValido !== null && costoValido > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Poner precio para ganar:</span>
            {[20, 30, 40].map(pct => (
              <button key={pct} type="button" onClick={() => setPrecio(precioParaGanar(costoValido, pct).toFixed(2))} className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
                {pct}% · {dinero(precioParaGanar(costoValido, pct))}
              </button>
            ))}
          </div>
        )}
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

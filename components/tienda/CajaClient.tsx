'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Banknote, Check, ClipboardList, CreditCard, ListChecks, Lock, Minus, PackagePlus, Pencil, Plus, ScanBarcode, Scale, Search, ShoppingBasket, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { actualizarProducto, registrarVenta } from '@/app/actions/tienda'
import { cantidad as fmtCantidad, dinero, gananciaPorUnidad, margen, normalizarCodigo, porAgotarse, porcentajeValido, redondear2 } from '@/lib/tienda/formato'
import type { MetodoPago, Producto } from '@/lib/tienda/tipos'
import Escaner, { precargarEscaner } from '@/components/tienda/Escaner'
import ProductoDesconocido from '@/components/tienda/ProductoDesconocido'
import Cifra from '@/components/ui/Cifra'
import FotoProducto from '@/components/tienda/FotoProducto'
import PrecioGanancia from '@/components/tienda/PrecioGanancia'

type Linea = { producto: Producto; cantidad: number; precioManual: string }

function precioDe(l: Linea): number | null {
  if (l.producto.precio_venta !== null) return l.producto.precio_venta
  const n = Number(l.precioManual)
  return l.precioManual.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null
}

export default function CajaClient({
  tiendaId,
  slug,
  productos: iniciales,
  ventasHoy,
}: {
  tiendaId: string
  slug: string
  productos: Producto[]
  ventasHoy: { cantidad: number; total: number }
}) {
  const router = useRouter()
  const [productos, setProductos] = useState(iniciales)
  const [lineas, setLineas] = useState<Linea[]>([])
  const [escaneando, setEscaneando] = useState(false)
  const [ultimo, setUltimo] = useState<Producto | null>(null)
  // Código escaneado que no está; '' = producto nuevo sin código (lo que se buscó y no salió)
  const [desconocido, setDesconocido] = useState<string | null>(null)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [pesando, setPesando] = useState<Producto | null>(null)
  const [peso, setPeso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [recibido, setRecibido] = useState('')
  const [cobrando, startCobro] = useTransition()
  // Cambiar el precio o el % mientras se vende: queda guardado en el producto
  const [editando, setEditando] = useState<Producto | null>(null)
  const [precioNuevo, setPrecioNuevo] = useState('')
  const [pctNuevo, setPctNuevo] = useState('')
  const [guardandoPrecio, startGuardarPrecio] = useTransition()
  useEffect(precargarEscaner, [])

  const porCodigo = useMemo(
    () => new Map(productos.filter(p => p.codigo_barras).map(p => [normalizarCodigo(p.codigo_barras as string), p])),
    [productos],
  )
  const porLibra = useMemo(() => productos.filter(p => p.vende_por === 'libra'), [productos])
  const resultados = useMemo(() => {
    const f = busqueda.trim().toLowerCase()
    if (f.length < 2) return []
    return productos.filter(p => p.nombre.toLowerCase().includes(f) || p.codigo_barras === f).slice(0, 8)
  }, [productos, busqueda])

  // Un solo aviso de "no hay" por producto en cada venta (el escaneo continuo no debe llenar la pantalla)
  const avisados = useRef(new Set<string>())
  const agregar = useCallback((p: Producto, cant = 1) => {
    if (p.contado && p.stock <= 0 && !avisados.current.has(p.id)) {
      avisados.current.add(p.id)
      toast.warning(`El sistema dice que no hay ${p.nombre}. Se puede vender igual; revisa el inventario después.`)
    }
    setLineas(ls => {
      const i = ls.findIndex(l => l.producto.id === p.id)
      if (i >= 0 && p.vende_por === 'unidad') {
        const copia = [...ls]
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + cant }
        return copia
      }
      return [...ls, { producto: p, cantidad: cant, precioManual: '' }]
    })
  }, [])

  const elegir = useCallback((p: Producto) => {
    setBusqueda('')
    if (p.vende_por === 'libra') {
      setPeso('')
      setPesando(p)
    } else {
      agregar(p)
      toast.success(p.nombre, { duration: 1200 })
    }
  }, [agregar])

  const alEscanear = useCallback((codigo: string) => {
    const c = normalizarCodigo(codigo)
    const p = porCodigo.get(c)
    // La cámara sigue abierta y va sumando; solo se cierra si hace falta preguntar algo
    if (!p) {
      setEscaneando(false)
      setDesconocido(c)
    } else if (p.vende_por === 'libra') {
      setEscaneando(false)
      elegir(p)
    } else {
      agregar(p)
      setUltimo(p)
    }
  }, [porCodigo, elegir, agregar])

  function confirmarPeso(e: React.FormEvent) {
    e.preventDefault()
    const lb = Number(peso)
    if (!pesando || !Number.isFinite(lb) || lb <= 0) return
    agregar(pesando, Number(lb.toFixed(3)))
    setPesando(null)
  }

  const total = redondear2(lineas.reduce((s, l) => s + redondear2((precioDe(l) ?? 0) * l.cantidad), 0))
  const faltaPrecio = lineas.some(l => precioDe(l) === null)
  const vuelto = metodo === 'efectivo' && recibido ? redondear2(Number(recibido) - total) : null

  function abrirPrecio(p: Producto) {
    setPrecioNuevo(p.precio_venta?.toFixed(2) ?? '')
    setPctNuevo(String(margen(p.precio_venta, p.costo) ?? p.porcentaje_ganancia))
    setEditando(p)
  }

  function guardarPrecio(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    const precio = Number(precioNuevo)
    if (precioNuevo.trim() === '' || !Number.isFinite(precio) || precio < 0) {
      toast.error('El precio no es válido')
      return
    }
    const p = editando
    const pct = porcentajeValido(pctNuevo) ?? p.porcentaje_ganancia
    startGuardarPrecio(async () => {
      const r = await actualizarProducto(tiendaId, p.id, { precio_venta: precio, porcentaje_ganancia: pct })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const nuevo = { ...p, precio_venta: precio, porcentaje_ganancia: pct }
      setProductos(ps => ps.map(x => (x.id === p.id ? nuevo : x)))
      setLineas(ls => ls.map(l => (l.producto.id === p.id ? { ...l, producto: nuevo } : l)))
      setEditando(null)
      toast.success(`${p.nombre}: ahora a ${dinero(precio)}`)
    })
  }

  function cobrar() {
    if (!lineas.length || faltaPrecio) return
    startCobro(async () => {
      const r = await registrarVenta(tiendaId, metodo, lineas.map(l => ({
        producto_id: l.producto.id, cantidad: l.cantidad,
        precio_unitario: l.producto.precio_venta === null ? precioDe(l) : null,
      })))
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      setCelebrar({ total, vuelto: vuelto !== null && vuelto > 0 ? vuelto : null })
      setTimeout(() => setCelebrar(null), 1800)
      const actualizados = productos.map(p => {
        const vendido = lineas.filter(l => l.producto.id === p.id).reduce((s, l) => s + l.cantidad, 0)
        return vendido ? { ...p, stock: p.stock - vendido } : p
      })
      const quedanPocos = actualizados.filter(p => lineas.some(l => l.producto.id === p.id) && porAgotarse(p))
      if (quedanPocos.length) {
        toast.info(`Para tu próximo pedido: ${quedanPocos.slice(0, 3).map(p => `${p.nombre} (${p.stock <= 0 ? 'no hay' : fmtCantidad(p.stock, p.vende_por)})`).join(', ')}${quedanPocos.length > 3 ? ` y ${quedanPocos.length - 3} más` : ''}`, { duration: 6000 })
      }
      setProductos(actualizados)
      avisados.current.clear()
      setLineas([])
      setRecibido('')
      router.refresh()
    })
  }

  const porAgotarseCantidad = productos.filter(porAgotarse).length
  const [celebrar, setCelebrar] = useState<{ total: number; vuelto: number | null } | null>(null)

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-4">
      {porAgotarseCantidad > 0 && (
        <Link href={`/t/${slug}/inventario?filtro=por-agotarse`} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-emerald-100 hover:ring-emerald-300">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-200 text-emerald-900"><ClipboardList className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-800">Tu lista de pedido está lista</span>
            <span className="block text-xs text-slate-500">{porAgotarseCantidad === 1 ? '1 producto para reponer' : `${porAgotarseCantidad} productos para reponer`} · la mandas por WhatsApp</span>
          </span>
          <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Ver</span>
        </Link>
      )}
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex items-baseline justify-between px-1">
          <span className="text-sm text-slate-500">Vendido hoy</span>
          <span className="text-lg font-black text-slate-900"><Cifra valor={ventasHoy.total} /> <span className="text-sm font-semibold text-slate-500">· {ventasHoy.cantidad} {ventasHoy.cantidad === 1 ? 'venta' : 'ventas'}</span></span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link href={`/t/${slug}/ventas`} className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            <ListChecks className="h-4 w-4" /> Ventas de hoy
          </Link>
          <Link href={`/t/${slug}/cierre`} className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            <Lock className="h-4 w-4" /> Cerrar el día
          </Link>
        </div>
      </div>

      <button
        onClick={() => { setUltimo(null); setEscaneando(true) }}
        className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 py-6 text-xl font-bold text-white shadow-lg shadow-emerald-700/30"
      >
        <span className="relative">
          <ScanBarcode className="h-9 w-9" />
          <span aria-hidden className="linea-escaner absolute inset-x-0 h-0.5 rounded bg-lime-300 shadow-[0_0_8px_2px_rgb(190_242_100/0.8)]" />
        </span>
        Escanear producto
      </button>

      <div className="relative">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 shadow-sm">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre (pan, huevo…)"
            className="w-full bg-transparent py-3.5 text-base focus:outline-none"
          />
        </div>
        {resultados.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-xl">
            {resultados.map(p => (
              <li key={p.id}>
                <button onClick={() => elegir(p)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-emerald-50">
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-sm text-slate-500">{dinero(p.precio_venta)}{p.vende_por === 'libra' ? '/lb' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {busqueda.trim().length >= 2 && resultados.length === 0 && (
          <button
            onClick={() => { setNombreNuevo(busqueda.trim()); setBusqueda(''); setDesconocido('') }}
            className="absolute inset-x-0 top-full z-20 mt-1 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-xl hover:bg-emerald-50"
          >
            <PackagePlus className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="min-w-0"><span className="block font-semibold text-slate-800">No está. Crear «{busqueda.trim()}»</span><span className="block text-xs text-slate-500">Para lo que no trae código: frutas, verduras, pan…</span></span>
          </button>
        )}
      </div>

      {porLibra.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Scale className="h-4 w-4" /> Por libra (pesa)
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {porLibra.map(p => (
              <button key={p.id} onClick={() => elegir(p)} className="shrink-0 rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-transparent hover:ring-emerald-200">
                <span className="block font-semibold text-slate-800">{p.nombre}</span>
                <span className="text-xs text-slate-500">{dinero(p.precio_venta)}/lb</span>
              </button>
            ))}
          </div>
        </div>
      )}

      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-28">
      <section className="rounded-3xl bg-white shadow-sm">
        {lineas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-slate-500">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><ShoppingBasket className="h-7 w-7" /></span>
            Escanea o busca un producto para empezar la venta.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lineas.map((l, i) => {
              const precio = precioDe(l)
              return (
                <li key={`${l.producto.id}-${i}`} className="fila-nueva flex items-center gap-3 px-4 py-3">
                  <FotoProducto producto={l.producto} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{l.producto.nombre}</p>
                    {l.producto.precio_venta === null ? (
                      <input
                        value={l.precioManual}
                        onChange={e => setLineas(ls => ls.map((x, j) => j === i ? { ...x, precioManual: e.target.value } : x))}
                        inputMode="decimal"
                        placeholder="Precio $"
                        className="mt-1 w-24 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-sm"
                      />
                    ) : (
                      <button onClick={() => abrirPrecio(l.producto)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-700">
                        {fmtCantidad(l.cantidad, l.producto.vende_por)} × <span className="font-semibold underline decoration-dotted underline-offset-2">{dinero(precio)}</span>
                        <Pencil className="h-3.5 w-3.5" aria-label="Cambiar precio" />
                      </button>
                    )}
                  </div>
                  {l.producto.vende_por === 'unidad' && (
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Quitar uno"
                        onClick={() => setLineas(ls => ls.flatMap((x, j) => j !== i ? [x] : x.cantidad > 1 ? [{ ...x, cantidad: x.cantidad - 1 }] : []))}
                        className="rounded-full bg-slate-100 p-1.5"
                      ><Minus className="h-4 w-4" /></button>
                      <span className="w-6 text-center font-semibold">{l.cantidad}</span>
                      <button
                        aria-label="Agregar uno"
                        onClick={() => setLineas(ls => ls.map((x, j) => j === i ? { ...x, cantidad: x.cantidad + 1 } : x))}
                        className="rounded-full bg-slate-100 p-1.5"
                      ><Plus className="h-4 w-4" /></button>
                    </div>
                  )}
                  <div className="w-16 text-right font-bold text-slate-800">{precio === null ? '—' : dinero(precio * l.cantidad)}</div>
                  {l.producto.vende_por === 'libra' && (
                    <button aria-label="Quitar" onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))} className="text-slate-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {lineas.length > 0 && (
        <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-slate-600">Total</span>
            <span className="text-4xl font-black text-slate-900"><Cifra valor={total} duracion={350} /></span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['efectivo', 'Efectivo', Banknote],
              ['yappy', 'Yappy', Smartphone],
              ['tarjeta', 'Tarjeta', CreditCard],
            ] as const).map(([m, nombre, Icono]) => (
              <button
                key={m}
                onClick={() => setMetodo(m)}
                className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-sm font-semibold ${metodo === m ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                <Icono className="h-5 w-5" /> {nombre}
              </button>
            ))}
          </div>
          {metodo === 'efectivo' && (
            <div className="flex items-center gap-3">
              <input
                value={recibido}
                onChange={e => setRecibido(e.target.value)}
                inputMode="decimal"
                placeholder="Recibido $"
                className="w-36 rounded-xl border border-slate-200 px-3 py-2.5 text-base"
              />
              {vuelto !== null && Number.isFinite(vuelto) && (
                <span className={`text-lg font-bold ${vuelto < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {vuelto < 0 ? `Faltan ${dinero(-vuelto)}` : `Vuelto ${dinero(vuelto)}`}
                </span>
              )}
            </div>
          )}
          <button
            onClick={cobrar}
            disabled={cobrando || faltaPrecio}
            className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-700/30 disabled:from-slate-400 disabled:to-slate-500 disabled:shadow-none"
          >
            {cobrando ? 'Registrando…' : faltaPrecio ? 'Falta poner un precio' : `Cobrar ${dinero(total)}`}
          </button>
        </section>
      )}
      </div>

      {celebrar && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 backdrop-blur-[2px]" role="status">
          <div className="venta-lista flex flex-col items-center gap-2 rounded-3xl bg-white px-10 py-8 shadow-2xl">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40">
              <Check className="h-11 w-11" strokeWidth={3} />
            </span>
            <p className="text-sm font-semibold text-slate-500">¡Venta lista!</p>
            <p className="text-4xl font-black text-slate-900">{dinero(celebrar.total)}</p>
            {celebrar.vuelto !== null && <p className="rounded-full bg-lime-300 px-4 py-1.5 text-lg font-bold text-emerald-950">Vuelto {dinero(celebrar.vuelto)}</p>}
          </div>
        </div>
      )}

      {escaneando && (
        <Escaner
          continuo
          titulo="Pasa los productos frente a la cámara"
          onCodigo={alEscanear}
          onCerrar={() => setEscaneando(false)}
          pie={
            <div className="flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm text-white/70">
                  {ultimo ? `✓ ${ultimo.nombre} · ${dinero(ultimo.precio_venta)}` : 'Esperando el primer producto…'}
                </p>
                <p className="text-2xl font-black">
                  {dinero(total)} <span className="text-sm font-semibold text-white/60">· {lineas.reduce((n, l) => n + (l.producto.vende_por === 'unidad' ? l.cantidad : 1), 0)} productos</span>
                </p>
              </div>
              <button onClick={() => setEscaneando(false)} className="shrink-0 rounded-2xl bg-emerald-500 px-5 py-3 text-base font-bold">
                Cobrar
              </button>
            </div>
          }
        />
      )}

      {desconocido !== null && (
        <ProductoDesconocido
          tiendaId={tiendaId}
          codigo={desconocido || null}
          nombreInicial={desconocido ? '' : nombreNuevo}
          productos={productos}
          onCerrar={() => setDesconocido(null)}
          onListo={p => {
            setProductos(ps => [...ps.filter(x => x.id !== p.id), p])
            setDesconocido(null)
            elegir(p)
          }}
        />
      )}

      {editando && (() => {
        const precio = precioNuevo.trim() === '' ? null : Number(precioNuevo)
        const ganas = gananciaPorUnidad(precio !== null && Number.isFinite(precio) ? precio : null, editando.costo)
        return (
          <div className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center">
            <form onSubmit={guardarPrecio} className="flex w-full max-w-sm flex-col gap-4 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
              <div>
                <p className="text-lg font-bold">{editando.nombre}</p>
                <p className="text-sm text-slate-500">Te cuesta {dinero(editando.costo)}{editando.vende_por === 'libra' ? ' la libra' : ''}. El cambio queda guardado para las próximas ventas.</p>
              </div>
              <PrecioGanancia
                costo={editando.costo}
                vendePor={editando.vende_por}
                precioAntes={editando.precio_venta}
                precio={precioNuevo}
                porcentaje={pctNuevo}
                onPrecio={setPrecioNuevo}
                onPorcentaje={setPctNuevo}
              />
              {ganas !== null && (
                <p className={`text-center text-lg font-black ${ganas <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {ganas <= 0 ? `Pierdes ${dinero(-ganas)}` : `Ganas ${dinero(ganas)}`} por {editando.vende_por === 'libra' ? 'libra' : 'unidad'}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setEditando(null)} className="rounded-2xl bg-slate-100 py-3 font-semibold">Cancelar</button>
                <button disabled={guardandoPrecio} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{guardandoPrecio ? 'Guardando…' : 'Guardar precio'}</button>
              </div>
            </form>
          </div>
        )
      })()}

      {pesando && (
        <div className="hoja fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center">
          <form onSubmit={confirmarPeso} className="flex w-full max-w-sm flex-col gap-4 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div>
              <p className="text-lg font-bold">{pesando.nombre}</p>
              <p className="text-sm text-slate-500">{dinero(pesando.precio_venta)} la libra. Escribe lo que marca la pesa.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={peso}
                onChange={e => setPeso(e.target.value)}
                inputMode="decimal"
                placeholder="0.650"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-3xl font-bold"
              />
              <span className="text-xl font-semibold text-slate-500">lb</span>
            </div>
            {Number(peso) > 0 && pesando.precio_venta !== null && (
              <p className="text-center text-2xl font-black text-emerald-700">{dinero(Number(peso) * pesando.precio_venta)}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPesando(null)} className="rounded-2xl bg-slate-100 py-3 font-semibold">Cancelar</button>
              <button className="rounded-2xl bg-emerald-600 py-3 font-bold text-white">Agregar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Banknote, CreditCard, Minus, Plus, ScanBarcode, Scale, Search, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { registrarVenta } from '@/app/actions/tienda'
import { cantidad as fmtCantidad, dinero, normalizarCodigo, redondear2 } from '@/lib/tienda/formato'
import type { MetodoPago, Producto } from '@/lib/tienda/tipos'
import Escaner, { precargarEscaner } from '@/components/tienda/Escaner'
import ProductoDesconocido from '@/components/tienda/ProductoDesconocido'
import FotoProducto from '@/components/tienda/FotoProducto'

type Linea = { producto: Producto; cantidad: number; precioManual: string }

function precioDe(l: Linea): number | null {
  if (l.producto.precio_venta !== null) return l.producto.precio_venta
  const n = Number(l.precioManual)
  return l.precioManual.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null
}

export default function CajaClient({
  tiendaId,
  productos: iniciales,
  ventasHoy,
}: {
  tiendaId: string
  productos: Producto[]
  ventasHoy: { cantidad: number; total: number }
}) {
  const router = useRouter()
  const [productos, setProductos] = useState(iniciales)
  const [lineas, setLineas] = useState<Linea[]>([])
  const [escaneando, setEscaneando] = useState(false)
  const [ultimo, setUltimo] = useState<Producto | null>(null)
  const [desconocido, setDesconocido] = useState<string | null>(null)
  const [pesando, setPesando] = useState<Producto | null>(null)
  const [peso, setPeso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [recibido, setRecibido] = useState('')
  const [cobrando, startCobro] = useTransition()
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

  const agregar = useCallback((p: Producto, cant = 1) => {
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
      toast.success(`Venta registrada: ${dinero(total)}`)
      setProductos(ps => ps.map(p => {
        const vendido = lineas.filter(l => l.producto.id === p.id).reduce((s, l) => s + l.cantidad, 0)
        return vendido ? { ...p, stock: p.stock - vendido } : p
      }))
      setLineas([])
      setRecibido('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
        <span className="text-sm text-slate-500">Vendido hoy</span>
        <span className="text-sm font-semibold text-slate-800">{dinero(ventasHoy.total)} · {ventasHoy.cantidad} ventas</span>
      </div>

      <button
        onClick={() => { setUltimo(null); setEscaneando(true) }}
        className="flex items-center justify-center gap-3 rounded-3xl bg-emerald-600 py-5 text-xl font-bold text-white shadow-lg active:scale-[0.98]"
      >
        <ScanBarcode className="h-8 w-8" /> Escanear producto
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
                <button onClick={() => elegir(p)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-sm text-slate-500">{dinero(p.precio_venta)}{p.vende_por === 'libra' ? '/lb' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {porLibra.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Scale className="h-4 w-4" /> Por libra (pesa)
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {porLibra.map(p => (
              <button key={p.id} onClick={() => elegir(p)} className="shrink-0 rounded-2xl bg-white px-4 py-3 text-left shadow-sm">
                <span className="block font-semibold text-slate-800">{p.nombre}</span>
                <span className="text-xs text-slate-500">{dinero(p.precio_venta)}/lb</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="rounded-3xl bg-white shadow-sm">
        {lineas.length === 0 ? (
          <p className="px-4 py-10 text-center text-slate-500">Escanea o busca un producto para empezar la venta.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lineas.map((l, i) => {
              const precio = precioDe(l)
              return (
                <li key={`${l.producto.id}-${i}`} className="flex items-center gap-3 px-4 py-3">
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
                      <p className="text-sm text-slate-500">
                        {fmtCantidad(l.cantidad, l.producto.vende_por)} × {dinero(precio)}
                      </p>
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
            <span className="text-4xl font-black text-slate-900">{dinero(total)}</span>
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
                className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-sm font-semibold ${metodo === m ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
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
            className="rounded-2xl bg-slate-900 py-4 text-lg font-bold text-white disabled:opacity-50"
          >
            {cobrando ? 'Registrando…' : faltaPrecio ? 'Falta poner un precio' : `Cobrar ${dinero(total)}`}
          </button>
        </section>
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

      {desconocido && (
        <ProductoDesconocido
          tiendaId={tiendaId}
          codigo={desconocido}
          productos={productos}
          onCerrar={() => setDesconocido(null)}
          onListo={p => {
            setProductos(ps => [...ps.filter(x => x.id !== p.id), p])
            setDesconocido(null)
            elegir(p)
          }}
        />
      )}

      {pesando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
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

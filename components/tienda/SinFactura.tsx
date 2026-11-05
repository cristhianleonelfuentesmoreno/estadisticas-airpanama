'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, ClipboardCheck, Gift, Home, ScanBarcode, Search, ShoppingBag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { registrarAjuste } from '@/app/actions/tienda'
import { cantidad as fmtCantidad, dinero, normalizarCodigo } from '@/lib/tienda/formato'
import type { MotivoAjuste, Producto } from '@/lib/tienda/tipos'
import Escaner, { precargarEscaner } from '@/components/tienda/Escaner'
import ProductoDesconocido from '@/components/tienda/ProductoDesconocido'
import FotoProducto from '@/components/tienda/FotoProducto'

// Mercancía que entra o sale sin factura. Palabras de la tienda, no de contabilidad.
const OPCIONES: { motivo: MotivoAjuste; titulo: string; detalle: string; Icono: typeof Gift; color: string; pregunta: string }[] = [
  { motivo: 'regalia', titulo: 'Me regalaron', detalle: 'Bonificación o regalía del proveedor', Icono: Gift, color: 'bg-emerald-50 text-emerald-700', pregunta: '¿Cuántos te regalaron?' },
  { motivo: 'compra_sin_factura', titulo: 'Lo compré aparte', detalle: 'En el súper o sin factura', Icono: ShoppingBag, color: 'bg-sky-50 text-sky-700', pregunta: '¿Cuántos compraste?' },
  { motivo: 'danado', titulo: 'Se dañó o venció', detalle: 'Se bota, ya no se puede vender', Icono: Trash2, color: 'bg-red-50 text-red-700', pregunta: '¿Cuántos se dañaron?' },
  { motivo: 'consumo', titulo: 'Lo usó la casa', detalle: 'Lo tomó la familia', Icono: Home, color: 'bg-amber-50 text-amber-700', pregunta: '¿Cuántos se usaron?' },
  { motivo: 'conteo', titulo: 'Contar lo que hay', detalle: 'Corrige el inventario con lo que cuentas', Icono: ClipboardCheck, color: 'bg-violet-50 text-violet-700', pregunta: '¿Cuántos hay en la tienda?' },
]

export default function SinFactura({ tiendaId, slug, productos: iniciales }: { tiendaId: string; slug: string; productos: Producto[] }) {
  const [productos, setProductos] = useState(iniciales)
  const [motivo, setMotivo] = useState<MotivoAjuste | null>(null)
  const [producto, setProducto] = useState<Producto | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [escaneando, setEscaneando] = useState(false)
  const [desconocido, setDesconocido] = useState<string | null>(null)
  const [guardando, startGuardar] = useTransition()
  useEffect(precargarEscaner, [])

  const opcion = OPCIONES.find(o => o.motivo === motivo)
  const resultados = useMemo(() => {
    const f = busqueda.trim().toLowerCase()
    if (f.length < 2) return []
    return productos.filter(p => p.nombre.toLowerCase().includes(f)).slice(0, 8)
  }, [productos, busqueda])

  const elegir = useCallback((p: Producto) => {
    setBusqueda('')
    setCantidad('')
    setCosto(p.costo !== null ? String(Number(p.costo.toFixed(4))) : '')
    setProducto(p)
  }, [])

  const alEscanear = useCallback((codigo: string) => {
    setEscaneando(false)
    const c = normalizarCodigo(codigo)
    const p = productos.find(x => x.codigo_barras && normalizarCodigo(x.codigo_barras) === c)
    if (p) elegir(p)
    else setDesconocido(c)
  }, [productos, elegir])

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!producto || !motivo) return
    const cant = Number(cantidad)
    if (cantidad.trim() === '' || !Number.isFinite(cant) || cant < 0 || (motivo !== 'conteo' && cant === 0)) {
      toast.error('Escribe una cantidad válida')
      return
    }
    const costoNum = motivo === 'compra_sin_factura' && costo.trim() !== '' ? Number(costo) : null
    startGuardar(async () => {
      const r = await registrarAjuste(tiendaId, producto.id, motivo, cant, costoNum, '')
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const cambio = r.data.cambio
      toast.success(
        cambio === 0 ? `${producto.nombre}: el inventario ya estaba bien`
          : cambio > 0 ? `${producto.nombre}: entraron ${fmtCantidad(cambio, producto.vende_por)}`
            : `${producto.nombre}: salieron ${fmtCantidad(-cambio, producto.vende_por)}`,
      )
      setProductos(ps => ps.map(p => (p.id === producto.id ? { ...p, stock: p.stock + cambio, costo: costoNum ?? p.costo } : p)))
      setProducto(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {motivo ? (
        <button onClick={() => { setMotivo(null); setProducto(null) }} className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <ArrowLeft className="h-4 w-4" /> Elegir otra cosa
        </button>
      ) : (
        <Link href={`/t/${slug}/facturas`} className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      )}

      {!opcion ? (
        <>
          <p className="px-1 text-lg font-bold text-slate-800">¿Qué pasó?</p>
          {OPCIONES.map(o => (
            <button key={o.motivo} onClick={() => setMotivo(o.motivo)} className="flex items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm active:scale-[0.99]">
              <span className={`rounded-2xl p-3 ${o.color}`}><o.Icono className="h-7 w-7" /></span>
              <span>
                <span className="block text-lg font-bold text-slate-900">{o.titulo}</span>
                <span className="text-sm text-slate-500">{o.detalle}</span>
              </span>
            </button>
          ))}
        </>
      ) : !producto ? (
        <>
          <div className={`flex items-center gap-3 rounded-3xl p-4 ${opcion.color}`}>
            <opcion.Icono className="h-7 w-7" />
            <p className="text-lg font-bold">{opcion.titulo}</p>
          </div>
          <button onClick={() => setEscaneando(true)} className="flex items-center justify-center gap-3 rounded-3xl bg-emerald-600 py-5 text-xl font-bold text-white shadow-lg">
            <ScanBarcode className="h-8 w-8" /> Escanear el producto
          </button>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 shadow-sm">
              <Search className="h-5 w-5 text-slate-400" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="O busca por nombre" className="w-full bg-transparent py-3.5 focus:outline-none" />
            </div>
            {resultados.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-xl">
                {resultados.map(p => (
                  <li key={p.id}>
                    <button onClick={() => elegir(p)} className="flex w-full justify-between gap-3 px-4 py-3 text-left">
                      <span className="font-medium">{p.nombre}</span>
                      <span className="text-sm text-slate-500">hay {fmtCantidad(p.stock, p.vende_por)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <form onSubmit={guardar} className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <FotoProducto producto={producto} tamano="h-14 w-14" />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{producto.nombre}</p>
              <p className="text-sm text-slate-500">Hoy el sistema dice que hay {fmtCantidad(producto.stock, producto.vende_por)}</p>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-base font-semibold text-slate-800">
            {opcion.pregunta}
            <input autoFocus value={cantidad} onChange={e => setCantidad(e.target.value)} inputMode="decimal" placeholder="0" className="rounded-2xl border border-slate-200 px-4 py-3 text-3xl font-black" />
          </label>
          {motivo === 'compra_sin_factura' && (
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              ¿Cuánto te costó cada uno? (opcional)
              <input value={costo} onChange={e => setCosto(e.target.value)} inputMode="decimal" placeholder="0.00" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
            </label>
          )}
          {motivo === 'regalia' && <p className="text-sm text-slate-500">El costo del producto no cambia: lo regalado no baja tu ganancia.</p>}
          {motivo === 'conteo' && cantidad.trim() !== '' && Number.isFinite(Number(cantidad)) && (
            <p className="text-sm font-semibold text-slate-700">
              {Number(cantidad) === producto.stock ? 'Está igual que en el sistema.' : Number(cantidad) > producto.stock
                ? `Se suman ${fmtCantidad(Number(cantidad) - producto.stock, producto.vende_por)}`
                : `Se restan ${fmtCantidad(producto.stock - Number(cantidad), producto.vende_por)}`}
            </p>
          )}
          {motivo === 'danado' && producto.costo !== null && Number(cantidad) > 0 && (
            <p className="text-sm text-red-600">Pérdida aproximada: {dinero(Number(cantidad) * producto.costo)}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setProducto(null)} className="rounded-2xl bg-slate-100 py-3 font-semibold">Cambiar producto</button>
            <button disabled={guardando} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      )}

      {escaneando && <Escaner onCodigo={alEscanear} onCerrar={() => setEscaneando(false)} />}
      {desconocido && (
        <ProductoDesconocido
          tiendaId={tiendaId}
          desde="sin_factura"
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
    </div>
  )
}

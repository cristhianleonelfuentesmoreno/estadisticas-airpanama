'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ScanBarcode, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { registrarEntrada } from '@/app/actions/tienda'
import { dinero, margen, redondear2 } from '@/lib/tienda/formato'
import type { Producto } from '@/lib/tienda/tipos'
import Escaner from '@/components/tienda/Escaner'
import ProductoDesconocido from '@/components/tienda/ProductoDesconocido'
import FotoProducto from '@/components/tienda/FotoProducto'

// Una línea de la factura: "llegaron 2 paquetes de 12 a $9.70 el paquete"
type Linea = { producto: Producto; paquetes: string; porPaquete: string; costoPaquete: string }

function calcular(l: Linea) {
  const paquetes = Number(l.paquetes)
  const porPaquete = Number(l.porPaquete) || 1
  const costoPaquete = Number(l.costoPaquete)
  const valido = paquetes > 0 && porPaquete > 0 && l.costoPaquete.trim() !== '' && costoPaquete >= 0
  const unidades = valido ? paquetes * porPaquete : 0
  const costoUnidad = valido ? costoPaquete / porPaquete : 0
  return { valido, unidades, costoUnidad, total: valido ? redondear2(paquetes * costoPaquete) : 0 }
}

export default function FacturaNueva({
  tiendaId, slug, productos: iniciales, proveedores,
}: {
  tiendaId: string
  slug: string
  productos: Producto[]
  proveedores: string[]
}) {
  const router = useRouter()
  const [productos, setProductos] = useState(iniciales)
  const [proveedor, setProveedor] = useState('')
  const [numero, setNumero] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [escaneando, setEscaneando] = useState(false)
  const [desconocido, setDesconocido] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [guardando, startGuardar] = useTransition()

  const resultados = useMemo(() => {
    const f = busqueda.trim().toLowerCase()
    if (f.length < 2) return []
    return productos.filter(p => p.nombre.toLowerCase().includes(f)).slice(0, 8)
  }, [productos, busqueda])

  const agregar = useCallback((p: Producto) => {
    setBusqueda('')
    setLineas(ls => ls.some(l => l.producto.id === p.id)
      ? ls
      : [{ producto: p, paquetes: '1', porPaquete: '1', costoPaquete: p.costo !== null ? String(Number(p.costo.toFixed(4))) : '' }, ...ls])
  }, [])

  const alEscanear = useCallback((codigo: string) => {
    setEscaneando(false)
    const p = productos.find(x => x.codigo_barras === codigo)
    if (p) {
      agregar(p)
      toast.success(p.nombre, { duration: 1200 })
    } else setDesconocido(codigo)
  }, [productos, agregar])

  function cambiar(i: number, campo: 'paquetes' | 'porPaquete' | 'costoPaquete', valor: string) {
    setLineas(ls => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)))
  }

  const total = redondear2(lineas.reduce((s, l) => s + calcular(l).total, 0))
  const incompletas = lineas.filter(l => !calcular(l).valido).length

  function guardar() {
    if (!proveedor.trim()) {
      toast.error('Escribe el proveedor')
      return
    }
    if (!lineas.length || incompletas) {
      toast.error(incompletas ? 'Falta cantidad o costo en algún producto' : 'Agrega al menos un producto')
      return
    }
    startGuardar(async () => {
      const r = await registrarEntrada(tiendaId, proveedor, numero, lineas.map(l => {
        const c = calcular(l)
        return { producto_id: l.producto.id, cantidad: c.unidades, costo_unitario: Number(c.costoUnidad.toFixed(4)) }
      }))
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`Factura guardada: ${dinero(total)}. El inventario ya subió.`)
      router.push(`/t/${slug}/facturas`)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          Proveedor
          <input list="proveedores" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej. Feduro, Dicarina, AJE" className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
          <datalist id="proveedores">{proveedores.map(p => <option key={p} value={p} />)}</datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
          N.º de factura (opcional)
          <input value={numero} onChange={e => setNumero(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-base" />
        </label>
      </section>

      <button onClick={() => setEscaneando(true)} className="flex items-center justify-center gap-3 rounded-3xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg">
        <ScanBarcode className="h-7 w-7" /> Escanear lo que llegó
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
                <button onClick={() => agregar(p)} className="w-full px-4 py-3 text-left font-medium">{p.nombre}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lineas.map((l, i) => {
        const c = calcular(l)
        const ganancia = c.valido ? margen(l.producto.precio_venta, c.costoUnidad) : null
        return (
          <section key={l.producto.id} className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <FotoProducto producto={l.producto} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.producto.nombre}</p>
                <p className="text-xs text-slate-500">Hay {l.producto.stock} · se vende a {dinero(l.producto.precio_venta)}</p>
              </div>
              <button aria-label="Quitar" onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))} className="text-slate-400">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Num etiqueta="Paquetes" valor={l.paquetes} onChange={v => cambiar(i, 'paquetes', v)} />
              <Num etiqueta="Unid. c/u" valor={l.porPaquete} onChange={v => cambiar(i, 'porPaquete', v)} />
              <Num etiqueta="Costo paquete" valor={l.costoPaquete} onChange={v => cambiar(i, 'costoPaquete', v)} />
            </div>
            {c.valido ? (
              <p className="text-sm text-slate-600">
                Entran <b>{c.unidades}</b> unidades a <b>{dinero(c.costoUnidad)}</b> c/u
                {ganancia !== null && (
                  <> · ganancia <b className={ganancia < 15 ? 'text-red-600' : 'text-emerald-700'}>{ganancia}%</b></>
                )}
              </p>
            ) : (
              <p className="text-sm text-amber-700">Pon cuántos paquetes llegaron y lo que costó cada paquete.</p>
            )}
          </section>
        )
      })}

      {lineas.length > 0 && (
        <section className="sticky bottom-24 flex items-center justify-between gap-3 rounded-3xl bg-slate-900 p-4 text-white shadow-xl">
          <div>
            <p className="text-xs text-slate-300">{lineas.length} productos</p>
            <p className="text-2xl font-black">{dinero(total)}</p>
          </div>
          <button onClick={guardar} disabled={guardando} className="rounded-2xl bg-emerald-500 px-5 py-3 text-base font-bold disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Guardar factura'}
          </button>
        </section>
      )}

      {escaneando && <Escaner titulo="Escanea lo que llegó" onCodigo={alEscanear} onCerrar={() => setEscaneando(false)} />}
      {desconocido && (
        <ProductoDesconocido
          tiendaId={tiendaId}
          codigo={desconocido}
          productos={productos}
          onCerrar={() => setDesconocido(null)}
          onListo={p => {
            setProductos(ps => [...ps.filter(x => x.id !== p.id), p])
            setDesconocido(null)
            agregar(p)
          }}
        />
      )}
    </div>
  )
}

function Num({ etiqueta, valor, onChange }: { etiqueta: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {etiqueta}
      <input value={valor} onChange={e => onChange(e.target.value)} inputMode="decimal" className="rounded-xl border border-slate-200 px-2 py-2 text-base text-slate-900" />
    </label>
  )
}

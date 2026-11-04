'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HelpCircle, PackagePlus, ScanBarcode, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { actualizarProducto, crearProducto, registrarEntrada, type LineaFacturaFoto } from '@/app/actions/tienda'
import { dinero, margen, normalizarCodigo, redondear2 } from '@/lib/tienda/formato'
import type { Producto } from '@/lib/tienda/tipos'
import Escaner, { precargarEscaner } from '@/components/tienda/Escaner'
import ProductoDesconocido from '@/components/tienda/ProductoDesconocido'
import FotoProducto from '@/components/tienda/FotoProducto'
import LeerFacturaFoto, { type FacturaDeFoto } from '@/components/tienda/LeerFacturaFoto'

// Una línea de la factura: "llegaron 2 paquetes de 12 a $9.70 el paquete".
// Si vino de la foto, guarda lo que decía la factura para poder revisarlo.
type Linea = {
  producto: Producto
  paquetes: string
  porPaquete: string
  costoPaquete: string
  deFactura?: LineaFacturaFoto
}

function lineaDesdeFactura(producto: Producto, f: LineaFacturaFoto): Linea {
  return {
    producto, deFactura: f,
    paquetes: String(f.paquetes), porPaquete: String(f.unidades_por_paquete), costoPaquete: String(f.costo_por_paquete),
  }
}

// "SOPA RAMEN MARUCHAN POLLO" -> "Sopa ramen maruchan pollo"
function nombreDeFactura(descripcion: string): string {
  const limpio = descripcion.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}

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
  // Líneas de la foto que no se pudieron unir con un producto del inventario
  const [pendientes, setPendientes] = useState<LineaFacturaFoto[]>([])
  const [asignando, setAsignando] = useState<number | null>(null)
  const [creando, startCrear] = useTransition()
  useEffect(precargarEscaner, [])

  function alLeerFoto(f: FacturaDeFoto) {
    if (f.proveedor && !proveedor.trim()) setProveedor(f.proveedor)
    if (f.numero_factura && !numero.trim()) setNumero(f.numero_factura)
    const porId = new Map(productos.map(p => [p.id, p]))
    const encontradas: Linea[] = []
    const sinUnir: LineaFacturaFoto[] = []
    for (const l of f.lineas) {
      const p = l.coincidencia ? porId.get(l.coincidencia.producto_id) : undefined
      if (p) encontradas.push(lineaDesdeFactura(p, l))
      else sinUnir.push(l)
    }
    setLineas(ls => [...encontradas, ...ls])
    setPendientes(ps => [...sinUnir, ...ps])
  }

  function noEsEste(i: number) {
    const l = lineas[i]
    if (!l.deFactura) return
    setLineas(ls => ls.filter((_, j) => j !== i))
    setPendientes(ps => [{ ...l.deFactura!, coincidencia: null }, ...ps])
  }

  // Une una línea pendiente con un producto que ya existe; si la factura traía el código, se lo guarda
  function unirCon(p: Producto) {
    if (asignando === null) return
    const f = pendientes[asignando]
    setPendientes(ps => ps.filter((_, j) => j !== asignando))
    setAsignando(null)
    setBusqueda('')
    setLineas(ls => [lineaDesdeFactura(p, f), ...ls])
    if (f.codigo_barras && !p.codigo_barras) {
      void actualizarProducto(tiendaId, p.id, { codigo_barras: f.codigo_barras }).then(r => {
        if (r.ok) setProductos(ps => ps.map(x => (x.id === p.id ? { ...x, codigo_barras: f.codigo_barras } : x)))
      })
    }
  }

  function crearDesdeFactura(i: number) {
    const f = pendientes[i]
    startCrear(async () => {
      const nombre = nombreDeFactura(f.descripcion)
      const r = await crearProducto(tiendaId, { nombre, codigo_barras: f.codigo_barras, vende_por: 'unidad', categoria: 'Otros' })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const nuevo: Producto = {
        id: r.data.id, nombre, marca: null, presentacion: null, categoria: 'Otros', codigo_barras: f.codigo_barras,
        vende_por: 'unidad', precio_venta: null, costo: null, itbms: 0, imagen_url: null, stock_minimo: null, stock: 0, contado: false,
      }
      setProductos(ps => [...ps, nuevo])
      setPendientes(ps => ps.filter((_, j) => j !== i))
      setLineas(ls => [lineaDesdeFactura(nuevo, f), ...ls])
      toast.success(`${nombre} creado. Ponle su precio de venta en Inventario.`)
    })
  }

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
    const c = normalizarCodigo(codigo)
    const p = productos.find(x => x.codigo_barras && normalizarCodigo(x.codigo_barras) === c)
    if (p) {
      agregar(p)
      toast.success(p.nombre, { duration: 1200 })
    } else setDesconocido(c)
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
      <LeerFacturaFoto tiendaId={tiendaId} onLeida={alLeerFoto} />

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
                <button onClick={() => (asignando !== null ? unirCon(p) : agregar(p))} className="w-full px-4 py-3 text-left font-medium">{p.nombre}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendientes.length > 0 && (
        <section className="flex flex-col gap-3 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="flex items-center gap-2 font-bold text-amber-900">
            <HelpCircle className="h-5 w-5" /> No encontré {pendientes.length === 1 ? 'este producto' : `estos ${pendientes.length} productos`} en tu inventario
          </p>
          {pendientes.map((f, i) => (
            <div key={`${f.descripcion}-${i}`} className={`rounded-2xl bg-white p-3 ${asignando === i ? 'ring-2 ring-emerald-500' : ''}`}>
              <p className="font-semibold text-slate-800">{f.descripcion}</p>
              <p className="text-xs text-slate-500">
                {f.paquetes} × {f.unidades_por_paquete} unid. a {dinero(f.costo_por_paquete)}{f.codigo_barras ? ` · código ${f.codigo_barras}` : ''}
              </p>
              {asignando === i ? (
                <p className="mt-2 text-sm font-semibold text-emerald-700">Busca arriba el producto y tócalo. <button onClick={() => setAsignando(null)} className="underline">Cancelar</button></p>
              ) : (
                <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                  <button disabled={creando} onClick={() => crearDesdeFactura(i)} className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    <PackagePlus className="h-4 w-4" /> Crear nuevo
                  </button>
                  <button onClick={() => { setAsignando(i); setBusqueda(nombreDeFactura(f.descripcion).split(' ')[0] ?? '') }} className="rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-700">
                    Es otro que tengo
                  </button>
                  <button aria-label="Quitar" onClick={() => setPendientes(ps => ps.filter((_, j) => j !== i))} className="px-2 text-slate-400">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {lineas.map((l, i) => {
        const c = calcular(l)
        const ganancia = c.valido ? margen(l.producto.precio_venta, c.costoUnidad) : null
        return (
          <section key={`${l.producto.id}-${i}`} className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm">
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
            {l.deFactura && l.deFactura.coincidencia?.por === 'nombre' && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                En la factura dice: <b>{l.deFactura.descripcion}</b>.{' '}
                <button onClick={() => noEsEste(i)} className="font-semibold underline">No es este producto</button>
              </p>
            )}
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

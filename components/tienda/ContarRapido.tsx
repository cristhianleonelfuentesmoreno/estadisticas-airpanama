'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, PackagePlus, ScanBarcode, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { registrarAjuste } from '@/app/actions/tienda'
import { cantidad as fmtCantidad, normalizarCodigo } from '@/lib/tienda/formato'
import type { Producto } from '@/lib/tienda/tipos'
import Escaner, { precargarEscaner } from '@/components/tienda/Escaner'
import ProductoDesconocido from '@/components/tienda/ProductoDesconocido'
import FotoProducto from '@/components/tienda/FotoProducto'

// Contar el estante rápido: escaneas (o buscas lo que no tiene código), escribes cuántos hay
// y sigues con el próximo. Cada conteo deja el inventario en ese número.
export default function ContarRapido({ tiendaId, slug, productos: iniciales }: { tiendaId: string; slug: string; productos: Producto[] }) {
  const [productos, setProductos] = useState(iniciales)
  const [escaneando, setEscaneando] = useState(false)
  const [desconocido, setDesconocido] = useState<string | null>(null)
  const [contando, setContando] = useState<Producto | null>(null)
  const [cuantos, setCuantos] = useState('')
  const [buscar, setBuscar] = useState('')
  const [hechos, setHechos] = useState<{ id: string; nombre: string; cantidad: number; vende_por: Producto['vende_por'] }[]>([])
  const [seguir, setSeguir] = useState(true)
  const [guardando, start] = useTransition()
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => { precargarEscaner() }, [])
  useEffect(() => { if (contando) campo.current?.focus() }, [contando])

  const resultados = useMemo(() => {
    const f = buscar.trim().toLowerCase()
    return f.length < 2 ? [] : productos.filter(p => p.nombre.toLowerCase().includes(f)).slice(0, 8)
  }, [productos, buscar])

  function abrir(p: Producto) {
    setBuscar('')
    setCuantos('')
    setContando(p)
  }

  function alEscanear(codigo: string) {
    setEscaneando(false)
    const c = normalizarCodigo(codigo)
    const p = productos.find(x => x.codigo_barras && normalizarCodigo(x.codigo_barras) === c)
    if (p) abrir(p)
    else setDesconocido(c)
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!contando) return
    const n = Number(cuantos.replace(',', '.'))
    if (cuantos.trim() === '' || !Number.isFinite(n) || n < 0) return void toast.error('Escribe cuántos hay (0 si no queda)')
    const p = contando
    start(async () => {
      const r = await registrarAjuste(tiendaId, p.id, 'conteo', n, null, 'Conteo rápido')
      if (!r.ok) return void toast.error(r.error)
      setProductos(ps => ps.map(x => (x.id === p.id ? { ...x, stock: n, contado: true } : x)))
      setHechos(h => [{ id: p.id, nombre: p.nombre, cantidad: n, vende_por: p.vende_por }, ...h.filter(x => x.id !== p.id)])
      setContando(null)
      toast.success(`${p.nombre}: ${fmtCantidad(n, p.vende_por)}`, { duration: 1200 })
      if (seguir && p.codigo_barras) setEscaneando(true)
    })
  }

  const faltan = productos.filter(p => !p.contado).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href={`/t/${slug}/inventario`} aria-label="Volver" className="rounded-full bg-white p-2 text-slate-600 shadow-sm"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Contar rápido</h1>
          <p className="text-sm text-slate-500">{hechos.length} contados ahora · {faltan} nunca contados</p>
        </div>
      </div>

      <button onClick={() => setEscaneando(true)} className="brillo flex items-center justify-center gap-3 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 py-6 text-xl font-bold text-white shadow-lg shadow-emerald-700/30">
        <ScanBarcode className="h-8 w-8" /> Escanear
      </button>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={seguir} onChange={e => setSeguir(e.target.checked)} className="h-5 w-5 accent-emerald-600" />
        Al guardar, abrir la cámara para el siguiente
      </label>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 rounded-2xl bg-white px-3 shadow-sm ring-1 ring-slate-100">
          <Search className="h-5 w-5 text-slate-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Sin código: busca por nombre (papa, pan…)" className="w-full bg-transparent py-3 text-base focus:outline-none" />
          {buscar && <button onClick={() => setBuscar('')} aria-label="Borrar búsqueda"><X className="h-5 w-5 text-slate-400" /></button>}
        </label>
        {resultados.length > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm">
            {resultados.map(p => (
              <li key={p.id}>
                <button onClick={() => abrir(p)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                  <FotoProducto producto={p} tamano="h-9 w-9" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{p.nombre}</span>
                  <span className="text-xs text-slate-500">{p.contado ? `hay ${fmtCantidad(p.stock, p.vende_por)}` : 'sin contar'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {buscar.trim().length >= 2 && !resultados.length && (
          <button onClick={() => setDesconocido('')} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 py-3 font-bold text-emerald-800">
            <PackagePlus className="h-5 w-5" /> No está. Crear «{buscar.trim()}»
          </button>
        )}
      </div>

      {hechos.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-sm font-semibold text-slate-500">Contados ahora</p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm">
            {hechos.map(h => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{h.nombre}</span>
                <button onClick={() => { const p = productos.find(x => x.id === h.id); if (p) abrir(p) }} className="rounded-xl bg-slate-50 px-3 py-1.5 text-sm font-bold tabular-nums text-slate-700">{fmtCantidad(h.cantidad, h.vende_por)}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {contando && (
        <div className="hoja fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center">
          <form onSubmit={guardar} className="flex w-full max-w-sm flex-col gap-4 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
            <div className="flex items-center gap-3">
              <FotoProducto producto={contando} tamano="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold leading-tight">{contando.nombre}</p>
                <p className="text-sm text-slate-500">{contando.contado ? `El sistema dice que hay ${fmtCantidad(contando.stock, contando.vende_por)}` : 'Nunca se contó'}</p>
              </div>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              ¿Cuántos hay en el estante?{contando.vende_por === 'libra' ? ' (libras)' : ''}
              <input ref={campo} value={cuantos} onChange={e => setCuantos(e.target.value)} inputMode="decimal" placeholder="0" className="rounded-2xl border border-slate-200 px-4 py-4 text-center text-3xl font-black tabular-nums" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setContando(null)} className="rounded-2xl bg-slate-100 py-3 font-semibold">Cancelar</button>
              <button disabled={guardando} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      {escaneando && <Escaner titulo="Escanea lo que vas a contar" onCodigo={alEscanear} onCerrar={() => setEscaneando(false)} />}
      {desconocido !== null && (
        <ProductoDesconocido
          tiendaId={tiendaId}
          desde="conteo"
          codigo={desconocido || null}
          nombreInicial={desconocido ? '' : buscar.trim()}
          productos={productos}
          onListo={p => { setDesconocido(null); setProductos(ps => (ps.some(x => x.id === p.id) ? ps.map(x => (x.id === p.id ? p : x)) : [p, ...ps])); abrir(p) }}
          onCerrar={() => setDesconocido(null)}
        />
      )}
    </div>
  )
}

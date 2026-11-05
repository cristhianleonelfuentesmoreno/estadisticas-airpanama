import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getApprovedUserOrNull } from '@/lib/auth'
import { inicioDeHoyPanama } from '@/lib/tienda/formato'
import type { CierreDia, Estadisticas, Producto, ProductoVendido, ResumenDia, RolTienda, Tienda, VentaDelDia } from '@/lib/tienda/tipos'

// Lecturas de la tienda con el cliente del usuario: la base (RLS) solo devuelve
// lo de los negocios donde es miembro.

export const getMisTiendas = cache(async (): Promise<Tienda[]> => {
  const user = await getApprovedUserOrNull()
  if (!user) return []
  const supabase = await createClient()
  const [{ data: tiendas }, { data: miembros }] = await Promise.all([
    supabase.from('tiendas').select('id, negocio_id, nombre, slug').order('nombre'),
    supabase.from('miembros').select('negocio_id, rol').eq('usuario_id', user.id),
  ])
  const rol = new Map((miembros ?? []).map(m => [m.negocio_id as string, m.rol as RolTienda]))
  return (tiendas ?? []).flatMap(t => (rol.has(t.negocio_id) ? [{ ...t, rol: rol.get(t.negocio_id)! }] : []))
})

export const getTienda = cache(async (slug: string): Promise<Tienda | null> => {
  const tiendas = await getMisTiendas()
  return tiendas.find(t => t.slug === slug) ?? null
})

// Para las pantallas de trabajo (caja, inventario, mercancía, mi negocio): el contador va a sus reportes
export async function getTiendaParaOperar(slug: string): Promise<Tienda | null> {
  const tienda = await getTienda(slug)
  if (tienda?.rol === 'contador') redirect(`/t/${slug}/contador`)
  return tienda
}

type FilaProducto = Omit<Producto, 'stock' | 'precio_venta' | 'costo' | 'itbms' | 'stock_minimo' | 'porcentaje_ganancia'> & {
  porcentaje_ganancia: number | string
  precio_venta: number | string | null
  costo: number | string | null
  stock_minimo: number | string | null
  itbms: number | string
}

function aNumero(v: number | string | null): number | null {
  return v === null ? null : Number(v)
}

// Por defecto solo los que se venden; el inventario pide también los que están en pausa
export async function getProductos(tienda: Tienda, { conPausados = false } = {}): Promise<Producto[]> {
  const supabase = await createClient()
  let consulta = supabase
    .from('productos')
    .select('id, nombre, marca, presentacion, categoria, codigo_barras, vende_por, precio_venta, costo, itbms, imagen_url, stock_minimo, activo, porcentaje_ganancia, vence_el')
    .eq('negocio_id', tienda.negocio_id)
  if (!conPausados) consulta = consulta.eq('activo', true)
  const [{ data: productos }, { data: stock }] = await Promise.all([
    consulta.order('nombre').returns<FilaProducto[]>(),
    supabase.from('stock').select('producto_id, cantidad').eq('tienda_id', tienda.id),
  ])
  const porProducto = new Map((stock ?? []).map(s => [s.producto_id as string, Number(s.cantidad)]))
  return (productos ?? []).map(p => ({
    ...p,
    precio_venta: aNumero(p.precio_venta),
    costo: aNumero(p.costo),
    stock_minimo: aNumero(p.stock_minimo),
    itbms: Number(p.itbms),
    porcentaje_ganancia: Number(p.porcentaje_ganancia),
    stock: porProducto.get(p.id) ?? 0,
    contado: porProducto.has(p.id),
  }))
}

export async function getResumenDia(tienda: Tienda): Promise<ResumenDia> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('resumen_dia', { p_tienda: tienda.id })
  if (error || !data) throw new Error('No se pudo leer el resumen del día')
  const r = data as Record<string, string | number>
  const n = (k: string) => Number(r[k] ?? 0)
  return {
    fecha: String(r.fecha), base_caja: n('base_caja'), ventas_cantidad: n('ventas_cantidad'), total_ventas: n('total_ventas'),
    efectivo: n('efectivo'), yappy: n('yappy'), tarjeta: n('tarjeta'), ganancia: n('ganancia'), ventas_sin_costo: n('ventas_sin_costo'),
  }
}

type FilaVenta = {
  id: string; total: string | number; metodo_pago: VentaDelDia['metodo_pago']; creado_en: string
  anulada_en: string | null; motivo_anulacion: string | null
  ventas_lineas: { cantidad: string | number; subtotal: string | number; productos: { nombre: string; vende_por: VentaDelDia['lineas'][number]['vende_por'] } | null }[]
}

export async function getVentasHoy(tienda: Tienda): Promise<VentaDelDia[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ventas')
    .select('id, total, metodo_pago, creado_en, anulada_en, motivo_anulacion, ventas_lineas(cantidad, subtotal, productos(nombre, vende_por))')
    .eq('tienda_id', tienda.id)
    .gte('creado_en', inicioDeHoyPanama())
    .order('creado_en', { ascending: false })
    .returns<FilaVenta[]>()
  return (data ?? []).map(v => ({
    id: v.id, total: Number(v.total), metodo_pago: v.metodo_pago, creado_en: v.creado_en,
    anulada_en: v.anulada_en, motivo_anulacion: v.motivo_anulacion,
    lineas: v.ventas_lineas.map(l => ({
      nombre: l.productos?.nombre ?? 'Producto', vende_por: l.productos?.vende_por ?? 'unidad',
      cantidad: Number(l.cantidad), subtotal: Number(l.subtotal),
    })),
  }))
}

export async function getCierreHoy(tienda: Tienda, fecha: string): Promise<CierreDia | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('cierres_caja')
    .select('fecha, efectivo_esperado, efectivo_contado, diferencia, total_ventas, ganancia, creado_en')
    .eq('tienda_id', tienda.id)
    .eq('fecha', fecha)
    .maybeSingle()
  if (!data) return null
  return {
    fecha: data.fecha, creado_en: data.creado_en, efectivo_esperado: Number(data.efectivo_esperado),
    efectivo_contado: Number(data.efectivo_contado), diferencia: Number(data.diferencia),
    total_ventas: Number(data.total_ventas), ganancia: Number(data.ganancia),
  }
}

type NumeroJson = number | string | null

function aNumeros<T extends Record<string, unknown>>(fila: T, claves: (keyof T)[]): T {
  const copia = { ...fila }
  for (const k of claves) copia[k] = (fila[k] === null ? null : Number(fila[k] as NumeroJson)) as T[keyof T]
  return copia
}

export async function getEstadisticas(tienda: Tienda, desde: string, hasta: string): Promise<Estadisticas> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('estadisticas', { p_tienda: tienda.id, p_desde: desde, p_hasta: hasta })
  if (error || !data) throw new Error('No se pudieron leer las estadísticas')
  const r = data as Record<string, unknown>
  const n = (k: string) => Number((r[k] as NumeroJson) ?? 0)
  const lista = <T extends Record<string, unknown>>(k: string, claves: (keyof T)[]) =>
    ((r[k] as T[] | null) ?? []).map(f => aNumeros(f, claves))
  return {
    total: n('total'), ventas: n('ventas'), ganancia: n('ganancia'), ventas_sin_costo: n('ventas_sin_costo'),
    total_anterior: n('total_anterior'), perdidas: n('perdidas'), quietos_cantidad: n('quietos_cantidad'), quietos_valor: n('quietos_valor'),
    por_dia: lista<{ dia: string; total: number }>('por_dia', ['total']),
    metodos: Object.fromEntries(Object.entries((r.metodos as Record<string, NumeroJson>) ?? {}).map(([m, v]) => [m, Number(v)])),
    mas_vendidos: lista<ProductoVendido>('mas_vendidos', ['cantidad', 'importe', 'ganancia']),
    mas_ganancia: lista<ProductoVendido>('mas_ganancia', ['cantidad', 'importe', 'ganancia']),
    quietos: lista<Estadisticas['quietos'][number]>('quietos', ['cantidad', 'valor']),
    primera_venta: (r.primera_venta as string | null) ?? null,
    dias_vendiendo: r.primera_venta ? (Date.now() - new Date(r.primera_venta as string).getTime()) / 86_400_000 : 0,
  }
}

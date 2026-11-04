import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getApprovedUserOrNull } from '@/lib/auth'
import { inicioDeHoyPanama } from '@/lib/tienda/formato'
import type { CierreDia, Producto, ResumenDia, Tienda, VentaDelDia } from '@/lib/tienda/tipos'

// Lecturas de la tienda con el cliente del usuario: la base (RLS) solo devuelve
// lo de los negocios donde es miembro.

export const getMisTiendas = cache(async (): Promise<Tienda[]> => {
  const user = await getApprovedUserOrNull()
  if (!user) return []
  const supabase = await createClient()
  const { data } = await supabase.from('tiendas').select('id, negocio_id, nombre, slug').order('nombre')
  return data ?? []
})

export const getTienda = cache(async (slug: string): Promise<Tienda | null> => {
  const tiendas = await getMisTiendas()
  return tiendas.find(t => t.slug === slug) ?? null
})

type FilaProducto = Omit<Producto, 'stock' | 'precio_venta' | 'costo' | 'itbms'> & {
  precio_venta: number | string | null
  costo: number | string | null
  itbms: number | string
}

function aNumero(v: number | string | null): number | null {
  return v === null ? null : Number(v)
}

export async function getProductos(tienda: Tienda): Promise<Producto[]> {
  const supabase = await createClient()
  const [{ data: productos }, { data: stock }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, marca, presentacion, categoria, codigo_barras, vende_por, precio_venta, costo, itbms, imagen_url')
      .eq('negocio_id', tienda.negocio_id)
      .eq('activo', true)
      .order('nombre')
      .returns<FilaProducto[]>(),
    supabase.from('stock').select('producto_id, cantidad').eq('tienda_id', tienda.id),
  ])
  const porProducto = new Map((stock ?? []).map(s => [s.producto_id as string, Number(s.cantidad)]))
  return (productos ?? []).map(p => ({
    ...p,
    precio_venta: aNumero(p.precio_venta),
    costo: aNumero(p.costo),
    itbms: Number(p.itbms),
    stock: porProducto.get(p.id) ?? 0,
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

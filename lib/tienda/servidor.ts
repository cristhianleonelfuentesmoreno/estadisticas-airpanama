import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getApprovedUserOrNull } from '@/lib/auth'
import type { Producto, Tienda } from '@/lib/tienda/tipos'

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

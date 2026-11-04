'use server'

import { revalidatePath } from 'next/cache'
import { requireApprovedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getMisTiendas } from '@/lib/tienda/servidor'
import type {
  LineaEntrada, LineaVenta, MetodoPago, Resultado, SugerenciaProducto, Tienda, VendePor,
} from '@/lib/tienda/tipos'

// Cada acción es un endpoint público: primero el usuario, después la tienda.
// La base vuelve a validar todo (RLS y las funciones registrar_*).

async function tiendaDelUsuario(tiendaId: string): Promise<Tienda> {
  await requireApprovedUser()
  const tienda = (await getMisTiendas()).find(t => t.id === tiendaId)
  if (!tienda) throw new Error('No autorizado')
  return tienda
}

function texto(v: unknown, max = 120): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t.length ? t : null
}

function numeroValido(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

const CODIGO = /^[0-9A-Za-z-]{4,32}$/

// ---------- Catálogo abierto (Open Food Facts) ----------

export async function buscarEnCatalogoAbierto(codigo: string): Promise<SugerenciaProducto | null> {
  await requireApprovedUser()
  if (!/^\d{8,14}$/.test(codigo)) return null
  try {
    const r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=product_name,product_name_es,brands,quantity,image_front_small_url`,
      { headers: { 'User-Agent': 'ValisVentas/0.1' }, signal: AbortSignal.timeout(5000), cache: 'no-store' },
    )
    if (!r.ok) return null
    const d = (await r.json()) as {
      status?: number
      product?: { product_name?: string; product_name_es?: string; brands?: string; quantity?: string; image_front_small_url?: string }
    }
    if (d.status !== 1 || !d.product) return null
    const p = d.product
    const sugerencia: SugerenciaProducto = {
      nombre: texto(p.product_name_es) ?? texto(p.product_name),
      marca: texto(p.brands?.split(',')[0]),
      presentacion: texto(p.quantity, 40),
      imagen_url: p.image_front_small_url?.startsWith('https://') ? p.image_front_small_url : null,
    }
    return sugerencia.nombre || sugerencia.imagen_url ? sugerencia : null
  } catch {
    return null
  }
}

// ---------- Productos ----------

export type ProductoNuevo = {
  nombre: string
  marca?: string | null
  presentacion?: string | null
  categoria?: string | null
  codigo_barras?: string | null
  vende_por: VendePor
  precio_venta?: number | null
  itbms?: number
  imagen_url?: string | null
}

export async function crearProducto(tiendaId: string, datos: ProductoNuevo): Promise<Resultado<{ id: string }>> {
  const user = await requireApprovedUser()
  const tienda = await tiendaDelUsuario(tiendaId)
  const nombre = texto(datos.nombre)
  if (!nombre) return { ok: false, error: 'Falta el nombre del producto' }
  const codigo = texto(datos.codigo_barras, 32)
  if (codigo && !CODIGO.test(codigo)) return { ok: false, error: 'El código de barras no es válido' }
  const imagen = texto(datos.imagen_url, 500)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .insert({
      negocio_id: tienda.negocio_id,
      nombre,
      marca: texto(datos.marca),
      presentacion: texto(datos.presentacion, 40),
      categoria: texto(datos.categoria, 60),
      codigo_barras: codigo,
      vende_por: datos.vende_por === 'libra' ? 'libra' : 'unidad',
      precio_venta: numeroValido(datos.precio_venta),
      itbms: datos.itbms === 7 ? 7 : 0,
      imagen_url: imagen?.startsWith('https://') ? imagen : null,
      creado_por: user.id,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Ya hay un producto con ese código de barras' }
    return { ok: false, error: 'No se pudo guardar el producto' }
  }
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: { id: data.id } }
}

export type CambiosProducto = {
  nombre?: string
  precio_venta?: number | null
  codigo_barras?: string | null
  imagen_url?: string | null
}

export async function actualizarProducto(
  tiendaId: string, productoId: string, cambios: CambiosProducto,
): Promise<Resultado> {
  const tienda = await tiendaDelUsuario(tiendaId)
  const fila: Record<string, string | number | null> = {}
  if (cambios.nombre !== undefined) {
    const nombre = texto(cambios.nombre)
    if (!nombre) return { ok: false, error: 'Falta el nombre del producto' }
    fila.nombre = nombre
  }
  if (cambios.precio_venta !== undefined) fila.precio_venta = numeroValido(cambios.precio_venta)
  if (cambios.codigo_barras !== undefined) {
    const codigo = texto(cambios.codigo_barras, 32)
    if (codigo && !CODIGO.test(codigo)) return { ok: false, error: 'El código de barras no es válido' }
    fila.codigo_barras = codigo
  }
  if (cambios.imagen_url !== undefined) {
    const imagen = texto(cambios.imagen_url, 500)
    fila.imagen_url = imagen?.startsWith('https://') ? imagen : null
  }
  if (!Object.keys(fila).length) return { ok: true, data: null }

  const supabase = await createClient()
  const { error } = await supabase
    .from('productos')
    .update(fila)
    .eq('id', productoId)
    .eq('negocio_id', tienda.negocio_id)
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Otro producto ya tiene ese código de barras' }
    return { ok: false, error: 'No se pudo guardar el cambio' }
  }
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: null }
}

// ---------- Ventas y facturas (las escribe la base en una sola transacción) ----------

const METODOS: MetodoPago[] = ['efectivo', 'yappy', 'tarjeta']

export async function registrarVenta(
  tiendaId: string, metodo: MetodoPago, lineas: LineaVenta[],
): Promise<Resultado<{ id: string }>> {
  const tienda = await tiendaDelUsuario(tiendaId)
  if (!METODOS.includes(metodo)) return { ok: false, error: 'Método de pago inválido' }
  const limpias = lineas
    .map(l => ({ producto_id: l.producto_id, cantidad: numeroValido(l.cantidad), precio_unitario: numeroValido(l.precio_unitario) }))
    .filter(l => typeof l.producto_id === 'string' && l.cantidad && l.cantidad > 0)
  if (!limpias.length) return { ok: false, error: 'La venta no tiene productos' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_tienda: tienda.id, p_metodo_pago: metodo, p_lineas: limpias,
  })
  if (error) return { ok: false, error: error.message.includes('no tiene precio') ? error.message : 'No se pudo registrar la venta' }
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: { id: data as string } }
}

export async function registrarEntrada(
  tiendaId: string, proveedor: string, numeroFactura: string, lineas: LineaEntrada[],
): Promise<Resultado<{ id: string }>> {
  const tienda = await tiendaDelUsuario(tiendaId)
  const prov = texto(proveedor)
  if (!prov) return { ok: false, error: 'Falta el proveedor' }
  const limpias = lineas
    .map(l => ({ producto_id: l.producto_id, cantidad: numeroValido(l.cantidad), costo_unitario: numeroValido(l.costo_unitario) }))
    .filter(l => typeof l.producto_id === 'string' && l.cantidad && l.cantidad > 0 && l.costo_unitario !== null)
  if (!limpias.length) return { ok: false, error: 'La factura no tiene productos con cantidad y costo' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('registrar_entrada', {
    p_tienda: tienda.id, p_proveedor: prov, p_numero_factura: texto(numeroFactura, 60) ?? '', p_lineas: limpias,
  })
  if (error) return { ok: false, error: 'No se pudo registrar la factura' }
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: { id: data as string } }
}

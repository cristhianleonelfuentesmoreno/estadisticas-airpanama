'use server'

import { revalidatePath } from 'next/cache'
import { requireApprovedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMisTiendas } from '@/lib/tienda/servidor'
import { hoyPanama, normalizarCodigo, precioParaGanar, precioSugerido, venceQueda } from '@/lib/tienda/formato'
import { emparejar, type Coincidencia } from '@/lib/tienda/emparejar'
import { anotar as anotarUso } from '@/lib/tienda/uso'
import { FacturaIaError, leerFactura, type FacturaLeida, type LineaLeida } from '@/lib/tienda/factura-ia'
import type {
  LineaEntrada, LineaVenta, MetodoPago, MotivoAjuste, Resultado, SugerenciaProducto, Tienda, VendePor,
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

// AAAA-MM-DD de una fecha que existe
function fechaValida(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T12:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v
}

function numeroValido(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

const CODIGO = /^[0-9A-Za-z-]{4,32}$/

// ---------- Catálogo: primero el de Valis (fotos que sube el administrador), después Open Food Facts ----------

export async function buscarEnCatalogoAbierto(codigo: string): Promise<SugerenciaProducto | null> {
  await requireApprovedUser()
  if (!/^\d{8,14}$/.test(codigo)) return null
  const supabase = await createClient()
  const { data: propio } = await supabase
    .from('catalogo')
    .select('nombre, marca, presentacion, categoria, imagen_url')
    .eq('codigo', normalizarCodigo(codigo))
    .maybeSingle()
  if (propio) {
    return {
      nombre: propio.nombre as string,
      marca: (propio.marca as string | null) ?? null,
      presentacion: (propio.presentacion as string | null) ?? null,
      categoria: (propio.categoria as string | null) ?? null,
      imagen_url: (propio.imagen_url as string | null) ?? null,
    }
  }
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

export async function crearProducto(tiendaId: string, datos: ProductoNuevo, desde = ''): Promise<Resultado<{ id: string }>> {
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
  anotarUso(supabase, tienda.id, 'producto_creado', { sin_codigo: !codigo, vende_por: datos.vende_por === 'libra' ? 'libra' : 'unidad', desde: texto(desde, 30) })
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: { id: data.id } }
}

export type CambiosProducto = {
  nombre?: string
  precio_venta?: number | null
  // Lo que le cuesta cada unidad a la tienda (también lo actualizan las facturas)
  costo?: number | null
  stock_minimo?: number | null
  codigo_barras?: string | null
  imagen_url?: string | null
  categoria?: string | null
  // false = en pausa
  activo?: boolean
  porcentaje_ganancia?: number
  vence_el?: string | null
}

export async function actualizarProducto(
  tiendaId: string, productoId: string, cambios: CambiosProducto, desde = '',
): Promise<Resultado> {
  const tienda = await tiendaDelUsuario(tiendaId)
  const fila: Record<string, string | number | boolean | null> = {}
  if (cambios.nombre !== undefined) {
    const nombre = texto(cambios.nombre)
    if (!nombre) return { ok: false, error: 'Falta el nombre del producto' }
    fila.nombre = nombre
  }
  if (cambios.precio_venta !== undefined) fila.precio_venta = numeroValido(cambios.precio_venta)
  if (cambios.costo !== undefined) fila.costo = numeroValido(cambios.costo)
  if (cambios.stock_minimo !== undefined) fila.stock_minimo = numeroValido(cambios.stock_minimo)
  if (cambios.categoria !== undefined) fila.categoria = texto(cambios.categoria, 60)
  if (cambios.activo !== undefined) fila.activo = cambios.activo === true
  if (cambios.vence_el !== undefined) {
    const fecha = fechaValida(cambios.vence_el)
    if (cambios.vence_el && !fecha) return { ok: false, error: 'La fecha de vencimiento no es válida' }
    fila.vence_el = fecha
  }
  if (cambios.porcentaje_ganancia !== undefined) {
    const pct = Number(cambios.porcentaje_ganancia)
    if (!Number.isFinite(pct) || pct < 0 || pct >= 100) return { ok: false, error: 'El porcentaje de ganancia va de 0 a 99' }
    fila.porcentaje_ganancia = Math.round(pct * 100) / 100
  }
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
  anotarUso(supabase, tienda.id, 'producto_editado', { campos: Object.keys(fila), desde: texto(desde, 30) })
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
  anotarUso(supabase, tienda.id, 'venta', { metodo, lineas: limpias.length })
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: { id: data as string } }
}

// Producto al que le subió el costo y ya no deja su %: el dueño decide si sube el precio
export type SugerenciaPrecio = { producto_id: string; nombre: string; precio: number; sugerido: number; costo: number; porcentaje: number }

export async function registrarEntrada(
  tiendaId: string, proveedor: string, numeroFactura: string, lineas: LineaEntrada[],
): Promise<Resultado<{ id: string; sugerencias: SugerenciaPrecio[] }>> {
  const tienda = await tiendaDelUsuario(tiendaId)
  const prov = texto(proveedor)
  if (!prov) return { ok: false, error: 'Falta el proveedor' }
  const limpias = lineas
    .map(l => ({ producto_id: l.producto_id, cantidad: numeroValido(l.cantidad), costo_unitario: numeroValido(l.costo_unitario) }))
    .filter(l => typeof l.producto_id === 'string' && l.cantidad && l.cantidad > 0 && l.costo_unitario !== null)
  if (!limpias.length) return { ok: false, error: 'La factura no tiene productos con cantidad y costo' }

  const supabase = await createClient()
  const ids = [...new Set(limpias.map(l => l.producto_id))]
  // El costo de antes, para saber a cuáles les subió
  const { data: antes } = await supabase.from('productos').select('id, costo').eq('negocio_id', tienda.negocio_id).in('id', ids)
  const costoAntes = new Map((antes ?? []).map(p => [p.id as string, p.costo === null ? null : Number(p.costo)]))
  const { data, error } = await supabase.rpc('registrar_entrada', {
    p_tienda: tienda.id, p_proveedor: prov, p_numero_factura: texto(numeroFactura, 60) ?? '', p_lineas: limpias,
  })
  if (error) return { ok: false, error: 'No se pudo registrar la factura' }

  // Después de guardar la factura, en cada producto que llegó:
  // - la fecha de vencimiento pasa al producto (queda la que vence primero);
  // - si no tenía precio, se le pone con su % de ganancia y el costo nuevo.
  const vencen = new Map<string, string>()
  for (const l of lineas) {
    const fecha = fechaValida(l.vence_el)
    if (fecha && typeof l.producto_id === 'string') vencen.set(l.producto_id, venceQueda(vencen.get(l.producto_id) ?? null, fecha, hoyPanama()))
  }
  const { data: llegaron } = await supabase
    .from('productos')
    .select('id, nombre, vence_el, precio_venta, costo, porcentaje_ganancia')
    .eq('negocio_id', tienda.negocio_id)
    .in('id', ids)
  const sugerencias: SugerenciaPrecio[] = []
  await Promise.all((llegaron ?? []).flatMap(p => {
    const cambios: { vence_el?: string; precio_venta?: number } = {}
    const fecha = vencen.get(p.id as string)
    if (fecha) cambios.vence_el = venceQueda(p.vence_el as string | null, fecha, hoyPanama())
    const costo = Number(p.costo)
    if (p.precio_venta === null && p.costo !== null && costo > 0) cambios.precio_venta = precioParaGanar(costo, Number(p.porcentaje_ganancia))
    const precio = p.precio_venta === null ? null : Number(p.precio_venta)
    const sugerido = p.costo === null ? null : precioSugerido(precio, costoAntes.get(p.id as string) ?? null, costo, Number(p.porcentaje_ganancia))
    if (sugerido !== null && precio !== null) {
      sugerencias.push({ producto_id: p.id as string, nombre: p.nombre as string, precio, sugerido, costo, porcentaje: Number(p.porcentaje_ganancia) })
    }
    if (!Object.keys(cambios).length) return []
    return [supabase.from('productos').update(cambios).eq('id', p.id).eq('negocio_id', tienda.negocio_id)]
  }))
  anotarUso(supabase, tienda.id, 'factura', { lineas: limpias.length, con_vence: vencen.size, sugerencias: sugerencias.length })
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: { id: data as string, sugerencias } }
}

// Corregir una factura ya guardada. La base ajusta el inventario con un movimiento de
// corrección y el costo del producto si es su factura más reciente. Los precios de venta
// que se cambiaron ahí mismo se guardan en cada producto.
export type CambioLineaFactura = { id: number; cantidad: number; costo_unitario: number }
export type CambioPrecioFactura = { producto_id: string; precio_venta: number; porcentaje_ganancia: number }

export async function editarFactura(
  tiendaId: string, entradaId: string, proveedor: string, numeroFactura: string,
  lineas: CambioLineaFactura[], precios: CambioPrecioFactura[],
): Promise<Resultado> {
  const tienda = await tiendaDelUsuario(tiendaId)
  const prov = texto(proveedor)
  if (!prov) return { ok: false, error: 'Falta el proveedor' }
  const limpias = lineas.map(l => ({ id: Number(l.id), cantidad: numeroValido(l.cantidad), costo_unitario: numeroValido(l.costo_unitario) }))
  if (limpias.some(l => !Number.isInteger(l.id) || l.cantidad === null || l.cantidad < 0 || l.costo_unitario === null || l.costo_unitario < 0)) {
    return { ok: false, error: 'Revisa las cantidades y los costos' }
  }
  const nuevosPrecios = precios.map(p => ({ producto_id: p.producto_id, precio_venta: numeroValido(p.precio_venta), porcentaje_ganancia: numeroValido(p.porcentaje_ganancia) }))
  if (nuevosPrecios.some(p => typeof p.producto_id !== 'string' || p.precio_venta === null || p.precio_venta < 0
    || p.porcentaje_ganancia === null || p.porcentaje_ganancia < 0 || p.porcentaje_ganancia >= 100)) {
    return { ok: false, error: 'Revisa los precios de venta' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('editar_entrada', {
    p_entrada: entradaId, p_proveedor: prov, p_numero_factura: texto(numeroFactura, 60) ?? '', p_lineas: limpias,
  })
  if (error) {
    return { ok: false, error: error.message.includes('al menos un producto') ? 'La factura tiene que quedar con al menos un producto' : 'No se pudo guardar la factura' }
  }
  const fallos = await Promise.all(nuevosPrecios.map(p =>
    supabase.from('productos').update({ precio_venta: p.precio_venta, porcentaje_ganancia: Math.round((p.porcentaje_ganancia ?? 0) * 100) / 100 }).eq('id', p.producto_id).eq('negocio_id', tienda.negocio_id).then(r => r.error),
  ))
  anotarUso(supabase, tienda.id, 'factura_editada', { lineas: limpias.length, precios: nuevosPrecios.length })
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  if (fallos.some(Boolean)) return { ok: false, error: 'La factura se guardó, pero algunos precios no' }
  return { ok: true, data: null }
}

// ---------- Anular, mercancía sin factura y cierre del día ----------

export async function anularVenta(tiendaId: string, ventaId: string, motivo: string): Promise<Resultado> {
  const tienda = await tiendaDelUsuario(tiendaId)
  const supabase = await createClient()
  const { error } = await supabase.rpc('anular_venta', { p_venta: ventaId, p_motivo: texto(motivo, 200) ?? '' })
  if (error) return { ok: false, error: error.message.includes('ya estaba anulada') ? 'Esta venta ya estaba anulada' : 'No se pudo anular la venta' }
  anotarUso(supabase, tienda.id, 'venta_anulada')
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: null }
}

const MOTIVOS: MotivoAjuste[] = ['regalia', 'compra_sin_factura', 'danado', 'consumo', 'conteo']

export async function registrarAjuste(
  tiendaId: string, productoId: string, motivo: MotivoAjuste, cantidad: number, costo: number | null, nota: string,
): Promise<Resultado<{ cambio: number }>> {
  const tienda = await tiendaDelUsuario(tiendaId)
  if (!MOTIVOS.includes(motivo)) return { ok: false, error: 'Motivo inválido' }
  const cant = numeroValido(cantidad)
  if (cant === null || (motivo !== 'conteo' && cant === 0)) return { ok: false, error: 'Escribe una cantidad válida' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('registrar_ajuste', {
    p_tienda: tienda.id, p_producto: productoId, p_motivo: motivo, p_cantidad: cant,
    p_costo: costo === null ? null : numeroValido(costo), p_nota: texto(nota, 200) ?? '',
  })
  if (error) return { ok: false, error: 'No se pudo guardar' }
  anotarUso(supabase, tienda.id, 'ajuste', { motivo })
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: { cambio: Number(data) } }
}

export async function cerrarCaja(tiendaId: string, efectivoContado: number, nota: string): Promise<Resultado> {
  const tienda = await tiendaDelUsuario(tiendaId)
  const contado = numeroValido(efectivoContado)
  if (contado === null) return { ok: false, error: 'Escribe cuánto efectivo contaste' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('cerrar_caja', { p_tienda: tienda.id, p_efectivo_contado: contado, p_nota: texto(nota, 300) ?? '' })
  if (error) return { ok: false, error: 'No se pudo cerrar la caja' }
  anotarUso(supabase, tienda.id, 'cierre')
  revalidatePath(`/t/${tienda.slug}`, 'layout')
  return { ok: true, data: null }
}

// ---------- Leer una factura con foto (Claude) ----------

const MIME_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'] as const
type MimeImagen = (typeof MIME_IMAGEN)[number]

export type LineaFacturaFoto = LineaLeida & { coincidencia: Coincidencia }

// La clave vive cifrada en la bóveda de Supabase (la pone el administrador en /admin);
// si no hay, se usa ANTHROPIC_API_KEY del servidor
async function claveYModelo(): Promise<{ clave: string | null; modelo: string }> {
  const admin = createAdminClient()
  const [{ data: clave }, { data: config }] = await Promise.all([
    admin.rpc('clave_ia'),
    admin.from('config_ia').select('modelo').eq('id', 1).single(),
  ])
  return { clave: (clave as string | null) ?? process.env.ANTHROPIC_API_KEY ?? null, modelo: config?.modelo ?? 'claude-haiku-5-5' }
}

export async function leerFacturaConFoto(
  tiendaId: string, imagenBase64: string, mime: string,
): Promise<Resultado<{ proveedor: string | null; numero_factura: string | null; lineas: LineaFacturaFoto[]; quedan: number }>> {
  const tienda = await tiendaDelUsuario(tiendaId)
  const tipo = MIME_IMAGEN.find(m => m === mime)
  if (!tipo) return { ok: false, error: 'La foto debe ser JPG, PNG o WEBP' }
  if (typeof imagenBase64 !== 'string' || imagenBase64.length > 7_000_000) return { ok: false, error: 'La foto es muy grande' }

  const { clave, modelo } = await claveYModelo()
  if (!clave) return { ok: false, error: 'La lectura con foto todavía no está activada. Pídele al administrador que la active.' }

  const supabase = await createClient()
  const { data: reserva, error: errCupo } = await supabase.rpc('reservar_ia', { p_tienda: tienda.id })
  if (errCupo || !reserva) return { ok: false, error: 'No se pudo leer la factura' }
  const { quedan, limite, uso_id: usoId } = reserva as { quedan: number; limite: number; uso_id?: number }
  if (quedan < 0 || !usoId) return { ok: false, error: `Ya se leyeron ${limite} facturas hoy. Mañana se puede de nuevo, o regístrala a mano.` }

  // El consumo se anota con el cliente admin: la tienda no puede escribir en usos_ia
  const anotar = (datos: Record<string, string | number | boolean | null>) =>
    createAdminClient().from('usos_ia').update(datos).eq('id', usoId).then(() => undefined)

  let factura: FacturaLeida
  try {
    const r = await leerFactura(clave, modelo, imagenBase64, tipo satisfies MimeImagen)
    factura = r.factura
    await anotar({ ...r.consumo, ok: true, lineas: factura.lineas.length })
  } catch (e) {
    const err = e instanceof FacturaIaError ? e : new FacturaIaError('ilegible')
    await anotar({ ok: false, error: err.motivo, modelo, ...(err.consumo ?? {}) })
    return {
      ok: false,
      error: err.motivo === 'ocupado'
        ? 'El servicio de lectura está muy ocupado. Prueba otra vez en un minuto.'
        : err.motivo === 'clave-invalida' ? 'La lectura con foto no está disponible ahora. Avísale al administrador.'
          : 'No pude leer la factura. Toma la foto de frente, con buena luz y que se vea completa.',
    }
  }

  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, codigo_barras')
    .eq('negocio_id', tienda.negocio_id)
    .eq('activo', true)
  const lineas = factura.lineas.map(l => ({ ...l, coincidencia: emparejar(l, productos ?? []) }))
  return { ok: true, data: { proveedor: factura.proveedor, numero_factura: factura.numero_factura, lineas, quedan } }
}

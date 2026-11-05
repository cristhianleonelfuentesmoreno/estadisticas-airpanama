'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireApprovedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { normalizarCodigo, revisarCodigo } from '@/lib/tienda/formato'
import type { Resultado } from '@/lib/tienda/tipos'

// Catálogo de Valis: el administrador sube foto y datos de cada producto y todas las tiendas
// los reciben. Con código de barras o sin él (especias y granos que se venden sueltos).
// Solo datos del producto; nunca precios ni ventas de nadie.

// Una fila de la lista: lo que ya está en el catálogo o un código que usan las tiendas y todavía no
export type ItemCatalogo = {
  id: string | null
  codigo: string | null
  nombre: string
  marca: string | null
  presentacion: string | null
  categoria: string | null
  imagen_url: string | null
  por_paquete: number | null
  vende_suelto: boolean
  // Cuántas tiendas tienen un producto con ese código
  tiendas: number
}

export type DatosCatalogo = {
  id: string | null
  codigo: string
  nombre: string
  marca: string
  presentacion: string
  categoria: string
  por_paquete: string
  vende_suelto: boolean
}

const COLUMNAS = 'id, codigo, nombre, marca, presentacion, categoria, imagen_url, por_paquete, vende_suelto'

const limpio = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ').slice(0, max)
  return t.length ? t : null
}

// Un UPC-A puede estar guardado con o sin el 0 de adelante: los dos son el mismo producto
const variantes = (codigo: string) => (codigo.length === 12 ? [codigo, `0${codigo}`] : [codigo])

type Fila = Omit<ItemCatalogo, 'tiendas'>

export async function listarCatalogo(): Promise<ItemCatalogo[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const [{ data: catalogo }, { data: productos }] = await Promise.all([
    admin.from('catalogo').select(COLUMNAS),
    admin.from('productos').select('codigo_barras, nombre, negocio_id').not('codigo_barras', 'is', null).eq('activo', true),
  ])
  const negociosDe = new Map<string, Set<string>>()
  const nombreDe = new Map<string, string>()
  for (const p of productos ?? []) {
    const codigo = normalizarCodigo(p.codigo_barras as string)
    if (!revisarCodigo(codigo).valido) continue
    const s = negociosDe.get(codigo) ?? new Set<string>()
    s.add(p.negocio_id as string)
    negociosDe.set(codigo, s)
    if (!nombreDe.has(codigo)) nombreDe.set(codigo, p.nombre as string)
  }
  const items: ItemCatalogo[] = ((catalogo ?? []) as Fila[]).map(c => ({ ...c, tiendas: c.codigo ? negociosDe.get(c.codigo)?.size ?? 0 : 0 }))
  const yaEstan = new Set(items.map(i => i.codigo))
  for (const [codigo, negocios] of negociosDe) {
    if (yaEstan.has(codigo)) continue
    items.push({
      id: null, codigo, nombre: nombreDe.get(codigo) ?? codigo, marca: null, presentacion: null, categoria: null,
      imagen_url: null, por_paquete: null, vende_suelto: false, tiendas: negocios.size,
    })
  }
  // Primero lo que falta, con los que más tiendas usan arriba; después lo completo por nombre
  return items.sort((a, b) =>
    Number(Boolean(a.imagen_url)) - Number(Boolean(b.imagen_url)) || b.tiendas - a.tiendas || a.nombre.localeCompare(b.nombre))
}

export async function guardarEnCatalogo(
  datos: DatosCatalogo,
  foto: { base64: string; tipo: 'image/webp' | 'image/jpeg' } | null,
): Promise<Resultado<{ tiendasConFoto: number }>> {
  const actor = await requireAdmin()
  const conCodigo = datos.codigo.trim() !== ''
  const codigo = conCodigo ? normalizarCodigo(datos.codigo) : null
  if (codigo) {
    const revision = revisarCodigo(codigo)
    if (!revision.valido) {
      return { ok: false, error: revision.debia ? `El código no cuadra: el último dígito debería ser ${revision.debia}. Revísalo.` : 'Ese no es un código de barras válido' }
    }
  }
  const nombre = limpio(datos.nombre, 120)
  if (!nombre) return { ok: false, error: 'Falta el nombre del producto' }
  const porPaquete = datos.vende_suelto ? Number(datos.por_paquete) : null
  if (porPaquete !== null && (!Number.isInteger(porPaquete) || porPaquete < 2 || porPaquete > 1000)) {
    return { ok: false, error: 'Escribe cuántas unidades trae el paquete (de 2 a 1000)' }
  }

  const admin = createAdminClient()
  let imagen: string | undefined
  if (foto) {
    if (foto.tipo !== 'image/webp' && foto.tipo !== 'image/jpeg') return { ok: false, error: 'La foto no es válida' }
    const bytes = Buffer.from(foto.base64, 'base64')
    if (!bytes.length || bytes.length > 512 * 1024) return { ok: false, error: 'La foto es muy grande' }
    // Un nombre nuevo cada vez: así las tiendas no ven la foto vieja guardada en el celular
    const ruta = `${codigo ?? 'suelto'}-${Date.now()}.${foto.tipo === 'image/webp' ? 'webp' : 'jpg'}`
    const { error } = await admin.storage.from('catalogo').upload(ruta, bytes, { contentType: foto.tipo, upsert: false })
    if (error) return { ok: false, error: 'No se pudo subir la foto' }
    imagen = admin.storage.from('catalogo').getPublicUrl(ruta).data.publicUrl
  }

  const fila = {
    codigo, nombre,
    marca: limpio(datos.marca, 80),
    presentacion: limpio(datos.presentacion, 40),
    categoria: limpio(datos.categoria, 60),
    por_paquete: porPaquete,
    vende_suelto: datos.vende_suelto === true,
    ...(imagen ? { imagen_url: imagen } : {}),
    actualizado_en: new Date().toISOString(),
    actualizado_por: actor.id,
  }
  const { error } = datos.id
    ? await admin.from('catalogo').update(fila).eq('id', datos.id)
    : codigo
      ? await admin.from('catalogo').upsert(fila, { onConflict: 'codigo' })
      : await admin.from('catalogo').insert(fila)
  if (error) {
    return { ok: false, error: error.code === '23505' ? 'Ya hay un producto con ese código o con ese nombre' : 'No se pudo guardar en el catálogo' }
  }

  // Las tiendas que ya tienen ese producto sin foto la reciben de una vez
  let tiendasConFoto = 0
  if (imagen && codigo) {
    const { data: actualizados } = await admin
      .from('productos')
      .update({ imagen_url: imagen })
      .in('codigo_barras', variantes(codigo))
      .is('imagen_url', null)
      .select('negocio_id')
    tiendasConFoto = new Set((actualizados ?? []).map(p => p.negocio_id as string)).size
  }

  await logAudit({
    tipo_evento: 'edicion', actor, entidad: 'configuracion', entidad_id: codigo ?? datos.id,
    nombre_referencia: codigo ? `${nombre} · ${codigo}` : nombre,
    descripcion: `Guardó ${nombre} en el catálogo${codigo ? '' : ' (sin código)'}${imagen ? ' con foto' : ''}`,
  })
  revalidatePath('/admin')
  return { ok: true, data: { tiendasConFoto } }
}

// Para las tiendas, al crear un producto sin código: lo que se parece en el catálogo
export async function buscarSueltoEnCatalogo(texto: string): Promise<ItemCatalogo[]> {
  await requireApprovedUser()
  const q = texto.trim().replace(/[%_,()]/g, ' ').slice(0, 40)
  if (q.length < 2) return []
  const supabase = await createClient()
  const { data } = await supabase.from('catalogo').select(COLUMNAS).is('codigo', null).ilike('nombre', `%${q}%`).order('nombre').limit(5)
  return ((data ?? []) as Fila[]).map(c => ({ ...c, tiendas: 0 }))
}

// Para la factura: si el catálogo dice que el producto llega en paquete de N y se vende suelto,
// la línea arranca con N unidades por paquete. Se busca por código o, sin código, por el nombre exacto.
export async function paqueteDelCatalogo(codigo: string | null, nombre: string): Promise<number | null> {
  await requireApprovedUser()
  const supabase = await createClient()
  const consulta = supabase.from('catalogo').select('por_paquete').eq('vende_suelto', true).not('por_paquete', 'is', null).limit(1)
  const { data } = codigo && /^\d{8,14}$/.test(codigo)
    ? await consulta.eq('codigo', normalizarCodigo(codigo))
    : await consulta.is('codigo', null).ilike('nombre', nombre.trim().replace(/[%_\\]/g, '\\$&').slice(0, 120))
  const n = Number(data?.[0]?.por_paquete)
  return Number.isInteger(n) && n > 1 ? n : null
}

'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { normalizarCodigo, revisarCodigo } from '@/lib/tienda/formato'
import type { Resultado } from '@/lib/tienda/tipos'

// Catálogo de códigos de Valis: el administrador sube foto y datos de cada código y
// todas las tiendas los reciben. Solo datos del producto; nunca precios ni ventas de nadie.

export type EntradaCatalogo = {
  codigo: string
  nombre: string
  marca: string | null
  presentacion: string | null
  categoria: string | null
  imagen_url: string | null
  actualizado_en: string
}

// Código que usan las tiendas y que todavía no tiene foto en el catálogo
export type CodigoSinFoto = { codigo: string; nombre: string; tiendas: number; enCatalogo: boolean }

const limpio = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ').slice(0, max)
  return t.length ? t : null
}

// Un UPC-A puede estar guardado con o sin el 0 de adelante: los dos son el mismo producto
const variantes = (codigo: string) => (codigo.length === 12 ? [codigo, `0${codigo}`] : [codigo])

export async function listarCatalogo(): Promise<{ catalogo: EntradaCatalogo[]; sinFoto: CodigoSinFoto[] }> {
  await requireAdmin()
  const admin = createAdminClient()
  const [{ data: catalogo }, { data: productos }] = await Promise.all([
    admin.from('catalogo').select('codigo, nombre, marca, presentacion, categoria, imagen_url, actualizado_en').order('actualizado_en', { ascending: false }),
    admin.from('productos').select('codigo_barras, nombre, negocio_id').not('codigo_barras', 'is', null).eq('activo', true),
  ])
  const conFoto = new Set((catalogo ?? []).filter(c => c.imagen_url).map(c => c.codigo as string))
  const enCatalogo = new Set((catalogo ?? []).map(c => c.codigo as string))
  const porCodigo = new Map<string, { nombre: string; negocios: Set<string> }>()
  for (const p of productos ?? []) {
    const codigo = normalizarCodigo(p.codigo_barras as string)
    if (!revisarCodigo(codigo).valido || conFoto.has(codigo)) continue
    const fila = porCodigo.get(codigo) ?? { nombre: p.nombre as string, negocios: new Set<string>() }
    fila.negocios.add(p.negocio_id as string)
    porCodigo.set(codigo, fila)
  }
  const sinFoto = [...porCodigo.entries()]
    .map(([codigo, f]) => ({ codigo, nombre: f.nombre, tiendas: f.negocios.size, enCatalogo: enCatalogo.has(codigo) }))
    .sort((a, b) => b.tiendas - a.tiendas || a.nombre.localeCompare(b.nombre))
  return { catalogo: (catalogo ?? []) as EntradaCatalogo[], sinFoto }
}

// Para llenar el formulario: lo que ya está en el catálogo o, si no, el nombre que le pusieron las tiendas
export async function buscarParaCatalogo(codigoCrudo: string): Promise<EntradaCatalogo | { nombre: string | null; nuevo: true }> {
  await requireAdmin()
  const codigo = normalizarCodigo(codigoCrudo)
  const admin = createAdminClient()
  const { data } = await admin.from('catalogo').select('codigo, nombre, marca, presentacion, categoria, imagen_url, actualizado_en').eq('codigo', codigo).maybeSingle()
  if (data) return data as EntradaCatalogo
  const { data: producto } = await admin.from('productos').select('nombre').in('codigo_barras', variantes(codigo)).limit(1).maybeSingle()
  return { nombre: (producto?.nombre as string | undefined) ?? null, nuevo: true }
}

export async function guardarEnCatalogo(
  datos: { codigo: string; nombre: string; marca: string; presentacion: string; categoria: string },
  foto: { base64: string; tipo: 'image/webp' | 'image/jpeg' } | null,
): Promise<Resultado<{ tiendasConFoto: number }>> {
  const actor = await requireAdmin()
  const codigo = normalizarCodigo(datos.codigo)
  const revision = revisarCodigo(codigo)
  if (!revision.valido) {
    return { ok: false, error: revision.debia ? `El código no cuadra: el último dígito debería ser ${revision.debia}. Revísalo.` : 'Ese no es un código de barras válido' }
  }
  const nombre = limpio(datos.nombre, 120)
  if (!nombre) return { ok: false, error: 'Falta el nombre del producto' }

  const admin = createAdminClient()
  let imagen: string | null | undefined
  if (foto) {
    if (foto.tipo !== 'image/webp' && foto.tipo !== 'image/jpeg') return { ok: false, error: 'La foto no es válida' }
    const bytes = Buffer.from(foto.base64, 'base64')
    if (!bytes.length || bytes.length > 512 * 1024) return { ok: false, error: 'La foto es muy grande' }
    // Un nombre nuevo cada vez: así las tiendas no ven la foto vieja guardada en el celular
    const ruta = `${codigo}-${Date.now()}.${foto.tipo === 'image/webp' ? 'webp' : 'jpg'}`
    const { error } = await admin.storage.from('catalogo').upload(ruta, bytes, { contentType: foto.tipo, upsert: false })
    if (error) return { ok: false, error: 'No se pudo subir la foto' }
    imagen = admin.storage.from('catalogo').getPublicUrl(ruta).data.publicUrl
  }

  const { error } = await admin.from('catalogo').upsert({
    codigo, nombre,
    marca: limpio(datos.marca, 80),
    presentacion: limpio(datos.presentacion, 40),
    categoria: limpio(datos.categoria, 60),
    ...(imagen !== undefined ? { imagen_url: imagen } : {}),
    actualizado_en: new Date().toISOString(),
    actualizado_por: actor.id,
  }, { onConflict: 'codigo' })
  if (error) return { ok: false, error: 'No se pudo guardar en el catálogo' }

  // Las tiendas que ya tienen ese producto sin foto la reciben de una vez
  let tiendasConFoto = 0
  if (imagen) {
    const { data: actualizados } = await admin
      .from('productos')
      .update({ imagen_url: imagen })
      .in('codigo_barras', variantes(codigo))
      .is('imagen_url', null)
      .select('negocio_id')
    tiendasConFoto = new Set((actualizados ?? []).map(p => p.negocio_id as string)).size
  }

  await logAudit({
    tipo_evento: 'edicion', actor, entidad: 'configuracion', entidad_id: codigo,
    nombre_referencia: `${nombre} · ${codigo}`, descripcion: `Guardó ${nombre} en el catálogo de códigos${imagen ? ' con foto' : ''}`,
  })
  revalidatePath('/admin')
  return { ok: true, data: { tiendasConFoto } }
}

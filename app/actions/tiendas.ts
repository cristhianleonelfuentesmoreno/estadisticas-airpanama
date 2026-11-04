'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Resultado } from '@/lib/tienda/tipos'

// Tiendas y sus dueños, desde el panel. Solo el administrador (equipo de Valis Digital).
// El cliente admin se salta RLS: cada acción empieza con requireAdmin().

export type PersonaTienda = {
  usuario_id: string
  nombre: string | null
  email: string
  rol: 'dueno' | 'cajero'
  estado: 'activo' | 'invitado' | 'bloqueado'
}

export type TiendaAdmin = {
  id: string
  negocio_id: string
  negocio: string
  nombre: string
  slug: string
  productos: number
  personas: PersonaTienda[]
}

const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)
const limpio = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')

// "Mini Super San Judas 11" -> "mini-super-san-judas-11"
function slugDe(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'tienda'
}

export async function listarTiendas(): Promise<TiendaAdmin[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const [{ data: tiendas }, { data: miembros }, { data: perfiles }, { data: productos }, usuarios] = await Promise.all([
    admin.from('tiendas').select('id, negocio_id, nombre, slug, negocios(nombre)').order('nombre'),
    admin.from('miembros').select('negocio_id, usuario_id, rol'),
    admin.from('perfiles').select('id, nombre, email, status'),
    admin.from('productos').select('negocio_id').eq('activo', true),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])
  const perfil = new Map((perfiles ?? []).map(p => [p.id as string, p]))
  const entraron = new Set((usuarios.data?.users ?? []).filter(u => u.last_sign_in_at).map(u => u.id))
  const cuenta = new Map<string, number>()
  for (const p of productos ?? []) cuenta.set(p.negocio_id as string, (cuenta.get(p.negocio_id as string) ?? 0) + 1)

  return (tiendas ?? []).map(t => ({
    id: t.id as string,
    negocio_id: t.negocio_id as string,
    negocio: (t.negocios as unknown as { nombre: string } | null)?.nombre ?? '',
    nombre: t.nombre as string,
    slug: t.slug as string,
    productos: cuenta.get(t.negocio_id as string) ?? 0,
    personas: (miembros ?? [])
      .filter(m => m.negocio_id === t.negocio_id)
      .map(m => {
        const p = perfil.get(m.usuario_id as string)
        const estado: PersonaTienda['estado'] = p?.status !== 'aprobado' ? 'bloqueado' : entraron.has(m.usuario_id as string) ? 'activo' : 'invitado'
        return { usuario_id: m.usuario_id as string, nombre: (p?.nombre as string | null) ?? null, email: (p?.email as string) ?? '', rol: m.rol as PersonaTienda['rol'], estado }
      }),
  }))
}

export async function crearTienda(datos: { negocio: string; tienda: string }): Promise<Resultado<{ id: string; negocio_id: string }>> {
  const actor = await requireAdmin()
  const negocio = limpio(datos.negocio, 80)
  const tienda = limpio(datos.tienda, 80) || negocio
  if (!negocio) return { ok: false, error: 'Escribe el nombre del negocio' }

  const admin = createAdminClient()
  const base = slugDe(tienda)
  const { data: usados } = await admin.from('tiendas').select('slug').like('slug', `${base}%`)
  const ocupados = new Set((usados ?? []).map(u => u.slug as string))
  let slug = base
  for (let i = 2; ocupados.has(slug); i++) slug = `${base}-${i}`

  const { data: neg, error: e1 } = await admin.from('negocios').insert({ nombre: negocio }).select('id').single()
  if (e1 || !neg) return { ok: false, error: 'No se pudo crear el negocio' }
  const { data: tie, error: e2 } = await admin.from('tiendas').insert({ negocio_id: neg.id, nombre: tienda, slug }).select('id').single()
  if (e2 || !tie) return { ok: false, error: 'No se pudo crear la tienda' }

  await logAudit({
    tipo_evento: 'creacion', actor, entidad: 'configuracion', entidad_id: tie.id,
    nombre_referencia: tienda, descripcion: `Creó la tienda ${tienda} (${negocio})`,
  })
  revalidatePath('/admin')
  return { ok: true, data: { id: tie.id, negocio_id: neg.id } }
}

// Agrega a una persona como dueña del negocio. Si no tiene cuenta, le llega un correo para crear su contraseña
// (también puede entrar con Google usando ese mismo correo).
export async function agregarDueno(negocioId: string, datos: { email: string; nombre: string }): Promise<Resultado<{ invitado: boolean }>> {
  const actor = await requireAdmin()
  const email = limpio(datos.email, 120).toLowerCase()
  const nombre = limpio(datos.nombre, 80)
  if (!correoValido(email)) return { ok: false, error: 'El correo no es válido' }

  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id, nombre').eq('id', negocioId).single()
  if (!negocio) return { ok: false, error: 'Ese negocio no existe' }

  let usuarioId: string
  let invitado = false
  const { data: existente } = await admin.from('perfiles').select('id, nombre').ilike('email', email).maybeSingle()
  if (existente) {
    usuarioId = existente.id as string
  } else {
    const h = await headers()
    const origin = h.get('origin') ?? `https://${h.get('host')}`
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: nombre || undefined },
      redirectTo: `${origin}/api/auth/confirm?next=/update-password`,
    })
    if (error || !data.user) return { ok: false, error: 'No se pudo enviar la invitación a ese correo' }
    usuarioId = data.user.id
    invitado = true
  }

  // Queda aprobado y con el rol de dueño de negocio (sin acceso al panel de administración)
  const cambios: Record<string, string> = { status: 'aprobado' }
  if (nombre && !existente?.nombre) cambios.nombre = nombre
  if (invitado) cambios.role = 'usuario'
  await admin.from('perfiles').update(cambios).eq('id', usuarioId)

  const { error: eMiembro } = await admin.from('miembros').upsert({ negocio_id: negocioId, usuario_id: usuarioId, rol: 'dueno' }, { onConflict: 'negocio_id,usuario_id' })
  if (eMiembro) return { ok: false, error: 'No se pudo agregar a la tienda' }

  await logAudit({
    tipo_evento: 'edicion', actor, entidad: 'usuario', entidad_id: usuarioId,
    nombre_referencia: email, descripcion: `Agregó a ${email} como dueño de ${negocio.nombre}${invitado ? ' (invitación por correo)' : ''}`,
  })
  revalidatePath('/admin')
  return { ok: true, data: { invitado } }
}

export async function quitarDeTienda(negocioId: string, usuarioId: string): Promise<Resultado> {
  const actor = await requireAdmin()
  const admin = createAdminClient()
  const { data: p } = await admin.from('perfiles').select('email').eq('id', usuarioId).maybeSingle()
  const { error } = await admin.from('miembros').delete().eq('negocio_id', negocioId).eq('usuario_id', usuarioId)
  if (error) return { ok: false, error: 'No se pudo quitar' }
  await logAudit({
    tipo_evento: 'edicion', actor, entidad: 'usuario', entidad_id: usuarioId,
    nombre_referencia: (p?.email as string) ?? usuarioId, descripcion: 'Lo quitó de una tienda',
  })
  revalidatePath('/admin')
  return { ok: true, data: null }
}

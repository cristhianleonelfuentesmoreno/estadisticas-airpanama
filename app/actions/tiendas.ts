'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { correoDeUsuario, usuarioVisible } from '@/lib/cuenta'
import type { Resultado } from '@/lib/tienda/tipos'

// Tiendas y sus dueños, desde el panel. Solo el administrador (equipo de Valis Digital).
// El cliente admin se salta RLS: cada acción empieza con requireAdmin().

export type PersonaTienda = {
  usuario_id: string
  nombre: string | null
  email: string
  rol: 'dueno' | 'cajero' | 'contador'
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
        return { usuario_id: m.usuario_id as string, nombre: (p?.nombre as string | null) ?? null, email: usuarioVisible((p?.email as string) ?? ''), rol: m.rol as PersonaTienda['rol'], estado }
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

// Crea la cuenta del dueño (o del contador) en el momento, sin correos: el administrador le pasa el usuario
// y la contraseña (WhatsApp o papel). Si la persona ya tenía cuenta, solo se agrega a la tienda y conserva su contraseña.
// El contador solo ve y descarga los reportes del mes; la base no le deja vender ni cambiar nada.
export async function crearDueno(
  negocioId: string, datos: { nombre: string; usuario: string; contrasena: string }, rol: 'dueno' | 'contador' = 'dueno',
): Promise<Resultado<{ usuario: string; contrasena: string | null; yaExistia: boolean }>> {
  const actor = await requireAdmin()
  const quien = rol === 'contador' ? 'contador' : 'dueño'
  const nombre = limpio(datos.nombre, 80)
  const email = correoDeUsuario(datos.usuario ?? '')
  const contrasena = typeof datos.contrasena === 'string' ? datos.contrasena.trim() : ''
  if (!nombre) return { ok: false, error: `Escribe el nombre del ${quien}` }
  if (!email) return { ok: false, error: 'El usuario debe tener al menos 3 letras o números (o ser un correo)' }

  const admin = createAdminClient()
  const { data: negocio } = await admin.from('negocios').select('id, nombre').eq('id', negocioId).single()
  if (!negocio) return { ok: false, error: 'Ese negocio no existe' }

  let usuarioId: string
  let yaExistia = false
  const { data: existente } = await admin.from('perfiles').select('id, nombre').ilike('email', email).maybeSingle()
  if (existente) {
    usuarioId = existente.id as string
    yaExistia = true
  } else {
    if (contrasena.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres' }
    const { data, error } = await admin.auth.admin.createUser({
      email, password: contrasena, email_confirm: true, user_metadata: { full_name: nombre },
    })
    if (error || !data.user) return { ok: false, error: 'No se pudo crear la cuenta. Prueba con otro usuario.' }
    usuarioId = data.user.id
  }

  // A quien ya es dueño de esta tienda no se le baja a contador
  if (rol === 'contador') {
    const { data: ya } = await admin.from('miembros').select('rol').eq('negocio_id', negocioId).eq('usuario_id', usuarioId).maybeSingle()
    if (ya && ya.rol !== 'contador') return { ok: false, error: 'Esa persona ya es dueña de esta tienda' }
  }

  // Aprobado y como dueño de negocio (sin panel). A una cuenta del equipo Valis no se le cambia el rol.
  const cambios: Record<string, string> = { status: 'aprobado' }
  if (!existente?.nombre) cambios.nombre = nombre
  if (!yaExistia) cambios.role = 'usuario'
  await admin.from('perfiles').update(cambios).eq('id', usuarioId)

  const { error: eMiembro } = await admin.from('miembros').upsert({ negocio_id: negocioId, usuario_id: usuarioId, rol }, { onConflict: 'negocio_id,usuario_id' })
  if (eMiembro) return { ok: false, error: 'No se pudo agregar a la tienda' }

  await logAudit({
    tipo_evento: yaExistia ? 'edicion' : 'creacion', actor, entidad: 'usuario', entidad_id: usuarioId,
    nombre_referencia: usuarioVisible(email), descripcion: `${yaExistia ? 'Agregó' : 'Creó la cuenta de'} ${nombre} como ${quien} de ${negocio.nombre}`,
  })
  revalidatePath('/admin')
  return { ok: true, data: { usuario: usuarioVisible(email), contrasena: yaExistia ? null : contrasena, yaExistia } }
}

// Para cuando el dueño (o el contador) olvida su contraseña: el administrador le pone una nueva. Nunca a cuentas del equipo Valis.
export async function cambiarContrasenaDueno(usuarioId: string, contrasena: string): Promise<Resultado<{ usuario: string }>> {
  const actor = await requireAdmin()
  const nueva = typeof contrasena === 'string' ? contrasena.trim() : ''
  if (nueva.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres' }
  const admin = createAdminClient()
  const { data: p } = await admin.from('perfiles').select('email, role, nombre').eq('id', usuarioId).maybeSingle()
  if (!p) return { ok: false, error: 'Esa cuenta no existe' }
  if (p.role !== 'usuario') return { ok: false, error: 'Solo se cambia aquí la contraseña de los dueños de negocio' }
  const { error } = await admin.auth.admin.updateUserById(usuarioId, { password: nueva })
  if (error) return { ok: false, error: 'No se pudo cambiar la contraseña' }
  await logAudit({
    tipo_evento: 'edicion', actor, entidad: 'usuario', entidad_id: usuarioId,
    nombre_referencia: usuarioVisible(p.email as string), descripcion: `Le puso una contraseña nueva a ${(p.nombre as string | null) ?? 'un dueño'}`,
  })
  return { ok: true, data: { usuario: usuarioVisible(p.email as string) } }
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

// ---------- Personas que se registraron solas ----------

export type Registrado = {
  usuario_id: string
  nombre: string | null
  usuario: string
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  creado_en: string
}

// Cuentas de dueños de negocio (no del equipo Valis) que todavía no están en ninguna tienda
export async function listarRegistrados(): Promise<Registrado[]> {
  await requireAdmin()
  const admin = createAdminClient()
  const [{ data: perfiles }, { data: miembros }, usuarios] = await Promise.all([
    admin.from('perfiles').select('id, nombre, email, status').eq('role', 'usuario'),
    admin.from('miembros').select('usuario_id'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])
  const conTienda = new Set((miembros ?? []).map(m => m.usuario_id as string))
  const creado = new Map((usuarios.data?.users ?? []).map(u => [u.id, u.created_at]))
  return (perfiles ?? [])
    .filter(p => !conTienda.has(p.id as string))
    .map(p => ({
      usuario_id: p.id as string,
      nombre: (p.nombre as string | null) ?? null,
      usuario: usuarioVisible((p.email as string) ?? ''),
      estado: p.status as Registrado['estado'],
      creado_en: creado.get(p.id as string) ?? '',
    }))
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
}

// La persona ya tiene cuenta (se registró sola): queda aprobada y como dueña, con su propia contraseña
export async function agregarRegistrado(negocioId: string, usuarioId: string): Promise<Resultado<{ nombre: string; usuario: string }>> {
  const actor = await requireAdmin()
  const admin = createAdminClient()
  const [{ data: negocio }, { data: p }] = await Promise.all([
    admin.from('negocios').select('id, nombre').eq('id', negocioId).single(),
    admin.from('perfiles').select('id, nombre, email, role').eq('id', usuarioId).maybeSingle(),
  ])
  if (!negocio) return { ok: false, error: 'Ese negocio no existe' }
  if (!p) return { ok: false, error: 'Esa cuenta no existe' }
  if (p.role !== 'usuario') return { ok: false, error: 'Esa cuenta es del equipo Valis, no de un dueño' }

  await admin.from('perfiles').update({ status: 'aprobado' }).eq('id', usuarioId)
  const { error } = await admin.from('miembros').upsert({ negocio_id: negocioId, usuario_id: usuarioId, rol: 'dueno' }, { onConflict: 'negocio_id,usuario_id' })
  if (error) return { ok: false, error: 'No se pudo agregar a la tienda' }

  const usuario = usuarioVisible(p.email as string)
  await logAudit({
    tipo_evento: 'edicion', actor, entidad: 'usuario', entidad_id: usuarioId,
    nombre_referencia: usuario, descripcion: `Aprobó a ${(p.nombre as string | null) ?? usuario} y lo agregó como dueño de ${negocio.nombre}`,
  })
  revalidatePath('/admin')
  return { ok: true, data: { nombre: (p.nombre as string | null) ?? usuario, usuario } }
}

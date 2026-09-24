import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { toRole, type Role } from '@/lib/permissions'

// Helpers de autorización para Server Actions y Server Components.
// Cada Server Action es un endpoint POST público, así que TODAS deben llamar
// a uno de estos helpers antes de tocar datos.

export type SessionUser = {
  id: string
  email: string | undefined
  role: Role
  nombre: string // para la bitácora: nombre o, si no tiene, correo
}

export type SessionProfile = {
  id: string
  email: string | undefined
  status: string | null
  role: Role
  nombre: string | null
  cargo: string | null
  fullName: string | undefined
  avatarUrl: string | undefined
}

// Sesión + perfil, UNA vez por petición: cache() lo comparte entre el layout,
// la página y las acciones que corran en la misma petición.
// getClaims() valida el JWT (ES256) localmente con la clave pública del proyecto,
// sin el viaje al servidor de Auth que hace getUser() en cada llamada.
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('status, role, nombre, cargo')
    .eq('id', claims.sub)
    .single()

  const meta = (claims.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
  return {
    id: claims.sub,
    email: claims.email,
    status: perfil?.status ?? null,
    role: toRole(perfil?.role),
    nombre: perfil?.nombre ?? null,
    cargo: perfil?.cargo ?? null,
    fullName: meta.full_name,
    avatarUrl: meta.avatar_url,
  }
})

async function getSessionUser(): Promise<SessionUser | null> {
  const profile = await getSessionProfile()
  if (!profile || profile.status !== 'aprobado') return null
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    nombre: profile.nombre || profile.fullName || profile.email || 'Usuario',
  }
}

// Para tareas en segundo plano (latido de sesión, cierre): sin sesión válida
// devuelven null en vez de lanzar, así no aparece un error sin capturar en la pantalla
export async function getApprovedUserOrNull(): Promise<SessionUser | null> {
  return getSessionUser()
}

export async function requireApprovedUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('No autorizado')
  return user
}

// Supervisor o administrador
export async function requireSupervisor(): Promise<SessionUser> {
  const user = await requireApprovedUser()
  if (user.role !== 'supervisor' && user.role !== 'administrador') throw new Error('No autorizado')
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireApprovedUser()
  if (user.role !== 'administrador') throw new Error('No autorizado')
  return user
}

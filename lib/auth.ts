import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// Helpers de autorización para Server Actions.
// Cada Server Action es un endpoint POST público, así que TODAS deben llamar
// a uno de estos helpers antes de tocar datos.

export type SessionUser = {
  id: string
  email: string | undefined
  role: 'administrador' | 'usuario'
}

// cache() evita repetir la consulta dentro de la misma petición
const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('status, role')
    .eq('id', user.id)
    .single()

  if (perfil?.status !== 'aprobado') return null

  return {
    id: user.id,
    email: user.email,
    role: perfil.role === 'administrador' ? 'administrador' : 'usuario',
  }
})

export async function requireApprovedUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new Error('No autorizado')
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireApprovedUser()
  if (user.role !== 'administrador') throw new Error('No autorizado')
  return user
}

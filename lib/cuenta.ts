// Cuentas de dueños creadas por el administrador, sin correo: entran con un usuario simple ("jeremias").
// Por dentro Supabase necesita un correo, así que se usa una dirección interna que nunca recibe mensajes.

export const DOMINIO_INTERNO = 'usuarios.valisventas.local'

const USUARIO = /^[a-z0-9][a-z0-9._-]{2,29}$/

// "Jeremías Pérez" -> "jeremias.perez"; lo que el admin escribe como usuario se limpia igual
export function limpiarUsuario(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 30)
}

// Lo que la persona escribe en "Usuario o correo" -> el correo con el que Supabase la conoce.
// null si no es un correo ni un usuario válido.
export function correoDeUsuario(entrada: string): string | null {
  const t = entrada.trim().toLowerCase()
  if (t.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? t : null
  const u = limpiarUsuario(t)
  return USUARIO.test(u) ? `${u}@${DOMINIO_INTERNO}` : null
}

// Para mostrar: "jeremias@usuarios.valisventas.local" -> "jeremias"
export function usuarioVisible(email: string): string {
  return email.endsWith(`@${DOMINIO_INTERNO}`) ? email.slice(0, -(DOMINIO_INTERNO.length + 1)) : email
}

export const esCuentaInterna = (email: string) => email.endsWith(`@${DOMINIO_INTERNO}`)

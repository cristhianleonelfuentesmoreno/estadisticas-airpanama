import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Destinos permitidos después de validar un enlace de correo (evita redirecciones abiertas)
const ALLOWED_NEXT = new Set(['/update-password'])

// Punto de entrada de los enlaces que envía Supabase por correo (recuperar contraseña).
// Acepta los tres formatos posibles:
//  - ?token_hash=...&type=recovery → plantilla de correo recomendada, funciona en cualquier navegador
//  - ?code=...                     → flujo PKCE, solo en el navegador donde se pidió el enlace
//  - #access_token=...             → enlaces generados desde el servidor (p. ej. por un admin);
//                                    el fragmento no llega aquí, pero el navegador lo conserva al redirigir
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? ''
  const next = ALLOWED_NEXT.has(nextParam) ? nextParam : '/update-password'

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return NextResponse.redirect(`${origin}/login?error=link_expired`)
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/login?error=link_other_browser`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}

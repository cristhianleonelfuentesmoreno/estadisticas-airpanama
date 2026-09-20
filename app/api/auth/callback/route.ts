import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const action = searchParams.get('action') || 'login'
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Verificar estado en la tabla perfiles
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('status')
          .eq('id', userData.user.id)
          .single()

        if (!perfil || perfil?.status !== 'aprobado') {
          await supabase.auth.signOut()
          
          if (action === 'register') {
            if (perfil?.status === 'pendiente') {
              return NextResponse.redirect(`${origin}/login?status=pending`)
            }
            return NextResponse.redirect(`${origin}/login?status=registered_google`)
          } else {
            // action === 'login'
            if (!perfil) {
              return NextResponse.redirect(`${origin}/login?error=not_registered`)
            } else if (perfil.status === 'pendiente') {
              return NextResponse.redirect(`${origin}/login?status=pending`)
            } else if (perfil.status === 'rechazado') {
              return NextResponse.redirect(`${origin}/login?error=rejected`)
            }
          }
        }
      }
      return NextResponse.redirect(`${origin}/dashboard?login=success`)
    }
  }

  // En caso de error, o si no hay código (canceló el login), enviamos error
  return NextResponse.redirect(`${origin}/login?error=true`)
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
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

        if (perfil?.status === 'pendiente') {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?status=pending`)
        } else if (perfil?.status === 'rechazado') {
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/login?error=true`)
        }
      }
      return NextResponse.redirect(`${origin}/dashboard?login=success`)
    }
  }

  // En caso de error, o si no hay código (canceló el login), enviamos error
  return NextResponse.redirect(`${origin}/login?error=true`)
}

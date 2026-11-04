'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cerrarSesion } from '@/app/actions/sessions'

// Siempre termina en el login, aunque el registro del cierre en el servidor falle
export default function BotonSalir({ className = '' }: { className?: string }) {
  const router = useRouter()
  async function salir() {
    const sessionId = localStorage.getItem('sessionId')
    try {
      if (sessionId) await cerrarSesion(sessionId)
    } catch {
      // el cierre igual sigue
    } finally {
      localStorage.removeItem('sessionId')
      await createClient().auth.signOut().catch(() => {})
      router.push('/login')
    }
  }
  return (
    <button onClick={salir} aria-label="Cerrar sesión" className={`rounded-full bg-white/15 p-2 ${className}`}>
      <LogOut className="h-5 w-5" />
    </button>
  )
}

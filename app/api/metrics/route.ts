import { NextResponse, type NextRequest } from 'next/server'
import { getApprovedUserOrNull } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Recibe la duración de un cambio de pantalla medida en el navegador (ver NavigationTimer).
// Se envía con keepalive y no bloquea nada; valores fuera de rango se descartan.
const TIPOS = new Set(['carga_inicial', 'cambio_seccion', 'cambio_filtro'])
const DISPOSITIVOS = new Set(['celular', 'tablet', 'computadora'])

export async function POST(request: NextRequest) {
  const user = await getApprovedUserOrNull()
  if (!user) return new NextResponse(null, { status: 401 })
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const pagina = typeof b?.pagina === 'string' ? b.pagina.split('?')[0].slice(0, 80) : ''
  const duracion = typeof b?.duracion_ms === 'number' ? Math.round(b.duracion_ms) : -1
  if (!pagina.startsWith('/dashboard') || !TIPOS.has(String(b?.tipo)) || !DISPOSITIVOS.has(String(b?.dispositivo)) || duracion < 0 || duracion > 60000) {
    return new NextResponse(null, { status: 400 })
  }
  await createAdminClient().from('metricas_navegacion').insert({
    usuario_id: user.id,
    pagina,
    tipo: b!.tipo,
    dispositivo: b!.dispositivo,
    conexion: typeof b?.conexion === 'string' ? b.conexion.slice(0, 20) : null,
    duracion_ms: duracion,
  })
  return new NextResponse(null, { status: 204 })
}

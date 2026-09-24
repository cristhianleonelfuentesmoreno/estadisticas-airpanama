import { NextResponse, type NextRequest } from 'next/server'
import { logUserEvent, type UserEvent } from '@/app/actions/audit'

// Eventos de la bitácora que ocurren en el navegador (navegar, exportar). Se envían con
// fetch(keepalive) para no ocupar la cola de Server Actions ni frenar la navegación.
export async function POST(request: NextRequest) {
  const event = (await request.json().catch(() => null)) as UserEvent | null
  if (!event) return new NextResponse(null, { status: 400 })
  await logUserEvent(event).catch(() => {})
  return new NextResponse(null, { status: 204 })
}

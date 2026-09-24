import { NextResponse, type NextRequest } from 'next/server'
import { actualizarActividad } from '@/app/actions/sessions'

// Latido de la sesión (cada minuto). Ruta en vez de Server Action: no ocupa la cola
// de acciones del cliente, así nunca retrasa un cambio de página.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
  const res = await actualizarActividad(sessionId).catch(() => ({ success: false }))
  return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } })
}

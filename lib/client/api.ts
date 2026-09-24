// Pedidos del navegador a las rutas de /api. A diferencia de las Server Actions, estos
// corren en paralelo y no bloquean la navegación (Next.js despacha las acciones de a una).
import type { FlightData } from '@/app/actions/flights'
import type { UserEvent } from '@/app/actions/audit'

export async function fetchUpcomingFlights(date: string): Promise<FlightData[]> {
  const res = await fetch(`/api/flights/upcoming?date=${encodeURIComponent(date)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`No se pudieron cargar los vuelos (${res.status})`)
  return res.json()
}

// Se envía y se olvida: keepalive deja terminar el envío aunque se cambie de página
export function sendAuditEvent(event: UserEvent) {
  fetch('/api/audit/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {})
}

export async function sendHeartbeat(sessionId: string): Promise<{ success: boolean; expired?: boolean }> {
  const res = await fetch('/api/session/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
    cache: 'no-store',
  })
  return res.json()
}

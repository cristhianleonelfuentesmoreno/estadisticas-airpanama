'use server'

import { requireApprovedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { anotar, EVENTOS_USO, type DetalleUso, type EventoUso } from '@/lib/tienda/uso'

// Lo que se anota desde la pantalla (pantallas abiertas, filtros, WhatsApp).
// La base solo deja anotar al mismo usuario y en una tienda suya.
export async function anotarUso(tiendaId: string, evento: EventoUso, detalle: DetalleUso = {}): Promise<void> {
  if (!EVENTOS_USO.includes(evento) || typeof tiendaId !== 'string') return
  await requireApprovedUser()
  const limpio: DetalleUso = {}
  for (const [k, v] of Object.entries(detalle).slice(0, 10)) {
    if (typeof v === 'string') limpio[k.slice(0, 30)] = v.slice(0, 120)
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) limpio[k.slice(0, 30)] = v
  }
  anotar(await createClient(), tiendaId, evento, limpio)
}

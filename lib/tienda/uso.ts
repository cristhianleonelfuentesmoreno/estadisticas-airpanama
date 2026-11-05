// Anota cómo se usa la app (tabla uso_app) para ver qué mejorar.
// Se guarda después de responder (after), así no hace esperar al usuario; si falla, se ignora.
import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const EVENTOS_USO = [
  'pantalla', 'venta', 'venta_anulada', 'producto_creado', 'producto_editado', 'factura', 'factura_foto', 'factura_editada',
  'ajuste', 'cierre', 'whatsapp_pedido', 'whatsapp_cierre', 'sugerencia_precio', 'filtro',
] as const
export type EventoUso = (typeof EVENTOS_USO)[number]

export type DetalleUso = Record<string, string | number | boolean | null | string[]>

export function anotar(supabase: SupabaseClient, tiendaId: string, evento: EventoUso, detalle: DetalleUso = {}) {
  after(async () => {
    await supabase.from('uso_app').insert({ tienda_id: tiendaId, evento, detalle })
  })
}

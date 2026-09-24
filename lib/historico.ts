import 'server-only'
// Operaciones internas del histórico de vuelos (sin "use server": no son acciones
// públicas; las llaman acciones que ya verificaron permisos).
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";

export type TipoVuelo = 'llegada' | 'salida';

export const TABLE: Record<TipoVuelo, 'llegadas_malek_historico' | 'salidas_malek_historico'> = {
  llegada: 'llegadas_malek_historico',
  salida: 'salidas_malek_historico',
};
export const ROUTE_COL: Record<TipoVuelo, 'origen' | 'destino'> = { llegada: 'origen', salida: 'destino' };

export const isTipoVuelo = (v: unknown): v is TipoVuelo => v === 'llegada' || v === 'salida';

type Row = Record<string, unknown>;

// "7P-971 · 22 sep 2026 · DAV → PAC" (así se lee en la bitácora y en las solicitudes)
export function flightLabel(row: Row, tipo: TipoVuelo) {
  const fecha = typeof row.fecha === 'string'
    ? new Date(`${row.fecha}T12:00:00`).toLocaleDateString('es-PA', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const ruta = tipo === 'llegada' ? `${row.origen ?? '?'} → DAV` : `DAV → ${row.destino ?? '?'}`;
  return [row.numero_vuelo, fecha, ruta].filter(Boolean).join(' · ');
}

export function flightSummary(row: Row, tipo: TipoVuelo) {
  return {
    tipo,
    fecha: row.fecha,
    numero_vuelo: row.numero_vuelo,
    aerolinea: row.aerolinea,
    ruta: row[ROUTE_COL[tipo]],
    pasajeros: row.pasajeros_abordo,
    estado: row.estado_final,
  };
}

export async function getFlight(tipo: TipoVuelo, id: string) {
  const { data } = await createAdminClient().from(TABLE[tipo]).select('*').eq('id', id).maybeSingle();
  return (data as Row | null) ?? null;
}

// Eliminar = ocultar: el vuelo sale del Registro y de los Reportes, pero se puede restaurar
export async function softDeleteFlight(tipo: TipoVuelo, id: string, actor: SessionUser, motivo: string, via?: string) {
  const row = await getFlight(tipo, id);
  if (!row) return { success: false as const, error: 'El vuelo no existe' };
  if (row.eliminado_en) return { success: false as const, error: 'El vuelo ya estaba eliminado' };

  const { error } = await createAdminClient()
    .from(TABLE[tipo])
    .update({ eliminado_en: new Date().toISOString(), eliminado_por: actor.id, motivo_eliminacion: motivo })
    .eq('id', id);
  if (error) return { success: false as const, error: error.message };

  await logAudit({
    tipo_evento: 'eliminacion',
    actor,
    entidad: 'vuelo',
    entidad_id: id,
    nombre_referencia: flightLabel(row, tipo),
    descripcion: `Eliminó el vuelo${via ? ` (${via})` : ''}. Motivo: ${motivo}`,
    detalles_extra: { vuelo: flightSummary(row, tipo), motivo },
  });
  return { success: true as const, row };
}

// Solicitudes pendientes de un grupo de vuelos (para marcarlos en el Registro y excluirlos de Reportes)
export async function pendingDeletionIds(tipo: TipoVuelo, ids?: string[]) {
  let query = createAdminClient().from('solicitudes_eliminacion').select('vuelo_id').eq('tipo', tipo).eq('estado', 'pendiente');
  if (ids) {
    if (ids.length === 0) return new Set<string>();
    query = query.in('vuelo_id', ids);
  }
  const { data } = await query;
  return new Set((data ?? []).map(r => r.vuelo_id as string));
}

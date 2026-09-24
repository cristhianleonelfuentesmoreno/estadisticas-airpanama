"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser, requireSupervisor } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { flightLabel, flightSummary, getFlight, isTipoVuelo, ROUTE_COL, softDeleteFlight, TABLE, type TipoVuelo } from "@/lib/historico";

// Eliminación con solicitud: un usuario la pide con un motivo, un supervisor la aprueba
// o la rechaza. Nada se borra de verdad: el vuelo se oculta y se puede restaurar.

export type SolicitudEliminacion = {
  id: string;
  tipo: TipoVuelo;
  vuelo_id: string;
  resumen: { fecha?: string; numero_vuelo?: string; aerolinea?: string; ruta?: string; pasajeros?: number; estado?: string };
  motivo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  solicitado_nombre: string | null;
  solicitado_en: string;
  resuelto_nombre: string | null;
  resuelto_en: string | null;
  comentario: string | null;
};

export type VueloEliminado = {
  id: string;
  tipo: TipoVuelo;
  fecha: string;
  numero_vuelo: string;
  aerolinea: string;
  ruta: string;
  pasajeros_abordo: number | null;
  eliminado_en: string;
  motivo_eliminacion: string | null;
  eliminado_por_nombre: string | null;
};

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function requestFlightDeletion(tipo: TipoVuelo, vueloId: string, motivo: string) {
  const user = await requireApprovedUser();
  const reason = text(motivo, 500);
  if (!isTipoVuelo(tipo) || !vueloId) return { success: false, error: 'Vuelo inválido' };
  if (reason.length < 3) return { success: false, error: 'Escribe el motivo de la eliminación' };

  const row = await getFlight(tipo, vueloId);
  if (!row || row.eliminado_en) return { success: false, error: 'El vuelo no existe o ya fue eliminado' };

  const { data, error } = await createAdminClient()
    .from('solicitudes_eliminacion')
    .insert({
      tipo,
      vuelo_id: vueloId,
      resumen: flightSummary(row, tipo),
      motivo: reason,
      solicitado_por: user.id,
      solicitado_nombre: user.nombre,
    })
    .select('id')
    .single();
  if (error) {
    // Índice único: una sola solicitud pendiente por vuelo
    if (error.code === '23505') return { success: false, error: 'Este vuelo ya tiene una solicitud de eliminación pendiente' };
    return { success: false, error: error.message };
  }

  await logAudit({
    tipo_evento: 'solicitud_eliminacion',
    actor: user,
    entidad: 'vuelo',
    entidad_id: vueloId,
    nombre_referencia: flightLabel(row, tipo),
    descripcion: `Solicitó eliminar el vuelo. Motivo: ${reason}`,
    detalles_extra: { solicitud_id: data.id, vuelo: flightSummary(row, tipo), motivo: reason },
  });
  revalidatePath('/dashboard/diario');
  return { success: true };
}

export async function getDeletionRequests(estado: 'pendiente' | 'resueltas' = 'pendiente') {
  await requireSupervisor();
  let query = createAdminClient()
    .from('solicitudes_eliminacion')
    .select('id, tipo, vuelo_id, resumen, motivo, estado, solicitado_nombre, solicitado_en, resuelto_nombre, resuelto_en, comentario')
    .order(estado === 'pendiente' ? 'solicitado_en' : 'resuelto_en', { ascending: estado === 'pendiente' })
    .limit(100);
  query = estado === 'pendiente' ? query.eq('estado', 'pendiente') : query.neq('estado', 'pendiente');
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SolicitudEliminacion[];
}

export async function resolveDeletionRequest(requestId: string, aprobar: boolean, comentario?: string) {
  const user = await requireSupervisor();
  const note = text(comentario, 500) || null;
  const supabase = createAdminClient();

  const { data: req } = await supabase.from('solicitudes_eliminacion').select('*').eq('id', requestId).maybeSingle();
  if (!req) return { success: false, error: 'La solicitud no existe' };
  if (req.estado !== 'pendiente') return { success: false, error: 'La solicitud ya fue resuelta' };
  if (!aprobar && !note) return { success: false, error: 'Indica por qué rechazas la solicitud' };

  const tipo = req.tipo as TipoVuelo;
  if (aprobar) {
    const del = await softDeleteFlight(tipo, req.vuelo_id, user, req.motivo, `solicitud de ${req.solicitado_nombre ?? 'un usuario'} aprobada`);
    // Si el vuelo ya no estaba, la solicitud igual se cierra
    if (!del.success && del.error !== 'El vuelo ya estaba eliminado' && del.error !== 'El vuelo no existe') {
      return { success: false, error: del.error };
    }
  }

  const { error } = await supabase
    .from('solicitudes_eliminacion')
    .update({
      estado: aprobar ? 'aprobada' : 'rechazada',
      resuelto_por: user.id,
      resuelto_nombre: user.nombre,
      resuelto_en: new Date().toISOString(),
      comentario: note,
    })
    .eq('id', requestId)
    .eq('estado', 'pendiente');
  if (error) return { success: false, error: error.message };

  const resumen = req.resumen as Record<string, unknown>;
  await logAudit({
    tipo_evento: 'resolucion_solicitud',
    actor: user,
    entidad: 'vuelo',
    entidad_id: req.vuelo_id,
    nombre_referencia: flightLabel({ ...resumen, [ROUTE_COL[tipo]]: resumen.ruta }, tipo),
    descripcion: `${aprobar ? 'Aprobó' : 'Rechazó'} la solicitud de eliminación de ${req.solicitado_nombre ?? 'un usuario'}${note ? `. Comentario: ${note}` : ''}`,
    detalles_extra: { solicitud_id: requestId, aprobada: aprobar, motivo: req.motivo, comentario: note },
  });
  revalidatePath('/dashboard/diario');
  revalidatePath('/dashboard/mensual');
  return { success: true };
}

export async function getDeletedFlights(): Promise<VueloEliminado[]> {
  await requireSupervisor();
  const supabase = createAdminClient();
  const [llegadas, salidas, perfiles] = await Promise.all([
    supabase.from(TABLE.llegada).select('id, fecha, numero_vuelo, aerolinea, origen, pasajeros_abordo, eliminado_en, eliminado_por, motivo_eliminacion').not('eliminado_en', 'is', null).order('eliminado_en', { ascending: false }).limit(50),
    supabase.from(TABLE.salida).select('id, fecha, numero_vuelo, aerolinea, destino, pasajeros_abordo, eliminado_en, eliminado_por, motivo_eliminacion').not('eliminado_en', 'is', null).order('eliminado_en', { ascending: false }).limit(50),
    supabase.from('perfiles').select('id, nombre, email'),
  ]);
  const nombre = new Map((perfiles.data ?? []).map(p => [p.id, p.nombre || p.email]));
  const map = (tipo: TipoVuelo) => (r: Record<string, unknown>): VueloEliminado => ({
    id: r.id as string,
    tipo,
    fecha: r.fecha as string,
    numero_vuelo: r.numero_vuelo as string,
    aerolinea: r.aerolinea as string,
    ruta: (tipo === 'llegada' ? r.origen : r.destino) as string,
    pasajeros_abordo: r.pasajeros_abordo as number | null,
    eliminado_en: r.eliminado_en as string,
    motivo_eliminacion: r.motivo_eliminacion as string | null,
    eliminado_por_nombre: nombre.get(r.eliminado_por as string) ?? null,
  });
  return [...(llegadas.data ?? []).map(map('llegada')), ...(salidas.data ?? []).map(map('salida'))]
    .sort((a, b) => b.eliminado_en.localeCompare(a.eliminado_en))
    .slice(0, 50);
}

export async function restoreFlight(tipo: TipoVuelo, vueloId: string) {
  const user = await requireSupervisor();
  if (!isTipoVuelo(tipo)) return { success: false, error: 'Vuelo inválido' };
  const row = await getFlight(tipo, vueloId);
  if (!row || !row.eliminado_en) return { success: false, error: 'El vuelo no está eliminado' };

  const { error } = await createAdminClient()
    .from(TABLE[tipo])
    .update({ eliminado_en: null, eliminado_por: null, motivo_eliminacion: null, actualizado_en: new Date().toISOString() })
    .eq('id', vueloId);
  if (error) return { success: false, error: error.message };

  await logAudit({
    tipo_evento: 'restauracion',
    actor: user,
    entidad: 'vuelo',
    entidad_id: vueloId,
    nombre_referencia: flightLabel(row, tipo),
    descripcion: `Restauró el vuelo eliminado (motivo original: ${row.motivo_eliminacion ?? '—'})`,
    detalles_extra: { vuelo: flightSummary(row, tipo) },
  });
  revalidatePath('/dashboard/diario');
  revalidatePath('/dashboard/mensual');
  return { success: true };
}

"use server";

import { requireApprovedUser, requireSupervisor, type SessionUser } from "@/lib/auth";
import { diffFields, logAudit } from "@/lib/audit";
import { flightLabel, getFlight, pendingDeletionIds, softDeleteFlight, TABLE, type TipoVuelo } from "@/lib/historico";
import { loadFleetKnowledge } from "@/lib/fleet/knowledge";
import { canonicalFlightNumber, normalizeRegistration, resolveAircraft } from "@/lib/fleet/rules";
import type { ImportRow } from "@/lib/import/registroMensual";
import type { ReporteVuelo } from "@/lib/reportes/metrics";

export interface FlightData {
  id: string;
  flightNumber: string;
  aircraft: string;
  aircraftReg: string;
  origin: string;
  originName: string;
  destination: string;
  destinationName: string;
  departureTime: string; // ISO string so it's serializable to client
  arrivalTime: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  status: 'PROGRAMADO' | 'ABORDANDO' | 'RETRASADO' | 'EN VUELO' | 'ARRIBÓ' | 'CANCELADO';
  gate: string;
  pilot: string;
  paxCount: number;
  paxMax: number;
  flightType: string;
  airline: string; // <-- Nuevo campo para diferenciar
  progress: number; // 0 to 100
  durationStr: string;
  manualLogId?: string;
  actualDepartureTime?: string;
  actualArrivalTime?: string;
  statusOverride?: string;
  isArchived?: boolean;
}

export async function getUpcomingFlights(targetDate?: string): Promise<FlightData[]> {
  await requireApprovedUser();
  const now = new Date(); // Obtenemos la hora local del dispositivo

  const parseTime = (timeStr: string | null | undefined, flightDateStr?: string) => {
    if (!timeStr) return null;
    const targetDateStr = (flightDateStr && flightDateStr !== 'TODOS') ? flightDateStr : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    // timeStr format is HH:MM or H:MM. Construct an ISO string for Panama time
    const [hours, mins] = timeStr.split(':');
    if (!hours || !mins) return null;
    const paddedHours = hours.padStart(2, '0');
    return new Date(`${targetDateStr}T${paddedHours}:${mins}:00-05:00`);
  };

  const { getManualFlightsForDate } = await import('./manualFlights');
  const manualFlights = await getManualFlightsForDate(targetDate);
  
  // El itinerario real transcrito directamente de la imagen + Simulados de Copa (como fallback si la BD está vacía o no existe)
  const itinerary = manualFlights.map(f => ({
    num: f.flightNumber,
    date: f.flightDate,
    dep: f.departureTimeLocal,
    arr: f.arrivalTimeLocal,
    ori: f.origin,
    oriName: f.originName,
    des: f.destination,
    desName: f.destinationName,
    pilot: f.pilot,
    pax: f.paxCount,
    max: f.paxMax,
    type: f.aircraft,
    reg: f.aircraftReg,
    airline: f.airline,
    manualLogId: f.id,
    actualDeparture: f.actual_departure_time,
    actualArrival: f.actual_arrival_time,
    statusOverride: f.status_override,
    isArchived: f.is_archived
  }));



  const flights: FlightData[] = itinerary.map((flight) => {
    const fallbackDate = new Date(`${flight.date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' })}T00:00:00-05:00`);
    const depDate = parseTime(flight.dep, flight.date) ?? fallbackDate;
    const arrDate = parseTime(flight.arr, flight.date) ?? new Date(depDate.getTime() + 3600000); // +1h si no hay arrival
    
    if (arrDate < depDate) {
      arrDate.setDate(arrDate.getDate() + 1);
    }

    const totalDurationMs = arrDate.getTime() - depDate.getTime();
    const elapsedMs = now.getTime() - depDate.getTime();
    
    let progress = 0;
    let status: FlightData['status'] = 'PROGRAMADO';

      if (flight.actualArrival || flight.statusOverride === 'ARRIBÓ') {
        progress = 100;
        status = 'ARRIBÓ';
      } else if (flight.statusOverride === 'CANCELADO') {
        progress = 0;
        status = 'CANCELADO';
      } else if (flight.actualDeparture || flight.statusOverride === 'EN VUELO') {
        // En vuelo por acción manual
        progress = Math.min(100, Math.max(0, Math.floor((elapsedMs / totalDurationMs) * 100)));
        status = 'EN VUELO';
      } else if (elapsedMs < 0) {
        // Falta tiempo para que salga
        progress = 0;
        // Si falta menos de 30 mins, está abordando
        if (Math.abs(elapsedMs) <= 30 * 60000) {
          status = 'ABORDANDO';
        } else {
          status = 'PROGRAMADO';
        }
      } else if (elapsedMs >= totalDurationMs) {
        // Ya llegó por tiempo estimado
        progress = 100;
        status = 'ARRIBÓ';
      } else {
        // Está en vuelo por tiempo estimado
        progress = Math.floor((elapsedMs / totalDurationMs) * 100);
        status = 'EN VUELO';
      }

    const durationMins = totalDurationMs / 60000;
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const durationStr = hours > 0 ? `${hours}h ${mins.toString().padStart(2, '0')}m` : `${mins} min`;

    const prefix = flight.airline === 'Copa Airlines' ? 'CM-' : '7P-';

    const result: FlightData = {
      id: `${flight.num}-${flight.date}-${flight.dep}`,
      flightNumber: `${prefix}${flight.num}`,
      aircraft: flight.type,
      aircraftReg: flight.reg,
      origin: flight.ori,
      originName: flight.oriName,
      destination: flight.des,
      destinationName: flight.desName,
      departureTime: depDate.toISOString(),
      arrivalTime: arrDate.toISOString(),
      departureTimeLocal: flight.dep,
      arrivalTimeLocal: flight.arr,
      status,
      gate: '1',
      pilot: flight.pilot,
      paxCount: flight.pax,
      paxMax: flight.max,
      flightType: 'REGULAR',
      airline: flight.airline,
      progress,
      durationStr,
      manualLogId: flight.manualLogId,
      actualDepartureTime: flight.actualDeparture,
      actualArrivalTime: flight.actualArrival,
      statusOverride: flight.statusOverride,
      isArchived: flight.isArchived
    };

    return result;
  });

  return flights;
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from '@/lib/supabase/admin';

// Usar el cliente administrador (bypassa RLS) para tareas automáticas en background
const getAdminSupabase = createAdminClient;

export async function saveCompletedMalekFlights() {
  await requireApprovedUser();
  return saveArrivals(await getUpcomingFlights());
}

// Interna (no exportada): recibe los vuelos ya consultados. No es una Server Action,
// así nadie puede llamarla desde el navegador con vuelos inventados.
async function saveArrivals(flights: FlightData[]) {
  const supabase = getAdminSupabase();
  const arrivedMalekFlights = flights.filter(f => f.destination === 'DAV' && f.status === 'ARRIBÓ');

  if (arrivedMalekFlights.length === 0) return { success: true, count: 0 };

  // Usar la fecha local de Panama
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); // YYYY-MM-DD
  
  const { data: existingFlights } = await supabase
    .from('llegadas_malek_historico')
    .select('numero_vuelo')
    .eq('fecha', today);

  // Comparación por número estándar: "971" y "7P-971" son el mismo vuelo
  const existingFlightNumbers = new Set(existingFlights?.map(f => canonicalFlightNumber(f.numero_vuelo)) || []);

  const flightsToInsert = arrivedMalekFlights
    .filter(f => !existingFlightNumbers.has(canonicalFlightNumber(f.flightNumber, f.airline)))
    .map(f => ({
      fecha: today,
      aerolinea: f.airline,
      numero_vuelo: canonicalFlightNumber(f.flightNumber, f.airline),
      origen: f.origin,
      hora_itinerario: `${today}T${f.arrivalTimeLocal}:00-05:00`,
      hora_real_llegada: `${today}T${f.actualArrivalTime || f.arrivalTimeLocal}:00-05:00`,
      hora_llegada_real: `${today}T${f.actualArrivalTime || f.arrivalTimeLocal}:00-05:00`,
      estado_final: 'PENDIENTE',
      pasajeros_abordo: f.paxCount,
      capacidad_total: f.paxMax,
      avion: f.aircraft || null,
      matricula: f.aircraftReg ? normalizeRegistration(f.aircraftReg) : null,
    }));

  if (flightsToInsert.length === 0) return { success: true, count: 0 };

  const { error } = await supabase
    .from('llegadas_malek_historico')
    .insert(flightsToInsert);

  if (error) {
    console.log("Error guardando historial Malek:", error?.message || error);
    return { success: false, error: error.message };
  }

  return { success: true, count: flightsToInsert.length };
}

export async function getLlegadasMalek(dateStr?: string) {
  await requireApprovedUser();
  const supabase = await createClient();
  const today = dateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
  
  // Histórico e itinerario del mismo día, en paralelo
  // Histórico, itinerario y solicitudes de eliminación pendientes: todo en paralelo
  const [{ data, error }, { data: manualFlights }, solicitados] = await Promise.all([
    supabase
      .from('llegadas_malek_historico')
      .select('*')
      .eq('fecha', today)
      .is('eliminado_en', null)
      .order('hora_real_llegada', { ascending: false }),
    supabase
      .from('manual_flights_log')
      .select('flightNumber, departureTimeLocal, arrivalTimeLocal')
      .eq('flightDate', today),
    pendingDeletionIds('llegada'),
  ]);

  if (error) {
    console.log("Error in Supabase for Malek arrivals.", error?.message);
    return [];
  }


  const enhancedData = (data || []).map(flight => {
    const manual = manualFlights?.find(m => 
      flight.numero_vuelo === m.flightNumber || 
      flight.numero_vuelo === `7P-${m.flightNumber}` || 
      flight.numero_vuelo === `CM-${m.flightNumber}`
    );
    let depLocal = manual?.departureTimeLocal;
    let arrLocal = manual?.arrivalTimeLocal;

    // Vuelos importados del Excel: sin hora de itinerario no hay nada que estimar
    if ((!depLocal || !arrLocal) && !flight.hora_itinerario) return { ...flight, eliminacion_solicitada: solicitados.has(flight.id) };

    if (!depLocal || !arrLocal) {
      // Fallback if not found in itinerary
      const baseDate = new Date(flight.hora_itinerario);
      const isCopa = flight.aerolinea.toLowerCase().includes('copa');
      const offsetMins = isCopa ? 65 : 60;
      
      const depDate = new Date(baseDate.getTime() - offsetMins * 60000);
      depLocal = `${depDate.getHours().toString().padStart(2, '0')}:${depDate.getMinutes().toString().padStart(2, '0')}`;
      arrLocal = `${baseDate.getHours().toString().padStart(2, '0')}:${baseDate.getMinutes().toString().padStart(2, '0')}`;
    }

    // Ensure they are 5 chars long (e.g. 08:30 instead of 8:30)
    if (depLocal && depLocal.length === 4) depLocal = `0${depLocal}`;
    if (arrLocal && arrLocal.length === 4) arrLocal = `0${arrLocal}`;

    return {
      ...flight,
      eliminacion_solicitada: solicitados.has(flight.id),
      hora_itinerario_salida: `${today}T${depLocal}:00-05:00`,
      hora_itinerario_llegada: `${today}T${arrLocal}:00-05:00`
    };
  });

  return enhancedData;
}

export type HistoricoUpdates = {
  fecha?: string;
  aerolinea?: string;
  numero_vuelo?: string;
  origen?: string;
  destino?: string;
  // null = sin hora (vuelos importados del Excel)
  hora_itinerario?: string | null;
  hora_itinerario_salida?: string | null;
  hora_real_salida?: string | null;
  hora_itinerario_llegada?: string | null;
  hora_real_llegada?: string | null;
  pasajeros_abordo?: number;
  capacidad_total?: number;
  estado_final?: string;
};

const HISTORICO_FIELDS = [
  'fecha', 'aerolinea', 'numero_vuelo', 'hora_itinerario', 'hora_itinerario_salida',
  'hora_real_salida', 'hora_itinerario_llegada', 'hora_real_llegada',
  'pasajeros_abordo', 'capacidad_total', 'estado_final',
] as const;

// Filtra los campos editables del histórico. Cualquier usuario aprobado puede cambiar
// estado_final (aprobar un vuelo pendiente); queda registrado en la bitácora.
function pickHistorico(updates: HistoricoUpdates, extra: 'origen' | 'destino') {
  const out: Record<string, unknown> = {};
  for (const key of [...HISTORICO_FIELDS, extra]) {
    if (updates && updates[key] !== undefined) out[key] = updates[key];
  }
  return out;
}

const FIELD_LABEL: Record<string, string> = {
  fecha: 'Fecha', aerolinea: 'Aerolínea', numero_vuelo: 'Vuelo', origen: 'Origen', destino: 'Destino',
  pasajeros_abordo: 'Pasajeros', capacidad_total: 'Capacidad', estado_final: 'Estado',
  hora_itinerario: 'Hora itinerario', hora_itinerario_salida: 'Salida itinerario', hora_real_salida: 'Salida real',
  hora_itinerario_llegada: 'Llegada itinerario', hora_real_llegada: 'Llegada real',
};
const showValue = (key: string, v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (key.startsWith('hora') && typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Panama' });
  }
  return String(v);
};

// Edita un vuelo del histórico y deja en la bitácora qué cambió (antes → después)
async function updateHistorico(tipo: TipoVuelo, id: string, updates: HistoricoUpdates, user: SessionUser) {
  const before = await getFlight(tipo, id);
  if (!before) return { success: false, error: 'El vuelo no existe' };
  if (before.eliminado_en) return { success: false, error: 'El vuelo está eliminado' };

  const payload = pickHistorico(updates, tipo === 'llegada' ? 'origen' : 'destino');
  const cambios = diffFields(before, payload);
  // Columna duplicada heredada: mantener ambas sincronizadas
  if ('hora_real_llegada' in payload && tipo === 'llegada') payload.hora_llegada_real = payload.hora_real_llegada;
  if ('hora_real_salida' in payload && tipo === 'salida') payload.hora_salida_real = payload.hora_real_salida;
  if (Object.keys(cambios).length === 0) return { success: true };

  // Escribe el servidor (los usuarios solo leen directamente): el permiso ya se verificó
  const { error } = await getAdminSupabase().from(TABLE[tipo]).update({ ...payload, actualizado_en: new Date().toISOString() }).eq('id', id);
  if (error) {
    console.log(`Error updating ${tipo} Malek:`, error?.message || error);
    return { success: false, error: error.message };
  }

  const aprobado = before.estado_final === 'PENDIENTE' && typeof payload.estado_final === 'string' && payload.estado_final !== 'PENDIENTE';
  const resumen = Object.entries(cambios)
    .map(([k, c]) => `${FIELD_LABEL[k] ?? k}: ${showValue(k, c.antes)} → ${showValue(k, c.despues)}`)
    .join(' · ');
  await logAudit({
    tipo_evento: aprobado ? 'aprobacion' : 'edicion',
    actor: user,
    entidad: 'vuelo',
    entidad_id: id,
    nombre_referencia: flightLabel({ ...before, ...payload }, tipo),
    descripcion: aprobado ? `Aprobó el vuelo como ${payload.estado_final}. ${resumen}` : `Editó el vuelo. ${resumen}`,
    detalles_extra: { tipo, cambios },
  });
  return { success: true };
}

export async function updateLlegadaMalek(id: string, updates: HistoricoUpdates) {
  const user = await requireApprovedUser();
  return updateHistorico('llegada', id, updates, user);
}

export async function saveCompletedMalekDepartures() {
  await requireApprovedUser();
  return saveDepartures(await getUpcomingFlights());
}

// Guarda llegadas y salidas completadas consultando el itinerario UNA sola vez
export async function syncCompletedMalekFlights() {
  await requireApprovedUser();
  const flights = await getUpcomingFlights();
  await Promise.all([saveArrivals(flights), saveDepartures(flights)]);
}

async function saveDepartures(flights: FlightData[]) {
  const supabase = getAdminSupabase();
  const departedMalekFlights = flights.filter(f => f.origin === 'DAV' && f.status === 'ARRIBÓ');

  if (departedMalekFlights.length === 0) return { success: true, count: 0 };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); // YYYY-MM-DD
  
  const { data: existingFlights } = await supabase
    .from('salidas_malek_historico')
    .select('numero_vuelo')
    .eq('fecha', today);

  // Comparación por número estándar: "971" y "7P-971" son el mismo vuelo
  const existingFlightNumbers = new Set(existingFlights?.map(f => canonicalFlightNumber(f.numero_vuelo)) || []);

  const flightsToInsert = departedMalekFlights
    .filter(f => !existingFlightNumbers.has(canonicalFlightNumber(f.flightNumber, f.airline)))
    .map(f => ({
      fecha: today,
      aerolinea: f.airline,
      numero_vuelo: canonicalFlightNumber(f.flightNumber, f.airline),
      destino: f.destination,
      hora_itinerario: `${today}T${f.departureTimeLocal}:00-05:00`,
      hora_real_salida: `${today}T${f.actualDepartureTime || f.departureTimeLocal}:00-05:00`,
      hora_salida_real: `${today}T${f.actualDepartureTime || f.departureTimeLocal}:00-05:00`,
      estado_final: 'PENDIENTE',
      pasajeros_abordo: f.paxCount,
      capacidad_total: f.paxMax,
      avion: f.aircraft || null,
      matricula: f.aircraftReg ? normalizeRegistration(f.aircraftReg) : null,
    }));

  if (flightsToInsert.length === 0) return { success: true, count: 0 };

  const { error } = await supabase
    .from('salidas_malek_historico')
    .insert(flightsToInsert);

  if (error) {
    console.log("Error guardando salidas Malek:", error?.message || error);
    return { success: false, error: error.message };
  }

  return { success: true, count: flightsToInsert.length };
}

export async function getSalidasMalek(dateStr?: string) {
  await requireApprovedUser();
  const supabase = await createClient();
  const today = dateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
  
  // Histórico e itinerario del mismo día, en paralelo
  // Histórico, itinerario y solicitudes de eliminación pendientes: todo en paralelo
  const [{ data, error }, { data: manualFlights }, solicitados] = await Promise.all([
    supabase
      .from('salidas_malek_historico')
      .select('*')
      .eq('fecha', today)
      .is('eliminado_en', null)
      .order('hora_real_salida', { ascending: false }),
    supabase
      .from('manual_flights_log')
      .select('flightNumber, departureTimeLocal, arrivalTimeLocal')
      .eq('flightDate', today),
    pendingDeletionIds('salida'),
  ]);

  if (error) {
    console.log("Error in Supabase for Malek departures.", error?.message);
    return [];
  }


  const enhancedData = (data || []).map(flight => {
    const manual = manualFlights?.find(m => 
      flight.numero_vuelo === m.flightNumber || 
      flight.numero_vuelo === `7P-${m.flightNumber}` || 
      flight.numero_vuelo === `CM-${m.flightNumber}`
    );
    let depLocal = manual?.departureTimeLocal;
    let arrLocal = manual?.arrivalTimeLocal;

    // Vuelos importados del Excel: sin hora de itinerario no hay nada que estimar
    if ((!depLocal || !arrLocal) && !flight.hora_itinerario) return { ...flight, eliminacion_solicitada: solicitados.has(flight.id) };

    if (!depLocal || !arrLocal) {
      // Fallback if not found in itinerary
      const baseDate = new Date(flight.hora_itinerario);
      const isCopa = flight.aerolinea.toLowerCase().includes('copa');
      const offsetMins = isCopa ? 65 : 60;
      
      const arrDate = new Date(baseDate.getTime() + offsetMins * 60000);
      depLocal = `${baseDate.getHours().toString().padStart(2, '0')}:${baseDate.getMinutes().toString().padStart(2, '0')}`;
      arrLocal = `${arrDate.getHours().toString().padStart(2, '0')}:${arrDate.getMinutes().toString().padStart(2, '0')}`;
    }

    // Ensure they are 5 chars long (e.g. 08:30 instead of 8:30)
    if (depLocal && depLocal.length === 4) depLocal = `0${depLocal}`;
    if (arrLocal && arrLocal.length === 4) arrLocal = `0${arrLocal}`;

    return {
      ...flight,
      eliminacion_solicitada: solicitados.has(flight.id),
      hora_itinerario_salida: `${today}T${depLocal}:00-05:00`,
      hora_itinerario_llegada: `${today}T${arrLocal}:00-05:00`
    };
  });

  return enhancedData;
}

export async function updateSalidaMalek(id: string, updates: HistoricoUpdates) {
  const user = await requireApprovedUser();
  const res = await updateHistorico('salida', id, updates, user);
  return res.success ? { ...res, message: "Registro actualizado exitosamente." } : res;
}

// Eliminar directamente es de supervisores (los usuarios envían una solicitud).
// No se borra: se oculta y se puede restaurar desde el panel.
const cleanMotivo = (m: unknown) => (typeof m === 'string' ? m.trim().slice(0, 500) : '');

export async function deleteLlegadaMalek(id: string, motivo: string) {
  const user = await requireSupervisor();
  if (!cleanMotivo(motivo)) return { success: false, error: 'Indica el motivo de la eliminación' };
  return softDeleteFlight('llegada', id, user, cleanMotivo(motivo));
}

export async function deleteSalidaMalek(id: string, motivo: string) {
  const user = await requireSupervisor();
  if (!cleanMotivo(motivo)) return { success: false, error: 'Indica el motivo de la eliminación' };
  return softDeleteFlight('salida', id, user, cleanMotivo(motivo));
}

export async function getReporteMensual(year: number, month: number, range: 'month' | 'year' | '6m' = 'month') {
  await requireApprovedUser();
  const supabase = await createClient();
  let startDate = '';
  let endDate = '';

  if (range === 'month') {
    const monthStr = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    startDate = `${year}-${monthStr}-01`;
    endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  } else if (range === 'year') {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else if (range === '6m') {
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() - 5);
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    startDate = `${d.getFullYear()}-${mStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const currentMStr = String(month).padStart(2, '0');
    endDate = `${year}-${currentMStr}-${String(lastDay).padStart(2, '0')}`;
  }

  // Los reportes muestran lo mismo que el Registro Histórico: solo vuelos revisados
  // (los PENDIENTE aún no están aprobados). Supabase entrega como máximo 1000 filas
  // por consulta, así que se pide por páginas: un año completo tiene ~1300 por tabla.
  const PAGE = 1000;
  const fetchAll = async (table: 'llegadas_malek_historico' | 'salidas_malek_historico') => {
    const rows: ReporteVuelo[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .neq('estado_final', 'PENDIENTE')
        .is('eliminado_en', null)
        .order('fecha')
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) return rows;
    }
  };

  const [llegadas, salidas, llegadasSolicitadas, salidasSolicitadas] = await Promise.all([
    fetchAll('llegadas_malek_historico'),
    fetchAll('salidas_malek_historico'),
    pendingDeletionIds('llegada'),
    pendingDeletionIds('salida'),
  ]);

  // Un vuelo con eliminación solicitada deja de contar mientras se resuelve
  return [
    ...llegadas.filter(f => !llegadasSolicitadas.has(f.id ?? '')),
    ...salidas.filter(f => !salidasSolicitadas.has(f.id ?? '')),
  ];
}

// ---------------------------------------------------------------------------
// Importación del registro mensual (Excel) al histórico
// ---------------------------------------------------------------------------

// Flota conocida para que el importador corrija nombres en el navegador
export async function getImportKnowledge() {
  await requireApprovedUser();
  return loadFleetKnowledge();
}

export type HistoricoImportRow = Pick<ImportRow,
  'tipo' | 'fecha' | 'aerolinea' | 'numero_vuelo' | 'ruta' | 'matricula' | 'avion' | 'pasajeros' |
  'capacidad' | 'handler' | 'stand' | 'servicio' | 'notas' | 'mtow_kg'>;

const MAX_IMPORT_ROWS = 1000;
const cut = (v: unknown, max: number) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : null;
};
const intIn = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null;

// Guarda un lote ya revisado en la vista previa. Un vuelo existente (misma fecha,
// número y ruta) se actualiza con los datos del Excel sin tocar sus horas ni su estado.
export type ImportBatchInfo = { archivo?: string; lote?: number; lotes?: number };

export async function importHistoricoRows(rows: HistoricoImportRow[], info: ImportBatchInfo = {}) {
  const user = await requireApprovedUser();
  if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: 'No hay vuelos para guardar' };
  if (rows.length > MAX_IMPORT_ROWS) return { success: false, error: `Máximo ${MAX_IMPORT_ROWS} vuelos por lote` };

  const kb = await loadFleetKnowledge();
  const clean = [];
  for (const r of rows) {
    const fecha = typeof r?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) ? r.fecha : null;
    const aerolinea = r?.aerolinea === 'Air Panama' || r?.aerolinea === 'Copa Airlines' ? r.aerolinea : null;
    const tipo = r?.tipo === 'llegada' || r?.tipo === 'salida' ? r.tipo : null;
    const numero_vuelo = aerolinea && cut(r?.numero_vuelo, 20) ? canonicalFlightNumber(cut(r.numero_vuelo, 20), aerolinea) : null;
    const ruta = cut(r?.ruta, 5)?.toUpperCase() ?? null;
    if (!fecha || !aerolinea || !tipo || !numero_vuelo || !ruta || !/^[A-Z]{3,4}$/.test(ruta)) {
      return { success: false, error: `Vuelo inválido: ${numero_vuelo ?? '?'} ${fecha ?? ''} (revisa fecha, número y ruta)` };
    }
    // La flota de la base es la fuente de verdad para matrícula, modelo y capacidad
    const matricula = cut(r.matricula, 12) ? normalizeRegistration(cut(r.matricula, 12)) : null;
    const aircraft = resolveAircraft({ aircraft: cut(r.avion, 10), aircraftReg: matricula }, kb);
    clean.push({
      tipo, fecha, aerolinea, numero_vuelo, ruta,
      fields: {
        pasajeros_abordo: intIn(r.pasajeros, 0, 1000) ?? 0,
        capacidad_total: aircraft.paxMax ?? intIn(r.capacidad, 0, 1000) ?? 0,
        matricula,
        avion: aircraft.code ?? cut(r.avion, 10)?.toUpperCase() ?? null,
        handler: cut(r.handler, 80),
        stand: cut(r.stand, 10),
        servicio: cut(r.servicio, 10),
        notas: cut(r.notas, 500),
        mtow_kg: intIn(r.mtow_kg, 0, 1_000_000),
        fuente: 'excel',
      },
    });
  }

  const supabase = getAdminSupabase();
  let inserted = 0;
  let updated = 0;

  for (const tipo of ['llegada', 'salida'] as const) {
    const batch = clean.filter(r => r.tipo === tipo);
    if (batch.length === 0) continue;
    const table = tipo === 'llegada' ? 'llegadas_malek_historico' : 'salidas_malek_historico';
    const routeCol = tipo === 'llegada' ? 'origen' : 'destino';
    const fechas = batch.map(r => r.fecha).sort();

    const { data: existing, error: fetchError } = await supabase
      .from(table)
      .select(`id, fecha, aerolinea, numero_vuelo, ${routeCol}`)
      .gte('fecha', fechas[0])
      .lte('fecha', fechas[fechas.length - 1]);
    if (fetchError) return { success: false, error: fetchError.message };

    const key = (fecha: string, numero: string, ruta: string, aerolinea: string) =>
      `${fecha}|${canonicalFlightNumber(numero, aerolinea)}|${ruta}`.toUpperCase();
    const existingIds = new Map(
      (existing as unknown as Record<string, string>[] ?? []).map(e => [key(e.fecha, e.numero_vuelo, e[routeCol], e.aerolinea), e.id])
    );

    const toInsert = [];
    const toUpdate: { id: string; fields: Record<string, unknown> }[] = [];
    for (const r of batch) {
      const id = existingIds.get(key(r.fecha, r.numero_vuelo, r.ruta, r.aerolinea));
      if (id) toUpdate.push({ id, fields: r.fields });
      else toInsert.push({
        fecha: r.fecha,
        aerolinea: r.aerolinea,
        numero_vuelo: r.numero_vuelo,
        [routeCol]: r.ruta,
        estado_final: tipo === 'llegada' ? 'LLEGÓ' : 'CUMPLIDO',
        ...r.fields,
      });
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from(table).insert(toInsert);
      if (error) return { success: false, error: error.message, inserted, updated };
      inserted += toInsert.length;
    }
    // Actualizaciones de a 20 en paralelo para no saturar la base
    for (let i = 0; i < toUpdate.length; i += 20) {
      const results = await Promise.all(toUpdate.slice(i, i + 20).map(u =>
        supabase.from(table).update({ ...u.fields, actualizado_en: new Date().toISOString() }).eq('id', u.id)
      ));
      updated += results.filter(res => !res.error).length;
    }
  }

  const archivo = typeof info.archivo === 'string' ? info.archivo.slice(0, 120) : 'Excel';
  const lote = Number.isInteger(info.lote) && Number.isInteger(info.lotes) ? ` (lote ${info.lote} de ${info.lotes})` : '';
  const fechas = clean.map(r => r.fecha).sort();
  await logAudit({
    tipo_evento: 'importacion',
    actor: user,
    entidad: 'vuelo',
    nombre_referencia: `${archivo}${lote}`,
    descripcion: `Importó ${clean.length} vuelos del ${fechas[0]} al ${fechas[fechas.length - 1]}: ${inserted} nuevos, ${updated} actualizados.`,
    detalles_extra: { archivo, lote: info.lote ?? null, lotes: info.lotes ?? null, nuevos: inserted, actualizados: updated, desde: fechas[0], hasta: fechas[fechas.length - 1] },
  });

  return { success: true, inserted, updated };
}

// ---------------------------------------------------------------------------
// Agregar un vuelo directamente al Registro Histórico (Registro → Agregar vuelo)
// ---------------------------------------------------------------------------
export type HistoricoFlightInput = {
  tipo: 'llegada' | 'salida';
  fecha: string;               // YYYY-MM-DD
  aerolinea: 'Air Panama' | 'Copa Airlines';
  numero_vuelo: string;
  ruta: string;                // el otro aeropuerto (origen si llega, destino si sale)
  salida_programada?: string;  // HH:MM
  llegada_programada?: string; // HH:MM
  hora_real?: string;          // HH:MM de la llegada (o salida) en David
  estado_final: string;
  pasajeros: number;
  capacidad: number;
  matricula?: string;
  avion?: string;
};

const ESTADOS_HISTORICO = new Set(['LLEGÓ', 'CUMPLIDO', 'DEMORADO', 'DESVIADO', 'CANCELADO']);
const isHHMM = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);

export async function addHistoricoFlight(input: HistoricoFlightInput) {
  const user = await requireApprovedUser();
  const tipo = input?.tipo === 'llegada' || input?.tipo === 'salida' ? input.tipo : null;
  const aerolinea = input?.aerolinea === 'Air Panama' || input?.aerolinea === 'Copa Airlines' ? input.aerolinea : null;
  const fecha = typeof input?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.fecha) ? input.fecha : null;
  const ruta = typeof input?.ruta === 'string' && /^[A-Z]{3,4}$/.test(input.ruta) ? input.ruta : null;
  const numero = typeof input?.numero_vuelo === 'string' && input.numero_vuelo.trim() ? canonicalFlightNumber(input.numero_vuelo.trim().slice(0, 12), aerolinea) : null;
  const estado = typeof input?.estado_final === 'string' && ESTADOS_HISTORICO.has(input.estado_final) ? input.estado_final : null;
  if (!tipo || !aerolinea || !fecha || !ruta || !numero || !estado) {
    return { success: false, error: 'Revisa tipo, fecha, aerolínea, número, ruta y estado del vuelo' };
  }
  if (ruta === 'DAV') return { success: false, error: 'El otro aeropuerto no puede ser David' };

  const supabase = getAdminSupabase();
  const table = TABLE[tipo];
  const routeCol = tipo === 'llegada' ? 'origen' : 'destino';

  // Mismo vuelo, mismo día y misma ruta: no se duplica
  const { data: sameDay } = await supabase.from(table).select(`id, numero_vuelo, ${routeCol}`).eq('fecha', fecha).is('eliminado_en', null);
  const dup = ((sameDay ?? []) as unknown as Record<string, string>[])
    .some(r => canonicalFlightNumber(r.numero_vuelo, aerolinea) === numero && r[routeCol] === ruta);
  if (dup) return { success: false, error: `El ${numero} del ${fecha} (${tipo === 'llegada' ? `${ruta} → DAV` : `DAV → ${ruta}`}) ya está en el Registro` };

  const at = (hhmm?: string) => (isHHMM(hhmm) ? new Date(`${fecha}T${hhmm}:00-05:00`).toISOString() : null);
  const salidaProg = at(input.salida_programada);
  const llegadaProg = at(input.llegada_programada);
  const real = at(input.hora_real) ?? (tipo === 'llegada' ? llegadaProg : salidaProg);
  const kb = await loadFleetKnowledge();
  const aircraft = resolveAircraft({ aircraft: input.avion ?? null, aircraftReg: input.matricula ?? null }, kb);
  const matricula = input.matricula ? normalizeRegistration(input.matricula) : null;

  const row: Record<string, unknown> = {
    fecha,
    aerolinea,
    numero_vuelo: numero,
    [routeCol]: ruta,
    estado_final: estado,
    pasajeros_abordo: Math.max(0, Math.min(1000, Math.round(Number(input.pasajeros) || 0))),
    capacidad_total: aircraft.paxMax ?? Math.max(0, Math.min(1000, Math.round(Number(input.capacidad) || 0))),
    matricula,
    avion: aircraft.code ?? (input.avion ? input.avion.toUpperCase().slice(0, 10) : null),
    hora_itinerario: tipo === 'llegada' ? llegadaProg : salidaProg,
    hora_itinerario_salida: salidaProg,
    hora_itinerario_llegada: llegadaProg,
    fuente: 'manual',
  };
  if (tipo === 'llegada') { row.hora_real_llegada = real; row.hora_llegada_real = real; }
  else { row.hora_real_salida = real; row.hora_salida_real = real; }

  const { data, error } = await supabase.from(table).insert(row).select('id').single();
  if (error) return { success: false, error: error.message };

  await logAudit({
    tipo_evento: 'creacion',
    actor: user,
    entidad: 'vuelo',
    entidad_id: data.id,
    nombre_referencia: flightLabel(row, tipo),
    descripcion: `Agregó el vuelo al Registro (${estado}, ${row.pasajeros_abordo} pasajeros)`,
    detalles_extra: { vuelo: row },
  });
  return { success: true };
}

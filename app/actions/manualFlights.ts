"use server";

import { requireApprovedUser, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadFleetKnowledge } from '@/lib/fleet/knowledge';
import { applyFleetRules, canonicalFlightNumber, capacityOf, classifyCrewLine, legKey, normalizeRegistration } from '@/lib/fleet/rules';

const getAdminSupabase = createAdminClient;

export type ManualFlightInput = {
  id?: string;
  flightNumber: string;
  aircraft: string;
  aircraftReg: string;
  origin: string;
  originName: string;
  destination: string;
  destinationName: string;
  departureTimeLocal: string; // HH:mm
  arrivalTimeLocal: string; // HH:mm
  airline: string;
  pilot: string;         // capitán / primer oficial
  cabin_crew?: string;   // tripulantes de cabina
  notes?: string;        // notas del itinerario (chárter, carga…)
  paxCount: number;
  paxMax: number;
  flightDate: string; // YYYY-MM-DD
  actual_departure_time?: string;
  actual_arrival_time?: string;
  status_override?: string; // 'EN VUELO', 'ARRIBÓ', 'CANCELADO', etc.
  is_archived?: boolean;
};

// Columnas que el cliente puede escribir. Cualquier otra propiedad se descarta.
const WRITABLE_FIELDS = [
  'flightNumber', 'aircraft', 'aircraftReg', 'origin', 'originName', 'destination',
  'destinationName', 'departureTimeLocal', 'arrivalTimeLocal', 'airline', 'pilot',
  'paxCount', 'paxMax', 'flightDate', 'actual_departure_time', 'actual_arrival_time',
  'status_override', 'is_archived', 'cabin_crew', 'notes',
] as const;

function pickWritable(input: Partial<ManualFlightInput>) {
  const out: Record<string, unknown> = {};
  for (const key of WRITABLE_FIELDS) {
    if (input && key in input) out[key] = input[key];
  }
  return out;
}

export async function getManualFlightsForDate(dateStr?: string): Promise<ManualFlightInput[]> {
  await requireApprovedUser();
  try {
    const supabase = getAdminSupabase();
    
    const targetDate = dateStr;
    let query = supabase.from('manual_flights_log').select('*');
    
    if (targetDate !== 'TODOS') {
      let filterDate = targetDate;
      if (!filterDate) {
        // Ajustar a la hora de Panamá si no se pasa fecha
        const now = new Date();
        const panamaTimeStr = now.toLocaleString("en-US", { timeZone: "America/Panama" });
        const panamaDate = new Date(panamaTimeStr);
        filterDate = panamaDate.toISOString().split('T')[0];
      }
      query = query.eq('flightDate', filterDate); // Using flightDate based on schema
    }
    
    const { data, error } = await query;

    if (error || !data) {
      return [];
    }
    
    return data as ManualFlightInput[];
  } catch {
    return [];
  }
}

export async function addManualFlight(flight: ManualFlightInput) {
  await requireApprovedUser();
  const supabase = getAdminSupabase();
  const kb = await loadFleetKnowledge();
  const { error } = await supabase
    .from('manual_flights_log')
    .insert([applyFleetRules(pickWritable(flight), kb)]);
    
  if (error) {
    throw new Error(error.message);
  }
  return true;
}

export async function addMultipleManualFlights(flights: ManualFlightInput[]) {
  await requireApprovedUser();
  if (!Array.isArray(flights) || flights.length === 0) return true;

  const supabase = getAdminSupabase();
  
  // Extraer las fechas únicas de los vuelos a subir
  const uniqueDates = Array.from(new Set(flights.map(f => f.flightDate)));
  
  // Buscar vuelos existentes para esas fechas
  const [{ data: existingFlights, error: fetchError }, kb] = await Promise.all([
    supabase
      .from('manual_flights_log')
      .select('flightNumber, flightDate, origin, destination')
      .in('flightDate', uniqueDates),
    loadFleetKnowledge(),
  ]);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  // Filtrar los vuelos que ya existen: número Y ruta (el 693 tiene dos tramos el mismo día)
  const existingKeys = new Set(existingFlights.map(legKey));
  const newFlights = flights.filter(newFlight => !existingKeys.has(legKey(newFlight)));

  if (newFlights.length === 0) {
    return true; // Ya todos existen
  }

  // Insertar solo los nuevos
  const { error: insertError } = await supabase
    .from('manual_flights_log')
    .insert(newFlights.map(f => applyFleetRules(pickWritable(f), kb)));
    
  if (insertError) {
    throw new Error(insertError.message);
  }
  
  return true;
}

export async function updateFlightStatusOverride(id: string, override: { status_override?: string | null; actual_departure_time?: string | null; actual_arrival_time?: string | null }) {
  await requireApprovedUser();
  const supabase = getAdminSupabase();
  const { status_override, actual_departure_time, actual_arrival_time } = override;
  const { error } = await supabase
    .from('manual_flights_log')
    .update({ status_override, actual_departure_time, actual_arrival_time })
    .eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function archiveFlight(id: string) {
  await requireAdmin();
  const supabase = getAdminSupabase();

  // Obtener detalles del vuelo manual para actualizar el histórico correspondiente
  const { data: manualFlight, error: fetchErr } = await supabase
    .from('manual_flights_log')
    .select('*')
    .eq('id', id)
    .single();
    
  if (fetchErr) throw new Error(fetchErr.message);

  const { error } = await supabase
    .from('manual_flights_log')
    .update({ is_archived: true })
    .eq('id', id);
  if (error) throw new Error(error.message);

  // Actualizar o crear la tabla histórica
  let finalStatusArrival = 'LLEGÓ';
  let finalStatusDeparture = 'CUMPLIDO';
  
  if (manualFlight.status_override === 'CANCELADO') {
    finalStatusArrival = 'CANCELADO';
    finalStatusDeparture = 'CANCELADO';
  }

  // El itinerario guarda "971"; el histórico usa "7P-971". Si el vuelo ya está en el
  // histórico (p. ej. PENDIENTE del guardado automático), se aprueba esa misma fila.
  const numeroVuelo = canonicalFlightNumber(manualFlight.flightNumber, manualFlight.airline);
  const upsertHistorico = async (table: 'llegadas_malek_historico' | 'salidas_malek_historico', routeCol: 'origen' | 'destino', payload: Record<string, unknown>) => {
    const { data: sameDay } = await supabase.from(table).select(`id, numero_vuelo, ${routeCol}, estado_final`).eq('fecha', manualFlight.flightDate);
    const matches = ((sameDay ?? []) as unknown as Record<string, string>[])
      .filter(r => canonicalFlightNumber(r.numero_vuelo, manualFlight.airline) === numeroVuelo && r[routeCol] === payload[routeCol]);
    if (matches.length === 0) {
      const { error: insertErr } = await supabase.from(table).insert(payload);
      if (insertErr) throw new Error(insertErr.message);
      return;
    }
    // Se conserva una fila (la ya aprobada si la hay) y se quitan las copias pendientes
    const keep = matches.find(r => r.estado_final !== 'PENDIENTE') ?? matches[0];
    const { error: updateErr } = await supabase.from(table).update({ ...payload, actualizado_en: new Date().toISOString() }).eq('id', keep.id);
    if (updateErr) throw new Error(updateErr.message);
    const extras = matches.filter(r => r.id !== keep.id && r.estado_final === 'PENDIENTE').map(r => r.id);
    if (extras.length > 0) await supabase.from(table).delete().in('id', extras);
  };

  if (manualFlight.destination === 'DAV') {
    const payload = {
      fecha: manualFlight.flightDate,
      aerolinea: manualFlight.airline,
      numero_vuelo: numeroVuelo,
      origen: manualFlight.origin,
      hora_itinerario: `${manualFlight.flightDate}T${manualFlight.arrivalTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      hora_real_llegada: `${manualFlight.flightDate}T${manualFlight.actual_arrival_time?.padStart(5, '0') || manualFlight.arrivalTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      hora_llegada_real: `${manualFlight.flightDate}T${manualFlight.actual_arrival_time?.padStart(5, '0') || manualFlight.arrivalTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      estado_final: finalStatusArrival,
      pasajeros_abordo: manualFlight.paxCount,
      capacidad_total: manualFlight.paxMax
    };

    await upsertHistorico('llegadas_malek_historico', 'origen', payload);
  } else if (manualFlight.origin === 'DAV') {
    const payload = {
      fecha: manualFlight.flightDate,
      aerolinea: manualFlight.airline,
      numero_vuelo: numeroVuelo,
      destino: manualFlight.destination,
      hora_itinerario: `${manualFlight.flightDate}T${manualFlight.departureTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      hora_real_salida: `${manualFlight.flightDate}T${manualFlight.actual_departure_time?.padStart(5, '0') || manualFlight.departureTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      hora_salida_real: `${manualFlight.flightDate}T${manualFlight.actual_departure_time?.padStart(5, '0') || manualFlight.departureTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      estado_final: finalStatusDeparture,
      pasajeros_abordo: manualFlight.paxCount,
      capacidad_total: manualFlight.paxMax
    };

    await upsertHistorico('salidas_malek_historico', 'destino', payload);
  }

  return true;
}

export async function updateFlightDetails(id: string, updates: Partial<ManualFlightInput>) {
  await requireApprovedUser();
  const supabase = getAdminSupabase();

  // Solo columnas permitidas (descarta id y cualquier campo desconocido)
  const payload = applyFleetRules(pickWritable(updates), await loadFleetKnowledge());
  
  const { error } = await supabase
    .from('manual_flights_log')
    .update(payload)
    .eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function deleteManualFlight(id: string) {
  await requireAdmin();
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('manual_flights_log')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export type FleetSuggestion = { airline: string; aircraft: string; aircraftReg: string; paxMax: number };

// Sugerencias para el ingreso manual. La flota y la tripulación salen de la base de
// conocimiento; del historial solo se agregan matrículas que aún no están registradas
// (p. ej. Copa) y las parejas de pilotos, ya corregidas.
export async function getFlightFormSuggestions(): Promise<{ fleet: FleetSuggestion[]; pilots: string[]; cabin: string[] }> {
  await requireApprovedUser();
  const supabase = getAdminSupabase();
  const [{ data }, kb] = await Promise.all([
    supabase
      .from('manual_flights_log')
      .select('airline, aircraft, aircraftReg, paxMax, pilot, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    loadFleetKnowledge(),
  ]);

  const fleet = new Map<string, FleetSuggestion>();
  for (const a of kb.aircraft) {
    fleet.set(a.registration, { airline: a.airline, aircraft: a.code, aircraftReg: a.registration, paxMax: capacityOf(a.code, kb) ?? 0 });
  }

  const pilots = new Set<string>();
  for (const row of data ?? []) {
    const reg = normalizeRegistration(row.aircraftReg);
    if (reg && !fleet.has(reg)) {
      const fixed = applyFleetRules({ aircraft: row.aircraft, aircraftReg: reg, paxMax: row.paxMax }, kb);
      fleet.set(reg, { airline: row.airline || '', aircraft: fixed.aircraft || '', aircraftReg: reg, paxMax: fixed.paxMax || 0 });
    }
    // Solo parejas reconocidas como pilotos (antes se mezclaban tripulantes de cabina)
    const line = classifyCrewLine(row.pilot || '', kb);
    if (line.kind === 'pilotos' && line.unknown.length === 0) pilots.add(line.text);
  }
  for (const c of kb.crew) if (c.role !== 'cabina') pilots.add(c.name);

  return {
    fleet: [...fleet.values()].sort((a, b) => a.aircraftReg.localeCompare(b.aircraftReg)),
    pilots: [...pilots].sort(),
    cabin: kb.crew.filter(c => c.role === 'cabina').map(c => c.name).sort(),
  };
}

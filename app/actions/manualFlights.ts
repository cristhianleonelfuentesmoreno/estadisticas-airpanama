"use server";

import { requireApprovedUser, requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

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
  pilot: string;
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
  'status_override', 'is_archived',
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
  const { error } = await supabase
    .from('manual_flights_log')
    .insert([pickWritable(flight)]);
    
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
  const { data: existingFlights, error: fetchError } = await supabase
    .from('manual_flights_log')
    .select('flightNumber, flightDate')
    .in('flightDate', uniqueDates);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  // Filtrar los vuelos que ya existen
  const newFlights = flights.filter(newFlight => {
    return !existingFlights.some(existing => 
      existing.flightNumber === newFlight.flightNumber && 
      existing.flightDate === newFlight.flightDate
    );
  });

  if (newFlights.length === 0) {
    return true; // Ya todos existen
  }

  // Insertar solo los nuevos
  const { error: insertError } = await supabase
    .from('manual_flights_log')
    .insert(newFlights.map(pickWritable));
    
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

  if (manualFlight.destination === 'DAV') {
    const payload = {
      fecha: manualFlight.flightDate,
      aerolinea: manualFlight.airline,
      numero_vuelo: manualFlight.flightNumber,
      origen: manualFlight.origin,
      hora_itinerario: `${manualFlight.flightDate}T${manualFlight.arrivalTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      hora_real_llegada: `${manualFlight.flightDate}T${manualFlight.actual_arrival_time?.padStart(5, '0') || manualFlight.arrivalTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      hora_llegada_real: `${manualFlight.flightDate}T${manualFlight.actual_arrival_time?.padStart(5, '0') || manualFlight.arrivalTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      estado_final: finalStatusArrival,
      pasajeros_abordo: manualFlight.paxCount,
      capacidad_total: manualFlight.paxMax
    };

    const { data: existing } = await supabase.from('llegadas_malek_historico').select('id').eq('numero_vuelo', manualFlight.flightNumber).eq('fecha', manualFlight.flightDate).single();
    if (existing) {
      await supabase.from('llegadas_malek_historico').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('llegadas_malek_historico').insert(payload);
    }
  } else if (manualFlight.origin === 'DAV') {
    const payload = {
      fecha: manualFlight.flightDate,
      aerolinea: manualFlight.airline,
      numero_vuelo: manualFlight.flightNumber,
      destino: manualFlight.destination,
      hora_itinerario: `${manualFlight.flightDate}T${manualFlight.departureTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      hora_real_salida: `${manualFlight.flightDate}T${manualFlight.actual_departure_time?.padStart(5, '0') || manualFlight.departureTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      hora_salida_real: `${manualFlight.flightDate}T${manualFlight.actual_departure_time?.padStart(5, '0') || manualFlight.departureTimeLocal?.padStart(5, '0') || '12:00'}:00-05:00`,
      estado_final: finalStatusDeparture,
      pasajeros_abordo: manualFlight.paxCount,
      capacidad_total: manualFlight.paxMax
    };

    const { data: existing } = await supabase.from('salidas_malek_historico').select('id').eq('numero_vuelo', manualFlight.flightNumber).eq('fecha', manualFlight.flightDate).single();
    if (existing) {
      await supabase.from('salidas_malek_historico').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('salidas_malek_historico').insert(payload);
    }
  }

  return true;
}

export async function updateFlightDetails(id: string, updates: Partial<ManualFlightInput>) {
  await requireApprovedUser();
  const supabase = getAdminSupabase();

  // Solo columnas permitidas (descarta id y cualquier campo desconocido)
  const payload = pickWritable(updates);
  
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

// Sugerencias para el ingreso manual, tomadas de los vuelos ya registrados:
// matrículas conocidas (con su tipo y capacidad) y tripulaciones usadas.
export async function getFlightFormSuggestions(): Promise<{ fleet: FleetSuggestion[]; pilots: string[] }> {
  await requireApprovedUser();
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('manual_flights_log')
    .select('airline, aircraft, aircraftReg, paxMax, pilot, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error || !data) return { fleet: [], pilots: [] };

  // La fila más reciente de cada matrícula define su tipo y capacidad
  const fleet = new Map<string, FleetSuggestion>();
  const pilots = new Set<string>();
  for (const row of data) {
    const reg = (row.aircraftReg || '').trim().toUpperCase();
    if (reg && !fleet.has(reg)) {
      fleet.set(reg, {
        airline: row.airline || '',
        aircraft: row.aircraft || '',
        aircraftReg: reg,
        paxMax: row.paxMax || 0,
      });
    }
    const pilot = (row.pilot || '').trim();
    if (pilot) pilots.add(pilot);
  }

  return {
    fleet: [...fleet.values()].sort((a, b) => a.aircraftReg.localeCompare(b.aircraftReg)),
    pilots: [...pilots].sort(),
  };
}

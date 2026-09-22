"use server";

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
  status: 'PROGRAMADO' | 'ABORDANDO' | 'RETRASADO' | 'EN VUELO' | 'ARRIBO' | 'CANCELADO';
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
  const now = new Date(); // Obtenemos la hora local del dispositivo

  const parseTime = (timeStr: string) => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    // timeStr format is HH:MM or H:MM. Construct an ISO string for Panama time
    const [hours, mins] = timeStr.split(':');
    const paddedHours = hours.padStart(2, '0');
    return new Date(`${todayStr}T${paddedHours}:${mins}:00-05:00`);
  };

  const { getManualFlightsForDate } = await import('./manualFlights');
  const manualFlights = await getManualFlightsForDate(targetDate);
  
  // El itinerario real transcrito directamente de la imagen + Simulados de Copa (como fallback si la BD está vacía o no existe)
  let itinerary = manualFlights.map(f => ({
    num: f.flightNumber,
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
    let depDate = parseTime(flight.dep);
    let arrDate = parseTime(flight.arr);
    
    if (arrDate < depDate) {
      arrDate.setDate(arrDate.getDate() + 1);
    }


    const totalDurationMs = arrDate.getTime() - depDate.getTime();
    const elapsedMs = now.getTime() - depDate.getTime();
    
    let progress = 0;
    let status: FlightData['status'] = 'PROGRAMADO';

      if (flight.actualArrival || flight.statusOverride === 'ARRIBO') {
        progress = 100;
        status = 'ARRIBO';
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
        status = 'ARRIBO';
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
      id: `${flight.num}-${flight.dep}`,
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
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Usar el cliente administrador (bypassa RLS) para tareas automáticas en background
const getAdminSupabase = () => {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
};

export async function saveCompletedMalekFlights() {
  const supabase = getAdminSupabase();

  const flights = await getUpcomingFlights();
  const arrivedMalekFlights = flights.filter(f => f.destination === 'DAV' && f.status === 'ARRIBO');

  if (arrivedMalekFlights.length === 0) return { success: true, count: 0 };

  // Usar la fecha local de Panama
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); // YYYY-MM-DD
  
  const { data: existingFlights } = await supabase
    .from('llegadas_malek_historico')
    .select('numero_vuelo')
    .eq('fecha', today);

  const existingFlightNumbers = new Set(existingFlights?.map(f => f.numero_vuelo) || []);

  const flightsToInsert = arrivedMalekFlights
    .filter(f => !existingFlightNumbers.has(f.flightNumber))
    .map(f => ({
      fecha: today,
      aerolinea: f.airline,
      numero_vuelo: f.flightNumber,
      origen: f.origin,
      hora_itinerario: `${today}T${f.arrivalTimeLocal}:00-05:00`,
      hora_real_llegada: `${today}T${f.arrivalTimeLocal}:00-05:00`,
      estado_final: 'PENDIENTE',
      pasajeros_abordo: f.paxCount,
      capacidad_total: f.paxMax
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
  const supabase = await createClient();
  const today = dateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
  
  const { data, error } = await supabase
    .from('llegadas_malek_historico')
    .select('*')
    .eq('fecha', today)
    .order('hora_real_llegada', { ascending: false });

  if (error) {
    console.log("Error in Supabase for Malek arrivals.", error?.message);
    return [];
  }

  // Fetch manual_flights_log for the same date to get both times
  const { data: manualFlights } = await supabase
    .from('manual_flights_log')
    .select('flightNumber, departureTimeLocal, arrivalTimeLocal')
    .eq('flightDate', today);

  const enhancedData = (data || []).map(flight => {
    const manual = manualFlights?.find(m => m.flightNumber === flight.numero_vuelo);
    let depLocal = manual?.departureTimeLocal;
    let arrLocal = manual?.arrivalTimeLocal;

    if (!depLocal || !arrLocal) {
      // Fallback if not found in itinerary
      const baseDate = new Date(flight.hora_itinerario);
      const isCopa = flight.aerolinea.toLowerCase().includes('copa');
      const offsetMins = isCopa ? 65 : 60;
      
      const depDate = new Date(baseDate.getTime() - offsetMins * 60000);
      depLocal = `${depDate.getHours().toString().padStart(2, '0')}:${depDate.getMinutes().toString().padStart(2, '0')}`;
      arrLocal = `${baseDate.getHours().toString().padStart(2, '0')}:${baseDate.getMinutes().toString().padStart(2, '0')}`;
    }

    return {
      ...flight,
      hora_itinerario_salida: `${today}T${depLocal}:00-05:00`,
      hora_itinerario_llegada: `${today}T${arrLocal}:00-05:00`
    };
  });

  return enhancedData;
}

export async function updateLlegadaMalek(id: string, updates: { hora_real_llegada?: string, pasajeros_abordo?: number, estado_final?: string }) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('llegadas_malek_historico')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.log("Error updating llegada Malek:", error?.message || error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function saveCompletedMalekDepartures() {
  const supabase = getAdminSupabase();

  const flights = await getUpcomingFlights();
  const departedMalekFlights = flights.filter(f => f.origin === 'DAV' && f.status === 'ARRIBO');

  if (departedMalekFlights.length === 0) return { success: true, count: 0 };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); // YYYY-MM-DD
  
  const { data: existingFlights } = await supabase
    .from('salidas_malek_historico')
    .select('numero_vuelo')
    .eq('fecha', today);

  const existingFlightNumbers = new Set(existingFlights?.map(f => f.numero_vuelo) || []);

  const flightsToInsert = departedMalekFlights
    .filter(f => !existingFlightNumbers.has(f.flightNumber))
    .map(f => ({
      fecha: today,
      aerolinea: f.airline,
      numero_vuelo: f.flightNumber,
      destino: f.destination,
      hora_itinerario: `${today}T${f.departureTimeLocal}:00-05:00`,
      hora_real_salida: `${today}T${f.departureTimeLocal}:00-05:00`,
      estado_final: 'PENDIENTE',
      pasajeros_abordo: f.paxCount,
      capacidad_total: f.paxMax
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
  const supabase = await createClient();
  const today = dateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
  
  const { data, error } = await supabase
    .from('salidas_malek_historico')
    .select('*')
    .eq('fecha', today)
    .order('hora_real_salida', { ascending: false });

  if (error) {
    console.log("Error in Supabase for Malek departures.", error?.message);
    return [];
  }

  // Fetch manual_flights_log for the same date to get both times
  const { data: manualFlights } = await supabase
    .from('manual_flights_log')
    .select('flightNumber, departureTimeLocal, arrivalTimeLocal')
    .eq('flightDate', today);

  const enhancedData = (data || []).map(flight => {
    const manual = manualFlights?.find(m => m.flightNumber === flight.numero_vuelo);
    let depLocal = manual?.departureTimeLocal;
    let arrLocal = manual?.arrivalTimeLocal;

    if (!depLocal || !arrLocal) {
      // Fallback if not found in itinerary
      const baseDate = new Date(flight.hora_itinerario);
      const isCopa = flight.aerolinea.toLowerCase().includes('copa');
      const offsetMins = isCopa ? 65 : 60;
      
      const arrDate = new Date(baseDate.getTime() + offsetMins * 60000);
      depLocal = `${baseDate.getHours().toString().padStart(2, '0')}:${baseDate.getMinutes().toString().padStart(2, '0')}`;
      arrLocal = `${arrDate.getHours().toString().padStart(2, '0')}:${arrDate.getMinutes().toString().padStart(2, '0')}`;
    }

    return {
      ...flight,
      hora_itinerario_salida: `${today}T${depLocal}:00-05:00`,
      hora_itinerario_llegada: `${today}T${arrLocal}:00-05:00`
    };
  });

  return enhancedData;
}

export async function updateSalidaMalek(id: string, updates: { hora_real_salida?: string, pasajeros_abordo?: number, estado_final?: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('salidas_malek_historico')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.log("Error updating salida Malek:", error?.message || error);
    return { success: false, error: error.message };
  }
  return { success: true, message: "Registro actualizado exitosamente." };
}
export async function deleteLlegadaMalek(id: string) {
  const supabase = getAdminSupabase();
  const { error } = await supabase.from('llegadas_malek_historico').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteSalidaMalek(id: string) {
  const supabase = getAdminSupabase();
  const { error } = await supabase.from('salidas_malek_historico').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function insertFlightRecords(data: any[], type: 'llegadas' | 'salidas') {
  const supabase = getAdminSupabase();
  const table = type === 'llegadas' ? 'llegadas_malek_historico' : 'salidas_malek_historico';
  
  const dates = [...new Set(data.map(d => d.fecha))];
  const { data: existing, error: fetchError } = await supabase
    .from(table)
    .select('id, fecha, numero_vuelo')
    .in('fecha', dates);

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const existingMap = new Map(existing?.map(r => [`${r.fecha}_${r.numero_vuelo}`, r.id]) || []);
  
  const newData = [];
  const toUpdate = [];

  for (const d of data) {
    const key = `${d.fecha}_${d.numero_vuelo}`;
    if (existingMap.has(key)) {
      toUpdate.push({ id: existingMap.get(key), ...d });
    } else {
      newData.push(d);
    }
  }

  let updatedCount = 0;
  if (toUpdate.length > 0) {
    const updatePromises = toUpdate.map(async (record) => {
      const { id, ...updates } = record;
      const { error } = await supabase.from(table).update(updates).eq('id', id);
      if (!error) updatedCount++;
    });
    await Promise.all(updatePromises);
  }

  if (newData.length > 0) {
    const { error } = await supabase.from(table).insert(newData);
    if (error) {
      console.error("Error bulk inserting to", table, ":", error);
      return { success: false, error: error.message };
    }
  }
  
  return { success: true, inserted: newData.length, updated: updatedCount };
}

export async function getReporteMensual(year: number, month: number, range: 'month' | 'year' | '6m' = 'month') {
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

  const { data: llegadas } = await supabase
    .from('llegadas_malek_historico')
    .select('*')
    .gte('fecha', startDate)
    .lte('fecha', endDate);

  const { data: salidas } = await supabase
    .from('salidas_malek_historico')
    .select('*')
    .gte('fecha', startDate)
    .lte('fecha', endDate);

  return [...(llegadas || []), ...(salidas || [])];
}

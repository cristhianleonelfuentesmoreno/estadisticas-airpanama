"use server";

import { createClient as createAdminClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
};

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

export async function getManualFlightsForDate(dateStr?: string): Promise<ManualFlightInput[]> {
  try {
    const supabase = getAdminSupabase();
    
    let targetDate = dateStr;
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
  } catch (error) {
    return [];
  }
}

export async function addManualFlight(flight: ManualFlightInput) {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('manual_flights_log')
    .insert([flight]);
    
  if (error) {
    throw new Error(error.message);
  }
  return true;
}

export async function addMultipleManualFlights(flights: ManualFlightInput[]) {
  if (flights.length === 0) return true;

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
    .insert(newFlights);
    
  if (insertError) {
    throw new Error(insertError.message);
  }
  
  return true;
}

export async function updateFlightStatusOverride(id: string, override: { status_override?: string | null; actual_departure_time?: string | null; actual_arrival_time?: string | null }) {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('manual_flights_log')
    .update(override)
    .eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function archiveFlight(id: string) {
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

  // Actualizar la tabla histórica para que deje de estar "PENDIENTE"
  let finalStatusArrival = 'LLEGÓ';
  let finalStatusDeparture = 'CUMPLIDO';
  
  if (manualFlight.status_override === 'CANCELADO') {
    finalStatusArrival = 'CANCELADO';
    finalStatusDeparture = 'CANCELADO';
  }

  if (manualFlight.destination === 'DAV') {
    await supabase
      .from('llegadas_malek_historico')
      .update({ estado_final: finalStatusArrival })
      .eq('numero_vuelo', manualFlight.flightNumber)
      .eq('fecha', manualFlight.flightDate);
  } else if (manualFlight.origin === 'DAV') {
    await supabase
      .from('salidas_malek_historico')
      .update({ estado_final: finalStatusDeparture })
      .eq('numero_vuelo', manualFlight.flightNumber)
      .eq('fecha', manualFlight.flightDate);
  }

  return true;
}

export async function updateFlightDetails(id: string, updates: Partial<ManualFlightInput>) {
  const supabase = getAdminSupabase();
  
  // Clean up undefined/id fields
  const payload = { ...updates };
  delete payload.id;
  
  const { error } = await supabase
    .from('manual_flights_log')
    .update(payload)
    .eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

export async function deleteManualFlight(id: string) {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('manual_flights_log')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

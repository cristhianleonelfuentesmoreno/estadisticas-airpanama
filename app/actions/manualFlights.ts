"use server";

import { createClient as createAdminClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
};

export type ManualFlightInput = {
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
};

export async function getManualFlightsForToday(): Promise<ManualFlightInput[]> {
  try {
    const supabase = getAdminSupabase();
    // Ajustar a la hora de Panamá
    const now = new Date();
    const panamaTimeStr = now.toLocaleString("en-US", { timeZone: "America/Panama" });
    const panamaDate = new Date(panamaTimeStr);
    const today = panamaDate.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('manual_flights_log')
      .select('*')
      .eq('flightDate', today);

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
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('manual_flights_log')
    .insert(flights);
    
  if (error) {
    throw new Error(error.message);
  }
  return true;
}

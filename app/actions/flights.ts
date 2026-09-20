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
  status: 'A TIEMPO' | 'ABORDANDO' | 'RETRASADO' | 'EN VUELO' | 'LLEGÓ';
  gate: string;
  pilot: string;
  paxCount: number;
  paxMax: number;
  flightType: string;
  airline: string; // <-- Nuevo campo para diferenciar
  progress: number; // 0 to 100
  durationStr: string;
}

export async function getUpcomingFlights(): Promise<FlightData[]> {
  const now = new Date(); // Obtenemos la hora local del dispositivo

  // Función para convertir la hora del itinerario ("13:30") a un objeto Date del día de hoy
  const parseTime = (timeStr: string) => {
    const [hours, mins] = timeStr.split(':').map(Number);
    const date = new Date(now);
    date.setHours(hours, mins, 0, 0);
    return date;
  };

  // El itinerario real transcrito directamente de la imagen + Simulados de Copa
  const itinerary = [
    // --- AIR PANAMA: AVION DH8D HP-1997 ---
    { num: '972', dep: '13:30', arr: '14:45', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'DAV', desName: 'David (Malek)', pilot: 'RUDY NIETO/ ADAM ALMENGOR', pax: 21, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },
    { num: '973', dep: '14:45', arr: '16:00', ori: 'DAV', oriName: 'David (Malek)', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'IRIS PEREIRA/ YASLIN SANTAMARIA', pax: 70, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },
    { num: '982', dep: '16:00', arr: '17:15', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'BOC', desName: 'Bocas del Toro', pilot: 'RUDY NIETO/ ADAM ALMENGOR', pax: 30, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },
    { num: '983', dep: '17:15', arr: '18:45', ori: 'BOC', oriName: 'Bocas del Toro', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'JAVIER SANCHEZ/ KRYSTEL CEDEÑO', pax: 70, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },
    { num: '970', dep: '18:45', arr: '19:45', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'DAV', desName: 'David (Malek)', pilot: 'RUDY NIETO/ ADAM ALMENGOR', pax: 11, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },
    { num: '971', dep: '19:45', arr: '20:45', ori: 'DAV', oriName: 'David (Malek)', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'JAVIER SANCHEZ/ KRYSTEL CEDEÑO', pax: 28, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },

    // --- AIR PANAMA: AVION FK50 HP-1891 ---
    { num: '680', dep: '06:45', arr: '08:15', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'BOC', desName: 'Bocas del Toro', pilot: 'ALEX CASTRO/ PEDRO RODRIGUEZ', pax: 4, max: 50, type: 'FK50', reg: 'HP-1891', airline: 'Air Panama' },
    { num: '681', dep: '08:15', arr: '09:45', ori: 'BOC', oriName: 'Bocas del Toro', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'MILAGROS PEREZ', pax: 36, max: 50, type: 'FK50', reg: 'HP-1891', airline: 'Air Panama' },
    { num: '682', dep: '09:45', arr: '11:15', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'BOC', desName: 'Bocas del Toro', pilot: 'ALEX CASTRO/ PEDRO RODRIGUEZ', pax: 41, max: 50, type: 'FK50', reg: 'HP-1891', airline: 'Air Panama' },
    { num: '683', dep: '11:15', arr: '12:45', ori: 'BOC', oriName: 'Bocas del Toro', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'MILAGROS PEREZ', pax: 50, max: 50, type: 'FK50', reg: 'HP-1891', airline: 'Air Panama' },
    { num: '980', dep: '12:45', arr: '14:15', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'BOC', desName: 'Bocas del Toro', pilot: 'DIMAS PALACIOS/ TAIRENA SIERRA', pax: 26, max: 50, type: 'FK50', reg: 'HP-1891', airline: 'Air Panama' },
    { num: '981', dep: '14:15', arr: '15:45', ori: 'BOC', oriName: 'Bocas del Toro', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'YESSICA QUINTERO', pax: 50, max: 50, type: 'FK50', reg: 'HP-1891', airline: 'Air Panama' },
    { num: '950', dep: '16:30', arr: '17:15', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'CTD', desName: 'Chitré', pilot: 'DIMAS PALACIOS/ TAIRENA SIERRA', pax: 16, max: 50, type: 'FK50', reg: 'HP-1891', airline: 'Air Panama' },
    { num: '951', dep: '17:15', arr: '18:00', ori: 'CTD', oriName: 'Chitré', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'YESSICA QUINTERO', pax: 24, max: 50, type: 'FK50', reg: 'HP-1891', airline: 'Air Panama' },

    // --- AIR PANAMA: AVION C-208 HP-1993 (CHARTER) ---
    { num: '6601', dep: '10:00', arr: '11:20', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'PUE', desName: 'Puerto Obaldia', pilot: 'FELIX MORALES / MARIAFELIZA SARRIA', pax: 8, max: 12, type: 'C-208', reg: 'HP-1993', airline: 'Air Panama' },
    { num: '6600', dep: '11:20', arr: '13:00', ori: 'PUE', oriName: 'Puerto Obaldia', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'FELIX MORALES / MARIAFELIZA SARRIA', pax: 6, max: 12, type: 'C-208', reg: 'HP-1993', airline: 'Air Panama' },
    { num: '9901', dep: '13:00', arr: '13:40', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'SIC', desName: 'San José', pilot: 'FELIX MORALES / MARIAFELIZA SARRIA', pax: 12, max: 12, type: 'C-208', reg: 'HP-1993', airline: 'Air Panama' },
    { num: '9900', dep: '13:40', arr: '14:10', ori: 'SIC', oriName: 'San José', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'FELIX MORALES / MARIAFELIZA SARRIA', pax: 12, max: 12, type: 'C-208', reg: 'HP-1993', airline: 'Air Panama' },
    { num: '9903', dep: '14:10', arr: '14:50', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'SIC', desName: 'San José', pilot: 'FELIX MORALES / MARIAFELIZA SARRIA', pax: 10, max: 12, type: 'C-208', reg: 'HP-1993', airline: 'Air Panama' },
    { num: '9902', dep: '14:50', arr: '15:30', ori: 'SIC', oriName: 'San José', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'FELIX MORALES / MARIAFELIZA SARRIA', pax: 10, max: 12, type: 'C-208', reg: 'HP-1993', airline: 'Air Panama' },

    // --- COPA AIRLINES (Simulados para David) ---
    { num: '011', dep: '07:45', arr: '08:50', ori: 'PTY', oriName: 'Tocumen', des: 'DAV', desName: 'David (Malek)', pilot: 'CAP. COPA 1', pax: 145, max: 160, type: 'B738', reg: 'HP-1530CMP', airline: 'Copa Airlines' },
    { num: '013', dep: '15:15', arr: '16:20', ori: 'PTY', oriName: 'Tocumen', des: 'DAV', desName: 'David (Malek)', pilot: 'CAP. COPA 2', pax: 130, max: 160, type: 'B738', reg: 'HP-1532CMP', airline: 'Copa Airlines' },
    { num: '012', dep: '09:20', arr: '10:25', ori: 'DAV', oriName: 'David (Malek)', des: 'PTY', desName: 'Tocumen', pilot: 'CAP. COPA 1', pax: 155, max: 160, type: 'B738', reg: 'HP-1530CMP', airline: 'Copa Airlines' },
    { num: '014', dep: '17:00', arr: '18:05', ori: 'DAV', oriName: 'David (Malek)', des: 'PTY', desName: 'Tocumen', pilot: 'CAP. COPA 2', pax: 120, max: 160, type: 'B738', reg: 'HP-1532CMP', airline: 'Copa Airlines' },
  ];

  const flights: FlightData[] = itinerary.map((flight) => {
    const depDate = parseTime(flight.dep);
    const arrDate = parseTime(flight.arr);
    
    // Si la llegada es matemáticamente menor a la salida, significa que cruza la medianoche
    if (arrDate < depDate) {
      arrDate.setDate(arrDate.getDate() + 1);
    }

    const totalDurationMs = arrDate.getTime() - depDate.getTime();
    const elapsedMs = now.getTime() - depDate.getTime();
    
    let progress = 0;
    let status: FlightData['status'] = 'A TIEMPO';
    
    // Logica de calculo de estado en base a la hora actual
    if (elapsedMs < 0) {
      // Falta tiempo para que salga
      progress = 0;
      // Si falta menos de 30 mins, está abordando
      if (Math.abs(elapsedMs) <= 30 * 60000) {
        status = 'ABORDANDO';
      } else {
        status = 'A TIEMPO';
      }
    } else if (elapsedMs >= totalDurationMs) {
      // Ya llegó
      progress = 100;
      status = 'LLEGÓ';
    } else {
      // Está en vuelo
      progress = Math.floor((elapsedMs / totalDurationMs) * 100);
      status = 'EN VUELO';
    }

    const durationMins = totalDurationMs / 60000;
    const hours = Math.floor(durationMins / 60);
    const mins = durationMins % 60;
    const durationStr = hours > 0 ? `${hours}h ${mins.toString().padStart(2, '0')}m` : `${mins} min`;

    const prefix = flight.airline === 'Copa Airlines' ? 'CM-' : '7P-';

    return {
      id: flight.num,
      flightNumber: `${prefix}${flight.num}`,
      aircraft: flight.type,
      aircraftReg: flight.reg,
      origin: flight.ori,
      originName: flight.oriName,
      destination: flight.des,
      destinationName: flight.desName,
      departureTime: depDate.toISOString(),
      arrivalTime: arrDate.toISOString(),
      status,
      gate: '1',
      pilot: flight.pilot,
      paxCount: flight.pax,
      paxMax: flight.max,
      flightType: 'REGULAR',
      airline: flight.airline,
      progress,
      durationStr
    };
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
  const arrivedMalekFlights = flights.filter(f => f.destination === 'DAV' && f.status === 'LLEGÓ');

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
      hora_itinerario: f.arrivalTime,
      hora_llegada_real: f.arrivalTime,
      estado_final: f.status,
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
    .order('hora_llegada_real', { ascending: false });

  if (error) {
    console.log("Error in Supabase for Malek arrivals.", error?.message);
    return [];
  }

  return data || [];
}

export async function updateLlegadaMalek(id: string, updates: { hora_llegada_real?: string, pasajeros_abordo?: number, estado_final?: string }) {
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
  const departedMalekFlights = flights.filter(f => f.origin === 'DAV' && f.status === 'LLEGÓ');

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
      hora_itinerario: f.departureTime,
      hora_salida_real: f.departureTime,
      estado_final: f.status,
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
    .order('hora_salida_real', { ascending: false });

  if (error) {
    console.log("Error in Supabase for Malek departures.", error?.message);
    return [];
  }
  return data || [];
}

export async function updateSalidaMalek(id: string, updates: { hora_salida_real?: string, pasajeros_abordo?: number, estado_final?: string }) {
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
  
  const { error } = await supabase.from(table).insert(data);
  if (error) {
    console.error("Error bulk inserting to", table, ":", error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

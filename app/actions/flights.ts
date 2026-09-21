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
  status: 'PROGRAMADO' | 'ABORDANDO' | 'RETRASADO' | 'EN VUELO' | 'LLEGÓ';
  gate: string;
  pilot: string;
  paxCount: number;
  paxMax: number;
  flightType: string;
  airline: string; // <-- Nuevo campo para diferenciar
  progress: number; // 0 to 100
  durationStr: string;
  trackingLink?: string;
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

  const { getManualFlightsForToday } = await import('./manualFlights');
  const manualFlights = await getManualFlightsForToday();
  
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
    airline: f.airline
  }));

  if (itinerary.length === 0) {
    itinerary = [
      // --- AIR PANAMA: AVION DH8D HP-1997 ---
      { num: '670', dep: '07:00', arr: '08:15', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'DAV', desName: 'David (Malek)', pilot: 'MARIO RODRIGUEZ/ EDUARDO HERRERA', pax: 25, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },
      { num: '671', dep: '08:30', arr: '09:45', ori: 'DAV', oriName: 'David (Malek)', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'IRIS PEREIRA/ BIANCA HIDALGO', pax: 34, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },
      { num: '970', dep: '16:15', arr: '17:30', ori: 'PAC', oriName: 'Marcos A. Gelabert', des: 'DAV', desName: 'David (Malek)', pilot: 'MARIO RODRIGUEZ/ EDUARDO HERRERA', pax: 16, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },
      { num: '971', dep: '17:30', arr: '18:45', ori: 'DAV', oriName: 'David (Malek)', des: 'PAC', desName: 'Marcos A. Gelabert', pilot: 'YESSICA QUINTERO/ KRYSTEL CEDEÑO', pax: 59, max: 78, type: 'DH8D', reg: 'HP-1997', airline: 'Air Panama' },
  
      // --- AIR PANAMA: AVION C-208 HP-1993 (Tramos DAV) ---
      { num: '693', dep: '10:50', arr: '11:30', ori: 'BOC', oriName: 'Bocas del Toro', des: 'DAV', desName: 'David (Malek)', pilot: 'JORGE CANO/ JERRY WAITE', pax: 4, max: 12, type: 'C-208', reg: 'HP-1993', airline: 'Air Panama' },
      { num: '692', dep: '11:55', arr: '12:35', ori: 'DAV', oriName: 'David (Malek)', des: 'BOC', desName: 'Bocas del Toro', pilot: 'JORGE CANO/ JERRY WAITE', pax: 4, max: 12, type: 'C-208', reg: 'HP-1993', airline: 'Air Panama' },
  
      // --- COPA AIRLINES ---
      { num: '013', dep: '06:30', arr: '07:45', ori: 'PTY', oriName: 'Tocumen', des: 'DAV', desName: 'David (Malek)', pilot: 'CAP. COPA', pax: 140, max: 160, type: 'B738', reg: 'HP-1530CMP', airline: 'Copa Airlines' },
      { num: '011', dep: '08:26', arr: '09:39', ori: 'DAV', oriName: 'David (Malek)', des: 'PTY', desName: 'Tocumen', pilot: 'CAP. COPA', pax: 155, max: 160, type: 'B738', reg: 'HP-1530CMP', airline: 'Copa Airlines' },
      { num: '017', dep: '07:55', arr: '09:10', ori: 'PTY', oriName: 'Tocumen', des: 'DAV', desName: 'David (Malek)', pilot: 'CAP. COPA', pax: 145, max: 160, type: 'B738', reg: 'HP-1532CMP', airline: 'Copa Airlines' },
      { num: '018', dep: '09:50', arr: '11:03', ori: 'DAV', oriName: 'David (Malek)', des: 'PTY', desName: 'Tocumen', pilot: 'CAP. COPA', pax: 130, max: 160, type: 'B738', reg: 'HP-1532CMP', airline: 'Copa Airlines' },
      { num: '028', dep: '17:53', arr: '19:17', ori: 'PTY', oriName: 'Tocumen', des: 'DAV', desName: 'David (Malek)', pilot: 'CAP. COPA', pax: 135, max: 160, type: 'B738', reg: 'HP-1534CMP', airline: 'Copa Airlines' },
      { num: '030', dep: '19:57', arr: '21:10', ori: 'DAV', oriName: 'David (Malek)', des: 'PTY', desName: 'Tocumen', pilot: 'CAP. COPA', pax: 150, max: 160, type: 'B738', reg: 'HP-1534CMP', airline: 'Copa Airlines' },
    ];
  }

  // 1. Fetch API Configs
  const { getApiConfigs } = await import('./apiConfig');
  const apiConfigs = await getApiConfigs();
  const faConfig = apiConfigs.flightaware;
  const fr24Config = apiConfigs.flightradar24;

  let aeroApiData: any[] = [];
  let fr24ApiData: any[] = [];

  const panamaTimeStr = now.toLocaleString("en-US", { timeZone: "America/Panama", hour12: false, hour: 'numeric' });
  const panamaHour = parseInt(panamaTimeStr, 10);

  // Solo consultar APIs entre 06:00 AM y 08:00 PM (inclusive)
  if (panamaHour >= 6 && panamaHour <= 20) {
    const promises: Promise<void>[] = [];

    // Tarea 1: FlightAware (Para Copa)
    if (faConfig?.is_active && faConfig?.api_key) {
      promises.push((async () => {
        try {
          const fetchConfig = {
            headers: { 'x-apikey': faConfig.api_key },
            next: { revalidate: 1800 }
          };
          const [depRes, arrRes] = await Promise.all([
            fetch('https://aeroapi.flightaware.com/aeroapi/airports/MPDA/flights/departures', fetchConfig),
            fetch('https://aeroapi.flightaware.com/aeroapi/airports/MPDA/flights/arrivals', fetchConfig)
          ]);
          if (depRes.ok && arrRes.ok) {
            const depData = await depRes.json();
            const arrData = await arrRes.json();
            aeroApiData = [...(depData.departures || []), ...(arrData.arrivals || [])];
          }
        } catch (error) {
          console.error("Error fetching FlightAware:", error);
        }
      })());
    }

    // Tarea 2: FlightRadar24 (Para Air Panama)
    if (fr24Config?.is_active && fr24Config?.api_key) {
      promises.push((async () => {
        try {
          const fetchConfig = {
            headers: { 
              'Accept': 'application/json',
              'Accept-Version': 'v1',
              'Authorization': `Bearer ${fr24Config.api_key}`
            },
            next: { revalidate: 1800 }
          };
          const res = await fetch('https://fr24api.flightradar24.com/api/live/flight-positions/full?airports=MPDA', fetchConfig);
          if (res.ok) {
            const data = await res.json();
            fr24ApiData = data.data || [];
          }
        } catch (error) {
          console.error("Error fetching FlightRadar24:", error);
        }
      })());
    }

    await Promise.all(promises);
  }

  const flights: FlightData[] = itinerary.map((flight) => {
    let depDate = parseTime(flight.dep);
    let arrDate = parseTime(flight.arr);
    
    if (arrDate < depDate) {
      arrDate.setDate(arrDate.getDate() + 1);
    }

    let trackingLink = '';

    // 2. Merge con datos de APIs
    if (flight.airline === 'Copa Airlines') {
      const targetIdents = [`CMP${flight.num}`, `CM${flight.num}`, flight.num];
      const apiMatch = aeroApiData.find(f => targetIdents.includes(f.ident) || targetIdents.includes(f.flight_number));
      
      if (apiMatch) {
        if (apiMatch.estimated_departure_time) depDate = new Date(apiMatch.estimated_departure_time);
        else if (apiMatch.scheduled_departure_time) depDate = new Date(apiMatch.scheduled_departure_time);
        
        if (apiMatch.estimated_arrival_time) arrDate = new Date(apiMatch.estimated_arrival_time);
        else if (apiMatch.scheduled_arrival_time) arrDate = new Date(apiMatch.scheduled_arrival_time);
        
        trackingLink = `https://flightaware.com/live/flight/${apiMatch.ident}`;
      } else {
        trackingLink = `https://flightaware.com/live/flight/CMP${flight.num}`;
      }
    } else if (flight.airline === 'Air Panama') {
      const targetIdents = [`PNC${flight.num}`, `7P${flight.num}`, flight.num];
      // En FR24, el callsign a veces viene en 'callsign' o 'flight'
      const apiMatch = fr24ApiData.find(f => targetIdents.includes(f.callsign) || targetIdents.includes(f.flight));

      if (apiMatch) {
        // En FR24, times are in seconds (unix timestamp) if they exist. Actually this is live positions endpoint, so it has current position.
        // Let's just create the tracking link
        trackingLink = `https://www.flightradar24.com/${apiMatch.callsign}/${apiMatch.id}`;
      } else {
        trackingLink = `https://www.flightradar24.com/data/flights/7p${flight.num}`;
      }
    }

    const totalDurationMs = arrDate.getTime() - depDate.getTime();
    const elapsedMs = now.getTime() - depDate.getTime();
    
    let progress = 0;
    let status: FlightData['status'] = 'PROGRAMADO';
    
    // Logica de calculo de estado en base a la hora actual
    if (elapsedMs < 0) {
      // Falta tiempo para que salga
      progress = 0;
      // Si falta menos de 30 mins, está abordando
      if (Math.abs(elapsedMs) <= 30 * 60000) {
        status = 'ABORDANDO';
      } else {
        status = 'PROGRAMADO';
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
      trackingLink
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
      hora_itinerario: `${today}T${f.arrivalTimeLocal}:00-05:00`,
      hora_llegada_real: `${today}T${f.arrivalTimeLocal}:00-05:00`,
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
      hora_itinerario: `${today}T${f.departureTimeLocal}:00-05:00`,
      hora_salida_real: `${today}T${f.departureTimeLocal}:00-05:00`,
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
  
  const dates = [...new Set(data.map(d => d.fecha))];
  const { data: existing, error: fetchError } = await supabase
    .from(table)
    .select('fecha, numero_vuelo')
    .in('fecha', dates);

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const existingSet = new Set(existing?.map(r => `${r.fecha}_${r.numero_vuelo}`) || []);
  const newData = data.filter(d => !existingSet.has(`${d.fecha}_${d.numero_vuelo}`));

  if (newData.length === 0) {
    return { success: true, inserted: 0, skipped: data.length, message: 'Todos los registros ya existían.' };
  }
  
  const { error } = await supabase.from(table).insert(newData);
  if (error) {
    console.error("Error bulk inserting to", table, ":", error);
    return { success: false, error: error.message };
  }
  
  return { success: true, inserted: newData.length, skipped: data.length - newData.length };
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

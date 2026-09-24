"use server";

import { requireApprovedUser, requireSupervisor } from '@/lib/auth';
import { diffFields, logAudit } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadFleetKnowledge } from '@/lib/fleet/knowledge';
import { applyFleetRules, canonicalFlightNumber, capacityOf, legKey, normalizeRegistration } from '@/lib/fleet/rules';

const getAdminSupabase = createAdminClient;

// "7P-971 · 2026-09-22 · DAV → PAC" para la bitácora del itinerario
const itineraryLabel = (f: { flightNumber?: string | null; airline?: string | null; flightDate?: string | null; origin?: string | null; destination?: string | null }) =>
  [canonicalFlightNumber(f.flightNumber, f.airline), f.flightDate, `${f.origin ?? '?'} → ${f.destination ?? '?'}`].filter(Boolean).join(' · ');

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
  const user = await requireApprovedUser();
  const supabase = getAdminSupabase();
  const kb = await loadFleetKnowledge();
  const { error } = await supabase
    .from('manual_flights_log')
    .insert([applyFleetRules(pickWritable(flight), kb)]);
    
  if (error) {
    throw new Error(error.message);
  }
  await logAudit({
    tipo_evento: 'creacion', actor: user, entidad: 'vuelo',
    nombre_referencia: itineraryLabel(flight),
    descripcion: 'Agregó un vuelo al itinerario',
  });
  return true;
}

export async function addMultipleManualFlights(flights: ManualFlightInput[]) {
  const user = await requireApprovedUser();
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

  await logAudit({
    tipo_evento: 'importacion', actor: user, entidad: 'vuelo',
    nombre_referencia: `Itinerario ${uniqueDates.sort().join(', ')}`,
    descripcion: `Cargó el itinerario: ${newFlights.length} vuelo(s) nuevo(s) de ${flights.length} leído(s)`,
    detalles_extra: { vuelos: newFlights.map(f => itineraryLabel(f)).slice(0, 60) },
  });
  return true;
}

export async function updateFlightStatusOverride(id: string, override: { status_override?: string | null; actual_departure_time?: string | null; actual_arrival_time?: string | null }) {
  const user = await requireApprovedUser();
  const supabase = getAdminSupabase();
  const { status_override, actual_departure_time, actual_arrival_time } = override;
  const next = { status_override, actual_departure_time, actual_arrival_time };
  const { data: before } = await supabase.from('manual_flights_log').select('*').eq('id', id).maybeSingle();
  const { error } = await supabase
    .from('manual_flights_log')
    .update(next)
    .eq('id', id);
  if (error) throw new Error(error.message);
  const cambios = diffFields(before, next);
  if (before && Object.keys(cambios).length > 0) {
    await logAudit({
      tipo_evento: 'edicion', actor: user, entidad: 'vuelo', entidad_id: id,
      nombre_referencia: itineraryLabel(before),
      descripcion: `Actualizó el estado del vuelo en el itinerario: ${Object.entries(cambios).map(([k, c]) => `${k}: ${c.antes ?? '—'} → ${c.despues ?? '—'}`).join(' · ')}`,
      detalles_extra: { cambios },
    });
  }
  return true;
}

// Archivar = aprobar el vuelo y pasarlo al histórico: lo puede hacer cualquier usuario
export async function archiveFlight(id: string) {
  const user = await requireApprovedUser();
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
  // Avión y matrícula pasan al histórico (se ven en Registro y en el Excel de Reportes)
  const aeronave = {
    avion: manualFlight.aircraft || null,
    matricula: manualFlight.aircraftReg ? normalizeRegistration(manualFlight.aircraftReg) : null,
  };
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
      capacidad_total: manualFlight.paxMax,
      ...aeronave,
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
      capacidad_total: manualFlight.paxMax,
      ...aeronave,
    };

    await upsertHistorico('salidas_malek_historico', 'destino', payload);
  }

  await logAudit({
    tipo_evento: 'aprobacion', actor: user, entidad: 'vuelo', entidad_id: id,
    nombre_referencia: itineraryLabel(manualFlight),
    descripcion: `Aprobó y archivó el vuelo del itinerario (${manualFlight.destination === 'DAV' ? finalStatusArrival : finalStatusDeparture}, ${manualFlight.paxCount ?? 0} pasajeros)`,
  });
  return true;
}

export async function updateFlightDetails(id: string, updates: Partial<ManualFlightInput>) {
  const user = await requireApprovedUser();
  const supabase = getAdminSupabase();

  // Solo columnas permitidas (descarta id y cualquier campo desconocido)
  const payload = applyFleetRules(pickWritable(updates), await loadFleetKnowledge());
  const { data: before } = await supabase.from('manual_flights_log').select('*').eq('id', id).maybeSingle();
  
  const { error } = await supabase
    .from('manual_flights_log')
    .update(payload)
    .eq('id', id);
  if (error) throw new Error(error.message);
  const cambios = diffFields(before, payload as Record<string, unknown>);
  if (before && Object.keys(cambios).length > 0) {
    await logAudit({
      tipo_evento: 'edicion', actor: user, entidad: 'vuelo', entidad_id: id,
      nombre_referencia: itineraryLabel({ ...before, ...payload }),
      descripcion: `Editó el vuelo del itinerario: ${Object.entries(cambios).map(([k, c]) => `${k}: ${c.antes ?? '—'} → ${c.despues ?? '—'}`).join(' · ')}`,
      detalles_extra: { cambios },
    });
  }
  return true;
}

// Borrar del itinerario (no del histórico) es de supervisores
export async function deleteManualFlight(id: string) {
  const user = await requireSupervisor();
  const supabase = getAdminSupabase();
  const { data: before } = await supabase.from('manual_flights_log').select('*').eq('id', id).maybeSingle();
  const { error } = await supabase
    .from('manual_flights_log')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
  if (before) {
    await logAudit({
      tipo_evento: 'eliminacion', actor: user, entidad: 'vuelo', entidad_id: id,
      nombre_referencia: itineraryLabel(before),
      descripcion: 'Eliminó el vuelo del itinerario',
      detalles_extra: { vuelo: before },
    });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Conocimiento para el ingreso manual guiado: la base (flota, tripulación, rutas y
// vuelos regulares) + lo aprendido del histórico del último año (vuelos y matrículas
// frecuentes; así Copa también tiene sugerencias aunque no esté en la base de flota).
// ---------------------------------------------------------------------------
export type FrequentFlight = { airline: string; flightNumber: string; origin: string; destination: string; count: number };
export type KnownAircraft = { airline: string; registration: string; code: string; paxMax: number; count: number };

export async function getManualFormKnowledge() {
  await requireApprovedUser();
  const supabase = getAdminSupabase();
  const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const [kb, llegadas, salidas] = await Promise.all([
    loadFleetKnowledge(),
    supabase.from('llegadas_malek_historico').select('aerolinea, numero_vuelo, origen, matricula, avion').gte('fecha', since).is('eliminado_en', null).limit(5000),
    supabase.from('salidas_malek_historico').select('aerolinea, numero_vuelo, destino, matricula, avion').gte('fecha', since).is('eliminado_en', null).limit(5000),
  ]);

  const flights = new Map<string, FrequentFlight>();
  const aircraft = new Map<string, KnownAircraft>();
  const add = (airline: string, numero: string, origin: string, destination: string, reg: string | null, avion: string | null) => {
    // El itinerario guarda el número sin prefijo ("670", "17"); los sufijos (-A) son extras
    const [, num, suffix] = canonicalFlightNumber(numero, airline).split('-');
    if (num && !suffix) {
      const key = `${airline}|${num}|${origin}|${destination}`;
      const f = flights.get(key) ?? { airline, flightNumber: num, origin, destination, count: 0 };
      f.count++;
      flights.set(key, f);
    }
    if (reg) {
      const registration = normalizeRegistration(reg);
      const known = kb.aircraft.find(a => a.registration === registration);
      const code = known?.code ?? avion ?? '';
      const a = aircraft.get(registration) ?? { airline, registration, code, paxMax: capacityOf(code, kb) ?? 0, count: 0 };
      a.count++;
      aircraft.set(registration, a);
    }
  };
  for (const r of llegadas.data ?? []) add(r.aerolinea, r.numero_vuelo, r.origen, 'DAV', r.matricula, r.avion);
  for (const r of salidas.data ?? []) add(r.aerolinea, r.numero_vuelo, 'DAV', r.destino, r.matricula, r.avion);
  // La flota registrada siempre aparece, aunque no haya volado este año
  for (const a of kb.aircraft) {
    if (!aircraft.has(a.registration)) aircraft.set(a.registration, { airline: a.airline, registration: a.registration, code: a.code, paxMax: capacityOf(a.code, kb) ?? 0, count: 0 });
  }

  return {
    kb,
    frequentFlights: [...flights.values()].filter(f => f.count >= 3).sort((a, b) => b.count - a.count),
    aircraft: [...aircraft.values()].sort((a, b) => b.count - a.count),
  };
}

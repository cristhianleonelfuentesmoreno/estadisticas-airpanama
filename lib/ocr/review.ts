// Revisión de vuelos del itinerario antes de importarlos. Funciones puras: al editar
// un vuelo se vuelven a calcular sus datos derivados y sus avisos con la base de
// conocimiento (flota, tripulación, rutas y vuelos regulares).
import { KNOWN_AIRPORTS } from "@/lib/airports";
import {
  classifyCrewLine, flightWarnings, normalizeRegistration, resolveAircraft, routeMinutes,
  type FleetKnowledge,
} from "@/lib/fleet/rules";

export type ReviewableFlight = {
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  aircraft: string;
  aircraftReg: string;
  pilot?: string;
  cabin_crew?: string;
  paxCount?: number | null;
  paxMax?: number | null;
};

const addMinutes = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const total = (h * 60 + m + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// Llegada estimada = salida + duración conocida de la ruta (60 min si no se conoce)
export function estimatedArrival(f: Pick<ReviewableFlight, 'airline' | 'origin' | 'destination' | 'departureTimeLocal'>, kb: FleetKnowledge) {
  if (!f.departureTimeLocal) return '';
  return addMinutes(f.departureTimeLocal, routeMinutes(f.airline, f.origin, f.destination, kb) ?? 60);
}

// Al cambiar la matrícula: si es de la flota, se completan modelo y capacidad
export function withAircraft<T extends ReviewableFlight>(f: T, kb: FleetKnowledge): T {
  const { registration, code, paxMax } = resolveAircraft({ aircraft: f.aircraft, aircraftReg: f.aircraftReg }, kb);
  return {
    ...f,
    aircraftReg: registration || f.aircraftReg,
    aircraft: code ?? f.aircraft,
    paxMax: paxMax ?? f.paxMax,
  };
}

// Avisos de un vuelo tal como está ahora (se recalculan en cada edición)
export function reviewWarnings(f: ReviewableFlight, kb: FleetKnowledge): string[] {
  const warnings: string[] = [];
  if (!f.departureTimeLocal) warnings.push('Hora no leída: complétala');
  if (!f.origin || !f.destination) warnings.push('Falta el origen o el destino');
  else if (f.origin === f.destination) warnings.push('El origen y el destino son iguales');
  for (const code of [f.origin, f.destination]) {
    if (code && !KNOWN_AIRPORTS.has(code)) warnings.push(`Aeropuerto desconocido: ${code}`);
  }

  // Tripulación: nombres que no están en la base (solo si la base de tripulantes está cargada)
  if (kb.crew.length > 0) {
    const unknown = [f.pilot, f.cabin_crew].flatMap(line => {
      const crew = line ? classifyCrewLine(line, kb) : { kind: 'vacio' as const };
      return crew.kind === 'vacio' ? [] : crew.unknown;
    });
    if (unknown.length > 0) warnings.push(`Tripulante no registrado: ${unknown.join(', ')}`);
  }

  const resolved = resolveAircraft({ aircraft: f.aircraft, aircraftReg: f.aircraftReg }, kb);
  warnings.push(...flightWarnings(
    { ...f, aircraftReg: f.aircraftReg ? normalizeRegistration(f.aircraftReg) : f.aircraftReg },
    kb,
    { paxMax: f.paxMax ?? resolved.paxMax, knownRegistration: resolved.knownRegistration },
  ));
  return warnings;
}

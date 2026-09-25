"use server";

import { requireApprovedUser } from "@/lib/auth";

import { readAirPanamaItinerary } from "@/lib/ocr/airpanamaItinerary";
import { copaMonthToFlights, readCopaMonthlyItinerary } from "@/lib/ocr/copaItinerary";
import { COPA_ROTATIONS, COPA_VERIFIED_MONTHS } from "@/lib/fleet/copaSchedule";
import { loadFleetKnowledge } from "@/lib/fleet/knowledge";

export interface ParsedFlight {
  flightNumber: string;
  origin: string;
  destination: string;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
  airline: string;
  flightDate?: string;
  aircraft?: string;
  aircraftReg?: string;
  paxCount?: number;
  pilot?: string;        // capitán / primer oficial
  cabin_crew?: string;   // tripulantes de cabina
  notes?: string;        // notas del itinerario (clientes de chárter, carga…)
  paxMax?: number;
  warnings?: string[];   // lo que no cuadra con la base de conocimiento, para revisar
}

// --------------------------------------------------------------------------
// PARSER DE AIR PANAMA (DIARIO) — ver lib/ocr/airpanamaItinerary.ts
// --------------------------------------------------------------------------
async function parseAirPanamaDaily(base64Data: string, targetDateStr: string): Promise<ParsedFlight[]> {
  const kb = await loadFleetKnowledge();
  const flights = await readAirPanamaItinerary(Buffer.from(base64Data, 'base64'), targetDateStr, kb);
  if (flights.length === 0) {
    throw new Error("El motor OCR local no pudo encontrar ningún vuelo en la imagen. La calidad puede ser muy baja.");
  }
  return flights;
}

// --------------------------------------------------------------------------
// PARSER DE COPA AIRLINES (MENSUAL) — ver lib/ocr/copaItinerary.ts
// El mes sale del título de la imagen, no de una fecha elegida por el usuario.
// --------------------------------------------------------------------------
async function parseCopaMonthly(base64Data: string): Promise<ParsedFlight[]> {
  const read = await readCopaMonthlyItinerary(Buffer.from(base64Data, 'base64'));
  let days = read.days;
  const warnings = [...read.warnings];
  if (!days) {
    // No se ubicó la tabla: si el mes ya está verificado en la base, se usa ese
    const verified = COPA_VERIFIED_MONTHS[read.yearMonth];
    if (!verified) {
      throw new Error(`No se pudo leer la tabla de días del itinerario de ${read.yearMonth}. Sube una captura recta y completa de la tabla.`);
    }
    days = Object.fromEntries(Object.entries(verified).map(([day, nums]) => [
      Number(day),
      nums.map(n => COPA_ROTATIONS.findIndex(r => r.departure.flightNumber === n)).filter(i => i >= 0),
    ]));
    warnings.push(`No se pudo leer la tabla de la imagen; se usó el itinerario verificado de ${read.yearMonth}.`);
  }
  const flights = copaMonthToFlights(read.yearMonth, days, read.rotations, warnings);
  if (flights.length === 0) throw new Error(`El itinerario de ${read.yearMonth} no tiene vuelos marcados.`);
  console.log(`Copa Airlines ${read.yearMonth}: ${flights.length} vuelos leídos de la imagen.`);
  return flights;
}

// --------------------------------------------------------------------------
// PUNTO DE ENTRADA PÚBLICO
// --------------------------------------------------------------------------
export async function parseItineraryImage(
  base64Image: string,
  targetDateStr: string,
  airline: string = 'airpanama'
): Promise<ParsedFlight[]> {
  await requireApprovedUser();
  if (typeof base64Image !== 'string' || base64Image.length > 15_000_000) {
    throw new Error('Imagen inválida o demasiado grande.');
  }
  try {
    const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    if (airline === 'copa') {
      console.log('OCR local — Copa Airlines mensual...');
      return await parseCopaMonthly(base64Data);
    }

    console.log('OCR local — Air Panama diario...');
    return await parseAirPanamaDaily(base64Data, targetDateStr);
  } catch (error) {
    console.error('Error en parseItineraryImage:', error);
    throw new Error((error as Error).message || 'Error al procesar la imagen con el motor OCR local.');
  }
}

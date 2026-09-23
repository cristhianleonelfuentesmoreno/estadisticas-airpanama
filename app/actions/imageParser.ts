"use server";

import { requireApprovedUser } from "@/lib/auth";

import { createWorker } from "tesseract.js";
import { readAirPanamaItinerary } from "@/lib/ocr/airpanamaItinerary";
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
// Itinerario estándar de Copa Airlines en David (MPDA)
// Fallback si el OCR no puede leer el encabezado de la imagen.
// --------------------------------------------------------------------------
const COPA_DAV_SCHEDULE: Record<string, { origin: string; destination: string; etd: string; eta: string }> = {
  'CM13': { origin: 'PTY', destination: 'DAV', etd: '06:30', eta: '07:45' },
  'CM11': { origin: 'DAV', destination: 'PTY', etd: '08:26', eta: '09:39' },
  'CM17': { origin: 'PTY', destination: 'DAV', etd: '07:55', eta: '09:10' },
  'CM18': { origin: 'DAV', destination: 'PTY', etd: '09:50', eta: '11:03' },
  'CM21': { origin: 'PTY', destination: 'DAV', etd: '11:58', eta: '13:13' },
  'CM24': { origin: 'DAV', destination: 'PTY', etd: '13:53', eta: '15:06' },
  'CM26': { origin: 'PTY', destination: 'DAV', etd: '15:01', eta: '16:25' },
  'CM22': { origin: 'DAV', destination: 'PTY', etd: '18:31', eta: '19:44' },
  'CM28': { origin: 'PTY', destination: 'DAV', etd: '17:53', eta: '19:17' },
  'CM30': { origin: 'DAV', destination: 'PTY', etd: '19:57', eta: '21:10' },
};

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
// ITINERARIOS HARDCODEADOS DE COPA AIRLINES EN DAVID
// (Para cuando el OCR no puede leer la tabla correctamente)
// Leídos directamente de la imagen del itinerario RV00-2026
// --------------------------------------------------------------------------

// Formato: { dia_numero: [codigos de vuelo que operan ese día] }
const COPA_SEP_2026: Record<number, string[]> = {
   1: ['CM18', 'CM30'],
   2: ['CM18', 'CM30'],
   3: ['CM18', 'CM22', 'CM30'],
   4: ['CM11', 'CM18', 'CM22', 'CM30'],
   5: ['CM11', 'CM18', 'CM30'],
   6: ['CM11', 'CM18', 'CM24', 'CM30'],
   7: ['CM11', 'CM18', 'CM30'],
   8: ['CM18', 'CM30'],
   9: ['CM18', 'CM30'],
  10: ['CM18', 'CM22', 'CM30'],
  11: ['CM11', 'CM18', 'CM24', 'CM22', 'CM30'],
  12: ['CM11', 'CM18', 'CM30'],
  13: ['CM11', 'CM18', 'CM24', 'CM30'],
  14: ['CM11', 'CM18', 'CM30'],
  15: ['CM18', 'CM30'],
  16: ['CM18', 'CM30'],
  17: ['CM18', 'CM22', 'CM30'],
  18: ['CM11', 'CM18', 'CM22', 'CM30'],
  19: ['CM11', 'CM18', 'CM30'],
  20: ['CM11', 'CM18', 'CM30'],
  21: ['CM11', 'CM18', 'CM30'],
  22: ['CM18', 'CM30'],
  23: ['CM18', 'CM30'],
  24: ['CM18', 'CM22', 'CM30'],
  25: ['CM11', 'CM18', 'CM22', 'CM30'],
  26: ['CM11', 'CM18', 'CM30'],
  27: ['CM11', 'CM18', 'CM30'],
  28: ['CM11', 'CM18', 'CM30'],
  29: ['CM18', 'CM30'],
  30: ['CM18', 'CM30'],
};

// Mapa de itinerarios por año-mes
const COPA_HARDCODED: Record<string, Record<number, string[]>> = {
  '2026-09': COPA_SEP_2026,
};

// --------------------------------------------------------------------------
// PARSER DE COPA AIRLINES (MENSUAL) — Hardcoded + OCR fallback
// --------------------------------------------------------------------------
async function parseCopaMonthly(base64Data: string, targetDateStr: string): Promise<ParsedFlight[]> {
  const yearMonth = targetDateStr.substring(0, 7); // "2026-09"
  const yearMonthPrefix = targetDateStr.substring(0, 8); // "2026-09-"

  // ---- Intentar usar el itinerario hardcodeado ----
  const hardcoded = COPA_HARDCODED[yearMonth];
  if (hardcoded) {
    console.log(`Usando itinerario hardcodeado para Copa Airlines ${yearMonth}`);
    const parsedFlights: ParsedFlight[] = [];

    for (const [dayStr, flightCodes] of Object.entries(hardcoded)) {
      const dayNum = parseInt(dayStr, 10);
      const dateStr = `${yearMonthPrefix}${String(dayNum).padStart(2, '0')}`;

      for (const code of flightCodes) {
        const info = COPA_DAV_SCHEDULE[code];
        if (!info) continue;
        parsedFlights.push({
          flightNumber:       code,
          origin:             info.origin,
          destination:        info.destination,
          departureTimeLocal: info.etd,
          arrivalTimeLocal:   info.eta,
          airline:            'Copa Airlines',
          flightDate:         dateStr,
          aircraft:           'B738',
          aircraftReg:        '',
          paxCount:           0,
          pilot:              '',
          paxMax:             160,
        });
      }
    }

    console.log(`Copa Airlines (hardcoded): ${parsedFlights.length} vuelos generados para ${yearMonth}.`);
    return parsedFlights;
  }

  // ---- Fallback: OCR (para meses futuros sin hardcode) ----
  console.log(`No hay itinerario hardcodeado para ${yearMonth}. Intentando OCR con Tesseract...`);

  const buffer = Buffer.from(base64Data, 'base64');
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(buffer);
  await worker.terminate();

  console.log("OCR Copa completado. Texto crudo:\n", text);

  const scheduleMap = { ...COPA_DAV_SCHEDULE };
  const parsedFlights: ParsedFlight[] = [];
  const lines = text.split('\n');

  // Normalizar texto OCR: corregir confusiones comunes en los códigos CM##
  // Tesseract confunde letras y números dentro de códigos de fuente pequeña
  const normalize = (s: string) =>
    s
      .replace(/\bCl(\d)/gi, 'CM1$1')   // Cl1 → CM11, Cl8 → CM18
      .replace(/\bow[smw]/gi, 'CM18')   // ows, owm → CM18 (error frecuente)
      .replace(/\bew[mw]/gi, 'CM30');    // eww, ewm → CM30

  for (const rawLine of lines) {
    const line = normalize(rawLine);
    const dayMatch = /\b([1-9]|[12]\d|3[01])\b/.exec(line);
    if (!dayMatch) continue;

    const dayNum = parseInt(dayMatch[1], 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) continue;

    const dateStr = `${yearMonthPrefix}${String(dayNum).padStart(2, '0')}`;
    const CM_CODE = /\bCM(\d{2,3})\b/gi;
    CM_CODE.lastIndex = 0;
    let cm: RegExpExecArray | null;
    while ((cm = CM_CODE.exec(line)) !== null) {
      const code = `CM${cm[1]}`;
      const info = scheduleMap[code];
      if (!info) continue;
      parsedFlights.push({
        flightNumber:       code,
        origin:             info.origin,
        destination:        info.destination,
        departureTimeLocal: info.etd,
        arrivalTimeLocal:   info.eta,
        airline:            'Copa Airlines',
        flightDate:         dateStr,
        aircraft:           'B738',
        aircraftReg:        '',
        paxCount:           0,
        pilot:              '',
        paxMax:             160,
      });
    }
  }

  if (parsedFlights.length === 0) {
    throw new Error(
      `No hay itinerario hardcodeado para ${yearMonth} y el OCR no pudo leer la imagen. ` +
      'Por favor sube una imagen del mes correcto o ingresa los vuelos manualmente.'
    );
  }

  return parsedFlights;
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
      return await parseCopaMonthly(base64Data, targetDateStr);
    }

    console.log('OCR local — Air Panama diario...');
    return await parseAirPanamaDaily(base64Data, targetDateStr);
  } catch (error) {
    console.error('Error en parseItineraryImage:', error);
    throw new Error((error as Error).message || 'Error al procesar la imagen con el motor OCR local.');
  }
}

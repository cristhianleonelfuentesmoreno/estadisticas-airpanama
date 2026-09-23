// Lectura del itinerario diario de Air Panama (imagen → vuelos).
// Sin "use server": son helpers del servidor, no endpoints públicos.
import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import type { ParsedFlight } from "@/app/actions/imageParser";

// --------------------------------------------------------------------------
// Flota Air Panama
// --------------------------------------------------------------------------
const AIRCRAFT_CAPACITY_MAP: Record<string, number> = {
  'DH8D': 78,   // igual que en Registro; el itinerario real trae vuelos con 76 pax
  'F-50': 50,
  'C-208': 12,
};

// Tiempos de ruta Air Panama en minutos
const ROUTE_TIMES_MAP: Record<string, number> = {
  'PAC-DAV': 55, 'DAV-PAC': 55,
  'PAC-BOC': 55, 'BOC-PAC': 55,
  'PAC-CHX': 60, 'CHX-PAC': 60,
  'BOC-DAV': 40, 'DAV-BOC': 40,
  'CHX-BOC': 30, 'BOC-CHX': 30,
};

// --------------------------------------------------------------------------
// Preprocesado para el OCR: ampliar, escala de grises y blanco/negro.
// Probado con el itinerario diario real: sin esto Tesseract junta filas y
// pierde vuelos; con esto lee las 12 filas completas.
// --------------------------------------------------------------------------
async function prepareForOcr(buffer: Buffer): Promise<Buffer> {
  try {
    const img = sharp(buffer);
    const { width = 0 } = await img.metadata();
    // 2x, sin pasar de 3200 px (más grande solo es más lento)
    const target = Math.min(Math.max(width * 2, 1600), 3200);
    return await img
      .resize({ width: target })
      .grayscale()
      .normalize()
      .threshold(170)
      .png()
      .toBuffer();
  } catch (err) {
    console.error("No se pudo preprocesar la imagen, se usa la original:", err);
    return buffer;
  }
}

// Confusiones típicas del OCR en los modelos de avión y las rutas
function normalizeOcrText(text: string): string {
  return text
    .replace(/\bD[HN][B8S]D\b/g, 'DH8D')         // DHBD, DHSD, DN8D → DH8D
    .replace(/\bFK?-?5[O0]\b/g, 'F-50')           // F50, F-5O, FK50 → F-50
    .replace(/\bC-?2[O0]8\b/g, 'C-208')           // C208, C-2O8 → C-208
    .replace(/\bHP\s*-?\s*(\d{3,4})\b/g, 'HP-$1') // HP 1997 → HP-1997
    .replace(/\b([A-Z0]{3})\s*-\s*([A-Z0]{3})\b/g, (_, a: string, b: string) =>
      `${a.replace(/0/g, 'O')}-${b.replace(/0/g, 'O')}`);
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// --------------------------------------------------------------------------
// PARSER DE AIR PANAMA (DIARIO) — OCR local con Tesseract
// --------------------------------------------------------------------------
const AIRCRAFT_RE = /\b(DH8D|F-50|C-208)\b/g;
const REG_RE = /\b(HP-\d{3,4})\b/g;
// Hora opcional: si el OCR no la lee, el vuelo igual se detecta y se completa a mano
const FLIGHT_RE = /(?:\b(\d{1,2}:\d{2})\s+)?\b(\d{3,4})\s+([A-Z]{3})-([A-Z]{3})\b/g;

type Token =
  | { kind: 'aircraft'; at: number; value: string }
  | { kind: 'reg'; at: number; value: string }
  | { kind: 'flight'; at: number; end: number; time: string; num: string; ori: string; des: string };

// Imagen → vuelos: preprocesa, pasa el OCR y lee el texto
export async function readAirPanamaItinerary(image: Buffer, targetDateStr: string): Promise<ParsedFlight[]> {
  console.log("Iniciando Tesseract OCR para Air Panama diario...");
  const prepared = await prepareForOcr(image);
  const worker = await createWorker('eng');
  // Bloque único: la tabla se lee fila por fila en vez de por columnas sueltas
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
  const { data: { text } } = await worker.recognize(prepared);
  await worker.terminate();

  console.log("OCR completado. Texto crudo:\n", text);
  return parseAirPanamaText(text, targetDateStr);
}

// Texto del OCR → vuelos (función pura, se puede probar sin imagen)
export function parseAirPanamaText(text: string, targetDateStr: string): ParsedFlight[] {
  // Cada avión abre un bloque; su matrícula aparece en la fila de abajo pero vale para todo el bloque
  type Block = { aircraft: string; reg: string; flights: ParsedFlight[] };
  const blocks: Block[] = [];
  const current = () => {
    if (blocks.length === 0) blocks.push({ aircraft: '', reg: '', flights: [] });
    return blocks[blocks.length - 1];
  };
  const seen = new Set<string>();

  for (const rawLine of normalizeOcrText(text).split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ');
    const tokens: Token[] = [
      ...[...line.matchAll(AIRCRAFT_RE)].map(m => ({ kind: 'aircraft' as const, at: m.index!, value: m[1] })),
      ...[...line.matchAll(REG_RE)].map(m => ({ kind: 'reg' as const, at: m.index!, value: m[1] })),
      ...[...line.matchAll(FLIGHT_RE)].map(m => ({
        kind: 'flight' as const, at: m.index!, end: m.index! + m[0].length,
        time: m[1] ? m[1].padStart(5, '0') : '', num: m[2], ori: m[3], des: m[4],
      })),
    ].sort((a, b) => a.at - b.at);

    tokens.forEach((tok, i) => {
      if (tok.kind === 'aircraft') {
        blocks.push({ aircraft: tok.value, reg: '', flights: [] });
        return;
      }
      if (tok.kind === 'reg') {
        current().reg = tok.value;
        return;
      }
      if (seen.has(tok.num)) return;
      seen.add(tok.num);

      // Lo que sigue al vuelo (hasta el próximo vuelo de la línea): tripulación y pasajeros
      const next = tokens.slice(i + 1).find(t => t.kind === 'flight');
      const rest = line.slice(tok.end, next ? next.at : undefined);
      const paxMatch = rest.match(/\b(\d{1,3})\b(?!.*\b\d{1,3}\b)/);
      const paxCount = paxMatch ? parseInt(paxMatch[1], 10) : undefined;
      const pilot = (paxMatch ? rest.slice(0, paxMatch.index) : rest)
        .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ/\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      current().flights.push({
        flightNumber:       tok.num,
        origin:             tok.ori,
        destination:        tok.des,
        departureTimeLocal: tok.time,
        arrivalTimeLocal:   tok.time ? addMinutes(tok.time, ROUTE_TIMES_MAP[`${tok.ori}-${tok.des}`] || 60) : '',
        airline:            "Air Panama",
        flightDate:         targetDateStr,
        paxCount,
        pilot:              pilot.length > 2 ? pilot : undefined,
      });
    });
  }

  return blocks.flatMap(b => b.flights.map(f => ({
    ...f,
    aircraft:    b.aircraft,
    aircraftReg: b.reg,
    paxMax:      AIRCRAFT_CAPACITY_MAP[b.aircraft] || undefined,
  })));
}


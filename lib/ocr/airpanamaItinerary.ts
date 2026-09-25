// Lectura del itinerario diario de Air Panama (imagen → vuelos).
// Sin "use server": son helpers del servidor, no endpoints públicos.
import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import type { ParsedFlight } from "@/app/actions/imageParser";
import {
  EMPTY_KNOWLEDGE, classifyCrewLine, flightWarnings, legKey, resolveAircraft, routeMinutes,
  type CrewLine, type FleetKnowledge,
} from "@/lib/fleet/rules";

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
    .replace(/\bD[S5]H\b/g, 'DH8D')               // DSH (así escriben el Dash 8 del HP-1997) → DH8D
    .replace(/\bFK?-?[5S][O0]\b/gi, 'F-50')        // F50, F-5O, FK50, FKs0 → F-50
    .replace(/\bC-?2[O0]8\b/g, 'C-208')           // C208, C-2O8 → C-208
    .replace(/\bHP\s*-?\s*(\d{3,4})\b/gi, 'HP-$1') // HP 1997, Hp1997 → HP-1997
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
export async function readAirPanamaItinerary(image: Buffer, targetDateStr: string, kb: FleetKnowledge = EMPTY_KNOWLEDGE): Promise<ParsedFlight[]> {
  console.log("Iniciando Tesseract OCR para Air Panama diario...");
  const prepared = await prepareForOcr(image);
  const worker = await createWorker('eng');
  // Bloque único: la tabla se lee fila por fila en vez de por columnas sueltas
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' });
  const { data: { text } } = await worker.recognize(prepared);
  await worker.terminate();

  console.log("OCR completado. Texto crudo:\n", text);
  return parseAirPanamaText(text, targetDateStr, kb);
}

type Row = { flight: ParsedFlight; crew: CrewLine };
type Rotation = { pilots: string; cabin: string; notes: string[] };

// Texto del OCR → vuelos (función pura, se puede probar sin imagen).
// Estructura del itinerario: cada avión es un bloque; dentro, cada ida y vuelta es una
// ROTACIÓN cuya 1ª línea de TRIPULACION son los pilotos (capitán / primer oficial) y la
// 2ª los tripulantes de cabina. Ambos vuelan los dos tramos. La C-208 no lleva cabina.
export function parseAirPanamaText(text: string, targetDateStr: string, kb: FleetKnowledge = EMPTY_KNOWLEDGE): ParsedFlight[] {
  // La matrícula aparece en la fila de abajo del modelo pero vale para todo el bloque
  type Block = { aircraft: string; reg: string; rows: Row[] };
  const blocks: Block[] = [];
  const current = () => {
    if (blocks.length === 0) blocks.push({ aircraft: '', reg: '', rows: [] });
    return blocks[blocks.length - 1];
  };
  // Número + ruta: el 693 hace CHX-BOC y luego BOC-DAV, son dos vuelos distintos
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
        blocks.push({ aircraft: tok.value, reg: '', rows: [] });
        return;
      }
      if (tok.kind === 'reg') {
        // Una segunda matrícula es otro avión aunque su modelo no se haya leído
        // (si no, sus vuelos se quedarían con la matrícula del bloque anterior)
        if (current().reg && current().reg !== tok.value) blocks.push({ aircraft: '', reg: tok.value, rows: [] });
        else current().reg = tok.value;
        return;
      }
      const key = legKey({ flightNumber: tok.num, origin: tok.ori, destination: tok.des });
      if (seen.has(key)) return;
      seen.add(key);

      // Lo que sigue al vuelo (hasta el próximo vuelo de la línea): tripulación y pasajeros
      const next = tokens.slice(i + 1).find(t => t.kind === 'flight');
      const rest = line.slice(tok.end, next ? next.at : undefined);
      const paxMatch = rest.match(/\b(\d{1,3})\b(?!.*\b\d{1,3}\b)/);
      const crewText = (paxMatch ? rest.slice(0, paxMatch.index) : rest)
        .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ/!|.\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      current().rows.push({
        crew: classifyCrewLine(crewText, kb),
        flight: {
          flightNumber:       tok.num,
          origin:             tok.ori,
          destination:        tok.des,
          departureTimeLocal: tok.time,
          arrivalTimeLocal:   '',
          airline:            "Air Panama",
          flightDate:         targetDateStr,
          paxCount:           paxMatch ? parseInt(paxMatch[1], 10) : undefined,
        },
      });
    });
  }

  return blocks.flatMap(block => {
    const { registration, code, paxMax, knownRegistration } = resolveAircraft({ aircraft: block.aircraft, aircraftReg: block.reg }, kb);
    let rotation: Rotation = { pilots: '', cabin: '', notes: [] };

    return block.rows.map(({ flight, crew }) => {
      const warnings: string[] = [];
      if (crew.kind !== 'vacio') {
        if (crew.unknown.length > 0) warnings.push(`Tripulante no registrado: ${crew.unknown.join(', ')}`);
        // Nombres conocidos deciden el rol; si no, se usa la posición (1ª línea pilotos, 2ª cabina)
        const isPilots = crew.kind === 'pilotos' || (crew.kind === 'desconocido' && !rotation.pilots) ||
          (crew.kind === 'desconocido' && !!rotation.cabin);
        if (isPilots) {
          rotation = { pilots: crew.text, cabin: '', notes: [] };
        } else {
          rotation.cabin = crew.text;
        }
        if (crew.notes) rotation.notes.push(crew.notes);
      }

      const time = flight.departureTimeLocal;
      if (!time) warnings.push('Hora no leída: complétala');
      const minutes = routeMinutes('Air Panama', flight.origin, flight.destination, kb) ?? 60;
      const result: ParsedFlight = {
        ...flight,
        arrivalTimeLocal: time ? addMinutes(time, minutes) : '',
        aircraft:         code ?? block.aircraft,
        aircraftReg:      registration,
        paxMax:           paxMax ?? undefined,
      };
      warnings.push(...flightWarnings(result, kb, { paxMax, knownRegistration }));
      // La rotación se comparte por referencia: la cabina (2ª línea) también aplica al vuelo de ida
      return { result, rotation, warnings };
    }).map(({ result, rotation: r, warnings }) => ({
      ...result,
      pilot:      r.pilots || undefined,
      cabin_crew: r.cabin || undefined,
      notes:      r.notes.join(' · ') || undefined,
      warnings:   warnings.length ? warnings : undefined,
    }));
  });
}

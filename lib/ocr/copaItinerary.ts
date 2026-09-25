// Lectura del itinerario mensual de Copa Airlines en DAV (imagen → vuelos del mes).
// Sin "use server": son helpers del servidor, no endpoints públicos.
//
// El OCR de toda la hoja no sirve para la cuadrícula (sale ilegible), así que se lee por partes:
//  1. Se ubican las líneas de la tabla: las filas de los días son la serie más larga de
//     filas del mismo alto; las rotaciones son las 5 columnas anchas.
//  2. Cada celda se clasifica por el ancho de la tinta: "X" es angosta y un código (CM18)
//     es ancho. Probado con SEPTIEMBRE-RV00-2026: X ≈ 6 px, código ≈ 30 px en filas de 20 px.
//  3. El OCR solo lee textos cortos y limpios: el título (mes y año) y el encabezado de
//     cada rotación (números y horas), que se validan contra la base de conocimiento.
import { createWorker, PSM, type Worker } from "tesseract.js";
import sharp from "sharp";
import type { ParsedFlight } from "@/app/actions/imageParser";
import { COPA_AIRCRAFT, COPA_ROTATIONS, rotationByNumber, type CopaLeg, type CopaRotation } from "@/lib/fleet/copaSchedule";

const MONTHS: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8,
  SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

// Tramo leído, con lo que no cuadró con la base de conocimiento
export type ReadLeg = CopaLeg & { warnings: string[] };
export type ReadRotation = { arrival: ReadLeg; departure: ReadLeg };

export type CopaMonthRead = {
  yearMonth: string;                     // "2026-09"
  days: Record<number, number[]> | null; // día → índices de las rotaciones que operan; null si no se pudo leer la tabla
  rotations: ReadRotation[];
  warnings: string[];                    // avisos de todo el mes (año asumido, días faltantes…)
};

type Gray = { data: Buffer; width: number; height: number };

// Agrupa posiciones contiguas (una línea de 2 px es una sola línea)
function groupLines(positions: number[]): number[] {
  const lines: number[] = [];
  let start = -1, prev = -1;
  for (const p of positions) {
    if (start >= 0 && p - prev <= 2) { prev = p; continue; }
    if (start >= 0) lines.push((start + prev) / 2);
    start = prev = p;
  }
  if (start >= 0) lines.push((start + prev) / 2);
  return lines;
}

// Serie más larga de líneas con separación parecida: las filas de los días
function longestRegularRun(lines: number[]): { from: number; to: number } | null {
  let best: { from: number; to: number } | null = null;
  for (let i = 0; i < lines.length - 1; i++) {
    const gap = lines[i + 1] - lines[i];
    if (gap < 10) continue;
    let j = i + 1;
    while (j < lines.length - 1 && Math.abs(lines[j + 1] - lines[j] - gap) <= Math.max(2, gap * 0.15)) j++;
    if (!best || j - i > best.to - best.from) best = { from: i, to: j };
  }
  return best;
}

type Grid = { rowLines: number[]; headerLines: number[]; columns: [number, number][] };

// Un pixel de línea es un trazo delgado: más oscuro que lo que tiene a `d` px a ambos lados.
// Así las celdas con relleno de color no cuentan como líneas, y las líneas grises que
// quedan al achicar o comprimir la imagen (WhatsApp) sí.
function findGrid({ data, width, height }: Gray): Grid | null {
  const d = Math.max(3, Math.round(width / 400));
  const px = (x: number, y: number) => data[y * width + x];
  const hLine = (x: number, y: number) => y >= d && y < height - d && px(x, y) < 170 && px(x, y - d) - px(x, y) > 25 && px(x, y + d) - px(x, y) > 25;
  const vLine = (x: number, y: number) => x >= d && x < width - d && px(x, y) < 170 && px(x - d, y) - px(x, y) > 25 && px(x + d, y) - px(x, y) > 25;

  const rowPixels: number[] = [];
  for (let y = 0; y < height; y++) {
    let n = 0;
    for (let x = 0; x < width; x++) if (hLine(x, y)) n++;
    if (n > width * 0.4) rowPixels.push(y);
  }
  const hLines = groupLines(rowPixels);
  const run = longestRegularRun(hLines);
  if (!run || run.to - run.from < 28) return null; // un mes tiene al menos 28 días
  const rowLines = hLines.slice(run.from, run.to + 1);
  const headerLines = hLines.slice(Math.max(0, run.from - 2), run.from + 1);

  const top = Math.ceil(rowLines[0]) + 1, bottom = Math.floor(rowLines[rowLines.length - 1]) - 1;
  const colPixels: number[] = [];
  for (let x = 0; x < width; x++) {
    let n = 0;
    for (let y = top; y < bottom; y++) if (vLine(x, y)) n++;
    if (n > (bottom - top) * 0.7) colPixels.push(x);
  }
  const vLines = groupLines(colPixels);
  const bands: [number, number][] = [];
  for (let i = 0; i < vLines.length - 1; i++) bands.push([Math.ceil(vLines[i]) + 1, Math.floor(vLines[i + 1]) - 1]);
  const widest = Math.max(0, ...bands.map(([a, b]) => b - a));
  // Las rotaciones son las columnas anchas; fecha, día y total son angostas
  const columns = bands.filter(([a, b]) => b - a > widest * 0.6);
  return columns.length ? { rowLines, headerLines, columns } : null;
}

// ¿La celda trae un código (tinta ancha) o una X / nada?
function cellOperates({ data, width }: Gray, [x0, x1]: [number, number], y0: number, y1: number): boolean {
  const m = Math.max(2, Math.round((y1 - y0) * 0.15)); // sin tocar las líneas de la celda
  let min = Infinity, max = -1;
  for (let y = Math.ceil(y0) + m; y < Math.floor(y1) - m; y++)
    for (let x = x0 + m; x < x1 - m; x++)
      if (data[y * width + x] < 140) { min = Math.min(min, x); max = Math.max(max, x); }
  return max >= 0 && max - min + 1 > (y1 - y0) * 0.8;
}

async function ocrLine(worker: Worker, image: Buffer, left: number, top: number, w: number, h: number): Promise<string> {
  const scale = Math.max(2, Math.round(60 / Math.max(h, 1)));
  const crop = await sharp(image)
    .extract({ left, top, width: w, height: h })
    .resize({ width: w * scale })
    .greyscale().normalise().threshold(150).png().toBuffer();
  const { data } = await worker.recognize(crop);
  return data.text.trim();
}

const to24h = (h: string, m: string, ampm: string) => {
  let hours = Number(h) % 12;
  if (/P/i.test(ampm)) hours += 12;
  return `${String(hours).padStart(2, '0')}:${m}`;
};

// "CM13 | PTY/DAV | 06:30AM | 07:45AM" (con errores típicos del OCR: cM18, 11:584M, pavl)
export function parseHeaderLeg(text: string): Partial<CopaLeg> {
  const leg: Partial<CopaLeg> = {};
  const code = /C\s*[MN]\s*-?\s*0*(\d{2,4})/i.exec(text);
  if (code) leg.flightNumber = String(Number(code[1]));
  const route = /\b([A-Z]{3})\s*[/|]\s*([A-Z]{3})\b/.exec(text.toUpperCase());
  // Todo tramo de este itinerario toca DAV; si no, el OCR leyó mal la ruta
  if (route && (route[1] === 'DAV') !== (route[2] === 'DAV')) { leg.origin = route[1]; leg.destination = route[2]; }
  const times = [...text.matchAll(/(\d{1,2})\s*[:.]\s*(\d{2})\s*([AP4])\s*M/gi)].map(t => to24h(t[1], t[2], t[3]));
  if (times.length >= 2) { leg.etd = times[0]; leg.eta = times[1]; }
  return leg;
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
// PTY–DAV dura ~1 h 15; fuera de este rango el OCR leyó mal alguna hora
const plausibleDuration = (etd: string, eta: string) => {
  const mins = (minutes(eta) - minutes(etd) + 1440) % 1440;
  return mins >= 40 && mins <= 150;
};

// Lo leído del encabezado, completado y validado con la base de conocimiento.
// `known` es el tramo de la base para esta rotación (por número leído o por posición).
function resolveLeg(read: Partial<CopaLeg>, known: CopaLeg | undefined): ReadLeg | null {
  const warnings: string[] = [];
  let flightNumber = read.flightNumber ?? known?.flightNumber;
  if (!flightNumber) return null;
  if (!read.flightNumber) warnings.push(`No se leyó el número en el encabezado; se asumió CM${flightNumber} por la base de conocimiento.`);

  // Un número que en la base es de otra rotación suele ser un error del OCR (26 → 28)
  if (known && flightNumber !== known.flightNumber && rotationByNumber(flightNumber)) {
    warnings.push(`El encabezado parece decir CM${flightNumber}, que es de otra rotación; se usó CM${known.flightNumber}.`);
    flightNumber = known.flightNumber;
    read = { ...read, etd: undefined, eta: undefined };
  }
  const base = known?.flightNumber === flightNumber ? known : undefined;
  if (!base) warnings.push(`CM${flightNumber} no está en la base de conocimiento de Copa: revisa ruta y horas.`);

  let { etd, eta } = read;
  if (etd && eta && !plausibleDuration(etd, eta)) {
    if (base) warnings.push(`Hora ilegible en la imagen (${etd}–${eta}); se usó la de la base.`);
    etd = eta = undefined;
  }
  const leg: ReadLeg = {
    warnings,
    flightNumber,
    origin: read.origin ?? base?.origin ?? '',
    destination: read.destination ?? base?.destination ?? '',
    etd: etd ?? base?.etd ?? '',
    eta: eta ?? base?.eta ?? '',
  };
  if (base && (leg.etd !== base.etd || leg.eta !== base.eta)) {
    warnings.push(`La imagen dice ${leg.etd}–${leg.eta} y la base tiene ${base.etd}–${base.eta}: se usó la imagen.`);
  }
  if (!leg.origin || !leg.destination || !leg.etd || !leg.eta) return null;
  return leg;
}

export function parseTitle(text: string): { year: number | null; month: number | null } {
  const up = text.toUpperCase();
  const name = Object.keys(MONTHS).find(m => up.includes(m));
  const after = name ? up.slice(up.indexOf(name)) : up;
  const year = /20\d{2}/.exec(after) ?? /20\d{2}/.exec(up);
  return { month: name ? MONTHS[name] : null, year: year ? Number(year[0]) : null };
}

export async function readCopaMonthlyItinerary(image: Buffer): Promise<CopaMonthRead> {
  const warnings: string[] = [];
  const { data, info } = await sharp(image).greyscale().raw().toBuffer({ resolveWithObject: true });
  const gray: Gray = { data, width: info.width, height: info.height };
  const grid = findGrid(gray);

  const worker = await createWorker('eng');
  try {
    // Título: todo lo que está arriba del encabezado de la tabla (o el 15 % superior)
    const titleBottom = Math.max(20, Math.round(grid ? grid.headerLines[0] : info.height * 0.15));
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const titleText = await ocrLine(worker, image, 0, 0, info.width, Math.min(titleBottom, info.height));
    console.log("OCR Copa, título:", titleText);
    const { year, month } = parseTitle(titleText);
    if (!month) throw new Error('No se pudo leer el mes en el título del itinerario (p. ej. "ITINERARIO DE VUELOS CM SEPTIEMBRE-RV00-2026"). Sube una imagen más nítida.');
    const panamaYear = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }).slice(0, 4));
    if (!year) warnings.push(`No se leyó el año en el título; se asumió ${panamaYear}.`);
    const yearMonth = `${year ?? panamaYear}-${String(month).padStart(2, '0')}`;

    if (!grid) return { yearMonth, days: null, rotations: COPA_ROTATIONS.map(withoutWarnings), warnings };

    // Encabezado: fila de llegada (PTY→DAV) y fila de regreso (DAV→PTY) de cada rotación
    const rotations: ReadRotation[] = [];
    const [hTop, hMid, hBottom] = grid.headerLines;
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    for (const [i, [x0, x1]] of grid.columns.entries()) {
      const byPosition = grid.columns.length === COPA_ROTATIONS.length ? COPA_ROTATIONS[i] : undefined;
      let arrivalRead: Partial<CopaLeg> = {}, departureRead: Partial<CopaLeg> = {};
      if (hBottom !== undefined) {
        const top = Math.ceil(hTop) + 1, mid = Math.round(hMid), bottom = Math.floor(hBottom) - 1;
        arrivalRead = parseHeaderLeg(await ocrLine(worker, image, x0, top, x1 - x0, mid - top));
        departureRead = parseHeaderLeg(await ocrLine(worker, image, x0, mid + 1, x1 - x0, bottom - mid));
      }
      // El número de regreso es el que aparece en las celdas: manda para ubicar la rotación
      const known = rotationByNumber(departureRead.flightNumber ?? '') ?? byPosition ?? rotationByNumber(arrivalRead.flightNumber ?? '');
      const arrival = resolveLeg(arrivalRead, known?.arrival);
      const departure = resolveLeg(departureRead, known?.departure);
      if (!arrival || !departure) throw new Error(`No se pudo leer el encabezado de la rotación ${i + 1} (número de vuelo y horas).`);
      rotations.push({ arrival, departure });
    }

    const days: Record<number, number[]> = {};
    for (let r = 0; r < grid.rowLines.length - 1; r++) {
      days[r + 1] = grid.columns.flatMap((col, i) => (cellOperates(gray, col, grid.rowLines[r], grid.rowLines[r + 1]) ? [i] : []));
    }
    return { yearMonth, days, rotations, warnings };
  } finally {
    await worker.terminate();
  }
}

// Mes leído → vuelos: cada rotación que opera un día son dos vuelos (llegada y regreso)
export const withoutWarnings = (r: CopaRotation): ReadRotation => ({
  arrival: { ...r.arrival, warnings: [] },
  departure: { ...r.departure, warnings: [] },
});

export function copaMonthToFlights(yearMonth: string, days: Record<number, number[]>, rotations: ReadRotation[], monthWarnings: string[] = []): ParsedFlight[] {
  const warnings = [...monthWarnings];
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = Object.keys(days).length;
  if (rows > daysInMonth) throw new Error(`La tabla tiene ${rows} días pero ${yearMonth} tiene ${daysInMonth}. Revisa que el mes del título sea el correcto.`);
  if (rows < daysInMonth) warnings.push(`La tabla trae ${rows} de los ${daysInMonth} días del mes.`);

  const flights: ParsedFlight[] = [];
  for (const [day, operating] of Object.entries(days)) {
    const flightDate = `${yearMonth}-${String(day).padStart(2, '0')}`;
    for (const i of operating) {
      for (const { warnings: legWarnings, ...leg } of [rotations[i].arrival, rotations[i].departure]) {
        const all = [...warnings, ...legWarnings];
        flights.push({
          flightNumber: leg.flightNumber,
          origin: leg.origin,
          destination: leg.destination,
          departureTimeLocal: leg.etd,
          arrivalTimeLocal: leg.eta,
          airline: 'Copa Airlines',
          flightDate,
          aircraft: COPA_AIRCRAFT,
          aircraftReg: '',
          paxCount: 0,
          ...(all.length ? { warnings: all } : {}),
        });
      }
    }
  }
  return flights;
}

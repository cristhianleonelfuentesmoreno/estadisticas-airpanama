// Lectura del "registro mensual" del aeropuerto (Excel con una pestaña por mes).
// Funciones puras: reciben las filas crudas de cada pestaña y la base de conocimiento
// de flota ya cargada, así se pueden probar sin navegador ni base de datos.
//
// Reglas acordadas:
//  - Solo vuelos de Air Panama y Copa Airlines.
//  - Solo se usa la FECHA de "Runway Time". Las horas (Runway y Actual) no se guardan
//    porque no son confiables. La hora solo sirve para corregir la fecha en las pestañas
//    que vienen en UTC (julio en adelante): se restan 5 h antes de tomar el día.
//  - Nombres corregidos contra la base (matrícula, modelo, formato del número de vuelo).
//  - Lo dudoso no se corrige solo: se marca con un aviso para revisarlo en la vista previa.

import { normalizeRegistration, resolveAircraft, type FleetKnowledge } from "@/lib/fleet/rules";

export type Cell = string | number | boolean | null | undefined;
export type SheetInput = { name: string; rows: Cell[][] };

export type ImportRow = {
  id: string;                  // "<pestaña>#<fila>", único dentro del archivo
  sheet: string;
  excelRow: number;            // número de fila tal como se ve en Excel
  tipo: "llegada" | "salida";
  fecha: string;               // YYYY-MM-DD
  aerolinea: "Air Panama" | "Copa Airlines";
  numero_vuelo: string;        // 7P-970, 7P-971-A, CM-13
  ruta: string;                // origen si es llegada, destino si es salida
  matricula: string | null;    // HP-1997
  avion: string | null;        // DH8D, F-50, B738
  pasajeros: number;
  capacidad: number;
  handler: string | null;
  stand: string | null;
  servicio: string | null;
  notas: string | null;
  mtow_kg: number | null;
  warnings: string[];
  duplicadoDe: string | null;  // fila que se conserva en su lugar (esta se omite)
  incluir: boolean;            // el usuario puede excluir una fila a mano
};

// Se guarda solo lo incluido y que no sea duplicado
export const willSave = (r: ImportRow) => r.incluir && !r.duplicadoDe;

export type ImportResult = {
  rows: ImportRow[];
  sheets: { name: string; rows: number; utc: boolean }[];
  fixes: Record<string, number>; // corrección aplicada → veces
};

// Aeropuertos con los que operan ambas aerolíneas desde David (los más usados primero).
// Sin nombre = código visto en los registros cuyo nombre no está confirmado.
export const AIRPORTS: { code: string; name?: string }[] = [
  { code: "PAC", name: "Albrook, Panamá" },
  { code: "PTY", name: "Tocumen, Panamá" },
  { code: "BOC", name: "Bocas del Toro" },
  { code: "CHX", name: "Changuinola" },
  { code: "CTD", name: "Chitré" },
  { code: "SJO", name: "San José, Costa Rica" },
  { code: "PUE", name: "Puerto Obaldía" },
  { code: "PYC", name: "Playón Chico" },
  { code: "OGM", name: "Ogobsucum" },
  { code: "LCL" },
  { code: "SIC" },
  { code: "MAN" },
];
const KNOWN_AIRPORTS = new Set(AIRPORTS.map(a => a.code));
const PANAMA_OFFSET_DAYS = 5 / 24;

const norm = (v: Cell) =>
  String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\.$/, "");

const text = (v: Cell): string | null => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

// Número serial de Excel (días desde 1899-12-30) → "YYYY-MM-DD"
export function serialToDate(serial: number): string {
  const days = Math.floor(serial + 1e-6); // los .999 de Excel no deben cambiar el día
  return new Date(Date.UTC(1899, 11, 30) + days * 86400000).toISOString().slice(0, 10);
}

// Detecta la fila de encabezados y la posición de cada columna por su nombre
function findColumns(rows: Cell[][]) {
  for (let i = 0; i < Math.min(40, rows.length); i++) {
    const h = (rows[i] ?? []).map(norm);
    if (!h.includes("leg") || !h.includes("airline")) continue;
    const at = (...names: string[]) => h.findIndex(x => names.includes(x));
    return {
      headerRow: i,
      leg: at("leg"), airline: at("airline"), flight: at("flight"), od: at("o/d"),
      reg: at("reg"), ac: at("ac"), runway: at("runway time"),
      actual: h.findIndex(x => x.startsWith("actual time")),
      stand: at("stand"), service: at("service"), pax: at("pax"),
      handler: at("handler"), notes: at("notes"), mtow: at("mtow"),
    };
  }
  return null;
}

// "CM 013" → CM-13 · "7P 971 A" → 7P-971-A · "7P970" → 7P-970
function normalizeFlight(raw: Cell, aerolinea: ImportRow["aerolinea"]): string {
  const parts = String(raw ?? "").toUpperCase().trim().replace(/^(7P|CMP?)(?=\d)/, "$1 ").split(/\s+/).filter(Boolean);
  if (parts[0] === "7P" || parts[0] === "CM" || parts[0] === "CMP") parts.shift();
  const [num = "", ...suffix] = parts;
  const prefix = aerolinea === "Air Panama" ? "7P" : "CM";
  const cleanNum = /^\d+$/.test(num) ? String(Number(num)) : num;
  return [prefix, cleanNum, ...suffix].join("-");
}

export function parseRegistroMensual(sheets: SheetInput[], kb: FleetKnowledge): ImportResult {
  const rows: ImportRow[] = [];
  const sheetInfo: ImportResult["sheets"] = [];
  const fixes: Record<string, number> = {};
  const fix = (label: string) => { fixes[label] = (fixes[label] ?? 0) + 1; };

  // Ruta habitual de los vuelos regulares (para pestañas sin columna O/D)
  const scheduledRoute = (flightBase: string, tipo: ImportRow["tipo"]) => {
    const s = kb.scheduled.find(f => f.airline === "Air Panama" && f.flightNumber === flightBase &&
      (tipo === "llegada" ? f.destination === "DAV" : f.origin === "DAV"));
    return s ? (tipo === "llegada" ? s.origin : s.destination) : "";
  };

  for (const sheet of sheets) {
    const col = findColumns(sheet.rows);
    if (!col || col.runway < 0) continue;
    const body = sheet.rows.slice(col.headerRow + 1);

    // ¿La pestaña viene en UTC? En hora local "Actual" va ~5 h después de "Runway";
    // en las pestañas UTC ambas coinciden.
    const diffs = body
      .map(r => (typeof r[col.runway] === "number" && typeof r[col.actual] === "number"
        ? Math.round(((r[col.actual] as number) - (r[col.runway] as number)) * 24) : null))
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b);
    const utc = diffs.length > 0 && Math.abs(diffs[diffs.length >> 1]) < 2.5;
    const toLocal = (serial: number) => (utc ? serial - PANAMA_OFFSET_DAYS : serial);

    let count = 0;
    body.forEach((r, i) => {
      const airlineRaw = norm(r[col.airline]).replace(/\s+/g, "");
      const aerolinea = airlineRaw === "airpanama" ? "Air Panama" : airlineRaw.startsWith("copa") ? "Copa Airlines" : null;
      if (!aerolinea) return;
      const leg = norm(r[col.leg]);
      const tipo = leg.startsWith("arr") ? "llegada" : leg.startsWith("dep") ? "salida" : null;
      if (!tipo) return;

      const excelRow = col.headerRow + i + 2;
      const warnings: string[] = [];
      const runway = r[col.runway];
      if (typeof runway !== "number") return; // sin fecha no hay vuelo
      const fecha = serialToDate(toLocal(runway));
      if (utc && serialToDate(runway) !== fecha) fix("Fecha corregida de UTC a hora de Panamá");

      const actual = r[col.actual];
      if (typeof actual === "number") {
        const fechaReal = serialToDate(actual - PANAMA_OFFSET_DAYS); // "Actual" siempre viene en UTC
        const gap = Math.abs(Date.parse(fechaReal) - Date.parse(fecha)) / 86400000;
        if (gap > 1) warnings.push(`La fecha de pista (${fecha}) no coincide con la fecha real (${fechaReal})`);
      }

      const numero_vuelo = normalizeFlight(r[col.flight], aerolinea);
      const flightBase = numero_vuelo.split("-")[1] ?? "";
      if (aerolinea === "Copa Airlines" && /^6\d{3}$/.test(flightBase))
        warnings.push(`Número de vuelo Copa inusual (${String(r[col.flight]).trim()}); ¿será CM-${Number(flightBase.slice(1))}?`);

      let ruta = col.od >= 0 ? String(r[col.od] ?? "").trim().toUpperCase() : "";
      if (aerolinea === "Copa Airlines" && ruta !== "PTY") {
        fix(ruta ? `Copa ${ruta} → PTY` : "O/D vacío → deducido");
        ruta = "PTY";
      } else if (!ruta) {
        ruta = scheduledRoute(flightBase, tipo);
        if (ruta) fix("O/D vacío → deducido");
        // Si no es un vuelo regular, se deduce al final con los otros meses del archivo
      }
      if (ruta && !KNOWN_AIRPORTS.has(ruta)) warnings.push(`Aeropuerto desconocido: ${ruta}`);
      else if (aerolinea === "Air Panama" && ruta === "PTY") warnings.push("Air Panama con PTY (normalmente opera desde PAC)");

      const regRaw = text(r[col.reg]);
      const acRaw = text(r[col.ac])?.toUpperCase() ?? null;
      const aircraft = resolveAircraft({ aircraft: acRaw, aircraftReg: regRaw }, kb);
      const matricula = regRaw ? normalizeRegistration(regRaw) : null;
      if (regRaw && matricula !== regRaw) fix("Matrícula normalizada (HP1997PST → HP-1997)");
      const avion = aircraft.code ?? acRaw;
      if (acRaw && avion !== acRaw) fix(`Avión ${acRaw} → ${avion}`);

      let handler = text(r[col.handler]);
      if (handler && /^unknown/i.test(handler)) { handler = null; fix('Handler "Unknown" → vacío'); }
      const pax = Number(r[col.pax]);
      const mtow = col.mtow >= 0 ? Number(r[col.mtow]) : NaN;

      rows.push({
        id: `${sheet.name}#${excelRow}`,
        sheet: sheet.name,
        excelRow,
        tipo,
        fecha,
        aerolinea,
        numero_vuelo,
        ruta,
        matricula,
        avion,
        pasajeros: Number.isFinite(pax) && pax > 0 ? Math.round(pax) : 0,
        capacidad: aircraft.paxMax ?? (aerolinea === "Air Panama" ? 50 : 160),
        handler,
        stand: col.stand >= 0 ? text(r[col.stand]) : null,
        servicio: col.service >= 0 ? text(r[col.service]) : null,
        notas: col.notes >= 0 ? text(r[col.notes]) : null,
        mtow_kg: Number.isFinite(mtow) && mtow > 0 ? Math.round(mtow) : null,
        warnings,
        duplicadoDe: null,
        incluir: true,
      });
      count++;
    });
    sheetInfo.push({ name: sheet.name, rows: count, utc });
  }

  fillMissingRoutes(rows, fix);
  markDuplicates(rows);
  return { rows, sheets: sheetInfo, fixes };
}

// Pestañas sin O/D: la ruta más frecuente del mismo vuelo en el resto del archivo.
// En chárter (número de 4 cifras, p. ej. 7P-1952-P) la ruta varía: se avisa para revisarla.
function fillMissingRoutes(rows: ImportRow[], fix: (label: string) => void) {
  const seen = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.ruta) continue;
    const k = `${r.tipo}|${r.numero_vuelo}`;
    const m = seen.get(k) ?? new Map<string, number>();
    m.set(r.ruta, (m.get(r.ruta) ?? 0) + 1);
    seen.set(k, m);
  }
  for (const r of rows) {
    if (r.ruta) continue;
    const m = seen.get(`${r.tipo}|${r.numero_vuelo}`);
    const best = m && [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!best) {
      r.warnings.push("Sin origen/destino: complétalo antes de guardar");
      continue;
    }
    r.ruta = best;
    fix("O/D vacío → deducido");
    const base = r.numero_vuelo.split("-")[1] ?? "";
    if (base.length >= 4) r.warnings.push(`Ruta deducida de otros meses (${best}): verifícala`);
  }
}

// Mismo vuelo, mismo día y mismo sentido: se conserva la fila más completa
export const rowKey = (r: Pick<ImportRow, "fecha" | "tipo" | "numero_vuelo" | "ruta">) =>
  `${r.fecha}|${r.tipo}|${r.numero_vuelo}|${r.ruta}`;

export function markDuplicates(rows: ImportRow[]) {
  // Una fila con la fecha dudosa nunca desplaza a otra: probablemente es de otro día
  const score = (r: ImportRow) =>
    (r.warnings.some(w => w.startsWith("La fecha de pista")) ? -10 : 0) +
    (r.pasajeros > 0 ? 2 : 0) + (r.matricula ? 1 : 0) + r.pasajeros / 1000;
  const groups = new Map<string, ImportRow[]>();
  for (const r of rows) {
    r.duplicadoDe = null;
    if (!r.incluir) continue; // lo excluido a mano no compite
    const k = rowKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const best = group.reduce((a, b) => (score(b) > score(a) ? b : a));
    for (const r of group) if (r !== best) r.duplicadoDe = `fila ${best.excelRow} de ${best.sheet}`;
  }
}

// Edición manual desde la vista previa: aplica el cambio y rehace los avisos afectados
export type RowPatch = Partial<Pick<ImportRow, "fecha" | "numero_vuelo" | "ruta" | "pasajeros">>;

export function applyEdit(row: ImportRow, patch: RowPatch): ImportRow {
  const next = { ...row, ...patch };
  let warnings = [...row.warnings];
  if (patch.fecha !== undefined && patch.fecha !== row.fecha)
    warnings = warnings.filter(w => !w.startsWith("La fecha de pista"));
  if (patch.numero_vuelo !== undefined) {
    next.numero_vuelo = patch.numero_vuelo.trim().toUpperCase();
    if (next.numero_vuelo !== row.numero_vuelo) warnings = warnings.filter(w => !w.startsWith("Número de vuelo"));
  }
  if (patch.ruta !== undefined) {
    next.ruta = patch.ruta.trim().toUpperCase();
    if (next.ruta !== row.ruta) {
      warnings = warnings.filter(w => !/^(Sin origen|Aeropuerto desconocido|Air Panama con PTY|Ruta deducida)/.test(w));
      if (!next.ruta) warnings.push("Sin origen/destino: complétalo antes de guardar");
      else if (!KNOWN_AIRPORTS.has(next.ruta)) warnings.push(`Aeropuerto desconocido: ${next.ruta}`);
    }
  }
  next.warnings = warnings;
  return next;
}

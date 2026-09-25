// Reglas de la base de conocimiento de flota y tripulación.
// Funciones puras: reciben el conocimiento ya cargado (lib/fleet/knowledge.ts),
// así se pueden probar sin base de datos.

export type CrewRole = "capitan" | "primer_oficial" | "cabina";

export type FleetKnowledge = {
  types: { code: string; name: string; airline: string; paxMax: number; aliases: string[]; verified: boolean }[];
  aircraft: { registration: string; code: string; airline: string; verified: boolean }[];
  crew: { name: string; role: CrewRole; aliases: string[]; active: boolean }[];
  // code = modelo; null = vale para cualquier modelo
  routes: { airline: string; origin: string; destination: string; code: string | null; minutes: number | null }[];
  scheduled: { airline: string; flightNumber: string; origin: string; destination: string; usualDeparture: string | null; code: string | null }[];
};

export const EMPTY_KNOWLEDGE: FleetKnowledge = { types: [], aircraft: [], crew: [], routes: [], scheduled: [] };

// Un vuelo se identifica por número Y ruta: el 693 hace CHX-BOC y luego BOC-DAV
export const legKey = (f: { flightDate?: string; flightNumber: string; origin: string; destination: string }) =>
  `${f.flightDate ?? ""}_${f.flightNumber}_${f.origin}_${f.destination}`.toUpperCase();

// Número de vuelo en su forma estándar del histórico: "971", "7P971", "7P-971" → "7P-971";
// "CM 013", "CM013", "13" (Copa) → "CM-13"; los sufijos se conservan ("7P 971 A" → "7P-971-A").
// Todo lo que guarda en el histórico pasa por aquí, así el mismo vuelo nunca se escribe distinto.
export function canonicalFlightNumber(raw: string | null | undefined, airline?: string | null): string {
  const text = String(raw ?? "").toUpperCase().trim();
  const parts = text.replace(/^(7P|CMP?)(?=\d)/, "$1 ").split(/[\s-]+/).filter(Boolean);
  let prefix = airline === "Copa Airlines" ? "CM" : airline === "Air Panama" ? "7P" : null;
  if (parts[0] === "7P" || parts[0] === "CM" || parts[0] === "CMP") {
    const given = parts.shift() === "7P" ? "7P" : "CM";
    prefix ??= given;
  }
  const [num, ...suffix] = parts;
  if (!prefix || !num) return text;
  return [prefix, /^\d+$/.test(num) ? String(Number(num)) : num, ...suffix].join("-");
}

const plain = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

// "HP1997PST", "hp 1997", "HP-1997" → "HP-1997" (el sufijo PST/PS/CMP es del operador)
export function normalizeRegistration(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = raw.toUpperCase().replace(/\s+/g, "").match(/^HP-?(\d{3,4})/);
  return m ? `HP-${m[1]}` : raw.trim().toUpperCase();
}

// "FK50", "F50", "DHBD", "Q400" → código del modelo según sus alias
export function resolveAircraftCode(raw: string | null | undefined, kb: FleetKnowledge): string | null {
  if (!raw) return null;
  const v = raw.toUpperCase().replace(/\s+/g, "");
  const bare = v.replace(/-/g, "");
  const type = kb.types.find(t =>
    t.code === v ||
    t.code.replace(/-/g, "") === bare ||
    t.aliases.some(a => a.toUpperCase() === v || a.toUpperCase().replace(/-/g, "") === bare)
  );
  return type?.code ?? null;
}

export function capacityOf(code: string | null, kb: FleetKnowledge): number | null {
  const type = code ? kb.types.find(t => t.code === code) : undefined;
  return type && type.paxMax > 0 ? type.paxMax : null;
}

// Modelo y capacidad: primero por matrícula (lo más fiable), luego por el texto del modelo
export function resolveAircraft(input: { aircraft?: string | null; aircraftReg?: string | null }, kb: FleetKnowledge) {
  const registration = normalizeRegistration(input.aircraftReg);
  const known = kb.aircraft.find(a => a.registration === registration);
  const code = known?.code ?? resolveAircraftCode(input.aircraft, kb);
  return { registration, code, paxMax: capacityOf(code, kb), knownRegistration: !!known };
}

// Aplica la flota conocida a un registro antes de guardarlo: matrícula normalizada,
// código de modelo y capacidad de la base (la fuente de verdad), venga de donde venga
export function applyFleetRules<T extends { aircraft?: string | null; aircraftReg?: string | null; paxMax?: number | null }>(
  row: T,
  kb: FleetKnowledge
): T {
  if (!("aircraft" in row) && !("aircraftReg" in row)) return row;
  const { registration, code, paxMax } = resolveAircraft(row, kb);
  return {
    ...row,
    ...(registration ? { aircraftReg: registration } : {}),
    ...(code ? { aircraft: code } : {}),
    ...(paxMax ? { paxMax } : {}),
  };
}

// Minutos de la ruta para ese modelo (cada avión vuela a distinta velocidad);
// si el modelo no tiene tiempo propio, se usa el de la ruta para cualquier modelo.
// Una ruta es de ida y vuelta: PAC-DAV también vale para DAV-PAC.
export function routeMinutes(airline: string, origin: string, destination: string, kb: FleetKnowledge, aircraftCode?: string | null): number | null {
  const same = kb.routes.filter(r => r.airline === airline &&
    ((r.origin === origin && r.destination === destination) || (r.origin === destination && r.destination === origin)));
  const code = aircraftCode ? resolveAircraftCode(aircraftCode, kb) ?? aircraftCode.toUpperCase() : null;
  return (code ? same.find(r => r.code === code) : undefined)?.minutes ?? same.find(r => !r.code)?.minutes ?? null;
}

// ---------------------------------------------------------------------------
// Tripulación
// ---------------------------------------------------------------------------
function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// Nombre leído (con posibles errores de OCR) → tripulante conocido
export function matchCrew(raw: string, kb: FleetKnowledge) {
  const name = plain(raw).replace(/[^A-Z ]/g, "").trim();
  if (name.length < 4) return null;
  let best: { member: FleetKnowledge["crew"][number]; d: number } | null = null;
  for (const member of kb.crew) {
    for (const candidate of [member.name, ...member.aliases]) {
      const d = distance(name, plain(candidate));
      if (!best || d < best.d) best = { member, d };
    }
  }
  // Hasta 2 letras de diferencia en nombres largos (CEDENO vs CEDEÑO, VILLAREAL vs VILLARREAL)
  return best && best.d <= Math.min(2, Math.floor(name.length / 6)) ? best.member : null;
}

// Un trozo de la línea → tripulantes conocidos + lo que sobre como nota.
// Cubre dos casos del itinerario:
//  - el OCR no vio la "/": "MARIO RODRIGUEZ EDUARDO HERRERA" → dos tripulantes
//  - chárter con nota: "JORGE CANO CARGUERO" → Jorge Cano + nota "CARGUERO"
type CrewMatch = { raw: string; member: FleetKnowledge["crew"][number] | null; note: string };

function matchCrewSegments(raw: string, kb: FleetKnowledge): CrewMatch[] {
  const whole = matchCrew(raw, kb);
  if (whole) return [{ raw, member: whole, note: "" }];
  const words = raw.trim().split(/\s+/);
  // El nombre conocido más largo al inicio; el resto se vuelve a analizar
  for (let n = words.length - 1; n >= 2; n--) {
    const head = matchCrew(words.slice(0, n).join(" "), kb);
    if (!head) continue;
    const tail = words.slice(n).join(" ");
    const rest = matchCrewSegments(tail, kb);
    return rest.some(r => r.member)
      ? [{ raw: words.slice(0, n).join(" "), member: head, note: "" }, ...rest]
      : [{ raw: words.slice(0, n).join(" "), member: head, note: tail }];
  }
  return [{ raw, member: null, note: "" }];
}

// "RUDY NIETO / ADAM ALMENGOR" → nombres sueltos (el OCR a veces lee "/" como "!" o "|")
export function splitCrewNames(text: string): string[] {
  return text.split(/[/!|]| Y /).map(s => s.trim()).filter(s => s.replace(/[^A-Za-z]/g, "").length >= 4);
}

export type CrewLine =
  | { kind: "pilotos" | "cabina" | "desconocido"; text: string; unknown: string[]; notes: string }
  | { kind: "vacio" };

// Una línea de TRIPULACION del itinerario: ¿pilotos o cabina?
// Los nombres conocidos se devuelven con su escritura correcta y el capitán primero.
export function classifyCrewLine(text: string, kb: FleetKnowledge): CrewLine {
  const names = splitCrewNames(text);
  if (names.length === 0) return { kind: "vacio" };
  const matched = names.flatMap(n => matchCrewSegments(n.trim().toUpperCase(), kb));
  const unknown = matched.filter(m => !m.member).map(m => m.raw);
  const notes = matched.map(m => m.note).filter(Boolean).join(" · ");
  const roles = matched.flatMap(m => (m.member ? [m.member.role] : []));
  const order = { capitan: 0, primer_oficial: 1, cabina: 2 } as const;
  const clean = [...matched]
    .sort((a, b) => (a.member ? order[a.member.role] : 3) - (b.member ? order[b.member.role] : 3))
    .map(m => m.member?.name ?? m.raw)
    .join(" / ");

  if (roles.some(r => r !== "cabina")) return { kind: "pilotos", text: clean, unknown, notes };
  if (roles.length > 0) return { kind: "cabina", text: clean, unknown, notes };
  return { kind: "desconocido", text: clean, unknown, notes };
}

// ---------------------------------------------------------------------------
// Validación de un vuelo contra el catálogo
// ---------------------------------------------------------------------------
export function flightWarnings(
  f: { airline: string; flightNumber: string; origin: string; destination: string; paxCount?: number | null; aircraftReg?: string | null },
  kb: FleetKnowledge,
  resolved: { paxMax: number | null; knownRegistration: boolean }
): string[] {
  const warnings: string[] = [];
  const legs = kb.scheduled.filter(s => s.airline === f.airline && s.flightNumber === f.flightNumber);
  if (legs.length > 0 && !legs.some(s => s.origin === f.origin && s.destination === f.destination)) {
    warnings.push(`El ${f.flightNumber} normalmente es ${legs.map(s => `${s.origin}-${s.destination}`).join(" o ")}`);
  }
  if (resolved.paxMax && f.paxCount != null && f.paxCount > resolved.paxMax) {
    warnings.push(`${f.paxCount} pasajeros supera la capacidad (${resolved.paxMax})`);
  }
  if (f.paxCount == null) {
    warnings.push("Pasajeros no leídos: complétalos");
  } else if (resolved.paxMax && resolved.paxMax >= 50 && f.paxCount > 0 && f.paxCount < resolved.paxMax * 0.15) {
    // En aviones grandes un número muy bajo suele ser un dígito perdido por el OCR (71 → 7)
    warnings.push(`Revisa: ${f.paxCount} pasajeros es muy poco para este avión`);
  }
  if (f.aircraftReg && !resolved.knownRegistration && f.airline === "Air Panama") {
    warnings.push(`Matrícula ${normalizeRegistration(f.aircraftReg)} no está en la flota`);
  }
  return warnings;
}

"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { normalizeRegistration } from "@/lib/fleet/rules";

// Edición de la base de conocimiento desde el panel de admin.
// Cada tabla declara su clave y los campos editables: todo lo demás se descarta.

export type FleetTable = "aircraft_types" | "aircraft" | "crew_members" | "flight_routes" | "scheduled_flights";

type FieldKind = "text" | "upper" | "int" | "bool" | "list" | "time" | "role";

const TABLES: Record<FleetTable, { key: string; label: string; fields: Record<string, FieldKind> }> = {
  aircraft_types: {
    key: "aircraft_code", label: "modelo",
    fields: { aircraft_code: "upper", name: "text", airline: "text", pax_max: "int", aliases: "list", verified: "bool" },
  },
  aircraft: {
    key: "registration", label: "matrícula",
    fields: { registration: "upper", aircraft_code: "upper", airline: "text", verified: "bool", notes: "text" },
  },
  crew_members: {
    key: "id", label: "tripulante",
    fields: { full_name: "upper", role: "role", aliases: "list", active: "bool" },
  },
  flight_routes: {
    key: "id", label: "ruta",
    fields: { airline: "text", origin: "upper", destination: "upper", aircraft_code: "upper", estimated_duration_minutes: "int", verified: "bool" },
  },
  scheduled_flights: {
    key: "id", label: "vuelo regular",
    fields: { airline: "text", flight_number: "upper", origin: "upper", destination: "upper", usual_departure: "time", aircraft_code: "upper", active: "bool" },
  },
};

export type FleetRow = Record<string, string | number | boolean | string[] | null>;

function clean(table: FleetTable, input: FleetRow): FleetRow {
  const out: FleetRow = {};
  for (const [field, kind] of Object.entries(TABLES[table].fields)) {
    if (!(field in input)) continue;
    const v = input[field];
    switch (kind) {
      case "text":  out[field] = v == null || v === "" ? null : String(v).trim(); break;
      case "upper": out[field] = v == null || v === "" ? null : String(v).trim().toUpperCase(); break;
      case "int": {
        const n = v === "" || v == null ? null : Number(v);
        if (n !== null && (!Number.isInteger(n) || n < 0 || n > 1000)) throw new Error(`${field}: número inválido`);
        out[field] = n;
        break;
      }
      case "bool":  out[field] = v === true || v === "true"; break;
      case "list":  out[field] = (Array.isArray(v) ? v : String(v ?? "").split(",")).map(s => String(s).trim().toUpperCase()).filter(Boolean); break;
      case "time": {
        const t = v == null ? "" : String(v).trim();
        if (t && !/^\d{1,2}:\d{2}$/.test(t)) throw new Error("Hora inválida (usa HH:MM)");
        out[field] = t ? t.padStart(5, "0") : null;
        break;
      }
      case "role":
        if (!["capitan", "primer_oficial", "cabina"].includes(String(v))) throw new Error("Rol inválido");
        out[field] = String(v);
        break;
    }
  }
  if (table === "aircraft" && out.registration) out.registration = normalizeRegistration(String(out.registration));
  return out;
}

function assertTable(table: string): asserts table is FleetTable {
  if (!(table in TABLES)) throw new Error("Tabla no permitida");
}

export async function getFleetAdminData() {
  await requireAdmin();
  const db = createAdminClient();
  const [types, aircraft, crew, routes, scheduled] = await Promise.all([
    db.from("aircraft_types").select("*").order("airline").order("aircraft_code"),
    db.from("aircraft").select("*").order("registration"),
    db.from("crew_members").select("*").order("role").order("full_name"),
    db.from("flight_routes").select("*").order("origin").order("destination"),
    db.from("scheduled_flights").select("*").order("flight_number").order("usual_departure"),
  ]);
  return {
    aircraft_types: (types.data ?? []) as FleetRow[],
    aircraft: (aircraft.data ?? []) as FleetRow[],
    crew_members: (crew.data ?? []) as FleetRow[],
    flight_routes: (routes.data ?? []) as FleetRow[],
    scheduled_flights: (scheduled.data ?? []) as FleetRow[],
  };
}

// key = valor actual de la clave (null para crear uno nuevo).
// Sin revalidatePath: el panel recarga sus datos solo; revalidar volvía a generar toda
// la página de admin (sesión, perfil y lista de usuarios) en cada guardado y lo hacía lento.
export async function saveFleetRow(table: string, key: string | null, input: FleetRow) {
  const admin = await requireAdmin();
  assertTable(table);
  const def = TABLES[table];
  const db = createAdminClient();

  let row: FleetRow;
  try {
    row = clean(table, input);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { error } = key === null
    ? await db.from(table).insert(row)
    : await db.from(table).update(row).eq(def.key, key);
  if (error) {
    const duplicate = table === "flight_routes" ? "Ya existe esa ruta para ese modelo (vale de ida y de vuelta)" : `Ya existe ese ${def.label}`;
    return { error: error.code === "23505" ? duplicate : error.code === "23503" ? "El modelo indicado no existe" : error.message };
  }

  await logAudit({
    tipo_evento: "edicion",
    actor: admin,
    entidad: "flota",
    nombre_referencia: String(row[def.key === "id" ? Object.keys(def.fields)[0] : def.key] ?? key ?? ""),
    descripcion: `${key === null ? "Agregó" : "Editó"} ${def.label} en la base de flota`,
    detalles_extra: { tabla: table, cambios: row },
  });
  return { success: true };
}

// Marca como confirmadas varias filas de una vez (botón "Confirmar todos" del panel)
export async function confirmFleetRows(table: string, keys: string[]) {
  const admin = await requireAdmin();
  assertTable(table);
  const def = TABLES[table];
  if (!("verified" in def.fields)) return { error: "Esta tabla no se confirma" };
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 500) return { error: "Nada que confirmar" };
  const { error } = await createAdminClient().from(table).update({ verified: true }).in(def.key, keys.map(String));
  if (error) return { error: error.message };
  await logAudit({
    tipo_evento: "edicion",
    actor: admin,
    entidad: "flota",
    nombre_referencia: `${keys.length} ${def.label}(s)`,
    descripcion: `Confirmó ${keys.length} ${def.label}(s) en la base de flota`,
    detalles_extra: { tabla: table, claves: keys },
  });
  return { success: true };
}

export async function deleteFleetRow(table: string, key: string) {
  const admin = await requireAdmin();
  assertTable(table);
  const def = TABLES[table];
  const { error } = await createAdminClient().from(table).delete().eq(def.key, key);
  if (error) {
    return { error: error.code === "23503" ? `No se puede borrar: hay registros que usan este ${def.label}` : error.message };
  }
  await logAudit({
    tipo_evento: "eliminacion",
    actor: admin,
    entidad: "flota",
    nombre_referencia: key,
    descripcion: `Eliminó ${def.label} de la base de flota`,
    detalles_extra: { tabla: table },
  });
  return { success: true };
}

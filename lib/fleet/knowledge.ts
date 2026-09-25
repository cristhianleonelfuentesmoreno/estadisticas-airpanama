import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CrewRole, FleetKnowledge } from "./rules";

// Carga la base de conocimiento (flota, tripulación, rutas, vuelos regulares) una vez
// por petición. Se lee con la sesión del usuario: RLS solo deja leer a usuarios aprobados.
export const loadFleetKnowledge = cache(async (): Promise<FleetKnowledge> => {
  const supabase = await createClient();
  const [types, aircraft, crew, routes, scheduled] = await Promise.all([
    supabase.from("aircraft_types").select("aircraft_code, name, airline, pax_max, aliases, verified"),
    supabase.from("aircraft").select("registration, aircraft_code, airline, verified"),
    supabase.from("crew_members").select("full_name, role, aliases, active").eq("active", true),
    supabase.from("flight_routes").select("airline, origin, destination, aircraft_code, estimated_duration_minutes"),
    supabase.from("scheduled_flights").select("airline, flight_number, origin, destination, usual_departure, aircraft_code").eq("active", true),
  ]);

  return {
    types: (types.data ?? []).map(t => ({
      code: t.aircraft_code, name: t.name ?? "", airline: t.airline ?? "", paxMax: t.pax_max ?? 0,
      aliases: t.aliases ?? [], verified: t.verified,
    })),
    aircraft: (aircraft.data ?? []).map(a => ({
      registration: a.registration, code: a.aircraft_code, airline: a.airline, verified: a.verified,
    })),
    crew: (crew.data ?? []).map(c => ({
      name: c.full_name, role: c.role as CrewRole, aliases: c.aliases ?? [], active: c.active,
    })),
    routes: (routes.data ?? []).map(r => ({
      airline: r.airline ?? "", origin: r.origin ?? "", destination: r.destination ?? "", code: r.aircraft_code ?? null,
      minutes: r.estimated_duration_minutes,
    })),
    scheduled: (scheduled.data ?? []).map(s => ({
      airline: s.airline, flightNumber: s.flight_number, origin: s.origin, destination: s.destination,
      usualDeparture: s.usual_departure, code: s.aircraft_code,
    })),
  };
});

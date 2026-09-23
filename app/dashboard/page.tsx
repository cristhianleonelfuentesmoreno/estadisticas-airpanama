import { getSessionProfile } from "@/lib/auth";
import { getUpcomingFlights } from "@/app/actions/flights";
import { getFlightDecisions } from "@/app/actions/weather";
import { DashboardHome } from "@/components/dashboard/DashboardHome";

// Clima + hora en que se consultó (se muestra como "Act. hh:mm")
async function loadDecisions() {
  const decisions = await getFlightDecisions().catch(() => []);
  return { decisions, fetchedAt: Date.now() };
}

export default async function DashboardPage() {
  // Ya verificado por el layout; cache() evita repetir la consulta
  const profile = (await getSessionProfile())!;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });

  // Arrancan EN PARALELO y sin await: la página se pinta de inmediato y cada
  // sección aparece cuando llegan sus datos (antes eran acciones en fila desde el navegador)
  const flightsPromise = getUpcomingFlights(today).catch(() => []);
  const decisionsPromise = loadDecisions();

  return (
    <DashboardHome
      userName={profile.nombre || profile.fullName || profile.email?.split("@")[0] || "Usuario"}
      userCargo={profile.cargo || "Sin cargo asignado"}
      avatarUrl={profile.avatarUrl ?? null}
      isAdmin={profile.role === "administrador"}
      today={today}
      flightsPromise={flightsPromise}
      decisionsPromise={decisionsPromise}
    />
  );
}

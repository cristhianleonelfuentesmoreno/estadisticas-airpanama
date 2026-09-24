import TablasDiariasClient from "@/components/dashboard/TablasDiariasClient";
import { requireApprovedUser } from "@/lib/auth";
import { getLlegadasMalek, getSalidasMalek, syncCompletedMalekFlights } from "@/app/actions/flights";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TablasDiariasPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const user = await requireApprovedUser();
  const dateParam = typeof params.date === 'string' ? params.date : undefined;

  // Determinar la fecha actual que se esta visualizando
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
  const currentDateStr = dateParam || today;

  // Guardar los vuelos completados del día (itinerario → histórico) y leer el Registro,
  // todo en paralelo: antes se esperaba la sincronización antes de leer y cada cambio de
  // fecha tardaba más. Un vuelo que arriba justo en ese instante aparece al recargar.
  const [llegadas, salidas] = await Promise.all([
    getLlegadasMalek(dateParam),
    getSalidasMalek(dateParam),
    currentDateStr === today ? syncCompletedMalekFlights().catch(() => {}) : null,
  ]);

  return (
    <div className="w-full h-full bg-[#f7f9fb]">
      <TablasDiariasClient 
        initialData={{ llegadas: llegadas || [], salidas: salidas || [] }} 
        currentDateStr={currentDateStr}
        role={user.role}
        openPendientes={params.pendientes === '1'}
      />
    </div>
  );
}

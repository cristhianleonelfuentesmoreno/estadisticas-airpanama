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

  // Guardar automáticamente los vuelos completados de hoy (itinerario consultado una sola vez).
  // Si se ve hoy, hay que esperar a que termine para leer lo recién guardado;
  // si se ve otro día, todo va en paralelo.
  const sync = syncCompletedMalekFlights();
  if (currentDateStr === today) await sync;

  // Llegadas y salidas en paralelo
  const [llegadas, salidas] = await Promise.all([
    getLlegadasMalek(dateParam),
    getSalidasMalek(dateParam),
    sync,
  ]);

  return (
    <div className="w-full h-full bg-[#f7f9fb]">
      <TablasDiariasClient 
        initialData={{ llegadas: llegadas || [], salidas: salidas || [] }} 
        currentDateStr={currentDateStr}
        isAdmin={user.role === 'administrador'}
      />
    </div>
  );
}

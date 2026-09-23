import TablasDiariasClient from "@/components/dashboard/TablasDiariasClient";
import { requireApprovedUser } from "@/lib/auth";
import { getLlegadasMalek, saveCompletedMalekFlights, getSalidasMalek, saveCompletedMalekDepartures } from "@/app/actions/flights";

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

  // Tratar de guardar cualquier vuelo completado recientemente de forma automatica
  await saveCompletedMalekFlights();
  await saveCompletedMalekDepartures();

  // Traer los datos historicos
  const llegadas = await getLlegadasMalek(dateParam);
  const salidas = await getSalidasMalek(dateParam);

  // Determinar la fecha actual que se esta visualizando
  const currentDateStr = dateParam || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });

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

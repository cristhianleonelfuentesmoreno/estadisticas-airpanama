import TablasDiariasClient from "@/components/dashboard/TablasDiariasClient";
import { getLlegadasMalek, saveCompletedMalekFlights, getSalidasMalek, saveCompletedMalekDepartures } from "@/app/actions/flights";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TablasDiariasPage() {
  // Tratar de guardar cualquier vuelo completado recientemente de forma automatica
  await saveCompletedMalekFlights();
  await saveCompletedMalekDepartures();

  // Traer los datos historicos
  const llegadas = await getLlegadasMalek();
  const salidas = await getSalidasMalek();

  return (
    <div className="w-full h-full bg-[#f7f9fb]">
      <TablasDiariasClient initialData={{ llegadas: llegadas || [], salidas: salidas || [] }} />
    </div>
  );
}

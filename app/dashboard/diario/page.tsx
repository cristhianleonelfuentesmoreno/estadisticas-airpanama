import TablasDiariasClient from "@/components/dashboard/TablasDiariasClient";
import { getLlegadasMalek, saveCompletedMalekFlights } from "@/app/actions/flights";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TablasDiariasPage() {
  // Tratar de guardar cualquier vuelo completado recientemente de forma automatica
  await saveCompletedMalekFlights();

  // Traer los datos historicos
  const llegadas = await getLlegadasMalek();

  return (
    <div className="w-full h-full bg-[#f7f9fb]">
      <TablasDiariasClient initialData={llegadas || []} />
    </div>
  );
}

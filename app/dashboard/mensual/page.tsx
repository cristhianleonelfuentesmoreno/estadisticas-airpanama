import { getReporteMensual } from "@/app/actions/flights";
import MensualClient from "@/components/dashboard/MensualClient";
import { getSessionProfile } from "@/lib/auth";

export default async function ReportesMensualesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; range?: string }>;
}) {
  const params = await searchParams;
  
  const today = new Date();
  const year = params.year ? parseInt(params.year) : today.getFullYear();
  const month = params.month ? parseInt(params.month) : today.getMonth() + 1;

  const range = (params.range as 'month' | 'year' | '6m') || 'month';

  const [rawFlights, profile] = await Promise.all([getReporteMensual(year, month, range), getSessionProfile()]);
  // Quien exporta queda escrito en el PDF y el Excel (control de quién saca los datos)
  const exportedBy = { nombre: profile?.nombre || profile?.fullName || profile?.email || "Usuario", email: profile?.email ?? "" };

  return (
    <div className="w-full h-full flex flex-col">
      <MensualClient rawFlights={rawFlights} initialYear={year} initialMonth={month} initialRange={range} exportedBy={exportedBy} />
    </div>
  );
}

import { getReporteMensual } from "@/app/actions/flights";
import MensualClient from "@/components/dashboard/MensualClient";

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

  const rawFlights = await getReporteMensual(year, month, range);

  return (
    <div className="w-full h-full flex flex-col">
      <MensualClient rawFlights={rawFlights} initialYear={year} initialMonth={month} initialRange={range} />
    </div>
  );
}

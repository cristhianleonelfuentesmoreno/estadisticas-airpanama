import { getReporteMensual } from "@/app/actions/flights";
import MensualClient from "@/components/dashboard/MensualClient";

export default async function ReportesMensualesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  
  const today = new Date();
  const year = params.year ? parseInt(params.year) : today.getFullYear();
  const month = params.month ? parseInt(params.month) : today.getMonth() + 1;

  const data = await getReporteMensual(year, month);

  return (
    <div className="w-full h-full flex flex-col">
      <MensualClient initialData={data} initialYear={year} initialMonth={month} />
    </div>
  );
}

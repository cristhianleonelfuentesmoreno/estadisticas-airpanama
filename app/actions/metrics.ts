"use server";

import { requireSupervisor } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type NavMetric = {
  pagina: string;
  tipo: "carga_inicial" | "cambio_seccion" | "cambio_filtro";
  dispositivo: "celular" | "tablet" | "computadora";
  mediciones: number;
  mediana_ms: number;
  lento_ms: number;
};

// Resumen de velocidad (mediana y percentil 90) de los últimos `dias`
export async function getNavigationMetrics(dias: number = 7): Promise<NavMetric[]> {
  await requireSupervisor();
  const d = [1, 7, 30, 90].includes(dias) ? dias : 7;
  const { data, error } = await createAdminClient().rpc("metricas_navegacion_resumen", { dias: d });
  if (error) throw new Error(error.message);
  return (data ?? []) as NavMetric[];
}

"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type TablaUso = { tabla: string; filas: number; bytes: number; datos_bytes: number; indices_bytes: number };
export type UsoSupabase = {
  db_bytes: number;
  tablas: TablaUso[];
  storage_bytes: number;
  storage_archivos: number;
  usuarios_total: number;
  usuarios_mes: number;
  ultima_actividad: string | null;
  medido_en: string;
  proyecto: string;
};

// Consumo del plan gratuito de Supabase (solo administrador)
export async function getSupabaseUsage(): Promise<UsoSupabase> {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("monitoreo_uso");
  if (error) throw new Error(error.message);
  const proyecto = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const uso = data as Omit<UsoSupabase, "proyecto">;
  return {
    ...uso,
    db_bytes: Number(uso.db_bytes),
    storage_bytes: Number(uso.storage_bytes),
    tablas: uso.tablas.map(t => ({ ...t, filas: Number(t.filas), bytes: Number(t.bytes) })).sort((a, b) => b.bytes - a.bytes),
    proyecto,
  };
}

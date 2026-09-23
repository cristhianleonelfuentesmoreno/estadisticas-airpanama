"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getAuditLogs() {
  await requireAdmin();

  const { data, error } = await createAdminClient()
    .from('registros_auditoria')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(500); // Limitar a 500 para rendimiento en panel

  if (error) {
    console.error("Error obteniendo logs de auditoría:", error);
    return [];
  }
  return data || [];
}

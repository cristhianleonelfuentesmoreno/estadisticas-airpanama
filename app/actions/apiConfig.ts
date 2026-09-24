"use server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type ApiConfig = {
  id: string; // 'flightaware' | 'flightradar24'
  api_key: string;
  is_active: boolean;
};

// Prefijo que marca una clave enmascarada: si vuelve así desde el cliente,
// significa que el administrador no la cambió.
const MASK = '••••••••';

const maskKey = (key: string) => (key ? `${MASK}${key.slice(-4)}` : '');

const FALLBACK_CONFIGS: Record<string, ApiConfig> = {
  gemini: {
    id: 'gemini',
    api_key: process.env.GEMINI_API_KEY || '',
    is_active: true
  }
};

// Devuelve las claves ENMASCARADAS: la clave completa nunca sale del servidor.
export async function getApiConfigs(): Promise<Record<string, ApiConfig>> {
  await requireAdmin();

  const configs: Record<string, ApiConfig> = { ...FALLBACK_CONFIGS };
  try {
    const { data, error } = await createAdminClient().from('api_configurations').select('*');
    // Si la tabla no existe o hay error, usar fallback de .env
    if (!error && data) {
      data.forEach((row) => {
        configs[row.id] = {
          id: row.id,
          api_key: row.api_key,
          is_active: row.is_active
        };
      });
    }
  } catch {
    // usar fallback
  }

  return Object.fromEntries(
    Object.entries(configs).map(([id, c]) => [id, { ...c, api_key: maskKey(c.api_key) }])
  );
}

export async function saveApiConfig(id: string, apiKey: string, isActive: boolean) {
  const admin = await requireAdmin();

  const row: Record<string, unknown> = {
    id,
    is_active: isActive,
    updated_at: new Date().toISOString()
  };
  // Solo guardar la clave si el administrador escribió una nueva
  if (!apiKey.startsWith(MASK)) row.api_key = apiKey;

  const { error } = await createAdminClient()
    .from('api_configurations')
    .upsert(row);

  if (error) {
    console.error("Error saving API config:", error);
    throw new Error(error.message);
  }
  // Nunca se registra la clave, solo que cambió
  await logAudit({
    tipo_evento: 'edicion',
    actor: admin,
    entidad: 'configuracion',
    entidad_id: id,
    nombre_referencia: `API ${id}`,
    descripcion: `${'api_key' in row ? 'Cambió la clave y ' : ''}${isActive ? 'activó' : 'desactivó'} la conexión ${id}`,
  });
  return true;
}

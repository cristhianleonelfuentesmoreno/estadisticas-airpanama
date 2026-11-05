import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// La clave vive cifrada en la bóveda de Supabase (la pone el administrador en /admin);
// si no hay, se usa ANTHROPIC_API_KEY del servidor. Nunca sale hacia el navegador.
export async function claveYModelo(): Promise<{ clave: string | null; modelo: string }> {
  const admin = createAdminClient()
  const [{ data: clave }, { data: config }] = await Promise.all([
    admin.rpc('clave_ia'),
    admin.from('config_ia').select('modelo').eq('id', 1).single(),
  ])
  return { clave: (clave as string | null) ?? process.env.ANTHROPIC_API_KEY ?? null, modelo: config?.modelo ?? 'claude-haiku-5-5' }
}

import { createClient } from '@supabase/supabase-js'

// Cliente con la Service Role Key: se salta RLS.
// Úsalo SOLO en el servidor y SIEMPRE después de requireApprovedUser()/requireAdmin().
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

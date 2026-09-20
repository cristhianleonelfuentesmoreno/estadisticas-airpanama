import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data, error } = await supabase.from('llegadas_malek_historico').select('id, fecha, numero_vuelo, creado_en').eq('fecha', '2026-09-20');
  console.log("Llegadas 2026-09-20:", data);
}
run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  const { data, error } = await supabase.from('llegadas_malek_historico').select('id, fecha, numero_vuelo, creado_en').order('creado_en', { ascending: false }).limit(20);
  console.log("Ultimos 20 registros:", data);
}
run();

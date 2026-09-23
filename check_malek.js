const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const date = '2026-09-21';
  const { data: llegadas } = await supabase.from('llegadas_malek_historico').select('*').eq('fecha', date);
  const { data: salidas } = await supabase.from('salidas_malek_historico').select('*').eq('fecha', date);
  console.log("LLEGADAS:", llegadas);
  console.log("SALIDAS:", salidas);
}
run();

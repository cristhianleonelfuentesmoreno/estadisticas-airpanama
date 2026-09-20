import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fivelvadctsggzifcmtq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function wipeToday() {
  const today = '2026-09-20';
  console.log("Borrando todo lo de hoy para dejarlo en blanco...");
  await supabase.from('llegadas_malek_historico').delete().eq('fecha', today);
  await supabase.from('salidas_malek_historico').delete().eq('fecha', today);
  console.log("¡Listo, todo borrado!");
}

wipeToday();

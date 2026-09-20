import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fivelvadctsggzifcmtq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function wipeSeptember() {
  console.log("Borrando llegadas del 1 al 20 de septiembre...");
  const { error: err1 } = await supabase
    .from('llegadas_malek_historico')
    .delete()
    .gte('fecha', '2026-09-01')
    .lte('fecha', '2026-09-20');
  
  if (err1) console.error("Error en llegadas:", err1);
  else console.log("Llegadas borradas.");

  console.log("Borrando salidas del 1 al 20 de septiembre...");
  const { error: err2 } = await supabase
    .from('salidas_malek_historico')
    .delete()
    .gte('fecha', '2026-09-01')
    .lte('fecha', '2026-09-20');
  
  if (err2) console.error("Error en salidas:", err2);
  else console.log("Salidas borradas.");

  console.log("Limpieza completada.");
}

wipeSeptember();

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function run() {
  const { error } = await supabase
    .from('salidas_malek_historico')
    .insert({
      fecha: '2026-09-22',
      aerolinea: 'Air Panama',
      numero_vuelo: '971',
      destino: 'PAC',
      hora_itinerario: '2026-09-22T17:30:00-05:00',
      hora_real_salida: '2026-09-22T17:30:00-05:00',
      hora_salida_real: '2026-09-22T17:30:00-05:00',
      estado_final: 'CUMPLIDO',
      pasajeros_abordo: 62,
      capacidad_total: 74
    });
  console.log("Error inserting 971:", error);
}
run();

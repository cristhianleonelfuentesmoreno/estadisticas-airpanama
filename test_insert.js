require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  console.log("Testing arrivals...");
  const { data, error } = await supabase
    .from('llegadas_malek_historico')
    .insert([
      {
        aerolinea: 'Copa Airlines',
        numero_vuelo: 'CM-011',
        origen: 'PTY',
        hora_llegada_real: '2026-09-20T08:50:00Z',
        estado_final: 'LLEGÓ',
        pasajeros_abordo: 145,
        capacidad_total: 160
      }
    ])
    .select();
  console.log("Arrival result:", error ? error.message : "Success", data);

  console.log("Testing departures...");
  const { data: data2, error: error2 } = await supabase
    .from('salidas_malek_historico')
    .insert([
      {
        aerolinea: 'Copa Airlines',
        numero_vuelo: 'CM-012',
        destino: 'PTY',
        hora_salida_real: '2026-09-20T10:25:00Z',
        estado_final: 'LLEGÓ',
        pasajeros_abordo: 155,
        capacidad_total: 160
      }
    ])
    .select();
  console.log("Departure result:", error2 ? error2.message : "Success", data2);
}

test();

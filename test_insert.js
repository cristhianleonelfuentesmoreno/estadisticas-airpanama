require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function run() {
  const table = 'manual_flights_log';
  
  const mappedRecord = {
       fecha: '2026-01-01',
       aerolinea: 'Copa Airlines',
       numero_vuelo: 'CM-013',
       origen: 'PAC',
       destino: 'DAV',
       estado_final: 'LLEGÓ',
       pasajeros_abordo: 37,
       capacidad_total: 160,
       is_llegada: true,
       avion: 'B738',
       hora_itinerario_llegada: '2026-01-01T08:00:00.000Z',
       hora_real_llegada: '2026-01-01T12:54:00.000Z'
  };

  const { data, error } = await supabase.from(table).insert([mappedRecord]);
  if (error) {
    console.error("Insert Error:", error);
  } else {
    console.log("Insert Success:", data);
  }
}
run();

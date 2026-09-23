const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function check() {
  const date = '2026-09-21';
  const { data: manual } = await supabase.from('manual_flights_log').select('*').eq('flightDate', date);
  console.log("=== MANUAL FLIGHTS LOG ===");
  console.table(manual.map(m => ({ id: m.id, flight: m.flightNumber, orig: m.origin, dest: m.destination, pax: m.paxCount })));

  const { data: llegadas } = await supabase.from('llegadas_malek_historico').select('*').eq('fecha', date);
  console.log("=== LLEGADAS MALEK ===");
  console.table(llegadas.map(m => ({ id: m.id, flight: m.numero_vuelo, orig: m.origen, dest: m.destino, pax: m.pasajeros_abordo })));

  const { data: salidas } = await supabase.from('salidas_malek_historico').select('*').eq('fecha', date);
  console.log("=== SALIDAS MALEK ===");
  console.table(salidas.map(m => ({ id: m.id, flight: m.numero_vuelo, orig: m.origen, dest: m.destino, pax: m.pasajeros_abordo })));
}
check();

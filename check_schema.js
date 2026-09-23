const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  // Obtener info de columnas del manual_flights_log
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'manual_flights_log' }).catch(() => ({ data: null, error: { message: 'no rpc' } }));
  
  // Fallback: insertar un registro de prueba con valores largos para detectar límites
  const test = await supabase.from('manual_flights_log').select('flightNumber, aircraftReg, aircraft').limit(5);
  console.log('Sample rows:');
  console.table(test.data.map(r => ({ flightNumber: r.flightNumber, flightLen: r.flightNumber?.length, aircraftReg: r.aircraftReg, regLen: r.aircraftReg?.length })));
}
run();

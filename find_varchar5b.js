const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function tryInsert(record) {
  const { error } = await supabase.from('manual_flights_log').insert([record]);
  return error ? `❌ ${error.message}` : '✅ OK';
}

async function run() {
  // El error persiste incluso con strings cortos. 
  // Quizás es flightDate (10 chars) o airline (13 chars) - veamos qué campo es varchar(5)
  // Vamos a consultar information_schema
  const { data, error } = await supabase.rpc('exec_sql', { sql: "SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'manual_flights_log' ORDER BY ordinal_position" });
  if (data) console.log('Schema:', data);
  if (error) console.log('RPC not available:', error.message);
  
  // Probar con flightDate como date object
  console.log('\nTest 1 - minimal record with date string:');
  console.log(await tryInsert({
    flightDate: '2026-01-01',
    airline: 'Copa Airlines',
    flightNumber: '013',
    origin: 'PTY',
    destination: 'DAV',
    paxCount: 37,
    paxMax: 160
  }));
  
  console.log('\nTest 2 - without arrivalTimeLocal:');
  console.log(await tryInsert({
    flightDate: '2026-01-01',
    airline: 'Copa Airlines',
    flightNumber: '013',
    origin: 'PTY',
    destination: 'DAV',
    paxCount: 37,
    paxMax: 160,
    actual_arrival_time: '2026-01-01T12:54:00.000Z'
  }));
}
run();

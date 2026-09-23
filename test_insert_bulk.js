const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  // Simular exactamente lo que insertFlightRecords hace con registros del Excel de enero
  const testRecords = [
    {
      flightDate: '2026-01-01',
      airline: 'Copa Airlines',
      flightNumber: '013',
      origin: 'PTY',
      destination: 'DAV',
      status_override: 'DEMORADO',
      paxCount: 37,
      paxMax: 160,
      aircraft: 'B738',
      aircraftReg: 'HP185',
      arrivalTimeLocal: '07:59',
      actual_arrival_time: '2026-01-01T12:54:00.000Z'
    }
  ];
  
  const { data, error } = await supabase.from('manual_flights_log').insert(testRecords).select('id');
  if (error) {
    console.log('❌ Error:', error.code, error.message);
    // Now try without aircraftReg
    const { error: e2 } = await supabase.from('manual_flights_log').insert([{ ...testRecords[0], aircraftReg: null }]).select('id');
    if (e2) console.log('❌ Error sin aircraftReg:', e2.code, e2.message);
    else console.log('✅ Funciona sin aircraftReg');
    // Try without aircraft
    const { error: e3 } = await supabase.from('manual_flights_log').insert([{ ...testRecords[0], aircraftReg: null, aircraft: null }]).select('id');
    if (e3) console.log('❌ Error sin aircraft:', e3.code, e3.message);
    else console.log('✅ Funciona sin aircraft');
  } else {
    console.log('✅ Insert ok:', data);
    await supabase.from('manual_flights_log').delete().eq('id', data[0].id);
  }
}
run();

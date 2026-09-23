const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  // Intentar insertar un registro con campos largos para ver cuál falla
  const testRecord = {
    flightDate: '2099-12-31',
    airline: 'Test',
    flightNumber: '12345',
    origin: 'PAC',
    destination: 'DAV',
    status_override: 'LLEGÓ',
    paxCount: 0,
    paxMax: 0,
    aircraft: 'B738',
    aircraftReg: 'HP1856'
  };
  
  const { data, error } = await supabase.from('manual_flights_log').insert(testRecord).select();
  if (error) {
    console.log('❌ Error:', error.message, '| code:', error.code);
  } else {
    console.log('✅ Insert ok, id:', data[0]?.id);
    // Cleanup
    await supabase.from('manual_flights_log').delete().eq('id', data[0].id);
    console.log('✅ Cleaned up test record');
  }
  
  // Probar con flightNumber más largo
  const test2 = { ...testRecord, flightNumber: '7P-970' };
  const { data: d2, error: e2 } = await supabase.from('manual_flights_log').insert(test2).select();
  if (e2) {
    console.log('❌ Error flightNumber 7P-970:', e2.message);
  } else {
    console.log('✅ flightNumber "7P-970" works');
    await supabase.from('manual_flights_log').delete().eq('id', d2[0].id);
  }
}
run();

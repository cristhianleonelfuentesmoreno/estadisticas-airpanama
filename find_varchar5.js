const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

// Binary search: quitar campos uno por uno para identificar cuál falla
async function tryInsert(record) {
  const { error } = await supabase.from('manual_flights_log').insert([record]);
  return error ? error.message : 'OK';
}

async function run() {
  const base = {
    flightDate: '2026-01-01',
    airline: 'Copa Airlines',
    flightNumber: '013',
    origin: 'PTY',
    destination: 'DAV',
    status_override: 'DEMORADO',
    paxCount: 37,
    paxMax: 160,
    arrivalTimeLocal: '07:59',
    actual_arrival_time: '2026-01-01T12:54:00.000Z'
  };
  
  console.log('Testing base (without aircraft/aircraftReg):', await tryInsert(base));
  console.log('Testing with status_override LLEGÓ:', await tryInsert({ ...base, status_override: 'LLEGÓ' }));
  console.log('Testing with status_override=DEMORADO (7 chars):', await tryInsert({ ...base, status_override: 'DEMORADO' }));
  
  // Test each field individually adding > 5 chars
  const fields = Object.entries(base).filter(([k, v]) => typeof v === 'string');
  for (const [k, v] of fields) {
    console.log(`  ${k}: "${v}" (${v.length} chars)`);
  }
}
run();

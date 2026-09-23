const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const { data } = await supabase.from('manual_flights_log').select('flightNumber, aircraftReg, aircraft').limit(5);
  console.log('Sample rows:');
  data.forEach(r => {
    console.log(`flightNumber: "${r.flightNumber}" (len=${r.flightNumber?.length}), aircraftReg: "${r.aircraftReg}" (len=${r.aircraftReg?.length})`);
  });
}
run();

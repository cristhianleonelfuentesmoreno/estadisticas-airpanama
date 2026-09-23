const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const date = '2026-09-21';
  const { data } = await supabase.from('manual_flights_log').select('*').in('flightNumber', ['970', '971']).eq('flightDate', date);
  console.log(data);
}
run();

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function run() {
  const { data, error } = await supabase.from('manual_flights_log').select('*').limit(1);
  if (error) {
    console.error("Select Error:", error);
  } else {
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    } else {
      console.log("No data, try inserting an empty object to see error");
      const res = await supabase.from('manual_flights_log').insert([{}]);
      console.log(res.error);
    }
  }
}
run();

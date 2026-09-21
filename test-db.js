const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function run() {
  const { data, error } = await supabase.from('api_configurations').select('*');
  console.log("DB Configs:", data);
}
run();

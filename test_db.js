require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function run() {
  const { data, error } = await supabase.rpc('get_policies'); // or we can just query pg_policies
  const { data: policies } = await supabase.from('pg_policies').select('*').eq('tablename', 'perfiles');
  console.log("Policies:", policies);
}
run();

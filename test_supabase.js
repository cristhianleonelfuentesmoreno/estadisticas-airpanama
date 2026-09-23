const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
async function run() {
  const { data: cols, error } = await supabase.from('llegadas_malek_historico').select('*').limit(1);
  console.log(cols ? Object.keys(cols[0] || {}) : error);
}
run();

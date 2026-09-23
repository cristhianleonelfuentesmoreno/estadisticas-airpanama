import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const { data, error } = await supabase.from('perfiles').select('*').eq('email', 'cristhianleonelfuentesmoreno@gmail.com');
  console.log("DB DATA:", data);
  if (error) console.error("ERROR:", error);
}
run();

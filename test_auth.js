import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  console.log("AUTH USERS:", users.map(u => ({ id: u.id, email: u.email })));
  
  const { data: perfiles } = await supabase.from('perfiles').select('*');
  console.log("PERFILES DB:", perfiles);
}
run();
